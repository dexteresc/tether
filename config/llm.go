package config

import (
	"os"
	"strconv"
)

type LLMConfig struct {
	Provider    string // "openai", "anthropic", "ollama"
	APIKey      string
	Model       string
	BaseURL     string // For self-hosted models
	Temperature float32
	MaxTokens   int
}

func GetLLMConfig() *LLMConfig {
	temperature := float32(0.3)
	if v := os.Getenv("LLM_TEMPERATURE"); v != "" {
		if parsed, err := strconv.ParseFloat(v, 32); err == nil {
			temperature = float32(parsed)
		}
	}

	maxTokens := 2000
	if v := os.Getenv("LLM_MAX_TOKENS"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			maxTokens = parsed
		}
	}

	return &LLMConfig{
		Provider:    os.Getenv("LLM_PROVIDER"),
		APIKey:      os.Getenv("LLM_API_KEY"),
		Model:       os.Getenv("LLM_MODEL"),
		BaseURL:     os.Getenv("LLM_BASE_URL"),
		Temperature: temperature,
		MaxTokens:   maxTokens,
	}
}
