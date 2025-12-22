# LLM Service

Intelligence extraction service using Instructor for structured NLP extraction with Ollama/OpenAI.

## Features

- **Structured Intelligence Extraction**: Extract entities, relations, and intel from unstructured text
- **Automatic Classification**: Classify extractions as fact updates, event logs, or mixed
- **Entity Resolution**: Prevent duplicate entities using intelligent matching
- **Database Sync**: Automatically sync extracted data to Supabase
- **Retry Logic**: Automatic retry on validation errors for consistent extraction (max_retries=3)
- **Deterministic Output**: Temperature=0 for Ollama provider ensures consistency
- **Fast Testing**: VCR cassettes for instant test replay without running LLM

## Quick Start

### Prerequisites

- Python 3.11+
- Supabase (local instance via `supabase start`)
- Ollama with `qwen2.5:7b` model (only for recording new cassettes)

### Installation

```bash
cd llm-service
pip install -r requirements.txt
```

### Running Tests

#### Fast Mode (Default)
Uses VCR cassettes for instant replay. **Does not require Ollama**.

```bash
./run_tests.sh
```

Or directly with pytest:
```bash
python -m pytest tests/ -v
```

#### Recording Mode
Updates VCR cassettes with fresh LLM responses. **Requires Ollama running**.

```bash
./run_tests.sh --record
```

Or directly with pytest:
```bash
python -m pytest tests/ --record-mode=rewrite -v
```

### Consistency Check

Verify tests pass 5 times consecutively:

```bash
./check_consistency.sh
```

## Architecture

### Core Components

- **`app/services/extraction.py`**: Main extraction service orchestrating LLM calls
- **`app/services/llm.py`**: LLM provider implementations (OpenAI, Ollama)
- **`app/services/supabase_sync.py`**: Database synchronization service
- **`app/models/extraction.py`**: Pydantic models for structured extraction

### Extraction Flow

1. Text → LLM Provider (with max_retries=3)
2. LLM Response → Pydantic Validation
3. IntelligenceExtraction → Classification
4. ClassifiedExtraction → Database Sync
5. Database → SyncResults

## Configuration

### Retry Logic

The extraction service uses Instructor's built-in retry mechanism:

```python
extraction = extraction_service.extract_intelligence(
    text="John Smith works at Acme Corp",
    max_retries=3  # Default: 3
)
```

When validation errors occur, the LLM is automatically prompted again with the error details, up to `max_retries` times.

### Temperature Control

The Ollama provider enforces `temperature=0` for deterministic outputs:

```python
# app/services/llm.py
extraction = self.client.chat.completions.create(
    model=self.model,
    response_model=IntelligenceExtraction,
    temperature=0,  # Deterministic
    max_retries=max_retries
)
```

### VCR Cassettes

Tests use VCR.py via `pytest-recording` to record and replay HTTP interactions:

- **Location**: `tests/cassettes/`
- **Configuration**: `tests/conftest.py`
- **Scope**: Classification tests only (integration tests excluded due to Supabase httpx compatibility)

#### When to Re-record Cassettes

Re-record cassettes when you:
- Change prompts or LLM logic
- Update the extraction schema
- Modify temperature or other LLM parameters

```bash
./run_tests.sh --record
```

## Testing

### Test Structure

- **`tests/test_classification.py`**: Classification logic (VCR enabled)
- **`tests/test_integration.py`**: Full extraction + database sync
- **`tests/test_provider.py`**: Provider selection and configuration
- **`tests/test_retry.py`**: Retry mechanism and parameter passing

### Test Performance

- Individual tests complete in < 2 minutes (with Ollama during recording)
- Full suite with VCR: ~80 seconds (20 tests)
- Fast mode doesn't require Ollama running

### Robust Assertions

Tests use lenient assertions to handle LLM output variations:

```python
# Instead of exact counts:
assert len(extraction.entities) >= 2, "Should extract at least 2 entities"

# Instead of exact identifier types:
assert len(john.identifiers) >= 1, "Should have at least one identifier"
```

This ensures tests remain stable across LLM variations while still validating core functionality.

## API Usage

### Starting the Server

```bash
cd llm-service
uvicorn app.main:app --reload --port 8000
```

The server will start at `http://localhost:8000`

### Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "llm_provider": "ollama",
  "llm_model": "qwen2.5:7b"
}
```

### Extract Intelligence (No Database Sync)

```bash
curl -X POST http://localhost:8000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Smith works at Acme Corp. His email is john@acme.com",
    "sync_to_db": false
  }'
```

Response:
```json
{
  "classification": "fact_update",
  "chain_of_thought": "Identified 2 entities: John Smith (person), Acme Corp (organization)...",
  "extraction": {
    "reasoning": {...},
    "entities": [
      {
        "name": "John Smith",
        "entity_type": "person",
        "identifiers": [
          {"identifier_type": "name", "value": "John Smith"},
          {"identifier_type": "email", "value": "john@acme.com"}
        ],
        "confidence": "high"
      },
      {
        "name": "Acme Corp",
        "entity_type": "organization",
        "identifiers": [
          {"identifier_type": "name", "value": "Acme Corp"}
        ],
        "confidence": "high"
      }
    ],
    "relations": [...],
    "intel": []
  },
  "sync_results": null
}
```

### Extract Intelligence (With Database Sync)

Requires authentication token:

```bash
# Get your auth token from Supabase
TOKEN="your-supabase-jwt-token"

curl -X POST http://localhost:8000/api/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "Bob Miller met with Sarah Johnson at the conference in San Francisco",
    "source_code": "MEETING_NOTES",
    "sync_to_db": true
  }'
```

Response includes `sync_results`:
```json
{
  "classification": "event_log",
  "chain_of_thought": "Identified temporal event: meeting...",
  "extraction": {...},
  "sync_results": {
    "entities_created": [
      {"entity_id": "uuid-1", "name": "Bob Miller", "type": "person"},
      {"entity_id": "uuid-2", "name": "Sarah Johnson", "type": "person"}
    ],
    "entities_updated": [],
    "relations_created": [],
    "intel_created": [
      {"intel_id": "uuid-3", "type": "event", "description": "meeting"}
    ],
    "errors": []
  }
}
```

### API Documentation

Interactive API docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Development

### Adding New Tests

1. Write test in appropriate test file
2. Run in recording mode to generate cassette (if using VCR)
3. Verify test passes in fast mode
4. Run consistency check to ensure stability

### Updating Extraction Schema

1. Modify `app/models/extraction.py`
2. Update prompts in `app/services/llm.py` if needed
3. Re-record cassettes: `./run_tests.sh --record`
4. Update test assertions if schema changes significantly

## Troubleshooting

### Tests Fail Inconsistently

- Check if `max_retries` is configured (default: 3)
- Verify `temperature=0` for Ollama provider
- Re-run consistency check: `./check_consistency.sh`
- Consider re-recording cassettes if prompts changed

### VCR Cassette Errors

- Delete `tests/cassettes/` and re-record
- Ensure you're using `--record-mode=rewrite` not `once`
- Check that Ollama is running for recording mode

### Ollama Connection Issues

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check model is available: `ollama list | grep qwen2.5:7b`
- Pull model if missing: `ollama pull qwen2.5:7b`

## License

Internal use only.
