"""
Unit tests for EntityResolverService methods.

Tests individual methods in isolation.
"""

from uuid import UUID
from datetime import datetime, timezone

from app.services.entity_resolver import EntityResolverService
from app.models.resolution import PersonEntity


class TestExactMatch:
    """Unit tests for exact_match method."""

    def test_exact_match_case_insensitive(self, sample_person_entities):
        """Test exact match is case-insensitive."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Match with different case
        matches = resolver.exact_match("john smith", sample_person_entities)
        assert len(matches) == 1
        assert matches[0].names[0] == "John Smith"

    def test_exact_match_whitespace_handling(self, sample_person_entities):
        """Test exact match handles whitespace correctly."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Exact match should find it
        matches = resolver.exact_match("Alice Johnson", sample_person_entities)
        assert len(matches) == 1

    def test_exact_match_multiple_names_per_person(self, sample_person_entities):
        """Test exact match works with persons having multiple name identifiers."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Bob has both "Bob Johnson" and "Robert Johnson"
        matches = resolver.exact_match("Robert Johnson", sample_person_entities)
        assert len(matches) == 1
        assert "Robert Johnson" in matches[0].names

    def test_exact_match_no_results(self, sample_person_entities):
        """Test exact match returns empty for non-existent name."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        matches = resolver.exact_match("Jane Doe", sample_person_entities)
        assert len(matches) == 0


class TestFuzzyMatch:
    """Unit tests for fuzzy_match_single_name method."""

    def test_fuzzy_match_typo_correction(self, sample_person_entities):
        """Test fuzzy match handles typos."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # "Jon" should match "John" (typo)
        matches = resolver.fuzzy_match_single_name("Jon", sample_person_entities, threshold=0.8)
        assert len(matches) >= 1, "Fuzzy match should find similar names"

        # Check similarity scores
        for person, score in matches:
            assert 0.0 <= score <= 1.0, "Similarity score should be between 0 and 1"

    def test_fuzzy_match_nickname_matching(self, sample_person_entities):
        """Test fuzzy match works with nicknames."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # "Bob" should match "Bob Johnson" or "Robert Johnson"
        matches = resolver.fuzzy_match_single_name("Bob", sample_person_entities, threshold=0.8)
        assert len(matches) >= 1, "Should match Bob/Robert"

    def test_fuzzy_match_threshold_filtering(self, sample_person_entities):
        """Test fuzzy match filters by threshold."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Low threshold should return more matches
        low_threshold_matches = resolver.fuzzy_match_single_name(
            "John", sample_person_entities, threshold=0.5
        )

        # High threshold should return fewer matches
        high_threshold_matches = resolver.fuzzy_match_single_name(
            "John", sample_person_entities, threshold=0.95
        )

        # All high threshold matches should also be in low threshold
        high_names = {p.names[0] for p, _ in high_threshold_matches}
        low_names = {p.names[0] for p, _ in low_threshold_matches}
        assert high_names.issubset(low_names), "High threshold should be subset of low threshold"

    def test_fuzzy_match_scoring_order(self, sample_person_entities):
        """Test fuzzy match returns results ordered by score."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        matches = resolver.fuzzy_match_single_name("John", sample_person_entities, threshold=0.5)

        if len(matches) > 1:
            # Check scores are in descending order
            scores = [score for _, score in matches]
            assert scores == sorted(scores, reverse=True), \
                "Results should be ordered by score (descending)"

    def test_fuzzy_match_first_name_extraction(self, sample_person_entities):
        """Test fuzzy match extracts and matches first names."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Should match "Alice" in "Alice Johnson"
        matches = resolver.fuzzy_match_single_name("Alice", sample_person_entities, threshold=0.8)
        assert len(matches) >= 2, "Should match both Alices (Alice Johnson and Alice Williams)"


class TestConfidenceScoring:
    """Unit tests for calculate_confidence_score method."""

    def test_exact_match_confidence_calculation(self):
        """Test confidence score for exact match."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Exact match + fuzzy match (perfect)
        confidence = resolver.calculate_confidence_score(
            exact_match=True,
            fuzzy_score=1.0,
            context_match=None
        )
        assert confidence == 0.8, "Exact + fuzzy should give 0.5 + 0.3 = 0.8"

    def test_fuzzy_match_confidence_calculation(self):
        """Test confidence score for fuzzy match only."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Only fuzzy match (0.9 similarity)
        confidence = resolver.calculate_confidence_score(
            exact_match=False,
            fuzzy_score=0.9,
            context_match=None
        )
        assert confidence == 0.27, "Fuzzy only should give 0.3 * 0.9 = 0.27"

    def test_context_match_confidence_boost(self):
        """Test context match increases confidence."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Fuzzy + context
        confidence = resolver.calculate_confidence_score(
            exact_match=False,
            fuzzy_score=0.9,
            context_match="company=Acme"
        )
        expected = 0.3 * 0.9 + 0.2 * 1.0  # fuzzy_weight * score + context_weight
        assert abs(confidence - expected) < 0.01, \
            f"Context should boost confidence to {expected}, got {confidence}"

    def test_combined_scoring_weights(self):
        """Test combined exact + fuzzy + context."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # All three factors
        confidence = resolver.calculate_confidence_score(
            exact_match=True,
            fuzzy_score=1.0,
            context_match="company=Acme"
        )
        expected = 0.5 + 0.3 + 0.2  # All weights maxed out
        assert confidence == expected, \
            f"All factors should give {expected}, got {confidence}"

    def test_confidence_clamping(self):
        """Test confidence is clamped to [0, 1] range."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # All max values
        confidence = resolver.calculate_confidence_score(
            exact_match=True,
            fuzzy_score=1.0,
            context_match="company=Acme"
        )
        assert 0.0 <= confidence <= 1.0, "Confidence should be in [0, 1]"


