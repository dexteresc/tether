.PHONY: backend supabase llm frontend

backend:
	go run main.go

supabase:
	supabase start

llm:
	cd llm-service && uvicorn app.main:app --reload --port 8000

frontend:
	cd web && npm run dev
