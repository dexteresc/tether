import type { ClassifiedExtractionResponse } from './types'
import type { Database } from '../../lib/types'
import { createStagedExtraction } from '../../lib/idb/staged'

type EntityInsert = {
  id: string
  type: Database['public']['Tables']['entities']['Row']['type']
  data?: Database['public']['Tables']['entities']['Row']['data']
}

type IdentifierInsert = {
  id: string
  entity_id: string
  type: Database['public']['Tables']['identifiers']['Row']['type']
  value: string
  metadata?: Database['public']['Tables']['identifiers']['Row']['metadata']
}

type RelationInsert = {
  id: string
  source_id: string
  target_id: string
  type: Database['public']['Tables']['relations']['Row']['type']
  strength?: number | null
  valid_from?: string | null
  valid_to?: string | null
  data?: Database['public']['Tables']['relations']['Row']['data']
}

type IntelInsert = {
  id: string
  type: Database['public']['Tables']['intel']['Row']['type']
  occurred_at: string
  data: Database['public']['Tables']['intel']['Row']['data']
  confidence?: Database['public']['Tables']['intel']['Row']['confidence']
  source_id?: string | null
}

type IntelEntityInsert = {
  id: string
  intel_id: string
  entity_id: string
  role?: string | null
}

/**
 * Maps an LLM extraction response to staged database rows
 * Returns the IDs of created staged extraction records
 */
export async function mapExtractionToStagedRows(
  inputId: string,
  response: ClassifiedExtractionResponse,
  originLabel?: string | null,
): Promise<string[]> {
  const stagedIds: string[] = []
  const { extraction } = response

  // Map entities and their identifiers
  const entityNameToId = new Map<string, string>()

  for (const entityExt of extraction.entities) {
    let entityId: string = crypto.randomUUID()
    let shouldCreateEntityRow = true

    // Check for resolution
    if (extraction.resolutions) {
      const resolution = extraction.resolutions.find((r) => r.entity_ref === entityExt.name)
      if (resolution && resolution.status === 'resolved' && resolution.resolved_entity_id) {
        entityId = resolution.resolved_entity_id
        shouldCreateEntityRow = false
      }
    }

    entityNameToId.set(entityExt.name, entityId)

    if (shouldCreateEntityRow) {
      // Create entity row
      const entityRow: EntityInsert = {
        id: entityId,
        type: entityExt.entity_type,
        data: {
          name: entityExt.name,
          ...entityExt.attributes,
          confidence: entityExt.confidence,
          source_reference: entityExt.source_reference,
        },
      }

      const entityStaged = await createStagedExtraction(inputId, 'entities', entityRow, originLabel)
      stagedIds.push(entityStaged.staged_id)
    }

    // Create identifier rows for this entity
    for (const idExt of entityExt.identifiers) {
      const identifierRow: IdentifierInsert = {
        id: crypto.randomUUID(),
        entity_id: entityId,
        type: idExt.identifier_type,
        value: idExt.value,
        metadata: (idExt.metadata ?? {}),
      }

      const identifierStaged = await createStagedExtraction(inputId, 'identifiers', identifierRow, originLabel)
      stagedIds.push(identifierStaged.staged_id)
    }
  }

  // Map relations
  for (const relExt of extraction.relations) {
    const sourceId = entityNameToId.get(relExt.source_entity_name)
    const targetId = entityNameToId.get(relExt.target_entity_name)

    // Only create relation if both entities exist in this extraction
    if (sourceId && targetId) {
      const relationRow: RelationInsert = {
        id: crypto.randomUUID(),
        source_id: sourceId,
        target_id: targetId,
        type: relExt.relation_type,
        strength: relExt.strength ?? null,
        valid_from: relExt.valid_from ?? null,
        valid_to: relExt.valid_to ?? null,
        data: {
          description: relExt.description,
          confidence: relExt.confidence,
          source_reference: relExt.source_reference,
        },
      }

      const relationStaged = await createStagedExtraction(inputId, 'relations', relationRow, originLabel)
      stagedIds.push(relationStaged.staged_id)
    }
  }

  // Map intel and intel_entities
  for (const intelExt of extraction.intel) {
    const intelId = crypto.randomUUID()

    const intelRow: IntelInsert = {
      id: intelId,
      type: intelExt.intel_type,
      occurred_at: intelExt.occurred_at ?? new Date().toISOString(),
      confidence: intelExt.confidence,
      source_id: null, // Will be set manually if needed
      data: {
        description: intelExt.description,
        location: intelExt.location,
        ...intelExt.details,
        source_reference: intelExt.source_reference,
      },
    }

    const intelStaged = await createStagedExtraction(inputId, 'intel', intelRow, originLabel)
    stagedIds.push(intelStaged.staged_id)

    // Create intel_entities junction rows
    for (const entityName of intelExt.entities_involved) {
      const entityId = entityNameToId.get(entityName)

      if (entityId) {
        const intelEntityRow: IntelEntityInsert = {
          id: crypto.randomUUID(),
          intel_id: intelId,
          entity_id: entityId,
          role: null, // Could be enhanced to extract role from details
        }

        const intelEntityStaged = await createStagedExtraction(inputId, 'intel_entities', intelEntityRow, originLabel)
        stagedIds.push(intelEntityStaged.staged_id)
      }
    }
  }

  return stagedIds
}
