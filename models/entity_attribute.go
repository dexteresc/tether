package models

import (
	"time"

	"github.com/google/uuid"
)

type EntityAttribute struct {
	BaseModel
	EntityID   uuid.UUID  `json:"entity_id" gorm:"type:uuid;not null;index" binding:"required"`
	Key        string     `json:"key" gorm:"type:varchar(60);not null" binding:"required"`
	Value      string     `json:"value" gorm:"not null" binding:"required"`
	ValidFrom  *time.Time `json:"valid_from" gorm:"type:date"`
	ValidTo    *time.Time `json:"valid_to" gorm:"type:date"`
	Confidence string     `json:"confidence" gorm:"type:varchar(20);not null;default:'medium'" validate:"omitempty,oneof=confirmed high medium low unconfirmed"`
	SourceID   *uuid.UUID `json:"source_id" gorm:"type:uuid"`
	Notes      *string    `json:"notes"`
}
