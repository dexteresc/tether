from __future__ import annotations

import logging
from typing import Any

from supabase import Client

from app.models.query import QueryPlan, QueryIntent

logger = logging.getLogger(__name__)


class QueryExecutor:
    """Translates a QueryPlan into Supabase calls and returns raw results."""

    def __init__(self, supabase: Client, user_id: str):
        self.supabase = supabase
        self.user_id = user_id

    async def execute(self, plan: QueryPlan) -> dict[str, Any]:
        """Execute the query plan and return raw data."""
        handler = {
            QueryIntent.ENTITY_SEARCH: self._entity_search,
            QueryIntent.INTEL_SEARCH: self._intel_search,
            QueryIntent.PATH_FINDING: self._path_finding,
            QueryIntent.RELATION_QUERY: self._relation_query,
            QueryIntent.TEMPORAL_QUERY: self._temporal_query,
            QueryIntent.BRIEFING: self._briefing,
            QueryIntent.AGGREGATION: self._aggregation,
        }.get(plan.intent)

        if not handler:
            return {"type": "error", "data": [], "message": f"Unknown intent: {plan.intent}"}

        return await handler(plan)

    async def _entity_search(self, plan: QueryPlan) -> dict[str, Any]:
        results = []
        for name in plan.entity_names + plan.search_terms:
            data = self.supabase.rpc(
                "search_entities_by_identifier",
                {"p_search_value": name}
            ).execute()
            if data.data:
                results.extend(data.data)

        # Deduplicate by entity_id
        seen = set()
        deduped = []
        for r in results:
            eid = r.get("entity_id")
            if eid and eid not in seen:
                seen.add(eid)
                deduped.append(r)

        return {"type": "entities", "data": deduped}

    async def _intel_search(self, plan: QueryPlan) -> dict[str, Any]:
        search_query = " ".join(plan.search_terms + plan.entity_names)
        if not search_query.strip():
            return {"type": "intel", "data": []}

        data = self.supabase.from_("intel") \
            .select("*") \
            .text_search("search_vector", search_query, config="english") \
            .is_("deleted_at", "null") \
            .limit(20) \
            .execute()

        return {"type": "intel", "data": data.data or []}

    async def _path_finding(self, plan: QueryPlan) -> dict[str, Any]:
        if len(plan.entity_names) < 2:
            return {"type": "path", "data": [], "message": "Need two entity names for path finding"}

        # Resolve entity names to IDs
        source_id = await self._resolve_entity_id(plan.entity_names[0])
        target_id = await self._resolve_entity_id(plan.entity_names[1])

        if not source_id or not target_id:
            return {
                "type": "path",
                "data": [],
                "message": f"Could not resolve entities: {plan.entity_names[0]}, {plan.entity_names[1]}"
            }

        data = self.supabase.rpc("find_shortest_path", {
            "p_source_id": source_id,
            "p_target_id": target_id,
            "p_max_depth": 6,
        }).execute()

        path_data = data.data or []

        # Resolve names for each entity in the path
        if path_data:
            row = path_data[0] if isinstance(path_data, list) else path_data
            path_ids = row.get("path", [])
            rel_types = row.get("relation_types", [])

            resolved_path = []
            for pid in path_ids:
                name = await self._resolve_entity_name(pid)
                resolved_path.append({"entity_id": pid, "name": name})

            return {
                "type": "path",
                "data": [{
                    "path": resolved_path,
                    "relation_types": rel_types,
                    "depth": row.get("depth", len(path_ids) - 1),
                }]
            }

        return {"type": "path", "data": [], "message": "No path found"}

    async def _relation_query(self, plan: QueryPlan) -> dict[str, Any]:
        results = []
        for name in plan.entity_names:
            entity_id = await self._resolve_entity_id(name)
            if not entity_id:
                continue

            query = self.supabase.from_("relations") \
                .select("*") \
                .or_(f"source_id.eq.{entity_id},target_id.eq.{entity_id}") \
                .is_("deleted_at", "null")

            if plan.relation_types:
                query = query.in_("type", plan.relation_types)

            data = query.limit(50).execute()
            if data.data:
                for rel in data.data:
                    # Resolve names for source and target
                    source_name = await self._resolve_entity_name(rel["source_id"])
                    target_name = await self._resolve_entity_name(rel["target_id"])
                    rel["source_name"] = source_name
                    rel["target_name"] = target_name
                results.extend(data.data)

        return {"type": "relations", "data": results}

    async def _temporal_query(self, plan: QueryPlan) -> dict[str, Any]:
        # Find intel related to entities, sorted by time
        results = []
        for name in plan.entity_names:
            entity_id = await self._resolve_entity_id(name)
            if not entity_id:
                continue

            # Get intel linked to this entity
            ie_data = self.supabase.from_("intel_entities") \
                .select("intel_id") \
                .eq("entity_id", entity_id) \
                .is_("deleted_at", "null") \
                .execute()

            if ie_data.data:
                intel_ids = [ie["intel_id"] for ie in ie_data.data]
                intel_data = self.supabase.from_("intel") \
                    .select("*") \
                    .in_("id", intel_ids) \
                    .is_("deleted_at", "null") \
                    .order("occurred_at", desc=True) \
                    .limit(20) \
                    .execute()

                if intel_data.data:
                    for intel in intel_data.data:
                        intel["related_entity_name"] = name
                    results.extend(intel_data.data)

        return {"type": "intel", "data": results}

    async def _briefing(self, plan: QueryPlan) -> dict[str, Any]:
        # Delegate to entity search + gather all info
        if not plan.entity_names:
            return {"type": "briefing", "data": [], "message": "No entity specified for briefing"}

        entity_id = await self._resolve_entity_id(plan.entity_names[0])
        if not entity_id:
            return {"type": "briefing", "data": [], "message": f"Could not find entity: {plan.entity_names[0]}"}

        return {"type": "briefing", "data": [{"entity_id": entity_id, "name": plan.entity_names[0]}]}

    async def _aggregation(self, plan: QueryPlan) -> dict[str, Any]:
        # Count entities, relations, etc.
        entity_count = self.supabase.from_("entities") \
            .select("id", count="exact") \
            .is_("deleted_at", "null") \
            .execute()

        relation_count = self.supabase.from_("relations") \
            .select("id", count="exact") \
            .is_("deleted_at", "null") \
            .execute()

        intel_count = self.supabase.from_("intel") \
            .select("id", count="exact") \
            .is_("deleted_at", "null") \
            .execute()

        return {
            "type": "count",
            "data": [{
                "entities": entity_count.count or 0,
                "relations": relation_count.count or 0,
                "intel": intel_count.count or 0,
            }]
        }

    async def _resolve_entity_id(self, name: str) -> str | None:
        """Resolve an entity name to its UUID."""
        # Check if the user is referring to themselves
        if name.lower() in ("me", "my", "i", "myself", "the user", "(the user)"):
            user_data = self.supabase.from_("entities") \
                .select("id") \
                .eq("type", "person") \
                .eq("created_by", self.user_id) \
                .is_("deleted_at", "null") \
                .limit(1) \
                .execute()
            if user_data.data:
                return user_data.data[0]["id"]

        data = self.supabase.rpc(
            "search_entities_by_identifier",
            {"p_search_value": name}
        ).execute()

        if data.data and len(data.data) > 0:
            return data.data[0]["entity_id"]
        return None

    async def _resolve_entity_name(self, entity_id: str) -> str:
        """Resolve an entity UUID to its display name."""
        data = self.supabase.from_("identifiers") \
            .select("value") \
            .eq("entity_id", entity_id) \
            .eq("type", "name") \
            .is_("deleted_at", "null") \
            .limit(1) \
            .execute()

        if data.data and len(data.data) > 0:
            return data.data[0]["value"]
        return entity_id[:8]
