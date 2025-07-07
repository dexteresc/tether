package services

import (
	"fmt"

	"github.com/dexteresc/tether/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func CreateUser(db *gorm.DB, email, name, password string) (*models.Entity, error) {
	var user models.Entity

	err := db.Transaction(func(tx *gorm.DB) error {
		user = models.Entity{
			Type: "person",
			Data: datatypes.JSON(fmt.Sprintf(`{"user": true, "name": "%s"}`, name)),
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}

		identifiers := []models.Identifier{
			{EntityID: user.ID, Type: "email", Value: email},
			{EntityID: user.ID, Type: "name", Value: name},
		}
		return tx.Create(&identifiers).Error
	})

	return &user, err
}
