package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type handlerError struct {
	Status  int
	Message string
}

func (e *handlerError) Error() string { return e.Message }

func parseIDParam(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return uuid.Nil, false
	}
	return id, true
}

func checkUpdateResult(result *gorm.DB, resource string) error {
	if result.Error != nil {
		return &handlerError{
			Status:  http.StatusInternalServerError,
			Message: fmt.Sprintf("Failed to update/delete %s", resource),
		}
	}
	if result.RowsAffected == 0 {
		return &handlerError{
			Status:  http.StatusNotFound,
			Message: fmt.Sprintf("%s not found", resource),
		}
	}
	return nil
}

func respondWithError(c *gin.Context, err error) {
	if he, ok := err.(*handlerError); ok {
		c.JSON(he.Status, gin.H{"error": he.Message})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}
