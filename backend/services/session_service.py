"""
Session service for managing chat sessions.
Tracks sessions, messages, and active runs.
Supports persistence for session history.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Literal

from backend.config import settings


# Directory for persisted sessions
SESSIONS_DIR = Path(__file__).parent.parent.parent / "data" / "sessions"


class ChatSession:
    """Represents a single chat session with its state."""

    def __init__(
        self,
        session_id: str,
        model_id: str,
        document_ids: list[str],
        title: str | None = None,
        status: Literal["active", "ended"] = "active",
        created_at: datetime | None = None,
        ended_at: datetime | None = None,
        messages: list[dict] | None = None,
        progress_events: dict[str, list[dict]] | None = None,
    ):
        self.session_id = session_id
        self.model_id = model_id
        self.document_ids = document_ids
        self.title = title
        self.status = status
        self.created_at = created_at or datetime.utcnow()
        self.ended_at = ended_at
        self.messages: list[dict] = messages or []
        # Progress events per run_id for historical viewing
        self.progress_events: dict[str, list[dict]] = progress_events or {}

        # RLM instance for persistent mode (created on first use, not persisted)
        self.rlm_instance = None

    def add_message(self, role: str, content: str, run_id: str | None = None) -> dict:
        """Add a message to the session history."""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow(),
        }
        if run_id:
            message["run_id"] = run_id
        self.messages.append(message)

        # Auto-generate title from first user message
        if self.title is None and role == "user":
            self.title = self._generate_title(content)

        return message

    def _generate_title(self, content: str) -> str:
        """Generate a short title from message content."""
        # Take first 50 chars, cut at word boundary
        title = content.strip()
        if len(title) > 50:
            title = title[:50].rsplit(" ", 1)[0]
            if len(title) < 20:  # If cutting at word made it too short
                title = content[:50]
            title += "..."
        return title

    def add_progress_events(self, run_id: str, events: list[dict]):
        """Store progress events for a run."""
        self.progress_events[run_id] = events

    def get_progress_events(self, run_id: str) -> list[dict]:
        """Get progress events for a run."""
        return self.progress_events.get(run_id, [])

    def to_persist_dict(self) -> dict:
        """Convert session to dict for JSON persistence."""
        return {
            "session_id": self.session_id,
            "model_id": self.model_id,
            "document_ids": self.document_ids,
            "title": self.title,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "messages": [
                {
                    **msg,
                    "timestamp": msg["timestamp"].isoformat()
                    if isinstance(msg["timestamp"], datetime)
                    else msg["timestamp"],
                }
                for msg in self.messages
            ],
            "progress_events": self.progress_events,
        }

    @classmethod
    def from_persist_dict(cls, data: dict) -> "ChatSession":
        """Create session from persisted JSON data."""
        messages = [
            {
                **msg,
                "timestamp": datetime.fromisoformat(msg["timestamp"])
                if isinstance(msg["timestamp"], str)
                else msg["timestamp"],
            }
            for msg in data.get("messages", [])
        ]
        return cls(
            session_id=data["session_id"],
            model_id=data["model_id"],
            document_ids=data["document_ids"],
            title=data.get("title"),
            status=data.get("status", "ended"),
            created_at=datetime.fromisoformat(data["created_at"])
            if isinstance(data["created_at"], str)
            else data["created_at"],
            ended_at=datetime.fromisoformat(data["ended_at"])
            if data.get("ended_at")
            else None,
            messages=messages,
            progress_events=data.get("progress_events", {}),
        )


class RunState:
    """Tracks the state of an active RLM run."""

    def __init__(self, run_id: str, session_id: str, message: str):
        self.run_id = run_id
        self.session_id = session_id
        self.message = message
        self.started_at = datetime.utcnow()
        self.completed = False
        self.error: str | None = None
        self.result: str | None = None

        # Progress events queue (for SSE)
        self._events: list[dict] = []
        self._lock = Lock()

    def add_event(self, event: dict):
        """Add a progress event (thread-safe)."""
        with self._lock:
            self._events.append(event)

    def get_events(self, start_index: int = 0) -> list[dict]:
        """Get events starting from index (thread-safe)."""
        with self._lock:
            return self._events[start_index:].copy()

    def get_event_count(self) -> int:
        """Get total event count (thread-safe)."""
        with self._lock:
            return len(self._events)


class SessionService:
    """Service for managing chat sessions and runs."""

    def __init__(self):
        self._sessions: dict[str, ChatSession] = {}
        self._runs: dict[str, RunState] = {}
        self._lock = Lock()

        # Load persisted sessions on startup
        self._load_persisted_sessions()

    def _load_persisted_sessions(self):
        """Load all persisted sessions from disk."""
        if not SESSIONS_DIR.exists():
            SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
            return

        for file_path in SESSIONS_DIR.glob("*.json"):
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                session = ChatSession.from_persist_dict(data)
                self._sessions[session.session_id] = session
            except Exception as e:
                print(f"Warning: Failed to load session {file_path}: {e}")

    def _persist_session(self, session: ChatSession):
        """Save a session to disk."""
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        file_path = SESSIONS_DIR / f"{session.session_id}.json"
        with open(file_path, "w") as f:
            json.dump(session.to_persist_dict(), f, indent=2)

    def _delete_persisted_session(self, session_id: str):
        """Delete a session file from disk."""
        file_path = SESSIONS_DIR / f"{session_id}.json"
        if file_path.exists():
            file_path.unlink()

    def create_session(self, model_id: str, document_ids: list[str]) -> ChatSession:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())
        session = ChatSession(session_id, model_id, document_ids)

        with self._lock:
            self._sessions[session_id] = session

        # Persist new session
        self._persist_session(session)

        return session

    def get_session(self, session_id: str) -> ChatSession | None:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    def list_sessions(self, status: str | None = None) -> list[ChatSession]:
        """List sessions, optionally filtered by status."""
        sessions = list(self._sessions.values())
        if status:
            sessions = [s for s in sessions if s.status == status]
        # Sort by created_at descending (newest first)
        sessions.sort(key=lambda s: s.created_at, reverse=True)
        return sessions

    def end_session(self, session_id: str) -> bool:
        """End a session (preserves history if it has messages, otherwise deletes it)."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        # Cleanup RLM instance if exists
        if session.rlm_instance:
            try:
                session.rlm_instance.close()
            except Exception:
                pass
            session.rlm_instance = None

        # If session has no messages, delete it instead of keeping it in history
        if len(session.messages) == 0:
            with self._lock:
                del self._sessions[session_id]
            self._delete_persisted_session(session_id)
            return True

        # Mark as ended
        session.status = "ended"
        session.ended_at = datetime.utcnow()

        # Persist the ended session
        self._persist_session(session)

        return True

    def delete_session(self, session_id: str) -> bool:
        """Permanently delete a session and its history."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        # Cleanup RLM instance if exists
        if session.rlm_instance:
            try:
                session.rlm_instance.close()
            except Exception:
                pass

        with self._lock:
            del self._sessions[session_id]

        # Delete persisted file
        self._delete_persisted_session(session_id)

        return True

    def update_session_title(self, session_id: str, title: str) -> bool:
        """Update the title for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        session.title = title
        self._persist_session(session)
        return True

    def update_session_model(self, session_id: str, model_id: str) -> bool:
        """Update the model for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        session.model_id = model_id

        # Reset RLM instance to pick up new model
        if session.rlm_instance:
            try:
                session.rlm_instance.close()
            except Exception:
                pass
            session.rlm_instance = None

        self._persist_session(session)
        return True

    def save_session(self, session_id: str):
        """Explicitly save a session (e.g., after adding messages)."""
        session = self._sessions.get(session_id)
        if session:
            self._persist_session(session)

    def create_run(self, session_id: str, message: str) -> RunState:
        """Create a new run for processing a message."""
        run_id = str(uuid.uuid4())
        run = RunState(run_id, session_id, message)

        with self._lock:
            self._runs[run_id] = run

        return run

    def get_run(self, run_id: str) -> RunState | None:
        """Get a run by ID."""
        return self._runs.get(run_id)

    def complete_run(self, run_id: str, result: str | None = None, error: str | None = None):
        """Mark a run as completed."""
        run = self._runs.get(run_id)
        if run:
            run.completed = True
            run.result = result
            run.error = error


# Global service instance
session_service = SessionService()
