"""
Unit tests for authentication service following TDD principles.

Tests verify:
- JWT token validation (valid, invalid, expired, missing claims) via ES256 JWKS
- Supabase client creation with authentication
- User data isolation via RLS
- Security vulnerabilities (forged tokens, expired tokens, RLS bypass)

Priority: CRITICAL - Security bugs expose user data
"""

from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta, timezone
from jose import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import base64

from app.services.auth import (
    verify_supabase_jwt,
    create_service_role_client,
    get_user_info,
)
from app.config import settings
import app.services.auth as auth_module

# Generate a test ES256 key pair for signing tokens in tests
_test_private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
_test_public_key = _test_private_key.public_key()
_test_kid = "test-key-id"


def _make_jwks_entry():
    """Build a JWKS key dict from the test public key."""
    nums = _test_public_key.public_numbers()
    x_bytes = nums.x.to_bytes(32, "big")
    y_bytes = nums.y.to_bytes(32, "big")
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": base64.urlsafe_b64encode(x_bytes).rstrip(b"=").decode(),
        "y": base64.urlsafe_b64encode(y_bytes).rstrip(b"=").decode(),
        "kid": _test_kid,
        "alg": "ES256",
        "use": "sig",
    }


def _sign_es256_token(payload: dict) -> str:
    """Sign a JWT with the test ES256 private key."""
    return jwt.encode(
        payload,
        _test_private_key,
        algorithm="ES256",
        headers={"kid": _test_kid},
    )


class TestVerifySupabaseJWT:
    """
    Tests for verify_supabase_jwt function (ES256 via JWKS).
    """

    def setup_method(self):
        """Inject test JWKS keys before each test."""
        auth_module._jwks_keys = {_test_kid: _make_jwks_entry()}

    def teardown_method(self):
        """Reset JWKS cache after each test."""
        auth_module._jwks_keys = None

    def test_valid_token_returns_user_id(self):
        """Valid ES256 token returns user_id from 'sub' claim."""
        user_id = "00000000-0000-0000-0000-000000000001"
        payload = {
            "sub": user_id,
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        token = _sign_es256_token(payload)

        result = verify_supabase_jwt(token)

        assert result == user_id

    def test_invalid_signature_returns_none(self):
        """Token with wrong signature returns None."""
        # Sign with a different key
        other_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        payload = {
            "sub": "user-123",
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        token = jwt.encode(
            payload, other_key, algorithm="ES256", headers={"kid": _test_kid}
        )

        result = verify_supabase_jwt(token)

        assert result is None

    def test_expired_token_returns_none(self):
        """Expired token returns None."""
        payload = {
            "sub": "user-123",
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        token = _sign_es256_token(payload)

        result = verify_supabase_jwt(token)

        assert result is None

    def test_missing_sub_claim_returns_none(self):
        """Token without 'sub' claim returns None."""
        payload = {
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        token = _sign_es256_token(payload)

        result = verify_supabase_jwt(token)

        assert result is None

    def test_unknown_kid_returns_none(self):
        """Token with unknown kid returns None."""
        payload = {
            "sub": "user-123",
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        token = jwt.encode(
            payload, _test_private_key, algorithm="ES256", headers={"kid": "unknown"}
        )

        result = verify_supabase_jwt(token)

        assert result is None

    def test_malformed_token_returns_none(self):
        """Malformed JWT returns None."""
        result = verify_supabase_jwt("not.a.valid.jwt.token")
        assert result is None

    def test_empty_token_returns_none(self):
        """Empty token returns None."""
        result = verify_supabase_jwt("")
        assert result is None


class TestCreateServiceRoleClient:
    """
    Tests for create_service_role_client function.

    User scenario: System operations that need to bypass RLS.
    """

    @patch('supabase.create_client')
    def test_create_service_role_client_uses_service_key(self, mock_create_client):
        """Service role client uses service role key."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client

        result = create_service_role_client()

        mock_create_client.assert_called_once_with(
            settings.supabase_url,
            settings.supabase_service_role_key
        )
        assert result == mock_client


class TestGetUserInfo:
    """
    Tests for get_user_info function.
    """

    @patch('app.services.auth.create_service_role_client')
    def test_get_user_info_returns_user_metadata(self, mock_create_service_role):
        """User info is fetched from Supabase auth."""
        user_id = "user-123"
        mock_client = MagicMock()
        mock_create_service_role.return_value = mock_client

        mock_user = Mock()
        mock_user.user = Mock()
        mock_user.user.id = user_id
        mock_user.user.email = "test@example.com"
        mock_user.user.user_metadata = {"name": "Test User"}

        mock_client.auth.admin.get_user_by_id.return_value = mock_user

        result = get_user_info(user_id)

        assert result is not None
        assert result["id"] == user_id
        assert result["email"] == "test@example.com"
        mock_client.auth.admin.get_user_by_id.assert_called_once_with(user_id)

    @patch('app.services.auth.create_service_role_client')
    def test_get_user_info_handles_user_not_found(self, mock_create_service_role):
        """get_user_info returns None when user not found."""
        user_id = "nonexistent-user"
        mock_client = MagicMock()
        mock_create_service_role.return_value = mock_client

        mock_client.auth.admin.get_user_by_id.side_effect = Exception("User not found")

        result = get_user_info(user_id)

        assert result is None
