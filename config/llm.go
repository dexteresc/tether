package config

import "os"

type LLMConfig struct {
	Provider    string // "openai", "anthropic", "ollama"
	APIKey      string
	Model       string
	BaseURL     string // For self-hosted models
	Temperature float32
	MaxTokens   int
}

func GetLLMConfig() *LLMConfig {
	return &LLMConfig{
		Provider:    os.Getenv("LLM_PROVIDER"),
		APIKey:      os.Getenv("LLM_API_KEY"),
		Model:       os.Getenv("LLM_MODEL"),
		BaseURL:     os.Getenv("LLM_BASE_URL"),
		Temperature: 0.3, // Lower for more consistent parsing
		MaxTokens:   2000,
	}
}
