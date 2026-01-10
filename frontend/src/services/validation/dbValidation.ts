import type { Database } from '../../lib/types'
import type { TableName } from '../../lib/sync/types'

export interface ValidationError {
  field: string
  message: string
}

type EntityInsert = Database['public']['Tables']['entities']['Insert']
type IdentifierInsert = Database['public']['Tables']['identifiers']['Insert']
type RelationInsert = Database['public']['Tables']['relations']['Insert']
type IntelInsert = Database['public']['Tables']['intel']['Insert']
type IntelEntityInsert = Database['public']['Tables']['intel_entities']['Insert']
type SourceInsert = Database['public']['Tables']['sources']['Insert']

const ENTITY_TYPES = ['person', 'organization', 'group', 'vehicle', 'location', 'event'] as const
const IDENTIFIER_TYPES = [
  'name',
  'document',
  'biometric',
  'phone',
  'email',
  'handle',
  'address',
  'registration',
  'domain',
] as const
const RELATION_TYPES = [
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
] as const
const INTEL_TYPES = ['event', 'communication', 'sighting', 'report', 'document', 'media', 'financial'] as const
const CONFIDENCE_LEVELS = ['confirmed', 'high', 'medium', 'low', 'unconfirmed'] as const
const RELIABILITY_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

function validateEntity(row: EntityInsert): ValidationError[] {
  const errors: ValidationError[] = []

  if (!row.type) {
    errors.push({ field: 'type', message: 'Entity type is required' })
  } else if (!(ENTITY_TYPES as readonly string[]).includes(row.type)) {
    errors.push({ field: 'type', message: `Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}` })
  }

  return errors
}

function validateIdentifier(row: IdentifierInsert): ValidationError[] {
  const errors: ValidationError[] = []

  if (!row.entity_id) {
    errors.push({ field: 'entity_id', message: 'Entity ID is required' })
  }

  if (!row.type) {
    errors.push({ field: 'type', message: 'Identifier type is required' })
  } else if (!(IDENTIFIER_TYPES as readonly string[]).includes(row.type)) {
    errors.push({
      field: 'type',
      message: `Invalid identifier type. Must be one of: ${IDENTIFIER_TYPES.join(', ')}`,
    })
  }

  if (!row.value || row.value.trim() === '') {
    errors.push({ field: 'value', message: 'Identifier value is required' })
  }

  return errors
}

function validateRelation(row: RelationInsert): ValidationError[] {
  const errors: ValidationError[] = []

  if (!row.source_id) {
    errors.push({ field: 'source_id', message: 'Source entity ID is required' })
  }

  if (!row.target_id) {
    errors.push({ field: 'target_id', message: 'Target entity ID is required' })
  }

  if (!row.type) {
    errors.push({ field: 'type', message: 'Relation type is required' })
  } else if (!(RELATION_TYPES as readonly string[]).includes(row.type)) {
    errors.push({ field: 'type', message: `Invalid relation type. Must be one of: ${RELATION_TYPES.join(', ')}` })
  }

  if (row.strength !== null && row.strength !== undefined) {
    if (typeof row.strength !== 'number' || row.strength < 1 || row.strength > 10) {
      errors.push({ field: 'strength', message: 'Strength must be a number between 1 and 10' })
    }
  }

  return errors
}

function validateIntel(row: IntelInsert): ValidationError[] {
  const errors: ValidationError[] = []

  if (!row.type) {
    errors.push({ field: 'type', message: 'Intel type is required' })
  } else if (!(INTEL_TYPES as readonly string[]).includes(row.type)) {
    errors.push({ field: 'type', message: `Invalid intel type. Must be one of: ${INTEL_TYPES.join(', ')}` })
  }

  if (!row.occurred_at) {
    errors.push({ field: 'occurred_at', message: 'Occurred at date is required' })
  } else {
    // Validate ISO date string
    const date = new Date(row.occurred_at)
    if (isNaN(date.getTime())) {
      errors.push({ field: 'occurred_at', message: 'Invalid date format. Must be ISO 8601 string' })
    }
  }

  if (row.confidence && !(CONFIDENCE_LEVELS as readonly string[]).includes(row.confidence)) {
    errors.push({
      field: 'confidence',
      message: `Invalid confidence level. Must be one of: ${CONFIDENCE_LEVELS.join(', ')}`,
    })
  }

  return errors
}

function validateIntelEntity(row: IntelEntityInsert): ValidationError[] {
  const errors: ValidationError[] = []

  if (!row.intel_id) {
    errors.push({ field: 'intel_id', message: 'Intel ID is required' })
  }

  if (!row.entity_id) {
    errors.push({ field: 'entity_id', message: 'Entity ID is required' })
  }

  return errors
}

function validateSource(row: SourceInsert): ValidationError[] {
  const errors: ValidationError[] = []

  if (!row.code || row.code.trim() === '') {
    errors.push({ field: 'code', message: 'Source code is required' })
  }

  if (!row.type || row.type.trim() === '') {
    errors.push({ field: 'type', message: 'Source type is required' })
  }

  if (!row.reliability) {
    errors.push({ field: 'reliability', message: 'Reliability is required' })
  } else if (!(RELIABILITY_LEVELS as readonly string[]).includes(row.reliability)) {
    errors.push({
      field: 'reliability',
      message: `Invalid reliability level. Must be one of: ${RELIABILITY_LEVELS.join(', ')}`,
    })
  }

  return errors
}

/**
 * Validates a proposed row against database constraints
 */
export function validateProposedRow(table: TableName, row: unknown): ValidationError[] {
  if (!row || typeof row !== 'object') {
    return [{ field: '_root', message: 'Invalid row data' }]
  }

  switch (table) {
    case 'entities':
      return validateEntity(row as EntityInsert)
    case 'identifiers':
      return validateIdentifier(row as IdentifierInsert)
    case 'relations':
      return validateRelation(row as RelationInsert)
    case 'intel':
      return validateIntel(row as IntelInsert)
    case 'intel_entities':
      return validateIntelEntity(row as IntelEntityInsert)
    case 'sources':
      return validateSource(row as SourceInsert)
    default:
      return []
  }
}
