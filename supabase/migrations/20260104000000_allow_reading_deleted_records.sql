-- Migration to allow fetching deleted records for synchronization
-- This updates RLS policies to remove the "deleted_at IS NULL" restriction for SELECT operations.
-- The application layer (frontend stores/hooks) handles filtering of deleted records where appropriate.

-- Sources
DROP POLICY IF EXISTS "Users can read all sources" ON sources;
CREATE POLICY "Users can read all sources"
  ON sources FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Entities
DROP POLICY IF EXISTS "Users can read all non-deleted entities" ON entities;
CREATE POLICY "Users can read all entities"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Identifiers
DROP POLICY IF EXISTS "Users can read all non-deleted identifiers" ON identifiers;
CREATE POLICY "Users can read all identifiers"
  ON identifiers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Relations
DROP POLICY IF EXISTS "Users can read all non-deleted relations" ON relations;
CREATE POLICY "Users can read all relations"
  ON relations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Intel
DROP POLICY IF EXISTS "Users can read all non-deleted intel" ON intel;
CREATE POLICY "Users can read all intel"
  ON intel FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Intel Entities
DROP POLICY IF EXISTS "Users can read all non-deleted intel_entities" ON intel_entities;
CREATE POLICY "Users can read all intel_entities"
  ON intel_entities FOR SELECT
  USING (auth.uid() IS NOT NULL);
