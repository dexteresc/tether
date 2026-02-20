-- Tether Intelligence System - Core Schema Migration
-- Translates Go models to PostgreSQL schema

-- ============================================================================
-- SOURCES TABLE
-- Tracks data sources with reliability ratings
-- ============================================================================
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL,
  reliability CHAR(1) NOT NULL CHECK (reliability IN ('A', 'B', 'C', 'D', 'E', 'F')),
  data JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_reliability CHECK (reliability IN ('A', 'B', 'C', 'D', 'E', 'F'))
);

CREATE INDEX idx_sources_code ON sources(code);
CREATE INDEX idx_sources_active ON sources(active);
CREATE INDEX idx_sources_deleted_at ON sources(deleted_at);

COMMENT ON TABLE sources IS 'Data sources with reliability ratings (A=completely reliable to F=cannot be judged)';
COMMENT ON COLUMN sources.reliability IS 'A=Completely reliable, B=Usually reliable, C=Fairly reliable, D=Not usually reliable, E=Unreliable, F=Cannot be judged';

-- ============================================================================
-- ENTITIES TABLE
-- Core entities: people, organizations, groups, vehicles, locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('person', 'organization', 'group', 'vehicle', 'location')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_entity_type CHECK (type IN ('person', 'organization', 'group', 'vehicle', 'location'))
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_deleted_at ON entities(deleted_at);
CREATE INDEX idx_entities_data_gin ON entities USING GIN(data);

COMMENT ON TABLE entities IS 'Core entities in the intelligence system';
COMMENT ON COLUMN entities.data IS 'JSONB field for flexible entity-specific data';

-- ============================================================================
-- IDENTIFIERS TABLE
-- Multiple identifiers per entity (email, name, phone, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('name', 'document', 'biometric', 'phone', 'email', 'handle', 'address', 'registration', 'domain')),
  value TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_identifier_type CHECK (type IN ('name', 'document', 'biometric', 'phone', 'email', 'handle', 'address', 'registration', 'domain'))
);

CREATE INDEX idx_identifiers_entity_id ON identifiers(entity_id);
CREATE INDEX idx_identifiers_type_value ON identifiers(type, value);
CREATE INDEX idx_identifiers_deleted_at ON identifiers(deleted_at);

COMMENT ON TABLE identifiers IS 'Multiple identifiers for each entity (name, email, phone, etc.)';
COMMENT ON COLUMN identifiers.metadata IS 'Additional metadata about the identifier';

-- ============================================================================
-- RELATIONS TABLE
-- Relationships between entities with temporal validity
-- ============================================================================
CREATE TABLE IF NOT EXISTS relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('parent', 'child', 'sibling', 'spouse', 'colleague', 'associate', 'friend', 'member', 'owner')),
  strength SMALLINT CHECK (strength IS NULL OR (strength >= 1 AND strength <= 10)),
  valid_from DATE,
  valid_to DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT no_self_relation CHECK (source_id != target_id),
  CONSTRAINT valid_relation_type CHECK (type IN ('parent', 'child', 'sibling', 'spouse', 'colleague', 'associate', 'friend', 'member', 'owner')),
  CONSTRAINT valid_strength CHECK (strength IS NULL OR (strength >= 1 AND strength <= 10))
);

CREATE INDEX idx_relations_source_id ON relations(source_id);
CREATE INDEX idx_relations_target_id ON relations(target_id);
CREATE INDEX idx_relations_type ON relations(type);
CREATE INDEX idx_relations_deleted_at ON relations(deleted_at);
CREATE INDEX idx_relations_valid_dates ON relations(valid_from, valid_to);

COMMENT ON TABLE relations IS 'Relationships between entities with strength and temporal validity';
COMMENT ON COLUMN relations.strength IS 'Relationship strength (1-10)';
COMMENT ON COLUMN relations.valid_from IS 'Start date of relationship validity';
COMMENT ON COLUMN relations.valid_to IS 'End date of relationship validity';

-- ============================================================================
-- INTEL TABLE
-- Intelligence records with confidence levels
-- ============================================================================
CREATE TABLE IF NOT EXISTS intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('event', 'communication', 'sighting', 'report', 'document', 'media', 'financial')),
  occurred_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  confidence VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (confidence IN ('confirmed', 'high', 'medium', 'low', 'unconfirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_intel_type CHECK (type IN ('event', 'communication', 'sighting', 'report', 'document', 'media', 'financial')),
  CONSTRAINT valid_confidence CHECK (confidence IN ('confirmed', 'high', 'medium', 'low', 'unconfirmed'))
);

CREATE INDEX idx_intel_occurred_at ON intel(occurred_at);
CREATE INDEX idx_intel_source_id ON intel(source_id);
CREATE INDEX idx_intel_type ON intel(type);
CREATE INDEX idx_intel_confidence ON intel(confidence);
CREATE INDEX idx_intel_data_gin ON intel USING GIN(data);
CREATE INDEX idx_intel_deleted_at ON intel(deleted_at);

COMMENT ON TABLE intel IS 'Intelligence records with occurrence time and confidence levels';
COMMENT ON COLUMN intel.occurred_at IS 'When the intelligence event occurred (not when it was recorded)';
COMMENT ON COLUMN intel.confidence IS 'Confidence level: confirmed, high, medium, low, or unconfirmed';

-- ============================================================================
-- INTEL_ENTITIES TABLE
-- Junction table linking intelligence to entities
-- ============================================================================
CREATE TABLE IF NOT EXISTS intel_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intel_id UUID NOT NULL REFERENCES intel(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(intel_id, entity_id)
);

CREATE INDEX idx_intel_entities_intel_id ON intel_entities(intel_id);
CREATE INDEX idx_intel_entities_entity_id ON intel_entities(entity_id);
CREATE INDEX idx_intel_entities_deleted_at ON intel_entities(deleted_at);

COMMENT ON TABLE intel_entities IS 'Links intelligence records to entities with optional role';
COMMENT ON COLUMN intel_entities.role IS 'Role of the entity in the intelligence (e.g., subject, witness, source)';
