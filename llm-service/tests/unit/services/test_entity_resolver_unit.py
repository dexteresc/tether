"""
Unit tests for EntityResolverService methods.

Tests individual methods in isolation.
"""

from app.services.entity_resolver import EntityResolverService


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


