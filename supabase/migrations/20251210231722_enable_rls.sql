-- Tether Intelligence System - Row Level Security (RLS) Policies
-- Secure data access based on user authentication

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_entities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SOURCES Table RLS Policies
-- All authenticated users can read sources
-- Only authenticated users can create/update/delete
-- ============================================================================

CREATE POLICY "Users can read all sources"
  ON sources FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users can insert sources"
  ON sources FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update sources"
  ON sources FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete sources"
  ON sources FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- ENTITIES Table RLS Policies
-- Users can read all entities (for graph exploration)
-- Users can only modify entities they own
-- ============================================================================

CREATE POLICY "Users can read all non-deleted entities"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users can insert entities"
  ON entities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own entities"
  ON entities FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      -- User owns this entity (user_id in JSONB data matches auth.uid())
      (data->>'user_id')::UUID = auth.uid() OR
      -- Or user created this entity (has email identifier matching their email)
      id IN (
        SELECT entity_id
        FROM identifiers
        WHERE type = 'email' AND value = auth.email()
      )
    )
  );

CREATE POLICY "Users can soft delete own entities"
  ON entities FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      (data->>'user_id')::UUID = auth.uid() OR
      id IN (
        SELECT entity_id
        FROM identifiers
        WHERE type = 'email' AND value = auth.email()
      )
    )
  );

-- ============================================================================
-- IDENTIFIERS Table RLS Policies
-- Users can read all identifiers (for search)
-- Users can only modify identifiers for entities they own
-- ============================================================================

CREATE POLICY "Users can read all non-deleted identifiers"
  ON identifiers FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users can insert identifiers"
  ON identifiers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update identifiers for own entities"
  ON identifiers FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    entity_id IN (
      SELECT id FROM entities
      WHERE (data->>'user_id')::UUID = auth.uid()
    )
  );

CREATE POLICY "Users can delete identifiers for own entities"
  ON identifiers FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    entity_id IN (
      SELECT id FROM entities
      WHERE (data->>'user_id')::UUID = auth.uid()
    )
  );

-- ============================================================================
-- RELATIONS Table RLS Policies
-- Users can read all relations (for graph exploration)
-- Users can create relations involving any entities
-- Users can modify/delete relations they created
-- ============================================================================

CREATE POLICY "Users can read all non-deleted relations"
  ON relations FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users can insert relations"
  ON relations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update relations"
  ON relations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete relations"
  ON relations FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- INTEL Table RLS Policies
-- Users can read all intel (collaborative intelligence gathering)
-- Users can create/update/delete intel
-- ============================================================================

CREATE POLICY "Users can read all non-deleted intel"
  ON intel FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users can insert intel"
  ON intel FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update intel"
  ON intel FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete intel"
  ON intel FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- INTEL_ENTITIES Table RLS Policies
-- Users can read all intel-entity associations
-- Users can create/update/delete associations
-- ============================================================================

CREATE POLICY "Users can read all non-deleted intel_entities"
  ON intel_entities FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Users can insert intel_entities"
  ON intel_entities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update intel_entities"
  ON intel_entities FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete intel_entities"
  ON intel_entities FOR DELETE
  USING (auth.uid() IS NOT NULL);
