-- Migration 2: Sensitivity & Access Control
-- Adds sensitivity_levels, user_access_levels, sensitivity columns, user_can_see function, updated RLS

BEGIN;

-- ============================================================
-- 1. Sensitivity levels (reference table)
-- ============================================================

CREATE TABLE sensitivity_levels (
  level VARCHAR(20) PRIMARY KEY,
  rank  SMALLINT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

INSERT INTO sensitivity_levels VALUES
  ('open',         0, 'Open — shareable with anyone'),
  ('internal',     1, 'Internal — visible to team'),
  ('confidential', 2, 'Confidential — restricted access'),
  ('restricted',   3, 'Restricted — only you');

-- ============================================================
-- 2. User access levels
-- ============================================================

CREATE TABLE user_access_levels (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_level  VARCHAR(20) NOT NULL REFERENCES sensitivity_levels(level),
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- 3. Add sensitivity + created_by to core tables
-- ============================================================

ALTER TABLE entities ADD COLUMN sensitivity VARCHAR(20) NOT NULL DEFAULT 'internal'
  REFERENCES sensitivity_levels(level);
ALTER TABLE entities ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE intel ADD COLUMN sensitivity VARCHAR(20) NOT NULL DEFAULT 'internal'
  REFERENCES sensitivity_levels(level);
ALTER TABLE intel ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE relations ADD COLUMN sensitivity VARCHAR(20) NOT NULL DEFAULT 'internal'
  REFERENCES sensitivity_levels(level);

ALTER TABLE sources ADD COLUMN sensitivity VARCHAR(20) NOT NULL DEFAULT 'internal'
  REFERENCES sensitivity_levels(level);

-- ============================================================
-- 4. Access control function
-- ============================================================

CREATE OR REPLACE FUNCTION user_can_see(p_sensitivity VARCHAR(20))
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_rank SMALLINT;
  v_record_rank SMALLINT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;

  SELECT rank INTO v_record_rank FROM sensitivity_levels WHERE level = p_sensitivity;

  -- open (0) and internal (1) visible to all authenticated users
  IF v_record_rank IS NULL OR v_record_rank <= 1 THEN RETURN TRUE; END IF;

  -- confidential (2) and restricted (3) require explicit access level
  SELECT sl.rank INTO v_user_rank
  FROM user_access_levels ual
  JOIN sensitivity_levels sl ON sl.level = ual.max_level
  WHERE ual.user_id = auth.uid();

  RETURN COALESCE(v_user_rank, 1) >= v_record_rank;
END; $$;

GRANT ALL ON FUNCTION user_can_see(VARCHAR) TO anon, authenticated, service_role;

-- ============================================================
-- 5. Replace RLS SELECT policies with sensitivity-aware versions
-- ============================================================

-- entities
DROP POLICY IF EXISTS "Users can read all entities" ON entities;
CREATE POLICY "Sensitivity-based read" ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_can_see(sensitivity));

-- intel
DROP POLICY IF EXISTS "Users can read all intel" ON intel;
CREATE POLICY "Sensitivity-based read" ON intel FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_can_see(sensitivity));

-- relations
DROP POLICY IF EXISTS "Users can read all relations" ON relations;
CREATE POLICY "Sensitivity-based read" ON relations FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_can_see(sensitivity));

-- sources
DROP POLICY IF EXISTS "Users can read all sources" ON sources;
CREATE POLICY "Sensitivity-based read" ON sources FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_can_see(sensitivity));

-- identifiers: inherit from parent entity via join
DROP POLICY IF EXISTS "Users can read all identifiers" ON identifiers;
CREATE POLICY "Sensitivity-based read" ON identifiers FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = identifiers.entity_id
        AND user_can_see(e.sensitivity)
    )
  );

-- entity_attributes: inherit from parent entity
DROP POLICY IF EXISTS "Users can read entity_attributes" ON entity_attributes;
CREATE POLICY "Sensitivity-based read" ON entity_attributes FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND user_can_see(e.sensitivity)
    )
  );

-- ============================================================
-- 6. RLS for new reference tables
-- ============================================================

ALTER TABLE sensitivity_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sensitivity_levels" ON sensitivity_levels
  FOR SELECT USING (true);

CREATE POLICY "Users can read own access level" ON user_access_levels
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 7. Grants
-- ============================================================

GRANT ALL ON TABLE sensitivity_levels TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_access_levels TO anon, authenticated, service_role;

COMMIT;
