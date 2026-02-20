import instructor
from openai import OpenAI
import anthropic
from typing import Optional
from app.config import settings
from app.models.extraction import IntelligenceExtraction


# Shared system prompt for cloud providers (OpenAI, Anthropic)
SYSTEM_PROMPT = """You are an intelligence analyst extracting structured information from text.

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
- Be thorough - extract ALL information present in the text

USER-CENTRIC TEXT HANDLING:
- When text uses first-person pronouns (I, me, my, mine), these refer to the authenticated user
- When text mentions "the user" explicitly, this also refers to the authenticated user
- Extract relationships from the user's perspective (e.g., "my friend John" = user has friend relation to John)
- Create entities for people mentioned in relation to the user
- Ensure the user entity is properly identified in relationships"""


def build_user_prompt(text: str, context: Optional[str] = None, user_name: Optional[str] = None) -> str:
    """Build user prompt with optional user name and context prepended."""
    prompt = f"Extract structured intelligence from the following text:\n\n{text}"

    if user_name:
        prompt = f"The authenticated user is: {user_name}\n\n{prompt}"

    if context:
        prompt = f"Context: {context}\n\n{prompt}"

    return prompt


class LLMProvider:
    """Base class for LLM providers with instructor integration."""

    def __init__(self):
        self.client = None

    def extract(
        self, text: str, context: Optional[str] = None, max_retries: int = 3, user_name: Optional[str] = None
    ) -> IntelligenceExtraction:
        """
        Extract structured intelligence from text.

        Args:
            text: Text to extract from
            context: Optional context to help with extraction
            max_retries: Number of retries for validation errors
            user_name: Optional name of the authenticated user

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
        self, text: str, context: Optional[str] = None, max_retries: int = 3, user_name: Optional[str] = None
    ) -> IntelligenceExtraction:
        """Extract structured intelligence using OpenAI with instructor."""
        return self.client.chat.completions.create(
            model=self.model,
            response_model=IntelligenceExtraction,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(text, context, user_name)},
            ],
            max_retries=max_retries,
        )


class OllamaProvider(LLMProvider):
    """Ollama provider with instructor integration."""

    def __init__(self, model: str = "qwen2.5:7b", base_url: Optional[str] = None):
        super().__init__()
        self.model = model

        # Create OpenAI-compatible client for Ollama
        openai_client = OpenAI(
            base_url=base_url or settings.ollama_base_url,
            api_key="ollama",  # Ollama doesn't need a real API key
        )

        # Patch with instructor for structured outputs
        # Using MD_JSON mode for better Ollama compatibility with complex schemas
        self.client = instructor.from_openai(openai_client, mode=instructor.Mode.MD_JSON)

    def extract(
        self, text: str, context: Optional[str] = None, max_retries: int = 3, user_name: Optional[str] = None
    ) -> IntelligenceExtraction:
        """Extract structured intelligence using Ollama with instructor."""

        # Ollama needs a stricter system prompt with explicit enum values and JSON examples
        # to produce well-formed structured output from local models
        ollama_system_prompt = """You are an expert intelligence analyst. Extract structured data from text into JSON.

CRITICAL RULES:
1. For every entity, you MUST provide:
   - 'name': The primary name string.
   - 'entity_type': One of [person, organization, group, vehicle, location].
   - 'identifiers': A list containing at least one entry with identifier_type='name'.
   - 'confidence': One of [confirmed, high, medium, low, unconfirmed].
2. Use ONLY these exact ENUM values:
   - IDENTIFIER TYPES: name, email, phone, address, document, biometric, handle, registration, domain
   - RELATION TYPES: parent, child, sibling, spouse, colleague, associate, friend, member, owner, founder, co-founder, visited, employee
   - ENTITY TYPES: person, organization, group, vehicle, location
   - INTEL TYPES: event, communication, sighting, report, document, media, financial
   - CONFIDENCE: confirmed, high, medium, low, unconfirmed
3. OUTPUT ONLY VALID JSON. DO NOT include any comments or explanations.
4. Provide reasoning in the 'reasoning' field first.

USER-CENTRIC TEXT HANDLING:
- When text uses first-person pronouns (I, me, my, mine), these refer to the authenticated user
- When text mentions "the user" explicitly, this also refers to the authenticated user
- Extract relationships from the user's perspective (e.g., "my friend John" = user has friend relation to John)
- Create entities for people mentioned in relation to the user
- Ensure the user entity is properly identified in relationships

EXAMPLE OUTPUT:
{
  "reasoning": { "entities_identified": "John (person)...", ... },
  "entities": [
    {
      "name": "John Smith",
      "entity_type": "person",
      "identifiers": [{"identifier_type": "name", "value": "John Smith"}],
      "confidence": "confirmed"
    }
  ],
  "relations": [],
  "intel": []
}"""

        return self.client.chat.completions.create(
            model=self.model,
            response_model=IntelligenceExtraction,
            messages=[
                {"role": "system", "content": ollama_system_prompt},
                {"role": "user", "content": build_user_prompt(text, context, user_name)},
            ],
            temperature=0,
            max_retries=max_retries,
        )


class AnthropicProvider(LLMProvider):
    """Anthropic provider with instructor integration."""

    def __init__(self, model: str = "claude-sonnet-4-5-20250514", api_key: Optional[str] = None):
        super().__init__()
        self.model = model

        anthropic_client = anthropic.Anthropic(api_key=api_key or settings.anthropic_api_key)
        self.client = instructor.from_anthropic(anthropic_client)

    def extract(
        self, text: str, context: Optional[str] = None, max_retries: int = 3, user_name: Optional[str] = None
    ) -> IntelligenceExtraction:
        """Extract structured intelligence using Anthropic with instructor."""
        return self.client.chat.completions.create(
            model=self.model,
            response_model=IntelligenceExtraction,
            messages=[
                {"role": "user", "content": build_user_prompt(text, context, user_name)},
            ],
            system=SYSTEM_PROMPT,
            max_tokens=4096,
            max_retries=max_retries,
        )


def get_llm_provider(
    provider: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None
) -> LLMProvider:
    """
    Factory function to get the appropriate LLM provider.

    Args:
        provider: "openai", "ollama", or "anthropic" (defaults to settings.llm_provider)
        model: Model name (defaults to settings.llm_model)
        api_key: Optional API key override for cloud providers

    Returns:
        LLMProvider instance
    """
    provider = provider or settings.llm_provider
    model = model or settings.llm_model

    if provider == "openai":
        return OpenAIProvider(model=model, api_key=api_key)
    if provider == "ollama":
        return OllamaProvider(model=model)
    if provider == "anthropic":
        return AnthropicProvider(model=model, api_key=api_key)

    raise ValueError(f"Unknown LLM provider: {provider}")
