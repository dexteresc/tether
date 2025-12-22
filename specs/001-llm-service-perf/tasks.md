# Tasks: Improve Consistency and Performance of LLM Service

**Spec**: [specs/001-llm-service-perf/spec.md](../spec.md)
**Plan**: [specs/001-llm-service-perf/plan.md](../plan.md)

## Phase 1: Setup
**Goal**: Initialize test infrastructure dependencies.

- [x] T001 Install `vcrpy` and `pytest-recording` dependencies in `llm-service/requirements.txt`
- [x] T002 Create `llm-service/tests/conftest.py` with VCR configuration (filter headers, cassette dir)

## Phase 2: Foundation
**Goal**: Implement core consistency logic (retries) and configuration.

- [x] T003 Update `llm-service/app/services/extraction.py` to implement `max_retries=3` in `extract_intelligence`
- [x] T004 Update `llm-service/app/services/llm.py` to enforce `temperature=0` in `OllamaProvider`
- [x] T005 [P] Create unit test in `llm-service/tests/test_retry.py` (new) to verify retry logic with mocked failures

## Phase 3: Rapid Test Feedback (User Story 1)
**Goal**: Optimize test suite using VCR for fast replay.
**Tests**: Each individual test should complete in < 2 minutes (with Ollama during recording, instant during replay).

- [x] T006 [US1] Configure VCR globally in `llm-service/tests/conftest.py` to apply to all relevant tests (integration, classification, provider) to ensure full suite coverage
- [x] T007 [US1] Run tests with `pytest --record-mode=rewrite` to generate initial cassettes (Requires Ollama, each test < 2min)
- [x] T008 [US1] Verify cassettes exist and tests replay correctly without Ollama running

## Phase 4: Reliable Test Execution (User Story 2)
**Goal**: Ensure tests are deterministic and robust.
**Tests**: Run suite 5 times consecutively with 100% pass rate.

- [x] T009 [US2] Update `llm-service/tests/test_integration.py` assertions to be robust against minor acceptable text variations (e.g., use fuzzy matching with >90% similarity or semantic equivalence checks)
- [x] T010 [US2] Create a consistency check script or run loop to verify 5 consecutive passes

## Phase 5: Polish
**Goal**: Improve developer experience.

- [x] T011 Update `llm-service/run_tests.sh` to default to fast mode (no recording) and add a flag for recording
- [x] T012 Add documentation to `llm-service/README.md` explaining VCR usage and `max_retries`

## Dependencies

- Phase 1 blocks all other phases.
- Phase 2 blocks Phase 4 (Consistency requires Retries).
- Phase 3 and Phase 4 can be partially parallelized, but Phase 3 (Performance) is the primary enabler for fast iteration in Phase 4.

## Implementation Strategy

1.  **MVP**: Setup VCR (Phase 1 & 3) to hit the < 2m target immediately.
2.  **Robustness**: Add Retries (Phase 2 & 4) to ensure the recorded cassettes (and future live runs) are high quality.
3.  **Refinement**: Polish scripts for easy adoption.
