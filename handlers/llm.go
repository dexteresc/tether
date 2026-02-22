package handlers

import (
	"net/http"

	"github.com/dexteresc/tether/models"
	"github.com/dexteresc/tether/services"
	"github.com/gin-gonic/gin"
)

type LLMHandler struct {
	processor *services.IntelligenceProcessor
}

func NewLLMHandler(processor *services.IntelligenceProcessor) *LLMHandler {
	return &LLMHandler{
		processor: processor,
	}
}

func (h *LLMHandler) ProcessIntelligence(c *gin.Context) {
	var req models.LLMProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetUint("userID")

	result, err := h.processor.ProcessAndSave(&req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *LLMHandler) PreviewExtraction(c *gin.Context) {
	var req models.LLMProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	llmService := services.NewLLMService()
	result, _, err := llmService.ProcessIntelligence(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
