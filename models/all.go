// /**
// Project Summary: Intelligence Gathering System
// I'm building a minimalistic intelligence gathering system in Go using Gin (web framework) and GORM (ORM) with PostgreSQL. The system is designed to track entities (people, organizations, vehicles, etc.) and their relationships in a flexible, graph-like structure.
// Core Architecture:

// Universal Entity model that can represent any person, organization, group, vehicle, or location
// Entities have Identifiers (names, emails, phones, documents) stored separately for flexibility
// Relations connect entities with typed relationships (parent, child, colleague, associate, etc.)
// Intel records track events, sightings, and communications
// All models use soft deletes for data preservation and audit trails

// Key Design Decisions:

// Using a single Entity table instead of separate Person/Organization tables for maximum flexibility
// Embedding a BaseModel struct (ID, timestamps, soft delete) in all models
// Using Gin's binding tags for validation in input structs
// Users are just entities with type="person" - no separate user table

// The goal is to build a flexible intelligence tracking system with minimal code while maintaining security and data integrity.
// */

// type Entity struct {
// 	BaseModel
// 	ID          uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
// 	Type        string         `json:"type" gorm:"type:varchar(20)" validate:"required,oneof=person organization group vehicle location"`
// 	Data        datatypes.JSON `json:"data" gorm:"type:jsonb;not null;default:'{}'"`
// 	CreatedAt   time.Time      `json:"created_at"`
// 	UpdatedAt   time.Time      `json:"updated_at"`
// 	Identifiers []Identifier   `json:"identifiers" gorm:"foreignKey:EntityID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
// }
// type Identifier struct {
// 	BaseModel
// 	EntityID uuid.UUID      `json:"entity_id" gorm:"type:uuid;not null"`
// 	Type     string         `json:"type" gorm:"type:varchar(20);not null" validate:"required,oneof='name document biometric phone email handle address registration domain'"`
// 	Value    string         `json:"value" gorm:"not null"`
// 	Metadata datatypes.JSON `json:"metadata" gorm:"type:jsonb;default:'{}'"`
// }
// type IntelEntity struct {
// 	BaseModel
// 	IntelID  uuid.UUID `json:"intel_id" gorm:"type:uuid;primaryKey"`
// 	EntityID uuid.UUID `json:"entity_id" gorm:"type:uuid;primaryKey"`
// 	Role     string    `json:"role" gorm:"type:varchar(50)"`
// }
// type Intel struct {
// 	BaseModel
// 	Type       string         `json:"type" gorm:"type:varchar(20);not null"`
// 	OccurredAt time.Time      `json:"occurred_at" gorm:"not null;index"`
// 	Data       datatypes.JSON `json:"data" gorm:"type:jsonb;not null"`
// 	SourceID   *uuid.UUID     `json:"source_id" gorm:"type:uuid"`
// 	Confidence string         `json:"confidence" gorm:"type:varchar(20);not null;default:'medium'"`
// }
// type Relation struct {
// 	BaseModel
// 	SourceID  uuid.UUID      `json:"source_id" gorm:"type:uuid;not null;index" binding:"required"`
// 	TargetID  uuid.UUID      `json:"target_id" gorm:"type:uuid;not null;index" binding:"required"`
// 	Type      string         `json:"type" gorm:"type:varchar(30);not null" binding:"required,oneof=parent child sibling spouse colleague associate friend"`
// 	Strength  *int           `json:"strength" gorm:"type:smallint" binding:"omitempty,min=1,max=10"`
// 	ValidFrom *time.Time     `json:"valid_from" gorm:"type:date"`
// 	ValidTo   *time.Time     `json:"valid_to" gorm:"type:date"`
// 	Data      datatypes.JSON `json:"data" gorm:"type:jsonb;default:'{}'"`
// }
// type Source struct {
// 	BaseModel
// 	Code        string         `json:"code" gorm:"uniqueIndex;not null"`
// 	Type        string         `json:"type" gorm:"type:varchar(20);not null"`
// 	Reliability string         `json:"reliability" gorm:"type:char(1)" validate:"required,oneof='A B C D E F'"`
// 	Data        datatypes.JSON `json:"data" gorm:"type:jsonb;default:'{}'"`
// 	Active      bool           `json:"active" gorm:"default:true"`
// }
// type User struct {
// 	BaseModel
// 	EntityID     uuid.UUID `json:"entity_id" gorm:"type:uuid;not null;uniqueIndex" binding:"required"`
// 	Entity       Entity    `json:"entity" gorm:"foreignKey:EntityID;references:ID"`
// 	Email        string    `json:"email" gorm:"uniqueIndex;not null" binding:"required,email"`
// 	PasswordHash string    `json:"-" gorm:"not null"` // "-" excludes from JSON
// 	Active       bool      `json:"active" gorm:"default:true"`
// }