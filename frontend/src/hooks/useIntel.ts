import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getTable } from '../lib/supabase-helpers';
import type { Intel, IntelType, ConfidenceLevel, Json } from '../lib/types';

interface IntelFilters {
  type?: IntelType;
  confidence?: ConfidenceLevel;
  source_id?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
}

// Fetch all intel with optional filters
export function useIntel(filters?: IntelFilters) {
  return useQuery({
    queryKey: ['intel', filters],
    queryFn: async () => {
      let query = supabase
        .from('intel')
        .select('*, source:sources(*), intel_entities(*, entity:entities(*))')
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.confidence) {
        query = query.eq('confidence', filters.confidence);
      }
      if (filters?.source_id) {
        query = query.eq('source_id', filters.source_id);
      }
      if (filters?.date_from) {
        query = query.gte('occurred_at', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('occurred_at', filters.date_to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Fetch intel for a specific entity
export function useIntelByEntity(entityId: string | undefined) {
  return useQuery({
    queryKey: ['intel', 'entity', entityId],
    enabled: !!entityId,
    queryFn: async () => {
      if (!entityId) throw new Error('Entity ID is required');

      const { data, error } = await supabase
        .from('intel_entities')
        .select('*, intel:intel(*)')
        .eq('entity_id', entityId)
        .is('deleted_at', null);

      if (error) throw error;
      return data;
    },
  });
}

// Fetch a single intel record by ID
export function useIntelById(id: string | undefined) {
  return useQuery({
    queryKey: ['intel', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('Intel ID is required');

      const { data, error } = await supabase
        .from('intel')
        .select('*, source:sources(*), intel_entities(*, entity:entities(*))')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// Create a new intel record
export function useCreateIntel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (intel: {
      type: IntelType;
      occurred_at: string;
      data: Json;
      source_id?: string;
      confidence?: ConfidenceLevel;
      entity_ids?: string[];
    }) => {
      const { entity_ids, ...intelData } = intel;

      // Create the intel record
      const { data: createdIntel, error: intelError } = await getTable('intel')
        .insert(intelData)
        .select()
        .single();

      if (intelError) throw intelError;

      // Link entities if provided
      if (entity_ids && entity_ids.length > 0) {
        const intelEntities = entity_ids.map((entity_id) => ({
          intel_id: createdIntel.id,
          entity_id,
        }));

        const { error: linkError } = await getTable('intel_entities')
          .insert(intelEntities);

        if (linkError) throw linkError;
      }

      return createdIntel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intel'] });
    },
  });
}

// Update an intel record
export function useUpdateIntel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Intel> }) => {
      const { data, error } = await getTable('intel')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intel'] });
      queryClient.invalidateQueries({ queryKey: ['intel', variables.id] });
    },
  });
}

// Delete an intel record
export function useDeleteIntel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await getTable('intel')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intel'] });
    },
  });
}
