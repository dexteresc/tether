-- Tether Intelligence System - Triggers
-- Automatically update timestamps and maintain data integrity

-- ============================================================================
-- UPDATE_UPDATED_AT_COLUMN Trigger Function
-- Automatically sets updated_at to current timestamp on row updates
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Trigger function to automatically update updated_at timestamp';

-- ============================================================================
-- Apply updated_at triggers to all tables
-- ============================================================================

-- Sources table
CREATE TRIGGER update_sources_updated_at
BEFORE UPDATE ON sources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Entities table
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Identifiers table
CREATE TRIGGER update_identifiers_updated_at
BEFORE UPDATE ON identifiers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Relations table
CREATE TRIGGER update_relations_updated_at
BEFORE UPDATE ON relations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Intel table
CREATE TRIGGER update_intel_updated_at
BEFORE UPDATE ON intel
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Intel_entities table
CREATE TRIGGER update_intel_entities_updated_at
BEFORE UPDATE ON intel_entities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
