# Phase 1 Design: Data Model (Remote + Local‑First)

This document describes the data model required to implement the local‑first sync engine for `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`.

## Remote Source of Truth (Supabase Postgres)

Remote tables to replicate to the browser (FR-001). Column definitions come from `/Users/dexteresc/Dev/tether/supabase/migrations/20251210231246_create_core_tables.sql`.

### `sources`

- Fields: `id (uuid)`, `code`, `type`, `reliability`, `data (jsonb)`, `active`, `created_at`, `updated_at`, `deleted_at`
- Notes: Used for intel provenance; soft-delete via `deleted_at`.

### `entities`

- Fields: `id (uuid)`, `type`, `data (jsonb)`, `created_at`, `updated_at`, `deleted_at`
- Notes: RLS ties ownership via `data.user_id` (`/Users/dexteresc/Dev/tether/supabase/migrations/20251210231722_enable_rls.sql`).

### `identifiers`

- Fields: `id (uuid)`, `entity_id (fk entities.id)`, `type`, `value`, `metadata (jsonb)`, `created_at`, `updated_at`, `deleted_at`

### `relations`

- Fields: `id (uuid)`, `source_id (fk entities.id)`, `target_id (fk entities.id)`, `type`, `strength`, `valid_from`, `valid_to`, `data (jsonb)`, `created_at`, `updated_at`, `deleted_at`

### `intel`

- Fields: `id (uuid)`, `type`, `occurred_at`, `data (jsonb)`, `source_id (fk sources.id nullable)`, `confidence`, `created_at`, `updated_at`, `deleted_at`

### `intel_entities`

- Fields: `id (uuid)`, `intel_id (fk intel.id)`, `entity_id (fk entities.id)`, `role`, `created_at`, `updated_at`, `deleted_at`
- Constraints: unique `(intel_id, entity_id)`

## Local Persistence (Browser IndexedDB)

IndexedDB is the durable “local replica” and stores:

1) Replica copies of all remote rows (for instant reads and offline operation)  
2) An outbox of pending transactions (for upstream sync)  
3) A natural language input queue (for sequential processing)  
4) A conflict log (for “server wins” resolution with recovery)  
5) Sync cursors + metrics (for progressive sync and status UI)

### Local Object Stores

#### 1) Replica Stores (one per remote table)

For each remote table `T ∈ {sources, entities, identifiers, relations, intel, intel_entities}` create an IndexedDB object store:

- Key: `id` (uuid string)
- Value: `T_row` plus local metadata fields:
  - `__meta.local_last_accessed_at (timestamptz)` (LRU support; updated on reads)
  - `__meta.local_dirty (boolean)` (true when modified locally and awaiting sync)
  - `__meta.local_deleted (boolean)` (true when locally soft-deleted and awaiting sync)
  - `__meta.base_updated_at (timestamptz | null)` (server `updated_at` when edit began; used for conflict detection)
  - `__meta.last_pulled_at (timestamptz | null)` (optional per-row tracking; primary cursor is per-table)

Validation rules (local):

- Must preserve server timestamps/fields (`created_at`, `updated_at`, `deleted_at`) as received.
- Local edits must enforce schema constraints for enums and numeric ranges (e.g., relation `strength` 1–10; entity `type` in allowed list).

LRU eviction policy:

- Only rows with `__meta.local_dirty == false` and `deleted_at IS NULL` are eligible for eviction.
- Evict least-recently-accessed rows when quota pressure is detected, never evicting outbox/queue/conflict stores.

#### 2) `outbox_transactions`

An ordered queue of locally-committed changes awaiting upstream sync (FR-009/FR-010).

- Key: `tx_id` (uuid)
- Fields:
  - `tx_id (uuid)`
  - `created_at (timestamptz)`
  - `table` (`"sources" | "entities" | "identifiers" | "relations" | "intel" | "intel_entities"`)
  - `op` (`"insert" | "update" | "delete"`)
  - `record_id (uuid)` (target row)
  - `payload (json)` (the row fields needed for the operation)
  - `base_updated_at (timestamptz | null)` (required for updates/deletes; null for inserts)
  - `status` (`"pending" | "syncing" | "synced" | "error" | "canceled"`)
  - `attempt_count (int)`
  - `last_error (string | null)`
  - `next_retry_at (timestamptz | null)`
  - `synced_at (timestamptz | null)`

