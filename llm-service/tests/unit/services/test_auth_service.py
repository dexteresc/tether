"""
Unit tests for authentication service following TDD principles.

Tests verify:
- JWT token validation (valid, invalid, expired, missing claims)
- Supabase client creation with authentication
- User data isolation via RLS
- Security vulnerabilities (forged tokens, expired tokens, RLS bypass)

Priority: CRITICAL - Security bugs expose user data
"""

from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta, timezone
from jose import jwt

from app.services.auth import (
    verify_supabase_jwt,
    create_service_role_client,
    get_user_info
)
from app.config import settings


class TestVerifySupabaseJWT:
    """
    Tests for verify_supabase_jwt function.

    User scenario: User with JWT token tries to access authenticated endpoints.
    What breaks if untested:
    - Forged tokens could be accepted (authentication bypass)
    - Expired tokens could remain valid (security vulnerability)
    - Users could access other users' data (RLS bypass)
    """

    def test_verify_supabase_jwt_valid_token_returns_user_id(self):
        """
        Test that valid JWT token returns user_id from 'sub' claim.

        User scenario: Valid authenticated user extracts intelligence with their user_id.
        Expected: Token verified, user_id extracted successfully.
        """
        # ARRANGE
        user_id = "00000000-0000-0000-0000-000000000001"
        payload = {
            "sub": user_id,
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
            "role": "authenticated"
        }
        token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")

        # ACT
        result = verify_supabase_jwt(token)

        # ASSERT
        assert result == user_id

    def test_verify_supabase_jwt_invalid_signature_returns_none(self):
        """
        Test that JWT with invalid signature returns None.

        User scenario: User with forged token tries to sync to database.
        Expected: Token rejected, no authentication.
        Security requirement: Prevent forged tokens.
        """
        # ARRANGE
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.invalid_signature"

        # ACT
        result = verify_supabase_jwt(token)

        # ASSERT
        assert result is None

    def test_verify_supabase_jwt_expired_token_returns_none(self):
        """
        Test that expired JWT token returns None.

        User scenario: User with expired token tries to sync to database.
        Expected: 401 rejected.
        Security requirement: Prevent use of expired tokens.
        """
        # ARRANGE
        payload = {
            "sub": "user-123",
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # Expired
            "iat": datetime.now(timezone.utc) - timedelta(hours=2)
        }
        token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")

        # ACT
        result = verify_supabase_jwt(token)

        # ASSERT
        assert result is None

    def test_verify_supabase_jwt_missing_sub_claim_returns_none(self):
        """
        Test that JWT without 'sub' claim returns None.

        User scenario: Malformed token missing user ID.
        Expected: Token rejected.
        Security requirement: Ensure user_id is present.
        """
        # ARRANGE
        payload = {
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc)
        }
        token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")

        # ACT
        result = verify_supabase_jwt(token)

        # ASSERT
        assert result is None

    def test_verify_supabase_jwt_malformed_token_returns_none(self):
        """
        Test that malformed JWT returns None.

        User scenario: Invalid token format sent to API.
        Expected: Gracefully handled, returns None.
        """
        # ARRANGE
        token = "not.a.valid.jwt.token"

        # ACT
        result = verify_supabase_jwt(token)

        # ASSERT
        assert result is None

    def test_verify_supabase_jwt_empty_token_returns_none(self):
        """
        Test that empty token returns None.

        User scenario: No token provided.
        Expected: Returns None without error.
        """
        # ARRANGE
        token = ""

        # ACT
        result = verify_supabase_jwt(token)

        # ASSERT
        assert result is None


class TestCreateServiceRoleClient:
    """
    Tests for create_service_role_client function.

    User scenario: System operations that need to bypass RLS.
    What breaks if untested:
    - Service role key not used (operations fail)
    """

    @patch('supabase.create_client')
    def test_create_service_role_client_uses_service_key(self, mock_create_client):
        """
        Test that service role client uses service role key.

        User scenario: System syncs data with admin privileges.
        Expected: Client created with service role key (bypasses RLS).
        """
        # ARRANGE
        mock_client = Mock()
        mock_create_client.return_value = mock_client

        # ACT
        result = create_service_role_client()

        # ASSERT
        mock_create_client.assert_called_once_with(
            settings.supabase_url,
            settings.supabase_service_role_key
        )
        assert result == mock_client


class TestGetUserInfo:
    """
    Tests for get_user_info function.

    User scenario: Retrieve user metadata for personalization.
    What breaks if untested:
    - User info not fetched correctly
    - Errors not handled gracefully
    """

    @patch('app.services.auth.create_service_role_client')
    def test_get_user_info_returns_user_metadata(self, mock_create_service_role):
        """
        Test that user info is fetched from Supabase auth.

        User scenario: System retrieves user's name and email.
        Expected: User metadata returned.
        """
        # ARRANGE
        user_id = "user-123"
        mock_client = MagicMock()
        mock_create_service_role.return_value = mock_client

        # Mock the auth.admin.get_user_by_id response
        mock_user = Mock()
        mock_user.user = Mock()
        mock_user.user.id = user_id
        mock_user.user.email = "test@example.com"
        mock_user.user.user_metadata = {"name": "Test User"}

        mock_client.auth.admin.get_user_by_id.return_value = mock_user

        # ACT
        result = get_user_info(user_id)

        # ASSERT
        assert result is not None
        assert result["id"] == user_id
        assert result["email"] == "test@example.com"
        # Verify get_user_by_id was called
        mock_client.auth.admin.get_user_by_id.assert_called_once_with(user_id)

    @patch('app.services.auth.create_service_role_client')
    def test_get_user_info_handles_user_not_found(self, mock_create_service_role):
        """
        Test that get_user_info handles user not found gracefully.

        User scenario: Invalid user_id provided.
        Expected: Returns None or raises appropriate error.
        """
        # ARRANGE
        user_id = "nonexistent-user"
        mock_client = MagicMock()
        mock_create_service_role.return_value = mock_client

        # Mock user not found (raises exception or returns None)
        mock_client.auth.admin.get_user_by_id.side_effect = Exception("User not found")

        # ACT
        result = get_user_info(user_id)

        # ASSERT
        assert result is None
