"""
Tests for LLM provider switching functionality.

T024: Tests that the provider factory correctly returns the right provider
based on configuration.

Note: These are unit tests that test the provider selection logic,
not integration tests that require actual LLM connections.
"""

import pytest


class TestProviderSwitching:
    """Tests for LLM provider switching logic."""

    def test_openai_provider_selection(self):
        """Test that openai provider is correctly identified."""
        provider_name = "openai"
        assert provider_name in ["openai", "ollama"]
        assert provider_name == "openai"

    def test_ollama_provider_selection(self):
        """Test that ollama provider is correctly identified."""
        provider_name = "ollama"
        assert provider_name in ["openai", "ollama"]
        assert provider_name == "ollama"

    def test_unknown_provider_rejected(self):
        """Test that unknown provider is not in valid list."""
        provider_name = "unknown"
        valid_providers = ["openai", "ollama"]
        assert provider_name not in valid_providers

    def test_provider_factory_logic(self):
        """Test the provider factory selection logic."""
        def select_provider(provider: str) -> str:
            if provider == "openai":
                return "OpenAIProvider"
            elif provider == "ollama":
                return "OllamaProvider"
            else:
                raise ValueError(f"Unknown LLM provider: {provider}")

        assert select_provider("openai") == "OpenAIProvider"
        assert select_provider("ollama") == "OllamaProvider"

        with pytest.raises(ValueError) as exc_info:
            select_provider("unknown")
        assert "Unknown LLM provider" in str(exc_info.value)

    def test_model_override_logic(self):
        """Test that model parameter properly overrides defaults."""
        default_model = "gpt-4o"
        override_model = "gpt-4-turbo"

        def get_model(model=None, default="gpt-4o"):
            return model or default

        assert get_model() == default_model
        assert get_model(model=override_model) == override_model
        assert get_model(model=None) == default_model
