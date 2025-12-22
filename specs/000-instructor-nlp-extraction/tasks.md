# Tasks: NLP Extraction with Instructor

**Input**: Design documents from `/specs/001-instructor-nlp-extraction/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are recommended per Constitution (Testing Encouraged) but not mandatory. Integration tests included for critical paths.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **LLM Service**: `llm-service/app/` for source, `llm-service/tests/` for tests
- Extending existing Python codebase - no new project initialization needed

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Model extensions needed by all user stories

- [x] T001 Add ExtractionClassification enum (fact_update, event_log, mixed) in llm-service/app/models/extraction.py
- [x] T002 Add ClassifiedExtraction response model in llm-service/app/models/extraction.py
- [x] T003 Add helper function to summarize Reasoning into chain_of_thought string in llm-service/app/models/extraction.py

**Checkpoint**: New models ready for use in services

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core classification logic that enables all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement classify_extraction() function in llm-service/app/services/extraction.py that derives classification from IntelligenceExtraction content
- [x] T005 Add extract_and_classify() method to ExtractionService in llm-service/app/services/extraction.py that wraps extraction + classification
- [x] T006 Update /extract endpoint to return ClassifiedExtraction in llm-service/app/routes/extract.py
- [x] T007 Add /health endpoint with provider info in llm-service/app/routes/extract.py (if not exists)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Process Fact Updates (Priority: P1) 🎯 MVP

**Goal**: Extract person/entity data from natural language and upsert to entities table

**Independent Test**: Submit person-related text (e.g., "John's email is john@example.com"), verify entity created/updated in database with correct fields

### Implementation for User Story 1

- [x] T008 [US1] Verify entity upsert logic in llm-service/app/services/supabase_sync.py handles name-based matching per FR-006
- [x] T009 [US1] Add logging for entity upsert operations in llm-service/app/services/supabase_sync.py
- [x] T010 [US1] Add error handling for entity sync failures with meaningful messages in llm-service/app/services/supabase_sync.py

**Checkpoint**: User Story 1 complete - fact updates extract and persist correctly

---

## Phase 4: User Story 2 - Process Event Logs (Priority: P1)

**Goal**: Extract interaction/event data from natural language and insert to intel table

**Independent Test**: Submit event text (e.g., "Called John yesterday about the project"), verify intel record created with correct timestamp and entity linkage

### Implementation for User Story 2

- [x] T011 [US2] Verify intel insert logic in llm-service/app/services/supabase_sync.py links to entities via intel_entities junction
- [x] T012 [US2] Add logging for intel insert operations in llm-service/app/services/supabase_sync.py
- [x] T013 [US2] Add error handling for intel sync failures with meaningful messages in llm-service/app/services/supabase_sync.py

**Checkpoint**: User Stories 1 AND 2 complete - both fact updates and event logs work

---

## Phase 5: User Story 3 - Switch LLM Provider (Priority: P2)

**Goal**: Allow switching between OpenAI and Ollama via environment variables only

**Independent Test**: Change LLM_PROVIDER env var, restart service, verify extraction works with new provider

### Implementation for User Story 3

- [x] T014 [US3] Verify existing provider switching in llm-service/app/services/llm.py works per FR-007 and FR-008
- [x] T015 [US3] Document required environment variables in llm-service/.env.example
- [x] T016 [US3] Add provider info to /health endpoint response in llm-service/app/routes/extract.py

**Checkpoint**: User Story 3 complete - provider switching verified

---

## Phase 6: User Story 4 - Automatic Classification (Priority: P2)

**Goal**: System automatically determines Fact Update vs Event Log without user hints

**Independent Test**: Submit various text types, verify classification matches expected type in response

### Implementation for User Story 4

- [x] T017 [US4] Ensure classify_extraction() correctly identifies fact_update when only entities present in llm-service/app/services/extraction.py
- [x] T018 [US4] Ensure classify_extraction() correctly identifies event_log when only intel present in llm-service/app/services/extraction.py
- [x] T019 [US4] Ensure classify_extraction() returns mixed when both entities and intel present in llm-service/app/services/extraction.py
- [x] T020 [US4] Include classification reasoning in chain_of_thought summary in llm-service/app/services/extraction.py

**Checkpoint**: All user stories complete - full classification pipeline working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Testing, documentation, and validation

- [x] T021 [P] Create integration test for fact update extraction in llm-service/tests/test_classification.py
- [x] T022 [P] Create integration test for event log extraction in llm-service/tests/test_classification.py
- [x] T023 [P] Create integration test for mixed content extraction in llm-service/tests/test_classification.py
- [x] T024 [P] Create integration test for provider switching in llm-service/tests/test_provider.py
- [x] T025 Run quickstart.md validation checklist
- [x] T026 Update CLAUDE.md if any new patterns established

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Phase 2 completion
  - US1 and US2 are both P1 - can run in parallel
  - US3 and US4 are both P2 - can run in parallel after P1 complete
- **Polish (Phase 7)**: Depends on user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 - No dependencies on other stories (can parallel with US1)
- **US3 (P2)**: Can start after Phase 2 - Independent (provider layer already exists)
- **US4 (P2)**: Depends on Phase 2 classification logic - Tests the classification

### Within Each Phase

- Models before services
- Services before endpoints
- Core implementation before integration tests

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different aspects of same file, but logically separate)
- US1 and US2 can run in parallel (different database operations)
- US3 and US4 can run in parallel (different concerns)
- All test tasks (T021-T024) can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# All model additions can be done together:
Task: "Add ExtractionClassification enum in llm-service/app/models/extraction.py"
Task: "Add ClassifiedExtraction response model in llm-service/app/models/extraction.py"
Task: "Add helper function to summarize Reasoning in llm-service/app/models/extraction.py"
```

## Parallel Example: User Stories 1 & 2

```bash
# After Phase 2, both P1 stories can start:
Task: "[US1] Verify entity upsert logic in llm-service/app/services/supabase_sync.py"
Task: "[US2] Verify intel insert logic in llm-service/app/services/supabase_sync.py"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup (models)
2. Complete Phase 2: Foundational (classification logic)
3. Complete Phase 3: User Story 1 (fact updates)
4. Complete Phase 4: User Story 2 (event logs)
5. **STOP and VALIDATE**: Test both extraction types independently
6. Demo: "The system can now extract and classify person facts vs interaction events"

### Full Feature

1. Complete MVP (Phases 1-4)
2. Add Phase 5: User Story 3 (provider switching verification)
3. Add Phase 6: User Story 4 (automatic classification refinement)
4. Add Phase 7: Polish (tests, docs)

### Incremental Delivery

1. MVP delivers core value (P1 stories)
2. Each P2 story adds flexibility without breaking existing functionality
3. Tests validate all stories work independently

---

## Notes

- Most infrastructure already exists - this is an enhancement, not greenfield
- Total tasks: 26
- Tasks per story: Setup=3, Foundational=4, US1=3, US2=3, US3=3, US4=4, Polish=6
- Parallel opportunities: Within setup, US1||US2, US3||US4, all tests
- Key files modified: extraction.py (models), extraction.py (services), supabase_sync.py, extract.py (routes)
- No new files except tests
