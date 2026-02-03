"""
Configuration management for the web-chat backend.
Loads settings from environment variables.
"""

import os
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from the web-chat directory
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys - Direct mode
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

    # LiteLLM Proxy mode (alternative to direct Anthropic)
    # When set, routes Anthropic calls through LiteLLM proxy
    anthropic_base_url: str | None = os.getenv("ANTHROPIC_BASE_URL", None)
    anthropic_auth_token: str | None = os.getenv("ANTHROPIC_AUTH_TOKEN", None)

    # Server
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))

    # Model defaults
    default_model: str = os.getenv("DEFAULT_MODEL", "claude-opus-4-5-20251101")

    # RLM settings - reduced iterations for faster responses
    rlm_max_iterations: int = int(os.getenv("RLM_MAX_ITERATIONS", "15"))
    rlm_max_depth: int = int(os.getenv("RLM_MAX_DEPTH", "1"))
    rlm_environment: Literal["local", "docker"] = os.getenv("RLM_ENVIRONMENT", "local")

    # Sub-call model settings (optional - if not set, uses same model as main)
    # Set RLM_SUBCALL_MODEL to use a different (faster) model for llm_query sub-calls
    rlm_subcall_model: str | None = os.getenv("RLM_SUBCALL_MODEL", None)
    rlm_subcall_backend: str | None = os.getenv("RLM_SUBCALL_BACKEND", None)  # "openai" or "anthropic"

    # Storage
    upload_dir: Path = Path(__file__).parent.parent / "uploads"

    def validate_api_key(self, provider: str = "anthropic") -> bool:
        """Check if API key is configured for the given provider."""
        if provider == "openai":
            return bool(self.openai_api_key and self.openai_api_key != "your-api-key-here")
        # Anthropic: either direct API key OR LiteLLM proxy (base_url + auth_token)
        has_direct_key = bool(self.anthropic_api_key and self.anthropic_api_key != "your-api-key-here")
        has_proxy_config = bool(self.anthropic_base_url and self.anthropic_auth_token)
        return has_direct_key or has_proxy_config

    def get_anthropic_config(self) -> dict:
        """Get Anthropic client configuration (direct or proxy mode)."""
        # Prefer LiteLLM proxy if configured
        if self.anthropic_base_url and self.anthropic_auth_token:
            return {
                "api_key": self.anthropic_auth_token,  # Virtual key for proxy
                "base_url": self.anthropic_base_url,
            }
        # Fall back to direct Anthropic API
        return {
            "api_key": self.anthropic_api_key,
        }

    class Config:
        env_file = ".env"
        extra = "ignore"


# Global settings instance
settings = Settings()

# Available models configuration
AVAILABLE_MODELS = [
    {
        "id": "claude-sonnet-4-5-20250929",
        "name": "Claude Sonnet 4.5",
        "provider": "anthropic",
        "description": "Balanced performance and speed",
    },
    {
        "id": "claude-opus-4-5-20251101",
        "name": "Claude Opus 4.5",
        "provider": "anthropic",
        "description": "Most capable model for complex reasoning",
    },
    {
        "id": "gpt-5.2-2025-12-11",
        "name": "GPT-5.2",
        "provider": "openai",
        "description": "OpenAI's most capable model",
    },
    {
        "id": "gpt-5-mini",
        "name": "GPT-5 Mini",
        "provider": "openai",
        "description": "Fast and efficient OpenAI model",
    },
    {
        "id": "gpt-5-nano-2025-08-07",
        "name": "GPT-5 Nano",
        "provider": "openai",
        "description": "Ultra-fast model, ideal for sub-calls",
    },
]


def get_model_provider(model_id: str) -> str:
    """Get the provider for a given model ID."""
    for model in AVAILABLE_MODELS:
        if model["id"] == model_id:
            return model["provider"]
    # Default to anthropic for unknown models
    return "anthropic"
