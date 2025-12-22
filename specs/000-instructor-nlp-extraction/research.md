# Research: NLP Extraction with Instructor

**Date**: 2024-12-22
**Feature**: 001-instructor-nlp-extraction

## Existing Infrastructure Analysis

### Current Extraction System

The llm-service already implements most of the required functionality:

1. **Instructor Integration** (`llm-service/app/services/llm.py`):
   - `OpenAIProvider` and `OllamaProvider` classes
   - Provider switching via `settings.llm_provider` environment variable
   - Instructor's `from_openai()` for structured outputs
   - JSON mode for Ollama compatibility

2. **Chain-of-Thought Reasoning** (`llm-service/app/models/extraction.py`):
   - `Reasoning` model with fields: `entities_identified`, `relationships_identified`, `facts_identified`, `events_identified`, `sources_identified`, `confidence_rationale`
   - Placed FIRST in `IntelligenceExtraction` model to force LLM reasoning before extraction

3. **Database Schema** (`supabase/migrations/`):
   - `entities` table for persons, organizations, etc.
   - `identifiers` table for multiple identifiers per entity
   - `intel` table for events/intelligence
   - `intel_entities` junction table

4. **Supabase Sync** (`llm-service/app/services/supabase_sync.py`):
   - Entity upsert logic exists
   - Intel insertion logic exists

### Gap Analysis

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Fact Update classification | Entities extracted, synced as upserts | Need explicit classification label |
| Event Log classification | Intel extracted, synced as inserts | Need explicit classification label |
| chain_of_thought field | Reasoning model exists | Already satisfied |
| LLM provider switching | Environment-based switching works | Already satisfied |
| Automatic type classification | LLM determines entity vs intel | Need classification in response |

## Decision: Classification Approach

### Option A: Add Classification Enum to Extraction Result

Add an `ExtractionClassification` enum to the response:

```python
class ExtractionClassification(str, Enum):
    FACT_UPDATE = "fact_update"  # Primarily entity/attribute data
    EVENT_LOG = "event_log"      # Primarily temporal event/intel data
    MIXED = "mixed"              # Contains both types
```

**Pros**: Simple, explicit, matches spec terminology
**Cons**: LLM must determine classification (already does implicitly)

### Option B: Derive Classification from Extraction Content

Classify based on what was extracted:
- If `entities` non-empty and `intel` empty → FACT_UPDATE
- If `intel` non-empty and `entities` empty → EVENT_LOG
- If both non-empty → MIXED

**Pros**: No LLM changes needed, deterministic
**Cons**: Less explicit reasoning about classification

### Decision: Option B (Derived Classification)

**Rationale**:
1. Simpler - no LLM prompt changes
2. Already works - extraction already separates entities from intel
3. Deterministic - no ambiguity about classification
4. Preserves chain-of-thought for individual extraction reasoning

## Decision: Database Routing

Current `supabase_sync.py` already routes correctly:
- Entities → upsert to `entities` + `identifiers` tables
- Intel → insert to `intel` + `intel_entities` tables

**No changes needed to routing logic.** Only need to surface the classification in the API response.

## Decision: Spec Alignment with Existing Schema

The spec mentions `persons` table and `interaction_logs` table, but the existing schema uses:
- `entities` table (type = 'person') instead of `persons`
- `intel` table instead of `interaction_logs`

**Decision**: Use existing schema names. The spec's intent is satisfied:
- "Fact Updates" → entity upserts (where type='person')
- "Event Logs" → intel inserts

## Research Summary

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Classification method | Derive from extraction content | Simpler, deterministic |
| Chain-of-thought | Use existing Reasoning model | Already satisfies requirement |
| Provider switching | No changes needed | Already implemented |
| Database tables | Use existing schema | entities + intel match spec intent |
| API changes | Add classification to response | Surface derived classification |

## Implementation Implications

1. **Model changes**: Add `classification` field to extraction response model
2. **Service changes**: Add classification derivation logic after extraction
3. **Route changes**: Include classification in API response
4. **Test additions**: Test classification accuracy and routing

No significant architectural changes required - this is an enhancement to existing functionality.
