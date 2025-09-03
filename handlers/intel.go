package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func CreateIntel(c *gin.Context) {
	var intel models.Intel
	if err := c.ShouldBindJSON(&intel); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if intel.Confidence == "" {
		intel.Confidence = "medium"
	}

	if err := config.DB.Omit("id", "deleted_at").Create(&intel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create intel"})
		return
	}

	c.JSON(http.StatusCreated, intel)
}

func GetIntel(c *gin.Context) {
	var intel []models.Intel
	if err := config.DB.Find(&intel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve intel"})
		return
	}
	c.JSON(http.StatusOK, intel)
}

func GetIntelByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var intel models.Intel
	if err := config.DB.First(&intel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel not found"})
		return
	}
	c.JSON(http.StatusOK, intel)
}

func UpdateIntel(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var intel models.Intel
	if err := c.ShouldBindJSON(&intel); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Intel{}).Where("id = ?", id).
		Omit("id", "created_at", "deleted_at").Updates(intel)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update intel"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel updated"})
}

func DeleteIntel(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	result := config.DB.Delete(&models.Intel{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete intel"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel deleted"})
}
