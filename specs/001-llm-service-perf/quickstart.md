# Quickstart: LLM Service Performance & Testing

## Prerequisites

- **Ollama** running locally with `llama3.2` model (only for recording).
- **Python 3.11+** environment.

## Setup

1.  **Install Dependencies** (including new test tools):
    ```bash
    pip install -r llm-service/requirements.txt
    ```

## Running Tests

### Fast Mode (Default)
Uses recorded VCR cassettes. Does **not** require Ollama to be running.
Tests replay instantly from cassettes.

```bash
cd llm-service
pytest tests/
```

### Live Mode (Re-record)
Requires Ollama to be running. Updates cassettes with real model responses.
Use this when you change prompts or model logic.

```bash
# Ensure Ollama is running
ollama serve

# Run tests and update cassettes
cd llm-service
pytest --record-mode=rewrite tests/
```

## Configuration

### Consistency Settings
The extraction service is configured to self-correct validation errors.
Default retries: 3.

To modify, update `app/services/extraction.py` or associated config.
