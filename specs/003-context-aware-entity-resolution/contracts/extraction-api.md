# API Contract: Entity-Aware Extraction Endpoints

**Feature**: 003-context-aware-entity-resolution
**Service**: llm-service
**Base URL**: `http://localhost:8000/api`
**Date**: 2024-12-24

## Overview

This contract defines the enhanced extraction API endpoints that include entity resolution capabilities. These endpoints extend the existing `/api/extract` endpoints with resolution metadata.

---

## Endpoints

### POST /api/extract/with-resolution

Extract structured data from natural language with entity resolution for person references.

**Request:**

```http
POST /api/extract/with-resolution HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Authorization: Bearer <supabase-jwt-token>

{
  "text": "John ate a burger yesterday with Timmy",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "enable_resolution": true,
  "resolution_config": {
    "fuzzy_first_name_threshold": 0.8,
    "fuzzy_last_name_threshold": 0.7,
    "auto_resolve_confidence_threshold": 0.8
  }
}
```

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Natural language input to process |
| `user_id` | string (UUID) | Yes | User ID for RLS context |
| `enable_resolution` | boolean | No | Enable entity resolution (default: true) |
| `resolution_config` | object | No | Override default resolution thresholds |

**Response (Success):**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "classification": "event_log",
  "extraction": {
    "description": "John ate a burger with Timmy",
    "interaction_type": "meal",
    "occurred_at": "2024-12-23T12:00:00Z",
    "participants": ["John", "Timmy"],
    "chain_of_thought": "The text describes a past event (yesterday) involving two people sharing a meal..."
  },
  "entity_resolutions": [
    {
      "input_reference": "John",
      "resolved": true,
      "resolved_entity_id": "uuid-john-smith",
      "confidence": 0.95,
      "resolution_method": "exact_match",
      "ambiguous": false,
      "candidates": [],
      "reasoning": "Found exact match for 'John' -> John Smith (only person with first name John)",
      "match_details": {
        "exact_match": true,
        "fuzzy_scores": {"first_name": 1.0}
      }
    },
    {
      "input_reference": "Timmy",
      "resolved": true,
      "resolved_entity_id": "uuid-timmy-jones",
      "confidence": 0.92,
      "resolution_method": "fuzzy_match",
      "ambiguous": false,
      "candidates": [],
      "reasoning": "Fuzzy matched 'Timmy' to 'Timothy Jones' (similarity: 0.92)",
      "match_details": {
        "exact_match": false,
        "fuzzy_scores": {"first_name": 0.92}
      }
    }
  ],
  "needs_clarification": false,
  "processing_time_ms": 1247
}
```

**Response (Ambiguous - Needs Clarification):**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "classification": "event_log",
  "extraction": {
    "description": "John called me",
    "interaction_type": "call",
    "occurred_at": "2024-12-24T14:30:00Z",
    "participants": ["John"],
    "chain_of_thought": "The text describes a phone call from John..."
  },
  "entity_resolutions": [
    {
      "input_reference": "John",
      "resolved": false,
      "resolved_entity_id": null,
      "confidence": 0.0,
      "resolution_method": "ambiguous",
      "ambiguous": true,
      "candidates": [
        {
          "id": "uuid-john-smith",
          "name": "John Smith",
          "company": "Acme Corp",
          "email": "john.smith@acme.com"
        },
        {
          "id": "uuid-john-doe",
          "name": "John Doe",
          "company": "TechCo",
          "email": "john.doe@techco.com"
        }
      ],
      "reasoning": "Multiple persons match 'John': John Smith (Acme Corp) and John Doe (TechCo). Requires clarification."
    }
  ],
  "needs_clarification": true,
  "clarification_request": {
    "question": "Which John do you mean?",
    "options": [
      {
        "entity_id": "uuid-john-smith",
        "display_name": "John Smith",
        "display_context": "Acme Corp, john.smith@acme.com"
      },
      {
        "entity_id": "uuid-john-doe",
        "display_name": "John Doe",
        "display_context": "TechCo, john.doe@techco.com"
      }
    ]
  },
  "processing_time_ms": 1834
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `classification` | string | "fact_update" or "event_log" |
| `extraction` | object | Extracted structured data (existing schema) |
| `entity_resolutions` | array | Array of EntityResolutionResult objects |
| `needs_clarification` | boolean | Whether user input is required |
| `clarification_request` | object | Optional clarification UI data |
| `processing_time_ms` | integer | Processing duration |

**Error Responses:**

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "detail": "text field is required"
}
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "detail": "Invalid or missing Authorization token"
}
```

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "detail": "Entity resolution failed: database connection error"
}
```

---

### POST /api/extract/clarify

Resolve an ambiguous entity reference after user clarification.

**Request:**

```http
POST /api/extract/clarify HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Authorization: Bearer <supabase-jwt-token>

