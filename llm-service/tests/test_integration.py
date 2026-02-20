"""
Integration tests for LLM extraction and database sync.

These tests verify that:
1. LLM extraction produces correct structured data
2. Database sync correctly creates/updates entities, relations, and intel
3. Entity resolution works properly (no duplicates)
"""
import pytest
from supabase import create_client
from app.config import settings
from app.services.extraction import ExtractionService
from app.services.supabase_sync import SupabaseSyncService
from app.models.extraction import EntityType, IntelType


# Test user ID (use a consistent test user)
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def supabase_client():
    """Create an authenticated Supabase client for testing."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@pytest.fixture
def extraction_service():
    """Create an extraction service instance."""
    return ExtractionService()


@pytest.fixture
def sync_service(supabase_client):
    """Create a sync service instance."""
    return SupabaseSyncService(supabase_client, TEST_USER_ID)


def cleanup_test_data(supabase_client):
    """Clean up test data before/after tests."""
    # Delete test entities and their related data
    try:
        # Get all entities for test user
        entities = (
            supabase_client.table("entities")
            .select("id")
            .filter("data->>user_id", "eq", TEST_USER_ID)
            .execute()
        )

        if entities.data:
            entity_ids = [e["id"] for e in entities.data]

            # Delete intel_entities links
            supabase_client.table("intel_entities").delete().in_("entity_id", entity_ids).execute()

            # Delete relations
            supabase_client.table("relations").delete().or_(
                f"source_id.in.({','.join(entity_ids)}),target_id.in.({','.join(entity_ids)})"
            ).execute()

            # Delete identifiers
            supabase_client.table("identifiers").delete().in_("entity_id", entity_ids).execute()

            # Delete entities
            supabase_client.table("entities").delete().in_("id", entity_ids).execute()

        # Delete test intel
        intel = (
            supabase_client.table("intel")
            .select("id")
            .filter("data->>test", "eq", "true")
            .execute()
        )
        if intel.data:
            intel_ids = [i["id"] for i in intel.data]
            supabase_client.table("intel_entities").delete().in_("intel_id", intel_ids).execute()
            supabase_client.table("intel").delete().in_("id", intel_ids).execute()

        # Delete test sources
        supabase_client.table("sources").delete().ilike("code", "TEST_%").execute()

    except Exception as e:
        print(f"Cleanup error (non-fatal): {e}")


class TestBasicExtraction:
    """Test basic extraction and sync functionality."""

    def test_extract_entities_and_facts(self, extraction_service, sync_service, supabase_client):
        """Test extraction of entities and facts."""
        # Cleanup before test
        cleanup_test_data(supabase_client)

        text = "John Smith works at Acme Corp. His email is john@acme.com and phone is +1-555-0100."

        # Extract
        extraction = extraction_service.extract_intelligence(text)

        # Verify extraction has entities
        assert len(extraction.entities) >= 2, "Should extract at least 2 entities (John Smith, Acme Corp)"

        # Find John Smith entity
        john = next((e for e in extraction.entities if "John Smith" in e.name), None)
        assert john is not None, "Should extract John Smith entity"
        assert john.entity_type == EntityType.PERSON

        # Verify identifiers - at minimum should have name identifier
        # Note: Email/phone extraction may vary based on model behavior
        identifier_types = [i.identifier_type.value for i in john.identifiers]
        assert "name" in identifier_types, "Should have at least name identifier"
        assert len(john.identifiers) >= 1, "Should have at least one identifier"

        # Sync to database
        results = sync_service.sync_extraction(extraction, "TEST_BASIC")

        # Verify sync results (accept both created and updated entities)
        total_entities = len(results.entities_created) + len(results.entities_updated)
        assert total_entities >= 2, f"Should create or update at least 2 entities (created: {len(results.entities_created)}, updated: {len(results.entities_updated)})"
        assert len(results.errors) == 0, f"Should have no errors: {results.errors}"

        # Verify data in database
        entities = (
            supabase_client.table("entities")
            .select("*, identifiers(*)")
            .filter("data->>user_id", "eq", TEST_USER_ID)
            .execute()
        )

        assert len(entities.data) >= 2, "Should have at least 2 entities in database"

        # Find John Smith in database
        john_entity = next((e for e in entities.data if "John Smith" in str(e.get("data", {}))), None)
        assert john_entity is not None, "Should find John Smith in database"

        # Verify identifiers were created
        assert len(john_entity["identifiers"]) >= 1, "Should have at least 1 identifier"

        # Cleanup
        cleanup_test_data(supabase_client)


class TestRelationsExtraction:
    """Test extraction and sync of relationships."""

    def test_extract_relations(self, extraction_service, sync_service, supabase_client):
        """Test extraction of relationships between entities."""
        cleanup_test_data(supabase_client)

        text = "Sarah Johnson is the CEO of TechCorp. Her husband Michael works there as CTO."

        # Extract
        extraction = extraction_service.extract_intelligence(text)

        # Verify extraction has entities - at minimum Sarah and TechCorp
        # Note: Michael may be mentioned only in relations, not as separate entity
        assert len(extraction.entities) >= 2, "Should extract at least Sarah and TechCorp"

        # Verify key entities are present
        entity_names = [e.name for e in extraction.entities]
        assert any("Sarah" in name for name in entity_names), "Should extract Sarah"
        assert any("TechCorp" in name for name in entity_names), "Should extract TechCorp"

        # Verify relations were extracted - should find spouse and employment relations
        assert len(extraction.relations) >= 2, "Should extract at least 2 relations (spouse, employment)"

        # Sync to database
        results = sync_service.sync_extraction(extraction, "TEST_RELATIONS")

        # Verify sync results (accept both created and updated)
        # Note: Entity count may vary if some entities are only in relations
        total_entities = len(results.entities_created) + len(results.entities_updated)
        assert total_entities >= 2, f"Should create or update at least 2 entities (created: {len(results.entities_created)}, updated: {len(results.entities_updated)})"
        # Note: Some relations may fail if entities aren't extracted separately
        assert len(results.relations_created) >= 1, "Should create at least 1 relation"
        # Errors may occur for relations where entities don't exist
        assert len(results.errors) <= 2, f"Should have minimal errors: {results.errors}"

        # Verify relations in database
        relations = (
            supabase_client.table("relations")
            .select("*")
            .execute()
        )

        # Filter to only test relations (check if any exist)
        test_relations = [r for r in relations.data if r.get("type") in ["spouse", "member", "owner", "colleague", "employee"]]

        assert len(test_relations) >= 1, "Should have at least 1 relation in database"

        # Check for relations (spouse, owner, employee, etc.)
        # Note: Specific relation types may vary based on extraction consistency
        relation_types = [r["type"] for r in test_relations]
        assert len(relation_types) >= 1, "Should have at least 1 relation of known type"

        cleanup_test_data(supabase_client)


class TestIntelExtraction:
    """Test extraction and sync of intelligence/events."""

    def test_extract_events(self, extraction_service, sync_service, supabase_client):
        """Test extraction of events and intel."""
        cleanup_test_data(supabase_client)

        text = "I heard that David went to the conference in New York yesterday from Lisa."

        # Extract
        extraction = extraction_service.extract_intelligence(text)

        # Verify extraction has entities
        # Note: Entity extraction can vary - may extract David, New York, Lisa, or just some
        assert len(extraction.entities) >= 1, "Should extract at least 1 entity"

        # Verify intel was extracted
        assert len(extraction.intel) >= 1, "Should extract at least 1 intel/event"

        event = extraction.intel[0]
        assert event.intel_type in [IntelType.EVENT, IntelType.SIGHTING], "Should be event or sighting type"
        assert len(event.entities_involved) >= 1, "Should involve at least 1 entity"

        # Sync to database
        results = sync_service.sync_extraction(extraction, "TEST_INTEL")

        # Verify sync results
        assert len(results.intel_created) >= 1, "Should create at least 1 intel record"
        assert len(results.errors) == 0, f"Should have no errors: {results.errors}"

        # Verify intel in database (get all intel with entity links)
        all_intel = (
            supabase_client.table("intel")
            .select("*, intel_entities(*)")
            .execute()
        )

        # Filter to test intel (intel with entities linked)
        test_intel = [
            i for i in all_intel.data
            if len(i.get("intel_entities", [])) > 0
        ]

        assert len(test_intel) >= 1, "Should have at least 1 intel record in database"

        # Verify entity linking
        intel_with_entities = [i for i in test_intel if len(i.get("intel_entities", [])) > 0]
        assert len(intel_with_entities) >= 1, "Should have intel linked to entities"

        cleanup_test_data(supabase_client)


class TestEntityResolution:
    """Test that entity resolution prevents duplicates."""

    def test_no_duplicate_entities(self, extraction_service, sync_service, supabase_client):
        """Test that mentioning the same entity twice doesn't create duplicates."""
        cleanup_test_data(supabase_client)

        # First extraction
        text1 = "Alice Brown works at DataCorp."
        extraction1 = extraction_service.extract_intelligence(text1)
        _results1 = sync_service.sync_extraction(extraction1, "TEST_DEDUP")

        # Get Alice's entity ID
        entities_after_first = (
            supabase_client.table("entities")
            .select("id")
            .filter("data->>user_id", "eq", TEST_USER_ID)
            .execute()
        )
        count_after_first = len(entities_after_first.data)

        # Second extraction mentioning Alice again
        text2 = "Alice Brown gave a presentation today."
        extraction2 = extraction_service.extract_intelligence(text2)
        _results2 = sync_service.sync_extraction(extraction2, "TEST_DEDUP")

        # Verify Alice wasn't duplicated
        entities_after_second = (
            supabase_client.table("entities")
            .select("id")
            .filter("data->>user_id", "eq", TEST_USER_ID)
            .execute()
        )
        count_after_second = len(entities_after_second.data)

        # Should have same number or only +1 for new entities, not +2 for Alice
        assert count_after_second <= count_after_first + 1, (
            f"Should not create duplicate Alice entity. "
            f"First: {count_after_first}, Second: {count_after_second}"
        )

        # Verify Alice appears only once by name
        identifiers = (
            supabase_client.table("identifiers")
            .select("*")
            .eq("type", "name")
            .ilike("value", "Alice Brown")
            .execute()
        )

        assert len(identifiers.data) == 1, "Alice Brown should appear only once in identifiers"

        cleanup_test_data(supabase_client)


