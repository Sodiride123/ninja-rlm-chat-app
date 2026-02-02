"""
Web Chat Backend - FastAPI Application

Main entry point for the web-based AI chat application.
Provides REST API + SSE for RLM-powered document QA.
"""

import sys
from pathlib import Path

# Add parent repo to path for RLM imports
rlm_path = Path(__file__).parent.parent.parent
if str(rlm_path) not in sys.path:
    sys.path.insert(0, str(rlm_path))

# Add backend to path for relative imports
backend_path = Path(__file__).parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.api.routes import documents, sessions, chat, models
from backend.api.schemas import HealthResponse

# Create FastAPI app
app = FastAPI(
    title="RLM Web Chat",
    description="Web-based AI chat for ultra-long-context document understanding using RLM",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(models.router, prefix="/api")


@app.get("/", tags=["root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "RLM Web Chat API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        api_key_configured=settings.validate_api_key(),
        version="0.1.0",
    )


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    # Ensure upload directory exists
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    print(f"🚀 RLM Web Chat API starting...")
    print(f"   API docs: http://{settings.host}:{settings.port}/docs")
    print(f"   Health:   http://{settings.host}:{settings.port}/health")
    print(f"   API key:  {'✓ configured' if settings.validate_api_key() else '✗ NOT configured'}")
    print(f"   RLM env:  {settings.rlm_environment}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info",
    )
