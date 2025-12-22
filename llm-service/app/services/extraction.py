from typing import Optional
from app.services.llm import get_llm_provider
from app.models.extraction import (
    IntelligenceExtraction,
    ExtractionClassification,
    ClassifiedExtraction,
    summarize_reasoning,
)


def classify_extraction(extraction: IntelligenceExtraction) -> ExtractionClassification:
    """
    Derive classification from extraction content.

    Classification logic:
    - fact_update: Only entities present (no intel)
    - event_log: Only intel present (no entities)
    - mixed: Both entities and intel present

    Args:
        extraction: The IntelligenceExtraction result

    Returns:
        ExtractionClassification enum value
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
        # No entities or intel - default to fact_update (may have relations only)
        return ExtractionClassification.FACT_UPDATE


class ExtractionService:
    """Service for orchestrating intelligence extraction from text."""

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None):
        """
        Initialize extraction service.

        Args:
            provider: LLM provider ("openai" or "ollama")
            model: Model name
        """
        self.llm_provider = get_llm_provider(provider, model)

    def extract_intelligence(
        self, text: str, context: Optional[str] = None, max_retries: int = 3, user_name: Optional[str] = None
    ) -> IntelligenceExtraction:
        """
        Extract structured intelligence from text.

        Args:
            text: Text to extract from
            context: Optional context to help with extraction
            max_retries: Number of retries for validation errors (default: 3)
            user_name: Optional name of the authenticated user for user-centric extractions

        Returns:
            IntelligenceExtraction with entities, relations, and intel
        """
        return self.llm_provider.extract(text, context, max_retries=max_retries, user_name=user_name)

    def extract_and_classify(
        self, text: str, context: Optional[str] = None, user_name: Optional[str] = None
    ) -> ClassifiedExtraction:
        """
        Extract structured intelligence and classify the result.

        Args:
            text: Text to extract from
            context: Optional context to help with extraction
            user_name: Optional name of the authenticated user for user-centric extractions

        Returns:
            ClassifiedExtraction with classification, chain_of_thought, and extraction
        """
        # Perform extraction
        extraction = self.extract_intelligence(text, context, user_name=user_name)

        # Derive classification from content
        classification = classify_extraction(extraction)

        # Summarize reasoning into chain_of_thought
        chain_of_thought = summarize_reasoning(extraction.reasoning)

        # Add classification context to chain_of_thought
        classification_reason = f"Classification: {classification.value}"
        if classification == ExtractionClassification.MIXED:
            classification_reason += " (contains both entity data and events)"
        elif classification == ExtractionClassification.FACT_UPDATE:
            classification_reason += " (primarily entity/attribute data)"
        elif classification == ExtractionClassification.EVENT_LOG:
            classification_reason += " (primarily temporal events)"

        chain_of_thought = f"{chain_of_thought}; {classification_reason}"

        return ClassifiedExtraction(
            classification=classification,
            chain_of_thought=chain_of_thought,
            extraction=extraction,
            sync_results=None,  # Will be populated by caller if sync requested
        )


# Global extraction service instance
_extraction_service: Optional[ExtractionService] = None


def get_extraction_service() -> ExtractionService:
    """Get the global extraction service instance."""
    global _extraction_service
    if _extraction_service is None:
        _extraction_service = ExtractionService()
    return _extraction_service
