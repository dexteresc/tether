package models

import (
	"github.com/google/uuid"
)

type Tag struct {
	BaseModel
	Name     string  `json:"name" gorm:"uniqueIndex;not null" binding:"required"`
	Category string  `json:"category" gorm:"type:varchar(20);not null;default:'topic'" validate:"omitempty,oneof=topic geographic project personal"`
	Color    *string `json:"color" gorm:"type:varchar(7)"`
}

type RecordTag struct {
	BaseModel
	TagID       uuid.UUID `json:"tag_id" gorm:"type:uuid;not null;index" binding:"required"`
	RecordID    uuid.UUID `json:"record_id" gorm:"type:uuid;not null" binding:"required"`
	RecordTable string    `json:"record_table" gorm:"type:varchar(40);not null" binding:"required" validate:"oneof=entities intel relations sources"`
}
