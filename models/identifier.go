package models

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Identifier struct {
	BaseModel
	EntityID uuid.UUID      `json:"entity_id" gorm:"type:uuid;not null"`
	Type     string         `json:"type" gorm:"type:varchar(20);not null" validate:"required,oneof='name document biometric phone email handle address registration domain'"`
	Value    string         `json:"value" gorm:"not null"`
	Metadata datatypes.JSON `json:"metadata" gorm:"type:jsonb;default:'{}'"`
}
