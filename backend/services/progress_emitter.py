"""
Custom RLM logger and verbose printer that emit progress events for SSE streaming.

This module provides:
- WebProgressLogger: Custom RLMLogger subclass that emits events to a RunState
- WebProgressPrinter: Custom VerbosePrinter replacement for structured event emission

These hook into RLM's existing logging/printing interfaces to capture real execution progress.
"""

import time
from datetime import datetime
from typing import Any, Callable

# Import RLM types
import sys
from pathlib import Path

# Add repo root to path for RLM imports
# Path: services -> backend -> repo_root (where rlm/ lives)
rlm_path = Path(__file__).parent.parent.parent
if str(rlm_path) not in sys.path:
    sys.path.insert(0, str(rlm_path))

from rlm.core.types import CodeBlock, RLMIteration, RLMMetadata
from rlm.logger.rlm_logger import RLMLogger


class WebProgressLogger(RLMLogger):
    """
    Custom RLM logger that emits progress events for web streaming.

    Extends RLMLogger to capture iteration events and emit them to a callback
    function, which typically pushes events to a RunState for SSE consumption.
    """

    def __init__(
        self,
        session_id: str,
        run_id: str,
        emit_callback: Callable[[dict], None],
        log_dir: str | None = None,
    ):
        """
        Initialize the web progress logger.

        Args:
            session_id: The chat session ID
            run_id: The current run ID
            emit_callback: Function to call with each progress event dict
            log_dir: Optional directory for file logging (can be None to skip file logging)
        """
        self.session_id = session_id
        self.run_id = run_id
        self.emit = emit_callback
        self._iteration_count = 0
        self._metadata_logged = False
        self._start_time = time.perf_counter()

        # Initialize parent only if log_dir is provided
        if log_dir:
            super().__init__(log_dir=log_dir)
        else:
            # Skip file logging
            self.log_dir = None
            self.log_file_path = None

    def _make_event(self, event_type: str, **kwargs) -> dict:
        """Create a base event dict with common fields."""
        return {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": self.session_id,
            "run_id": self.run_id,
            **kwargs,
        }

    def log_metadata(self, metadata: RLMMetadata):
        """Log RLM metadata and emit session_start event."""
        if self._metadata_logged:
            return

        # Emit session start event
        event = self._make_event(
            "session_start",
            model=metadata.root_model,
            max_iterations=metadata.max_iterations,
            max_depth=metadata.max_depth,
            backend=metadata.backend,
            environment=metadata.environment_type,
        )
        self.emit(event)

        self._metadata_logged = True

        # Call parent if file logging is enabled
        if self.log_file_path:
            super().log_metadata(metadata)

    def log(self, iteration: RLMIteration):
        """Log an RLM iteration.

        Note: LLM response, code execution, and subcall events are now emitted
        incrementally by the WebProgressPrinter as each step completes.
        This method only handles final_answer and file logging.
        """
        self._iteration_count += 1

        # Emit final answer if present (only available after iteration completes)
        if iteration.final_answer is not None:
            total_time = time.perf_counter() - self._start_time
            final_event = self._make_event(
                "final_answer",
                answer=iteration.final_answer,
                total_iterations=self._iteration_count,
                total_time_ms=int(total_time * 1000),
            )
            self.emit(final_event)

        # Call parent if file logging is enabled
        if self.log_file_path:
            super().log(iteration)

    @property
    def iteration_count(self) -> int:
        return self._iteration_count


