package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
)

func CreateIntelEntity(c *gin.Context) {
	type CreateInput models.IntelEntity
	var input CreateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	intelEntity := models.IntelEntity(input)
	if err := config.DB.Create(&intelEntity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create intel entity"})
		return
	}

	c.JSON(http.StatusCreated, intelEntity)
}

func GetIntelEntities(c *gin.Context) {
	var intelEntities []models.IntelEntity

	if err := config.DB.Find(&intelEntities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve intel entities"})
		return
	}

	c.JSON(http.StatusOK, intelEntities)
}

func GetIntelEntity(c *gin.Context) {
	id := c.Param("id")
	var intelEntity models.IntelEntity

	if err := config.DB.First(&intelEntity, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel entity not found"})
		return
	}

	c.JSON(http.StatusOK, intelEntity)
}

func UpdateIntelEntity(c *gin.Context) {
	var input struct {
		Type string `json:"type" binding:"omitempty,oneof=person organization group vehicle location"`
		Data string `json:"data" binding:"omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.IntelEntity{}).Where("id = ?", c.Param("id")).Updates(input)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update intel entity"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func DeleteIntelEntity(c *gin.Context) {
	id := c.Param("id")
	var intelEntity models.IntelEntity

	if err := config.DB.First(&intelEntity, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel entity not found"})
		return
	}

	if err := config.DB.Delete(&intelEntity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete intel entity"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel entity deleted"})
}
