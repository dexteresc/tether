package models

import (
	"gorm.io/datatypes"
)

type Entity struct {
	BaseModel
	Type        string         `json:"type" gorm:"type:varchar(20)" validate:"required,oneof=person organization group vehicle location"`
	Data        datatypes.JSON `json:"data" gorm:"type:jsonb;not null;default:'{}'"`
	Identifiers []Identifier   `json:"identifiers;omitempty" gorm:"foreignKey:EntityID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}
