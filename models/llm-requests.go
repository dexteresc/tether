package models

import (
	"time"

	"github.com/google/uuid"
)

type LLMProcessRequest struct {
	Text   string    `json:"text"`
	UserID uuid.UUID `json:"userId"`
}

/* ---------- 2. DTOs coming back from the LLM ---------- */

type IdentifierData struct {
	Type     string                 `json:"type"` // name, email, phone, …
	Value    string                 `json:"value"`
	Verified bool                   `json:"verified,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Entity extracted from free text
type ExtractedEntityData struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"` // person, organization, …
	Description string                 `json:"description,omitempty"`
	Identifiers []IdentifierData       `json:"identifiers,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// One‑way relationship between two named entities
type ExtractedRelationData struct {
	FromEntityName string                 `json:"fromEntity"`
	ToEntityName   string                 `json:"toEntity"`
	RelationType   string                 `json:"relationType"` // parent, colleague, …
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// Atomic intel item
type ExtractedIntelData struct {
	Type           string                 `json:"type"` // sighting, callLog, …
	Title          string                 `json:"title"`
	Content        string                 `json:"content"`
	Classification string                 `json:"classification"`
	Source         string                 `json:"source,omitempty"`
	EntityNames    []string               `json:"entityNames"`
	OccurredAt     *time.Time             `json:"occurredAt,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	Confidence     float64                `json:"confidence"`
}

// Container returned by the LLM
type RawExtractions struct {
	Entities  []ExtractedEntityData   `json:"entities"`
	Relations []ExtractedRelationData `json:"relations"`
	Intel     []ExtractedIntelData    `json:"intel"`
}

/* ---------- 3. Summaries after DB insert ---------- */

type EntitySummary struct {
	ID               uuid.UUID `json:"id"`
	Type             string    `json:"type"`
	Name             string    `json:"name"`
	IsNew            bool      `json:"isNew"`
	IdentifiersAdded int       `json:"identifiersAdded"`
}

type RelationSummary struct {
	ID           uuid.UUID `json:"id"`
	FromEntityID uuid.UUID `json:"fromEntityId"`
	ToEntityID   uuid.UUID `json:"toEntityId"`
	RelationType string    `json:"relationType"`
	IsNew        bool      `json:"isNew"`
}

type IntelSummary struct {
	ID             uuid.UUID `json:"id"`
	Type           string    `json:"type"`
	Title          string    `json:"title"`
	Classification string    `json:"classification"`
	LinkedEntities int       `json:"linkedEntities"`
}

/* ---------- 4. Aggregated processor output ---------- */

type ProcessedData struct {
	Entities  []EntitySummary   `json:"entities"`
	Relations []RelationSummary `json:"relations"`
	Intel     []IntelSummary    `json:"intel"`
}

type TokenUsage struct {
	Prompt     int `json:"prompt"`
	Completion int `json:"completion"`
	Total      int `json:"total"`
}

/* ---------- 5. Final response back to caller ---------- */

type LLMExtractionResult struct {
	RawExtractions RawExtractions `json:"rawExtractions"`
	ProcessedData  ProcessedData  `json:"processedData"`
	Summary        string         `json:"summary"`
	ProcessedAt    time.Time      `json:"processedAt"`
	TokenUsage     TokenUsage     `json:"tokenUsage"`
}
