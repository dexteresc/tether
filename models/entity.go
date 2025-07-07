package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Entity struct {
	BaseModel
	ID        uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Type      string         `json:"type" gorm:"type:varchar(20)" validate:"required,oneof=person organization group vehicle location"`
	Data      datatypes.JSON `json:"data" gorm:"type:jsonb;not null;default:'{}'"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}
