package handlers

import (
	"fmt"
	"log"
	"net/http"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func CreateUser(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Name     string `json:"name" binding:"required,min=1,max=100"`
		Password string `json:"password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	var entity models.Entity

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		// Create entity as a person
		entity = models.Entity{
			Type: "person",
			Data: datatypes.JSON(fmt.Sprintf(`{"user": true, "name": "%s"}`, input.Name)),
		}
		if err := tx.Omit("id", "deleted_at").Create(&entity).Error; err != nil {
			return err
		}

		// Create user with hashed password
		user = models.User{
			EntityID: entity.ID,
			Email:    input.Email,
			Active:   true,
		}
		if err := user.HashPassword(input.Password); err != nil {
			return err
		}
		if err := tx.Omit("id", "deleted_at").Create(&user).Error; err != nil {
			return err
		}

		// Create identifiers
		identifiers := []models.Identifier{
			{EntityID: entity.ID, Type: "email", Value: input.Email},
			{EntityID: entity.ID, Type: "name", Value: input.Name},
		}
		return tx.Omit("id", "deleted_at").Create(&identifiers).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func GetUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var user models.User
	if err := config.DB.Preload("Entity").Where("entity_id = ?", id).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func GetCurrentUser(c *gin.Context) {
	log.Default().Println("Extracting user from JWT claims")
	claims := jwt.ExtractClaims(c)

	// Get user ID from claims
	userIDStr, exists := claims["id"].(string)
	if !exists {
		log.Default().Println("No 'id' claim found in JWT")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse string to UUID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Default().Println("Invalid UUID format:", userIDStr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	var user models.User
	if err := config.DB.Preload("Entity.Identifiers").Where("id = ?", userID).First(&user).Error; err != nil {
		log.Default().Println("Database error:", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input struct {
		Email    string `json:"email" binding:"omitempty,email"`
		Name     string `json:"name" binding:"omitempty,min=1,max=100"`
		Password string `json:"password" binding:"omitempty,min=8"`
		Active   *bool  `json:"active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		// Get the user
		var user models.User
		if err := tx.Where("entity_id = ?", id).First(&user).Error; err != nil {
			return gorm.ErrRecordNotFound
		}

		// Update user fields
		updates := make(map[string]any)

		if input.Email != "" && input.Email != user.Email {
			updates["email"] = input.Email

			// Also update email identifier
			if err := tx.Model(&models.Identifier{}).
				Where("entity_id = ? AND type = ?", id, "email").
				Update("value", input.Email).Error; err != nil {
				return err
			}
		}

		if input.Password != "" {
			var tempUser models.User
			if err := tempUser.HashPassword(input.Password); err != nil {
				return err
			}
			updates["password_hash"] = tempUser.PasswordHash
		}

		if input.Active != nil {
			updates["active"] = *input.Active
		}

		if len(updates) > 0 {
			if err := tx.Model(&user).Updates(updates).Error; err != nil {
				return err
			}
		}

		// Update name if provided
		if input.Name != "" {
			if err := tx.Model(&models.Identifier{}).
				Where("entity_id = ? AND type = ?", id, "name").
				Update("value", input.Name).Error; err != nil {
				return err
			}

			// Also update in entity data
			newData := fmt.Sprintf(`{"user": true, "name": "%s"}`, input.Name)
			if err := tx.Model(&models.Entity{}).Where("id = ?", id).
				Update("data", datatypes.JSON(newData)).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated"})
}

func DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		// Delete user record
		result := tx.Where("entity_id = ?", id).Delete(&models.User{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		// Delete entity (which cascades to identifiers if you have FK constraints)
		return tx.Delete(&models.Entity{}, id).Error
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted"})
}

