from __future__ import annotations

import logging
from typing import Any

from app.models.query import QueryIntent

logger = logging.getLogger(__name__)


SYNTHESIS_SYSTEM_PROMPT = """You are a helpful assistant that synthesizes database query results into natural language answers.
Given the user's original question and raw database results, provide a clear, conversational answer.
Be concise but thorough. If the data is empty, say so clearly. Reference specific names and details from the results.
Do not make up information that isn't in the results."""


class AnswerSynthesizer:
    """Uses an LLM to synthesize raw DB results into a natural language answer."""

    def __init__(self, llm_provider):
        self.provider = llm_provider

    def synthesize(
        self,
        question: str,
        intent: QueryIntent,
        raw_results: dict[str, Any],
        user_name: str | None = None,
    ) -> str:
        """Generate a natural language answer from raw query results."""
        data = raw_results.get("data", [])
        data_type = raw_results.get("type", "generic")
        message = raw_results.get("message", "")

        if not data and message:
            return message

        if not data:
            return "I couldn't find any relevant information for your question."

        # Build context for the LLM
        context = self._format_results(data_type, data, intent)

        user_prompt = f"""Original question: {question}

Query results:
{context}

{f'The user asking is: {user_name}' if user_name else ''}

Please provide a natural language answer to the question based on these results."""

        # Use the extract method's underlying client for a simple completion
        try:
            return self._call_llm(user_prompt)
        except Exception as e:
            logger.error(f"Answer synthesis failed: {e}")
            return self._fallback_answer(data_type, data, intent)

    def _call_llm(self, user_prompt: str) -> str:
        """Call the LLM for answer synthesis."""
        if hasattr(self.provider, "client") and self.provider.client:
            client = self.provider.client
            # Try instructor client's underlying create
            if hasattr(client, "chat"):
                response = client.chat.completions.create(
                    model=getattr(self.provider, "model", "gpt-4o"),
                    messages=[
                        {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=1024,
                )
                # instructor wraps response; for raw completion we need to handle both cases
                if hasattr(response, "choices"):
                    return response.choices[0].message.content
                if isinstance(response, str):
                    return response
                return str(response)

        # Fallback: return a structured answer without LLM
        return self._fallback_answer("generic", [], None)

    def _format_results(self, data_type: str, data: list, intent: QueryIntent | None) -> str:
        """Format raw results into a readable context string."""
        if data_type == "entities":
            lines = []
            for r in data[:20]:
                name = r.get("identifier_value", r.get("name", "Unknown"))
                etype = r.get("entity_type", r.get("type", ""))
                lines.append(f"- {name} ({etype})")
            return "Entities found:\n" + "\n".join(lines)

        if data_type == "path":
            row = data[0] if data else {}
            path = row.get("path", [])
            rel_types = row.get("relation_types", [])
            if not path:
                return "No path found."
            chain_parts = []
            for i, node in enumerate(path):
                name = node.get("name", node.get("entity_id", "?")[:8])
                chain_parts.append(name)
                if i < len(rel_types):
                    chain_parts.append(f"--{rel_types[i]}-->")
            return "Connection path: " + " ".join(chain_parts)

        if data_type == "intel":
            lines = []
            for r in data[:20]:
                idata = r.get("data", {}) or {}
                desc = idata.get("description", idata.get("content", r.get("type", "")))
                occurred = r.get("occurred_at", "unknown date")
                lines.append(f"- [{occurred}] {desc}")
            return "Intel records:\n" + "\n".join(lines)

        if data_type == "relations":
            lines = []
            for r in data[:20]:
                src = r.get("source_name", r.get("source_id", "?")[:8])
                tgt = r.get("target_name", r.get("target_id", "?")[:8])
                rtype = r.get("type", "related")
                lines.append(f"- {src} --{rtype}--> {tgt}")
            return "Relations:\n" + "\n".join(lines)

        if data_type == "count":
            row = data[0] if data else {}
            return f"Entities: {row.get('entities', 0)}, Relations: {row.get('relations', 0)}, Intel: {row.get('intel', 0)}"

        # Generic
        return str(data[:10])

    def _fallback_answer(self, data_type: str, data: list, intent: QueryIntent | None) -> str:
        """Generate a simple answer without LLM."""
        if not data:
            return "No results found."

        return f"Found {len(data)} result(s). " + self._format_results(data_type, data, intent)
