---
description: "Task list for 002-frontend-data-viz"
---

# Tasks: Frontend Data Visualization & Natural Language Input (Local‑First)

**Input**: Design documents from `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/`  
**Prerequisites**: `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/plan.md`, `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`  
**Optional context**: `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/research.md`, `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/data-model.md`, `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/contracts/`, `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/quickstart.md`

**Note on tests**: The spec doesn’t request TDD, but the constitution requires tests for critical sync paths; this task list includes a minimal Vitest suite for sync/outbox/IDB.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]..[US6]` for user story phases only
- All task descriptions include absolute file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make `/Users/dexteresc/Dev/tether/frontend/` a buildable, single-source frontend workspace with pinned dependencies and required env configuration.

- [x] T001 Confirm `/Users/dexteresc/Dev/tether/frontend/` is the canonical frontend root and archive the abandoned scaffold by moving `/Users/dexteresc/Dev/tether/frontend/frontend/` to `/Users/dexteresc/Dev/tether/frontend/_legacy_scaffold/` (update `/Users/dexteresc/Dev/tether/frontend/README.md` accordingly)
- [x] T002 Consolidate frontend dependencies into `/Users/dexteresc/Dev/tether/frontend/package.json` and regenerate `/Users/dexteresc/Dev/tether/frontend/package-lock.json` so existing imports (`@supabase/supabase-js`, etc.) resolve
- [x] T003 [P] Add Vite env template and documentation in `/Users/dexteresc/Dev/tether/frontend/.env.example` (include `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LLM_SERVICE_URL`)
- [x] T004 [P] Remove hardcoded Supabase URL/key fallbacks and fail-fast on missing env vars in `/Users/dexteresc/Dev/tether/frontend/src/lib/supabase.ts`
- [x] T005 [P] Update generated Supabase DB types to match migrations (add `entities.type='event'`, extend `relations.type` set) in `/Users/dexteresc/Dev/tether/frontend/src/lib/types.ts`
- [x] T006 [P] Add routing baseline (React Router) and replace the Vite starter UI with an app shell in `/Users/dexteresc/Dev/tether/frontend/src/App.tsx`
- [x] T007 [P] Add MobX dependencies (`mobx`, `mobx-react-lite`) to `/Users/dexteresc/Dev/tether/frontend/package.json` and lock in `/Users/dexteresc/Dev/tether/frontend/package-lock.json`
- [x] T008 [P] Add IndexedDB wrapper dependency (`idb`) to `/Users/dexteresc/Dev/tether/frontend/package.json` and lock in `/Users/dexteresc/Dev/tether/frontend/package-lock.json`
- [x] T009 [P] Add Vitest + test setup (`vitest`, `jsdom`, `fake-indexeddb`) in `/Users/dexteresc/Dev/tether/frontend/package.json` and create `/Users/dexteresc/Dev/tether/frontend/vitest.config.ts`
- [x] T010 [P] Create a test bootstrap that installs fake IndexedDB and resets state in `/Users/dexteresc/Dev/tether/frontend/src/test/setup.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the local-first core (IndexedDB schema + MobX state + sync engine skeleton).  
**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [x] T011 Define IndexedDB store names, versions, and indexes in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/schema.ts`
- [x] T012 Implement IndexedDB open/upgrade logic (migrations) in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/db.ts`
- [x] T013 [P] Implement typed repository helpers (get/put/bulkPut/query/paginate) in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/repo.ts`
- [x] T014 [P] Define local-first domain types (replica meta, outbox tx, queue items, conflict entries, sync cursors) in `/Users/dexteresc/Dev/tether/frontend/src/lib/sync/types.ts`
- [x] T015 [P] Implement storage quota + LRU candidate selection utilities in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/quota.ts`
- [x] T016 Create MobX RootStore and React provider wiring in `/Users/dexteresc/Dev/tether/frontend/src/stores/RootStore.ts`
- [x] T017 [P] Implement AuthStore (Supabase session, sign-in/out, token retrieval) in `/Users/dexteresc/Dev/tether/frontend/src/stores/AuthStore.ts`
- [x] T018 [P] Implement combined AuthPage (sign-in/sign-up toggle) in `/Users/dexteresc/Dev/tether/frontend/src/pages/AuthPage.tsx`
- [x] T019 [P] Implement RequireAuth route wrapper (redirect unauthenticated users to `/auth`) in `/Users/dexteresc/Dev/tether/frontend/src/routes/RequireAuth.tsx`
- [x] T020 Wire `/auth` route and protect all data/NL routes using RequireAuth in `/Users/dexteresc/Dev/tether/frontend/src/App.tsx`
- [ ] T021 [P] Add unit tests for AuthStore session/token behavior in `/Users/dexteresc/Dev/tether/frontend/src/stores/__tests__/AuthStore.test.ts`
- [x] T022 [P] Implement SyncStatusStore (online/offline, last sync, progress, errors) in `/Users/dexteresc/Dev/tether/frontend/src/stores/SyncStatusStore.ts`
- [x] T023 [P] Implement ReplicaStore (per-table cache + selectors for pagination/search/filter) in `/Users/dexteresc/Dev/tether/frontend/src/stores/ReplicaStore.ts`
- [x] T024 [P] Implement OutboxStore (ordered durable tx queue + status transitions) in `/Users/dexteresc/Dev/tether/frontend/src/stores/OutboxStore.ts`
- [x] T025 [P] Implement NLQueueStore (durable NL input queue + staged extraction refs) in `/Users/dexteresc/Dev/tether/frontend/src/stores/NLQueueStore.ts`
- [x] T026 [P] Implement ConflictStore (durable conflicts + reapply) in `/Users/dexteresc/Dev/tether/frontend/src/stores/ConflictStore.ts`
- [x] T027 [P] Implement Instant Local Commit helpers (atomic replica write + outbox enqueue) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/localCommit.ts`
- [x] T028 Implement SyncEngine lifecycle (start/stop, timers, cancellation) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/SyncEngine.ts`
- [x] T029 [P] Implement Supabase "pull changes since cursor" per table (paging + tombstones) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/pull.ts`
- [x] T030 [P] Implement Outbox push/drain with optimistic concurrency (`base_updated_at`) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/push.ts`
- [x] T031 [P] Implement Supabase Realtime subscription handlers to apply row-change events into replica in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/realtime.ts`
- [x] T032 [P] Implement outbox confirmation/correlation (mark tx synced when server change observed) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/ack.ts`
- [x] T033 Implement sync orchestration (pull loop + realtime + periodic reconcile + ack) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/index.ts`
- [x] T034 Wire app startup: create RootStore, require auth, and start SyncEngine after login in `/Users/dexteresc/Dev/tether/frontend/src/main.tsx`
- [x] T035 [P] Implement shared UI shell + navigation + sync indicator component in `/Users/dexteresc/Dev/tether/frontend/src/components/AppShell.tsx`
- [ ] T036 [P] Add foundational tests: IDB migration + outbox durability in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/__tests__/db.test.ts`
- [ ] T037 [P] Add unit tests for Instant Local Commit atomicity in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/__tests__/localCommit.test.ts`
- [ ] T038 [P] Add unit tests for pull cursors + tombstones in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/__tests__/pull.test.ts`
- [ ] T039 [P] Add unit tests for push drain + conflict precondition failures in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/__tests__/push.test.ts`
- [ ] T040 [P] Add unit tests for realtime apply + ack correlation in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/__tests__/realtime.test.ts`
- [ ] T041 [P] Add unit tests for SyncEngine offline→online resume and reconcile scheduling in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/__tests__/SyncEngine.test.ts`

**Checkpoint**: Foundation ready — user stories can now proceed in parallel.

---

## Phase 3: User Story 1 — View All Intelligence Data with Instant Local Access (Priority: P1) 🎯 MVP

**Goal**: Instant table views from IndexedDB (even offline) with progressive background sync and status indicator.  
**Independent Test**: Disconnect network and confirm cached tables render instantly; reconnect and confirm incremental updates appear without blocking.

- [x] T042 [P] [US1] Create a reusable paginated table component with configurable page size (default 50) backed by ReplicaStore (persist page size in IndexedDB `sync_state`) in `/Users/dexteresc/Dev/tether/frontend/src/components/TableView.tsx`
- [x] T043 [P] [US1] Implement Entities view (type, identifiers, created_at) in `/Users/dexteresc/Dev/tether/frontend/src/pages/EntitiesPage.tsx`
- [x] T044 [P] [US1] Implement identifier grouping UI by type in `/Users/dexteresc/Dev/tether/frontend/src/components/IdentifierGroups.tsx`
- [x] T045 [P] [US1] Implement Entity Detail page (shows grouped identifiers) in `/Users/dexteresc/Dev/tether/frontend/src/pages/EntityDetailPage.tsx`
- [x] T046 [US1] Wire EntitiesPage row click to EntityDetailPage route in `/Users/dexteresc/Dev/tether/frontend/src/pages/EntitiesPage.tsx`
- [x] T047 [P] [US1] Implement Intel view (occurred_at, type, confidence, source_id) in `/Users/dexteresc/Dev/tether/frontend/src/pages/IntelPage.tsx`
- [x] T048 [P] [US1] Implement Relations view (source/target/type/strength/valid dates) in `/Users/dexteresc/Dev/tether/frontend/src/pages/RelationsPage.tsx`
- [x] T049 [P] [US1] Implement Identifiers view (entity_id/type/value) in `/Users/dexteresc/Dev/tether/frontend/src/pages/IdentifiersPage.tsx`
- [x] T050 [P] [US1] Implement Sources view (code/type/reliability/active) in `/Users/dexteresc/Dev/tether/frontend/src/pages/SourcesPage.tsx`
- [x] T051 [P] [US1] Implement Intel↔Entity junction view in `/Users/dexteresc/Dev/tether/frontend/src/pages/IntelEntitiesPage.tsx`
- [x] T052 [US1] Add routes + nav links for all six table views plus Entity Detail route in `/Users/dexteresc/Dev/tether/frontend/src/App.tsx`
- [x] T053 [US1] Implement initial "empty cache" snapshot load (per-table paging) in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/pull.ts`
- [x] T054 [US1] Show progressive sync notifications (new/updated rows) without disrupting current page in `/Users/dexteresc/Dev/tether/frontend/src/components/SyncIndicator.tsx`
- [x] T055 [P] [US1] Add relationship graph visualization page using local cache in `/Users/dexteresc/Dev/tether/frontend/src/pages/GraphPage.tsx`
- [x] T056 [P] [US1] Add and pin `react-force-graph-2d` in `/Users/dexteresc/Dev/tether/frontend/package.json`

