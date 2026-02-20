# Quickstart: Context-Aware Entity Resolution

**Feature**: 003-context-aware-entity-resolution
**Date**: 2024-12-24
**Estimated Setup Time**: 10 minutes

## Prerequisites

- Python 3.13 installed
- Supabase local instance running (`supabase start`)
- Existing llm-service setup (from feature 000-instructor-nlp-extraction)

---

## 1. Install Dependencies

From the `llm-service/` directory:

```bash
builtin cd llm-service

# Add RapidFuzz to requirements.txt
echo "rapidfuzz==3.14.3" >> requirements.txt

# Install dependencies
pip install -r requirements.txt
```

**Verify installation:**
```bash
python -c "from rapidfuzz.distance import JaroWinkler; print('RapidFuzz OK')"
# Expected output: RapidFuzz OK
```

---

## 2. Configure Environment Variables

Add to `llm-service/.env`:

```env
# Entity Resolution Configuration
FUZZY_MATCH_FIRST_NAME_THRESHOLD=0.8
FUZZY_MATCH_LAST_NAME_THRESHOLD=0.7
AUTO_RESOLVE_CONFIDENCE_THRESHOLD=0.8
ENTITY_CACHE_TTL_SECONDS=300

# Existing variables (ensure these are set)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=your-service-key-here
LLM_PROVIDER=openai
LLM_MODEL=gpt-4
OPENAI_API_KEY=your-key-here
```

---

## 3. Seed Test Data

Create test person entities in Supabase:

```bash
# From repo root
supabase db reset  # Resets to latest migrations

# Run seed script
python llm-service/scripts/seed_test_persons.py
```

**Or manually via SQL:**

```sql
-- Insert test persons
INSERT INTO entities (id, type, data) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'person', '{"company": "Acme Corp"}'),
  ('550e8400-e29b-41d4-a716-446655440002', 'person', '{"company": "TechCo"}'),
  ('550e8400-e29b-41d4-a716-446655440003', 'person', '{}');

INSERT INTO identifiers (entity_id, type, value) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'name', 'John Smith'),
  ('550e8400-e29b-41d4-a716-446655440001', 'name', 'John'),
  ('550e8400-e29b-41d4-a716-446655440001', 'email', 'john.smith@acme.com'),

  ('550e8400-e29b-41d4-a716-446655440002', 'name', 'John Doe'),
  ('550e8400-e29b-41d4-a716-446655440002', 'email', 'john.doe@techco.com'),

  ('550e8400-e29b-41d4-a716-446655440003', 'name', 'Timothy Jones'),
  ('550e8400-e29b-41d4-a716-446655440003', 'name', 'Timmy'),
  ('550e8400-e29b-41d4-a716-446655440003', 'email', 'timmy@example.com');
```

---

## 4. Start the LLM Service

```bash
builtin cd llm-service
uvicorn app.main:app --reload --port 8000
```

**Verify startup:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
=================================================
Tether Intelligence LLM Service
=================================================
LLM Provider: openai
LLM Model: gpt-4
Supabase URL: http://127.0.0.1:54321
=================================================
```

---

## 5. Test Entity Resolution

### Test 1: Unique Match (Auto-Resolve)

```bash
curl -X POST http://localhost:8000/api/extract/with-resolution \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Timmy ate a burger yesterday",
    "user_id": "test-user-id"
  }'
```

**Expected Response:**
```json
{
  "classification": "event_log",
  "entity_resolutions": [
    {
      "input_reference": "Timmy",
      "resolved": true,
      "resolved_entity_id": "550e8400-e29b-41d4-a716-446655440003",
      "confidence": 0.95,
      "resolution_method": "exact_match",
      "reasoning": "Found exact match for 'Timmy' in identifiers..."
    }
  ],
  "needs_clarification": false
}
```

### Test 2: Ambiguous Match (Needs Clarification)

```bash
curl -X POST http://localhost:8000/api/extract/with-resolution \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "John called me today",
    "user_id": "test-user-id"
  }'
```

**Expected Response:**
```json
{
  "classification": "event_log",
  "entity_resolutions": [
    {
      "input_reference": "John",
      "resolved": false,
      "ambiguous": true,
      "candidates": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "name": "John Smith",
          "company": "Acme Corp"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "John Doe",
          "company": "TechCo"
        }
      ]
    }
  ],
  "needs_clarification": true
}
```

### Test 3: Contextual Disambiguation

```bash
curl -X POST http://localhost:8000/api/extract/with-resolution \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "John from Acme Corp sent an email",
    "user_id": "test-user-id"
  }'
```

**Expected Response:**
```json
{
  "entity_resolutions": [
    {
      "input_reference": "John from Acme Corp",
      "resolved": true,
      "resolved_entity_id": "550e8400-e29b-41d4-a716-446655440001",
      "confidence": 0.9,
      "resolution_method": "contextual_match",
      "reasoning": "Matched 'John' with context 'Acme Corp' to company attribute"
    }
  ]
}
```

### Test 4: Fuzzy Matching

```bash
curl -X POST http://localhost:8000/api/extract/with-resolution \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Tim had lunch with me",
    "user_id": "test-user-id"
  }'
