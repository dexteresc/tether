package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Intel struct {
	BaseModel
	Type       string         `json:"type" gorm:"type:varchar(20);not null"`
	OccurredAt time.Time      `json:"occurred_at" gorm:"not null;index"`
	Data       datatypes.JSON `json:"data" gorm:"type:jsonb;not null"`
	SourceID   *uuid.UUID     `json:"source_id" gorm:"type:uuid"`
	Confidence string         `json:"confidence" gorm:"type:varchar(20);not null;default:'medium'"`
}
