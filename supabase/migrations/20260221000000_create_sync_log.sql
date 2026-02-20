-- Sync Log: Linear-style event log for reliable client sync.
-- Every INSERT, UPDATE, DELETE on tracked tables is recorded with a monotonic
-- sequence number so clients can consume a single ordered stream.

-- ============================================================================
-- SYNC_LOG TABLE
-- ============================================================================
CREATE TABLE sync_log (
  seq        BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id  UUID NOT NULL,
  operation  TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_log_created_at ON sync_log (created_at);

COMMENT ON TABLE sync_log IS 'Append-only event log for sync — clients consume via monotonic seq cursor';

-- ============================================================================
-- TRIGGER FUNCTION
-- Fires AFTER INSERT/UPDATE/DELETE so it captures final row state
-- (after the BEFORE UPDATE trigger sets updated_at = NOW()).
-- ============================================================================
CREATE OR REPLACE FUNCTION write_sync_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO sync_log (table_name, record_id, operation, row_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO sync_log (table_name, record_id, operation, row_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSE -- UPDATE
    INSERT INTO sync_log (table_name, record_id, operation, row_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION write_sync_log IS 'AFTER trigger function that appends to sync_log for every mutation';

-- ============================================================================
-- ATTACH TRIGGERS TO ALL 6 TRACKED TABLES
-- ============================================================================
CREATE TRIGGER trg_sync_log_sources
  AFTER INSERT OR UPDATE OR DELETE ON sources
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE TRIGGER trg_sync_log_entities
  AFTER INSERT OR UPDATE OR DELETE ON entities
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE TRIGGER trg_sync_log_identifiers
  AFTER INSERT OR UPDATE OR DELETE ON identifiers
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE TRIGGER trg_sync_log_relations
  AFTER INSERT OR UPDATE OR DELETE ON relations
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE TRIGGER trg_sync_log_intel
  AFTER INSERT OR UPDATE OR DELETE ON intel
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

CREATE TRIGGER trg_sync_log_intel_entities
  AFTER INSERT OR UPDATE OR DELETE ON intel_entities
  FOR EACH ROW EXECUTE FUNCTION write_sync_log();

-- ============================================================================
-- RLS + GRANTS
-- ============================================================================
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sync_log"
  ON sync_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

GRANT SELECT ON sync_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sync_log_seq_seq TO authenticated;
