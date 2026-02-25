from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BriefingResult(BaseModel):
    entity_id: str
    entity_name: str = ""
    entity_type: str = ""
    summary: str = Field(default="", description="One-paragraph summary")
    identifiers: list[dict[str, str]] = Field(default_factory=list)
    attributes: list[dict[str, Any]] = Field(default_factory=list)
    relationship_to_user: dict[str, Any] | None = Field(
        default=None,
        description="Path from user to this entity"
    )
    mutual_connections: list[dict[str, str]] = Field(default_factory=list)
    recent_interactions: list[dict[str, Any]] = Field(default_factory=list)
    key_dates: list[dict[str, str]] = Field(default_factory=list)
    connection_count: int = 0
    briefing_text: str = Field(default="", description="LLM-synthesized narrative briefing")
    sections: dict[str, Any] = Field(default_factory=dict)
