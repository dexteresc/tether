-- Update entity type check constraint to support 'event' as an entity type (common LLM extraction)
ALTER TABLE entities DROP CONSTRAINT IF EXISTS valid_entity_type;
ALTER TABLE entities ADD CONSTRAINT valid_entity_type CHECK (type IN ('person', 'organization', 'group', 'vehicle', 'location', 'event'));
