package models

import "github.com/google/uuid"

type IntelEntity struct {
	BaseModel
	IntelID  uuid.UUID `json:"intel_id" gorm:"type:uuid;primaryKey"`
	EntityID uuid.UUID `json:"entity_id" gorm:"type:uuid;primaryKey"`
	Role     string    `json:"role" gorm:"type:varchar(50)"` // e.g., "source", "target", "witness"
}
