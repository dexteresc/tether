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

// ProcessIntelligence handles LLM processing requests
func (c *LLMHandler) ProcessIntelligence(ctx *gin.Context) {
	var req models.LLMProcessRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID := ctx.GetUint("userID")

	result, err := c.processor.ProcessAndSave(&req, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// PreviewExtraction previews what would be extracted without saving
func (c *LLMHandler) PreviewExtraction(ctx *gin.Context) {
	var req models.LLMProcessRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	llmService := services.NewLLMService()
	result, _, err := llmService.ProcessIntelligence(&req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}
