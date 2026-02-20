import { supabase } from './supabase'
import type { Database, Json } from './types'

// Explicit RPC return types
export interface EntityWithDetails {
  id: string
  type: string
  data: Json
  identifiers: Array<{
    id: string
    type: string
    value: string
    metadata: Json
  }>
  relations: Array<{
    id: string
    type: string
    target_id: string
    source_id: string
    strength: number | null
    data: Json
  }>
  intel: Array<{
    id: string
    type: string
    occurred_at: string
    confidence: string
    data: Json
  }>
}

// Type-safe RPC wrappers
export async function getEntityWithDetails(entityId: string) {
  const { data, error } = await supabase.rpc('get_entity_with_details', {
    p_entity_id: entityId,
  })
  if (error) throw error
  return data
}

export async function searchEntitiesByIdentifier(
  searchValue: string,
  identifierType?: string
) {
  const { data, error } = await supabase.rpc('search_entities_by_identifier', {
    p_search_value: searchValue,
    p_identifier_type: identifierType ?? undefined,
  })
  if (error) throw error
  return data
}

export async function getEntityGraph(entityId: string, depth: number = 2) {
  const { data, error } = await supabase.rpc('get_entity_graph', {
    p_entity_id: entityId,
    p_depth: depth,
  })
  if (error) throw error
  return data
}

export async function createUserEntity(email: string, name: string, userId?: string) {
  const { data, error } = await supabase.rpc('create_user_entity', {
    p_email: email,
    p_name: name,
    p_user_id: userId,
  })
  if (error) throw error
  return data
}

// Typed table helpers
export type Tables = Database['public']['Tables']
export type TableName = keyof Tables

export function getTable<T extends TableName>(tableName: T) {
  return supabase.from(tableName)
}
