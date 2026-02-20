from supabase import Client
from typing import Optional, Dict, List
import json
import logging

logger = logging.getLogger(__name__)


def find_entity_by_identifier(
    supabase: Client,
    identifier_type: str,
    identifier_value: str,
    user_id: str,
) -> Optional[str]:
    """
    Find an entity by searching for a specific identifier.

    Args:
        supabase: Supabase client
        identifier_type: Type of identifier (e.g., "name", "email", "phone")
        identifier_value: Value to search for
        user_id: User ID for RLS enforcement

    Returns:
        Entity ID if found, None otherwise
    """
    try:
        # Case-insensitive search for identifier
        response = (
            supabase.table("identifiers")
            .select("entity_id, entities!inner(data)")
            .ilike("value", identifier_value)
            .eq("type", identifier_type)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]["entity_id"]

        return None
    except Exception as e:
        logger.error(f"Error finding entity by identifier: {e}")
        return None


def find_or_create_entity(
    supabase: Client,
    name: str,
    entity_type: str,
    user_id: str,
    additional_data: Optional[Dict] = None,
) -> str:
    """
    Find an entity by name, or create it if it doesn't exist.

    Args:
        supabase: Supabase client
        name: Entity name
        entity_type: Entity type (person, organization, etc.)
        user_id: User ID for ownership
        additional_data: Additional data to store in entity JSONB

    Returns:
        Entity ID (either found or newly created)
    """
    # First, try to find existing entity by name
    entity_id = find_entity_by_identifier(supabase, "name", name, user_id)

    if entity_id:
        return entity_id

    # Entity not found, create new one
    try:
        # Prepare entity data
        entity_data = {"name": name, "user_id": user_id}
        if additional_data:
            entity_data.update(additional_data)

        # Create entity
        entity_response = (
            supabase.table("entities")
            .insert({"type": entity_type, "data": json.dumps(entity_data)})
            .execute()
        )

        if not entity_response.data or len(entity_response.data) == 0:
            raise Exception("Failed to create entity")

        new_entity_id = entity_response.data[0]["id"]

        # Create name identifier
        supabase.table("identifiers").insert(
            {"entity_id": new_entity_id, "type": "name", "value": name}
        ).execute()

        return new_entity_id
    except Exception as e:
        logger.error(f"Error creating entity: {e}")
        raise


def find_entities_by_names(
    supabase: Client, names: List[str], user_id: str
) -> Dict[str, Optional[str]]:
    """
    Find multiple entities by their names in a single batch.

    Args:
        supabase: Supabase client
        names: List of entity names to search for
        user_id: User ID for RLS enforcement

    Returns:
        Dictionary mapping entity names to their IDs (None if not found)
    """
    result = {}

    for name in names:
        entity_id = find_entity_by_identifier(supabase, "name", name, user_id)
        result[name] = entity_id

    return result
