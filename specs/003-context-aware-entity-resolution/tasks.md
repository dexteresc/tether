# Tasks: Context-Aware Entity Resolution

**Input**: Design documents from `/specs/003-context-aware-entity-resolution/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This feature specification does not explicitly request TDD or specific test coverage, so test tasks are NOT included in the task list. Tests can be added later if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- All paths are relative to repository root
- This feature extends `llm-service/` directory (existing Python service)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Add RapidFuzz==3.14.3 to llm-service/requirements.txt
- [X] T002 Install dependencies with pip install -r llm-service/requirements.txt
- [X] T003 [P] Add environment variables to llm-service/.env.example (FUZZY_MATCH_FIRST_NAME_THRESHOLD, FUZZY_MATCH_LAST_NAME_THRESHOLD, AUTO_RESOLVE_CONFIDENCE_THRESHOLD, ENTITY_CACHE_TTL_SECONDS)
- [X] T004 [P] Update llm-service/app/config.py to load entity resolution environment variables

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create llm-service/app/models/resolution.py with EntityResolutionResult Pydantic model
- [X] T006 [P] Add PersonEntity Pydantic model to llm-service/app/models/resolution.py
- [X] T007 [P] Add ResolutionContext Pydantic model to llm-service/app/models/resolution.py
- [X] T008 Create llm-service/app/services/entity_resolver.py with EntityResolverService class stub
- [X] T009 Implement query_persons_from_database() method in llm-service/app/services/entity_resolver.py to fetch all person entities and identifiers from Supabase
- [X] T010 Implement build_resolution_context() method in llm-service/app/services/entity_resolver.py to transform database results into ResolutionContext
- [X] T011 [P] Create llm-service/app/utils/fuzzy_matcher.py with RapidFuzz Jaro-Winkler helper functions

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Resolve Unique Person Reference (Priority: P1)

**Goal**: Enable automatic resolution of person references when exactly one match exists in the database. This is the core functionality that enables users to refer to people naturally without full names or IDs.

**Independent Test**: Create a single person named "John" in database, submit "John ate a burger", verify system links to correct person entity with resolved=True and high confidence.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement exact_match() method in llm-service/app/services/entity_resolver.py for case-insensitive exact name matching
- [X] T013 [P] [US1] Implement fuzzy_match_single_name() method in llm-service/app/services/entity_resolver.py using RapidFuzz for first name matching with 80% threshold
- [X] T014 [US1] Implement resolve_person_reference() method in llm-service/app/services/entity_resolver.py that orchestrates exact match, then fuzzy match, returns EntityResolutionResult
- [X] T015 [US1] Implement calculate_confidence_score() method in llm-service/app/services/entity_resolver.py using weighted scoring (exact: 0.5, fuzzy: 0.3, context: 0.2)
- [X] T016 [US1] Add chain_of_thought reasoning generation in llm-service/app/services/entity_resolver.py for each resolution method
- [X] T017 [US1] Integrate entity_resolver.resolve_person_reference() into llm-service/app/services/extraction.py extraction workflow
- [X] T018 [US1] Update llm-service/app/models/extraction.py to add EnhancedEventLog model with entity_resolutions field
- [X] T019 [US1] Modify llm-service/app/services/supabase_sync.py to use resolved_entity_id when creating intel_entities links
- [X] T020 [US1] Handle new entity creation (resolved=False) in llm-service/app/services/supabase_sync.py when confidence <0.8

**Checkpoint**: At this point, User Story 1 should be fully functional - unique person references resolve automatically

---

## Phase 4: User Story 2 - Handle Ambiguous Person References (Priority: P1)

**Goal**: Detect when multiple persons match a reference and provide clarification data to the user with distinguishing attributes.

**Independent Test**: Create two persons named "John Smith" and "John Doe", submit "John called", verify system returns ambiguous=True with candidates containing both persons and their companies/emails.

### Implementation for User Story 2

- [X] T021 [US2] Implement detect_ambiguity() method in llm-service/app/services/entity_resolver.py to identify multiple matches with confidence >0.8
- [X] T022 [US2] Implement build_candidates_list() method in llm-service/app/services/entity_resolver.py to extract distinguishing attributes (company, email) from ambiguous matches
- [X] T023 [US2] Update resolve_person_reference() in llm-service/app/services/entity_resolver.py to return ambiguous=True and candidates when multiple matches detected
- [X] T024 [US2] Implement full_name_matching() in llm-service/app/services/entity_resolver.py to handle "John Smith" vs "John Doe" disambiguation
- [X] T025 [US2] Implement contextual_attribute_matching() in llm-service/app/services/entity_resolver.py to use company/email from input text for disambiguation (e.g., "John from Acme Corp")
- [X] T026 [US2] Add needs_clarification boolean to extraction response model in llm-service/app/models/extraction.py
- [X] T027 [US2] Create clarification_request structure in llm-service/app/models/extraction.py with question and options for frontend display
- [X] T028 [US2] Update llm-service/app/routes/extract.py to set needs_clarification=True in response when any EntityResolutionResult has ambiguous=True

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - unique matches resolve, ambiguous matches return clarification data

---

## Phase 5: User Story 3 - Resolve Multi-Person Interactions (Priority: P2)

**Goal**: Handle natural language describing interactions with multiple people (e.g., "John ate a burger with Timmy") by resolving all person references.

**Independent Test**: Create persons "John" and "Timmy", submit "John ate a burger with Timmy", verify system creates interaction log with intel_entities links to both persons.

### Implementation for User Story 3

- [X] T029 [US3] Implement extract_person_references() method in llm-service/app/services/entity_resolver.py to identify all person names mentioned in LLM extraction (participants field)
- [X] T030 [US3] Implement resolve_multiple_persons() method in llm-service/app/services/entity_resolver.py that loops over all references and resolves each independently
- [X] T031 [US3] Update EnhancedEventLog model in llm-service/app/models/extraction.py to include participant_ids list (all resolved entity UUIDs)
- [X] T032 [US3] Modify llm-service/app/services/supabase_sync.py to create multiple intel_entities records when participant_ids contains multiple UUIDs
- [X] T033 [US3] Add role field to intel_entities inserts in llm-service/app/services/supabase_sync.py (e.g., "participant", "subject")
- [X] T034 [US3] Handle mixed resolution results (some unique, some ambiguous) in llm-service/app/services/entity_resolver.py by flagging entire extraction as needs_clarification if ANY person is ambiguous

**Checkpoint**: All user stories 1, 2, and 3 should now be independently functional - single, ambiguous, and multi-person resolution all work

---

## Phase 6: User Story 4 - Update Person Attributes with Context (Priority: P3)

**Goal**: Enable updating person attributes (email, company, etc.) by resolving the person via name and applying the update without creating duplicates.

**Independent Test**: Create person "John", submit "John's email is john@new.com", verify existing John entity's email identifier is updated (not new person created).

### Implementation for User Story 4

- [X] T035 [P] [US4] Add EnhancedFactUpdate model to llm-service/app/models/extraction.py with entity_resolutions field
- [X] T036 [US4] Integrate entity resolution into FactUpdate classification path in llm-service/app/services/extraction.py
- [X] T037 [US4] Implement update_person_attributes() method in llm-service/app/services/supabase_sync.py to update identifiers table when resolved_entity_id exists and extraction contains new attributes
- [X] T038 [US4] Add upsert logic in llm-service/app/services/supabase_sync.py to update existing identifier.value if type+entity_id match, or insert new identifier if type doesn't exist
- [X] T039 [US4] Implement session_entity tracking in llm-service/app/models/resolution.py (SessionEntity model with entity_id, mention_count, last_mentioned_at)
- [X] T040 [US4] Add session_entities field to ResolutionContext in llm-service/app/models/resolution.py
- [X] T041 [US4] Implement pronoun_resolution() method in llm-service/app/services/entity_resolver.py to resolve "he", "she", "they" to most recently mentioned entity from session
- [X] T042 [US4] Update extraction.py to pass session context (recent entities) to entity_resolver when building ResolutionContext

**Checkpoint**: All user stories should now be independently functional - complete entity resolution with updates

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T043 [P] Add comprehensive logging for all resolution methods in llm-service/app/services/entity_resolver.py with confidence scores and match details
- [X] T044 [P] Implement match_details dictionary population in llm-service/app/services/entity_resolver.py for all EntityResolutionResult objects (exact_match bool, fuzzy_scores dict, context_match str)
- [X] T045 [P] Add error handling in llm-service/app/services/entity_resolver.py for database query failures (gracefully fall back to new entity creation)
- [X] T046 [P] Add input validation in llm-service/app/routes/extract.py for resolution_config thresholds (must be 0.0-1.0)
- [X] T047 [P] Create llm-service/scripts/seed_test_persons.py script to populate database with test person entities for quickstart
- [X] T048 Update llm-service/README.md with entity resolution feature documentation and configuration variables
- [X] T049 Run through llm-service/specs/003-context-aware-entity-resolution/quickstart.md to validate all test scenarios work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Extends US1 but independently testable (requires ambiguity detection, not unique resolution)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Uses resolve_person_reference from US1 but works independently
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Uses resolution from US1/US2 but adds update logic independently

### Within Each User Story

- Core resolution methods before integration into extraction.py
- Models before services
- Services before routes
- Supabase sync changes after resolution logic complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003, T004)
- Foundational models (T006, T007) can run in parallel after T005
- T011 (fuzzy matcher utils) can run in parallel with T005-T010
- Within User Stories:
  - US1: T012, T013 can run in parallel (different matching methods)
  - US2: T021, T022, T024, T025 can run in parallel if carefully coordinated (different methods)
  - US4: T035, T039, T040 can run in parallel (different models)
- Polish phase: All tasks marked [P] can run in parallel (T043-T047)
- User Stories 1 and 2 can be worked on in parallel by different developers (both P1 priority, minimal overlap)

---

## Parallel Example: User Story 1

```bash
# Launch both matching methods together:
Task: "Implement exact_match() method in llm-service/app/services/entity_resolver.py for case-insensitive exact name matching"
Task: "Implement fuzzy_match_single_name() method in llm-service/app/services/entity_resolver.py using RapidFuzz for first name matching with 80% threshold"
```

## Parallel Example: User Story 2

```bash
# Launch all disambiguation methods together:
Task: "Implement detect_ambiguity() method in llm-service/app/services/entity_resolver.py to identify multiple matches with confidence >0.8"
Task: "Implement build_candidates_list() method in llm-service/app/services/entity_resolver.py to extract distinguishing attributes (company, email) from ambiguous matches"
Task: "Implement full_name_matching() in llm-service/app/services/entity_resolver.py to handle 'John Smith' vs 'John Doe' disambiguation"
Task: "Implement contextual_attribute_matching() in llm-service/app/services/entity_resolver.py to use company/email from input text for disambiguation"
```

## Parallel Example: Foundational Phase

```bash
# Launch all Pydantic models together:
Task: "Add PersonEntity Pydantic model to llm-service/app/models/resolution.py"
Task: "Add ResolutionContext Pydantic model to llm-service/app/models/resolution.py"
```

---

## Implementation Strategy

### Incremental Delivery Strategy (Phased Rollout)

Both User Stories 1 and 2 are marked Priority P1 because:
- US1 provides the core resolution capability (unique matches)
- US2 prevents data corruption from incorrect matching (ambiguity detection)
- Together they form a complete, safe entity resolution system

**Phase 1 Release Scope (Initial Deployment):**
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (unique person resolution)
4. Complete Phase 4: User Story 2 (ambiguity handling)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy Phase 1 release with safe entity resolution

### Incremental Delivery

1. **Foundation** (Setup + Foundational) → Foundation ready
2. **Phase 1 Release** (User Stories 1 + 2) → Test independently → Deploy/Demo
   - Unique person resolution works
   - Ambiguous cases detected and handled safely
3. **Phase 2 Release** (User Story 3) → Test independently → Deploy/Demo
   - Adds ability to handle multiple people in one input
4. **Phase 3 Release** (User Story 4) → Test independently → Deploy/Demo
   - Adds ability to update person attributes via resolution
5. **Production Polish** (Phase 7) → Production-ready

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (Phases 1-2)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (unique resolution)
   - **Developer B**: User Story 2 (ambiguity handling)
   - Stories complete independently, then integrate
3. After Phase 1 validation:
   - **Developer A**: User Story 3 (multi-person)
   - **Developer B**: User Story 4 (attribute updates)
4. **Team**: Polish phase together

---

## Task Count Summary

- **Total Tasks**: 49
- **Setup (Phase 1)**: 4 tasks
- **Foundational (Phase 2)**: 7 tasks
- **User Story 1 (P1)**: 9 tasks
- **User Story 2 (P1)**: 8 tasks
- **User Story 3 (P2)**: 6 tasks
- **User Story 4 (P3)**: 8 tasks
- **Polish (Phase 7)**: 7 tasks

**Parallelizable Tasks**: 17 tasks marked [P]

**Critical Path** (sequential minimum):
1. Setup (4 tasks)
2. Foundational (7 tasks, some parallel)
3. User Story implementation (can parallelize across stories)
4. Polish (7 tasks, mostly parallel)

Estimated with 2 developers: Setup + Foundational sequentially, then US1 & US2 in parallel for Phase 1 release

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable per spec.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No test tasks included (not explicitly requested in specification)
- All file paths use `llm-service/` prefix (extends existing service)
- RapidFuzz thresholds configurable via environment variables
- Database schema requires no migrations (uses existing entities/identifiers tables)
