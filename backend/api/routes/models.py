"""
Models API routes.
Lists available models for the chat interface.
"""

from fastapi import APIRouter

from backend.api.schemas import ModelInfo, ModelsListResponse
from backend.config import AVAILABLE_MODELS

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=ModelsListResponse)
async def list_models():
    """List all available models."""
    return ModelsListResponse(
        models=[
            ModelInfo(
                id=m["id"],
                name=m["name"],
                provider=m["provider"],
                description=m["description"],
            )
            for m in AVAILABLE_MODELS
        ]
    )


@router.get("/{model_id}", response_model=ModelInfo)
async def get_model(model_id: str):
    """Get details about a specific model."""
    for m in AVAILABLE_MODELS:
        if m["id"] == model_id:
            return ModelInfo(
                id=m["id"],
                name=m["name"],
                provider=m["provider"],
                description=m["description"],
            )

    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Model not found")
