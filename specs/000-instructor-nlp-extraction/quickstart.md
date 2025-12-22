# Quickstart: NLP Extraction with Instructor

## Prerequisites

- Python 3.11+
- Docker (for Supabase)
- OpenAI API key OR Ollama installed locally

## Setup

### 1. Start Supabase

```bash
cd /Users/dexteresc/Dev/tether
supabase start
```

### 2. Configure Environment

Copy and edit the environment file:

```bash
cp .env.example llm-service/.env
```

Edit `llm-service/.env`:

```bash
# For OpenAI (default)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=your-key-here

# OR for local Ollama
# LLM_PROVIDER=ollama
# LLM_MODEL=llama3.2
# OLLAMA_BASE_URL=http://localhost:11434/v1

# Supabase (from `supabase status`)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

### 3. Install Dependencies

```bash
cd llm-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the Service

```bash
uvicorn app.main:app --reload --port 8000
```

## Usage Examples

### Extract a Fact Update (Person Data)

```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Smith works at Acme Corp. His email is john@acme.com",
    "sync_to_db": true
  }'
```

Expected response:
```json
{
  "classification": "fact_update",
  "chain_of_thought": "Identified John Smith (person) with email identifier...",
  "extraction": { ... },
  "sync_results": {
    "entities_created": [{"name": "John Smith", "type": "person"}],
    "entities_updated": [],
    ...
  }
}
```

### Extract an Event Log (Interaction)

```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Called John yesterday to discuss the project proposal",
    "sync_to_db": true
  }'
```

Expected response:
```json
{
  "classification": "event_log",
  "chain_of_thought": "Identified communication event with John...",
  "extraction": { ... },
  "sync_results": {
    "intel_created": [{"type": "communication", "description": "..."}],
    ...
  }
}
```

### Extract Mixed Content

```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Met Sarah (sarah@tech.co) at the conference in NYC yesterday",
    "sync_to_db": true
  }'
```

Expected response:
```json
{
  "classification": "mixed",
  "chain_of_thought": "Identified Sarah (person) with email, and event at conference...",
  ...
}
```

## Switching LLM Providers

### Switch to Ollama

1. Install Ollama and pull a model:
   ```bash
   ollama pull llama3.2
   ```

2. Update `llm-service/.env`:
   ```bash
   LLM_PROVIDER=ollama
   LLM_MODEL=llama3.2
   ```

3. Restart the service (no code changes needed)

### Switch back to OpenAI

Update `llm-service/.env`:
```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
```

## Running Tests

```bash
cd llm-service
pytest tests/ -v
```

## Verification Checklist

- [ ] Service starts without errors
- [ ] Health endpoint returns provider info: `curl http://localhost:8000/health`
- [ ] Fact update extracts and syncs entity
- [ ] Event log extracts and syncs intel
- [ ] Mixed content classified correctly
- [ ] chain_of_thought populated in all responses
- [ ] Provider switch works via environment variables
