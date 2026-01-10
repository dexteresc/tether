import pytest
import os
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi.testclient import TestClient

@pytest.fixture(scope="session", autouse=True)
def force_test_settings():
    """Ensure consistent settings for tests."""
    os.environ["LLM_MODEL"] = "qwen2.5:7b"
    os.environ["LLM_PROVIDER"] = "ollama"

@pytest.fixture(scope="module")
def vcr_config():
    """
    VCR configuration for recording and replaying HTTP interactions.
    Applied globally to all integration, classification, and provider tests.
    """
    return {
        "filter_headers": ["authorization", "x-api-key", "Authorization", "apikey"],
        "ignore_localhost": False,  # Record localhost for Ollama and Supabase
        "record_mode": "once",  # Use cassettes if they exist, record if missing
        "cassette_library_dir": "tests/cassettes",  # Store cassettes here
        "path_transformer": lambda path: path.replace(".py", ""),  # Cleaner paths
        "match_on": ["method", "scheme", "host", "port", "path", "query"],
        "decode_compressed_response": True,  # Handle compressed responses
    }

@pytest.fixture(scope="function")
def vcr_cassette_dir(request):
    """Set the cassette directory for VCR."""
    return "tests/cassettes"

def pytest_collection_modifyitems(items):
    """
    Auto-mark tests with @pytest.mark.vcr for LLM call recording/playback.

    VCR is applied to:
    - Classification tests (pure LLM calls, no database)
    - Any other tests that only make LLM calls

    VCR is NOT applied to:
    - Integration tests that use Supabase (VCR has async compatibility issues with httpx)
    - Unit tests that use mocks (e.g., test_retry.py)
    """
    for item in items:
        # Skip tests that use mocks
        if "test_retry" in str(item.fspath):
            continue
        # Skip integration tests that use Supabase (VCR incompatible)
        if "test_integration" in str(item.fspath):
            continue
        # Skip unit tests (they use mocks)
        if "/unit/" in str(item.fspath):
            continue
        # Auto-apply VCR to classification and other non-database tests
        item.add_marker(pytest.mark.vcr)

# ============================================================================
# Test Fixtures for Unit Testing
# ============================================================================

@pytest.fixture
def mock_supabase_client():
    """
    Mock Supabase client for testing sync operations without real database.

    Configures query builder chains for entity/identifier/relation/intel tables.
    """
    client = MagicMock()

    # Configure table() to return a mock query builder
    table_mock = MagicMock()
    client.table.return_value = table_mock

    # Configure query builder methods to chain
    table_mock.select.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.delete.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.neq.return_value = table_mock
    table_mock.is_.return_value = table_mock
    table_mock.ilike.return_value = table_mock
    table_mock.filter.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.limit.return_value = table_mock

    # Configure execute() to return mock response
    execute_mock = MagicMock()
    execute_mock.data = []
    table_mock.execute.return_value = execute_mock

    return client

@pytest.fixture
def mock_jwt_token():
    """
    Generate valid JWT token for testing authenticated endpoints.

    Returns a token with test user ID that can be verified.
    """
    from app.config import settings

    TEST_USER_ID = "00000000-0000-0000-0000-000000000001"

    payload = {
        "sub": TEST_USER_ID,
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
        "role": "authenticated"
    }

    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")
    return token

@pytest.fixture
def test_client():
    """
    FastAPI TestClient for testing HTTP endpoints.

    Use this to make requests to the API routes.
    """
    from app.main import app
    return TestClient(app)

# ============================================================================
# Entity Resolution Test Fixtures (Feature 003)
# ============================================================================

