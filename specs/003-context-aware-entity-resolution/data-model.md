# Data Model: Context-Aware Entity Resolution

**Feature**: 003-context-aware-entity-resolution
**Date**: 2024-12-24
**Status**: Design Phase

## Overview

This document defines the data structures for entity resolution in the LLM service. All models use Pydantic for type safety and validation, integrating with the existing Instructor-based extraction pipeline.

---

## Core Models

### EntityResolutionResult

Represents the outcome of resolving a single person reference from natural language.

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from uuid import UUID

class EntityResolutionResult(BaseModel):
    """Result of resolving a person reference to an existing entity."""

    # Input reference
    input_reference: str = Field(
        ...,
        description="The name or reference as mentioned in natural language (e.g., 'John', 'Timmy')"
    )

    # Resolution outcome
    resolved: bool = Field(
        ...,
        description="Whether the reference was successfully resolved to an existing entity"
    )

    resolved_entity_id: Optional[UUID] = Field(
        None,
        description="UUID of the resolved entity in the entities table (null if not resolved)"
    )

    # Resolution metadata
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for the resolution (0.0-1.0)"
    )

    resolution_method: Literal[
        "exact_match",
        "fuzzy_match",
        "contextual_match",
        "new_entity",
        "ambiguous"
    ] = Field(
        ...,
        description="Method used to resolve the entity"
    )

    # Ambiguity handling
    ambiguous: bool = Field(
        False,
        description="Whether multiple candidates matched (requires clarification)"
    )

    candidates: list[dict] = Field(
        default_factory=list,
        description="Candidate entities when ambiguous (includes id, name, distinguishing attributes)"
    )

    # Reasoning
    reasoning: str = Field(
        ...,
        description="Chain-of-thought explanation of how the resolution was performed"
    )

    # Matching details
    match_details: Optional[dict] = Field(
        None,
        description="Detailed matching scores (exact_match, fuzzy_scores, context_match)"
    )

    @validator("resolved_entity_id")
    def validate_resolved_entity_id(cls, v, values):
        """If resolved=True, must have entity_id."""
        if values.get("resolved") and v is None:
            raise ValueError("resolved_entity_id required when resolved=True")
        return v

    @validator("candidates")
    def validate_candidates(cls, v, values):
        """If ambiguous=True, must have candidates."""
        if values.get("ambiguous") and len(v) == 0:
            raise ValueError("candidates required when ambiguous=True")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "input_reference": "John",
                "resolved": True,
                "resolved_entity_id": "550e8400-e29b-41d4-a716-446655440000",
                "confidence": 0.95,
                "resolution_method": "exact_match",
                "ambiguous": False,
                "candidates": [],
                "reasoning": "Found exact match for 'John' -> John Smith (only person with first name John in database)",
                "match_details": {
                    "exact_match": True,
                    "fuzzy_scores": {"first_name": 1.0, "last_name": 1.0},
                    "context_match": None
                }
            }
        }
```

---

### ResolutionContext

The context available when performing entity resolution (existing entities, session history).

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PersonEntity(BaseModel):
    """Minimal representation of a person entity for matching."""

    id: UUID = Field(..., description="Entity UUID from database")

    # Identifiers (flattened from identifiers table)
    names: list[str] = Field(
        default_factory=list,
        description="All name identifiers for this person"
    )

    emails: list[str] = Field(
        default_factory=list,
        description="All email identifiers for this person"
    )

    phones: list[str] = Field(
        default_factory=list,
        description="All phone identifiers for this person"
    )

    # Attributes from entity.data JSONB
    company: Optional[str] = Field(None, description="Company attribute if present")
    location: Optional[str] = Field(None, description="Location attribute if present")

    # Metadata
    updated_at: datetime = Field(..., description="Last update timestamp")

    def get_primary_name(self) -> Optional[str]:
        """Get the first name (assumed primary)."""
        return self.names[0] if self.names else None


class SessionEntity(BaseModel):
    """Recently mentioned entity within the current session."""

    entity_id: UUID = Field(..., description="Entity UUID")
    mention_count: int = Field(1, description="How many times mentioned in session")
    last_mentioned_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When last mentioned"
    )


class ResolutionContext(BaseModel):
    """Context available for entity resolution."""

    # All person entities from database
    persons: list[PersonEntity] = Field(
        default_factory=list,
        description="All person entities available for matching"
    )

    # Session context (for pronoun resolution)
    session_entities: list[SessionEntity] = Field(
        default_factory=list,
        description="Recently mentioned entities in current session"
    )

    # Configuration
    fuzzy_first_name_threshold: float = Field(
        0.8,
        ge=0.0,
        le=1.0,
        description="Fuzzy match threshold for first names (Jaro-Winkler)"
    )

    fuzzy_last_name_threshold: float = Field(
        0.7,
        ge=0.0,
        le=1.0,
        description="Fuzzy match threshold for last names (Jaro-Winkler)"
    )

    auto_resolve_confidence_threshold: float = Field(
        0.8,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for auto-resolving to single entity"
    )

    def get_recently_mentioned(self, limit: int = 5) -> list[UUID]:
        """Get most recently mentioned entity IDs."""
        sorted_entities = sorted(
            self.session_entities,
            key=lambda x: x.last_mentioned_at,
            reverse=True
        )
        return [e.entity_id for e in sorted_entities[:limit]]
```

