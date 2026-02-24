from __future__ import annotations

import logging
from typing import Any

from supabase import Client

from app.models.briefing import BriefingResult

logger = logging.getLogger(__name__)

BRIEFING_PROMPT = """You are preparing a meeting briefing about a person or entity for the user.
Given the structured data below, write a concise but thorough briefing that covers:
1. Who they are (summary)
2. How the user is connected to them (relationship path)
3. Mutual connections
4. Recent interactions and activity
5. Key facts and dates

Write in a professional but conversational tone. Be specific, reference names and dates.
If information is missing, skip that section rather than noting its absence."""


class BriefingService:
    def __init__(self, supabase: Client, user_id: str, llm_provider=None):
        self.supabase = supabase
        self.user_id = user_id
        self.llm_provider = llm_provider

    async def generate(self, entity_id: str) -> BriefingResult:
        """Generate a comprehensive briefing for an entity."""
        # Parallel data gathering
        entity = self._get_entity(entity_id)
        identifiers = self._get_identifiers(entity_id)
        attributes = self._get_attributes(entity_id)
        relations = self._get_relations(entity_id)
        intel = self._get_linked_intel(entity_id)
        user_entity_id = self._get_user_entity_id()

        # Build result
        entity_data = entity or {}
        entity_name = self._extract_name(entity_id, identifiers)
        entity_type = entity_data.get("type", "unknown") if entity_data else "unknown"

        result = BriefingResult(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            identifiers=[{"type": i["type"], "value": i["value"]} for i in identifiers],
            attributes=[
                {"key": a["key"], "value": a["value"], "valid_from": a.get("valid_from"), "valid_to": a.get("valid_to")}
                for a in attributes
            ],
            recent_interactions=[
                {
                    "type": i.get("type", ""),
                    "occurred_at": i.get("occurred_at", ""),
                    "description": (i.get("data") or {}).get("description", ""),
                }
                for i in intel[:10]
            ],
            connection_count=len(relations),
        )

        # Path from user to entity
        if user_entity_id and user_entity_id != entity_id:
            path_data = self._find_path(user_entity_id, entity_id)
            if path_data:
                result.relationship_to_user = path_data

        # Find mutual connections
        if user_entity_id:
            mutual = self._find_mutual_connections(user_entity_id, entity_id, relations)
            result.mutual_connections = mutual

        # Key dates from attributes and intel
        key_dates = []
        for a in attributes:
            if a.get("valid_from"):
                key_dates.append({"label": a["key"], "date": a["valid_from"]})
        for i in intel[:5]:
            if i.get("occurred_at"):
                desc = (i.get("data") or {}).get("description", i.get("type", ""))
                key_dates.append({"label": str(desc)[:50], "date": i["occurred_at"]})
        result.key_dates = key_dates[:10]

        # Synthesize briefing text with LLM
        result.briefing_text = self._synthesize_briefing(result)

        # Build sections dict for structured frontend display
        result.sections = {
            "identifiers": result.identifiers,
            "attributes": result.attributes,
            "relationship_to_user": result.relationship_to_user,
            "mutual_connections": result.mutual_connections,
            "recent_interactions": result.recent_interactions,
            "key_dates": result.key_dates,
        }

        return result

    def _get_entity(self, entity_id: str) -> dict[str, Any] | None:
        data = self.supabase.from_("entities") \
            .select("*") \
            .eq("id", entity_id) \
            .is_("deleted_at", "null") \
            .limit(1) \
            .execute()
        return data.data[0] if data.data else None

    def _get_identifiers(self, entity_id: str) -> list[dict]:
        data = self.supabase.from_("identifiers") \
            .select("type,value") \
            .eq("entity_id", entity_id) \
            .is_("deleted_at", "null") \
            .execute()
        return data.data or []

    def _get_attributes(self, entity_id: str) -> list[dict]:
        data = self.supabase.from_("entity_attributes") \
            .select("key,value,valid_from,valid_to,confidence") \
            .eq("entity_id", entity_id) \
            .is_("deleted_at", "null") \
            .execute()
        return data.data or []

    def _get_relations(self, entity_id: str) -> list[dict]:
        data = self.supabase.from_("relations") \
            .select("*") \
            .or_(f"source_id.eq.{entity_id},target_id.eq.{entity_id}") \
            .is_("deleted_at", "null") \
            .execute()
        return data.data or []

    def _get_linked_intel(self, entity_id: str) -> list[dict]:
        ie_data = self.supabase.from_("intel_entities") \
            .select("intel_id") \
            .eq("entity_id", entity_id) \
            .is_("deleted_at", "null") \
            .execute()

        if not ie_data.data:
            return []

        intel_ids = [ie["intel_id"] for ie in ie_data.data]
        intel_data = self.supabase.from_("intel") \
            .select("*") \
            .in_("id", intel_ids) \
            .is_("deleted_at", "null") \
            .order("occurred_at", desc=True) \
            .limit(20) \
            .execute()

        return intel_data.data or []

    def _get_user_entity_id(self) -> str | None:
        data = self.supabase.from_("entities") \
            .select("id") \
            .eq("type", "person") \
            .eq("created_by", self.user_id) \
            .is_("deleted_at", "null") \
            .limit(1) \
            .execute()
        return data.data[0]["id"] if data.data else None

    def _find_path(self, source_id: str, target_id: str) -> dict[str, Any] | None:
        try:
            data = self.supabase.rpc("find_shortest_path", {
                "p_source_id": source_id,
                "p_target_id": target_id,
                "p_max_depth": 5,
            }).execute()

            if data.data:
                row = data.data[0] if isinstance(data.data, list) else data.data
                path_ids = row.get("path", [])
                rel_types = row.get("relation_types", [])

                # Resolve names
                resolved = []
                for pid in path_ids:
                    name = self._resolve_name(pid)
                    resolved.append({"entity_id": pid, "name": name})

                return {"path": resolved, "relation_types": rel_types}
        except Exception as e:
            logger.warning(f"Path finding failed: {e}")
        return None

    def _find_mutual_connections(
        self, user_entity_id: str, target_entity_id: str, target_relations: list[dict]
    ) -> list[dict[str, str]]:
        # Get user's direct connections
        user_rels = self.supabase.from_("relations") \
            .select("source_id,target_id") \
            .or_(f"source_id.eq.{user_entity_id},target_id.eq.{user_entity_id}") \
            .is_("deleted_at", "null") \
            .execute()

        user_connections = set()
        for r in (user_rels.data or []):
            other = r["target_id"] if r["source_id"] == user_entity_id else r["source_id"]
            user_connections.add(other)

        target_connections = set()
        for r in target_relations:
            other = r["target_id"] if r["source_id"] == target_entity_id else r["source_id"]
            target_connections.add(other)

        mutual_ids = user_connections & target_connections
        mutual_ids.discard(user_entity_id)
        mutual_ids.discard(target_entity_id)

        mutual = []
        for mid in list(mutual_ids)[:10]:
            name = self._resolve_name(mid)
            mutual.append({"entity_id": mid, "name": name})

        return mutual

    def _resolve_name(self, entity_id: str) -> str:
        data = self.supabase.from_("identifiers") \
            .select("value") \
            .eq("entity_id", entity_id) \
            .eq("type", "name") \
            .is_("deleted_at", "null") \
            .limit(1) \
            .execute()
        return data.data[0]["value"] if data.data else entity_id[:8]

    def _extract_name(self, entity_id: str, identifiers: list[dict]) -> str:
        for i in identifiers:
            if i.get("type") == "name":
                return i["value"]
        return entity_id[:8]

    def _synthesize_briefing(self, result: BriefingResult) -> str:
        """Use LLM to synthesize a narrative briefing."""
        context_parts = [f"Entity: {result.entity_name} ({result.entity_type})"]

        if result.identifiers:
            ids = ", ".join(f"{i['type']}: {i['value']}" for i in result.identifiers[:10])
            context_parts.append(f"Identifiers: {ids}")

        if result.attributes:
            attrs = ", ".join(f"{a['key']}: {a['value']}" for a in result.attributes[:10])
            context_parts.append(f"Attributes: {attrs}")

        if result.relationship_to_user:
            path = result.relationship_to_user.get("path", [])
            rel_types = result.relationship_to_user.get("relation_types", [])
            chain = []
            for i, node in enumerate(path):
                chain.append(node.get("name", "?"))
                if i < len(rel_types):
                    chain.append(f"--{rel_types[i]}-->")
            context_parts.append(f"Connection to user: {' '.join(chain)}")

        if result.mutual_connections:
            names = ", ".join(m["name"] for m in result.mutual_connections)
            context_parts.append(f"Mutual connections: {names}")

        if result.recent_interactions:
            interactions = []
            for i in result.recent_interactions[:5]:
                interactions.append(f"[{i.get('occurred_at', '?')}] {i.get('description', i.get('type', ''))}")
            context_parts.append("Recent interactions:\n" + "\n".join(interactions))

        context_parts.append(f"Total connections: {result.connection_count}")

        context = "\n\n".join(context_parts)

        if self.llm_provider and hasattr(self.llm_provider, "client") and self.llm_provider.client:
            try:
                client = self.llm_provider.client
                if hasattr(client, "chat"):
                    response = client.chat.completions.create(
                        model=getattr(self.llm_provider, "model", "gpt-4o"),
                        messages=[
                            {"role": "system", "content": BRIEFING_PROMPT},
                            {"role": "user", "content": f"Prepare a meeting briefing based on this data:\n\n{context}"},
                        ],
                        max_tokens=1024,
                    )
                    if hasattr(response, "choices"):
                        return response.choices[0].message.content
                    return str(response)
            except Exception as e:
                logger.warning(f"LLM briefing synthesis failed: {e}")

        # Fallback: structured text
        return self._fallback_briefing(result)

    def _fallback_briefing(self, result: BriefingResult) -> str:
        parts = [f"# Briefing: {result.entity_name}\n"]
        parts.append(f"Type: {result.entity_type}")
        parts.append(f"Connections: {result.connection_count}\n")

        if result.identifiers:
            parts.append("## Identifiers")
            for i in result.identifiers:
                parts.append(f"- {i['type']}: {i['value']}")
            parts.append("")

        if result.attributes:
            parts.append("## Key Facts")
            for a in result.attributes:
                parts.append(f"- {a['key']}: {a['value']}")
            parts.append("")

        if result.relationship_to_user:
            path = result.relationship_to_user.get("path", [])
            rel_types = result.relationship_to_user.get("relation_types", [])
            chain = []
            for i, node in enumerate(path):
                chain.append(node.get("name", "?"))
                if i < len(rel_types):
                    chain.append(f"→({rel_types[i]})")
            parts.append(f"## Connection to You\n{' '.join(chain)}\n")

        if result.mutual_connections:
            parts.append("## Mutual Connections")
            for m in result.mutual_connections:
                parts.append(f"- {m['name']}")
            parts.append("")

        if result.recent_interactions:
            parts.append("## Recent Activity")
            for i in result.recent_interactions[:5]:
                parts.append(f"- [{i.get('occurred_at', '?')}] {i.get('description', '')}")

        return "\n".join(parts)
