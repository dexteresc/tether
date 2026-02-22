-- Migration 1: Core Model Changes
-- Fixes entity type bug, expands type constraints, adds entity_attributes, attribute_definitions, tags, record_tags

BEGIN;

-- ============================================================
-- 1. Entity types: fix contradictory CHECK constraints + expand
-- ============================================================

ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_check;
ALTER TABLE entities DROP CONSTRAINT IF EXISTS valid_entity_type;
ALTER TABLE entities ADD CONSTRAINT valid_entity_type CHECK (
  type IN ('person','organization','group','location','event','project','asset')
);

-- Migrate existing 'vehicle' entities to 'asset'
UPDATE entities SET type = 'asset',
  data = data || '{"asset_type": "vehicle"}'::jsonb
WHERE type = 'vehicle' AND deleted_at IS NULL;

-- ============================================================
-- 2. Entity status column
-- ============================================================

ALTER TABLE entities ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE entities ADD CONSTRAINT valid_entity_status CHECK (
  status IN ('active','inactive','archived')
);

-- ============================================================
-- 3. Identifier types: expand
-- ============================================================

ALTER TABLE identifiers DROP CONSTRAINT IF EXISTS identifiers_type_check;
ALTER TABLE identifiers DROP CONSTRAINT IF EXISTS valid_identifier_type;
ALTER TABLE identifiers ADD CONSTRAINT valid_identifier_type CHECK (
  type IN ('name','alias','document','phone','email','handle',
           'address','registration','domain','website','account_id','biometric')
);

-- ============================================================
-- 4. Relation types: expand
-- ============================================================

ALTER TABLE relations DROP CONSTRAINT IF EXISTS valid_relation_type;
ALTER TABLE relations ADD CONSTRAINT valid_relation_type CHECK (
  type IN ('parent','child','sibling','spouse','relative',
           'colleague','associate','friend','employee','member',
           'owner','founder','co-founder','mentor','client','partner',
           'introduced_by','works_at','lives_in','invested_in',
           'attended','visited','knows')
);

-- ============================================================
-- 5. Intel types: expand
-- ============================================================

ALTER TABLE intel DROP CONSTRAINT IF EXISTS intel_type_check;
ALTER TABLE intel DROP CONSTRAINT IF EXISTS valid_intel_type;
ALTER TABLE intel ADD CONSTRAINT valid_intel_type CHECK (
  type IN ('event','communication','sighting','report','document',
           'media','financial','note','tip')
);

-- ============================================================
-- 6. Entity attributes (EAV with temporal versioning)
-- ============================================================

CREATE TABLE entity_attributes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id  UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key        VARCHAR(60) NOT NULL,
  value      TEXT NOT NULL,
  valid_from DATE,
  valid_to   DATE,
  confidence VARCHAR(20) NOT NULL DEFAULT 'medium',
  source_id  UUID REFERENCES sources(id) ON DELETE SET NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT valid_attr_confidence CHECK (
    confidence IN ('confirmed','high','medium','low','unconfirmed')
  ),
  CONSTRAINT valid_attr_dates CHECK (
    valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to
  )
);

