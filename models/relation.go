package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Relation struct {
	BaseModel
	SourceID  uuid.UUID      `json:"source_id" gorm:"type:uuid;not null;index" binding:"required"`
	TargetID  uuid.UUID      `json:"target_id" gorm:"type:uuid;not null;index" binding:"required"`
	Type      string         `json:"type" gorm:"type:varchar(30);not null" binding:"required,oneof=parent child sibling spouse colleague associate friend"`
	Strength  *int           `json:"strength" gorm:"type:smallint;check:strength >= 1 AND strength <= 10" binding:"omitempty,min=1,max=10"`
	ValidFrom *time.Time     `json:"valid_from" gorm:"type:date"`
	ValidTo   *time.Time     `json:"valid_to" gorm:"type:date"`
	Data      datatypes.JSON `json:"data" gorm:"type:jsonb;default:'{}'"`
}
