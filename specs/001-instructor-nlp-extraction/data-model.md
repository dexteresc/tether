# Data Model: NLP Extraction with Instructor

**Date**: 2024-12-22
**Feature**: 001-instructor-nlp-extraction

## Existing Schema (No Changes Required)

The database schema already supports the feature requirements. See `supabase/migrations/20251210231246_create_core_tables.sql`.

### Entities Table (Fact Updates)

Maps to spec's "Person" entity:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| type | VARCHAR(20) | 'person', 'organization', 'group', 'vehicle', 'location' |
| data | JSONB | Flexible attributes (name, company, notes, etc.) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### Identifiers Table

Stores multiple identifiers per entity:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| entity_id | UUID | FK to entities |
| type | VARCHAR(20) | 'name', 'email', 'phone', 'address', etc. |
| value | TEXT | The identifier value |
| metadata | JSONB | Additional metadata |

### Intel Table (Event Logs)

Maps to spec's "Interaction Log":

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| type | VARCHAR(20) | 'event', 'communication', 'sighting', etc. |
| occurred_at | TIMESTAMPTZ | When the event happened |
| data | JSONB | Event details (description, location, etc.) |
| confidence | VARCHAR(20) | 'confirmed', 'high', 'medium', 'low', 'unconfirmed' |

### Intel_Entities Junction Table

Links events to involved entities:

| Column | Type | Description |
|--------|------|-------------|
| intel_id | UUID | FK to intel |
| entity_id | UUID | FK to entities |
| role | VARCHAR(50) | Role in the event |

## Pydantic Models (Enhancements)

### New: ExtractionClassification Enum

```python
class ExtractionClassification(str, Enum):
    FACT_UPDATE = "fact_update"   # Primarily entity data
    EVENT_LOG = "event_log"       # Primarily temporal events
    MIXED = "mixed"               # Contains both types
```

### Enhanced: ClassifiedExtraction Response

```python
class ClassifiedExtraction(BaseModel):
    classification: ExtractionClassification
    chain_of_thought: str  # Summary from Reasoning model
    extraction: IntelligenceExtraction  # Full extraction result
    sync_results: Optional[SyncResults] = None  # DB operation results
```

## Mapping: Spec Terms → Implementation

| Spec Term | Implementation |
|-----------|----------------|
| Person (entity) | entities table with type='person' |
| Fact Update | Entity upsert to entities + identifiers |
| Interaction Log | Record in intel table |
| Event Log | Intel insert to intel + intel_entities |
| chain_of_thought | Reasoning model fields, summarized |
| classification | Derived from extraction content |

## Entity Matching Rules

For upsert operations (FR-006):

1. Match on `identifiers.type='name'` AND `identifiers.value`
2. If exact name match found → update existing entity
3. If no match → create new entity

## State Transitions

```
Input Text
    ↓
LLM Extraction (IntelligenceExtraction)
    ↓
Classification (derived from content)
    ↓
Database Routing
    ├── entities[] → UPSERT entities + identifiers
    └── intel[] → INSERT intel + intel_entities
    ↓
ClassifiedExtraction Response
```
