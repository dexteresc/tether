package handlers

import (
	"fmt"
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/middleware"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func GetCurrentUser(c *gin.Context) {
	user, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Reload with full associations
	var fullUser models.User
	if err := config.DB.Preload("Entity.Identifiers").First(&fullUser, user.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, fullUser)
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

func UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input struct {
		Email  string `json:"email" binding:"omitempty,email"`
		Name   string `json:"name" binding:"omitempty,min=1,max=100"`
		Active *bool  `json:"active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.Where("entity_id = ?", id).First(&user).Error; err != nil {
			return gorm.ErrRecordNotFound
		}

		updates := make(map[string]any)

		if input.Email != "" && input.Email != user.Email {
			updates["email"] = input.Email

			if err := tx.Model(&models.Identifier{}).
				Where("entity_id = ? AND type = ?", id, "email").
				Update("value", input.Email).Error; err != nil {
				return err
			}
		}

		if input.Active != nil {
			updates["active"] = *input.Active
		}

		if len(updates) > 0 {
			if err := tx.Model(&user).Updates(updates).Error; err != nil {
				return err
			}
		}

		if input.Name != "" {
			if err := tx.Model(&models.Identifier{}).
				Where("entity_id = ? AND type = ?", id, "name").
				Update("value", input.Name).Error; err != nil {
				return err
			}

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
		result := tx.Where("entity_id = ?", id).Delete(&models.User{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

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
