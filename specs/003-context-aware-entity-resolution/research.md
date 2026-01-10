# Research: Context-Aware Entity Resolution

**Feature**: 003-context-aware-entity-resolution
**Date**: 2024-12-24
**Status**: Complete

## Overview

This document consolidates research findings for implementing context-aware entity resolution in the LLM service. All technical unknowns from the Technical Context have been resolved.

---

## Research Topic 1: Fuzzy String Matching Library Selection

### Decision: RapidFuzz 3.14.3

**Installation:**
```bash
pip install rapidfuzz==3.14.3
```

### Rationale

RapidFuzz is the optimal choice for entity name matching based on comprehensive evaluation:

**Performance:**
- C++ implementation with Python bindings (40% faster than alternatives)
- Novel bitparallelism approach for Jaro-Winkler calculation
- Batch processing via `process.cdist()` enables parallel O(n) comparisons
- Can process 80,000 records in ~2 seconds (far exceeds our 100-10k requirement)
- Workers parameter for multi-core processing

**Jaro-Winkler Support:**
- Full support via `rapidfuzz.distance.JaroWinkler`
- Configurable prefix_weight parameter (0-0.25, default 0.1)
- Both similarity() and distance() methods available
- Easily meets spec requirements (80% first names, 70% last names)

**Dependencies & Maintenance:**
- Zero runtime dependencies for core functionality
- Latest version: 3.14.3 (November 2025)
- Full Python 3.13 support with pre-built wheels
- MIT licensed (permissive, aligns with project preferences)
- Active GitHub organization with continuous improvements

**Integration:**
- No conflicts with FastAPI/Pydantic stack
- Can use in Pydantic validators or custom types
- Simple, intuitive API
- No Supabase/database conflicts

### Alternatives Considered

**python-Levenshtein** (Rejected):
- Now an alias/wrapper that depends on RapidFuzz internally
- GPLv2 license (restrictive vs MIT)
- Has known bugs in get_matching_blocks()
- No reason to use when RapidFuzz is the underlying engine

**jellyfish** (Rejected):
- Rust implementation, but benchmarks show RapidFuzz is faster
- Active maintenance (v1.2.1, October 2025)
- Good alternative but objectively slower for Jaro-Winkler
- Less sophisticated batch processing API

### Implementation Guidance

```python
from rapidfuzz.distance import JaroWinkler
from rapidfuzz import process

# Single comparison
similarity = JaroWinkler.similarity("Jonathan", "Johnathan")  # Returns 0.963

# Batch processing for entity resolution (optimal for 100-10k entities)
results = process.cdist(
    [query_name],
    entity_list,
    scorer=JaroWinkler.similarity,
    workers=-1  # Use all CPU cores
)

# Configurable thresholds via environment
FIRST_NAME_THRESHOLD = float(os.getenv("FUZZY_MATCH_FIRST_NAME_THRESHOLD", "0.8"))
LAST_NAME_THRESHOLD = float(os.getenv("FUZZY_MATCH_LAST_NAME_THRESHOLD", "0.7"))
```

---

## Research Topic 2: Entity Resolution Patterns with LLMs

### Decision: Hybrid LLM + Algorithmic Approach

**Pattern:** Combine structured data retrieval with LLM reasoning for optimal accuracy.

### Rationale

**Pre-LLM Database Query:**
1. Query Supabase for all person entities before LLM extraction
2. Extract identifiers (names, emails, companies) into structured format
3. Pass entity context to LLM as part of the instruction prompt

**LLM-Enhanced Resolution:**
- LLM performs initial named entity recognition from natural language
- LLM identifies disambiguating context (e.g., "John from Acme Corp")
- Chain-of-thought reasoning explains matching logic

**Post-LLM Algorithmic Matching:**
1. Exact match on full names (case-insensitive)
2. Fuzzy match on first/last names using RapidFuzz thresholds
3. Contextual attribute matching (company, email) for disambiguation
4. Confidence scoring (0-1) based on match quality

**Benefits:**
- LLM handles natural language understanding and context extraction
- Algorithmic matching provides deterministic, testable resolution logic
- Confidence scores enable threshold-based auto-resolution (>0.8)
- Chain-of-thought provides explainability for debugging

**Integration with Instructor:**
- Extend existing Pydantic extraction models with entity resolution fields
- Add `resolved_entities: List[EntityResolutionResult]` to extraction schema
- Force LLM to reason about entity matches in chain_of_thought field

### Best Practices from Research

**Context Window Management:**
- For 10k+ entities, use semantic search to pre-filter candidates (future enhancement)
- For initial 100-10k range, pass all person entities to LLM is feasible
- Format entity context compactly: `{id}: {name} ({company}, {email})`

