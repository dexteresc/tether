"""
Entity Resolver Service for Context-Aware Entity Resolution (Feature 003)

This service handles the core logic for resolving person references in natural language
to existing entities in the database.
"""

from typing import Optional
from uuid import UUID
from supabase import Client
from app.models.resolution import (
    EntityResolutionResult,
    PersonEntity,
    ResolutionContext
)
from app.config import settings


class EntityResolverService:
    """Service for resolving person references to existing entities."""

    def __init__(self, supabase_client: Client):
        """
        Initialize the entity resolver service.

        Args:
            supabase_client: Supabase client for database operations
        """
        self.supabase = supabase_client
        self.config = settings

    async def query_persons_from_database(self, user_id: Optional[str] = None) -> list[PersonEntity]:
        """
        Fetch all person entities and their identifiers from Supabase.

        Args:
            user_id: Optional user ID for RLS filtering

        Returns:
            List of PersonEntity objects with flattened identifiers
        """
        # Query entities and identifiers with a join
        query = (
            self.supabase.table("entities")
            .select("id, data, updated_at, identifiers(type, value)")
            .eq("type", "person")
            .is_("deleted_at", "null")
        )

        response = query.execute()

        # Transform database results into PersonEntity objects
        person_entities = []
        for entity_row in response.data:
            # Group identifiers by type
            names = []
            emails = []
            phones = []

            for identifier in entity_row.get("identifiers", []):
                if identifier.get("type") == "name":
                    names.append(identifier["value"])
                elif identifier.get("type") == "email":
                    emails.append(identifier["value"])
                elif identifier.get("type") == "phone":
                    phones.append(identifier["value"])

            # Extract company and location from JSONB data field
            data = entity_row.get("data", {}) or {}
            company = data.get("company")
            location = data.get("location")

            person_entity = PersonEntity(
                id=UUID(entity_row["id"]),
                names=names,
                emails=emails,
                phones=phones,
                company=company,
                location=location,
                updated_at=entity_row["updated_at"]
            )
            person_entities.append(person_entity)

        return person_entities

    async def build_resolution_context(
        self,
        user_id: Optional[str] = None,
    ) -> ResolutionContext:
        """
        Build a ResolutionContext from database query results.

        Args:
            user_id: Optional user ID for RLS filtering

        Returns:
            ResolutionContext with all persons and configuration
        """
        # Query all person entities from database
        persons = await self.query_persons_from_database(user_id)

        # Build resolution context with configuration from settings
        context = ResolutionContext(
            persons=persons,
            fuzzy_first_name_threshold=self.config.fuzzy_match_first_name_threshold,
        )

        return context

    def exact_match(self, reference: str, persons: list[PersonEntity]) -> list[PersonEntity]:
        """
        Find persons with exact name matches (case-insensitive).

        Args:
            reference: The name reference to match
            persons: List of person entities to search

        Returns:
            List of matching PersonEntity objects
        """
        matches = []
        reference_lower = reference.lower().strip()

        for person in persons:
            # Check all name identifiers for exact match
            for name in person.names:
                if name.lower().strip() == reference_lower:
                    matches.append(person)
                    break  # Don't add same person multiple times

        return matches

    def fuzzy_match_single_name(
        self,
        reference: str,
        persons: list[PersonEntity],
        threshold: float
    ) -> list[tuple[PersonEntity, float]]:
        """
        Find persons with fuzzy name matches using Jaro-Winkler similarity.

        Args:
            reference: The name reference to match
            persons: List of person entities to search
            threshold: Similarity threshold (0.0-1.0)

        Returns:
            List of tuples (PersonEntity, similarity_score) above threshold
        """
        from app.utils.fuzzy_matcher import jaro_winkler_similarity, extract_first_name

        matches = []
        reference_lower = reference.lower().strip()
        reference_parts = reference_lower.split()
        is_full_name_reference = len(reference_parts) >= 2

        for person in persons:
            best_score = 0.0

            # Check all name identifiers
            for name in person.names:
                name_lower = name.lower().strip()
                name_parts = name_lower.split()
                is_full_name_entity = len(name_parts) >= 2

                if is_full_name_reference:
                    # Reference is a full name (e.g., "John Smith")
                    # Only match against full names, not single first names
                    if is_full_name_entity:
                        # Both are full names - compare full names
                        full_name_score = jaro_winkler_similarity(reference_lower, name_lower)
                        best_score = max(best_score, full_name_score)
                    # Skip single-name entities for full name references
                    # "John Smith" should NOT match just "Jonathan"
                else:
                    # Reference is a single name (e.g., "John")
                    # Can match against first names
                    first_name = extract_first_name(name_lower)
                    first_name_score = jaro_winkler_similarity(reference_lower, first_name)

                    # Also try full name match in case reference matches a full name
                    full_name_score = jaro_winkler_similarity(reference_lower, name_lower)

                    best_score = max(best_score, first_name_score, full_name_score)

            # Add to matches if above threshold
            if best_score >= threshold:
                matches.append((person, best_score))

        # Sort by score descending
        matches.sort(key=lambda x: x[1], reverse=True)

        return matches

    async def resolve_person_reference(
        self,
        reference: str,
        context: ResolutionContext
    ) -> EntityResolutionResult:
        """
        Resolve a person reference using exact and fuzzy matching.

        Implements T014 (orchestration) and T016 (chain_of_thought reasoning).

        Args:
            reference: The name reference to resolve
            context: Resolution context with persons and config

        Returns:
            EntityResolutionResult with resolution outcome
        """
        # Step 1: Try exact match first
        exact_matches = self.exact_match(reference, context.persons)

        if len(exact_matches) == 1:
            # Unique exact match found
            person = exact_matches[0]
            confidence = self.calculate_confidence_score(
                exact_match=True,
                fuzzy_score=1.0,
                context_match=None
            )
            reasoning = (
                f"Found exact match for '{reference}' -> {person.get_primary_name()} "
                f"(only person with this name in database). Confidence: {confidence:.2f}"
            )
            return EntityResolutionResult(
                input_reference=reference,
                resolved=True,
                resolved_entity_id=person.id,
                confidence=confidence,
                resolution_method="exact_match",
                ambiguous=False,
                candidates=[],
                reasoning=reasoning,
                match_details={
                    "exact_match": True,
                    "fuzzy_scores": {"full_name": 1.0},
                    "context_match": None
                }
            )

        elif len(exact_matches) > 1:
            # Multiple exact matches - ambiguous (will be handled in Phase 4/US2)
            # For now, return first match with lower confidence
            person = exact_matches[0]
            confidence = 0.5  # Lower confidence due to ambiguity
            reasoning = (
                f"Multiple exact matches found for '{reference}': "
                f"{[p.get_primary_name() for p in exact_matches]}. "
                f"Requires clarification (ambiguous reference)."
            )
            return EntityResolutionResult(
                input_reference=reference,
                resolved=False,
                resolved_entity_id=None,
                confidence=0.0,
                resolution_method="ambiguous",
                ambiguous=True,
                candidates=[
                    {
                        "id": str(p.id),
                        "name": p.get_primary_name(),
                        "company": p.company,
                        "email": p.emails[0] if p.emails else None
                    }
                    for p in exact_matches
                ],
                reasoning=reasoning,
                match_details={"exact_match": True, "match_count": len(exact_matches)}
            )

        # Step 2: Try fuzzy matching
        fuzzy_matches = self.fuzzy_match_single_name(
            reference,
            context.persons,
            threshold=context.fuzzy_first_name_threshold
        )

        if len(fuzzy_matches) == 1:
            # Unique fuzzy match found - auto-resolve since it's the only match
            person, fuzzy_score = fuzzy_matches[0]
            confidence = self.calculate_confidence_score(
                exact_match=False,
                fuzzy_score=fuzzy_score,
                context_match=None
            )

            # Auto-resolve unique fuzzy match (already above fuzzy threshold by definition)
            reasoning = (
                f"Fuzzy matched '{reference}' to '{person.get_primary_name()}' "
                f"(similarity: {fuzzy_score:.2f}). Confidence: {confidence:.2f}. "
                f"Only match above threshold ({context.fuzzy_first_name_threshold})."
            )
            return EntityResolutionResult(
                input_reference=reference,
                resolved=True,
                resolved_entity_id=person.id,
                confidence=confidence,
                resolution_method="fuzzy_match",
                ambiguous=False,
                candidates=[],
                reasoning=reasoning,
                match_details={
                    "exact_match": False,
                    "fuzzy_scores": {"best_score": fuzzy_score},
                    "context_match": None
                }
            )

        elif len(fuzzy_matches) > 1:
            # Multiple fuzzy matches - ambiguous
            reasoning = (
                f"Multiple fuzzy matches found for '{reference}': "
                f"{[(p.get_primary_name(), score) for p, score in fuzzy_matches[:3]]}. "
                f"Requires clarification."
            )
            return EntityResolutionResult(
                input_reference=reference,
                resolved=False,
                resolved_entity_id=None,
                confidence=0.0,
                resolution_method="ambiguous",
                ambiguous=True,
                candidates=[
                    {
                        "id": str(p.id),
                        "name": p.get_primary_name(),
                        "company": p.company,
                        "email": p.emails[0] if p.emails else None,
                        "similarity": score
                    }
                    for p, score in fuzzy_matches
                ],
                reasoning=reasoning,
                match_details={"fuzzy_scores": [(p.get_primary_name(), score) for p, score in fuzzy_matches]}
            )

        # Step 3: No matches found - create new entity
        reasoning = (
            f"No existing person matches '{reference}'. "
            f"Checked {len(context.persons)} persons with exact and fuzzy matching. "
            f"Will create new entity."
        )
        return EntityResolutionResult(
            input_reference=reference,
            resolved=False,
            resolved_entity_id=None,
            confidence=0.0,
            resolution_method="new_entity",
            ambiguous=False,
            candidates=[],
            reasoning=reasoning,
            match_details={"exact_match": False, "fuzzy_matches": 0}
        )

    def calculate_confidence_score(
        self,
        exact_match: bool,
        fuzzy_score: Optional[float],
        context_match: Optional[str]
    ) -> float:
        """
        Calculate weighted confidence score for entity resolution.

        Weighted scoring formula:
        - Exact match: 0.5 weight
        - Fuzzy match: 0.3 weight
        - Context match: 0.2 weight

        Args:
            exact_match: Whether exact match was found
            fuzzy_score: Fuzzy matching similarity score (0.0-1.0)
            context_match: Contextual attribute that matched (company, email, etc.)

        Returns:
            Confidence score (0.0-1.0)
        """
        # Weights (sum to 1.0)
        exact_weight = 0.5
        fuzzy_weight = 0.3
        context_weight = 0.2

        # Component scores
        exact_score = 1.0 if exact_match else 0.0
        fuzzy_component = fuzzy_score if fuzzy_score is not None else 0.0
        context_score = 1.0 if context_match else 0.0

        # Weighted sum
        confidence = (
            exact_weight * exact_score +
            fuzzy_weight * fuzzy_component +
            context_weight * context_score
        )

        # Clamp to [0.0, 1.0]
        return max(0.0, min(1.0, confidence))