class WebProgressPrinter:
    """
    Custom verbose printer that emits structured progress events.

    This replaces RLM's VerbosePrinter to emit JSON events instead of
    rich console output. Events are sent via the emit_callback.
    """

    def __init__(
        self,
        session_id: str,
        run_id: str,
        emit_callback: Callable[[dict], None],
        enabled: bool = True,
    ):
        self.session_id = session_id
        self.run_id = run_id
        self.emit = emit_callback
        self.enabled = enabled
        self._iteration_count = 0
        self._max_iterations = 30  # Default, updated from metadata

    def _make_event(self, event_type: str, **kwargs) -> dict:
        """Create a base event dict."""
        return {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": self.session_id,
            "run_id": self.run_id,
            **kwargs,
        }

    def print_metadata(self, metadata: RLMMetadata) -> None:
        """Store metadata and emit thinking indicator."""
        if not self.enabled:
            return
        # Store max_iterations for use in iteration_start events
        self._max_iterations = metadata.max_iterations
        # Emit a "thinking" event to show activity before first iteration
        event = self._make_event(
            "thinking",
            message="RLM is analyzing your document...",
            max_iterations=self._max_iterations,
        )
        self.emit(event)

    def print_iteration_start(self, iteration: int) -> None:
        """Emit iteration start event."""
        if not self.enabled:
            return
        self._iteration_count = iteration
        event = self._make_event(
            "iteration_start",
            iteration=iteration,
            max_iterations=self._max_iterations,
        )
        self.emit(event)

    def print_completion(self, response: Any, iteration_time: float | None = None) -> None:
        """Emit LLM response event immediately when received."""
        if not self.enabled:
            return
        event = self._make_event(
            "llm_response",
            iteration=self._iteration_count,
            response=str(response) if response else "",
            time_ms=int((iteration_time or 0) * 1000),
        )
        self.emit(event)

    def print_code_execution(self, code_block: CodeBlock) -> None:
        """Emit code execution events immediately when each block completes."""
        if not self.enabled:
            return

        result = code_block.result

        # Emit code start event
        code_start_event = self._make_event(
            "code_start",
            iteration=self._iteration_count,
            code=str(code_block.code) if code_block.code else "",
        )
        self.emit(code_start_event)

        # Emit code result event
        code_result_event = self._make_event(
            "code_result",
            iteration=self._iteration_count,
            stdout=str(result.stdout) if result.stdout else "",
            stderr=str(result.stderr) if result.stderr else "",
            time_ms=int((result.execution_time or 0) * 1000),
            subcall_count=len(result.rlm_calls) if hasattr(result, 'rlm_calls') else 0,
        )
        self.emit(code_result_event)

    def print_subcall(
        self,
        model: str,
        prompt_preview: str,
        response_preview: str,
        execution_time: float | None = None,
    ) -> None:
        """Emit subcall event immediately when a sub-LLM call completes."""
        if not self.enabled:
            return
        event = self._make_event(
            "subcall_complete",
            iteration=self._iteration_count,
            model=model,
            response_preview=response_preview[:500] if response_preview else "",
            time_ms=int((execution_time or 0) * 1000),
        )
        self.emit(event)

    def print_iteration(self, iteration: RLMIteration, iteration_num: int) -> None:
        """Emit iteration events (mostly handled by logger)."""
        if not self.enabled:
            return
        # Emit iteration start (logger handles the rest)
        self.print_iteration_start(iteration_num)

    def print_final_answer(self, answer: Any) -> None:
        """Emit final answer event (handled by logger)."""
        # Handled by WebProgressLogger.log() to avoid duplicates
        pass

    def print_summary(
        self,
        total_iterations: int,
        total_time: float,
        usage_summary: dict[str, Any] | None = None,
    ) -> None:
        """Emit usage summary event."""
        if not self.enabled:
            return

        input_tokens = 0
        output_tokens = 0
        models_used = []

        if usage_summary and "model_usage_summaries" in usage_summary:
            for model, usage in usage_summary["model_usage_summaries"].items():
                models_used.append(model)
                input_tokens += usage.get("total_input_tokens", 0)
                output_tokens += usage.get("total_output_tokens", 0)

        event = self._make_event(
            "usage_summary",
            total_iterations=total_iterations,
            total_time_ms=int(total_time * 1000),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            models_used=models_used,
        )
        self.emit(event)
