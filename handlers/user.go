package handlers

import (
	"fmt"
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Creating a new user (new email and or name) should always create a new identifier.
func CreateUser(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Name     string `json:"name" binding:"required,min=1"`
		Password string `json:"password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var entity models.Entity

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		// Create entity as a person
		entity = models.Entity{
			Type: "person",
			Data: datatypes.JSON(fmt.Sprintf(`{"user": true, "name": "%s"}`, input.Name)),
		}
		if err := tx.Create(&entity).Error; err != nil {
			return err
		}

		// Create identifiers
		identifiers := []models.Identifier{
			{EntityID: entity.ID, Type: "email", Value: input.Email},
			{EntityID: entity.ID, Type: "name", Value: input.Name},
		}
		return tx.Create(&identifiers).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":    entity.ID,
		"email": input.Email,
		"name":  input.Name,
	})
}

func GetUser(c *gin.Context) {
	email := c.Param("email")

	var identifier models.Identifier
	if err := config.DB.Where("type = ? AND value = ?", "email", email).First(&identifier).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var entity models.Entity
	if err := config.DB.First(&entity, identifier.EntityID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Get all identifiers for complete picture
	var identifiers []models.Identifier
	config.DB.Where("entity_id = ?", entity.ID).Find(&identifiers)

	// Build response
	response := gin.H{"id": entity.ID, "type": entity.Type}
	for _, id := range identifiers {
		if id.Type == "email" {
			response["email"] = id.Value
		} else if id.Type == "name" {
			response["name"] = id.Value
		}
	}

	c.JSON(http.StatusOK, response)
}

func UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var input struct {
		Email string `json:"email" binding:"omitempty,email"`
		Name  string `json:"name" binding:"omitempty,min=1"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		// Update email identifier if provided
		if input.Email != "" {
			if err := tx.Model(&models.Identifier{}).
				Where("entity_id = ? AND type = ?", id, "email").
				Update("value", input.Email).Error; err != nil {
				return err
			}
		}

		// Update name identifier if provided
		if input.Name != "" {
			if err := tx.Model(&models.Identifier{}).
				Where("entity_id = ? AND type = ?", id, "name").
				Update("value", input.Name).Error; err != nil {
				return err
			}

			// Also update in entity data
			tx.Model(&models.Entity{}).Where("id = ?", id).
				Update("data", gorm.Expr("jsonb_set(data, '{name}', ?)", fmt.Sprintf(`"%s"`, input.Name)))
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func DeleteUser(c *gin.Context) {
	id := c.Param("id")

	// This soft deletes the entity and cascades to identifiers if you set up CASCADE
	if err := config.DB.Delete(&models.Entity{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