**Parallel example (US1)**:
```bash
Task: "Implement Entities view in /Users/dexteresc/Dev/tether/frontend/src/pages/EntitiesPage.tsx"
Task: "Implement Intel view in /Users/dexteresc/Dev/tether/frontend/src/pages/IntelPage.tsx"
Task: "Implement Relations view in /Users/dexteresc/Dev/tether/frontend/src/pages/RelationsPage.tsx"
```

---

## Phase 4: User Story 2 — Submit Natural Language Input with Sequential Processing (Priority: P1)

**Goal**: A durable, visible NL input queue processed strictly sequentially; extracted rows are editable and only accepted rows become outbox transactions.  
**Independent Test**: Submit multiple inputs quickly, verify processing order and queue statuses, edit/accept/reject rows, then commit and observe outbox → server sync.

- [x] T057 [P] [US2] Implement LLM service client using `VITE_LLM_SERVICE_URL` in `/Users/dexteresc/Dev/tether/frontend/src/services/llm/LlmClient.ts`
- [x] T058 [P] [US2] Define TypeScript response/request types aligned with `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/contracts/llm-service.openapi.yaml` in `/Users/dexteresc/Dev/tether/frontend/src/services/llm/types.ts`
- [x] T059 [US2] Build Natural Language Input page with queue panel + cancel actions in `/Users/dexteresc/Dev/tether/frontend/src/pages/NLInputPage.tsx`
- [x] T060 [US2] Implement NL queue processor (pending→processing→completed/failed) with strict sequential guarantee in `/Users/dexteresc/Dev/tether/frontend/src/stores/NLQueueStore.ts`
- [x] T061 [US2] Track extraction durations and compute per-item estimated wait time (moving average + queue position) in `/Users/dexteresc/Dev/tether/frontend/src/stores/NLQueueStore.ts`
- [x] T062 [US2] Display queue position + estimated wait time in `/Users/dexteresc/Dev/tether/frontend/src/pages/NLInputPage.tsx`
- [x] T063 [P] [US2] Add unit tests for estimate calculation + ordering in `/Users/dexteresc/Dev/tether/frontend/src/stores/__tests__/NLQueueStore.test.ts`
- [x] T064 [P] [US2] Implement staged extraction persistence helpers (staged_extractions store) in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/staged.ts`
- [x] T065 [P] [US2] Implement extraction→staged-row mapping (entities/relations/intel) in `/Users/dexteresc/Dev/tether/frontend/src/services/llm/mapping.ts`
- [x] T066 [P] [US2] Implement editable staged row UI (Accept/Edit/Reject) in `/Users/dexteresc/Dev/tether/frontend/src/components/StagedRowEditor.tsx`
- [x] T067 [US2] Validate edits against DB constraints (enum sets, strength 1–10, required fields) in `/Users/dexteresc/Dev/tether/frontend/src/services/validation/dbValidation.ts`
- [x] T068 [US2] Implement "Commit to Database" to convert accepted staged rows into outbox transactions in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/stagingToOutbox.ts`
- [x] T069 [US2] Implement extraction failure UX (retry, preserve text, keep queue position) in `/Users/dexteresc/Dev/tether/frontend/src/pages/NLInputPage.tsx`
- [x] T070 [P] [US2] Add unit tests for sequential processing + cancel semantics in `/Users/dexteresc/Dev/tether/frontend/src/stores/__tests__/NLQueueStore.test.ts`
- [x] T071 [P] [US2] Add a schema-compat smoke test using a fixture response for `/api/extract` in `/Users/dexteresc/Dev/tether/frontend/src/services/llm/__tests__/types.test.ts`

