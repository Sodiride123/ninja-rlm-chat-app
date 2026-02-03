"""
RLM service for executing recursive language model inference.

This service wraps the RLM library and provides:
- Session-based RLM instance management
- Progress event emission via custom logger/printer
- Background execution for non-blocking API responses
"""

import sys
import threading
import traceback
from datetime import datetime
from pathlib import Path
from typing import Callable

# Add repo root to path for RLM imports
# Path: services -> backend -> repo_root (where rlm/ lives)
rlm_path = Path(__file__).parent.parent.parent
if str(rlm_path) not in sys.path:
    sys.path.insert(0, str(rlm_path))

from rlm import RLM
from rlm.core.types import RLMChatCompletion

from backend.config import settings, get_model_provider
from backend.services.document_service import document_service
from backend.services.session_service import session_service, ChatSession, RunState
from backend.services.progress_emitter import WebProgressLogger, WebProgressPrinter


class RLMService:
    """
    Service for managing RLM inference execution.

    Handles:
    - Creating RLM instances with appropriate configuration
    - Running inference with progress emission
    - Managing persistent sessions
    """

    def __init__(self):
        self._active_threads: dict[str, threading.Thread] = {}

    def run_inference(
        self,
        session: ChatSession,
        run: RunState,
        message: str,
    ) -> None:
        """
        Run RLM inference in a background thread.

        This method:
        1. Creates a progress-emitting logger
        2. Sets up or reuses the RLM instance
        3. Executes the completion
        4. Emits final answer and usage summary

        Args:
            session: The chat session
            run: The run state for tracking progress
            message: The user's message/question
        """

        def emit_event(event: dict):
            """Callback to add events to the run state."""
            run.add_event(event)

        def run_thread():
            try:
                self._execute_inference(session, run, message, emit_event)
            except Exception as e:
                # Emit error event
                error_event = {
                    "type": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "session_id": session.session_id,
                    "run_id": run.run_id,
                    "message": str(e),
                    "code": "INFERENCE_ERROR",
                    "traceback": traceback.format_exc(),
                }
                run.add_event(error_event)
                session_service.complete_run(run.run_id, error=str(e))
            finally:
                # Cleanup thread reference
                if run.run_id in self._active_threads:
                    del self._active_threads[run.run_id]

        # Start background thread
        thread = threading.Thread(target=run_thread, daemon=True)
        self._active_threads[run.run_id] = thread
        thread.start()

    def _execute_inference(
        self,
        session: ChatSession,
        run: RunState,
        message: str,
        emit_callback: Callable[[dict], None],
    ) -> None:
        """
        Execute the RLM inference (runs in background thread).
        """
        # Determine provider and validate API key
        provider = get_model_provider(session.model_id)
        if not settings.validate_api_key(provider):
            if provider == "openai":
                raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY in .env")
            raise ValueError("Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env")

        # Create progress logger
        logger = WebProgressLogger(
            session_id=session.session_id,
            run_id=run.run_id,
            emit_callback=emit_callback,
            log_dir=None,  # Skip file logging for MVP
        )

        # Get combined document context
        document_context = document_service.get_combined_context(session.document_ids)
        total_chars = document_service.get_total_chars(session.document_ids)

        # Emit initial event with document info
        init_event = {
            "type": "session_start",
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session.session_id,
            "run_id": run.run_id,
            "model": session.model_id,
            "document_count": len(session.document_ids),
            "total_chars": total_chars,
        }
        emit_callback(init_event)

        # Create custom verbose printer for real-time progress events
        verbose_printer = WebProgressPrinter(
            session_id=session.session_id,
            run_id=run.run_id,
            emit_callback=emit_callback,
            enabled=True,
        )

        # Create or reuse persistent RLM instance
        # Using persistent=True enables native multi-turn conversation support
        # The RLM reuses the environment and stores context/history across calls
        if session.rlm_instance is None:
            # Configure backend based on provider
            if provider == "openai":
                backend = "openai"
                backend_kwargs = {
                    "api_key": settings.openai_api_key,
                    "model_name": session.model_id,
                    "max_tokens": 4096,
                }
            else:
                backend = "anthropic"
                # Get Anthropic config (supports both direct and LiteLLM proxy modes)
                anthropic_config = settings.get_anthropic_config()
                backend_kwargs = {
                    **anthropic_config,  # api_key (+ base_url if proxy mode)
                    "model_name": session.model_id,
                    "max_tokens": 4096,
                }

            # Configure sub-call model if specified in settings
            other_backends = None
            other_backend_kwargs = None
            if settings.rlm_subcall_model and settings.rlm_subcall_backend:
                subcall_backend = settings.rlm_subcall_backend
                if subcall_backend == "openai":
                    subcall_config = {"api_key": settings.openai_api_key}
                else:
                    # Use same Anthropic config (direct or proxy) for subcalls
                    subcall_config = settings.get_anthropic_config()

                if subcall_config.get("api_key"):
                    other_backends = [subcall_backend]
                    other_backend_kwargs = [{
                        **subcall_config,
                        "model_name": settings.rlm_subcall_model,
                        "max_tokens": 2048,
                    }]

            rlm = RLM(
                backend=backend,
                backend_kwargs=backend_kwargs,
                environment=settings.rlm_environment,
                environment_kwargs={},
                max_depth=settings.rlm_max_depth,
                max_iterations=settings.rlm_max_iterations,
                other_backends=other_backends,
                other_backend_kwargs=other_backend_kwargs,
                logger=logger,
                verbose=True,
                persistent=True,  # Enable multi-turn conversation support
            )
            session.rlm_instance = rlm
        else:
            rlm = session.rlm_instance
            # Update logger for this run
            rlm.logger = logger

        # Replace default verbose printer with our custom one for SSE events
        rlm.verbose = verbose_printer

        # Build conversation history for multi-turn context
        # This gives the model clear visibility of prior Q&A pairs
        conversation_history = ""
        if session.messages:
            for msg in session.messages:
                role = "User" if msg["role"] == "user" else "Assistant"
                # Truncate very long answers to avoid token explosion
                content = msg["content"]
                if len(content) > 2000:
                    content = content[:2000] + "... [truncated]"
                conversation_history += f"\n{role}: {content}\n"

        # Build enhanced root_prompt with conversation history
        if conversation_history:
            enhanced_root_prompt = (
                f"CONVERSATION HISTORY (previous Q&A in this session):"
                f"{conversation_history}\n"
                f"---\n"
                f"CURRENT QUESTION: {message}"
            )
        else:
            enhanced_root_prompt = message

        # Determine context prompt based on whether this is first turn
        # On first turn: load documents into REPL as context_0
        # On subsequent turns: documents already loaded, pass minimal prompt to avoid duplicates
        is_first_turn = len(session.messages) == 0
        if is_first_turn:
            context_prompt = document_context if document_context else ""
        else:
            # Documents already loaded in context_0, don't re-add them
            context_prompt = "[Continuation of conversation - documents already in context_0]"

        result: RLMChatCompletion = rlm.completion(
            prompt=context_prompt,
            root_prompt=enhanced_root_prompt,
        )

        # Store the result
        session_service.complete_run(run.run_id, result=result.response)

        # Add messages to session history (for UI display purposes)
        session.add_message("user", message)
        session.add_message("assistant", result.response, run_id=run.run_id)

        # Persist the session with updated messages
        session_service.save_session(session.session_id)

        # Emit usage summary
        usage_event = {
            "type": "usage_summary",
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session.session_id,
            "run_id": run.run_id,
            "input_tokens": sum(
                m.total_input_tokens
                for m in result.usage_summary.model_usage_summaries.values()
            ),
            "output_tokens": sum(
                m.total_output_tokens
                for m in result.usage_summary.model_usage_summaries.values()
            ),
            "models_used": list(result.usage_summary.model_usage_summaries.keys()),
            "execution_time_ms": int(result.execution_time * 1000),
        }
        emit_callback(usage_event)

        # Store progress events in session for historical viewing
        all_events = run.get_events()
        all_events.append(usage_event)  # Include usage summary
        session.add_progress_events(run.run_id, all_events)
        session_service.save_session(session.session_id)

    def cancel_run(self, run_id: str) -> bool:
        """
        Attempt to cancel a running inference.
        Note: This is best-effort as RLM doesn't support true cancellation.
        """
        # For MVP, we just mark the run as cancelled
        # True cancellation would require modifying RLM core
        run = session_service.get_run(run_id)
        if run and not run.completed:
            session_service.complete_run(run_id, error="Cancelled by user")
            return True
        return False


# Global service instance
rlm_service = RLMService()
