package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

func CreateEntity(c *gin.Context) {
	var entity models.Entity
	if err := c.ShouldBindJSON(&entity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := config.DB.Create(&entity).Error; err != nil {
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
	id := c.Param("id")
	var entity models.Entity
	if err := config.DB.First(&entity, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}
	c.JSON(http.StatusOK, entity)
}

func UpdateEntity(c *gin.Context) {
	var input struct {
		Type string         `json:"type" binding:"omitempty,oneof=person organization group vehicle location"`
		Data datatypes.JSON `json:"data" binding:"omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Entity{}).Where("id = ?", c.Param("id")).Updates(input)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func DeleteEntity(c *gin.Context) {
	id := c.Param("id")
	var entity models.Entity

	if err := config.DB.First(&entity, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	if err := config.DB.Delete(&entity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete entity"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