**Parallel example (US2)**:
```bash
Task: "Implement LLM service client in /Users/dexteresc/Dev/tether/frontend/src/services/llm/LlmClient.ts"
Task: "Implement extraction→staged-row mapping in /Users/dexteresc/Dev/tether/frontend/src/services/llm/mapping.ts"
Task: "Implement editable staged row UI in /Users/dexteresc/Dev/tether/frontend/src/components/StagedRowEditor.tsx"
```

---

## Phase 5: User Story 3 — Chain Multiple Natural Language Inputs with Context Preservation (Priority: P2)

**Goal**: Chained inputs preserve context (pronouns/refs), accumulate extractions locally, allow removing an input mid-chain, and commit all in one batch.  
**Independent Test**: Submit input A, then chained input B referencing A, remove B, and commit remaining accepted data as one batch.

- [ ] T072 [US3] Persist a “chain session” context string and derive next-request context in `/Users/dexteresc/Dev/tether/frontend/src/stores/NLQueueStore.ts`
- [ ] T073 [US3] Send `context` for chained inputs to the LLM service in `/Users/dexteresc/Dev/tether/frontend/src/services/llm/LlmClient.ts`
- [ ] T074 [US3] Add “Add Another Input” chain UX and keep prior results visible in `/Users/dexteresc/Dev/tether/frontend/src/pages/NLInputPage.tsx`
- [ ] T075 [P] [US3] Display origin labels (“From input #n”) for staged rows in `/Users/dexteresc/Dev/tether/frontend/src/components/StagedRowEditor.tsx`
- [ ] T076 [US3] Implement removing a chain item and cascading deletion of its staged rows in `/Users/dexteresc/Dev/tether/frontend/src/stores/NLQueueStore.ts`
- [ ] T077 [US3] Implement “Commit All to Database” batching marker so the outbox can display one batch summary in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/stagingToOutbox.ts`
- [ ] T078 [P] [US3] Add unit tests for chaining context and mid-chain removal in `/Users/dexteresc/Dev/tether/frontend/src/stores/__tests__/NLQueueStore.test.ts`

**Parallel example (US3)**:
```bash
Task: "Send context for chained inputs in /Users/dexteresc/Dev/tether/frontend/src/services/llm/LlmClient.ts"
Task: "Display staged row origin labels in /Users/dexteresc/Dev/tether/frontend/src/components/StagedRowEditor.tsx"
```

---

## Phase 6: User Story 4 — Work Offline with Full Functionality (Priority: P2)

**Goal**: Full offline operation: reads from cache, writes queue locally, NL inputs queue without extraction when offline, and everything resumes automatically on reconnect with conflict handling.  
**Independent Test**: Go offline, perform view + NL queue + edits + commits; reload; reconnect; verify sync drains and conflicts are logged.

- [ ] T079 [US4] Implement robust online/offline detection and propagate to UI in `/Users/dexteresc/Dev/tether/frontend/src/stores/SyncStatusStore.ts`
- [ ] T080 [US4] When offline, enqueue NL inputs as “Pending sync” without calling LLM in `/Users/dexteresc/Dev/tether/frontend/src/stores/NLQueueStore.ts`
- [ ] T081 [US4] On reconnect, automatically resume NL processing and outbox sync in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/SyncEngine.ts`
- [ ] T082 [P] [US4] Persist and restore uncommitted chain sessions (prompt user to restore) in `/Users/dexteresc/Dev/tether/frontend/src/pages/NLInputPage.tsx`
- [ ] T083 [P] [US4] Implement quota monitoring and LRU eviction of *synced-only* replica rows in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/quota.ts`
- [ ] T084 [US4] Ensure eviction never touches outbox, NL queue, staged rows, or conflict log in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/schema.ts`
- [ ] T085 [US4] Display offline banner and “will sync when online” statuses in `/Users/dexteresc/Dev/tether/frontend/src/components/SyncIndicator.tsx`
- [ ] T086 [P] [US4] Add unit tests for eviction safety rules (never evict dirty/outbox) in `/Users/dexteresc/Dev/tether/frontend/src/lib/idb/__tests__/quota.test.ts`

**Parallel example (US4)**:
```bash
Task: "Implement quota monitoring + LRU eviction in /Users/dexteresc/Dev/tether/frontend/src/lib/idb/quota.ts"
Task: "Implement restore prompt UX in /Users/dexteresc/Dev/tether/frontend/src/pages/NLInputPage.tsx"
```

---

## Phase 7: User Story 5 — Monitor and Manage Sync Status (Priority: P2)

**Goal**: A sync dashboard (connection, progress, pending counts, errors) plus a Conflict Review page with ability to re-apply local changes.  
**Independent Test**: Create pending changes, go offline, reconnect, verify dashboard transitions, then force a conflict and verify review + reapply.

- [ ] T087 [US5] Create sync dashboard page showing connection, last sync, progress, and outbox breakdown in `/Users/dexteresc/Dev/tether/frontend/src/pages/SyncDashboardPage.tsx`
- [ ] T088 [P] [US5] Implement outbox list component (status, retry, last error) in `/Users/dexteresc/Dev/tether/frontend/src/components/OutboxList.tsx`
- [ ] T089 [US5] Implement conflict creation helpers for push precondition failures in `/Users/dexteresc/Dev/tether/frontend/src/services/sync/conflicts.ts`
- [ ] T090 [US5] Create Conflict Review page backed by ConflictStore in `/Users/dexteresc/Dev/tether/frontend/src/pages/ConflictReviewPage.tsx`
- [ ] T091 [US5] Implement “re-apply my changes” to generate a new outbox tx from conflict local_row in `/Users/dexteresc/Dev/tether/frontend/src/stores/ConflictStore.ts`
- [ ] T092 [US5] Add conflict notifications and deep link to Conflict Review in `/Users/dexteresc/Dev/tether/frontend/src/components/SyncIndicator.tsx`
- [ ] T093 [P] [US5] Add unit tests for conflict write + reapply behavior in `/Users/dexteresc/Dev/tether/frontend/src/stores/__tests__/ConflictStore.test.ts`

**Parallel example (US5)**:
```bash
Task: "Implement conflict helpers in /Users/dexteresc/Dev/tether/frontend/src/services/sync/conflicts.ts"
Task: "Implement outbox list component in /Users/dexteresc/Dev/tether/frontend/src/components/OutboxList.tsx"
```

---

## Phase 8: User Story 6 — Filter and Search Data Tables (Priority: P3)

**Goal**: Instant local filtering/search (sub-200ms) against IndexedDB for large datasets.  
**Independent Test**: Populate diverse local cache data, apply filters/search, and verify correct results and snappy performance.

- [ ] T094 [P] [US6] Implement local query operators (filter/sort/search/paginate) in `/Users/dexteresc/Dev/tether/frontend/src/stores/ReplicaStore.ts`
- [ ] T095 [P] [US6] Add Entities type filter UI wired to local query in `/Users/dexteresc/Dev/tether/frontend/src/pages/EntitiesPage.tsx`
- [ ] T096 [P] [US6] Add Intel confidence + date range filter UI wired to local query in `/Users/dexteresc/Dev/tether/frontend/src/pages/IntelPage.tsx`
- [ ] T097 [P] [US6] Add Relations type filter UI wired to local query in `/Users/dexteresc/Dev/tether/frontend/src/pages/RelationsPage.tsx`
- [ ] T098 [US6] Add shared search box (per-table visible fields) in `/Users/dexteresc/Dev/tether/frontend/src/components/SearchBox.tsx`
- [ ] T099 [P] [US6] Add query performance instrumentation (timings + p95) in `/Users/dexteresc/Dev/tether/frontend/src/lib/perf.ts`
- [ ] T100 [P] [US6] Add unit tests for query correctness (filters + search) in `/Users/dexteresc/Dev/tether/frontend/src/stores/__tests__/ReplicaStore.test.ts`

**Parallel example (US6)**:
```bash
Task: "Add Entities filters in /Users/dexteresc/Dev/tether/frontend/src/pages/EntitiesPage.tsx"
Task: "Add Intel filters in /Users/dexteresc/Dev/tether/frontend/src/pages/IntelPage.tsx"
Task: "Add Relations filters in /Users/dexteresc/Dev/tether/frontend/src/pages/RelationsPage.tsx"
```

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, hardening, and documentation after core stories land.

- [ ] T101 [P] Remove or refactor superseded React Query hooks so the build only uses the MobX + IDB path in `/Users/dexteresc/Dev/tether/frontend/src/hooks/`
- [ ] T102 Ensure env-only configuration (no hardcoded URLs/keys) and document all required vars in `/Users/dexteresc/Dev/tether/frontend/.env.example`
- [ ] T103 Run the manual sanity checks (including RLS verification and pagination page-size config) and update wording/steps in `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/quickstart.md`
- [ ] T104 [P] Improve UX/accessibility for tables and forms (keyboard focus, labels, empty states) in `/Users/dexteresc/Dev/tether/frontend/src/components/`
- [ ] T105 Add a final “happy path” smoke walkthrough doc section in `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **User Stories** → **Polish**

### User Story Dependencies (Recommended)

- **[US1] P1**: Depends on Phase 2 only (MVP)
- **[US2] P1**: Depends on Phase 2 only
- **[US3] P2**: Depends on [US2]
- **[US4] P2**: Depends on Phase 2; enhances [US1] + [US2] and should follow them for best feedback loops
- **[US5] P2**: Depends on Phase 2; best after [US4] so offline/conflict flows are real
- **[US6] P3**: Depends on [US1] (table views) and Phase 2 (query engine)

### Dependency Graph (User Story Order)

```text
Phase 1 (Setup) → Phase 2 (Foundational)
Phase 2 → US1
Phase 2 → US2 → US3
Phase 2 → US4 → US5
US1 → US6
```

### Parallel Opportunities (After Phase 2)

- [US1] table pages can be built in parallel in `/Users/dexteresc/Dev/tether/frontend/src/pages/` (Entities/Intel/Relations/Identifiers/Sources/IntelEntities)
- [US2] LLM client/mapping/editor can be built in parallel across `/Users/dexteresc/Dev/tether/frontend/src/services/llm/` and `/Users/dexteresc/Dev/tether/frontend/src/components/StagedRowEditor.tsx`
- [US6] filter UIs can be built in parallel across the per-table page files in `/Users/dexteresc/Dev/tether/frontend/src/pages/`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks all stories)
3. Complete Phase 3: [US1]
4. Validate [US1] independent test (offline read + background sync)

### Incremental Delivery

1. Add [US2] for NL input queue + review/commit
2. Add [US3] chaining (context + remove + batch commit)
3. Add [US4] offline hardening (resume + quota/LRU)
4. Add [US5] sync dashboard + conflict review/reapply
5. Add [US6] filter/search performance features
