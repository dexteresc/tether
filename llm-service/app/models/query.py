from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class QueryIntent(str, Enum):
    ENTITY_SEARCH = "entity_search"
    INTEL_SEARCH = "intel_search"
    PATH_FINDING = "path_finding"
    RELATION_QUERY = "relation_query"
    TEMPORAL_QUERY = "temporal_query"
    BRIEFING = "briefing"
    AGGREGATION = "aggregation"


class QueryPlan(BaseModel):
    """Structured output from intent parsing LLM step."""
    intent: QueryIntent = Field(description="The type of query to execute")
    entity_names: list[str] = Field(
        default_factory=list,
        description="Entity names referenced in the query"
    )
    search_terms: list[str] = Field(
        default_factory=list,
        description="Free-text search terms for FTS/fuzzy search"
    )
    relation_types: list[str] = Field(
        default_factory=list,
        description="Relation types to filter by, if applicable"
    )
    temporal_filter: str | None = Field(
        default=None,
        description="Temporal constraint like 'last week', 'January 2025', etc."
    )
    reasoning: str = Field(
        default="",
        description="Brief explanation of query interpretation"
    )


class QueryRequest(BaseModel):
    question: str = Field(description="Natural language question")
    context: str | None = Field(default=None, description="Optional conversation context")


class QueryResult(BaseModel):
    question: str
    intent: QueryIntent
    answer: str = Field(description="Natural language answer")
    data: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Structured result data (entities, paths, intel, etc.)"
    )
    data_type: str = Field(
        default="generic",
        description="Type of data returned: entities, path, intel, relations, count"
    )