@pytest.fixture
def mock_supabase_insert_tracker():
    """
    Mock Supabase that tracks all insert/update operations for verification.

    Useful for verifying that relations use resolved entity IDs.
    Returns a client with client._operations dict tracking all database operations.
    """
    from uuid import uuid4

    client = MagicMock()

    # Track all database operations
    client._operations = {
        "entities_insert": [],
        "entities_update": [],
        "relations_insert": [],
        "intel_insert": [],
        "intel_entities_insert": [],
        "identifiers_insert": [],
        "sources_insert": [],
    }

    def create_table_mock(table_name):
        """Create table-specific mock with operation tracking."""
        table_mock = MagicMock()

        # Track inserts
        def track_insert(data):
            client._operations[f"{table_name}_insert"].append(data)
            response = MagicMock()
            # Handle both single dict and list of dicts
            if isinstance(data, list):
                response.data = [{"id": str(uuid4()), **item} for item in data]
            else:
                response.data = [{"id": str(uuid4()), **data}]
            return response

        # Configure insert to track and return mock
        def insert(data):
            result = track_insert(data)
            execute_mock = MagicMock()
            execute_mock.execute.return_value = result
            return execute_mock

        table_mock.insert = insert

        # Track updates
        def track_update(data):
            client._operations[f"{table_name}_update"].append(data)
            return table_mock  # Return for chaining

        table_mock.update = track_update

        # Configure other query builder methods to chain
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.is_.return_value = table_mock
        table_mock.single.return_value = table_mock

        # Configure execute() to return empty result for selects
        def execute():
            response = MagicMock()
            response.data = []
            return response

        table_mock.execute = execute

        return table_mock

    client.table = create_table_mock

    return client


@pytest.fixture
def mock_resolution_results():
    """
    Factory fixture for creating mock EntityResolutionResult objects.

    Usage:
        result = mock_resolution_results("John", resolved=True, entity_id=some_uuid)
    """
    from uuid import uuid4
    from app.models.resolution import EntityResolutionResult

    def create_result(
        reference: str,
        resolved: bool = True,
        entity_id = None,
        confidence: float = 0.9,
        method: str = "exact_match",
        ambiguous: bool = False,
        candidates: list = None
    ):
        return EntityResolutionResult(
            input_reference=reference,
            resolved=resolved,
            resolved_entity_id=entity_id or uuid4(),
            confidence=confidence,
            resolution_method=method,
            ambiguous=ambiguous,
            candidates=candidates or [],
            reasoning=f"Test resolution for {reference}",
            match_details={}
        )

    return create_result


@pytest.fixture
def extraction_with_relations_factory():
    """
    Factory for creating IntelligenceExtraction with relations for testing.

    Usage:
        extraction = extraction_with_relations_factory()  # Default: John + Sarah with spouse relation
        extraction = extraction_with_relations_factory(entities=[...], relations=[...])
    """
    from app.models.extraction import (
        IntelligenceExtraction,
        EntityExtraction,
        RelationExtraction,
        IdentifierExtraction,
        EntityType,
        RelationType,
        IdentifierType,
        ConfidenceLevel,
        Reasoning
    )

    def create_extraction(
        entities=None,
        relations=None,
        intel=None
    ):
        default_entities = [
            EntityExtraction(
                name="John",
                entity_type=EntityType.PERSON,
                identifiers=[
                    IdentifierExtraction(identifier_type=IdentifierType.NAME, value="John")
                ],
                attributes={},
                confidence=ConfidenceLevel.HIGH
            ),
            EntityExtraction(
                name="Sarah",
                entity_type=EntityType.PERSON,
                identifiers=[
                    IdentifierExtraction(identifier_type=IdentifierType.NAME, value="Sarah")
                ],
                attributes={},
                confidence=ConfidenceLevel.HIGH
            ),
        ]

        default_relations = [
            RelationExtraction(
                source_entity_name="John",
                target_entity_name="Sarah",
                relation_type=RelationType.SPOUSE,
                strength=10,
                confidence=ConfidenceLevel.HIGH
            )
        ]

        return IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="John (person), Sarah (person)",
                relationships_identified="John is spouse of Sarah",
                facts_identified="None",
                events_identified="None",
                sources_identified="Test",
                confidence_rationale="High - test data"
            ),
            entities=entities or default_entities,
            relations=relations or default_relations,
            intel=intel or []
        )

    return create_extraction


