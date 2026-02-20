-- Grant table-level permissions to authenticated role
-- RLS policies (already in place) handle row-level access control
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sources, entities, identifiers, relations, intel, intel_entities
  TO authenticated;
