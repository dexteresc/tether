# Phase 0 Research: Sync Engine & State Management (Local‑First)

This research resolves all “NEEDS CLARIFICATION” items for the local‑first sync engine and frontend state management described in `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`.

## Technical Context Unknowns → Resolutions

- Decision: Support baseline runtime of Node.js 20 LTS (dev/build) and modern evergreen browsers (last 2 versions).
  - Rationale: Aligns with modern toolchains (Vite/TS) and IndexedDB support; avoids legacy polyfills.
  - Alternatives considered: Node 18 (older LTS); “any Node” (increases support variance).

## Decisions

### 1) Client‑side State Management: MobX Stores + IndexedDB as Source of Truth

- Decision: Use MobX (`mobx` + `mobx-react-lite`) for app state (replica cache, outbox, NL queue, sync status) with IndexedDB as the durable source of truth.
  - Rationale: The feature requires long‑lived, cross‑screen state with transactional updates, derived views, and background processes; MobX’s observable maps + computed selectors map naturally to replicated tables and queues.
  - Alternatives considered:
    - React Context + `useReducer`: workable but becomes boilerplate-heavy for multiple stores and background sync coordination.
    - React Query: optimized for server-cache patterns; does not solve durable offline outbox + IndexedDB-first reads without substantial customization.
    - Zustand: lighter than Redux, but MobX’s computed/observable graphs are a strong fit for a sync engine.

### 2) IndexedDB Access Layer: Lightweight Wrapper (`idb`) + Typed Store Interfaces

- Decision: Use a minimal IndexedDB wrapper (recommended: `idb`) and define a small typed repository layer per local store (tables, outbox, NL queue, conflicts).
  - Rationale: Avoids a heavy ORM while still keeping transactions, indexes, and upgrade logic ergonomic and type-safe.
  - Alternatives considered:
    - Raw IndexedDB: lowest dependency count but significantly more error-prone and verbose.
    - Dexie: powerful but larger surface area than needed for this feature.

### 3) Sync Protocol Over Supabase: Cursor Pull + Realtime Apply + Periodic Reconcile

- Decision: Implement bidirectional sync as:
  - Pull: per-table “changes since cursor” queries using `updated_at` (plus tombstones via `deleted_at`) with paging.
  - Downstream: Supabase Realtime subscriptions to apply server-side inserts/updates/deletes quickly.
  - Reconcile: periodic pull to recover from missed Realtime events and re-check integrity.
  - Rationale: Uses existing schema (`updated_at` triggers) and Supabase capabilities while preserving “instant local reads” and “progressive sync.”
  - Alternatives considered:
    - Custom server delta protocol: more control but higher implementation cost.
    - CRDT/OT: rejected by spec (last-write-wins acceptable; conflicts are “rare enough”).

### 4) Upstream Writes: Durable Outbox + Optimistic Concurrency Checks

- Decision: Model every user change as an ordered outbox transaction:
  - `insert`: local ID assigned immediately (UUID), persisted; server insert later.
  - `update`: persisted with `base_updated_at` (the server version the user edited), then sent with an “update-if-match” condition.
  - `delete`: soft delete (`deleted_at`) as a transaction.
  - Rationale: Enables offline operation, retry/backoff, progress reporting, and deterministic recovery after reload.
  - Alternatives considered:
    - Immediate server writes: breaks offline requirements.
    - “Sync everything on interval”: harder to guarantee ordering and user-visible status.

### 5) Conflict Handling: Server Wins + Conflict Log (Lossless)

- Decision: Detect conflicts by requiring `updated_at == base_updated_at` for updates; if the update affects 0 rows, treat as conflict:
  - Fetch server version, keep server version in replica, and write a conflict log entry containing both server and overwritten local values for later review.
  - Rationale: Matches spec (“server wins” + “save losing changes to conflict log”).
  - Alternatives considered:
    - Client wins: contradicts clarification.
    - Field-level merge: complexity not justified.

### 6) Natural Language Input Queue: Sequential Processing + Context Thread

- Decision: Persist NL inputs in a local queue and process strictly sequentially:
  - Call `llm-service` `/api/extract` with `sync_to_db=false` so the UI can present editable extracted rows.
  - Maintain a “chain context” string per queue session to satisfy “context preservation” across inputs.
  - Rationale: Matches FR-004/FR-007 and avoids server-side writes before user review.
  - Alternatives considered:
    - WebSocket streaming (`/api/ws/extract`): useful later for progress UI; not required for sequential correctness.
    - `sync_to_db=true`: violates review/accept requirements.

### 7) Dependency Hygiene + Version Pinning

- Decision: Any new frontend dependencies added for this feature must be justified (MobX + IndexedDB wrapper are justified by sync complexity) and pinned via `package-lock.json` updates.
  - Rationale: Matches constitution “Minimal Dependencies” requirement without blocking necessary functionality.
  - Alternatives considered: No new deps (increases risk/complexity in sync code).

## Outcomes (What This Enables)

- Instant reads from IndexedDB for all six tables with local filtering/search and paginated views.
- Offline writes that persist across reload/crash and sync later with user-visible status.
- Deterministic conflict detection and a lossless conflict review workflow.
- A sequential NL input pipeline that can be paused/resumed and supports chaining with context.
