# Tether Development Guidelines

Auto-generated from all feature plans. Last updated: 2024-12-22

## Active Technologies
- Python 3.13 + FastAPI 0.109.0, Instructor 1.0.0, Supabase >=2.25.1, Pydantic (via FastAPI), RapidFuzz 3.14.3 (003-context-aware-entity-resolution)
- PostgreSQL via Supabase (entities, identifiers, intel tables) (003-context-aware-entity-resolution)

- **Python 3.11+**: FastAPI, Instructor 1.0.0, OpenAI SDK, Supabase Python client, Pydantic
- **Go**: Backend API handlers, models, services
- **React + TypeScript**: Frontend with Vite
- **Supabase**: PostgreSQL database with RLS

## Project Structure

```text
.
├── llm-service/          # Python NLP extraction service
│   ├── app/
│   │   ├── models/       # Pydantic schemas
│   │   ├── services/     # Business logic (LLM, extraction, sync)
│   │   └── routes/       # FastAPI endpoints
│   └── tests/
├── frontend/             # React + TypeScript + Vite
├── handlers/             # Go API handlers
├── models/               # Go data models
├── services/             # Go services
├── supabase/
│   └── migrations/       # SQL migrations
└── specs/                # Feature specifications
```

## Commands

```bash
# LLM Service
cd llm-service && uvicorn app.main:app --reload --port 8000
cd llm-service && pytest tests/ -v
cd llm-service && ruff check .

# Frontend
cd frontend && npm run dev
cd frontend && npm run lint

# Supabase
supabase start
supabase db reset
supabase migration new <name>
```

## Code Style

- **Python**: Ruff for linting, type hints required, Pydantic for schemas
- **TypeScript**: ESLint + Prettier, strict mode
- **Go**: Standard library conventions, minimal dependencies

## Recent Changes
- 003-context-aware-entity-resolution: Added Python 3.13 + FastAPI 0.109.0, Instructor 1.0.0, Supabase >=2.25.1, Pydantic (via FastAPI), RapidFuzz 3.14.3

- 001-instructor-nlp-extraction: NLP extraction with Instructor, Fact Update vs Event Log classification

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
