import { describe, it, expect } from 'vitest'
import type {
  ClassifiedExtractionResponse,
  EntityExtraction,
  RelationExtraction,
  IntelExtraction,
  ConfidenceLevel,
  EntityType,
  RelationType,
  IntelType,
  IdentifierType,
} from '../types'

describe('LLM Service Types - Schema Compatibility', () => {
  it('should accept a valid extraction response matching the OpenAPI schema', () => {
    const validResponse: ClassifiedExtractionResponse = {
      classification: 'fact_update',
      chain_of_thought: 'This is a factual update about entities and their relationships',
      extraction: {
        reasoning: {
          entities_identified: 'Found two persons: John Doe and Jane Smith',
          relationships_identified: 'John Doe is a colleague of Jane Smith',
          facts_identified: 'Both work at Acme Corp',
          events_identified: 'Meeting occurred on 2024-03-15',
          sources_identified: 'LLM extraction from user input',
          confidence_rationale: 'Names and relationships are explicitly stated',
        },
        entities: [
          {
            name: 'John Doe',
            entity_type: 'person',
            identifiers: [
              {
                identifier_type: 'name',
                value: 'John Doe',
                metadata: null,
              },
              {
                identifier_type: 'email',
                value: 'john@example.com',
                metadata: { verified: true },
              },
            ],
            attributes: {
              occupation: 'Engineer',
            },
            confidence: 'high',
            source_reference: 'user-input-001',
          },
          {
            name: 'Jane Smith',
            entity_type: 'person',
            identifiers: [
              {
                identifier_type: 'name',
                value: 'Jane Smith',
              },
            ],
            attributes: {},
            confidence: 'medium',
          },
        ],
        relations: [
          {
            source_entity_name: 'John Doe',
            target_entity_name: 'Jane Smith',
            relation_type: 'colleague',
            strength: 7,
            valid_from: '2024-01-01',
            valid_to: null,
            description: 'Work colleagues at Acme Corp',
            confidence: 'high',
            source_reference: null,
          },
        ],
        intel: [
          {
            intel_type: 'event',
            description: 'Meeting at Hilton Hotel',
            occurred_at: '2024-03-15T14:00:00Z',
            entities_involved: ['John Doe', 'Jane Smith'],
            location: 'Hilton Hotel, New York',
            details: {
              purpose: 'Project planning',
              duration_hours: 2,
            },
            confidence: 'confirmed',
            source_reference: 'meeting-notes-123',
          },
        ],
      },
      sync_results: null,
    }

    // Type checking passes at compile time
    expect(validResponse.classification).toBe('fact_update')
    expect(validResponse.extraction.entities.length).toBe(2)
    expect(validResponse.extraction.relations.length).toBe(1)
    expect(validResponse.extraction.intel.length).toBe(1)
  })

  it('should validate all confidence levels', () => {
    const levels: ConfidenceLevel[] = ['confirmed', 'high', 'medium', 'low', 'unconfirmed']

    levels.forEach((level) => {
      const entity: EntityExtraction = {
        name: 'Test',
        entity_type: 'person',
        identifiers: [],
        attributes: {},
        confidence: level,
      }
      expect(entity.confidence).toBe(level)
    })
  })

  it('should validate all entity types', () => {
    const types: EntityType[] = ['person', 'organization', 'group', 'vehicle', 'location', 'event']

    types.forEach((type) => {
      const entity: EntityExtraction = {
        name: 'Test',
        entity_type: type,
        identifiers: [],
        attributes: {},
        confidence: 'high',
      }
      expect(entity.entity_type).toBe(type)
    })
  })

  it('should validate all relation types', () => {
    const types: RelationType[] = [
      'parent',
      'child',
      'sibling',
      'spouse',
      'colleague',
      'associate',
      'friend',
      'member',
      'owner',
      'founder',
      'co-founder',
      'visited',
      'employee',
    ]

    types.forEach((type) => {
      const relation: RelationExtraction = {
        source_entity_name: 'Entity A',
        target_entity_name: 'Entity B',
        relation_type: type,
        confidence: 'high',
      }
      expect(relation.relation_type).toBe(type)
    })
  })

  it('should validate all intel types', () => {
    const types: IntelType[] = ['event', 'communication', 'sighting', 'report', 'document', 'media', 'financial']

    types.forEach((type) => {
      const intel: IntelExtraction = {
        intel_type: type,
        description: 'Test description',
        entities_involved: [],
        details: {},
        confidence: 'high',
      }
      expect(intel.intel_type).toBe(type)
    })
  })

  it('should validate all identifier types', () => {
    const types: IdentifierType[] = [
      'name',
      'document',
      'biometric',
      'phone',
      'email',
      'handle',
      'address',
      'registration',
      'domain',
    ]

    types.forEach((type) => {
      const identifier = {
        identifier_type: type,
        value: 'test-value',
      }
      expect(identifier.identifier_type).toBe(type)
    })
  })

  it('should handle optional fields correctly', () => {
    const minimalEntity: EntityExtraction = {
      name: 'Minimal Entity',
      entity_type: 'person',
      identifiers: [],
      attributes: {},
      confidence: 'low',
      // source_reference is optional
    }

    expect(minimalEntity.source_reference).toBeUndefined()

    const minimalRelation: RelationExtraction = {
      source_entity_name: 'A',
      target_entity_name: 'B',
      relation_type: 'colleague',
      confidence: 'medium',
      // strength, valid_from, valid_to, description, source_reference are optional
    }

    expect(minimalRelation.strength).toBeUndefined()

    const minimalIntel: IntelExtraction = {
      intel_type: 'report',
      description: 'Minimal report',
      entities_involved: [],
      details: {},
      confidence: 'unconfirmed',
      // occurred_at, location, source_reference are optional
    }

    expect(minimalIntel.occurred_at).toBeUndefined()
  })

  it('should handle relation strength constraints (1-10)', () => {
    const relation: RelationExtraction = {
      source_entity_name: 'A',
      target_entity_name: 'B',
      relation_type: 'colleague',
      strength: 5,
      confidence: 'high',
    }

    expect(relation.strength).toBe(5)
    expect(relation.strength).toBeGreaterThanOrEqual(1)
    expect(relation.strength).toBeLessThanOrEqual(10)
  })

  it('should handle sync_results when present', () => {
    const responseWithSync: ClassifiedExtractionResponse = {
      classification: 'mixed',
      chain_of_thought: 'Contains both facts and events',
      extraction: {
        reasoning: {
          entities_identified: 'test',
          relationships_identified: 'test',
          facts_identified: 'test',
          events_identified: 'test',
          sources_identified: 'test',
          confidence_rationale: 'test',
        },
        entities: [],
        relations: [],
        intel: [],
      },
      sync_results: {
        entities_created: [{ id: '123', name: 'Test Entity' }],
        entities_updated: [],
        relations_created: [],
        intel_created: [],
      },
    }

    expect(responseWithSync.sync_results).toBeDefined()
    expect(responseWithSync.sync_results?.entities_created).toHaveLength(1)
  })

  it('should handle event_log classification', () => {
    const eventLogResponse: ClassifiedExtractionResponse = {
      classification: 'event_log',
      chain_of_thought: 'This describes temporal events',
      extraction: {
        reasoning: {
          entities_identified: 'test',
          relationships_identified: 'test',
          facts_identified: 'test',
          events_identified: 'Multiple events in sequence',
          sources_identified: 'test',
          confidence_rationale: 'test',
        },
        entities: [],
        relations: [],
        intel: [
          {
            intel_type: 'event',
            description: 'Event 1',
            occurred_at: '2024-01-01T10:00:00Z',
            entities_involved: [],
            details: {},
            confidence: 'high',
          },
          {
            intel_type: 'event',
            description: 'Event 2',
            occurred_at: '2024-01-01T12:00:00Z',
            entities_involved: [],
            details: {},
            confidence: 'high',
          },
        ],
      },
    }

    expect(eventLogResponse.classification).toBe('event_log')
    expect(eventLogResponse.extraction.intel.length).toBe(2)
  })
})
