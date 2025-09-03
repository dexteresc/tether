package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func CreateIdentifier(c *gin.Context) {
	var identifier models.Identifier
	if err := c.ShouldBindJSON(&identifier); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := config.DB.Omit("id", "deleted_at").Create(&identifier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create identifier"})
		return
	}

	c.JSON(http.StatusCreated, identifier)
}

func GetIdentifiers(c *gin.Context) {
	var identifiers []models.Identifier
	if err := config.DB.Find(&identifiers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve identifiers"})
		return
	}
	c.JSON(http.StatusOK, identifiers)
}

func GetIdentifier(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var identifier models.Identifier
	if err := config.DB.First(&identifier, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Identifier not found"})
		return
	}
	c.JSON(http.StatusOK, identifier)
}

func UpdateIdentifier(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var identifier models.Identifier
	if err := c.ShouldBindJSON(&identifier); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Identifier{}).Where("id = ?", id).
		Omit("id", "created_at", "deleted_at", "entity_id").Updates(identifier)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update identifier"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Identifier not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Identifier updated"})
}

func DeleteIdentifier(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	result := config.DB.Delete(&models.Identifier{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete identifier"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Identifier not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Identifier deleted"})
}
