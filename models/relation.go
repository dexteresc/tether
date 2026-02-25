package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Relation struct {
	BaseModel
	SourceID    uuid.UUID      `json:"source_id" gorm:"type:uuid;not null;index" binding:"required"`
	TargetID    uuid.UUID      `json:"target_id" gorm:"type:uuid;not null;index" binding:"required"`
	Type        string         `json:"type" gorm:"type:varchar(30);not null" binding:"required,oneof=parent child sibling spouse relative colleague associate friend employee member owner founder co-founder mentor client partner introduced_by works_at lives_in invested_in attended visited knows"`
	Strength    *int           `json:"strength" gorm:"type:smallint" binding:"omitempty,min=1,max=10"`
	ValidFrom   *time.Time     `json:"valid_from" gorm:"type:date"`
	ValidTo     *time.Time     `json:"valid_to" gorm:"type:date"`
	Data        datatypes.JSON `json:"data" gorm:"type:jsonb;default:'{}'"`
	Sensitivity string         `json:"sensitivity" gorm:"type:varchar(20);not null;default:'internal'"`
}
