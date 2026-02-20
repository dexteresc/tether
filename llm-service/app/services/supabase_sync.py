from supabase import Client
from typing import Dict, List, Optional
import json
import logging
from app.models.extraction import (
    IntelligenceExtraction,
    EntityExtraction,
    RelationExtraction,
    IntelExtraction,
    SyncResults,
    IdentifierExtraction,
)
from app.models.resolution import EntityResolutionResult
from app.utils.date_parser import parse_and_format_date
from app.utils.entity_matcher import find_entity_by_identifier

# Configure logger for sync operations
logger = logging.getLogger(__name__)


class SupabaseSyncService:
    """Service for syncing extracted intelligence to Supabase database."""

    def __init__(self, supabase: Client, user_id: str):
        """
        Initialize sync service.

        Args:
            supabase: Authenticated Supabase client
            user_id: User ID for ownership and RLS enforcement
        """
        self.supabase = supabase
        self.user_id = user_id

    def sync_extraction(
        self, extraction: IntelligenceExtraction, default_source: str = "LLM", entity_resolutions: Optional[List[EntityResolutionResult]] = None
    ) -> SyncResults:
        """
        Sync entire extraction to database.

        Syncs in order: entities → relations → intel

        Args:
            extraction: Intelligence extraction to sync
            default_source: Default source code if none specified
            entity_resolutions: Optional list of entity resolution results (Feature 003)

        Returns:
            SyncResults with created/updated entities, relations, intel, and errors
        """
        results = SyncResults()

        # Create or get source
        source_id = self._get_or_create_source(default_source)

        # Map entity names to IDs (for relations and intel linking)
        entity_name_to_id: Dict[str, str] = {}

        # T019: Process entity resolutions first to populate entity_name_to_id
        if entity_resolutions:
            self._process_entity_resolutions(entity_resolutions, entity_name_to_id, source_id, results)

        # Sync all entities (Fact Updates - FR-004, FR-006)
        for entity in extraction.entities:
            # Skip entities that were already resolved (T019)
            # Their IDs are already in entity_name_to_id from _process_entity_resolutions
            if entity.name in entity_name_to_id:
                logger.info(f"Skipping entity sync for '{entity.name}' - already resolved to {entity_name_to_id[entity.name]}")
                continue

            try:
                logger.info(f"Syncing entity: {entity.name} (type={entity.entity_type.value})")
                entity_sync_result = self._sync_entity(entity, source_id)

                # Track in name-to-id map
                entity_name_to_id[entity.name] = entity_sync_result["entity_id"]

                # Track in results
                if entity_sync_result.get("created"):
                    logger.info(f"Created new entity: {entity.name} (id={entity_sync_result['entity_id']})")
                    results.entities_created.append(entity_sync_result)
                else:
                    logger.info(f"Updated existing entity: {entity.name} (id={entity_sync_result['entity_id']})")
                    results.entities_updated.append(entity_sync_result)
            except Exception as e:
                error_msg = f"Failed to sync entity '{entity.name}': {str(e)}"
                logger.error(error_msg)
                results.errors.append(
                    {
                        "type": "entity",
                        "entity_name": entity.name,
                        "error_message": error_msg,
                    }
                )

        # Sync all relations
        for relation in extraction.relations:
            try:
                relation_sync_result = self._sync_relation(
                    relation, entity_name_to_id, source_id
                )
                results.relations_created.append(relation_sync_result)
            except Exception as e:
                results.errors.append(
                    {
                        "type": "relation",
                        "entity_name": f"{relation.source_entity_name} -> {relation.target_entity_name}",
                        "error_message": str(e),
                    }
                )

        # Sync all intel (Event Logs - FR-005)
        for intel in extraction.intel:
            try:
                logger.info(f"Syncing intel: {intel.intel_type.value} - {intel.description[:50]}...")
                intel_sync_result = self._sync_intel(intel, entity_name_to_id, source_id)
                logger.info(f"Created intel record: {intel_sync_result['intel_id']} (linked {intel_sync_result['entities_linked']} entities)")
                results.intel_created.append(intel_sync_result)
            except Exception as e:
                error_msg = f"Failed to sync intel '{intel.description[:50]}...': {str(e)}"
                logger.error(error_msg)
                results.errors.append(
                    {
                        "type": "intel",
                        "entity_name": intel.description,
                        "error_message": error_msg,
                    }
                )

        return results

    def _process_entity_resolutions(
        self,
        resolutions: List[EntityResolutionResult],
        entity_name_to_id: Dict[str, str],
        source_id: str,
        results: SyncResults
    ):
        """
        Process entity resolutions and populate entity_name_to_id mapping.

        Implements T019 (use resolved_entity_id) and T020 (create new entities).

        Args:
            resolutions: List of entity resolution results
            entity_name_to_id: Dictionary to populate with name->id mappings
            source_id: Source ID for new entities
            results: SyncResults to track created entities
        """
        for resolution in resolutions:
            reference = resolution.input_reference

            if resolution.resolved and resolution.resolved_entity_id:
                # T019: Use resolved entity ID
                entity_id_str = str(resolution.resolved_entity_id)
                entity_name_to_id[reference] = entity_id_str
                logger.info(f"Resolved '{reference}' to existing entity {entity_id_str} (confidence: {resolution.confidence:.2f})")

            elif resolution.resolution_method == "new_entity":
                # T020: Create new entity when confidence < threshold
                logger.info(f"Creating new entity for unresolved reference '{reference}'")
                try:
                    # Create minimal person entity
                    entity_data = {
                        "name": reference,
                        "user_id": self.user_id,
                        "_source": source_id,
                        "_confidence": "medium",  # Default confidence for new entities
                        "_resolution_method": resolution.resolution_method,
                    }

                    entity_response = (
                        self.supabase.table("entities")
                        .insert({
                            "type": "person",  # Assume person for name references
                            "data": entity_data,
                        })
                        .execute()
                    )

                    if entity_response.data and len(entity_response.data) > 0:
                        new_entity_id = entity_response.data[0]["id"]

                        # Create name identifier
                        self.supabase.table("identifiers").insert({
                            "entity_id": new_entity_id,
                            "type": "name",
                            "value": reference,
                        }).execute()

                        # Map to entity_name_to_id
                        entity_name_to_id[reference] = new_entity_id

                        # Track in results
                        results.entities_created.append({
                            "entity_id": new_entity_id,
                            "name": reference,
                            "type": "person",
                            "created": True,
                            "resolution_confidence": resolution.confidence,
                        })

                        logger.info(f"Created new entity for '{reference}': {new_entity_id}")

                except Exception as e:
                    error_msg = f"Failed to create entity for '{reference}': {str(e)}"
                    logger.error(error_msg)
                    results.errors.append({
                        "type": "entity_resolution",
                        "entity_name": reference,
                        "error_message": error_msg,
                    })

    def _sync_entity(
        self, entity: EntityExtraction, source_id: str
    ) -> Dict:
        """
        Sync an entity to the database.

        Args:
            entity: Entity extraction
            source_id: Source ID

        Returns:
            Entity sync result with entity_id and created status
        """
        # Try to find existing entity by name identifier
        existing_entity_id = find_entity_by_identifier(
            self.supabase, "name", entity.name, self.user_id
        )

        if existing_entity_id:
            # Entity exists - update it
            self._update_entity(existing_entity_id, entity, source_id)
            return {
                "entity_id": existing_entity_id,
                "name": entity.name,
                "type": entity.entity_type.value,
                "created": False,
                "identifiers_count": len(entity.identifiers),
            }
        else:
            # Entity doesn't exist - create it
            new_entity_id = self._create_entity(entity, source_id)
            return {
                "entity_id": new_entity_id,
                "name": entity.name,
                "type": entity.entity_type.value,
                "created": True,
                "identifiers_count": len(entity.identifiers),
            }

    def _create_entity(self, entity: EntityExtraction, source_id: str) -> str:
        """Create a new entity with identifiers."""
        # Prepare entity data
        entity_data = {
            "name": entity.name,
            "user_id": self.user_id,
            "_source": source_id,
            "_confidence": entity.confidence.value,
            **entity.attributes,
        }

        # Create entity
        entity_response = (
            self.supabase.table("entities")
            .insert(
                {
                    "type": entity.entity_type.value,
                    "data": entity_data,
                }
            )
            .execute()
        )

        if not entity_response.data or len(entity_response.data) == 0:
            raise Exception("Failed to create entity")

        entity_id = entity_response.data[0]["id"]

        # Create all identifiers
        self._create_identifiers(entity_id, entity.identifiers)

        return entity_id

    def _update_entity(
        self, entity_id: str, entity: EntityExtraction, source_id: str
    ):
        """Update an existing entity with new attributes and identifiers."""
        # Get current entity data
        current_entity = (
            self.supabase.table("entities")
            .select("data")
            .eq("id", entity_id)
            .single()
            .execute()
        )

        if not current_entity.data:
            raise Exception(f"Entity {entity_id} not found")

        # Merge new attributes with existing data
        current_data = current_entity.data.get("data", {})
        if isinstance(current_data, str):
            current_data = json.loads(current_data)

        # Update with new attributes
        updated_data = {
            **current_data,
            **entity.attributes,
            "_source": source_id,
            "_confidence": entity.confidence.value,
        }

        # Update entity
        self.supabase.table("entities").update(
            {"data": updated_data}
        ).eq("id", entity_id).execute()

        # Add new identifiers (skip duplicates)
        self._create_identifiers(entity_id, entity.identifiers, skip_duplicates=True)

    def _create_identifiers(
        self,
        entity_id: str,
        identifiers: List[IdentifierExtraction],
        skip_duplicates: bool = False,
    ) -> List[str]:
        """Create identifiers for an entity."""
        created_ids = []

        for identifier in identifiers:
            # Check if identifier already exists
            if skip_duplicates:
                # T038: Upsert logic - check if same type exists for this entity
                existing = (
                    self.supabase.table("identifiers")
                    .select("id, value")
                    .eq("entity_id", entity_id)
                    .eq("type", identifier.identifier_type.value)
                    .execute()
                )

                if existing.data and len(existing.data) > 0:
                    # Check if value differs - if so, update it (upsert)
                    existing_id = existing.data[0]["id"]
                    existing_value = existing.data[0]["value"]

                    if existing_value.lower() != identifier.value.lower():
                        # Update existing identifier with new value
                        self.supabase.table("identifiers").update(
                            {"value": identifier.value}
                        ).eq("id", existing_id).execute()
                        logger.info(f"Updated identifier {identifier.identifier_type.value} for entity {entity_id}: {existing_value} -> {identifier.value}")

                    continue  # Skip creating new one

            # Create identifier
            response = (
                self.supabase.table("identifiers")
                .insert(
                    {
                        "entity_id": entity_id,
                        "type": identifier.identifier_type.value,
                        "value": identifier.value,
                        "metadata": (
                            json.dumps(identifier.metadata)
                            if identifier.metadata
                            else None
                        ),
                    }
                )
                .execute()
            )

            if response.data and len(response.data) > 0:
                created_ids.append(response.data[0]["id"])

        return created_ids

    def _sync_relation(
        self, relation: RelationExtraction, entity_name_to_id: Dict[str, str], source_id: str
    ) -> Dict:
        """Sync a relation to the database."""
        # Resolve entity names to IDs
        source_entity_id = entity_name_to_id.get(relation.source_entity_name)
        target_entity_id = entity_name_to_id.get(relation.target_entity_name)

        if not source_entity_id:
            raise Exception(f"Source entity not found: {relation.source_entity_name}")
        if not target_entity_id:
            raise Exception(f"Target entity not found: {relation.target_entity_name}")

        # Check if relation already exists
        existing = (
            self.supabase.table("relations")
            .select("id")
            .eq("source_id", source_entity_id)
            .eq("target_id", target_entity_id)
            .eq("type", relation.relation_type.value)
            .is_("deleted_at", "null")
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            # Relation already exists, skip
            return {
                "relation_id": existing.data[0]["id"],
                "source_name": relation.source_entity_name,
                "target_name": relation.target_entity_name,
                "type": relation.relation_type.value,
                "created": False,
            }

        # Parse dates if provided
        valid_from = (
            parse_and_format_date(relation.valid_from) if relation.valid_from else None
        )
        valid_to = (
            parse_and_format_date(relation.valid_to) if relation.valid_to else None
        )

        # Prepare relation data
        relation_data = {
            "confidence": relation.confidence.value,
            "source_id": source_id,
        }
        if relation.description:
            relation_data["description"] = relation.description

        # Create relation
        response = (
            self.supabase.table("relations")
            .insert(
                {
                    "source_id": source_entity_id,
                    "target_id": target_entity_id,
                    "type": relation.relation_type.value,
                    "strength": relation.strength,
                    "valid_from": valid_from,
                    "valid_to": valid_to,
                    "data": relation_data,
                }
            )
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise Exception("Failed to create relation")

        return {
            "relation_id": response.data[0]["id"],
            "source_name": relation.source_entity_name,
            "target_name": relation.target_entity_name,
            "type": relation.relation_type.value,
            "created": True,
        }

    def _sync_intel(
        self, intel: IntelExtraction, entity_name_to_id: Dict[str, str], source_id: str
    ) -> Dict:
        """Sync intel to the database."""
        # Parse occurred_at date
        occurred_at = parse_and_format_date(intel.occurred_at)

        # Prepare intel data
        intel_data = {
            "description": intel.description,
            "details": intel.details,
        }
        if intel.location:
            intel_data["location"] = intel.location

        # Create intel
        response = (
            self.supabase.table("intel")
            .insert(
                {
                    "type": intel.intel_type.value,
                    "occurred_at": occurred_at,
                    "data": intel_data,
                    "source_id": source_id,
                    "confidence": intel.confidence.value,
                }
            )
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise Exception("Failed to create intel")

        intel_id = response.data[0]["id"]

        # Link entities
        entities_linked = 0
        for entity_name in intel.entities_involved:
            entity_id = entity_name_to_id.get(entity_name)
            if entity_id:
                self.supabase.table("intel_entities").insert(
                    {
                        "intel_id": intel_id,
                        "entity_id": entity_id,
                        "role": "participant",
                    }
                ).execute()
                entities_linked += 1

        return {
            "intel_id": intel_id,
            "type": intel.intel_type.value,
            "description": intel.description,
            "entities_linked": entities_linked,
        }

    def _get_or_create_source(self, source_code: str) -> str:
        """Get or create a source by code."""
        # Search for existing source
        existing = (
            self.supabase.table("sources")
            .select("id")
            .eq("code", source_code)
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            return existing.data[0]["id"]

        # Create new source
        response = (
            self.supabase.table("sources")
            .insert(
                {
                    "code": source_code,
                    "type": "human",
                    "reliability": "C",  # Fairly reliable by default
                    "data": {},
                    "active": True,
                }
            )
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise Exception("Failed to create source")

        return response.data[0]["id"]
