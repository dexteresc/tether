import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError
from app.services.llm import OpenAIProvider, OllamaProvider
from app.models.extraction import IntelligenceExtraction


def test_openai_provider_passes_max_retries():
    """Test that max_retries parameter is correctly passed to the instructor client."""
    # Setup
    # Mock settings to avoid validation error on missing API key if it reads from env
    provider = OpenAIProvider(api_key="sk-test")
    mock_client = MagicMock()
    provider.client = mock_client

    # Execute
    provider.extract("test text", max_retries=5)

    # Verify
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["max_retries"] == 5


def test_ollama_provider_passes_max_retries():
    """Test that max_retries parameter is correctly passed to the instructor client for Ollama."""
    # Setup
    provider = OllamaProvider()
    mock_client = MagicMock()
    provider.client = mock_client

    # Execute
    provider.extract("test text", max_retries=5)

    # Verify
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["max_retries"] == 5


def test_ollama_provider_uses_temperature_zero():
    """Test that OllamaProvider enforces temperature=0 for consistency."""
    # Setup
    provider = OllamaProvider()
    mock_client = MagicMock()
    provider.client = mock_client

    # Execute
    provider.extract("test text")

    # Verify temperature is set to 0
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["temperature"] == 0


def test_retry_configuration_is_passed():
    """Test that max_retries parameter is correctly configured in both providers."""
    # Note: Actual retry behavior is handled internally by instructor library.
    # This test verifies that our providers correctly pass the max_retries parameter.

    # Test OpenAI provider
    openai_provider = OpenAIProvider(api_key="sk-test")
    openai_mock = MagicMock()
    openai_provider.client = openai_mock

    openai_provider.extract("test text", max_retries=5)
    call_kwargs = openai_mock.chat.completions.create.call_args[1]
    assert call_kwargs["max_retries"] == 5

    # Test Ollama provider
    ollama_provider = OllamaProvider()
    ollama_mock = MagicMock()
    ollama_provider.client = ollama_mock

    ollama_provider.extract("test text", max_retries=5)
    call_kwargs = ollama_mock.chat.completions.create.call_args[1]
    assert call_kwargs["max_retries"] == 5


def test_default_max_retries_is_three():
    """Test that default max_retries is 3 when not specified."""
    # Setup
    provider = OpenAIProvider(api_key="sk-test")
    mock_client = MagicMock()
    provider.client = mock_client

    # Execute without specifying max_retries
    provider.extract("test text")

    # Verify default is 3
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["max_retries"] == 3
