# Tether

## Stack

- **Frontend**: React 19 + TypeScript + MobX + Vite + shadcn/ui (Radix)
- **LLM Service**: Python 3.13 + FastAPI + Instructor + Pydantic
- **Database**: Supabase (PostgreSQL with RLS)
- **Data**: IndexedDB (offline-first) + Supabase sync via outbox pattern

## Structure

```
llm-service/app/       # FastAPI routes, services, Pydantic models
web/src/               # React frontend
  components/          # UI components (shadcn/ui in ui/)
  pages/               # Page components
  stores/              # MobX stores
  services/            # LLM client, sync engine
  lib/                 # IDB, config, sync types
supabase/migrations/   # SQL migrations
```

## Commands

```bash
# LLM Service
cd llm-service && uvicorn app.main:app --reload --port 8000
cd llm-service && pytest tests/ -v
cd llm-service && ruff check .

# Web Frontend
cd web && npm run dev
cd web && npm run lint

# Supabase
supabase start
supabase db reset
supabase migration new <name>
```

## TypeScript Rules

- **No type assertions (`as`)**: Never use `as` to cast types. Use type guards, generics, or proper type narrowing instead. Only exception: `as const`.
- **No `any`**: Never use the `any` type. Use `unknown`, generics, or proper types instead.
- **No `eslint-disable`**: Never suppress lint errors with eslint-disable comments. Fix the underlying issue.
- **Prefer `undefined` over `null`**: Use `undefined` for absent values. Exceptions: Supabase schema fields (database convention); `React.createContext`; `JSON.stringify` replacer; Supabase `.is("field", null)` filters.

## Code Style

- **Python**: Ruff, type hints required, Pydantic for schemas
- **TypeScript**: ESLint + Prettier, strict mode
