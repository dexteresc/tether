"""
Entity Resolution Models for Context-Aware Entity Resolution (Feature 003)

This module defines Pydantic models for entity resolution functionality.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime, timezone


class EntityResolutionResult(BaseModel):
    """Result of resolving a person reference to an existing entity."""

    # Input reference
    input_reference: str = Field(
        ...,
        description="The name or reference as mentioned in natural language (e.g., 'John', 'Timmy')"
    )

    # Resolution outcome
    resolved: bool = Field(
        ...,
        description="Whether the reference was successfully resolved to an existing entity"
    )

    resolved_entity_id: Optional[UUID] = Field(
        None,
        description="UUID of the resolved entity in the entities table (null if not resolved)"
    )

    # Resolution metadata
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for the resolution (0.0-1.0)"
    )

    resolution_method: Literal[
        "exact_match",
        "fuzzy_match",
        "contextual_match",
        "new_entity",
        "ambiguous"
    ] = Field(
        ...,
        description="Method used to resolve the entity"
    )

    # Ambiguity handling
    ambiguous: bool = Field(
        False,
        description="Whether multiple candidates matched (requires clarification)"
    )

    candidates: list[dict] = Field(
        default_factory=list,
        description="Candidate entities when ambiguous (includes id, name, distinguishing attributes)"
    )

    # Reasoning
    reasoning: str = Field(
        ...,
        description="Chain-of-thought explanation of how the resolution was performed"
    )

    # Matching details
    match_details: Optional[dict] = Field(
        None,
        description="Detailed matching scores (exact_match, fuzzy_scores, context_match)"
    )

    @field_validator("resolved_entity_id")
    @classmethod
    def validate_resolved_entity_id(cls, v, info):
        """If resolved=True, must have entity_id."""
        if info.data.get("resolved") and v is None:
            raise ValueError("resolved_entity_id required when resolved=True")
        return v

    @field_validator("candidates")
    @classmethod
    def validate_candidates(cls, v, info):
        """If ambiguous=True, must have candidates."""
        if info.data.get("ambiguous") and len(v) == 0:
            raise ValueError("candidates required when ambiguous=True")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "input_reference": "John",
                "resolved": True,
                "resolved_entity_id": "550e8400-e29b-41d4-a716-446655440000",
                "confidence": 0.95,
                "resolution_method": "exact_match",
                "ambiguous": False,
                "candidates": [],
                "reasoning": "Found exact match for 'John' -> John Smith (only person with first name John in database)",
                "match_details": {
                    "exact_match": True,
                    "fuzzy_scores": {"first_name": 1.0, "last_name": 1.0},
                    "context_match": None
                }
            }]
        }
    }


class PersonEntity(BaseModel):
    """Minimal representation of a person entity for matching."""

    id: UUID = Field(..., description="Entity UUID from database")

    # Identifiers (flattened from identifiers table)
    names: list[str] = Field(
        default_factory=list,
        description="All name identifiers for this person"
    )

    emails: list[str] = Field(
        default_factory=list,
        description="All email identifiers for this person"
    )

    phones: list[str] = Field(
        default_factory=list,
        description="All phone identifiers for this person"
    )

    # Attributes from entity.data JSONB
    company: Optional[str] = Field(None, description="Company attribute if present")
    location: Optional[str] = Field(None, description="Location attribute if present")

    # Metadata
    updated_at: datetime = Field(..., description="Last update timestamp")

    def get_primary_name(self) -> Optional[str]:
        """Get the first name (assumed primary)."""
        return self.names[0] if self.names else None


class SessionEntity(BaseModel):
    """Recently mentioned entity within the current session."""

    entity_id: UUID = Field(..., description="Entity UUID")
    mention_count: int = Field(1, description="How many times mentioned in session")
    last_mentioned_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When last mentioned"
    )


class ResolutionContext(BaseModel):
    """Context available for entity resolution."""

    # All person entities from database
    persons: list[PersonEntity] = Field(
        default_factory=list,
        description="All person entities available for matching"
    )

    # Session context (for pronoun resolution)
    session_entities: list[SessionEntity] = Field(
        default_factory=list,
        description="Recently mentioned entities in current session"
    )

    # Configuration
    fuzzy_first_name_threshold: float = Field(
        0.8,
        ge=0.0,
        le=1.0,
        description="Fuzzy match threshold for first names (Jaro-Winkler)"
    )

    fuzzy_last_name_threshold: float = Field(
        0.7,
        ge=0.0,
        le=1.0,
        description="Fuzzy match threshold for last names (Jaro-Winkler)"
    )

    auto_resolve_confidence_threshold: float = Field(
        0.8,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for auto-resolving to single entity"
    )

    def get_recently_mentioned(self, limit: int = 5) -> list[UUID]:
        """Get most recently mentioned entity IDs."""
        sorted_entities = sorted(
            self.session_entities,
            key=lambda x: x.last_mentioned_at,
            reverse=True
        )
        return [e.entity_id for e in sorted_entities[:limit]]
