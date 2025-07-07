package handlers

import (
	"net/http"
	"time"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

func CreateRelation(c *gin.Context) {
	type CreateInput models.Relation
	var input CreateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Additional validation
	if input.SourceID == input.TargetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot create relation to self"})
		return
	}

	relation := models.Relation(input)
	if err := config.DB.Create(&relation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create relation"})
		return
	}

	c.JSON(http.StatusCreated, relation)
}

func GetRelations(c *gin.Context) {
	var relations []models.Relation

	if err := config.DB.Find(&relations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve relations"})
		return
	}

	c.JSON(http.StatusOK, relations)
}

func GetRelation(c *gin.Context) {
	id := c.Param("id")
	var relation models.Relation

	if err := config.DB.First(&relation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Relation not found"})
		return
	}

	c.JSON(http.StatusOK, relation)
}

func UpdateRelation(c *gin.Context) {
	var input struct {
		Type      string         `json:"type" binding:"omitempty,oneof=parent child sibling spouse colleague associate friend"`
		Strength  *int           `json:"strength" binding:"omitempty,min=1,max=10"`
		ValidFrom *time.Time     `json:"valid_from" binding:"omitempty"`
		ValidTo   *time.Time     `json:"valid_to" binding:"omitempty"`
		Data      datatypes.JSON `json:"data" binding:"omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Relation{}).Where("id = ?", c.Param("id")).Updates(input)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Relation not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func DeleteRelation(c *gin.Context) {
	id := c.Param("id")
	var relation models.Relation

	if err := config.DB.First(&relation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Relation not found"})
		return
	}

	if err := config.DB.Delete(&relation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete relation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Relation deleted"})
}
