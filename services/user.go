package services

import (
	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
)

func GetUserBySupabaseID(supabaseID string) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Entity.Identifiers").Where("supabase_id = ? AND active = ?", supabaseID, true).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Entity").Where("email = ? AND active = ?", email, true).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
