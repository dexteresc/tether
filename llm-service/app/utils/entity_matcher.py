from supabase import Client
from typing import Optional
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
