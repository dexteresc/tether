from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # LLM Configuration
    llm_provider: Literal["openai", "ollama", "anthropic"] = "ollama"
    llm_model: str = "qwen2.5:7b"

    # OpenAI
    openai_api_key: str = ""

    # Anthropic
    anthropic_api_key: str = ""

    # Ollama
    ollama_base_url: str = "http://localhost:11434/v1"

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # API Configuration
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Entity Resolution Configuration (Feature 003)
    fuzzy_match_first_name_threshold: float = 0.8


# Global settings instance
settings = Settings()
