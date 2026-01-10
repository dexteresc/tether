from jose import jwt, JWTError
from typing import Optional
import logging
from app.config import settings

logger = logging.getLogger(__name__)


def verify_supabase_jwt(token: str) -> Optional[str]:
    """
    Verify a Supabase JWT token and extract the user_id.

    Args:
        token: JWT token string

    Returns:
        User ID if token is valid, None otherwise
    """
    try:
        # Decode the JWT token
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

        # Extract user_id from the "sub" claim
        user_id = payload.get("sub")

        if not user_id:
            logger.warning("No user_id found in JWT payload")
            return None

        return user_id
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Error verifying JWT: {e}")
        return None


def create_authenticated_supabase_client(token: str):
    """
    Create a Supabase client with user authentication.

    Args:
        token: User JWT token

    Returns:
        Authenticated Supabase client
    """
    from supabase import create_client

    # Create client with user token for RLS enforcement
    supabase = create_client(settings.supabase_url, settings.supabase_anon_key)

    # Set the auth token
    supabase.auth.set_session(token, token)

    return supabase


def create_service_role_client():
    """
    Create a Supabase client with service role (admin) privileges.

    Use this ONLY when you need to bypass RLS policies.

    Returns:
        Service role Supabase client
    """
    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_info(user_id: str) -> Optional[dict]:
    """
    Get user information from Supabase auth.

    Args:
        user_id: User ID to fetch

    Returns:
        User info dict with email, name, etc. or None if not found
    """
    try:
        supabase = create_service_role_client()

        # Try to get user from auth.users
        response = supabase.auth.admin.get_user_by_id(user_id)

        if response and response.user:
            user = response.user
            # Extract user metadata
            user_metadata = user.user_metadata or {}

            # Try to get name from various sources
            name = (
                user_metadata.get("full_name")
                or user_metadata.get("name")
                or user.email.split("@")[0] if user.email else None
            )

            return {
                "id": user.id,
                "email": user.email,
                "name": name,
                "metadata": user_metadata
            }

    except Exception as e:
        logger.error(f"Error fetching user info: {e}")
        return None

    return None
