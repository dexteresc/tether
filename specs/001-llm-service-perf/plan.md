# Implementation Plan: Improve Consistency and Performance of LLM Service

**Branch**: `001-llm-service-perf` | **Date**: 2025-12-22 | **Spec**: [specs/001-llm-service-perf/spec.md](spec.md)
**Input**: Feature specification from `specs/001-llm-service-perf/spec.md`

## Summary

The goal is to improve the consistency and performance of the LLM service's test suite, targeting a total execution time of under 2 minutes and 100% pass rate consistency. The technical approach involves implementing Record & Replay (VCR) for test isolation and speed, and enabling Instructor's validation retries for robust extraction.

## Technical Context

**Language/Version**: Python 3.11+ (inferred from dependencies)
**Primary Dependencies**: 
- `instructor` (existing)
- `pytest` (existing)
- `vcrpy` (NEEDS RESEARCH - new dependency)
- `pytest-recording` (NEEDS RESEARCH - potential helper)
**Storage**: N/A
**Testing**: `pytest` (currently running `tests/test_integration.py`)
**Target Platform**: Local Dev / Docker
**Project Type**: Backend Service
**Performance Goals**: Test suite < 2 minutes
**Constraints**: Must use local `llama3.2` model (no switching to faster cloud models)
**Scale/Scope**: Integration tests currently depend on live local inference

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Test-First**: The entire feature is about improving the testing infrastructure. (Pass)
- **Simplicity**: VCR adds complexity but is necessary for the performance constraint. (Pass)
- **Dependencies**: Adding `vcrpy` is a standard practice for this problem. (Pass)

## Project Structure

### Documentation (this feature)

```text
specs/001-llm-service-perf/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A for this feature, but file will be created empty or skipped)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
llm-service/
├── app/
│   ├── services/
│   │   ├── extraction.py  # Target for Retry logic
│   │   └── llm.py        # Target for Provider config
├── tests/
│   ├── test_integration.py # Target for VCR integration
│   └── cassettes/        # New directory for VCR recordings
├── requirements.txt      # Add vcrpy
└── run_tests.sh          # Update if needed
```

**Structure Decision**: Standard Python service structure.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New Dependency (`vcrpy`) | Required to meet <2m test time with local LLM | Live inference is too slow (>2m) |