---

### Enhanced Extraction Models

Integration with existing Instructor extraction schemas.

```python
from app.models.extraction import FactUpdate, EventLog  # Existing models

class EnhancedFactUpdate(FactUpdate):
    """FactUpdate with entity resolution results."""

    entity_resolutions: list[EntityResolutionResult] = Field(
        default_factory=list,
        description="Resolution results for person references in this fact update"
    )


class EnhancedEventLog(EventLog):
    """EventLog with entity resolution results."""

    entity_resolutions: list[EntityResolutionResult] = Field(
        default_factory=list,
        description="Resolution results for person references in this event"
    )

    participant_ids: list[UUID] = Field(
        default_factory=list,
        description="Resolved entity IDs for all participants (for intel_entities table)"
    )
```

---

## Database Schema

No schema changes required. Uses existing tables:

### entities
- `id`: UUID (primary key)
- `type`: VARCHAR(20) - filtered to 'person'
- `data`: JSONB - contains company, location, etc.
- `created_at`, `updated_at`, `deleted_at`: timestamps

### identifiers
- `id`: UUID (primary key)
- `entity_id`: UUID (foreign key to entities)
- `type`: VARCHAR(20) - 'name', 'email', 'phone', 'handle', etc.
- `value`: TEXT - the actual identifier value
- `metadata`: JSONB - can store match confidence scores (future)
- `created_at`, `updated_at`, `deleted_at`: timestamps

### intel_entities (junction table)
- `intel_id`: UUID (foreign key to intel table)
- `entity_id`: UUID (foreign key to entities)
- `role`: VARCHAR(50) - e.g., 'subject', 'participant', 'mentioned'

**Indexes Used:**
- `idx_identifiers_type_value` (GIN) - fast lookups by identifier type and value
- `idx_entities_type` - filter to persons
- `idx_entities_data_gin` (GIN) - JSONB queries on entity.data

---

## Data Flows

### 1. Entity Query Flow

```
User Input → Extract Service
             ↓
             Query Supabase
             ↓
             SELECT e.id, e.data, i.type, i.value
             FROM entities e
             JOIN identifiers i ON e.entity_id = i.entity_id
             WHERE e.type = 'person' AND e.deleted_at IS NULL
             ↓
             Transform to ResolutionContext
             (PersonEntity models)
```

### 2. Resolution Flow

```
Natural Language Input → LLM Extraction (Instructor)
                         ↓
                         Extract person references
                         ↓
                         For each reference:
                           ├─ Exact match check
                           ├─ Fuzzy match check (RapidFuzz)
                           ├─ Context match check (company, email)
                           └─ Calculate confidence score
                         ↓
                         Create EntityResolutionResult
                         ↓
                         If confidence > threshold:
                           Auto-resolve to entity_id
                         Else if multiple matches:
                           Flag as ambiguous, return candidates
                         Else:
                           Create new entity
```

### 3. Sync Flow (Integration with Existing)

```
EnhancedFactUpdate/EnhancedEventLog
  ↓
  For each EntityResolutionResult:
    ├─ If resolved=True and entity exists:
    │    Use resolved_entity_id for DB operations
    ├─ If resolved=False:
    │    Create new entity + identifiers
    └─ If ambiguous=True:
         Return clarification request to user
  ↓
  Insert/Update entities, identifiers, intel
  ↓
  Link to intel_entities with appropriate roles
```

---

## Validation Rules

### EntityResolutionResult
- `confidence` must be 0.0-1.0
- If `resolved=True`, must have `resolved_entity_id`
- If `ambiguous=True`, must have non-empty `candidates` list
- `resolution_method` must be one of: exact_match, fuzzy_match, contextual_match, new_entity, ambiguous
- `reasoning` must be non-empty string (enforced by Instructor chain_of_thought)

### ResolutionContext
- `persons` can be empty (database has no persons yet)
- All threshold values must be 0.0-1.0
- `fuzzy_first_name_threshold` defaults to 0.8
- `fuzzy_last_name_threshold` defaults to 0.7
- `auto_resolve_confidence_threshold` defaults to 0.8

### PersonEntity
- `id` must be valid UUID
- `names` list can contain multiple names (handles aliases, full name variants)
- At least one of `names`, `emails`, or `phones` should be non-empty (enforced at query time)

---

## State Transitions

### Entity Resolution States

