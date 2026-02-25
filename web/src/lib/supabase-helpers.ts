import { supabase } from "./supabase";
import type { Database, Json } from "@/types/database";

export interface EntityWithDetails {
  id: string;
  type: string;
  data: Json;
  identifiers: Array<{
    id: string;
    type: string;
    value: string;
    metadata: Json;
  }>;
  relations: Array<{
    id: string;
    type: string;
    target_id: string;
    source_id: string;
    strength: number | null;
    data: Json;
  }>;
  intel: Array<{
    id: string;
    type: string;
    occurred_at: string;
    confidence: string;
    data: Json;
  }>;
}

export async function getEntityWithDetails(entityId: string) {
  const { data, error } = await supabase.rpc("get_entity_with_details", {
    p_entity_id: entityId,
  });
  if (error) throw error;
  return data;
}

export async function searchEntitiesByIdentifier(
  searchValue: string,
  identifierType?: string
) {
  const { data, error } = await supabase.rpc(
    "search_entities_by_identifier",
    {
      p_search_value: searchValue,
      p_identifier_type: identifierType,
    }
  );
  if (error) throw error;
  return data;
}

export async function getEntityGraph(entityId: string, depth: number = 2) {
  const { data, error } = await supabase.rpc("get_entity_graph", {
    p_entity_id: entityId,
    p_depth: depth,
  });
  if (error) throw error;
  return data;
}

export async function createUserEntity(
  email: string,
  name: string,
  userId?: string
) {
  const { data, error } = await supabase.rpc("create_user_entity", {
    p_email: email,
    p_name: name,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;

export function getTable<T extends TableName>(tableName: T) {
  return supabase.from(tableName);
}

export async function findEntitiesNear(
  lat: number,
  lon: number,
  radiusM: number = 50000,
  entityType?: string
) {
  const { data, error } = await supabase.rpc("find_entities_near", {
    p_lat: lat,
    p_lon: lon,
    p_radius_m: radiusM,
    p_entity_type: entityType,
  });
  if (error) throw error;
  return data ?? [];
}

export async function findIntelNear(
  lat: number,
  lon: number,
  radiusM: number = 50000,
  fromDate?: string,
  toDate?: string
) {
  const { data, error } = await supabase.rpc("find_intel_near", {
    p_lat: lat,
    p_lon: lon,
    p_radius_m: radiusM,
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getEntityGraphV2(
  entityId: string,
  depth: number = 2,
  relationTypes?: string[],
  minStrength?: number
) {
  const { data, error } = await supabase.rpc("get_entity_graph_v2", {
    p_entity_id: entityId,
    p_depth: depth,
    p_relation_types: relationTypes,
    p_min_strength: minStrength,
  });
  if (error) throw error;
  return data ?? [];
}

export async function findShortestPath(
  sourceId: string,
  targetId: string,
  maxDepth: number = 5
) {
  const { data, error } = await supabase.rpc("find_shortest_path", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_max_depth: maxDepth,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fuzzySearchIdentifiers(query: string, limit: number = 20) {
  const { data, error } = await supabase.rpc("fuzzy_search_identifiers", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return data ?? [];
}

export async function searchIntelFullText(query: string, limit: number = 20) {
  const { data, error } = await supabase
    .from("intel")
    .select("*")
    .textSearch("search_vector", query, { type: "websearch" })
    .is("deleted_at", null)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getEntityConnectionCounts(entityIds: string[]) {
  const { data, error } = await supabase
    .from("entity_connection_counts")
    .select("*")
    .in("id", entityIds);
  if (error) throw error;
  return data ?? [];
}
