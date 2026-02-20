"""
Unit tests for SupabaseSyncService methods.

Tests individual sync methods in isolation.
"""

from uuid import UUID
from unittest.mock import MagicMock

from app.services.supabase_sync import SupabaseSyncService
from app.models.extraction import SyncResults


class TestProcessEntityResolutions:
    """Unit tests for _process_entity_resolutions method."""

    def test_resolved_entity_added_to_mapping(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results
    ):
        """Test resolved entity ID added to entity_name_to_id mapping."""
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")

        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id)
        ]

        entity_name_to_id = {}
        results = SyncResults()

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        sync_service._process_entity_resolutions(
            resolutions, entity_name_to_id, source_id="test-source", results=results
        )

        # ASSERT
        assert "John" in entity_name_to_id, "Resolved entity should be in mapping"
        assert entity_name_to_id["John"] == str(john_id), \
            "Mapping should use resolved entity ID"

    def test_new_entity_created_for_unresolved(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results
    ):
        """Test new entity created when resolution_method == 'new_entity'."""
        # ARRANGE
        resolutions = [
            mock_resolution_results(
                "NewPerson",
                resolved=False,
                entity_id=None,
                confidence=0.3,
                method="new_entity"
            )
        ]

        entity_name_to_id = {}
        results = SyncResults()

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        sync_service._process_entity_resolutions(
            resolutions, entity_name_to_id, source_id="test-source", results=results
        )

        # ASSERT
        assert "NewPerson" in entity_name_to_id, \
            "New entity should be created and added to mapping"
        assert len(results.entities_created) == 1, \
            "New entity should be tracked in results"

    def test_ambiguous_entity_skipped(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results
    ):
        """Test ambiguous entity skipped (not added to mapping)."""
        # ARRANGE
        resolutions = [
            mock_resolution_results(
                "Alice",
                resolved=False,
                ambiguous=True,
                method="ambiguous",
                candidates=[{"id": "1", "name": "Alice J"}, {"id": "2", "name": "Alice W"}]
            )
        ]

        entity_name_to_id = {}
        results = SyncResults()

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        sync_service._process_entity_resolutions(
            resolutions, entity_name_to_id, source_id="test-source", results=results
        )

        # ASSERT
        assert "Alice" not in entity_name_to_id, \
            "Ambiguous entity should NOT be added to mapping"

    def test_multiple_resolutions_processed(
        self,
        mock_supabase_insert_tracker,
        mock_resolution_results
    ):
        """Test multiple resolutions processed correctly."""
        # ARRANGE
        john_id = UUID("11111111-1111-1111-1111-111111111111")
        sarah_id = UUID("22222222-2222-2222-2222-222222222222")

        resolutions = [
            mock_resolution_results("John", resolved=True, entity_id=john_id),
            mock_resolution_results("Sarah", resolved=True, entity_id=sarah_id),
            mock_resolution_results("NewPerson", resolved=False, method="new_entity"),
        ]

        entity_name_to_id = {}
        results = SyncResults()

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        sync_service._process_entity_resolutions(
            resolutions, entity_name_to_id, source_id="test-source", results=results
        )

        # ASSERT
        assert len(entity_name_to_id) == 3, "All resolutions should be processed"
        assert entity_name_to_id["John"] == str(john_id)
        assert entity_name_to_id["Sarah"] == str(sarah_id)
        assert "NewPerson" in entity_name_to_id  # Created entity

    def test_error_handling_for_failed_creation(
        self,
        mock_resolution_results
    ):
        """Test error handling when entity creation fails."""
        # ARRANGE
        # Create mock that fails on insert
        failing_mock = MagicMock()
        failing_mock.table.side_effect = Exception("Database error")

        resolutions = [
            mock_resolution_results("NewPerson", resolved=False, method="new_entity")
        ]

        entity_name_to_id = {}
        results = SyncResults()

        sync_service = SupabaseSyncService(failing_mock, user_id="test")

        # ACT
        sync_service._process_entity_resolutions(
            resolutions, entity_name_to_id, source_id="test-source", results=results
        )

        # ASSERT
        # Should track error but not crash
        assert len(results.errors) > 0, "Error should be tracked"
        assert "NewPerson" not in entity_name_to_id, \
            "Failed entity should not be in mapping"


