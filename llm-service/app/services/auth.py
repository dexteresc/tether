from jose import jwt, JWTError
from typing import Optional
from app.config import settings


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
            print("No user_id found in JWT payload")
            return None

        return user_id
    except JWTError as e:
        print(f"JWT verification failed: {e}")
        return None
    except Exception as e:
        print(f"Error verifying JWT: {e}")
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