{
  "original_text": "John called me",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "clarifications": [
    {
      "input_reference": "John",
      "selected_entity_id": "uuid-john-smith"
    }
  ]
}
```

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `original_text` | string | Yes | Original natural language input |
| `user_id` | string (UUID) | Yes | User ID for RLS context |
| `clarifications` | array | Yes | User's entity selections |

**Clarification Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input_reference` | string | Yes | The ambiguous reference (e.g., "John") |
| `selected_entity_id` | string (UUID) | Yes | User-selected entity UUID |

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "classification": "event_log",
  "extraction": {
    "description": "John called me",
    "interaction_type": "call",
    "occurred_at": "2024-12-24T14:30:00Z",
    "participants": ["John Smith"]
  },
  "entity_resolutions": [
    {
      "input_reference": "John",
      "resolved": true,
      "resolved_entity_id": "uuid-john-smith",
      "confidence": 1.0,
      "resolution_method": "user_clarification",
      "reasoning": "User selected John Smith from candidates"
    }
  ],
  "intel_id": "uuid-newly-created-intel",
  "synced": true
}
```

---

### GET /api/entities/persons

Retrieve all person entities for the current user (for frontend autocomplete/suggestions).

**Request:**

```http
GET /api/entities/persons?limit=100&search=John HTTP/1.1
Host: localhost:8000
Authorization: Bearer <supabase-jwt-token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Max results (default: 100, max: 1000) |
| `search` | string | No | Filter by name substring |
| `updated_after` | string (ISO 8601) | No | Filter by update timestamp |

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "persons": [
    {
      "id": "uuid-john-smith",
      "names": ["John Smith", "John", "J. Smith"],
      "emails": ["john.smith@acme.com"],
      "phones": ["+1-555-0123"],
      "company": "Acme Corp",
      "location": "San Francisco, CA",
      "updated_at": "2024-12-24T12:00:00Z"
    },
    {
      "id": "uuid-john-doe",
      "names": ["John Doe"],
      "emails": ["john.doe@techco.com"],
      "company": "TechCo",
      "updated_at": "2024-12-23T08:15:00Z"
    }
  ],
  "total": 2,
  "returned": 2
}
```

---

## Authentication & Authorization

All endpoints require Supabase JWT authentication:

```http
Authorization: Bearer <jwt-token>
```

**Token Validation:**
1. Extract `user_id` from JWT claims
2. Verify token signature with Supabase Auth
3. Apply Row Level Security using `user_id` context

**RLS Policies:**
- Users can only query their own person entities
- Intel records are scoped to the authenticated user
- Cross-user entity references not permitted

---

## Rate Limiting

| Endpoint | Rate Limit |
|----------|------------|
| `/api/extract/with-resolution` | 30 requests/minute per user |
| `/api/extract/clarify` | 60 requests/minute per user |
| `/api/entities/persons` | 100 requests/minute per user |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1703434800
```

---

## Backward Compatibility

**Existing `/api/extract` endpoint:**
- Remains unchanged
- Does NOT include entity resolution
- Maintains current behavior for existing clients

**Migration Path:**
- Clients can opt-in to resolution by using `/api/extract/with-resolution`
- Future: Add `?resolve_entities=true` query parameter to `/api/extract` for gradual migration

---

## WebSocket Streaming (Future Enhancement)

**Endpoint:** `ws://localhost:8000/api/stream/extract`

Real-time entity resolution during extraction:

```json
{
  "type": "resolution_update",
  "data": {
    "input_reference": "John",
    "status": "matching",
    "candidates_found": 2
  }
}
```

Not included in initial implementation (Phase 1).

---

## Testing

**Contract Tests:**
- Validate request/response schemas match OpenAPI spec
- Test all error codes (400, 401, 500)
- Verify RLS enforcement (users can't access other users' entities)

**Integration Tests:**
- End-to-end flow: extract → resolve → sync to database
- Ambiguity detection and clarification flow
- Multi-person resolution in single request

**Performance Tests:**
- Resolution latency <2s for 1k entities
- Concurrent requests don't degrade individual request time
- Rate limiting enforced correctly

---

## Versioning

**Current Version:** v1 (implied by `/api/extract/with-resolution`)

**Future Versions:**
- v2 may add semantic search for large entity sets
- Breaking changes will use `/api/v2/extract/with-resolution`
- Deprecation notices provided 6 months before removal

---

## Example Usage (Python Client)

```python
import httpx

async def extract_with_resolution(text: str, token: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/extract/with-resolution",
            json={"text": text, "user_id": "user-uuid"},
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        return response.json()

# Usage
result = await extract_with_resolution(
    "John ate a burger with Timmy",
    token="eyJhbGciOiJIUzI1NiIs..."
)

if result["needs_clarification"]:
    print("Ambiguous entities:", result["clarification_request"])
else:
    print("Resolved entities:", result["entity_resolutions"])
```

---

## OpenAPI Specification

See `contracts/openapi.yaml` for full OpenAPI 3.1 schema.

Key components:
- `EntityResolutionResult` schema
- `ResolutionConfig` schema
- `ClarificationRequest` schema
- Error response models
