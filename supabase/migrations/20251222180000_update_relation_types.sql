-- Update relation_type check constraint to support additional types extracted by LLM
-- Drop both the auto-generated constraint and our custom one
ALTER TABLE relations DROP CONSTRAINT IF EXISTS relations_type_check;
ALTER TABLE relations DROP CONSTRAINT IF EXISTS valid_relation_type;
ALTER TABLE relations ADD CONSTRAINT valid_relation_type CHECK (type IN ('parent', 'child', 'sibling', 'spouse', 'colleague', 'associate', 'friend', 'member', 'owner', 'founder', 'co-founder', 'visited', 'employee'));