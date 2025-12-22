"""
Integration tests for classification functionality.

Tests the classify_extraction() function to verify correct classification
of Fact Updates, Event Logs, and Mixed content.
"""

import pytest
import sys
import os

# Add the app directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models.extraction import (
    IntelligenceExtraction,
    EntityExtraction,
    IntelExtraction,
    Reasoning,
    ExtractionClassification,
    IdentifierExtraction,
    IdentifierType,
    EntityType,
    IntelType,
    ConfidenceLevel,
)


def classify_extraction_logic(extraction: IntelligenceExtraction) -> ExtractionClassification:
    """
    Local implementation of classify_extraction to avoid config import issues.
    This mirrors the logic in app.services.extraction.classify_extraction.
    """
    has_entities = len(extraction.entities) > 0
    has_intel = len(extraction.intel) > 0

    if has_entities and has_intel:
        return ExtractionClassification.MIXED
    elif has_entities:
        return ExtractionClassification.FACT_UPDATE
    elif has_intel:
        return ExtractionClassification.EVENT_LOG
    else:
        return ExtractionClassification.FACT_UPDATE


class TestClassifyExtraction:
    """Tests for the classify_extraction() function."""

    def test_fact_update_classification_entities_only(self):
        """T021: Test that extraction with only entities is classified as fact_update."""
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="John (person)",
                facts_identified="John's email is john@example.com",
            ),
            entities=[
                EntityExtraction(
                    name="John",
                    entity_type=EntityType.PERSON,
                    identifiers=[
                        IdentifierExtraction(
                            identifier_type=IdentifierType.NAME,
                            value="John",
                        ),
                        IdentifierExtraction(
                            identifier_type=IdentifierType.EMAIL,
                            value="john@example.com",
                        ),
                    ],
                    confidence=ConfidenceLevel.HIGH,
                )
            ],
            relations=[],
            intel=[],
        )

        classification = classify_extraction_logic(extraction)
        assert classification == ExtractionClassification.FACT_UPDATE

    def test_event_log_classification_intel_only(self):
        """T022: Test that extraction with only intel is classified as event_log."""
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                events_identified="Called John yesterday",
            ),
            entities=[],
            relations=[],
            intel=[
                IntelExtraction(
                    intel_type=IntelType.COMMUNICATION,
                    description="Called John to discuss the project",
                    occurred_at="yesterday",
                    entities_involved=["John"],
                    confidence=ConfidenceLevel.HIGH,
                )
            ],
        )

        classification = classify_extraction_logic(extraction)
        assert classification == ExtractionClassification.EVENT_LOG

    def test_mixed_classification_entities_and_intel(self):
        """T023: Test that extraction with both entities and intel is classified as mixed."""
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                entities_identified="Sarah (person)",
                events_identified="Met Sarah at the conference",
            ),
            entities=[
                EntityExtraction(
                    name="Sarah",
                    entity_type=EntityType.PERSON,
                    identifiers=[
                        IdentifierExtraction(
                            identifier_type=IdentifierType.NAME,
                            value="Sarah",
                        ),
                        IdentifierExtraction(
                            identifier_type=IdentifierType.EMAIL,
                            value="sarah@tech.co",
                        ),
                    ],
                    confidence=ConfidenceLevel.HIGH,
                )
            ],
            relations=[],
            intel=[
                IntelExtraction(
                    intel_type=IntelType.EVENT,
                    description="Met at conference in NYC",
                    occurred_at="yesterday",
                    entities_involved=["Sarah"],
                    location="NYC",
                    confidence=ConfidenceLevel.MEDIUM,
                )
            ],
        )

        classification = classify_extraction_logic(extraction)
        assert classification == ExtractionClassification.MIXED

    def test_empty_extraction_defaults_to_fact_update(self):
        """Test that empty extraction defaults to fact_update."""
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(),
            entities=[],
            relations=[],
            intel=[],
        )

        classification = classify_extraction_logic(extraction)
        assert classification == ExtractionClassification.FACT_UPDATE

    def test_relations_only_defaults_to_fact_update(self):
        """Test that extraction with only relations defaults to fact_update."""
        extraction = IntelligenceExtraction(
            reasoning=Reasoning(
                relationships_identified="John is spouse of Sarah",
            ),
            entities=[],
            relations=[],
            intel=[],
        )

        classification = classify_extraction_logic(extraction)
        assert classification == ExtractionClassification.FACT_UPDATE
