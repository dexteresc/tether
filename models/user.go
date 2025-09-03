package models

import (
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	BaseModel
	EntityID     uuid.UUID `json:"entity_id" gorm:"type:uuid;not null;uniqueIndex" binding:"required"`
	Entity       Entity    `json:"entity" gorm:"foreignKey:EntityID;references:ID"`
	Email        string    `json:"email" gorm:"uniqueIndex;not null" binding:"required,email"`
	PasswordHash string    `json:"-" gorm:"not null"` // "-" excludes from JSON
	Active       bool      `json:"active" gorm:"default:true"`
}

type Login struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func (u *User) HashPassword(password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}
