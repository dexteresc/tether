import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Relation, RelationType } from '../lib/types';

// Fetch relations for a specific entity
export function useRelations(entityId: string | undefined) {
  return useQuery({
    queryKey: ['relations', entityId],
    enabled: !!entityId,
    queryFn: async () => {
      if (!entityId) throw new Error('Entity ID is required');

      const { data, error} = await supabase
        .from('relations')
        .select('*')
        .or(`source_id.eq.${entityId},target_id.eq.${entityId}`)
        .is('deleted_at', null);

      if (error) throw error;
      return data;
    },
  });
}

// Fetch entity graph for visualization
export function useRelationGraph(entityId: string | undefined, depth: number = 2) {
  return useQuery({
    queryKey: ['graph', entityId, depth],
    enabled: !!entityId,
    queryFn: async () => {
      if (!entityId) throw new Error('Entity ID is required');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_entity_graph', {
        p_entity_id: entityId,
        p_depth: depth,
      });

      if (error) throw error;
      return data;
    },
  });
}

// Create a new relation
export function useCreateRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (relation: {
      source_id: string;
      target_id: string;
      type: RelationType;
      strength?: number;
      valid_from?: string;
      valid_to?: string;
      data?: any;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('relations') as any)
        .insert(relation)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['relations'] });
      queryClient.invalidateQueries({ queryKey: ['relations', variables.source_id] });
      queryClient.invalidateQueries({ queryKey: ['relations', variables.target_id] });
      queryClient.invalidateQueries({ queryKey: ['graph'] });
    },
  });
}

// Update a relation
export function useUpdateRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Relation> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('relations') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relations'] });
      queryClient.invalidateQueries({ queryKey: ['graph'] });
    },
  });
}

// Delete a relation
export function useDeleteRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('relations') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relations'] });
      queryClient.invalidateQueries({ queryKey: ['graph'] });
    },
  });
}
