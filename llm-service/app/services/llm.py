import instructor
from openai import OpenAI
from typing import Optional
from app.config import settings
from app.models.extraction import IntelligenceExtraction


class LLMProvider:
    """Base class for LLM providers with instructor integration."""

    def __init__(self):
        self.client = None

    def extract(
        self, text: str, context: Optional[str] = None
    ) -> IntelligenceExtraction:
        """
        Extract structured intelligence from text.

        Args:
            text: Text to extract from
            context: Optional context to help with extraction

        Returns:
            IntelligenceExtraction object with entities, relations, and intel
        """
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    """OpenAI provider with instructor integration."""

    def __init__(self, model: str = "gpt-4o", api_key: Optional[str] = None):
        super().__init__()
        self.model = model

        # Create OpenAI client
        openai_client = OpenAI(api_key=api_key or settings.openai_api_key)

        # Patch with instructor for structured outputs
        self.client = instructor.from_openai(openai_client)

    def extract(
        self, text: str, context: Optional[str] = None
    ) -> IntelligenceExtraction:
        """Extract structured intelligence using OpenAI with instructor."""

        # Build system prompt
        system_prompt = """You are an intelligence analyst extracting structured information from text.

Your task is to:
1. Identify ALL entities (people, organizations, groups, vehicles, locations)
2. Extract ALL factual attributes (birthdays, addresses, positions, etc.)
3. Identify ALL relationships between entities
4. Identify ALL events/intelligence (meetings, communications, sightings, etc.)
5. Track information sources (who reported this?)
6. Assess confidence levels

IMPORTANT:
- Extract multiple identifiers per entity when possible (name, email, phone, etc.)
- For relationships, determine the correct type (parent, spouse, colleague, member, owner, etc.)
- For intel, categorize correctly (event, communication, sighting, report, document, media, financial)
- Always provide your reasoning FIRST in the reasoning field
- Be thorough - extract ALL information present in the text"""

        # Build user prompt
        user_prompt = f"Extract structured intelligence from the following text:\n\n{text}"
        if context:
            user_prompt = f"Context: {context}\n\n{user_prompt}"

        # Call OpenAI with instructor
        extraction = self.client.chat.completions.create(
            model=self.model,
            response_model=IntelligenceExtraction,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        return extraction


class OllamaProvider(LLMProvider):
    """Ollama provider with instructor integration."""

    def __init__(self, model: str = "llama3.2", base_url: Optional[str] = None):
        super().__init__()
        self.model = model

        # Create OpenAI-compatible client for Ollama
        openai_client = OpenAI(
            base_url=base_url or settings.ollama_base_url,
            api_key="ollama",  # Ollama doesn't need a real API key
        )

        # Patch with instructor for structured outputs
        # Using JSON mode for Ollama compatibility
        self.client = instructor.from_openai(openai_client, mode=instructor.Mode.JSON)

    def extract(
        self, text: str, context: Optional[str] = None
    ) -> IntelligenceExtraction:
        """Extract structured intelligence using Ollama with instructor."""

        # Build enhanced system prompt with explicit structure requirements
        system_prompt = """You are an intelligence analyst extracting structured information from text.

Your task is to:
1. Identify ALL entities (people, organizations, groups, vehicles, locations)
2. Extract ALL factual attributes (birthdays, addresses, positions, etc.)
3. Identify ALL relationships between entities
4. Identify ALL events/intelligence (meetings, communications, sightings, etc.)
5. Track information sources (who reported this?)
6. Assess confidence levels

CRITICAL RULES FOR IDENTIFIERS:
- ALWAYS create a "name" identifier for every entity as the first identifier
- Then add additional identifiers (email, phone, address, etc.) if present
- Every entity MUST have at least a name identifier

IDENTIFIER TYPES (use exact values):
- name, email, phone, address, document, biometric, handle, registration, domain

RELATION TYPES (use exact values):
- parent, child, sibling, spouse, colleague, associate, friend, member, owner, founder

INTEL TYPES (use exact values):
- event, communication, sighting, report, document, media, financial

CONFIDENCE LEVELS (use exact values):
- confirmed, high, medium, low, unconfirmed

IMPORTANT:
- Extract multiple identifiers per entity when possible
- Always provide your reasoning FIRST in the reasoning field
- Be thorough - extract ALL information present in the text
- Use only the exact enum values listed above"""

        # Build user prompt
        user_prompt = f"Extract structured intelligence from the following text:\n\n{text}"
        if context:
            user_prompt = f"Context: {context}\n\n{user_prompt}"

        # Call Ollama with instructor with enhanced configuration
        extraction = self.client.chat.completions.create(
            model=self.model,
            response_model=IntelligenceExtraction,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,  # More deterministic outputs
            max_retries=3,  # Retry on validation errors
        )

        return extraction


def get_llm_provider(
    provider: Optional[str] = None, model: Optional[str] = None
) -> LLMProvider:
    """
    Factory function to get the appropriate LLM provider.

    Args:
        provider: "openai" or "ollama" (defaults to settings.llm_provider)
        model: Model name (defaults to settings.llm_model)

    Returns:
        LLMProvider instance
    """
    provider = provider or settings.llm_provider
    model = model or settings.llm_model

    if provider == "openai":
        return OpenAIProvider(model=model)
    elif provider == "ollama":
        return OllamaProvider(model=model)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
