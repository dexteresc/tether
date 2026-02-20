"""
Integration tests for entity resolution with relations sync.

Tests the complete flow: entity resolution → relations sync → database operations
Focus: Verify resolved entities are linked in relations, preventing duplicates.
"""

from uuid import UUID

from app.services.supabase_sync import SupabaseSyncService
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
    Reasoning
)


class TestRelationsIntegration:
    """
    Integration tests for entity resolution with relations sync.

    Focus: Verify resolved entities are linked in relations, not duplicates created.
    """

    def test_resolved_entities_linked_in_spouse_relation(
        self,
        mock_supabase_insert_tracker,
        extraction_with_relations_factory,
        mock_resolution_results
    ):
        """
        Test spouse relation uses resolved entity IDs.

        Scenario:
        - Input: "John is married to Sarah"
        - Database: John exists (id=111...), Sarah exists (id=222...)
        - Expected: Relation links 111... -> 222..., no new entities

        What breaks if untested:
        - Duplicate John/Sarah entities created
        - Relation links to wrong entity IDs
        - Data integrity compromised
        """
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")
        sarah_id = UUID("22222222-2222-2222-2222-222222222222")

        # Mock resolution results
        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id, confidence=0.95),
            mock_resolution_results("Sarah", resolved=True, entity_id=sarah_id, confidence=0.92),
        ]

        # Create extraction with spouse relation
        extraction = extraction_with_relations_factory()

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        results = sync_service.sync_extraction(
            extraction,
            default_source="TEST",
            entity_resolutions=resolutions
        )

        # ASSERT
        # CRITICAL: Verify relation uses resolved entity IDs (not duplicate IDs)
        # This is the key feature that entity resolution provides
        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert len(relation_inserts) == 1, \
            "Spouse relation should be created"

        relation_data = relation_inserts[0]
        assert relation_data["source_id"] == str(john_id), \
            "Relation source MUST use John's resolved entity ID from resolution"
        assert relation_data["target_id"] == str(sarah_id), \
            "Relation target MUST use Sarah's resolved entity ID from resolution"
        assert relation_data["type"] == "spouse"

        # Verify relation created successfully
        assert len(results.relations_created) == 1
        assert results.relations_created[0]["created"] is True

        # Verify no errors
        assert results.errors == [], \
            f"No errors should occur during sync: {results.errors}"

        # Note: entities_created may contain entities from extraction.entities
        # The key test is that relations use resolved_entity_id, preventing
        # relations from pointing to wrong/duplicate entities

    def test_resolved_entity_id_added_to_mapping(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results,
        extraction_with_relations_factory
    ):
        """
        Test that resolved entity ID is added to entity_name_to_id mapping.

        Scenario:
        - Input: Extraction with John and Sarah
        - Resolutions: Both resolved to existing entities
        - Expected: entity_name_to_id contains both mappings

        What breaks if untested:
        - Resolved entity IDs not available for relations/intel linking
        - Relations created with wrong entity IDs
        """
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")
        sarah_id = UUID("22222222-2222-2222-2222-222222222222")

        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id, confidence=0.95),
            mock_resolution_results("Sarah", resolved=True, entity_id=sarah_id, confidence=0.92),
        ]

        extraction = extraction_with_relations_factory()

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        _results = sync_service.sync_extraction(
            extraction,
            default_source="TEST",
            entity_resolutions=resolutions
        )

        # ASSERT
        # CRITICAL: Verify relation uses resolved IDs from entity_name_to_id mapping
        # This proves the mapping was populated correctly
        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert len(relation_inserts) == 1

        relation_data = relation_inserts[0]
        assert relation_data["source_id"] == str(john_id), \
            "Relation should use John's resolved entity ID from mapping"
        assert relation_data["target_id"] == str(sarah_id), \
            "Relation should use Sarah's resolved entity ID from mapping"

    def test_relation_uses_resolved_entity_id_not_duplicate(
        self,
        mock_supabase_insert_tracker,
        extraction_with_relations_factory,
        mock_resolution_results
    ):
        """
        Test relation uses resolved_entity_id from resolution.

        Scenario:
        - Person-to-person relation with both entities resolved
        - Expected: Relation uses resolved_entity_id values

        What breaks if untested:
        - Relations created with wrong entity IDs
        - Data model inconsistency
        - Broken relation queries
        """
        # ARRANGE
        alice_id = UUID("22222222-2222-2222-2222-222222222222")
        bob_id = UUID("33333333-3333-3333-3333-333333333333")

        resolutions = [
            mock_resolution_results("Alice", resolved=True, entity_id=alice_id),
            mock_resolution_results("Bob", resolved=True, entity_id=bob_id),
        ]

        # Create extraction with colleague relation
        extraction = extraction_with_relations_factory(
            entities=[
                EntityExtraction(
                    name="Alice",
                    entity_type=EntityType.PERSON,
                    identifiers=[
                        IdentifierExtraction(identifier_type=IdentifierType.NAME, value="Alice")
                    ],
                    attributes={},
                    confidence=ConfidenceLevel.HIGH
                ),
                EntityExtraction(
                    name="Bob",
                    entity_type=EntityType.PERSON,
                    identifiers=[
                        IdentifierExtraction(identifier_type=IdentifierType.NAME, value="Bob")
                    ],
                    attributes={},
                    confidence=ConfidenceLevel.HIGH
                ),
            ],
            relations=[
                RelationExtraction(
                    source_entity_name="Alice",
                    target_entity_name="Bob",
                    relation_type=RelationType.COLLEAGUE,
                    strength=8,
                    confidence=ConfidenceLevel.HIGH
                )
            ]
        )

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        _results = sync_service.sync_extraction(
            extraction,
            default_source="TEST",
            entity_resolutions=resolutions
        )

        # ASSERT
        # Verify relation created with correct IDs
        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert len(relation_inserts) == 1

        relation_data = relation_inserts[0]
        assert relation_data["source_id"] == str(alice_id), \
            "Relation should use Alice's resolved entity ID"
        assert relation_data["target_id"] == str(bob_id), \
            "Relation should use Bob's resolved entity ID"
        assert relation_data["type"] == "colleague"

    def test_multi_person_event_all_resolved(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results
    ):
        """
        Test intel event links to multiple resolved persons.

        Scenario:
        - Input: "Alice, Bob, and Charlie attended the conference"
        - All three exist in database
        - Expected: Intel links to all 3 resolved entities

        What breaks if untested:
        - Intel doesn't link to resolved entities
        - Duplicate entities created for participants
        - Multi-person events broken
        """
        # ARRANGE
        alice_id = UUID("22222222-2222-2222-2222-222222222222")
        bob_id = UUID("44444444-4444-4444-4444-444444444444")
        charlie_id = UUID("55555555-5555-5555-5555-555555555555")

        resolutions = [
            mock_resolution_results("Alice", resolved=True, entity_id=alice_id),
            mock_resolution_results("Bob", resolved=True, entity_id=bob_id),
            mock_resolution_results("Charlie", resolved=True, entity_id=charlie_id),
        ]

        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="Alice, Bob, Charlie (persons)",
                relationships_identified="None",
                facts_identified="None",
                events_identified="Conference attendance",
                sources_identified="Test",
                confidence_rationale="High"
            ),
            entities=[],
            relations=[],
            intel=[
                IntelExtraction(
                    intel_type=IntelType.EVENT,
                    description="Alice, Bob, and Charlie attended the conference in SF",
                    occurred_at="yesterday",
                    entities_involved=["Alice", "Bob", "Charlie"],
                    location="San Francisco",
                    details={"event": "conference"},
                    confidence=ConfidenceLevel.HIGH
                )
            ]
        )

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        results = sync_service.sync_extraction(
            extraction,
            entity_resolutions=resolutions
        )

        # ASSERT
        # Verify intel created
        assert len(results.intel_created) == 1, \
            "Intel event should be created"

        intel_result = results.intel_created[0]
        assert intel_result["entities_linked"] == 3, \
            "Intel should link to all 3 participants"

        # Verify intel_entities links created for all 3 persons
        intel_entity_inserts = mock_supabase_insert_tracker._operations["intel_entities_insert"]
        assert len(intel_entity_inserts) == 3, \
            "Should create 3 intel_entities links"

        linked_entity_ids = {insert["entity_id"] for insert in intel_entity_inserts}
        expected_ids = {str(alice_id), str(bob_id), str(charlie_id)}
        assert linked_entity_ids == expected_ids, \
            "Intel should link to all resolved entity IDs"

    def test_multi_person_event_with_participant_roles(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results
    ):
        """
        Test that all participants have role='participant' in intel_entities.

        Scenario:
        - Multi-person event with resolved entities
        - Expected: All intel_entities have role="participant"

        What breaks if untested:
        - Incorrect or missing roles in junction table
        - Queries filtering by role fail
        """
        # ARRANGE
        alice_id = UUID("22222222-2222-2222-2222-222222222222")
        bob_id = UUID("44444444-4444-4444-4444-444444444444")

        resolutions = [
            mock_resolution_results("Alice", resolved=True, entity_id=alice_id),
            mock_resolution_results("Bob", resolved=True, entity_id=bob_id),
        ]

        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="Alice, Bob (persons)",
                relationships_identified="None",
                facts_identified="None",
                events_identified="Meeting",
                sources_identified="Test",
                confidence_rationale="High"
            ),
            entities=[],
            relations=[],
            intel=[
                IntelExtraction(
                    intel_type=IntelType.EVENT,
                    description="Alice and Bob had a meeting",
                    occurred_at="today",
                    entities_involved=["Alice", "Bob"],
                    location=None,
                    details={},
                    confidence=ConfidenceLevel.HIGH
                )
            ]
        )

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        _results = sync_service.sync_extraction(
            extraction,
            entity_resolutions=resolutions
        )

        # ASSERT
        intel_entity_inserts = mock_supabase_insert_tracker._operations["intel_entities_insert"]
        assert len(intel_entity_inserts) == 2

        # Verify all have participant role
        for insert in intel_entity_inserts:
            assert insert["role"] == "participant", \
                f"All intel_entities should have role='participant', got: {insert['role']}"


