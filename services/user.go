package services

import (
	"errors"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
)

// func CreateUser(db *gorm.DB, email, name, password string) (*models.Entity, error) {
// 	var user models.Entity

// 	err := db.Transaction(func(tx *gorm.DB) error {
// 		user = models.Entity{
// 			Type: "person",
// 			Data: datatypes.JSON(fmt.Sprintf(`{"user": true, "name": "%s"}`, name)),
// 		}
// 		if err := tx.Create(&user).Error; err != nil {
// 			return err
// 		}

// 		identifiers := []models.Identifier{
// 			{EntityID: user.ID, Type: "email", Value: email},
// 			{EntityID: user.ID, Type: "name", Value: name},
// 		}
// 		return tx.Create(&identifiers).Error
// 	})

// 	return &user, err
// }

func GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Entity").Where("email = ? AND active = ?", email, true).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func AuthenticateUser(email, password string) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Entity").Where("email = ? AND active = ?", email, true).First(&user).Error; err != nil {
		return nil, err
	}

	if !user.CheckPassword(password) {
		return nil, errors.New("invalid password")
	}

	return &user, nil
}
