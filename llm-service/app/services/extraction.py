from typing import Optional, List
from supabase import Client
from app.services.llm import get_llm_provider
from app.services.entity_resolver import EntityResolverService
from app.models.extraction import (
    IntelligenceExtraction,
    ExtractionClassification,
    ClassifiedExtraction,
    ClarificationRequest,
    ClarificationOption,
    summarize_reasoning,
)
from app.models.resolution import EntityResolutionResult


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


def build_chain_of_thought(extraction: IntelligenceExtraction, classification: ExtractionClassification) -> str:
    """
    Build chain_of_thought string from extraction reasoning and classification.

    Args:
        extraction: The extraction result containing reasoning
        classification: The derived classification

    Returns:
        Combined chain_of_thought string
    """
    chain_of_thought = summarize_reasoning(extraction.reasoning)

    classification_reason = f"Classification: {classification.value}"
    if classification == ExtractionClassification.MIXED:
        classification_reason += " (contains both entity data and events)"
    elif classification == ExtractionClassification.FACT_UPDATE:
        classification_reason += " (primarily entity/attribute data)"
    elif classification == ExtractionClassification.EVENT_LOG:
        classification_reason += " (primarily temporal events)"

    return f"{chain_of_thought}; {classification_reason}"


class ExtractionService:
    """Service for orchestrating intelligence extraction from text."""

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None):
        """
        Initialize extraction service.

        Args:
            provider: LLM provider ("openai", "ollama", or "anthropic")
            model: Model name
            api_key: Optional API key override (e.g. from frontend)
        """
        self.llm_provider = get_llm_provider(provider, model, api_key=api_key)

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
        extraction = self.extract_intelligence(text, context, user_name=user_name)
        classification = classify_extraction(extraction)
        chain_of_thought = build_chain_of_thought(extraction, classification)

        return ClassifiedExtraction(
            classification=classification,
            chain_of_thought=chain_of_thought,
            extraction=extraction,
            sync_results=None,
        )

    async def extract_and_classify_with_resolution(
        self,
        text: str,
        supabase_client: Client,
        user_id: Optional[str] = None,
        context: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> ClassifiedExtraction:
        """
        Extract structured intelligence, perform entity resolution, and classify the result.

        Implements T017 - integration of entity resolution into extraction workflow.

        Args:
            text: Text to extract from
            supabase_client: Supabase client for entity resolution database queries
            user_id: User ID for entity resolution context
            context: Optional context to help with extraction
            user_name: Optional name of the authenticated user for user-centric extractions

        Returns:
            ClassifiedExtraction with classification, chain_of_thought, extraction, and entity_resolutions
        """
        # Step 1: Perform normal extraction
        extraction = self.extract_intelligence(text, context, user_name=user_name)

        # Step 2: Perform entity resolution on person references
        entity_resolutions: List[EntityResolutionResult] = []
        clarification_requests: List[ClarificationRequest] = []
        needs_clarification = False

        # Initialize entity resolver
        entity_resolver = EntityResolverService(supabase_client)

        # Build resolution context
        resolution_context = await entity_resolver.build_resolution_context(user_id=user_id)

        # Collect all person names from extraction
        person_references = set()

        # Extract person names from entities
        for entity in extraction.entities:
            if entity.entity_type.value == "person":
                person_references.add(entity.name)

        # Extract person names from intel entities_involved
        for intel in extraction.intel:
            for entity_name in intel.entities_involved:
                person_references.add(entity_name)

        # Resolve each person reference
        for reference in person_references:
            resolution_result = await entity_resolver.resolve_person_reference(
                reference, resolution_context
            )
            entity_resolutions.append(resolution_result)

            # Check if any resolution needs clarification
            if resolution_result.ambiguous:
                needs_clarification = True

                # Build clarification request from ambiguous result
                options = []
                for candidate in resolution_result.candidates:
                    # Build display context from available attributes
                    context_parts = []
                    if candidate.get("company"):
                        context_parts.append(candidate["company"])
                    if candidate.get("email"):
                        context_parts.append(candidate["email"])
                    if candidate.get("location"):
                        context_parts.append(candidate["location"])

                    display_context = ", ".join(context_parts) if context_parts else "No additional context"

                    options.append(ClarificationOption(
                        entity_id=candidate["id"],
                        display_name=candidate["name"],
                        display_context=display_context
                    ))

                clarification_requests.append(ClarificationRequest(
                    question=f"Which '{reference}' do you mean?",
                    options=options,
                    ambiguous_reference=reference
                ))

        # Step 3: Classify extraction
        classification = classify_extraction(extraction)
        chain_of_thought = build_chain_of_thought(extraction, classification)

        # Add entity resolution summary to chain of thought
        if entity_resolutions:
            resolved_count = sum(1 for r in entity_resolutions if r.resolved)
            ambiguous_count = sum(1 for r in entity_resolutions if r.ambiguous)
            new_entity_count = sum(1 for r in entity_resolutions if r.resolution_method == "new_entity")

            resolution_summary = f"; Entity Resolution: {resolved_count} resolved, {ambiguous_count} ambiguous, {new_entity_count} new"
            chain_of_thought += resolution_summary

        # Step 4: Build and return classified extraction with resolution data
        return ClassifiedExtraction(
            classification=classification,
            chain_of_thought=chain_of_thought,
            extraction=extraction,
            sync_results=None,
            needs_clarification=needs_clarification,
            clarification_requests=clarification_requests,
            entity_resolutions=entity_resolutions,  # Keep original objects - Pydantic will serialize for JSON
        )


# Global extraction service instance
_extraction_service: Optional[ExtractionService] = None


def get_extraction_service() -> ExtractionService:
    """Get the global extraction service instance."""
    global _extraction_service
    if _extraction_service is None:
        _extraction_service = ExtractionService()
    return _extraction_service
