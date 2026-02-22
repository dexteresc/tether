package models

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Entity struct {
	BaseModel
	Type        string         `json:"type" gorm:"type:varchar(20)" validate:"required,oneof=person organization group location event project asset"`
	Status      string         `json:"status" gorm:"type:varchar(20);not null;default:'active'" validate:"omitempty,oneof=active inactive archived"`
	Data        datatypes.JSON `json:"data" gorm:"type:jsonb;not null;default:'{}'"`
	Sensitivity string         `json:"sensitivity" gorm:"type:varchar(20);not null;default:'internal'"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"type:uuid"`
	Identifiers []Identifier   `json:"identifiers,omitempty" gorm:"foreignKey:EntityID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}
