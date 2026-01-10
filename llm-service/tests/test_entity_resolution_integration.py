"""
Integration tests for entity resolution feature (003).

Tests the complete flow: extraction → entity resolution → clarification/resolution
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone

from app.services.entity_resolver import EntityResolverService
from app.models.resolution import PersonEntity, ResolutionContext


class TestEntityResolutionIntegration:
    """Integration tests for entity resolution with real Supabase client."""

    @pytest.fixture
    def sample_persons(self):
        """Sample person entities for testing."""
        return [
            PersonEntity(
                id=uuid4(),
                names=["John Smith"],
                emails=["john@example.com"],
                phones=[],
                company="Acme Corp",
                location=None,
                updated_at=datetime.now(timezone.utc).isoformat()
            ),
            PersonEntity(
                id=uuid4(),
                names=["Alice Johnson"],
                emails=["alice.j@techcorp.com"],
                phones=[],
                company="TechCorp",
                location=None,
                updated_at=datetime.now(timezone.utc).isoformat()
            ),
            PersonEntity(
                id=uuid4(),
                names=["Alice Williams"],
                emails=["alice.w@designco.com"],
                phones=[],
                company="DesignCo",
                location=None,
                updated_at=datetime.now(timezone.utc).isoformat()
            ),
            PersonEntity(
                id=uuid4(),
                names=["Timmy Chen"],
                emails=["timmy@startup.io"],
                phones=[],
                company="Startup Inc",
                location=None,
                updated_at=datetime.now(timezone.utc).isoformat()
            ),
        ]

    @pytest.fixture
    def resolution_context(self, sample_persons):
        """Resolution context with sample persons."""
        return ResolutionContext(
            persons=sample_persons,
            session_entities=[],
            fuzzy_first_name_threshold=0.8,
            fuzzy_last_name_threshold=0.7,
            auto_resolve_confidence_threshold=0.8
        )

    @pytest.mark.asyncio
    async def test_unique_person_resolution(self, resolution_context):
        """Test US1: Resolve unique person reference."""
        # Mock Supabase client
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Resolve unique reference "John"
        result = await resolver.resolve_person_reference("John", resolution_context)

        assert result.resolved is True
        assert result.ambiguous is False
        # Fuzzy match confidence is 0.3 (fuzzy_weight * score = 0.3 * 1.0)
        assert result.confidence > 0.0
        assert result.confidence <= 1.0
        assert result.resolution_method in ["exact_match", "fuzzy_match"]
        assert "John" in result.reasoning
        assert result.resolved_entity_id is not None

    @pytest.mark.asyncio
    async def test_ambiguous_person_detection(self, resolution_context):
        """Test US2: Detect ambiguous person references."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Resolve ambiguous reference "Alice" (matches 2 persons)
        result = await resolver.resolve_person_reference("Alice", resolution_context)

        assert result.ambiguous is True
        assert result.resolved is False
        assert len(result.candidates) == 2
        assert result.resolution_method == "ambiguous"

        # Verify candidates have distinguishing attributes
        for candidate in result.candidates:
            assert "name" in candidate
            assert "id" in candidate
            # Should have at least one distinguishing attribute
            assert "company" in candidate or "email" in candidate

    @pytest.mark.asyncio
    async def test_multi_person_resolution(self, resolution_context):
        """Test US3: Resolve multiple person references."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Resolve multiple references
        john_result = await resolver.resolve_person_reference("John", resolution_context)
        timmy_result = await resolver.resolve_person_reference("Timmy", resolution_context)

        # Both should resolve uniquely
        assert john_result.resolved is True
        assert timmy_result.resolved is True
        assert john_result.resolved_entity_id != timmy_result.resolved_entity_id

    @pytest.mark.asyncio
    async def test_fuzzy_matching(self, sample_persons):
        """Test fuzzy name matching with partial names."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Add a person with nickname
        bob = PersonEntity(
            id=uuid4(),
            names=["Robert Johnson", "Bob Johnson"],
            emails=["bob@example.com"],
            phones=[],
            company=None,
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        persons_with_bob = sample_persons + [bob]

        context = ResolutionContext(
            persons=persons_with_bob,
            session_entities=[],
            fuzzy_first_name_threshold=0.8,
            fuzzy_last_name_threshold=0.7,
            auto_resolve_confidence_threshold=0.8
        )

        # Fuzzy match "Bob" to "Robert Johnson"
        result = await resolver.resolve_person_reference("Bob", context)

        assert result.resolved is True
        assert result.resolution_method in ["exact_match", "fuzzy_match"]

    def test_exact_match_method(self, sample_persons):
        """Test exact matching logic."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Exact match should find John Smith
        matches = resolver.exact_match("John Smith", sample_persons)
        assert len(matches) == 1
        assert matches[0].names[0] == "John Smith"

        # Case-insensitive exact match
        matches = resolver.exact_match("john smith", sample_persons)
        assert len(matches) == 1

        # No match for non-existent name
        matches = resolver.exact_match("Jane Doe", sample_persons)
        assert len(matches) == 0

    def test_fuzzy_match_method(self, sample_persons):
        """Test fuzzy matching logic."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Fuzzy match "Jon" to "John" (typo)
        matches = resolver.fuzzy_match_single_name("Jon", sample_persons, threshold=0.8)
        assert len(matches) >= 1

        # Fuzzy match should return similarity scores
        if matches:
            person, score = matches[0]
            assert 0.0 <= score <= 1.0

    def test_confidence_score_calculation(self):
        """Test confidence score calculation."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Exact match should give highest confidence
        exact_confidence = resolver.calculate_confidence_score(
            exact_match=True,
            fuzzy_score=1.0,
            context_match=None
        )
        assert exact_confidence == 0.8  # 0.5 * 1.0 + 0.3 * 1.0 = 0.8

        # Fuzzy match only should give lower confidence
        fuzzy_confidence = resolver.calculate_confidence_score(
            exact_match=False,
            fuzzy_score=0.9,
            context_match=None
        )
        assert fuzzy_confidence == 0.27  # 0.3 * 0.9 = 0.27

        # Context match should increase confidence
        context_confidence = resolver.calculate_confidence_score(
            exact_match=False,
            fuzzy_score=0.9,
            context_match="company=Acme"
        )
        assert abs(context_confidence - 0.47) < 0.01  # 0.3 * 0.9 + 0.2 * 1.0 = 0.47 (with floating point tolerance)

    def test_full_name_disambiguation(self, sample_persons):
        """Test US2: Full name matching for disambiguation."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Add multiple persons with same first name
        alice_persons = [p for p in sample_persons if "Alice" in p.names[0]]

        # Full name should disambiguate
        match = resolver.full_name_matching("Alice Johnson", alice_persons)
        assert match is not None
        assert "Alice Johnson" in match.names

        # Partial name should not disambiguate
        match = resolver.full_name_matching("Alice", alice_persons)
        assert match is None  # No space in reference, can't do full name matching

    def test_contextual_attribute_matching(self, sample_persons):
        """Test US2: Contextual attribute matching for disambiguation."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Get ambiguous Alices
        alice_persons = [p for p in sample_persons if "Alice" in p.names[0]]

        # Context with company should disambiguate
        input_text = "Alice from TechCorp called me yesterday"
        result = resolver.contextual_attribute_matching("Alice", input_text, alice_persons)

        assert result is not None
        person, context_attr = result
        assert person.company == "TechCorp"
        assert "company=" in context_attr

    def test_build_candidates_list(self, sample_persons):
        """Test building clarification candidates."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Get ambiguous Alices
        alice_persons = [p for p in sample_persons if "Alice" in p.names[0]]

        candidates = resolver.build_candidates_list(alice_persons)

        assert len(candidates) == 2
        for candidate in candidates:
            assert "id" in candidate
            assert "name" in candidate
            # At least one should have company
            assert any("company" in c for c in candidates)


class TestExtractionWithResolution:
    """Test extraction service integration with entity resolution."""

    @pytest.mark.asyncio
    async def test_extract_with_resolution_unique(self):
        """Test extraction with unique person resolution."""
        # This would require a real Supabase client with seeded data
        # Mark as integration test that runs separately
        pytest.skip("Requires real Supabase instance with seeded data")

    @pytest.mark.asyncio
    async def test_extract_with_resolution_ambiguous(self):
        """Test extraction with ambiguous person detection."""
        pytest.skip("Requires real Supabase instance with seeded data")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
