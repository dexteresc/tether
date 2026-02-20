"""
End-to-End Integration Tests for Entity Resolution (Feature 003)

These tests verify the complete flow:
1. Person exists in database
2. User makes a natural language input referencing that person
3. Entity resolution identifies the existing person
4. Relationship/intel is created using the resolved entity ID (no duplicates)
"""

import pytest
from uuid import uuid4, UUID
from unittest.mock import MagicMock
from datetime import datetime, timezone

from app.models.extraction import (
    IntelligenceExtraction,
    EntityExtraction,
    RelationExtraction,
    IntelExtraction,
    IdentifierExtraction,
    EntityType,
    RelationType,
    IntelType,
    IdentifierType,
    ConfidenceLevel,
    Reasoning,
)
from app.models.resolution import PersonEntity, ResolutionContext
from app.services.entity_resolver import EntityResolverService
from app.services.supabase_sync import SupabaseSyncService


class TestEntityResolutionE2E:
    """
    End-to-end tests simulating realistic user scenarios.

    Scenario: User has an existing contact "John Smith" in the database.
    User types: "I had coffee with John yesterday, he's now working at TechCorp"

    Expected behavior:
    - "John" resolves to existing "John Smith" entity
    - Intel (coffee meeting) is created and linked to John Smith
    - No duplicate "John" entity is created
    """

    @pytest.fixture
    def existing_john_smith(self):
        """Simulate existing 'John Smith' entity in database."""
        return {
            "id": "11111111-1111-1111-1111-111111111111",
            "type": "person",
            "data": {
                "name": "John Smith",
                "company": "Acme Corp",
                "user_id": "test-user-123",
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "identifiers": [
                {"type": "name", "value": "John Smith"},
                {"type": "email", "value": "john.smith@acme.com"},
            ]
        }

    @pytest.fixture
    def mock_supabase_with_john(self, existing_john_smith):
        """
        Mock Supabase client with John Smith pre-populated.

        This simulates a database where John Smith already exists.
        """
        client = MagicMock()
        operations = {
            "entities_created": [],
            "relations_created": [],
            "intel_created": [],
            "intel_entities_linked": [],
            "identifiers_created": [],
        }
        client._operations = operations

        def create_table_mock(table_name):
            table_mock = MagicMock()

            # Track and handle selects
            def handle_select(*args):
                select_mock = MagicMock()
                select_mock.eq = MagicMock(return_value=select_mock)
                select_mock.is_ = MagicMock(return_value=select_mock)
                select_mock.ilike = MagicMock(return_value=select_mock)
                select_mock.single = MagicMock(return_value=select_mock)

                def execute():
                    response = MagicMock()
                    if table_name == "entities":
                        # Return John Smith when querying entities
                        response.data = [existing_john_smith]
                    elif table_name == "sources":
                        # Return existing source
                        response.data = [{"id": "source-123"}]
                    elif table_name == "relations":
                        # No existing relations
                        response.data = []
                    elif table_name == "identifiers":
                        # Return identifiers for entity lookup
                        response.data = [{"entity_id": existing_john_smith["id"]}]
                    else:
                        response.data = []
                    return response

                select_mock.execute = execute
                return select_mock

            table_mock.select = handle_select

            # Track inserts
            def handle_insert(data):
                insert_mock = MagicMock()

                def execute():
                    response = MagicMock()
                    new_id = str(uuid4())

                    if table_name == "entities":
                        operations["entities_created"].append(data)
                        response.data = [{"id": new_id, **data}]
                    elif table_name == "relations":
                        operations["relations_created"].append(data)
                        response.data = [{"id": new_id, **data}]
                    elif table_name == "intel":
                        operations["intel_created"].append(data)
                        response.data = [{"id": new_id, **data}]
                    elif table_name == "intel_entities":
                        operations["intel_entities_linked"].append(data)
                        response.data = [{"id": new_id, **data}]
                    elif table_name == "identifiers":
                        operations["identifiers_created"].append(data)
                        response.data = [{"id": new_id, **data}]
                    else:
                        response.data = [{"id": new_id}]

                    return response

                insert_mock.execute = execute
                return insert_mock

            table_mock.insert = handle_insert

            # Handle updates
            def handle_update(data):
                update_mock = MagicMock()
                update_mock.eq = MagicMock(return_value=update_mock)
                update_mock.execute = MagicMock(return_value=MagicMock(data=[]))
                return update_mock

            table_mock.update = handle_update

            return table_mock

        client.table = create_table_mock
        return client

    @pytest.mark.asyncio
    async def test_existing_person_resolved_and_linked_to_intel(self, mock_supabase_with_john, existing_john_smith):
        """
        Test: User mentions existing person -> person is resolved, intel linked correctly.

        Scenario:
        - John Smith exists in database
        - User says: "I had coffee with John yesterday"
        - Expected: Intel created, linked to existing John Smith (no duplicate entity)
        """
        user_id = "test-user-123"

        # Step 1: Build resolution context (simulates what happens in extraction service)
        resolver = EntityResolverService(mock_supabase_with_john)

        # Mock the database query to return our existing John
        john_entity = PersonEntity(
            id=UUID(existing_john_smith["id"]),
            names=["John Smith"],
            emails=["john.smith@acme.com"],
            phones=[],
            company="Acme Corp",
            location=None,
            updated_at=existing_john_smith["updated_at"]
        )

        context = ResolutionContext(
            persons=[john_entity],
            fuzzy_first_name_threshold=0.8,
        )

        # Step 2: Resolve "John" reference
        resolution = await resolver.resolve_person_reference("John", context)

        # Verify resolution
        assert resolution.resolved is True, "John should be resolved to existing entity"
        assert str(resolution.resolved_entity_id) == existing_john_smith["id"], \
            "Should resolve to existing John Smith's ID"
        assert resolution.ambiguous is False, "Should not be ambiguous (only one John)"
        assert "exact" in resolution.resolution_method or "fuzzy" in resolution.resolution_method, \
            f"Should use matching, got: {resolution.resolution_method}"

        # Step 3: Create extraction with intel involving John
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="John (person)",
                relationships_identified="None",
                facts_identified="None",
                events_identified="Coffee meeting with John",
                sources_identified="User input",
                confidence_rationale="High - direct statement"
            ),
            entities=[],  # John already exists, should not be in entities
            relations=[],
            intel=[
                IntelExtraction(
                    intel_type=IntelType.EVENT,
                    description="Coffee meeting with John",
                    details={"summary": "Had coffee together"},
                    occurred_at="yesterday",
                    entities_involved=["John"],
                    confidence=ConfidenceLevel.HIGH
                )
            ]
        )

        # Step 4: Sync with entity resolutions
        sync_service = SupabaseSyncService(mock_supabase_with_john, user_id)
        _results = sync_service.sync_extraction(
            extraction,
            default_source="LLM",
            entity_resolutions=[resolution]
        )

        # Step 5: Verify results
        operations = mock_supabase_with_john._operations

        # No new entities should be created (John exists)
        assert len(operations["entities_created"]) == 0, \
            f"Should not create duplicate entity, but created: {operations['entities_created']}"

        # Intel should be created
        assert len(operations["intel_created"]) == 1, "Should create intel record"

        # Intel should be linked to existing John Smith
        assert len(operations["intel_entities_linked"]) == 1, "Should link intel to entity"
        link = operations["intel_entities_linked"][0]
        assert link["entity_id"] == existing_john_smith["id"], \
            f"Intel should link to existing John Smith, got: {link['entity_id']}"

    @pytest.mark.asyncio
    async def test_existing_person_resolved_and_relation_created(self, mock_supabase_with_john, existing_john_smith):
        """
        Test: Create relationship between resolved person and new person.

        Scenario:
        - John Smith exists in database
        - User says: "John is married to Sarah"
        - Expected: Sarah created as new entity, SPOUSE relation links to existing John Smith
        """
        user_id = "test-user-123"

        # Build resolution context
        resolver = EntityResolverService(mock_supabase_with_john)

        john_entity = PersonEntity(
            id=UUID(existing_john_smith["id"]),
            names=["John Smith"],
            emails=["john.smith@acme.com"],
            phones=[],
            company="Acme Corp",
            location=None,
            updated_at=existing_john_smith["updated_at"]
        )

        context = ResolutionContext(
            persons=[john_entity],
            fuzzy_first_name_threshold=0.8,
        )

        # Resolve references
        john_resolution = await resolver.resolve_person_reference("John", context)
        sarah_resolution = await resolver.resolve_person_reference("Sarah", context)

        # Verify John resolved, Sarah is new
        assert john_resolution.resolved is True, "John should resolve"
        assert sarah_resolution.resolved is False, "Sarah should not resolve (new)"
        assert sarah_resolution.resolution_method == "new_entity", "Sarah should be marked as new entity"

        # Create extraction with both entities and a relation
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="John (existing), Sarah (new person)",
                relationships_identified="John is spouse of Sarah",
                facts_identified="None",
                events_identified="None",
                sources_identified="User input",
                confidence_rationale="High - direct statement"
            ),
            entities=[
                # Only Sarah needs to be extracted (John exists)
                EntityExtraction(
                    name="Sarah",
                    entity_type=EntityType.PERSON,
                    identifiers=[
                        IdentifierExtraction(identifier_type=IdentifierType.NAME, value="Sarah")
                    ],
                    attributes={},
                    confidence=ConfidenceLevel.HIGH
                )
            ],
            relations=[
                RelationExtraction(
                    source_entity_name="John",
                    target_entity_name="Sarah",
                    relation_type=RelationType.SPOUSE,
                    strength=10,
                    confidence=ConfidenceLevel.HIGH
                )
            ],
            intel=[]
        )

        # Sync with entity resolutions
        sync_service = SupabaseSyncService(mock_supabase_with_john, user_id)
        _results = sync_service.sync_extraction(
            extraction,
            default_source="LLM",
            entity_resolutions=[john_resolution, sarah_resolution]
        )

        # Verify results
        operations = mock_supabase_with_john._operations

        # Sarah should be created (via _process_entity_resolutions for new_entity)
        # John should NOT be created (already exists, resolved)
        _sarah_entities = [e for e in operations["entities_created"]
                         if e.get("data", {}).get("name") == "Sarah" or "Sarah" in str(e)]

        # Relation should be created
        assert len(operations["relations_created"]) == 1, "Should create spouse relation"
        relation = operations["relations_created"][0]

        # Relation source should be existing John Smith
        assert relation["source_id"] == existing_john_smith["id"], \
            f"Relation source should be existing John, got: {relation['source_id']}"

    @pytest.mark.asyncio
    async def test_ambiguous_reference_returns_candidates(self):
        """
        Test: Multiple people match the reference -> returns candidates for clarification.

        Scenario:
        - Two Johns exist: "John Smith" at Acme, "John Doe" at TechCorp
        - User says: "John called me"
        - Expected: Ambiguous result with both candidates
        """
        # Create two Johns
        john_smith = PersonEntity(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            names=["John Smith"],
            emails=["john@acme.com"],
            phones=[],
            company="Acme Corp",
            location="San Francisco",
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        john_doe = PersonEntity(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            names=["John Doe"],
            emails=["john@techcorp.com"],
            phones=[],
            company="TechCorp",
            location="New York",
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[john_smith, john_doe],
            fuzzy_first_name_threshold=0.8,
        )

        # Create mock client (won't be used for resolution, just for service init)
        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # Resolve "John" - should be ambiguous
        resolution = await resolver.resolve_person_reference("John", context)

        # Verify ambiguity
        assert resolution.resolved is False, "Should not auto-resolve ambiguous reference"
        assert resolution.ambiguous is True, "Should be marked as ambiguous"
        assert len(resolution.candidates) == 2, "Should have 2 candidates"

        # Candidates should have distinguishing info
        candidate_names = [c["name"] for c in resolution.candidates]
        assert "John Smith" in candidate_names, "John Smith should be a candidate"
        assert "John Doe" in candidate_names, "John Doe should be a candidate"

        # Candidates should include company for disambiguation
        for candidate in resolution.candidates:
            assert "company" in candidate or "email" in candidate, \
                f"Candidate should have distinguishing attribute: {candidate}"

    @pytest.mark.asyncio
    async def test_full_name_resolves_ambiguity(self):
        """
        Test: Full name disambiguates between multiple first-name matches.

        Scenario:
        - Two Johns exist: "John Smith", "John Doe"
        - User says: "John Smith called me"
        - Expected: Resolves to John Smith specifically
        """
        john_smith = PersonEntity(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            names=["John Smith"],
            emails=["john@acme.com"],
            phones=[],
            company="Acme Corp",
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        john_doe = PersonEntity(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            names=["John Doe"],
            emails=["john@techcorp.com"],
            phones=[],
            company="TechCorp",
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[john_smith, john_doe],
            fuzzy_first_name_threshold=0.8,
        )

        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # Resolve "John Smith" - should find exact match
        resolution = await resolver.resolve_person_reference("John Smith", context)

        # Verify exact match
        assert resolution.resolved is True, "Should resolve full name"
        assert resolution.ambiguous is False, "Should not be ambiguous with full name"
        assert str(resolution.resolved_entity_id) == str(john_smith.id), \
            "Should resolve to John Smith"
        assert resolution.resolution_method == "exact_match", \
            f"Should use exact match, got: {resolution.resolution_method}"

    @pytest.mark.asyncio
    async def test_fuzzy_match_for_typos(self):
        """
        Test: Fuzzy matching handles typos in names.

        Scenario:
        - "Robert Johnson" exists in database
        - User types: "Bob Johnson called me" (nickname)
        - Expected: Resolves to Robert Johnson via fuzzy match
        """
        robert = PersonEntity(
            id=UUID("44444444-4444-4444-4444-444444444444"),
            names=["Robert Johnson", "Bob Johnson"],  # Has Bob as alternate name
            emails=["bob@example.com"],
            phones=[],
            company="Example Inc",
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[robert],
            fuzzy_first_name_threshold=0.8,
        )

        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # Resolve "Bob" - should fuzzy match to Robert/Bob Johnson
        resolution = await resolver.resolve_person_reference("Bob", context)

        # Verify fuzzy match
        assert resolution.resolved is True, "Should resolve via fuzzy/exact match"
        assert str(resolution.resolved_entity_id) == str(robert.id), \
            "Should resolve to Robert Johnson"


class TestFullNameVsSingleName:
    """
    Tests for proper handling of full names vs single names.

    Full names like "John Smith" should NOT match single different names like "Jonathan".
    """

    @pytest.mark.asyncio
    async def test_full_name_does_not_match_different_first_name(self):
        """
        Test: "John Smith" should NOT match "Jonathan".

        Full names are more specific and should only match other full names,
        not similar-sounding single first names.
        """
        # Jonathan exists as a single name
        jonathan = PersonEntity(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            names=["Jonathan"],
            emails=["jonathan@example.com"],
            phones=[],
            company=None,
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[jonathan],
            fuzzy_first_name_threshold=0.8,
        )

        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # "John Smith" should NOT resolve to "Jonathan"
        resolution = await resolver.resolve_person_reference("John Smith", context)

        assert resolution.resolved is False, \
            "John Smith should NOT resolve to Jonathan - different names"
        assert resolution.resolution_method == "new_entity", \
            f"Should create new entity, got: {resolution.resolution_method}"

    @pytest.mark.asyncio
    async def test_single_name_can_match_first_name(self):
        """
        Test: "John" CAN match "John Smith" via first name matching.

        Single name references should still work for first name matching.
        """
        john_smith = PersonEntity(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            names=["John Smith"],
            emails=["john@example.com"],
            phones=[],
            company=None,
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[john_smith],
            fuzzy_first_name_threshold=0.8,
        )

        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # "John" should resolve to "John Smith"
        resolution = await resolver.resolve_person_reference("John", context)

        assert resolution.resolved is True, \
            "John should resolve to John Smith via first name matching"
        assert str(resolution.resolved_entity_id) == str(john_smith.id)

    @pytest.mark.asyncio
    async def test_full_name_matches_same_full_name(self):
        """
        Test: "John Smith" matches "John Smith" exactly.
        """
        john_smith = PersonEntity(
            id=UUID("33333333-3333-3333-3333-333333333333"),
            names=["John Smith"],
            emails=["john@example.com"],
            phones=[],
            company=None,
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[john_smith],
            fuzzy_first_name_threshold=0.8,
        )

        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # "John Smith" should resolve to "John Smith"
        resolution = await resolver.resolve_person_reference("John Smith", context)

        assert resolution.resolved is True, \
            "John Smith should resolve to John Smith"
        assert resolution.resolution_method == "exact_match"
        assert str(resolution.resolved_entity_id) == str(john_smith.id)


class TestRequesterRelationshipScenario:
    """
    Test the specific scenario: create a relationship between an existing person
    and the requester (current user).
    """

    @pytest.mark.asyncio
    async def test_relationship_between_existing_person_and_requester(self):
        """
        Test: User creates relationship with existing contact.

        Scenario:
        - User (the requester) is "Alice"
        - "John Smith" exists in database
        - User says: "I met John at the conference, we're now colleagues"
        - Expected:
            1. "John" resolves to existing John Smith
            2. "Alice" (the requester) is created/resolved
            3. COLLEAGUE relation created between them
        """
        # Existing contact
        john_id = UUID("11111111-1111-1111-1111-111111111111")
        john_smith = PersonEntity(
            id=john_id,
            names=["John Smith"],
            emails=["john@acme.com"],
            phones=[],
            company="Acme Corp",
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        # Requester's entity (Alice - might exist or be new)
        alice_id = UUID("99999999-9999-9999-9999-999999999999")
        alice = PersonEntity(
            id=alice_id,
            names=["Alice"],
            emails=["alice@mycompany.com"],
            phones=[],
            company="MyCompany",
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        context = ResolutionContext(
            persons=[john_smith, alice],
            fuzzy_first_name_threshold=0.8,
        )

        mock_client = MagicMock()
        resolver = EntityResolverService(mock_client)

        # Resolve both references
        john_resolution = await resolver.resolve_person_reference("John", context)
        alice_resolution = await resolver.resolve_person_reference("Alice", context)

        # Both should resolve to existing entities
        assert john_resolution.resolved is True
        assert str(john_resolution.resolved_entity_id) == str(john_id)

        assert alice_resolution.resolved is True
        assert str(alice_resolution.resolved_entity_id) == str(alice_id)

        # Now test the sync with these resolutions
        user_id = "test-user-123"

        # Create a mock that tracks operations
        operations = {
            "entities_created": [],
            "relations_created": [],
            "intel_created": [],
            "intel_entities_linked": [],
        }

        def create_table_mock(table_name):
            table_mock = MagicMock()

            def handle_select(*args):
                select_mock = MagicMock()
                select_mock.eq = MagicMock(return_value=select_mock)
                select_mock.is_ = MagicMock(return_value=select_mock)
                select_mock.single = MagicMock(return_value=select_mock)

                def execute():
                    response = MagicMock()
                    if table_name == "sources":
                        response.data = [{"id": "source-123"}]
                    elif table_name == "relations":
                        response.data = []  # No existing relation
                    elif table_name == "identifiers":
                        response.data = []
                    else:
                        response.data = []
                    return response

                select_mock.execute = execute
                return select_mock

            table_mock.select = handle_select

            def handle_insert(data):
                insert_mock = MagicMock()

                def execute():
                    response = MagicMock()
                    new_id = str(uuid4())

                    if table_name == "entities":
                        operations["entities_created"].append(data)
                    elif table_name == "relations":
                        operations["relations_created"].append(data)
                    elif table_name == "intel":
                        operations["intel_created"].append(data)
                    elif table_name == "intel_entities_linked":
                        operations["intel_entities_linked"].append(data)

                    response.data = [{"id": new_id, **data}]
                    return response

                insert_mock.execute = execute
                return insert_mock

            table_mock.insert = handle_insert
            return table_mock

        sync_client = MagicMock()
        sync_client.table = create_table_mock

        # Create extraction representing "I met John, we're now colleagues"
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="John (existing), Alice/I (requester)",
                relationships_identified="Alice is colleague of John",
                facts_identified="Met at conference",
                events_identified="Conference meeting",
                sources_identified="User input",
                confidence_rationale="High"
            ),
            entities=[],  # Both exist, no new entities
            relations=[
                RelationExtraction(
                    source_entity_name="Alice",
                    target_entity_name="John",
                    relation_type=RelationType.COLLEAGUE,
                    strength=7,
                    confidence=ConfidenceLevel.HIGH,
                    description="Met at conference"
                )
            ],
            intel=[]
        )

        # Sync with both resolutions
        sync_service = SupabaseSyncService(sync_client, user_id)
        _results = sync_service.sync_extraction(
            extraction,
            default_source="LLM",
            entity_resolutions=[john_resolution, alice_resolution]
        )

        # Verify: no new entities created (both resolved)
        assert len(operations["entities_created"]) == 0, \
            f"Should not create entities (both exist), created: {operations['entities_created']}"

        # Verify: relation created with correct entity IDs
        assert len(operations["relations_created"]) == 1, "Should create COLLEAGUE relation"
        relation = operations["relations_created"][0]

        assert relation["source_id"] == str(alice_id), \
            f"Relation source should be Alice, got: {relation['source_id']}"
        assert relation["target_id"] == str(john_id), \
            f"Relation target should be John, got: {relation['target_id']}"
        assert relation["type"] == "colleague", \
            f"Relation type should be colleague, got: {relation['type']}"
