# Implementation Plan: NLP Extraction with Instructor

**Branch**: `001-instructor-nlp-extraction` | **Date**: 2024-12-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-instructor-nlp-extraction/spec.md`

## Summary

Extend the existing LLM service to distinguish between "Fact Updates" (entity upserts) and "Event Logs" (intel inserts) using Instructor with Pydantic schemas. The system already supports chain-of-thought reasoning and provider switching (OpenAI/Ollama) - this feature adds explicit classification and proper database routing.

## Technical Context

**Language/Version**: Python 3.11+
**Primary Dependencies**: FastAPI, Instructor 1.0.0, OpenAI SDK, Supabase Python client, Pydantic
**Storage**: Supabase (PostgreSQL) - existing schema with entities, intel tables
**Testing**: pytest, pytest-asyncio
**Target Platform**: Linux/Docker container
**Project Type**: Web application (existing llm-service)
**Performance Goals**: Response within 10 seconds per extraction (LLM-bound)
**Constraints**: Must work with both OpenAI and local Ollama without code changes
**Scale/Scope**: Single-user development, small-scale data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Extending existing extraction service, not creating new abstractions |
| II. API Contract Discipline | PASS | Will define OpenAPI schemas for new classification endpoint |
| III. Testing Encouraged | PASS | Integration tests for extraction + DB sync recommended |
| IV. Service Boundaries | PASS | All changes within llm-service, uses existing Supabase API |
| V. Observability | PASS | Chain-of-thought provides extraction reasoning; structured logging exists |

## Project Structure

### Documentation (this feature)

```text
specs/001-instructor-nlp-extraction/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── extraction-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
llm-service/
├── app/
│   ├── models/
│   │   └── extraction.py        # Extend with FactUpdate, EventLog classification
│   ├── services/
│   │   ├── llm.py              # Existing provider switching (no changes needed)
│   │   ├── extraction.py       # Add classification logic
│   │   └── supabase_sync.py    # Extend to route by classification
│   └── routes/
│       └── extract.py          # Extend endpoint for classification response
└── tests/
    ├── test_classification.py   # New: classification accuracy tests
    └── test_sync.py             # New: DB sync routing tests
```

**Structure Decision**: Extending existing llm-service structure. No new directories needed - only modifications to existing files and new test files.

## Complexity Tracking

> No Constitution violations requiring justification.

| Decision | Rationale |
|----------|-----------|
| Reuse existing IntelligenceExtraction model | Already has Reasoning (chain-of-thought), entities, relations, intel fields |
| Add classification enum to extraction result | Simple addition to existing model, not new abstraction |
| Route based on extraction content | Entities → upsert, Intel → insert (existing logic, needs classification label) |