```

**Expected Response:**
```json
{
  "entity_resolutions": [
    {
      "input_reference": "Tim",
      "resolved": true,
      "resolved_entity_id": "550e8400-e29b-41d4-a716-446655440003",
      "confidence": 0.85,
      "resolution_method": "fuzzy_match",
      "reasoning": "Fuzzy matched 'Tim' to 'Timmy' (similarity: 0.85)",
      "match_details": {
        "fuzzy_scores": {"first_name": 0.85}
      }
    }
  ]
}
```

---

## 6. Run Unit Tests

```bash
builtin cd llm-service
pytest tests/unit/test_entity_resolver.py -v
```

**Expected Output:**
```
test_exact_match_resolution PASSED
test_fuzzy_match_resolution PASSED
test_ambiguous_detection PASSED
test_contextual_disambiguation PASSED
test_confidence_scoring PASSED
test_multi_person_resolution PASSED
```

---

## 7. Run Integration Tests

```bash
pytest tests/integration/test_resolution_flow.py -v
```

**Expected Output:**
```
test_unique_match_flow PASSED
test_ambiguous_match_flow PASSED
test_clarification_flow PASSED
test_database_sync_with_resolution PASSED
```

---

## 8. Test with VCR Cassettes (Offline LLM Testing)

```bash
# Record LLM interactions
pytest tests/integration/test_resolution_flow.py --record-mode=new_episodes

# Replay without LLM calls
pytest tests/integration/test_resolution_flow.py
```

**Cassette Location:** `llm-service/tests/cassettes/`

---

## Troubleshooting

### Issue: "Module 'rapidfuzz' not found"

**Solution:**
```bash
builtin cd llm-service
pip install rapidfuzz==3.14.3
```

### Issue: "No persons found in database"

**Solution:**
```bash
# Check database connection
supabase status

# Verify entities table
psql $DATABASE_URL -c "SELECT COUNT(*) FROM entities WHERE type='person';"

# Re-run seed script
python scripts/seed_test_persons.py
```

### Issue: "All resolutions return new_entity"

**Solution:**
Check that:
1. Entities have `deleted_at IS NULL`
2. Identifiers table has type='name' records
3. User has permission to query entities (RLS policies)

### Issue: "Resolution confidence always 0.0"

**Solution:**
Check environment variables:
```bash
env | grep FUZZY_MATCH
# Should show FUZZY_MATCH_FIRST_NAME_THRESHOLD=0.8
```

---

## Performance Benchmarks

Expected performance on local development:

| Scenario | Entities | Resolution Time |
|----------|----------|-----------------|
| Single exact match | 100 | <100ms |
| Fuzzy matching | 1,000 | <500ms |
| Fuzzy matching | 10,000 | <2s |
| Ambiguous (multiple candidates) | 100 | <150ms |

**LLM latency** (additional):
- OpenAI GPT-4: 2-5s
- Local Ollama: 5-15s (depends on model)

---

## Next Steps

1. **Implement clarification UI** in frontend (feature not yet implemented)
2. **Add session tracking** for pronoun resolution
3. **Optimize for larger datasets** (>10k entities) with semantic search
4. **Tune fuzzy thresholds** based on production data
5. **Add monitoring** for resolution accuracy metrics

---

## Common Development Tasks

### Add a new person manually

```python
from supabase import create_client
import os

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

# Create entity
entity = supabase.table("entities").insert({
    "type": "person",
    "data": {"company": "NewCo"}
}).execute()

# Add identifiers
supabase.table("identifiers").insert([
    {"entity_id": entity.data[0]["id"], "type": "name", "value": "Jane Doe"},
    {"entity_id": entity.data[0]["id"], "type": "email", "value": "jane@newco.com"}
]).execute()
```

### Query all persons

```python
result = supabase.table("entities")\
    .select("*, identifiers(*)")\
    .eq("type", "person")\
    .is_("deleted_at", None)\
    .execute()

print(f"Found {len(result.data)} persons")
```

### Test fuzzy matching thresholds

```python
from rapidfuzz.distance import JaroWinkler

names = ["John", "Jon", "Jonathan", "Johnny"]
for name in names:
    similarity = JaroWinkler.similarity("John", name)
    print(f"{name}: {similarity:.2f}")
```

---

## Documentation

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/extraction-api.md)
- [Research](./research.md)

---

## Support

For issues or questions:
1. Check existing tests in `tests/unit/test_entity_resolver.py`
2. Review chain-of-thought reasoning in LLM responses
3. Verify database state with SQL queries
4. Check logs: `tail -f llm-service/logs/app.log`
