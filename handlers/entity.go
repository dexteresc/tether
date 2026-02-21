package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var validEntityTypes = map[string]bool{
	"person":       true,
	"organization": true,
	"group":        true,
	"vehicle":      true,
	"location":     true,
}

func CreateEntity(c *gin.Context) {
	var entity models.Entity
	if err := c.ShouldBindJSON(&entity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !validEntityTypes[entity.Type] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity type. Must be one of: person, organization, group, vehicle, location"})
		return
	}

	if err := config.DB.Omit("id", "deleted_at").Create(&entity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create entity"})
		return
	}

	c.JSON(http.StatusCreated, entity)
}

func GetEntities(c *gin.Context) {
	var entities []models.Entity
	if err := config.DB.Find(&entities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve entities"})
		return
	}
	c.JSON(http.StatusOK, entities)
}

func GetEntity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var entity models.Entity
	if err := config.DB.First(&entity, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}
	c.JSON(http.StatusOK, entity)
}

func UpdateEntity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var entity models.Entity
	if err := c.ShouldBindJSON(&entity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if entity.Type != "" && !validEntityTypes[entity.Type] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity type. Must be one of: person, organization, group, vehicle, location"})
		return
	}

	result := config.DB.Model(&models.Entity{}).Where("id = ?", id).
		Omit("id", "created_at", "deleted_at").Updates(entity)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update entity"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Entity updated"})
}

func DeleteEntity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	result := config.DB.Delete(&models.Entity{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete entity"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Entity deleted"})
}
