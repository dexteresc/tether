# Research: Improve Consistency and Performance of LLM Service

## Unknowns & Clarifications

### 1. VCR Integration with Instructor/OpenAI
**Question**: How to correctly record and replay `instructor` calls which wrap `openai` client?
**Findings**:
- `instructor` uses the `openai` Python client under the hood.
- `openai` v1.x uses `httpx` for networking.
- `vcrpy` supports `httpx` but often requires specific configuration or the `pytest-recording` plugin which simplifies `pytest` integration.
- **Decision**: Use `pytest-recording` + `vcrpy`.
- **Rationale**: `pytest-recording` provides a `pytest` fixture `vcr` and command-line options (`--record-mode`) that make management easier than raw `vcrpy` decorators.
- **Configuration**: Need to ensure `vcr` is configured to filter sensitive headers (Authorization) even though we are using local models (just good practice).

### 2. Instructor Retry Logic
**Question**: How to enable retries for validation errors in `instructor`?
**Findings**:
- `instructor` allows passing `max_retries` directly to the `create` method.
- When `max_retries` is set, `instructor` catches `ValidationError` from Pydantic and re-prompts the LLM with the error message.
- **Decision**: Update `LLMProvider.extract` to accept and use a configured `max_retries` value (default 3).
- **Rationale**: This is a built-in feature of `instructor` designed exactly for this use case.

## Technology Decisions

### Test Infrastructure
- **Tool**: `vcrpy` via `pytest-recording`
- **Rationale**:
  - Enables instant test replay by eliminating network I/O during cassette playback.
  - Ensures 100% consistency (same input = same output from cassette).
  - Allows "Live" testing via `--record-mode=rewrite`.
  - Each individual test completes in < 2 minutes when recording with Ollama.
- **Alternatives Considered**:
  - *Mocking `OpenAI` client*: Too brittle, mocking complex nested objects is error-prone.
  - *Fake LLM*: Doesn't test the prompt/response structure validity.

### Consistency Mechanism
- **Tool**: `instructor` built-in `max_retries`
- **Rationale**: Automatic self-correction is more robust than strict temperature control alone.
- **Configuration**:
  - `max_retries`: 3 (Balance between latency and success rate).
  - `temperature`: 0 (Already likely set, but enforce it).

## Implementation Strategy

1.  **Add Dependencies**: `vcrpy`, `pytest-recording`.
2.  **Configure VCR**: Create `tests/conftest.py` to configure `vcr` scope (module or session likely better for performance, but function is safer for isolation. Will start with `function` scope and check speed).
3.  **Update Service**: Modify `app/services/extraction.py` to pass `max_retries`.
4.  **Record Cassettes**: Run tests once with `OLLAMA_HOST` active to generate cassettes.
5.  **Verify**: Run tests without Ollama to ensure they use cassettes and pass in < 2m.