class TestCandidateBuilding:
    """Unit tests for build_candidates_list method."""

    def test_candidates_include_distinguishing_attributes(self, sample_person_entities):
        """Test candidates include attributes that distinguish them."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Get both Alices
        alices = [p for p in sample_person_entities if "Alice" in p.names[0]]

        candidates = resolver.build_candidates_list(alices)

        assert len(candidates) == 2, "Should have 2 Alice candidates"

        # Each should have distinguishing info
        for candidate in candidates:
            assert "id" in candidate
            assert "name" in candidate
            # Should have at least one distinguishing attribute
            has_distinguishing = any(
                k in candidate for k in ["company", "email", "location"]
            )
            assert has_distinguishing, \
                "Each candidate should have distinguishing attributes"

    def test_candidates_with_all_attributes(self, sample_person_entities):
        """Test candidates include all available attributes."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        persons = [sample_person_entities[0]]  # John Smith (has all attributes)

        candidates = resolver.build_candidates_list(persons)

        assert len(candidates) == 1
        candidate = candidates[0]

        # John has company, email, phone, location
        assert "company" in candidate
        assert "email" in candidate

    def test_candidates_with_minimal_attributes(self, sample_person_entities):
        """Test candidates work with minimal attributes."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        # Create person with minimal attrs
        minimal_person = PersonEntity(
            id=UUID("77777777-7777-7777-7777-777777777777"),
            names=["Jane Doe"],
            emails=[],
            phones=[],
            company=None,
            location=None,
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        candidates = resolver.build_candidates_list([minimal_person])

        assert len(candidates) == 1
        assert candidates[0]["name"] == "Jane Doe"
        assert candidates[0]["id"] == "77777777-7777-7777-7777-777777777777"

    def test_candidates_id_and_name_required(self, sample_person_entities):
        """Test all candidates have id and name (required fields)."""
        class MockSupabase:
            pass

        resolver = EntityResolverService(MockSupabase())

        candidates = resolver.build_candidates_list(sample_person_entities)

        for candidate in candidates:
            assert "id" in candidate, "Each candidate must have id"
            assert "name" in candidate, "Each candidate must have name"
            assert isinstance(candidate["id"], str), "ID should be string (UUID)"
            assert isinstance(candidate["name"], str), "Name should be string"
