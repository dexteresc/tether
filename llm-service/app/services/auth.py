from jose import jwt, JWTError, jwk
from typing import Optional
import logging
import time
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# JWKS cache with TTL
_jwks_keys: Optional[dict] = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600  # 1 hour


def _load_jwks() -> dict:
    """
    Fetch JWKS public keys from Supabase for ES256 token verification.
    Keys are cached with a TTL and refreshed automatically when stale.

    Returns:
        Dict mapping kid -> JWK key object
    """
    global _jwks_keys, _jwks_fetched_at

    # Return cached keys if still fresh
    if _jwks_keys is not None and (time.monotonic() - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_keys

    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        response = httpx.get(jwks_url, timeout=10)
        response.raise_for_status()
        jwks_data = response.json()
        new_keys = {}
        for key_data in jwks_data.get("keys", []):
            kid = key_data.get("kid")
            if kid:
                new_keys[kid] = key_data
        _jwks_keys = new_keys
        _jwks_fetched_at = time.monotonic()
        logger.info(f"Loaded {len(_jwks_keys)} JWKS key(s) from Supabase")
    except httpx.HTTPError as e:
        logger.warning(f"HTTP error loading JWKS from Supabase: {e}")
        if _jwks_keys is None:
            _jwks_keys = {}
    except httpx.RequestError as e:
        logger.warning(f"Network error loading JWKS from Supabase: {e}")
        if _jwks_keys is None:
            _jwks_keys = {}

    return _jwks_keys


def verify_supabase_jwt(token: str) -> Optional[str]:
    """
    Verify a Supabase JWT token (ES256 via JWKS) and extract the user_id.

    Args:
        token: JWT token string

    Returns:
        User ID if token is valid, None otherwise
    """
    try:
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")

        if not kid:
            logger.error("JWT missing kid header")
            return None

        keys = _load_jwks()
        key_data = keys.get(kid)
        if not key_data:
            logger.error(f"Unknown kid in JWT: {kid}")
            return None

        key = jwk.construct(key_data, algorithm="ES256")
        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience="authenticated",
            options={"require_exp": True},
        )

        user_id = payload.get("sub")
        if not user_id:
            logger.warning("No user_id found in JWT payload")
            return None

        return user_id
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        return None


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

    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching user info for {user_id}: {e}")
        return None
    except (KeyError, AttributeError) as e:
        logger.error(f"Error parsing user info for {user_id}: {e}")
        return None

    return None
