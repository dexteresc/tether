import pytest
import os

@pytest.fixture(scope="session", autouse=True)
def force_test_settings():
    """Ensure consistent settings for tests."""
    os.environ["LLM_MODEL"] = "qwen2.5:7b"
    os.environ["LLM_PROVIDER"] = "ollama"

@pytest.fixture(scope="module")
def vcr_config():
    """
    VCR configuration for recording and replaying HTTP interactions.
    Applied globally to all integration, classification, and provider tests.
    """
    return {
        "filter_headers": ["authorization", "x-api-key", "Authorization", "apikey"],
        "ignore_localhost": False,  # Record localhost for Ollama and Supabase
        "record_mode": "once",  # Use cassettes if they exist, record if missing
        "cassette_library_dir": "tests/cassettes",  # Store cassettes here
        "path_transformer": lambda path: path.replace(".py", ""),  # Cleaner paths
        "match_on": ["method", "scheme", "host", "port", "path", "query"],
        "decode_compressed_response": True,  # Handle compressed responses
    }

@pytest.fixture(scope="function")
def vcr_cassette_dir(request):
    """Set the cassette directory for VCR."""
    return "tests/cassettes"

def pytest_collection_modifyitems(items):
    """
    Auto-mark tests with @pytest.mark.vcr for LLM call recording/playback.

    VCR is applied to:
    - Classification tests (pure LLM calls, no database)
    - Any other tests that only make LLM calls

    VCR is NOT applied to:
    - Integration tests that use Supabase (VCR has async compatibility issues with httpx)
    - Unit tests that use mocks (e.g., test_retry.py)
    """
    for item in items:
        # Skip tests that use mocks
        if "test_retry" in str(item.fspath):
            continue
        # Skip integration tests that use Supabase (VCR incompatible)
        if "test_integration" in str(item.fspath):
            continue
        # Auto-apply VCR to classification and other non-database tests
        item.add_marker(pytest.mark.vcr)
