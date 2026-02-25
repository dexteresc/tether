# Model Overhaul

Branch: `model-overhaul`

## Goal

Evolve Tether from a basic entity/relation tracker into a richer intelligence platform with structured attributes, sensitivity controls, geospatial capabilities, and graph traversal — while hardening the frontend codebase for long-term maintainability.

## What changed

### Data model expansion

**New tables:**
- `entity_attributes` — EAV-style structured attributes (employer, DOB, nationality, etc.) with per-entity-type definitions
- `tags` / `record_tags` — flexible tagging system with categories (topic, geographic, project, personal)

**Expanded domain types:**
- Entity types: added `event`, `project`, `asset` (removed `vehicle`)
- Relation types: 23 total (added `mentor`, `works_at`, `lives_in`, `invested_in`, `attended`, `visited`, `knows`, etc.)
- Intel types: added `note`, `tip`
- Identifier types: added `alias`, `website`, `account_id`

**Sensitivity & access control:**
- Four levels: `open` → `internal` → `confidential` → `restricted`
- Row-level security via `user_can_see()` function
- `user_access_levels` table for per-user clearance

### Geospatial & search

- PostGIS geometry columns on entities/intel with auto-population from `data.lat/lng`
- `find_entities_near()` / `find_intel_near()` — proximity search RPCs
- Full-text search on intel via `tsvector` + `websearch`
- Trigram fuzzy search on identifiers via `pg_trgm`
- Geocoding-based location search (Nominatim) replacing manual lat/lng pin input

### Graph traversal

- `get_entity_graph_v2()` — cycle-safe BFS with depth, relation type filters, min strength
- `find_shortest_path()` — BFS shortest path between two entities
- `entity_connection_counts` view for quick degree counts
- Interactive force graph with expand-on-click, type/relation filters, strength slider
- Path Finder page for discovering connections between entities

### LLM service updates

- Extraction enums aligned with expanded domain types
- Supabase sync updated for new tables and attribute upserts
- CORS for dev port 5174

### Frontend quality

- Zero `eslint-disable` comments, zero `any`, zero build warnings
- Strict TypeScript rules enforced (no `as` casts, prefer `undefined` over `null`)
- Hooks split from components for react-refresh compliance
- IDB repo rewritten with proper `idb` library generics
- Sync layer (push/pull/outbox) fully typed without escape hatches