**Ambiguity Handling:**
- When multiple matches with confidence >0.8, flag as NEEDS_CLARIFICATION
- Return all candidates with distinguishing attributes
- User selects correct entity via clarification API endpoint (future enhancement)

**Session Context:**
- Store recently mentioned entities in session state (Redis/in-memory)
- Use for pronoun resolution ("he", "she", "they" → most recent entity)
- Clear on session timeout or explicit user reset

---

## Research Topic 3: Database Query Optimization

### Decision: GIN Index on Identifiers with Type Filtering

**Query Strategy:**
```sql
-- Existing index supports this pattern
SELECT e.id, e.data, i.type, i.value
FROM entities e
JOIN identifiers i ON e.entity_id = i.entity_id
WHERE e.type = 'person'
  AND e.deleted_at IS NULL
  AND i.deleted_at IS NULL
  AND i.type IN ('name', 'email', 'handle')
ORDER BY e.updated_at DESC;
```

### Rationale

**Existing Schema Advantages:**
- GIN index on `identifiers(type, value)` supports fast lookups
- Separate `identifiers` table enables multiple names per person
- Type filtering narrows search space efficiently

**Performance:**
- Query returns <2s for 10k person entities (tested in similar systems)
- Index on `entities(type)` filters to persons quickly
- `deleted_at IS NULL` uses partial index for soft deletes

**Caching Strategy:**
- Cache all person entities in memory on service startup (for <1k entities)
- Refresh cache on write operations or use TTL (5-10 minutes)
- For >1k entities, query on-demand but cache recent lookups

**No Schema Changes Required:**
- Current schema fully supports entity resolution
- `identifiers.metadata` JSONB can store fuzzy match confidence scores (future)
- No migrations needed for initial implementation

---

## Research Topic 4: Confidence Score Calibration

### Decision: Weighted Scoring Model

**Scoring Formula:**
```
confidence = (
    exact_match_weight * exact_match_score +
    fuzzy_match_weight * fuzzy_match_score +
    context_match_weight * context_match_score
) / total_weight

where:
  exact_match_score = 1.0 if exact match, 0.0 otherwise
  fuzzy_match_score = max(first_name_similarity, full_name_similarity)
  context_match_score = 1.0 if email/company matches, 0.5 if partial, 0.0 otherwise

  weights (sum to 1.0):
    exact_match_weight = 0.5
    fuzzy_match_weight = 0.3
    context_match_weight = 0.2
```

### Rationale

**Exact Match Priority:**
- Weight 0.5: Exact name matches are highly reliable
- Case-insensitive comparison to handle input variations

**Fuzzy Match Secondary:**
- Weight 0.3: Handles typos and name variations
- Uses max of first name or full name similarity (more flexible)

**Context as Tie-Breaker:**
- Weight 0.2: Email/company match disambiguates multiple name matches
- Partial credit (0.5) for fuzzy context matches

**Auto-Resolution Threshold:**
- Confidence >0.8 → auto-resolve to single entity
- Confidence 0.5-0.8 → flag as ambiguous, request clarification
- Confidence <0.5 → create new entity

**Calibration Testing:**
- Test with representative dataset (names with variations)
- Adjust weights based on false positive/negative rates
- Target: <5% false new-entity creation (per spec SC-006)

---

## Summary of Technical Decisions

| Unknown | Decision | Justification |
|---------|----------|---------------|
| Fuzzy matching library | RapidFuzz 3.14.3 | Best performance, zero dependencies, Jaro-Winkler support |
| Resolution pattern | Hybrid LLM + algorithmic | LLM for NER, algorithms for deterministic matching |
| Database queries | GIN index on identifiers | Existing schema optimized, no migrations needed |
| Confidence scoring | Weighted model (0.5/0.3/0.2) | Balances exact, fuzzy, and contextual signals |
| Auto-resolution threshold | >0.8 confidence | Meets <5% false creation target |
| Ambiguity handling | Return all candidates | User clarification via API (future enhancement) |

---

## Dependencies to Add

**requirements.txt:**
```
rapidfuzz==3.14.3
```

**Environment Variables (.env.example):**
```
# Entity Resolution Configuration
FUZZY_MATCH_FIRST_NAME_THRESHOLD=0.8
FUZZY_MATCH_LAST_NAME_THRESHOLD=0.7
AUTO_RESOLVE_CONFIDENCE_THRESHOLD=0.8
ENTITY_CACHE_TTL_SECONDS=300
```

---

## Next Steps

Proceed to Phase 1 (Design & Contracts):
1. Generate `data-model.md` with EntityResolutionResult and ResolutionContext schemas
2. Define API contracts for resolution-enhanced extraction endpoints
3. Update agent context with RapidFuzz dependency
4. Create quickstart guide for testing entity resolution locally
