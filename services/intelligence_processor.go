package services

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/dexteresc/tether/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type IntelligenceProcessor struct {
	db         *gorm.DB
	llmService *LLMService
}

func NewIntelligenceProcessor(db *gorm.DB) *IntelligenceProcessor {
	return &IntelligenceProcessor{
		db:         db,
		llmService: NewLLMService(),
	}
}

// ProcessAndSave processes text with LLM and saves extracted data
func (p *IntelligenceProcessor) ProcessAndSave(req *models.LLMProcessRequest, userID uint) (*models.LLMExtractionResult, error) {
	// Extract data using LLM
	rawExtractions, tokenUsage, err := p.llmService.ProcessIntelligence(req)
	if err != nil {
		return nil, err
	}

	// Begin transaction
	tx := p.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Process the extractions and save to database
	processedData := models.ProcessedData{
		Entities:  []models.EntitySummary{},
		Relations: []models.RelationSummary{},
		Intel:     []models.IntelSummary{},
	}

	// Map to store created/found entities by name for relation creation
	entityMap := make(map[string]*models.Entity)

	// Process entities
	for _, extracted := range rawExtractions.Entities {
		entity, summary, err := p.processEntity(tx, &extracted, userID)
		if err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to process entity: %w", err)
		}
		entityMap[extracted.Name] = entity
		processedData.Entities = append(processedData.Entities, *summary)
	}

	// Process relations
	for _, extracted := range rawExtractions.Relations {
		_, summary, err := p.processRelation(tx, &extracted, entityMap)
		if err != nil {
			// Log error but don't fail the whole transaction
			fmt.Printf("Warning: failed to create relation: %v\n", err)
			continue
		}
		if summary != nil {
			processedData.Relations = append(processedData.Relations, *summary)
		}
	}

	// Process intel
	for _, extracted := range rawExtractions.Intel {
		_, summary, err := p.processIntel(tx, &extracted, entityMap, userID)
		if err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to process intel: %w", err)
		}
		processedData.Intel = append(processedData.Intel, *summary)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Build final result
	result := &models.LLMExtractionResult{
		RawExtractions: *rawExtractions,
		ProcessedData:  processedData,
		Summary:        p.generateSummary(&processedData),
		ProcessedAt:    time.Now(),
		TokenUsage:     *tokenUsage,
	}

	return result, nil
}

func (p *IntelligenceProcessor) processEntity(tx *gorm.DB, extracted *models.ExtractedEntityData, userID uint) (*models.Entity, *models.EntitySummary, error) {
	// Attempt to locate an existing entity via an Identifier of type "name"
	var (
		entity     models.Entity
		identifier models.Identifier
	)
	err := tx.Where("type = ? AND value = ?", "name", extracted.Name).First(&identifier).Error
	if err == nil {
		err = tx.Where("id = ? AND type = ?", identifier.EntityID, extracted.Type).First(&entity).Error
	}

	isNew := false
	switch err {
	case nil:
		// Entity found – merge any new descriptive data into the JSONB column
		var dataMap map[string]interface{}
		if entity.Data != nil {
			_ = json.Unmarshal(entity.Data, &dataMap)
		}
		if dataMap == nil {
			dataMap = map[string]interface{}{}
		}

		updated := false
		if extracted.Description != "" {
			if _, ok := dataMap["description"]; !ok {
				dataMap["description"] = extracted.Description
				updated = true
			}
		}
		if len(extracted.Metadata) > 0 {
			meta, _ := dataMap["metadata"].(map[string]interface{})
			if meta == nil {
				meta = map[string]interface{}{}
			}
			for k, v := range extracted.Metadata {
				if _, exists := meta[k]; !exists {
					meta[k] = v
					updated = true
				}
			}
			dataMap["metadata"] = meta
		}
		if updated {
			bytes, _ := json.Marshal(dataMap)
			if err := tx.Model(&entity).Update("data", datatypes.JSON(bytes)).Error; err != nil {
				return nil, nil, err
			}
		}

	case gorm.ErrRecordNotFound:
		// Create a new entity
		payload := map[string]interface{}{"name": extracted.Name}
		if extracted.Description != "" {
			payload["description"] = extracted.Description
		}
		if len(extracted.Metadata) > 0 {
			payload["metadata"] = extracted.Metadata
		}
		bytes, _ := json.Marshal(payload)

		entity = models.Entity{
			Type: extracted.Type,
			Data: datatypes.JSON(bytes),
		}
		if err := tx.Create(&entity).Error; err != nil {
			return nil, nil, err
		}
		isNew = true

	default:
		return nil, nil, err
	}

	// Ensure a "name" Identifier exists
	if extracted.Name != "" {
		var existing models.Identifier
		if tx.Where("entity_id = ? AND type = ? AND value = ?", entity.ID, "name", extracted.Name).First(&existing).Error == gorm.ErrRecordNotFound {
			nameMeta, _ := json.Marshal(map[string]interface{}{})
			_ = tx.Create(&models.Identifier{
				EntityID: entity.ID,
				Type:     "name",
				Value:    extracted.Name,
				Metadata: datatypes.JSON(nameMeta),
			}).Error
		}
	}

	// Handle other identifiers
	identifiersAdded := 0
	for _, identData := range extracted.Identifiers {
		var existing models.Identifier
		err := tx.Where("entity_id = ? AND type = ? AND value = ?", entity.ID, identData.Type, identData.Value).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			meta := map[string]interface{}{"verified": identData.Verified}
			metaBytes, _ := json.Marshal(meta)
			if err := tx.Create(&models.Identifier{
				EntityID: entity.ID,
				Type:     identData.Type,
				Value:    identData.Value,
				Metadata: datatypes.JSON(metaBytes),
			}).Error; err == nil {
				identifiersAdded++
			}
		}
	}

	summary := &models.EntitySummary{
		ID:               entity.ID,
		Type:             entity.Type,
		Name:             extracted.Name,
		IsNew:            isNew,
		IdentifiersAdded: identifiersAdded,
	}
	return &entity, summary, nil
}

