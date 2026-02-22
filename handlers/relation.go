package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
)

func CreateRelation(c *gin.Context) {
	var relation models.Relation
	if err := c.ShouldBindJSON(&relation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if relation.SourceID == relation.TargetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot create relation to self"})
		return
	}

	if err := config.DB.Omit("id", "deleted_at").Create(&relation).Error; err != nil {
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
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var relation models.Relation
	if err := config.DB.First(&relation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Relation not found"})
		return
	}
	c.JSON(http.StatusOK, relation)
}

func UpdateRelation(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var relation models.Relation
	if err := c.ShouldBindJSON(&relation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := config.DB.Model(&models.Relation{}).Where("id = ?", id).
		Omit("id", "created_at", "deleted_at", "source_id", "target_id").Updates(relation)

	if err := checkUpdateResult(result, "relation"); err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Relation updated"})
}

func DeleteRelation(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	result := config.DB.Delete(&models.Relation{}, id)
	if err := checkUpdateResult(result, "relation"); err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Relation deleted"})
}