CREATE INDEX idx_ea_entity ON entity_attributes(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_key_value ON entity_attributes(key, value) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_current ON entity_attributes(entity_id, key)
  WHERE deleted_at IS NULL AND valid_to IS NULL;

-- ============================================================
-- 7. Attribute definitions (seed/reference for UI autocomplete)
-- ============================================================

CREATE TABLE attribute_definitions (
  key        VARCHAR(60) PRIMARY KEY,
  label      VARCHAR(100) NOT NULL,
  applies_to VARCHAR(20)[] NOT NULL DEFAULT '{}',
  data_type  VARCHAR(20) NOT NULL DEFAULT 'text'
);

-- Seed data
INSERT INTO attribute_definitions (key, label, applies_to, data_type) VALUES
  -- person
  ('birthday',      'Birthday',       '{person}',       'date'),
  ('employer',      'Employer',       '{person}',       'text'),
  ('job_title',     'Job Title',      '{person}',       'text'),
  ('city',          'City',           '{person,organization,location}', 'text'),
  ('country',       'Country',        '{person,organization,location}', 'text'),
  ('school',        'School',         '{person}',       'text'),
  ('university',    'University',     '{person}',       'text'),
  ('linkedin',      'LinkedIn',       '{person}',       'text'),
  ('twitter',       'Twitter/X',      '{person,organization}', 'text'),
  ('instagram',     'Instagram',      '{person,organization}', 'text'),
  ('languages',     'Languages',      '{person}',       'text'),
  ('interests',     'Interests',      '{person}',       'text'),
  ('bio',           'Bio',            '{person}',       'text'),
  -- organization
  ('industry',      'Industry',       '{organization}', 'text'),
  ('website',       'Website',        '{organization}', 'text'),
  ('headquarters',  'Headquarters',   '{organization}', 'text'),
  ('founded_year',  'Founded Year',   '{organization}', 'number'),
  ('size',          'Size',           '{organization}', 'text'),
  -- location
  ('coordinates',   'Coordinates',    '{location}',     'text'),
  -- event
  ('date',          'Date',           '{event}',        'date'),
  ('location',      'Location',       '{event}',        'text'),
  ('url',           'URL',            '{event}',        'text'),
  ('organizer',     'Organizer',      '{event}',        'text'),
  -- project
  ('status',        'Status',         '{project}',      'text'),
  ('deadline',      'Deadline',       '{project}',      'date'),
  ('client',        'Client',         '{project}',      'text'),
  -- asset
  ('asset_type',    'Asset Type',     '{asset}',        'text'),
  ('value',         'Value',          '{asset}',        'text'),
  ('acquired_date', 'Acquired Date',  '{asset}',        'date');

-- ============================================================
-- 8. Tags
-- ============================================================

CREATE TABLE tags (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  category   VARCHAR(20) NOT NULL DEFAULT 'topic',
  color      VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT tags_category_check CHECK (
    category IN ('topic','geographic','project','personal')
  )
);

-- ============================================================
-- 9. Record tags (polymorphic junction)
-- ============================================================

CREATE TABLE record_tags (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id       UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  record_id    UUID NOT NULL,
  record_table VARCHAR(40) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at   TIMESTAMPTZ,
  UNIQUE(tag_id, record_id, record_table),
  CONSTRAINT valid_record_table CHECK (
    record_table IN ('entities','intel','relations','sources')
  )
);

-- ============================================================
-- 10. Triggers: updated_at
-- ============================================================

CREATE OR REPLACE TRIGGER update_entity_attributes_updated_at
  BEFORE UPDATE ON entity_attributes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_record_tags_updated_at
  BEFORE UPDATE ON record_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. Triggers: sync_log
-- ============================================================

CREATE OR REPLACE TRIGGER trg_sync_log_entity_attributes
  AFTER INSERT OR UPDATE OR DELETE ON entity_attributes
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE OR REPLACE TRIGGER trg_sync_log_tags
  AFTER INSERT OR UPDATE OR DELETE ON tags
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE OR REPLACE TRIGGER trg_sync_log_record_tags
  AFTER INSERT OR UPDATE OR DELETE ON record_tags
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

-- ============================================================
-- 12. RLS policies for new tables
-- ============================================================

ALTER TABLE entity_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_tags ENABLE ROW LEVEL SECURITY;

-- entity_attributes
CREATE POLICY "Users can read entity_attributes" ON entity_attributes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert entity_attributes" ON entity_attributes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update entity_attributes" ON entity_attributes
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete entity_attributes" ON entity_attributes
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- tags
CREATE POLICY "Users can read tags" ON tags
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update tags" ON tags
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete tags" ON tags
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- record_tags
CREATE POLICY "Users can read record_tags" ON record_tags
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert record_tags" ON record_tags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update record_tags" ON record_tags
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete record_tags" ON record_tags
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 13. Grants for new tables
-- ============================================================

GRANT ALL ON TABLE entity_attributes TO anon, authenticated, service_role;
GRANT ALL ON TABLE attribute_definitions TO anon, authenticated, service_role;
GRANT ALL ON TABLE tags TO anon, authenticated, service_role;
GRANT ALL ON TABLE record_tags TO anon, authenticated, service_role;

COMMIT;
