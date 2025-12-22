-- Tether Intelligence System - Database Functions
-- Replace Go service layer with PostgreSQL functions

-- ============================================================================
-- CREATE_USER_ENTITY Function
-- Replaces services/user.go CreateUser transaction
-- Creates a person entity with email and name identifiers
-- ============================================================================
CREATE OR REPLACE FUNCTION create_user_entity(
  p_email TEXT,
  p_name TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id UUID;
  v_user_id UUID;
BEGIN
  -- Use provided user_id or get from auth context
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;

  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  -- Create entity with user metadata
  INSERT INTO entities (type, data)
  VALUES (
    'person',
    jsonb_build_object(
      'user', true,
      'name', p_name,
      'user_id', v_user_id
    )
  )
  RETURNING id INTO v_entity_id;

  -- Create email identifier
  INSERT INTO identifiers (entity_id, type, value)
  VALUES (v_entity_id, 'email', p_email);

  -- Create name identifier
  INSERT INTO identifiers (entity_id, type, value)
  VALUES (v_entity_id, 'name', p_name);

  RETURN v_entity_id;
END;
$$;

COMMENT ON FUNCTION create_user_entity IS 'Creates a person entity with email and name identifiers. Used during user signup.';

-- ============================================================================
-- GET_ENTITY_GRAPH Function
-- Recursively traverse entity relationships
-- Returns entity graph with configurable depth
-- ============================================================================
CREATE OR REPLACE FUNCTION get_entity_graph(
  p_entity_id UUID,
  p_depth INT DEFAULT 2
)
RETURNS TABLE (
  entity_id UUID,
  entity_type VARCHAR(20),
  entity_data JSONB,
  relation_id UUID,
  relation_type VARCHAR(30),
  relation_source_id UUID,
  relation_target_id UUID,
  relation_strength SMALLINT,
  depth INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE entity_graph AS (
    -- Base case: Get the root entity
    SELECT
      e.id as entity_id,
      e.type as entity_type,
      e.data as entity_data,
      NULL::UUID as relation_id,
      NULL::VARCHAR(30) as relation_type,
      NULL::UUID as relation_source_id,
      NULL::UUID as relation_target_id,
      NULL::SMALLINT as relation_strength,
      0 as depth
    FROM entities e
    WHERE e.id = p_entity_id
      AND e.deleted_at IS NULL

    UNION

    -- Recursive case: Direct relations (outgoing)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      1 as depth
    FROM entities e
    INNER JOIN relations r ON r.target_id = e.id
    WHERE r.source_id = p_entity_id
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL

    UNION

    -- Recursive case: Direct relations (incoming)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      1 as depth
    FROM entities e
    INNER JOIN relations r ON r.source_id = e.id
    WHERE r.target_id = p_entity_id
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL

    UNION ALL

    -- Recursive case: Traverse deeper (outgoing)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      eg.depth + 1
    FROM entity_graph eg
    INNER JOIN relations r ON r.source_id = eg.entity_id
    INNER JOIN entities e ON e.id = r.target_id
    WHERE eg.depth < p_depth
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND eg.entity_id != p_entity_id  -- Avoid returning to root

    UNION ALL

    -- Recursive case: Traverse deeper (incoming)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      eg.depth + 1
    FROM entity_graph eg
    INNER JOIN relations r ON r.target_id = eg.entity_id
    INNER JOIN entities e ON e.id = r.source_id
    WHERE eg.depth < p_depth
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND eg.entity_id != p_entity_id  -- Avoid returning to root
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
    eg.depth
  FROM entity_graph eg
  ORDER BY eg.entity_id, eg.depth;
END;
$$;

COMMENT ON FUNCTION get_entity_graph IS 'Recursively traverse entity relationships up to specified depth. Returns graph data for visualization.';

-- ============================================================================
-- GET_ENTITY_WITH_DETAILS Function
-- Get entity with all identifiers and basic relations
-- Useful for entity detail views
-- ============================================================================
CREATE OR REPLACE FUNCTION get_entity_with_details(p_entity_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'entity', row_to_json(e.*),
    'identifiers', (
      SELECT json_agg(row_to_json(i.*))
      FROM identifiers i
      WHERE i.entity_id = p_entity_id
        AND i.deleted_at IS NULL
    ),
    'relations_out', (
      SELECT json_agg(
        json_build_object(
          'relation', row_to_json(r.*),
          'target_entity', row_to_json(te.*)
        )
      )
      FROM relations r
      INNER JOIN entities te ON te.id = r.target_id
      WHERE r.source_id = p_entity_id
        AND r.deleted_at IS NULL
        AND te.deleted_at IS NULL
    ),
    'relations_in', (
      SELECT json_agg(
        json_build_object(
          'relation', row_to_json(r.*),
          'source_entity', row_to_json(se.*)
        )
      )
      FROM relations r
      INNER JOIN entities se ON se.id = r.source_id
      WHERE r.target_id = p_entity_id
        AND r.deleted_at IS NULL
        AND se.deleted_at IS NULL
    ),
    'intel', (
      SELECT json_agg(
        json_build_object(
          'intel', row_to_json(i.*),
          'intel_entity', row_to_json(ie.*)
        )
      )
      FROM intel_entities ie
      INNER JOIN intel i ON i.id = ie.intel_id
      WHERE ie.entity_id = p_entity_id
        AND ie.deleted_at IS NULL
        AND i.deleted_at IS NULL
    )
  )
  INTO v_result
  FROM entities e
  WHERE e.id = p_entity_id
    AND e.deleted_at IS NULL;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_entity_with_details IS 'Get complete entity details including identifiers, relations, and linked intelligence';

-- ============================================================================
-- SEARCH_ENTITIES_BY_IDENTIFIER Function
-- Search entities by identifier value
-- Useful for finding entities by name, email, phone, etc.
-- ============================================================================
CREATE OR REPLACE FUNCTION search_entities_by_identifier(
  p_search_value TEXT,
  p_identifier_type VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
  entity_id UUID,
  entity_type VARCHAR(20),
  entity_data JSONB,
  identifier_type VARCHAR(20),
  identifier_value TEXT,
  identifier_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.type,
    e.data,
    i.type,
    i.value,
    i.id
  FROM entities e
  INNER JOIN identifiers i ON i.entity_id = e.id
  WHERE i.value ILIKE '%' || p_search_value || '%'
    AND (p_identifier_type IS NULL OR i.type = p_identifier_type)
    AND e.deleted_at IS NULL
    AND i.deleted_at IS NULL
  ORDER BY
    CASE WHEN i.value ILIKE p_search_value THEN 0 ELSE 1 END,  -- Exact matches first
    i.value;
END;
$$;

COMMENT ON FUNCTION search_entities_by_identifier IS 'Search for entities by identifier value (name, email, phone, etc.)';
