package models

import "github.com/google/uuid"

type User struct {
	BaseModel
	SupabaseID string    `json:"supabase_id" gorm:"uniqueIndex;not null"`
	EntityID   uuid.UUID `json:"entity_id" gorm:"type:uuid;not null;uniqueIndex"`
	Entity     Entity    `json:"entity" gorm:"foreignKey:EntityID;references:ID"`
	Email      string    `json:"email" gorm:"uniqueIndex;not null"`
	Active     bool      `json:"active" gorm:"default:true"`
}
