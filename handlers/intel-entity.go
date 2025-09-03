package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func CreateIntelEntity(c *gin.Context) {
	var intelEntity models.IntelEntity
	if err := c.ShouldBindJSON(&intelEntity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := config.DB.Omit("id", "deleted_at").Create(&intelEntity).Error; err != nil {
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
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var intelEntity models.IntelEntity
	if err := config.DB.First(&intelEntity, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel entity not found"})
		return
	}
	c.JSON(http.StatusOK, intelEntity)
}

func UpdateIntelEntity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var intelEntity models.IntelEntity
	if err := c.ShouldBindJSON(&intelEntity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.IntelEntity{}).Where("id = ?", id).
		Omit("id", "created_at", "deleted_at", "intel_id", "entity_id").Updates(intelEntity)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update intel entity"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel entity updated"})
}

func DeleteIntelEntity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	result := config.DB.Delete(&models.IntelEntity{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete intel entity"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Intel entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Intel entity deleted"})
}
