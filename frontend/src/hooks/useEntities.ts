import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Entity, EntityType } from '../lib/types';

interface EntityFilters {
  type?: EntityType;
}

// Fetch all entities with optional filters
export function useEntities(filters?: EntityFilters) {
  return useQuery({
    queryKey: ['entities', filters],
    queryFn: async () => {
      let query = supabase
        .from('entities')
        .select('*, identifiers(*)')
        .is('deleted_at', null);

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Fetch a single entity by ID with details
export function useEntity(id: string | undefined) {
  return useQuery({
    queryKey: ['entity', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('Entity ID is required');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_entity_with_details', {
        p_entity_id: id,
      });

      if (error) throw error;
      return data;
    },
  });
}

// Create a new entity
export function useCreateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entity: { type: EntityType; data?: any }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error} = await (supabase.from('entities') as any)
        .insert({
          type: entity.type,
          data: entity.data || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}

// Update an entity
export function useUpdateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Entity> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('entities') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      queryClient.invalidateQueries({ queryKey: ['entity', variables.id] });
    },
  });
}

// Soft delete an entity
export function useDeleteEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('entities') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}

// Search entities by identifier
export function useSearchEntities(searchValue: string, identifierType?: string) {
  return useQuery({
    queryKey: ['search_entities', searchValue, identifierType],
    enabled: searchValue.length > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('search_entities_by_identifier', {
        p_search_value: searchValue,
        p_identifier_type: identifierType || null,
      });

      if (error) throw error;
      return data;
    },
  });
}