class TestSyncRelation:
    """Unit tests for _sync_relation method (tested via integration tests)."""

    def test_relation_created_with_resolved_ids(
        self,
        mock_supabase_insert_tracker,
        extraction_with_relations_factory
    ):
        """Test relation uses entity IDs from entity_name_to_id mapping."""
        # ARRANGE
        john_id = "11111111-1111-1111-1111-111111111111"
        sarah_id = "22222222-2222-2222-2222-222222222222"

        entity_name_to_id = {
            "John": john_id,
            "Sarah": sarah_id
        }

        extraction = extraction_with_relations_factory()
        relation = extraction.relations[0]

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        result = sync_service._sync_relation(relation, entity_name_to_id, source_id="test-source")

        # ASSERT
        assert result["source_name"] == "John"
        assert result["target_name"] == "Sarah"
        assert result["created"] is True

        # Verify database insert used correct IDs
        relation_inserts = mock_supabase_insert_tracker._operations["relations_insert"]
        assert len(relation_inserts) == 1
        assert relation_inserts[0]["source_id"] == john_id
        assert relation_inserts[0]["target_id"] == sarah_id


class TestSyncIntel:
    """Unit tests for _sync_intel method."""

    def test_intel_links_to_resolved_entities(
        self,
        mock_supabase_insert_tracker
    ):
        """Test intel links to entities via entity_name_to_id mapping."""
        # ARRANGE
        from app.models.extraction import IntelExtraction, IntelType, ConfidenceLevel

        alice_id = "22222222-2222-2222-2222-222222222222"
        bob_id = "44444444-4444-4444-4444-444444444444"

        entity_name_to_id = {
            "Alice": alice_id,
            "Bob": bob_id
        }

        intel = IntelExtraction(
            intel_type=IntelType.EVENT,
            description="Alice and Bob attended meeting",
            occurred_at="yesterday",
            entities_involved=["Alice", "Bob"],
            location="Office",
            details={},
            confidence=ConfidenceLevel.HIGH
        )

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        result = sync_service._sync_intel(intel, entity_name_to_id, source_id="test-source")

        # ASSERT
        assert result["entities_linked"] == 2, "Should link both entities"

        # Verify intel_entities links created
        intel_entity_inserts = mock_supabase_insert_tracker._operations["intel_entities_insert"]
        assert len(intel_entity_inserts) == 2

        linked_ids = {insert["entity_id"] for insert in intel_entity_inserts}
        assert linked_ids == {alice_id, bob_id}

    def test_intel_with_multiple_participants(
        self,
        mock_supabase_insert_tracker
    ):
        """Test intel with multiple participants all linked correctly."""
        # ARRANGE
        from app.models.extraction import IntelExtraction, IntelType, ConfidenceLevel

        entity_name_to_id = {
            "Alice": "111",
            "Bob": "222",
            "Charlie": "333"
        }

        intel = IntelExtraction(
            intel_type=IntelType.EVENT,
            description="Team meeting",
            occurred_at="today",
            entities_involved=["Alice", "Bob", "Charlie"],
            location=None,
            details={},
            confidence=ConfidenceLevel.HIGH
        )

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        result = sync_service._sync_intel(intel, entity_name_to_id, source_id="test-source")

        # ASSERT
        assert result["entities_linked"] == 3

    def test_intel_with_participant_roles(
        self,
        mock_supabase_insert_tracker
    ):
        """Test all participants have role='participant'."""
        # ARRANGE
        from app.models.extraction import IntelExtraction, IntelType, ConfidenceLevel

        entity_name_to_id = {
            "Alice": "111",
            "Bob": "222"
        }

        intel = IntelExtraction(
            intel_type=IntelType.EVENT,
            description="Meeting",
            occurred_at="today",
            entities_involved=["Alice", "Bob"],
            location=None,
            details={},
            confidence=ConfidenceLevel.HIGH
        )

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        sync_service._sync_intel(intel, entity_name_to_id, source_id="test-source")

        # ASSERT
        intel_entity_inserts = mock_supabase_insert_tracker._operations["intel_entities_insert"]

        for insert in intel_entity_inserts:
            assert insert["role"] == "participant", \
                "All participants should have role='participant'"

    def test_intel_missing_entity_handling(
        self,
        mock_supabase_insert_tracker
    ):
        """Test intel handles missing entities gracefully."""
        # ARRANGE
        from app.models.extraction import IntelExtraction, IntelType, ConfidenceLevel

        entity_name_to_id = {
            "Alice": "111"
            # Bob is missing!
        }

        intel = IntelExtraction(
            intel_type=IntelType.EVENT,
            description="Meeting",
            occurred_at="today",
            entities_involved=["Alice", "Bob"],  # Bob not in mapping
            location=None,
            details={},
            confidence=ConfidenceLevel.HIGH
        )

        sync_service = SupabaseSyncService(mock_supabase_insert_tracker, user_id="test")

        # ACT
        result = sync_service._sync_intel(intel, entity_name_to_id, source_id="test-source")

        # ASSERT
        # Should only link Alice (Bob skipped)
        assert result["entities_linked"] == 1, \
            "Should only link entities found in mapping"
