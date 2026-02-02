"""
Session management API routes.
Handles creating, listing, and managing chat sessions.
"""

from fastapi import APIRouter, HTTPException

from backend.api.schemas import (
    CreateSessionRequest,
    SessionInfo,
    SessionDetailResponse,
    ChatMessage,
    UpdateSessionModelRequest,
    UpdateSessionTitleRequest,
)
from backend.services.session_service import session_service
from backend.services.document_service import document_service
from backend.config import AVAILABLE_MODELS

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionInfo)
async def create_session(request: CreateSessionRequest):
    """
    Create a new chat session.

    Requires specifying a model and at least one document.
    """
    # Validate model
    valid_model_ids = [m["id"] for m in AVAILABLE_MODELS]
    if request.model_id not in valid_model_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model_id. Available: {valid_model_ids}"
        )

    # Validate documents exist (if any provided)
    for doc_id in request.document_ids:
        if not document_service.get_document(doc_id):
            raise HTTPException(
                status_code=400,
                detail=f"Document not found: {doc_id}"
            )

    # Create session
    session = session_service.create_session(
        model_id=request.model_id,
        document_ids=request.document_ids,
    )

    return SessionInfo(
        session_id=session.session_id,
        model_id=session.model_id,
        document_ids=session.document_ids,
        title=session.title,
        status=session.status,
        created_at=session.created_at,
        ended_at=session.ended_at,
        message_count=len(session.messages),
    )


@router.get("", response_model=list[SessionInfo])
async def list_sessions(status: str | None = None):
    """List all sessions, optionally filtered by status ('active' or 'ended')."""
    sessions = session_service.list_sessions(status=status)
    return [
        SessionInfo(
            session_id=s.session_id,
            model_id=s.model_id,
            document_ids=s.document_ids,
            title=s.title,
            status=s.status,
            created_at=s.created_at,
            ended_at=s.ended_at,
            message_count=len(s.messages),
        )
        for s in sessions
    ]


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str):
    """Get detailed session information including messages."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionDetailResponse(
        session=SessionInfo(
            session_id=session.session_id,
            model_id=session.model_id,
            document_ids=session.document_ids,
            title=session.title,
            status=session.status,
            created_at=session.created_at,
            ended_at=session.ended_at,
            message_count=len(session.messages),
        ),
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


@router.post("/{session_id}/end")
async def end_session(session_id: str):
    """End a session (preserves chat history)."""
    success = session_service.end_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "message": f"Session {session_id} ended"}


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Permanently delete a session and its history."""
    success = session_service.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "message": f"Session {session_id} deleted"}


@router.patch("/{session_id}/title")
async def update_session_title(session_id: str, request: UpdateSessionTitleRequest):
    """Update the title for a session."""
    success = session_service.update_session_title(session_id, request.title)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "title": request.title}


@router.patch("/{session_id}/model")
async def update_session_model(session_id: str, request: UpdateSessionModelRequest):
    """Change the model for a session."""
    # Validate model
    valid_model_ids = [m["id"] for m in AVAILABLE_MODELS]
    if request.model_id not in valid_model_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model_id. Available: {valid_model_ids}"
        )

    success = session_service.update_session_model(session_id, request.model_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "model_id": request.model_id}
