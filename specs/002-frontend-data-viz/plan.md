# Implementation Plan: Frontend Data Visualization & Natural Language Input (Local‑First)

**Branch**: `002-frontend-data-viz` | **Date**: 2025-12-22 | **Spec**: `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`  
**Input**: Feature specification from `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a local‑first web app that (1) keeps an IndexedDB replica of six Supabase tables for instant reads and offline capability, (2) persists writes to a durable outbox and syncs bidirectionally in the background with conflict logging, and (3) supports a natural‑language input queue processed sequentially via the existing `llm-service`, letting users accept/edit/reject extracted rows before they enter the sync outbox.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Frontend: TypeScript 5.9 + React 19 (Vite 7); Backend: Go 1.24.3 (Gin); LLM Service: Python 3.11 (FastAPI)  
**Primary Dependencies**: Supabase (DB + Auth + Realtime), IndexedDB (local replica), MobX (frontend app/sync state), llm-service (/api/extract, /api/ws/extract)  
**Storage**: Supabase Postgres (remote source of truth) + browser IndexedDB (replica + outbox + queues + conflict log)  
**Testing**: `llm-service`: pytest + VCR; Frontend sync engine: Vitest + `fake-indexeddb`; Go API: `go test` (planned)  
**Target Platform**: Modern browsers (Chrome/Firefox/Safari/Edge, last 2 versions)  
**Project Type**: Web application (frontend + backend + llm-service + Supabase)  
**Performance Goals**: Local reads p95 < 200ms for filtered lists; initial interactivity < 2s; sync batch upload (<=50 tx) < 10s on good network  
**Constraints**: Offline‑capable, eventual consistency; background progressive sync; sequential NL processing; storage quota management with LRU eviction of synced data only  
**Scale/Scope**: Up to ~10k records across replicated tables; outbox up to ~1k pending tx; NL queue visible and resumable after reload

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with [Tether Constitution](../../.specify/memory/constitution.md):

- [x] **Type-First Development**: All components use strict type checking (Pydantic/TypeScript strict/Go stdlib types)
- [x] **Minimal Dependencies**: New dependencies justified and pinned to specific versions
- [x] **Test Coverage**: Critical paths have tests (LLM extraction, DB sync, API contracts, auth flows)
- [x] **Architecture Boundaries**: No cross-service imports, services communicate via API contracts
- [x] **Environment Configuration**: All runtime config uses environment variables, no hardcoded secrets

**Gate Evaluation (Pre‑Phase 0)**: PASS (plan requires strict typing, explicit dependency justification, and tests for sync engine/outbox; also requires removing hardcoded frontend Supabase defaults during implementation).

## Dependency Justification (Constitution: Minimal Dependencies)

Frontend dependencies added for this feature (all pinned via `/Users/dexteresc/Dev/tether/frontend/package-lock.json`):

- `mobx` + `mobx-react-lite`: Long-lived app state + computed derivations for replica/outbox/NL queue + background sync orchestration.
- `idb`: Thin IndexedDB wrapper to reduce boilerplate while preserving explicit transactions/migrations (avoids heavier ORMs).
- `react-router-dom`: Route-level separation for tables, NL input, sync dashboard, conflict review, and entity detail, with auth gating.
- `vitest` + `jsdom` + `fake-indexeddb`: Deterministic unit tests for critical sync paths (constitution requires tests for DB sync + auth).
- `react-force-graph-2d`: Relationship visualization requirement (graph view from local cache).

## Design Notes

- **Outbox Confirmation / Ack Correlation**: See `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/data-model.md` (section “Outbox Confirmation (Ack) Correlation”) for the deterministic rule used by `/Users/dexteresc/Dev/tether/frontend/src/services/sync/ack.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/002-frontend-data-viz/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
/Users/dexteresc/Dev/tether/
├── frontend/                 # React + TypeScript + Vite (local-first UI)
│   └── src/
├── handlers/                 # Go (Gin) REST handlers
├── models/                   # Go models
├── services/                 # Go services
├── llm-service/              # Python FastAPI extraction service
├── supabase/                 # DB schema + RLS policies + triggers
└── specs/                    # Feature specs + plans
```

**Structure Decision**: Use `/Users/dexteresc/Dev/tether/frontend/` as the canonical web app root. Archive the abandoned scaffold by moving `/Users/dexteresc/Dev/tether/frontend/frontend/` to `/Users/dexteresc/Dev/tether/frontend/_legacy_scaffold/` to avoid confusion during implementation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research (Output: `research.md`)

Scope: sync engine + state management for a local‑first frontend.

- Choose the client‑side state model for (a) replicated tables, (b) outbox queue, (c) NL input queue, and (d) sync status/progress.
- Choose the local persistence approach for IndexedDB (raw vs wrapper) and how to keep in‑memory state consistent with disk.
- Choose the sync protocol over Supabase (pull cursors + Realtime, optimistic writes, conflict handling) and specify failure modes.

## Phase 1: Design (Outputs: `data-model.md`, `contracts/`, `quickstart.md`)

Design deliverables:

- Data model for local replica (tables + metadata), outbox transactions, NL input queue, conflict log, and sync cursors.
- API contracts for LLM extraction + a Sync Gateway abstraction (even if the first implementation uses Supabase client calls directly).
- Quickstart steps for running Supabase + `llm-service` + frontend locally with required env vars.

## Phase 2: Implementation Planning (Stop After Planning)

Planned workstreams (no code changes in this phase):

- Frontend sync engine: local commit, outbox persistence, push/pull loops, Realtime subscription, retry/backoff, cursor persistence.
- Frontend state management: MobX stores (replica + outbox + NL queue + sync status) with type‑safe actions/selectors.
- Conflict workflow: detect conflicts via optimistic concurrency, persist conflict log, expose Conflict Review page design.
- Testing strategy: deterministic unit tests for sync engine (IDB + network stubs), plus contract tests for LLM extraction schema.

**Constitution Re-check (Post‑Phase 1 Design)**: PASS (see `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/research.md`, `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/data-model.md`, and `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/contracts/`).