State transitions:

- `pending → syncing → synced`
- `pending|syncing → error → pending` (manual or auto retry with backoff)
- `pending → canceled` (user cancels before sync)

#### Outbox Confirmation (Ack) Correlation

Purpose: implement FR-034 (“Confirmation Loop”) deterministically when using Supabase Realtime row-change events.

Correlation rule (per `outbox_transactions` entry):

- Inserts:
  - Client assigns `record_id` (UUID) at local commit time and uses that ID in the server insert.
  - The first observed server row-change event for `(table, record_id)` confirms the insert and can mark the tx as `synced`.
- Updates:
  - Tx stores `base_updated_at` from the replica’s last known server `updated_at` at edit time.
  - A server row-change event for `(table, record_id)` confirms the update if `updated_at > base_updated_at`.
- Deletes (soft delete via `deleted_at`):
  - A server row-change event for `(table, record_id)` confirms the delete if `deleted_at != null` and `updated_at > base_updated_at`.

Notes:

- Realtime events are not guaranteed (disconnects), so the periodic pull reconcile remains authoritative for eventual convergence.
- If the push call returns the updated row, the client may mark the tx `synced` immediately and treat Realtime as redundant confirmation; `ack.ts` should be tolerant to “already synced” txs.

#### 3) `nl_input_queue`

Durable queue for natural language inputs (FR-003/FR-004/FR-007/FR-020).

- Key: `input_id` (uuid)
- Fields:
  - `input_id (uuid)`
  - `created_at (timestamptz)`
  - `text (string)`
  - `context (string | null)` (thread context for chaining)
  - `status` (`"pending" | "processing" | "completed" | "failed" | "canceled"`)
  - `position (int)` (derived from queue order; not required if the store order is authoritative)
  - `estimated_seconds (int | null)` (derived from moving average duration)
  - `result (json | null)` (LLM extraction payload for UI review/edit)
  - `error (string | null)`
  - `updated_at (timestamptz)`

#### 4) `staged_extractions`

Locally-staged “extracted rows” awaiting accept/edit/reject (FR-005/FR-006).

- Key: `staged_id` (uuid)
- Fields:
  - `staged_id (uuid)`
  - `created_at (timestamptz)`
  - `input_id (uuid)` (fk to `nl_input_queue.input_id`)
  - `table` (target table for the staged row)
  - `proposed_row (json)` (editable)
  - `status` (`"proposed" | "accepted" | "rejected" | "edited"`)
  - `validation_errors (json | null)`

When a staged row becomes `accepted|edited`, the UI converts it into one or more `outbox_transactions`.

#### 5) `conflict_log`

Lossless record of conflicts (FR-023/FR-025).

- Key: `conflict_id` (uuid)
- Fields:
  - `conflict_id (uuid)`
  - `created_at (timestamptz)`
  - `table`, `record_id (uuid)`
  - `server_row (json)` (winner)
  - `local_row (json)` (overwritten)
  - `reason` (`"update_precondition_failed" | "deleted_on_server" | "other"`)
  - `status` (`"pending_review" | "manually_resolved" | "dismissed"`)
  - `note (string | null)`

#### 6) `sync_state`

Per-table cursors and global sync UI state (FR-021/FR-022/FR-026).

- Key: `key` (string) — e.g., `"entities.cursor"`, `"global.last_sync_at"`
- Fields:
  - `key (string)`
  - `value (json)`
  - `updated_at (timestamptz)`

Recommended keys:

- `global.connection_status` (`"online" | "offline" | "unknown"`)
- `global.last_sync_at` (timestamp)
- `table.<name>.cursor_updated_at` (timestamp)
- `global.avg_extraction_ms` (number; for FR-027 estimates)

## Store Relationships (Conceptual)

- `entities 1—N identifiers` via `identifiers.entity_id`
- `entities N—N intel` via `intel_entities (intel_id, entity_id)`
- `entities 1—N relations` where entity is `source_id` or `target_id`
- `nl_input_queue 1—N staged_extractions` via `staged_extractions.input_id`
- `outbox_transactions` target replica rows by `(table, record_id)`
- `conflict_log` targets replica rows by `(table, record_id)`
