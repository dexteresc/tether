# tether Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-23

## Active Technologies

- Frontend: TypeScript 5.9 + React 19 (Vite 7); Backend: Go 1.24.3 (Gin); LLM Service: Python 3.11 (FastAPI) + Supabase (DB + Auth + Realtime), IndexedDB (local replica), MobX (frontend app/sync state), llm-service (/api/extract, /api/ws/extract) (002-frontend-data-viz)

## Project Structure

```text
/Users/dexteresc/Dev/tether/
├── frontend/                 # React + TypeScript + Vite
├── handlers/                 # Go (Gin) REST handlers
├── models/                   # Go models
├── services/                 # Go services
├── llm-service/              # Python FastAPI extraction service
├── supabase/                 # DB schema + RLS policies + triggers
└── specs/                    # Feature specs + plans
```

## Commands

- Backend (Go): `go test ./...`, `go run ./main.go`
- Frontend (Vite): `cd frontend && npm install && npm run dev`, `cd frontend && npm run build`, `cd frontend && npm run lint`
- LLM service (Python): `cd llm-service && ./run_tests.sh`
- Local Supabase: `supabase start`, `supabase db reset`

## Code Style

Frontend: TypeScript 5.9 + React 19 (Vite 7); Backend: Go 1.24.3 (Gin); LLM Service: Python 3.11 (FastAPI): Follow standard conventions

## Recent Changes

- 002-frontend-data-viz: Added Frontend: TypeScript 5.9 + React 19 (Vite 7); Backend: Go 1.24.3 (Gin); LLM Service: Python 3.11 (FastAPI) + Supabase (DB + Auth + Realtime), IndexedDB (local replica), MobX (frontend app/sync state), llm-service (/api/extract, /api/ws/extract)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