@pytest.fixture
def sample_person_entities():
    """
    Sample PersonEntity objects for resolution testing.

    Returns list of PersonEntity objects with various attributes for testing
    context-aware resolution scenarios.
    """
    from uuid import UUID
    from datetime import datetime, timezone
    from app.models.resolution import PersonEntity

    return [
        PersonEntity(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            names=["John Smith"],
            emails=["john@acme.com"],
            phones=["+1-555-0101"],
            company="Acme Corp",
            location="San Francisco",
            updated_at=datetime.now(timezone.utc).isoformat()
        ),
        PersonEntity(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            names=["Alice Johnson", "Allie Johnson"],
            emails=["alice@techcorp.com"],
            phones=[],
            company="TechCorp",
            location="New York",
            updated_at=datetime.now(timezone.utc).isoformat()
        ),
        PersonEntity(
            id=UUID("33333333-3333-3333-3333-333333333333"),
            names=["Alice Williams"],
            emails=["alice.w@designco.com"],
            phones=[],
            company="DesignCo",
            location="Austin",
            updated_at=datetime.now(timezone.utc).isoformat()
        ),
        PersonEntity(
            id=UUID("44444444-4444-4444-4444-444444444444"),
            names=["Bob Johnson", "Robert Johnson"],
            emails=["bob@example.com"],
            phones=["+1-555-0202"],
            company="Example Inc",
            location="Seattle",
            updated_at=datetime.now(timezone.utc).isoformat()
        ),
        PersonEntity(
            id=UUID("55555555-5555-5555-5555-555555555555"),
            names=["Timmy Chen"],
            emails=["timmy@startup.io"],
            phones=[],
            company="Startup Inc",
            location="Palo Alto",
            updated_at=datetime.now(timezone.utc).isoformat()
        ),
        PersonEntity(
            id=UUID("66666666-6666-6666-6666-666666666666"),
            names=["John Doe"],
            emails=["john@techcorp.com"],
            phones=[],
            company="TechCorp",
            location="New York",
            updated_at=datetime.now(timezone.utc).isoformat()
        ),
    ]


@pytest.fixture
def resolution_context_factory(sample_person_entities):
    """
    Factory for creating ResolutionContext with custom configurations.

    Usage:
        context = resolution_context_factory()  # Default config
        context = resolution_context_factory(persons=[...], fuzzy_first_threshold=0.9)
    """
    from app.models.resolution import ResolutionContext

    def create_context(
        persons=None,
        session_entities=None,
        fuzzy_first_threshold=0.8,
        fuzzy_last_threshold=0.7,
        auto_resolve_threshold=0.8
    ):
        return ResolutionContext(
            persons=persons or sample_person_entities,
            session_entities=session_entities or [],
            fuzzy_first_name_threshold=fuzzy_first_threshold,
            fuzzy_last_name_threshold=fuzzy_last_threshold,
            auto_resolve_confidence_threshold=auto_resolve_threshold
        )

    return create_context


# ============================================================================
# Helper Functions
# ============================================================================

def create_test_entity(supabase, user_id, name, entity_type="person", **attributes):
    """
    Helper to create test entity in database.

    Args:
        supabase: Supabase client
        user_id: User ID for the entity
        name: Entity name
        entity_type: Type of entity (person, organization, etc.)
        **attributes: Additional attributes for the entity

    Returns:
        str: Created entity ID
    """
    from app.services.supabase_sync import SupabaseSyncService
    from app.models.extraction import EntityExtraction, IdentifierExtraction, IdentifierType, ConfidenceLevel

    entity = EntityExtraction(
        name=name,
        entity_type=entity_type,
        identifiers=[
            IdentifierExtraction(
                identifier_type=IdentifierType.NAME,
                value=name
            )
        ],
        attributes=attributes,
        confidence=ConfidenceLevel.HIGH
    )

    sync_service = SupabaseSyncService(supabase, user_id)

    # Get or create source
    source_id = sync_service._get_or_create_source("TEST")

    # Sync entity
    result = sync_service._sync_entity(entity, source_id)

    return result["entity_id"]
