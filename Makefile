.PHONY: all backend supabase llm frontend

all: supabase backend llm frontend

backend:
	go run main.go

supabase:
	supabase start

llm:
	cd llm-service && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd web && npm run dev
