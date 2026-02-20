# Quickstart: Local‑First Frontend + Sync Engine

This quickstart targets the feature in `/Users/dexteresc/Dev/tether/specs/002-frontend-data-viz/spec.md`.

## Prerequisites

- Node.js 20+ (for `/Users/dexteresc/Dev/tether/frontend/`)
- Docker (for `llm-service` via `/Users/dexteresc/Dev/tether/docker-compose.yml`)
- Supabase CLI (for local Supabase at `http://127.0.0.1:54321`)

## 1) Start Supabase (local)

From `/Users/dexteresc/Dev/tether/`:

- `supabase start`
- Apply schema (choose one):
  - `supabase db reset` (recreates DB + runs migrations)
  - or `supabase migration up`

## 2) Start `llm-service`

From `/Users/dexteresc/Dev/tether/`:

- `docker compose up llm-service`

Required env vars for `llm-service` (see `/Users/dexteresc/Dev/tether/docker-compose.yml`):

- `OPENAI_API_KEY` (if `LLM_PROVIDER=openai`)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

Health checks:

- `http://localhost:8000/health`
- `http://localhost:8000/api/health`

## 3) Start the frontend

From `/Users/dexteresc/Dev/tether/frontend/`:

- `npm install`
- `npm run dev`

Frontend env vars (Vite):

- `VITE_SUPABASE_URL` (default local: `http://127.0.0.1:54321`)
- `VITE_SUPABASE_ANON_KEY` (must be provided; do not hardcode fallbacks)
- `VITE_LLM_SERVICE_URL` (e.g., `http://localhost:8000`)

## 4) Manual sanity checks

- Disable network and verify cached table reads still work (IndexedDB replica).
- Create edits while offline and verify outbox persistence after reload.
- Re-enable network and verify background sync drains the outbox.
- Submit 2+ chained NL inputs and verify strict sequential processing + queue visibility.
- Verify Row Level Security (RLS): create two test users and confirm each user cannot see the other user’s rows in the table views (and that unauthorized reads fail when logged out).
- Verify pagination page size: change page size from default 50 and confirm it persists across reload.
