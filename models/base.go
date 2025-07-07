package models

type BaseModel struct {
	ID        string  `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
	DeletedAt *string `json:"deleted_at,omitempty" gorm:"index"`
}
