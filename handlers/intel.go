package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
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
	id, ok := parseIDParam(c)
	if !ok {
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
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var intel models.Intel
	if err := c.ShouldBindJSON(&intel); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Intel{}).Where("id = ?", id).
		Omit("id", "created_at", "deleted_at").Updates(intel)

	if err := checkUpdateResult(result, "intel"); err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel updated"})
}

func DeleteIntel(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	result := config.DB.Delete(&models.Intel{}, id)
	if err := checkUpdateResult(result, "intel"); err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel deleted"})
}
