package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
)

type LLMService struct {
	config *config.LLMConfig
	client *http.Client
}

func NewLLMService() *LLMService {
	return &LLMService{
		config: config.GetLLMConfig(),
		client: &http.Client{},
	}
}

// ProcessIntelligence processes raw text and extracts structured data
func (s *LLMService) ProcessIntelligence(req *models.LLMProcessRequest) (*models.RawExtractions, *models.TokenUsage, error) {
	prompt := s.buildPrompt(req)

	response, tokenUsage, err := s.callLLM(prompt, s.getSystemPrompt())
	if err != nil {
		return nil, nil, fmt.Errorf("LLM call failed: %w", err)
	}

	extractions, err := s.parseResponse(response)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse LLM response: %w", err)
	}

	return extractions, tokenUsage, nil
}

func (s *LLMService) getSystemPrompt() string {
	basePrompt := `You are an intelligence analyst assistant. Extract structured information from the provided text.
    
    For entities, identify:
    - Type: person, organization, vehicle, location, or group
    - Name: The primary name/identifier
    - Description: Brief description if available
    - Identifiers: emails, phones, documents, licenses, etc.
    
    For relations, identify connections between entities:
    - RelationType: parent, child, colleague, associate, member, owns, other
    - Include metadata about the nature of the relationship
    
    For intel, extract:
    - Type: event, sighting, communication, document, other
    - Classification: public, confidential, secret, top-secret
    - Related entities
    
    Return valid JSON only. Include confidence scores (0-1) for each extraction.
	
	Extract all types of information.`

	return basePrompt
}

func (s *LLMService) buildPrompt(req *models.LLMProcessRequest) string {
	prompt := fmt.Sprintf("Extract structured intelligence data from the following text:\n\n%s", req.Text)

	prompt += "\n\nReturn the result as a JSON object with 'entities', 'relations', and 'intel' arrays."

	return prompt
}

func (s *LLMService) callLLM(prompt, systemPrompt string) (string, *models.TokenUsage, error) {
	var requestBody map[string]interface{}

	switch s.config.Provider {
	case "openai":
		requestBody = map[string]interface{}{
			"model": s.config.Model,
			"messages": []map[string]string{
				{"role": "system", "content": systemPrompt},
				{"role": "user", "content": prompt},
			},
			"temperature":     s.config.Temperature,
			"max_tokens":      s.config.MaxTokens,
			"response_format": map[string]string{"type": "json_object"},
		}
	case "anthropic":
		requestBody = map[string]interface{}{
			"model":       s.config.Model,
			"max_tokens":  s.config.MaxTokens,
			"temperature": s.config.Temperature,
			"system":      systemPrompt,
			"messages": []map[string]string{
				{"role": "user", "content": prompt},
			},
		}
	case "ollama":
		requestBody = map[string]interface{}{
			"model":  s.config.Model,
			"prompt": systemPrompt + "\n\n" + prompt,
			"format": "json",
			"stream": false,
			"options": map[string]interface{}{
				"temperature": s.config.Temperature,
			},
		}
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", nil, err
	}

	endpoint := s.getEndpoint()
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", nil, err
	}

	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", nil, fmt.Errorf("LLM API error: %s", string(body))
	}

	return s.extractContentAndUsage(resp.Body)
}

func (s *LLMService) getEndpoint() string {
	switch s.config.Provider {
	case "openai":
		return s.config.BaseURL + "/chat/completions"
	case "anthropic":
		return s.config.BaseURL + "/messages"
	case "ollama":
		return s.config.BaseURL + "/api/generate"
	default:
		return s.config.BaseURL + "/chat/completions"
	}
}

func (s *LLMService) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")

	switch s.config.Provider {
	case "openai":
		req.Header.Set("Authorization", "Bearer "+s.config.APIKey)
	case "anthropic":
		req.Header.Set("x-api-key", s.config.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	}
}

func (s *LLMService) extractContentAndUsage(body io.Reader) (string, *models.TokenUsage, error) {
	var response map[string]interface{}
	if err := json.NewDecoder(body).Decode(&response); err != nil {
		return "", nil, err
	}

	tokenUsage := &models.TokenUsage{}
	var content string

	switch s.config.Provider {
	case "openai":
		// Extract content
		if choices, ok := response["choices"].([]interface{}); ok && len(choices) > 0 {
			if choice, ok := choices[0].(map[string]interface{}); ok {
				if message, ok := choice["message"].(map[string]interface{}); ok {
					if c, ok := message["content"].(string); ok {
						content = c
					}
				}
			}
		}

		// Extract token usage
		if usage, ok := response["usage"].(map[string]interface{}); ok {
			if prompt, ok := usage["prompt_tokens"].(float64); ok {
				tokenUsage.Prompt = int(prompt)
			}
			if completion, ok := usage["completion_tokens"].(float64); ok {
				tokenUsage.Completion = int(completion)
			}
			if total, ok := usage["total_tokens"].(float64); ok {
				tokenUsage.Total = int(total)
			}
		}

	case "anthropic":
		// Extract content
		if c, ok := response["content"].([]interface{}); ok && len(c) > 0 {
			if text, ok := c[0].(map[string]interface{}); ok {
				if textContent, ok := text["text"].(string); ok {
					content = textContent
				}
			}
		}

		// Extract token usage
		if usage, ok := response["usage"].(map[string]interface{}); ok {
			if input, ok := usage["input_tokens"].(float64); ok {
				tokenUsage.Prompt = int(input)
			}
			if output, ok := usage["output_tokens"].(float64); ok {
				tokenUsage.Completion = int(output)
			}
			tokenUsage.Total = tokenUsage.Prompt + tokenUsage.Completion
		}

	case "ollama":
		if r, ok := response["response"].(string); ok {
			content = r
		}

		// Ollama provides limited token info
		if evalCount, ok := response["eval_count"].(float64); ok {
			tokenUsage.Completion = int(evalCount)
		}
		if promptEvalCount, ok := response["prompt_eval_count"].(float64); ok {
			tokenUsage.Prompt = int(promptEvalCount)
		}
		tokenUsage.Total = tokenUsage.Prompt + tokenUsage.Completion
	}

	if content == "" {
		return "", nil, fmt.Errorf("unable to extract content from LLM response")
	}

	return content, tokenUsage, nil
}

func (s *LLMService) parseResponse(response string) (*models.RawExtractions, error) {
	var extractions models.RawExtractions
	if err := json.Unmarshal([]byte(response), &extractions); err != nil {
		return nil, err
	}

	return &extractions, nil
}