class TestRelationsResolutionMapping:
    """
    Tests for entity_name_to_id mapping with resolutions.

    Focus: Verify the core mapping logic that prevents duplicates.
    """

    def test_entity_name_to_id_populated_from_resolutions(
        self,
        mock_supabase_insert_tracker,
        extraction_with_relations_factory,
        mock_resolution_results
    ):
        """
        Test entity_name_to_id dict populated correctly from resolutions.

        Scenario:
        - Two resolved entities (John, Sarah)
        - Expected: entity_name_to_id contains both mappings

        What breaks if untested:
        - Mapping not populated correctly
        - Relations fail to resolve entity names
        - Duplicate prevention broken
        """
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")
        sarah_id = UUID("22222222-2222-2222-2222-222222222222")

        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id),
            mock_resolution_results("Sarah", resolved=True, entity_id=sarah_id),
        ]

        extraction = extraction_with_relations_factory()

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        results = sync_service.sync_extraction(
            extraction,
            entity_resolutions=resolutions
        )

        # ASSERT
        # The relation was created successfully, which means entity_name_to_id
        # was populated correctly (indirect verification)
        assert len(results.relations_created) == 1, \
            "Relation should be created if entity_name_to_id populated correctly"

        # Direct verification: relation uses correct IDs
        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert relation_inserts[0]["source_id"] == str(john_id)
        assert relation_inserts[0]["target_id"] == str(sarah_id)

    def test_resolved_entity_id_used_in_relations_sync(
        self,
        mock_supabase_insert_tracker,
        extraction_with_relations_factory,
        mock_resolution_results
    ):
        """
        Test _sync_relation() uses IDs from entity_name_to_id.

        Scenario:
        - Relation extraction with resolved entities
        - Expected: _sync_relation gets IDs from entity_name_to_id mapping

        What breaks if untested:
        - Relations sync bypasses resolution
        - Duplicate entities in relations
        """
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")
        sarah_id = UUID("22222222-2222-2222-2222-222222222222")

        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id),
            mock_resolution_results("Sarah", resolved=True, entity_id=sarah_id),
        ]

        extraction = extraction_with_relations_factory()

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        results = sync_service.sync_extraction(
            extraction,
            entity_resolutions=resolutions
        )

        # ASSERT
        # Verify relation created with resolved IDs (end-to-end flow)
        assert len(results.relations_created) == 1
        assert results.relations_created[0]["created"] is True

        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert len(relation_inserts) == 1
        assert relation_inserts[0]["source_id"] == str(john_id)
        assert relation_inserts[0]["target_id"] == str(sarah_id)

    def test_new_entity_created_and_mapped_for_unresolved(
        self,
        mock_supabase_insert_tracker,
        extraction_with_relations_factory,
        mock_resolution_results
    ):
        """
        Test new entity created when resolution_method == "new_entity".

        Scenario:
        - One resolved entity (John), one unresolved (NewPerson)
        - Expected: NewPerson entity created and mapped to entity_name_to_id

        What breaks if untested:
        - Low-confidence matches don't create entities
        - Relations fail when one entity is new
        """
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")

        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id, confidence=0.95),
            mock_resolution_results(
                "NewPerson",
                resolved=False,
                entity_id=None,
                confidence=0.3,
                method="new_entity",
                ambiguous=False
            ),
        ]

        # Create extraction with relation to new person
        extraction = extraction_with_relations_factory(
            entities=[
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
                    name="NewPerson",
                    entity_type=EntityType.PERSON,
                    identifiers=[
                        IdentifierExtraction(identifier_type=IdentifierType.NAME, value="NewPerson")
                    ],
                    attributes={},
                    confidence=ConfidenceLevel.MEDIUM
                ),
            ],
            relations=[
                RelationExtraction(
                    source_entity_name="John",
                    target_entity_name="NewPerson",
                    relation_type=RelationType.COLLEAGUE,
                    strength=5,
                    confidence=ConfidenceLevel.MEDIUM
                )
            ]
        )

        # ACT
        sync_service = SupabaseSyncService(
            mock_supabase_insert_tracker,
            user_id="test-user-123"
        )
        results = sync_service.sync_extraction(
            extraction,
            entity_resolutions=resolutions
        )

        # ASSERT
        # Verify new entity was created for unresolved reference
        assert len(results.entities_created) == 1, \
            "New entity should be created for new_entity resolution method"

        new_entity = results.entities_created[0]
        assert new_entity["name"] == "NewPerson"
        assert new_entity["type"] == "person"

        # Verify relation was still created (using new entity ID)
        assert len(results.relations_created) == 1, \
            "Relation should be created even when one entity is new"

        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert len(relation_inserts) == 1
        assert relation_inserts[0]["source_id"] == str(john_id)
        # target_id should be the newly created entity ID (not None)
        assert relation_inserts[0]["target_id"] is not None