```
INPUT REFERENCE
    ↓
    [Exact Match?]
        YES → resolved=True, confidence=0.9-1.0, method=exact_match
        NO ↓
    [Fuzzy Match Above Threshold?]
        YES (single) → resolved=True, confidence=fuzzy_score, method=fuzzy_match
        YES (multiple) → ambiguous=True, candidates=[all matches]
        NO ↓
    [Contextual Match?]
        YES → resolved=True, confidence=0.7-0.9, method=contextual_match
        NO ↓
    [Create New Entity]
        → resolved=False, confidence=0.0, method=new_entity
```

---

## Performance Considerations

### Query Optimization
- Load all persons on service startup (cache for <1k entities)
- Use GIN indexes for identifier lookups
- Batch fuzzy matching with RapidFuzz.process.cdist()

### Memory Footprint
- 10k PersonEntity objects ≈ 5-10 MB in memory
- Acceptable for in-memory caching
- For >10k entities, implement LRU cache or query on-demand

### Matching Performance
- Exact match: O(1) via dictionary lookup
- Fuzzy match: O(n) per reference, parallelized with RapidFuzz workers
- Target: <2s for 10k entities, <500ms for 1k entities

---

## Testing Scenarios

### Unit Tests (Pydantic Validation)
- ✅ EntityResolutionResult validates confidence range (0-1)
- ✅ resolved=True requires resolved_entity_id
- ✅ ambiguous=True requires candidates
- ✅ ResolutionContext validates threshold ranges

### Integration Tests (Database)
- ✅ Query PersonEntity from Supabase
- ✅ Transform identifiers to PersonEntity.names/emails/phones
- ✅ Handle deleted entities (deleted_at IS NULL)

### Resolution Tests (Matching Logic)
- ✅ Exact match: "John Smith" → John Smith entity
- ✅ Fuzzy match: "Jon" → John (>80% similarity)
- ✅ Ambiguous: "John" → [John Smith, John Doe]
- ✅ Contextual: "John from Acme" → John Smith (company=Acme)
- ✅ New entity: "Unknown Person" → create new
- ✅ Multi-person: "John and Timmy" → resolve both

---

## Example Scenarios

### Scenario 1: Unique Match (Auto-Resolve)

**Input:** "John ate a burger"

**ResolutionContext:**
```json
{
  "persons": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "names": ["John Smith", "John", "J. Smith"],
      "emails": ["john@example.com"],
      "company": "Acme Corp"
    }
  ]
}
```

**Output:**
```json
{
  "input_reference": "John",
  "resolved": true,
  "resolved_entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "confidence": 0.95,
  "resolution_method": "exact_match",
  "ambiguous": false,
  "reasoning": "Found exact match for 'John' in names list of entity. Only one person with this name."
}
```

### Scenario 2: Ambiguous (Requires Clarification)

**Input:** "John called me"

**ResolutionContext:**
```json
{
  "persons": [
    {"id": "uuid1", "names": ["John Smith"], "company": "Acme Corp"},
    {"id": "uuid2", "names": ["John Doe"], "company": "TechCo"}
  ]
}
```

**Output:**
```json
{
  "input_reference": "John",
  "resolved": false,
  "resolved_entity_id": null,
  "confidence": 0.0,
  "resolution_method": "ambiguous",
  "ambiguous": true,
  "candidates": [
    {"id": "uuid1", "name": "John Smith", "company": "Acme Corp"},
    {"id": "uuid2", "name": "John Doe", "company": "TechCo"}
  ],
  "reasoning": "Multiple persons match 'John': John Smith (Acme Corp) and John Doe (TechCo). Requires user clarification."
}
```

### Scenario 3: Contextual Disambiguation

**Input:** "John from Acme changed his email"

**ResolutionContext:**
```json
{
  "persons": [
    {"id": "uuid1", "names": ["John Smith"], "company": "Acme Corp"},
    {"id": "uuid2", "names": ["John Doe"], "company": "TechCo"}
  ]
}
```

**Output:**
```json
{
  "input_reference": "John from Acme",
  "resolved": true,
  "resolved_entity_id": "uuid1",
  "confidence": 0.9,
  "resolution_method": "contextual_match",
  "ambiguous": false,
  "reasoning": "Matched 'John' with contextual clue 'Acme' to company attribute. Resolved to John Smith.",
  "match_details": {
    "name_match": "fuzzy",
    "fuzzy_scores": {"first_name": 1.0},
    "context_match": "company='Acme Corp'"
  }
}
```

---

## Migration Path

**Phase 1 (Current):**
- Implement EntityResolutionResult and ResolutionContext models
- Use existing database schema (no migrations)

**Phase 2 (Future Enhancement):**
- Add `identifiers.metadata.match_confidence` to store historical match quality
- Create `entity_aliases` table for nickname mapping
- Implement semantic search for large entity sets (>10k)

**Phase 3 (Advanced):**
- Session persistence in Redis for pronoun resolution across requests
- Learning from user clarifications to improve fuzzy thresholds
- Confidence calibration based on production metrics