func (p *IntelligenceProcessor) processRelation(tx *gorm.DB, extracted *models.ExtractedRelationData, entityMap map[string]*models.Entity) (*models.Relation, *models.RelationSummary, error) {
	fromEntity, okFrom := entityMap[extracted.FromEntityName]
	toEntity, okTo := entityMap[extracted.ToEntityName]
	if !okFrom || !okTo {
		return nil, nil, fmt.Errorf("entities not found for relation: %s -> %s",
			extracted.FromEntityName, extracted.ToEntityName)
	}

	var existing models.Relation
	err := tx.Where("source_id = ? AND target_id = ? AND type = ?", fromEntity.ID, toEntity.ID, extracted.RelationType).First(&existing).Error

	var relation *models.Relation
	isNew := false

	switch err {
	case nil:
		// Update JSONB metadata if new keys are present
		if len(extracted.Metadata) > 0 {
			var dataMap map[string]interface{}
			if existing.Data != nil {
				_ = json.Unmarshal(existing.Data, &dataMap)
			}
			if dataMap == nil {
				dataMap = map[string]interface{}{}
			}
			updated := false
			for k, v := range extracted.Metadata {
				if _, ok := dataMap[k]; !ok {
					dataMap[k] = v
					updated = true
				}
			}
			if updated {
				bytes, _ := json.Marshal(dataMap)
				if err := tx.Model(&existing).Update("data", datatypes.JSON(bytes)).Error; err != nil {
					return nil, nil, err
				}
			}
		}
		relation = &existing

	case gorm.ErrRecordNotFound:
		bytes, _ := json.Marshal(extracted.Metadata)
		newRel := models.Relation{
			SourceID: fromEntity.ID,
			TargetID: toEntity.ID,
			Type:     extracted.RelationType,
			Data:     datatypes.JSON(bytes),
		}
		if err := tx.Create(&newRel).Error; err != nil {
			return nil, nil, err
		}
		relation = &newRel
		isNew = true

	default:
		return nil, nil, err
	}

	summary := &models.RelationSummary{
		ID:           relation.ID,
		FromEntityID: relation.SourceID,
		ToEntityID:   relation.TargetID,
		RelationType: relation.Type,
		IsNew:        isNew,
	}
	return relation, summary, nil
}

func (p *IntelligenceProcessor) processIntel(tx *gorm.DB, extracted *models.ExtractedIntelData, entityMap map[string]*models.Entity, userID uint) (*models.Intel, *models.IntelSummary, error) {
	// Build JSON payload for the Data column
	payload := map[string]interface{}{
		"title":          extracted.Title,
		"content":        extracted.Content,
		"classification": extracted.Classification,
	}
	for k, v := range extracted.Metadata {
		payload[k] = v
	}
	dataBytes, _ := json.Marshal(payload)

	// Confidence bucketing
	confidence := "medium"
	switch {
	case extracted.Confidence >= 0.8:
		confidence = "high"
	case extracted.Confidence < 0.5:
		confidence = "low"
	}

	// Resolve or create Source
	var sourceID *uuid.UUID
	if extracted.Source != "" {
		var src models.Source
		srcErr := tx.Where("code = ?", extracted.Source).First(&src).Error
		if srcErr == gorm.ErrRecordNotFound {
			src = models.Source{
				Code:        extracted.Source,
				Type:        "text",
				Reliability: "C",
			}
			if err := tx.Create(&src).Error; err == nil {
				sourceID = &src.ID
			}
		} else if srcErr == nil {
			sourceID = &src.ID
		}
	}

	occurred := extracted.OccurredAt
	if occurred == nil || occurred.IsZero() {
		now := time.Now()
		occurred = &now
	}

	intel := models.Intel{
		Type:       extracted.Type,
		OccurredAt: *occurred,
		Data:       datatypes.JSON(dataBytes),
		SourceID:   sourceID,
		Confidence: confidence,
	}
	if err := tx.Create(&intel).Error; err != nil {
		return nil, nil, err
	}

	// Link to entities
	linked := 0
	for _, name := range extracted.EntityNames {
		if ent, ok := entityMap[name]; ok {
			var link models.IntelEntity
			err := tx.Where("intel_id = ? AND entity_id = ?", intel.ID, ent.ID).First(&link).Error
			if err == gorm.ErrRecordNotFound {
				if tx.Create(&models.IntelEntity{IntelID: intel.ID, EntityID: ent.ID}).Error == nil {
					linked++
				}
			}
		}
	}

	summary := &models.IntelSummary{
		ID:             intel.ID,
		Type:           intel.Type,
		Title:          extracted.Title,
		Classification: extracted.Classification,
		LinkedEntities: linked,
	}
	return &intel, summary, nil
}

func (p *IntelligenceProcessor) generateSummary(processed *models.ProcessedData) string {
	newEntities := 0
	for _, e := range processed.Entities {
		if e.IsNew {
			newEntities++
		}
	}

	newRelations := 0
	for _, r := range processed.Relations {
		if r.IsNew {
			newRelations++
		}
	}

	return fmt.Sprintf("Processed: %d entities (%d new), %d relations (%d new), %d intel records",
		len(processed.Entities), newEntities,
		len(processed.Relations), newRelations,
		len(processed.Intel))
}
