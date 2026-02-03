"""
Pydantic schemas for API request/response models.
"""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


# ============================================================================
# Document Schemas
# ============================================================================

class DocumentInfo(BaseModel):
    """Information about an uploaded document."""
    id: str
    filename: str
    size_bytes: int
    content_type: str
    char_count: int
    uploaded_at: datetime


class DocumentListResponse(BaseModel):
    """Response for listing documents."""
    documents: list[DocumentInfo]
    total_count: int


class DocumentUploadResponse(BaseModel):
    """Response after uploading documents."""
    documents: list[DocumentInfo]
    total_chars: int


# ============================================================================
# Session Schemas
# ============================================================================

class CreateSessionRequest(BaseModel):
    """Request to create a new chat session."""
    model_id: str = Field(description="Model ID to use for this session")
    document_ids: list[str] = Field(description="Document IDs to include in context")


class SessionInfo(BaseModel):
    """Information about a chat session."""
    session_id: str
    model_id: str
    document_ids: list[str]
    title: str | None = None
    status: Literal["active", "ended"] = "active"
    created_at: datetime
    ended_at: datetime | None = None
    message_count: int


class SessionDetailResponse(BaseModel):
    """Detailed session information including messages."""
    session: SessionInfo
    messages: list["ChatMessage"]


class UpdateSessionModelRequest(BaseModel):
    """Request to change session model."""
    model_id: str


class UpdateSessionTitleRequest(BaseModel):
    """Request to update session title."""
    title: str


# ============================================================================
# Chat Schemas
# ============================================================================

class ChatMessage(BaseModel):
    """A single chat message."""
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime
    run_id: str | None = None


class SubmitMessageRequest(BaseModel):
    """Request to submit a user message."""
    message: str


class SubmitMessageResponse(BaseModel):
    """Response after submitting a message."""
    run_id: str
    message: str = "Message submitted. Connect to SSE stream to receive progress."


class ChatHistoryResponse(BaseModel):
    """Response containing chat history."""
    session_id: str
    messages: list[ChatMessage]


# ============================================================================
# Progress Event Schemas (for SSE)
# ============================================================================

class ProgressEventBase(BaseModel):
    """Base class for all progress events."""
    type: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: str
    run_id: str


class SessionStartEvent(ProgressEventBase):
    """Emitted when RLM processing starts."""
    type: Literal["session_start"] = "session_start"
    model: str
    document_count: int
    total_chars: int


class IterationStartEvent(ProgressEventBase):
    """Emitted at the start of each RLM iteration."""
    type: Literal["iteration_start"] = "iteration_start"
    iteration: int
    max_iterations: int


class LLMResponseEvent(ProgressEventBase):
    """Emitted when the root LLM responds."""
    type: Literal["llm_response"] = "llm_response"
    iteration: int
    response: str
    time_ms: int


class CodeExecutionStartEvent(ProgressEventBase):
    """Emitted when code execution begins."""
    type: Literal["code_start"] = "code_start"
    iteration: int
    code: str


class CodeExecutionResultEvent(ProgressEventBase):
    """Emitted when code execution completes."""
    type: Literal["code_result"] = "code_result"
    iteration: int
    stdout: str
    stderr: str
    time_ms: int
    subcall_count: int


class SubcallCompleteEvent(ProgressEventBase):
    """Emitted when a sub-LLM call completes."""
    type: Literal["subcall_complete"] = "subcall_complete"
    iteration: int
    model: str
    response_preview: str
    time_ms: int


class FinalAnswerEvent(ProgressEventBase):
    """Emitted when RLM produces a final answer."""
    type: Literal["final_answer"] = "final_answer"
    answer: str
    total_iterations: int
    total_time_ms: int


class UsageSummaryEvent(ProgressEventBase):
    """Emitted with token usage information."""
    type: Literal["usage_summary"] = "usage_summary"
    input_tokens: int
    output_tokens: int
    models_used: list[str]


class ErrorEvent(ProgressEventBase):
    """Emitted when an error occurs."""
    type: Literal["error"] = "error"
    message: str
    code: str


# ============================================================================
# Model Schemas
# ============================================================================

class ModelInfo(BaseModel):
    """Information about an available model."""
    id: str
    name: str
    provider: str
    description: str


class ModelsListResponse(BaseModel):
    """Response listing available models."""
    models: list[ModelInfo]


# ============================================================================
# Health Check
# ============================================================================

class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    api_key_configured: bool
    version: str = "0.1.0"
