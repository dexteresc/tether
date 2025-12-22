from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.services.extraction import get_extraction_service
from app.services.supabase_sync import SupabaseSyncService
from app.services.auth import verify_supabase_jwt, create_service_role_client, get_user_info
from app.models.extraction import (
    IntelligenceExtraction,
    SyncResults,
    ClassifiedExtraction,
    ExtractionClassification,
)
from app.config import settings


router = APIRouter()


class ExtractionRequest(BaseModel):
    text: str
    context: Optional[str] = None
    source_code: Optional[str] = "LLM"
    sync_to_db: bool = True


class ExtractionResponse(BaseModel):
    extraction: IntelligenceExtraction
    sync_results: Optional[SyncResults] = None


class ClassifiedExtractionResponse(BaseModel):
    """Response with classification, chain-of-thought, and extraction results."""
    classification: ExtractionClassification
    chain_of_thought: str
    extraction: IntelligenceExtraction
    sync_results: Optional[SyncResults] = None


class HealthResponse(BaseModel):
    """Health check response with provider info."""
    status: str
    provider: str
    model: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint with provider information.

    Returns:
        Health status and current LLM provider configuration
    """
    return HealthResponse(
        status="healthy",
        provider=settings.llm_provider,
        model=settings.llm_model,
    )


@router.post("/extract", response_model=ClassifiedExtractionResponse)
async def extract_intelligence(
    request: ExtractionRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Extract structured intelligence from text with automatic classification.

    Processes natural language text and extracts:
    - Entities (persons, organizations, etc.) → Fact Updates
    - Events/Intel (interactions, sightings, etc.) → Event Logs

    Args:
        request: Extraction request with text and options
        authorization: Bearer token for authentication

    Returns:
        ClassifiedExtractionResponse with classification, chain_of_thought, extraction, and sync_results
    """
    # Verify authentication
    user_id = None
    user_name = None
    if authorization:
        token = authorization.replace("Bearer ", "")
        user_id = verify_supabase_jwt(token)
        if not user_id and request.sync_to_db:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Get user information for context
        if user_id:
            user_info = get_user_info(user_id)
            if user_info:
                user_name = user_info.get("name")

    # Extract and classify intelligence with user context
    extraction_service = get_extraction_service()
    classified_result = extraction_service.extract_and_classify(
        request.text, request.context, user_name=user_name
    )

    # Sync to database if requested
    sync_results = None
    if request.sync_to_db:
        if not user_id:
            raise HTTPException(
                status_code=401, detail="Authentication required for database sync"
            )

        # Create authenticated Supabase client
        supabase = create_service_role_client()

        # Sync extraction
        sync_service = SupabaseSyncService(supabase, user_id)
        sync_results = sync_service.sync_extraction(
            classified_result.extraction, request.source_code
        )

    return ClassifiedExtractionResponse(
        classification=classified_result.classification,
        chain_of_thought=classified_result.chain_of_thought,
        extraction=classified_result.extraction,
        sync_results=sync_results,
    )
