package models

import (
	"gorm.io/datatypes"
)

type Source struct {
	BaseModel
	Code        string         `json:"code" gorm:"uniqueIndex;not null"`
	Type        string         `json:"type" gorm:"type:varchar(20);not null"`
	Reliability string         `json:"reliability" gorm:"type:char(1)" validate:"required,oneof='A B C D E F'"`
	Data        datatypes.JSON `json:"data" gorm:"type:jsonb;default:'{}'"`
	Active      bool           `json:"active" gorm:"default:true"`
}
