-- Migration 3: Geospatial + Search + Graph
-- Adds PostGIS, pg_trgm, geometry columns, FTS, fuzzy search, geo functions, improved graph traversal

BEGIN;

-- ============================================================
-- 1. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================
-- 2. Geometry columns
-- ============================================================

ALTER TABLE entities ADD COLUMN geom extensions.geometry(Point, 4326);
ALTER TABLE intel ADD COLUMN geom extensions.geometry(Point, 4326);

CREATE INDEX idx_entities_geom ON entities USING GIST (geom)
  WHERE geom IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_intel_geom ON intel USING GIST (geom)
  WHERE geom IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 3. Full-text search on intel
-- ============================================================

ALTER TABLE intel ADD COLUMN search_vector TSVECTOR;

CREATE INDEX idx_intel_fts ON intel USING GIN (search_vector)
  WHERE deleted_at IS NULL;

-- Trigger to auto-populate search_vector from data JSONB
CREATE OR REPLACE FUNCTION intel_search_vector_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.data->>'description', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.data->>'content', '')), 'B');
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_intel_search_vector
  BEFORE INSERT OR UPDATE OF data ON intel
  FOR EACH ROW EXECUTE FUNCTION intel_search_vector_trigger();

-- Backfill existing rows
UPDATE intel SET search_vector =
  setweight(to_tsvector('english', COALESCE(data->>'description', '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(data->>'content', '')), 'B')
WHERE deleted_at IS NULL;

-- ============================================================
-- 4. Fuzzy identifier search (trigram index)
-- ============================================================

CREATE INDEX idx_identifiers_trgm ON identifiers
  USING GIN (value extensions.gin_trgm_ops) WHERE deleted_at IS NULL;

-- ============================================================
-- 5. Geospatial functions
-- ============================================================

-- Find entities near a point
CREATE OR REPLACE FUNCTION find_entities_near(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_radius_m INTEGER DEFAULT 50000,
  p_entity_type VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  entity_id UUID,
  entity_type VARCHAR(20),
  entity_data JSONB,
  distance_m DOUBLE PRECISION
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.type,
    e.data,
    ST_Distance(e.geom::extensions.geography, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography) AS distance_m
  FROM entities e
  WHERE e.geom IS NOT NULL
    AND e.deleted_at IS NULL
    AND ST_DWithin(e.geom::extensions.geography, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography, p_radius_m)
    AND (p_entity_type IS NULL OR e.type = p_entity_type)
  ORDER BY distance_m;
END; $$;

-- Find intel near a point with optional date range
CREATE OR REPLACE FUNCTION find_intel_near(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_radius_m INTEGER DEFAULT 50000,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  intel_id UUID,
  intel_type VARCHAR(20),
  intel_data JSONB,
  occurred_at TIMESTAMPTZ,
  distance_m DOUBLE PRECISION
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.type,
    i.data,
    i.occurred_at,
    ST_Distance(i.geom::extensions.geography, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography) AS distance_m
  FROM intel i
  WHERE i.geom IS NOT NULL
    AND i.deleted_at IS NULL
    AND ST_DWithin(i.geom::extensions.geography, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography, p_radius_m)
    AND (p_from_date IS NULL OR i.occurred_at >= p_from_date)
    AND (p_to_date IS NULL OR i.occurred_at <= p_to_date)
  ORDER BY distance_m;
END; $$;

-- ============================================================
-- 6. Improved graph traversal (cycle-safe with filtering)
-- ============================================================

CREATE OR REPLACE FUNCTION get_entity_graph_v2(
  p_entity_id UUID,
  p_depth INTEGER DEFAULT 2,
  p_relation_types VARCHAR[] DEFAULT NULL,
  p_min_strength SMALLINT DEFAULT NULL
)
RETURNS TABLE(
  entity_id UUID,
  entity_type VARCHAR(20),
  entity_data JSONB,
  relation_id UUID,
  relation_type VARCHAR(30),
  relation_source_id UUID,
  relation_target_id UUID,
  relation_strength SMALLINT,
  depth INTEGER,
  path UUID[]
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE entity_graph AS (
    -- Base case: root entity
    SELECT
      e.id AS entity_id,
      e.type AS entity_type,
      e.data AS entity_data,
      NULL::UUID AS relation_id,
      NULL::VARCHAR(30) AS relation_type,
      NULL::UUID AS relation_source_id,
      NULL::UUID AS relation_target_id,
      NULL::SMALLINT AS relation_strength,
      0 AS depth,
      ARRAY[e.id] AS path
    FROM entities e
    WHERE e.id = p_entity_id
      AND e.deleted_at IS NULL

    UNION ALL

    -- Recursive: traverse outgoing relations
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      eg.depth + 1,
      eg.path || e.id
    FROM entity_graph eg
    INNER JOIN relations r ON r.source_id = eg.entity_id
    INNER JOIN entities e ON e.id = r.target_id
    WHERE eg.depth < p_depth
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND NOT (e.id = ANY(eg.path))  -- cycle detection
      AND (p_relation_types IS NULL OR r.type = ANY(p_relation_types))
      AND (p_min_strength IS NULL OR r.strength >= p_min_strength)

    UNION ALL

    -- Recursive: traverse incoming relations
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      eg.depth + 1,
      eg.path || e.id
    FROM entity_graph eg
    INNER JOIN relations r ON r.target_id = eg.entity_id
    INNER JOIN entities e ON e.id = r.source_id
    WHERE eg.depth < p_depth
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND NOT (e.id = ANY(eg.path))  -- cycle detection
      AND (p_relation_types IS NULL OR r.type = ANY(p_relation_types))
      AND (p_min_strength IS NULL OR r.strength >= p_min_strength)
  )
  SELECT DISTINCT ON (eg.entity_id)
    eg.entity_id,
    eg.entity_type,
    eg.entity_data,
    eg.relation_id,
    eg.relation_type,
    eg.relation_source_id,
    eg.relation_target_id,
    eg.relation_strength,
    eg.depth,
    eg.path
  FROM entity_graph eg
  ORDER BY eg.entity_id, eg.depth;
END; $$;

-- ============================================================
-- 7. Shortest path between two entities
-- ============================================================

CREATE OR REPLACE FUNCTION find_shortest_path(
  p_source_id UUID,
  p_target_id UUID,
  p_max_depth INTEGER DEFAULT 6
)
RETURNS TABLE(
  path UUID[],
  depth INTEGER,
  relation_types VARCHAR[]
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE search AS (
    SELECT
      ARRAY[p_source_id] AS path,
      0 AS depth,
      ARRAY[]::VARCHAR[] AS relation_types

    UNION ALL

    SELECT
      s.path || connected_id,
      s.depth + 1,
      s.relation_types || r.type
    FROM search s
    CROSS JOIN LATERAL (
      SELECT r.id, r.type, r.target_id AS connected_id
      FROM relations r
      WHERE r.source_id = s.path[array_length(s.path, 1)]
        AND r.deleted_at IS NULL
        AND NOT (r.target_id = ANY(s.path))
      UNION ALL
      SELECT r.id, r.type, r.source_id AS connected_id
      FROM relations r
      WHERE r.target_id = s.path[array_length(s.path, 1)]
        AND r.deleted_at IS NULL
        AND NOT (r.source_id = ANY(s.path))
    ) r
    WHERE s.depth < p_max_depth
  )
  SELECT s.path, s.depth, s.relation_types
  FROM search s
  WHERE s.path[array_length(s.path, 1)] = p_target_id
  ORDER BY s.depth
  LIMIT 1;
END; $$;

-- ============================================================
-- 8. Materialized view: entity connection counts
-- ============================================================

CREATE MATERIALIZED VIEW entity_connection_counts AS
SELECT e.id, e.type,
  COUNT(DISTINCT CASE WHEN r.source_id = e.id THEN r.target_id ELSE r.source_id END) AS connections
FROM entities e
LEFT JOIN relations r ON (r.source_id = e.id OR r.target_id = e.id) AND r.deleted_at IS NULL
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.type;

CREATE UNIQUE INDEX idx_ecc_id ON entity_connection_counts(id);

-- ============================================================
-- 9. Grants for new functions
-- ============================================================

GRANT ALL ON FUNCTION find_entities_near(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, VARCHAR) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION find_intel_near(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION get_entity_graph_v2(UUID, INTEGER, VARCHAR[], SMALLINT) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION find_shortest_path(UUID, UUID, INTEGER) TO anon, authenticated, service_role;
GRANT ALL ON TABLE entity_connection_counts TO anon, authenticated, service_role;

COMMIT;
