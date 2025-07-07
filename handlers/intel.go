package handlers

import (
	"net/http"
	"time"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

func CreateIntel(c *gin.Context) {
	type CreateInput models.Intel
	var input CreateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	intel := models.Intel(input)
	if err := config.DB.Create(&intel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create intel"})
		return
	}

	c.JSON(http.StatusCreated, intel)
}

func UpdateIntel(c *gin.Context) {
	var input struct {
		Type       string         `json:"type" binding:"omitempty,oneof=event communication sighting report document media financial"`
		OccurredAt *time.Time     `json:"occurred_at" binding:"omitempty"`
		Data       datatypes.JSON `json:"data" binding:"omitempty"`
		Confidence string         `json:"confidence" binding:"omitempty,oneof=confirmed high medium low unconfirmed"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Intel{}).Where("id = ?", c.Param("id")).Updates(input)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func GetIntel(c *gin.Context) {
	var intels []models.Intel

	if err := config.DB.Find(&intels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve intels"})
		return
	}

	c.JSON(http.StatusOK, intels)
}

func GetIntelByID(c *gin.Context) {
	id := c.Param("id")
	var intel models.Intel

	if err := config.DB.First(&intel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel not found"})
		return
	}

	c.JSON(http.StatusOK, intel)
}

func DeleteIntel(c *gin.Context) {
	id := c.Param("id")
	var intel models.Intel

	if err := config.DB.First(&intel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel not found"})
		return
	}

	if err := config.DB.Delete(&intel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete intel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel deleted successfully"})
}
