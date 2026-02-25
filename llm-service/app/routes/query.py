from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Header

from app.models.query import QueryRequest, QueryResult, QueryPlan, QueryIntent
from app.models.briefing import BriefingResult
from app.services.auth import verify_supabase_jwt, create_service_role_client, get_user_info
from app.services.query_executor import QueryExecutor
from app.services.answer_synthesizer import AnswerSynthesizer
from app.services.briefing import BriefingService
from app.services.llm import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter()

QUERY_PARSING_PROMPT = """You are a query intent parser for a personal CRM / intelligence database.
Given a natural language question, determine the query intent and extract key parameters.

The database has:
- Entities: people, organizations, groups, locations, events, projects, assets
- Relations: connections between entities (parent, child, sibling, spouse, colleague, friend, works_at, lives_in, knows, etc.)
- Intel: events, communications, sightings, reports, notes, tips with timestamps
- Identifiers: names, emails, phones, handles associated with entities

INTENT TYPES:
- entity_search: Looking for entities by name, type, or attributes ("Who is X?", "Find people named...")
- intel_search: Looking for intel/events by content ("What happened at...?", "Tell me about the meetup")
- path_finding: How two entities are connected ("How am I connected to X?", "What's the link between A and B?")
- relation_query: Querying specific relationships ("Who works at X?", "Who introduced me to X?")
- temporal_query: Time-based queries ("When did I last talk to X?", "Recent interactions with X")
- briefing: Full dossier on an entity ("Brief me on X", "Tell me everything about X")
- aggregation: Stats and counts ("How many contacts do I have?", "Network stats")

When the user says "I", "me", "my" — that refers to the authenticated user. Use "(the user)" as the entity name for self-references.

Extract entity names exactly as mentioned. For path_finding, the first entity_name should be the source and second should be the target."""


@router.post("/query", response_model=QueryResult)
async def query_network(
    request: QueryRequest,
    authorization: str | None = Header(None),
):
    """
    Natural language query endpoint. Parses intent, executes DB queries, synthesizes answer.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    user_info = get_user_info(user_id)
    user_name = user_info.get("name") if user_info else None

    # Step 1: Parse intent using LLM
    provider = get_llm_provider()
    plan = _parse_intent(provider, request.question, user_name)

    # Step 2: Execute query
    supabase = create_service_role_client()
    executor = QueryExecutor(supabase, user_id)
    raw_results = await executor.execute(plan)

    # Step 3: Synthesize answer
    synthesizer = AnswerSynthesizer(provider)
    answer = synthesizer.synthesize(
        question=request.question,
        intent=plan.intent,
        raw_results=raw_results,
        user_name=user_name,
    )

    return QueryResult(
        question=request.question,
        intent=plan.intent,
        answer=answer,
        data=raw_results.get("data", []),
        data_type=raw_results.get("type", "generic"),
    )


def _parse_intent(provider, question: str, user_name: str | None) -> QueryPlan:
    """Use the LLM to parse a question into a QueryPlan."""
    try:
        if hasattr(provider, "client") and provider.client:
            client = provider.client
            if hasattr(client, "chat"):
                user_prompt = f"Parse this question into a query plan:\n\n{question}"
                if user_name:
                    user_prompt = f"The authenticated user is: {user_name}\n\n{user_prompt}"

                result = client.chat.completions.create(
                    model=getattr(provider, "model", "gpt-4o"),
                    response_model=QueryPlan,
                    messages=[
                        {"role": "system", "content": QUERY_PARSING_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_retries=2,
                )
                return result
    except Exception as e:
        logger.warning(f"LLM intent parsing failed, using heuristic: {e}")

    # Fallback: heuristic parsing
    return _heuristic_parse(question)


def _heuristic_parse(question: str) -> QueryPlan:
    """Simple keyword-based fallback intent parser."""
    q = question.lower()

    if any(kw in q for kw in ["connected", "path", "link between", "know each other"]):
        # Extract entity names heuristically
        words = question.split()
        names = [w for w in words if w[0].isupper() and len(w) > 1] if words else []
        if "I" in question.split() or "me" in q or "my" in q:
            names = ["(the user)"] + names
        return QueryPlan(
            intent=QueryIntent.PATH_FINDING,
            entity_names=names[:2] if len(names) >= 2 else names,
            reasoning="Detected path finding keywords",
        )

    if any(kw in q for kw in ["when", "last time", "recently", "last talk", "last met"]):
        names = [w for w in question.split() if w[0].isupper() and len(w) > 1]
        return QueryPlan(
            intent=QueryIntent.TEMPORAL_QUERY,
            entity_names=names or [],
            reasoning="Detected temporal query keywords",
        )

    if any(kw in q for kw in ["brief", "dossier", "everything about", "tell me about"]):
        names = [w for w in question.split() if w[0].isupper() and len(w) > 1]
        return QueryPlan(
            intent=QueryIntent.BRIEFING,
            entity_names=names or [],
            reasoning="Detected briefing keywords",
        )

    if any(kw in q for kw in ["how many", "count", "stats", "total"]):
        return QueryPlan(
            intent=QueryIntent.AGGREGATION,
            reasoning="Detected aggregation keywords",
        )

    if any(kw in q for kw in ["who works", "who lives", "introduced", "who knows"]):
        names = [w for w in question.split() if w[0].isupper() and len(w) > 1]
        return QueryPlan(
            intent=QueryIntent.RELATION_QUERY,
            entity_names=names or [],
            relation_types=[],
            reasoning="Detected relation query keywords",
        )

    if any(kw in q for kw in ["what happened", "event", "meeting", "meetup"]):
        return QueryPlan(
            intent=QueryIntent.INTEL_SEARCH,
            search_terms=question.split(),
            reasoning="Detected intel search keywords",
        )

    # Default: entity search
    names = [w for w in question.split() if len(w) > 1 and w[0].isupper()]
    return QueryPlan(
        intent=QueryIntent.ENTITY_SEARCH,
        entity_names=names or [],
        search_terms=question.split()[:5],
        reasoning="Defaulting to entity search",
    )


@router.post("/briefing/{entity_id}", response_model=BriefingResult)
async def get_briefing(
    entity_id: str,
    authorization: str | None = Header(None),
):
    """Generate a comprehensive meeting prep briefing for an entity."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    supabase = create_service_role_client()
    provider = get_llm_provider()

    service = BriefingService(supabase, user_id, llm_provider=provider)
    result = await service.generate(entity_id)

    return result
