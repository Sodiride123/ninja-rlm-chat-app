"""
Chat API routes.
Handles message submission and SSE streaming for progress.
"""

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.api.schemas import (
    SubmitMessageRequest,
    SubmitMessageResponse,
    ChatHistoryResponse,
    ChatMessage,
)
from backend.services.session_service import session_service
from backend.services.rlm_service import rlm_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{session_id}", response_model=SubmitMessageResponse)
async def submit_message(session_id: str, request: SubmitMessageRequest):
    """
    Submit a user message for processing.

    Returns a run_id that can be used to stream progress via SSE.
    The actual RLM inference runs in the background.
    """
    # Validate session
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Create a run for this message
    run = session_service.create_run(session_id, request.message)

    # Start RLM inference in background
    rlm_service.run_inference(session, run, request.message)

    return SubmitMessageResponse(
        run_id=run.run_id,
        message="Message submitted. Connect to SSE stream to receive progress.",
    )


@router.get("/{session_id}/stream/{run_id}")
async def stream_progress(session_id: str, run_id: str):
    """
    SSE endpoint for streaming progress events.

    Connect to this endpoint after submitting a message to receive
    real-time progress updates from RLM execution.

    Event types:
    - session_start: Initial session info
    - iteration_start: Beginning of an RLM iteration
    - llm_response: Root LLM response
    - code_start: Code execution beginning
    - code_result: Code execution result
    - subcall_complete: Sub-LLM call completed
    - final_answer: The final answer
    - usage_summary: Token usage stats
    - error: Error occurred
    """
    # Validate session and run
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    run = session_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.session_id != session_id:
        raise HTTPException(status_code=400, detail="Run does not belong to this session")

    async def event_generator():
        """Generate SSE events from the run's event queue."""
        last_index = 0
        retry_count = 0
        max_retries = 6000  # 10 minutes at 0.1 second intervals
        heartbeat_interval = 30  # Send heartbeat every 3 seconds (30 * 100ms)
        polls_since_heartbeat = 0

        while retry_count < max_retries:
            # Get new events
            events = run.get_events(last_index)
            had_events = len(events) > 0

            for event in events:
                # Format as SSE
                event_data = json.dumps(event)
                yield f"data: {event_data}\n\n"
                last_index += 1

                # Check if this is a terminal event
                if event.get("type") in ("final_answer", "error"):
                    # Send one more event to signal completion
                    done_event = {
                        "type": "done",
                        "timestamp": datetime.utcnow().isoformat(),
                        "session_id": session_id,
                        "run_id": run_id,
                    }
                    yield f"data: {json.dumps(done_event)}\n\n"
                    return

            # Check if run completed (but events might not have propagated yet)
            if run.completed and run.get_event_count() == last_index:
                # All events consumed and run is done
                done_event = {
                    "type": "done",
                    "timestamp": datetime.utcnow().isoformat(),
                    "session_id": session_id,
                    "run_id": run_id,
                }
                yield f"data: {json.dumps(done_event)}\n\n"
                return

            # Send heartbeat to keep UI feeling alive during long operations
            if had_events:
                polls_since_heartbeat = 0
            else:
                polls_since_heartbeat += 1
                if polls_since_heartbeat >= heartbeat_interval:
                    heartbeat_event = {
                        "type": "heartbeat",
                        "timestamp": datetime.utcnow().isoformat(),
                        "session_id": session_id,
                        "run_id": run_id,
                    }
                    yield f"data: {json.dumps(heartbeat_event)}\n\n"
                    polls_since_heartbeat = 0

            # Wait before checking for more events
            await asyncio.sleep(0.1)  # 100ms polling interval
            retry_count += 1

        # Timeout - send error
        timeout_event = {
            "type": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "run_id": run_id,
            "message": "Stream timeout - inference took too long",
            "code": "TIMEOUT",
        }
        yield f"data: {json.dumps(timeout_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/{session_id}/history", response_model=ChatHistoryResponse)
async def get_chat_history(session_id: str):
    """Get the chat history for a session."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            ChatMessage(
                role=m["role"],
                content=m["content"],
                timestamp=m["timestamp"],
                run_id=m.get("run_id"),
            )
            for m in session.messages
        ],
    )


@router.get("/{session_id}/progress/{run_id}")
async def get_run_progress(session_id: str, run_id: str):
    """Get stored progress events for a completed run."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    events = session.get_progress_events(run_id)
    if not events:
        # Check if there's an active run
        run = session_service.get_run(run_id)
        if run:
            events = run.get_events()

    return {"session_id": session_id, "run_id": run_id, "events": events}


@router.post("/{session_id}/cancel/{run_id}")
async def cancel_run(session_id: str, run_id: str):
    """
    Attempt to cancel a running inference.
    Note: Best-effort cancellation.
    """
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    run = session_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    success = rlm_service.cancel_run(run_id)
    return {"success": success, "message": "Cancellation requested" if success else "Run already completed"}
