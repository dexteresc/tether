package services

import (
	"errors"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
)

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
