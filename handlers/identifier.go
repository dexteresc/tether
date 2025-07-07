package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

func CreateIdentifier(c *gin.Context) {
	type CreateInput models.Identifier
	var input CreateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	identifier := models.Identifier(input)
	if err := config.DB.Create(&identifier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create identifier"})
		return
	}

	c.JSON(http.StatusCreated, identifier)
}

func UpdateIdentifier(c *gin.Context) {
	var input struct {
		Value    string         `json:"value" binding:"omitempty,min=1,max=500"`
		Metadata datatypes.JSON `json:"metadata" binding:"omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Identifier{}).Where("id = ?", c.Param("id")).Updates(input)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Identifier not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
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
	id := c.Param("id")
	var identifier models.Identifier

	if err := config.DB.First(&identifier, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Identifier not found"})
		return
	}

	c.JSON(http.StatusOK, identifier)
}
func DeleteIdentifier(c *gin.Context) {
	id := c.Param("id")
	var identifier models.Identifier

	if err := config.DB.First(&identifier, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Identifier not found"})
		return
	}

	if err := config.DB.Delete(&identifier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete identifier"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Identifier deleted"})
}
