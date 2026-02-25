-- Fuzzy search across identifiers using pg_trgm similarity
CREATE OR REPLACE FUNCTION fuzzy_search_identifiers(
    p_query TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    entity_id UUID,
    entity_type VARCHAR,
    entity_data JSONB,
    identifier_type VARCHAR,
    identifier_value TEXT,
    similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS entity_id,
        e.type AS entity_type,
        e.data AS entity_data,
        i.type AS identifier_type,
        i.value AS identifier_value,
        extensions.similarity(i.value, p_query) AS similarity_score
    FROM identifiers i
    JOIN entities e ON e.id = i.entity_id
    WHERE e.deleted_at IS NULL
      AND i.deleted_at IS NULL
      AND extensions.similarity(i.value, p_query) > 0.15
    ORDER BY extensions.similarity(i.value, p_query) DESC
    LIMIT p_limit;
END;
$$;
