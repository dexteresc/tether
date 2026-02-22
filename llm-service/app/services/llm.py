import instructor
from openai import OpenAI
import anthropic
import outlines
from outlines.inputs import Chat
from ollama import Client as OllamaClient
from typing import Optional
from app.config import settings
from app.models.extraction import IntelligenceExtraction


# Shared system prompt for cloud providers (OpenAI, Anthropic)
SYSTEM_PROMPT = """You are a personal intelligence analyst extracting structured information from text for a life graph database.

Your task is to:
1. Identify ALL entities (people, organizations, groups, locations, events, projects, assets)
2. Extract ALL factual attributes (birthdays, employers, cities, job titles, etc.)
3. Identify ALL relationships between entities
4. Identify ALL events/intelligence (meetings, communications, sightings, notes, tips, etc.)
5. Track information sources (who reported this?)
6. Assess confidence levels

ENTITY TYPES:
- person: anyone you know or know of
- organization: companies, institutions, communities
- group: informal groups, friend circles, teams
- location: cities, venues, neighborhoods, countries
- event: conferences, parties, trips, meetings
- project: work projects, ventures, deals
- asset: vehicles, properties, devices, accounts, valuables

RELATIONSHIP TYPES:
- Family: parent, child, sibling, spouse, relative
- Professional: colleague, associate, employee, member, owner, founder, co-founder, mentor, client, partner
- Social: friend, knows (weak/catch-all), introduced_by (how you met)
- Contextual: works_at, lives_in, invested_in, attended, visited

INTEL TYPES:
- event, communication, sighting, report, document, media, financial
- note: personal observation or quick capture
- tip: recommendation or warning someone gave you

IMPORTANT:
- Extract multiple identifiers per entity when possible (name, alias, email, phone, handle, website, etc.)
- For relationships, use the most specific type available (e.g., "works_at" not "associate" for employment)
- Always provide your reasoning FIRST in the reasoning field
- Be thorough - extract ALL information present in the text
- Infer likely relationships even when not explicitly stated. If two people meet, communicate, or are mentioned together, create a relationship with appropriate confidence (e.g., "knows" with low/medium confidence). It's better to extract a low-confidence relationship than to miss one entirely.

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
    """Ollama provider with Outlines structured generation.

    Uses outlines.from_ollama for grammar-constrained decoding, guaranteeing
    schema-valid JSON output from local models without retries.
    """

    # System prompt for Ollama — kept concise since Outlines enforces the schema
    OLLAMA_SYSTEM_PROMPT = """You are a personal intelligence analyst. Extract structured data from text for a life graph database.

Your task is to:
1. Identify ALL entities (people, organizations, groups, locations, events, projects, assets)
2. Extract ALL factual attributes (birthdays, employers, cities, job titles, etc.)
3. Identify ALL relationships between entities
4. Identify ALL events/intelligence (meetings, communications, sightings, notes, tips, etc.)
5. Track information sources (who reported this?)
6. Assess confidence levels
7. Provide your reasoning FIRST in the reasoning field
8. Infer likely relationships even when not explicitly stated. If two people meet, communicate, or are mentioned together, create a relationship with appropriate confidence (e.g., "knows" with low/medium confidence). It's better to extract a low-confidence relationship than to miss one entirely.

USER-CENTRIC TEXT HANDLING:
- When text uses first-person pronouns (I, me, my, mine), these refer to the authenticated user
- When text mentions "the user" explicitly, this also refers to the authenticated user
- Extract relationships from the user's perspective (e.g., "my friend John" = user has friend relation to John)
- Create entities for people mentioned in relation to the user
- Ensure the user entity is properly identified in relationships"""

    def __init__(self, model: str = "qwen2.5:7b", base_url: Optional[str] = None):
        super().__init__()
        self.model_name = model

        # Derive Ollama host from base_url (strip /v1 suffix used by OpenAI-compat layer)
        base = base_url or settings.ollama_base_url
        host = base.rstrip("/").removesuffix("/v1")

        # Create native Ollama client and wrap with Outlines for structured generation
        ollama_client = OllamaClient(host=host)
        self.outlines_model = outlines.from_ollama(ollama_client, model)

    def extract(
        self, text: str, context: Optional[str] = None, max_retries: int = 3, user_name: Optional[str] = None
    ) -> IntelligenceExtraction:
        """Extract structured intelligence using Ollama with Outlines.

        Outlines enforces the IntelligenceExtraction schema at the token level
        via grammar-constrained decoding, so max_retries is not needed for
        validation — output is guaranteed to match the schema.
        """
        chat = Chat([
            {"role": "system", "content": self.OLLAMA_SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(text, context, user_name)},
        ])

        result = self.outlines_model(chat, IntelligenceExtraction)
        return IntelligenceExtraction.model_validate_json(result)


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