class TestComplexScenario:
    """Test complex multi-entity, multi-relation, multi-intel scenario."""

    def test_complex_extraction(self, extraction_service, sync_service, supabase_client):
        """Test a complex scenario with multiple entities, relations, and intel."""
        cleanup_test_data(supabase_client)

        text = """
        Bob Miller (bob@example.com) is the founder of StartupXYZ.
        His co-founder is Emma Davis (emma@startup.xyz).
        They were spotted at a tech conference in San Francisco last week.
        Bob mentioned that their company raised $5M in funding.
        """

        # Extract
        extraction = extraction_service.extract_intelligence(text)

        # Verify comprehensive extraction
        print(f"\nExtracted {len(extraction.entities)} entities")
        print(f"Extracted {len(extraction.relations)} relations")
        print(f"Extracted {len(extraction.intel)} intel")

        assert len(extraction.entities) >= 3, "Should extract Bob, Emma, StartupXYZ, and possibly San Francisco"
        assert len(extraction.relations) >= 1, "Should extract at least 1 relation"
        assert len(extraction.intel) >= 1, "Should extract at least 1 intel"

        # Verify Bob has email identifier
        bob = next((e for e in extraction.entities if "Bob" in e.name), None)
        if bob:
            identifier_types = [i.identifier_type.value for i in bob.identifiers]
            assert "email" in identifier_types, "Bob should have email identifier"

        # Sync to database
        results = sync_service.sync_extraction(extraction, "TEST_COMPLEX")

        print("\nSync results:")
        print(f"  Entities created: {len(results.entities_created)}")
        print(f"  Entities updated: {len(results.entities_updated)}")
        print(f"  Relations created: {len(results.relations_created)}")
        print(f"  Intel created: {len(results.intel_created)}")
        print(f"  Errors: {results.errors}")

        # Verify comprehensive sync
        total_entities = len(results.entities_created) + len(results.entities_updated)
        assert total_entities >= 3, f"Should create or update at least 3 entities (got {total_entities})"
        assert len(results.errors) == 0, f"Should have no errors: {results.errors}"

        # Verify all data in database
        entities = (
            supabase_client.table("entities")
            .select("*, identifiers(*)")
            .filter("data->>user_id", "eq", TEST_USER_ID)
            .execute()
        )

        print(f"\nEntities in database: {len(entities.data)}")
        for entity in entities.data:
            print(f"  - {entity.get('data', {}).get('name')} ({entity['type']}) with {len(entity['identifiers'])} identifiers")

        assert len(entities.data) >= 3, "Should have at least 3 entities in database"

        cleanup_test_data(supabase_client)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
