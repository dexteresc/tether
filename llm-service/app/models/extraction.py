from pydantic import BaseModel, Field, AliasChoices, ConfigDict, model_validator
from typing import List, Optional, Dict, Any
from enum import Enum


# Enum definitions matching database schema
class EntityType(str, Enum):
    PERSON = "person"
    ORGANIZATION = "organization"
    GROUP = "group"
    VEHICLE = "vehicle"
    LOCATION = "location"
    EVENT = "event"


class IdentifierType(str, Enum):
    NAME = "name"
    DOCUMENT = "document"
    BIOMETRIC = "biometric"
    PHONE = "phone"
    EMAIL = "email"
    HANDLE = "handle"
    ADDRESS = "address"
    REGISTRATION = "registration"
    DOMAIN = "domain"


class RelationType(str, Enum):
    PARENT = "parent"
    CHILD = "child"
    SIBLING = "sibling"
    SPOUSE = "spouse"
    COLLEAGUE = "colleague"
    ASSOCIATE = "associate"
    FRIEND = "friend"
    MEMBER = "member"
    OWNER = "owner"
    FOUNDER = "founder"
    CO_FOUNDER = "co-founder"
    VISITED = "visited"
    EMPLOYEE = "employee"


class IntelType(str, Enum):
    EVENT = "event"
    COMMUNICATION = "communication"
    SIGHTING = "sighting"
    REPORT = "report"
    DOCUMENT = "document"
    MEDIA = "media"
    FINANCIAL = "financial"


class ConfidenceLevel(str, Enum):
    CONFIRMED = "confirmed"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCONFIRMED = "unconfirmed"


class ExtractionClassification(str, Enum):
    """Classification of extraction result type."""
    FACT_UPDATE = "fact_update"   # Primarily entity/attribute data (upserts)
    EVENT_LOG = "event_log"       # Primarily temporal events (inserts)
    MIXED = "mixed"               # Contains both types


# Chain-of-thought reasoning model (MUST be first field in IntelligenceExtraction)
class Reasoning(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    entities_identified: str = Field(
        default="",
        description="List all entities found in the text with their types (e.g., 'John (person), Acme Corp (organization)')"
    )
    relationships_identified: str = Field(
        default="None",
        description="List all relationships between entities (e.g., 'John is spouse of Sarah, John owns Acme Corp')"
    )
    facts_identified: str = Field(
        default="",
        description="List all factual information extracted (e.g., 'Samine's birthday is March 31, John is CEO')"
    )
    events_identified: str = Field(
        default="",
        description="List all events/intel extracted (e.g., 'Lukas went to store today, conference in NY yesterday')"
    )
    sources_identified: str = Field(
        default="Unknown",
        description="Identify who reported this information (e.g., 'Jonas reported this, direct observation')"
    )
    confidence_rationale: str = Field(
        default="",
        description="Explain why you assigned the confidence levels (e.g., 'High - specific details, Medium - secondhand from Jonas')"
    )


# Extraction models
class IdentifierExtraction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    identifier_type: IdentifierType = Field(
        description="Type of identifier (name, email, phone, document, etc.)"
    )
    value: str = Field(
        description="The identifier value (e.g., 'John Smith', 'john@acme.com', '+1-555-0123')"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata about this identifier"
    )


class EntityExtraction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    name: str = Field(
        description="Primary name/identifier for the entity"
    )
    entity_type: EntityType = Field(
        description="Type of entity (person, organization, group, vehicle, location)"
    )
    identifiers: List[IdentifierExtraction] = Field(
        description="All identifiers found for this entity (name, email, phone, etc.)"
    )
    attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional attributes (e.g., {'birthday': 'March 31', 'position': 'CEO', 'address': '123 Main St'})"
    )
    confidence: ConfidenceLevel = Field(
        description="Confidence level for this entity extraction"
    )
    source_reference: Optional[str] = Field(
        default=None,
        description="Who reported this information (e.g., 'Jonas', 'direct observation')"
    )

    @model_validator(mode='after')
    def check_name_identifier(self) -> 'EntityExtraction':
        has_name = any(i.identifier_type == IdentifierType.NAME for i in self.identifiers)
        if not has_name:
            # Auto-add the missing name identifier to improve consistency
            self.identifiers.insert(0, IdentifierExtraction(
                identifier_type=IdentifierType.NAME,
                value=self.name
            ))
        return self


class RelationExtraction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    source_entity_name: str = Field(
        description="Name of the source entity in the relationship"
    )
    target_entity_name: str = Field(
        description="Name of the target entity in the relationship"
    )
    relation_type: RelationType = Field(
        description="Type of relationship (parent, child, sibling, spouse, colleague, associate, friend, member, owner)"
    )
    strength: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Strength of the relationship from 1 (weak) to 10 (strong)"
    )
    valid_from: Optional[str] = Field(
        default=None,
        description="When the relationship started (natural language date like 'January 2020', 'last year')"
    )
    valid_to: Optional[str] = Field(
        default=None,
        description="When the relationship ended (natural language date)"
    )
    description: Optional[str] = Field(
        default=None,
        description="Additional context about the relationship (e.g., 'CEO of company', 'works as manager')"
    )
    confidence: ConfidenceLevel = Field(
        description="Confidence level for this relationship"
    )
    source_reference: Optional[str] = Field(
        default=None,
        description="Who reported this relationship"
    )


class IntelExtraction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    intel_type: IntelType = Field(
        description="Type of intelligence (event, communication, sighting, report, document, media, financial)"
    )
    description: str = Field(
        description="Clear description of what happened (e.g., 'Lukas went to the store', 'Conference in New York')"
    )
    occurred_at: Optional[str] = Field(
        default=None,
        description="When this happened (natural language date/time like 'today', 'yesterday', 'March 31', 'last Friday')"
    )
    entities_involved: List[str] = Field(
        description="Names of all entities involved in this event/intel"
    )
    location: Optional[str] = Field(
        default=None,
        description="Where this happened (location name)"
    )
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional type-specific details (e.g., {'activity': 'went to', 'event': 'conference', 'sighting_type': 'in-person'})"
    )
    confidence: ConfidenceLevel = Field(
        description="Confidence level for this intel"
    )
    source_reference: Optional[str] = Field(
        default=None,
        description="Who reported this intel"
    )


# Main extraction result
class IntelligenceExtraction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    reasoning: Reasoning = Field(
        description="Step-by-step reasoning about the extraction (REQUIRED FIRST - forces LLM to think before extracting)",
        validation_alias=AliasChoices('reasoning', 'Reasoning')
    )
    entities: List[EntityExtraction] = Field(
        default_factory=list,
        description="All entities extracted from the text"
    )
    relations: List[RelationExtraction] = Field(
        default_factory=list,
        description="All relationships extracted from the text"
    )
    intel: List[IntelExtraction] = Field(
        default_factory=list,
        description="All events/intelligence extracted from the text"
    )


# Sync results models
class SyncResults(BaseModel):
    entities_created: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Entities that were newly created"
    )
    entities_updated: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Entities that were updated with new information"
    )
    relations_created: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Relations that were created"
    )
    intel_created: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Intel records that were created"
    )
    errors: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Any errors that occurred during sync"
    )


def summarize_reasoning(reasoning: Reasoning) -> str:
    """
    Summarize Reasoning model into a concise chain_of_thought string.

    Args:
        reasoning: The Reasoning model from extraction

    Returns:
        A concise summary string of the reasoning process
    """
    parts = []

    if reasoning.entities_identified:
        parts.append(f"Entities: {reasoning.entities_identified}")

    if reasoning.relationships_identified and reasoning.relationships_identified != "None":
        parts.append(f"Relationships: {reasoning.relationships_identified}")

    if reasoning.facts_identified:
        parts.append(f"Facts: {reasoning.facts_identified}")

    if reasoning.events_identified:
        parts.append(f"Events: {reasoning.events_identified}")

    if reasoning.confidence_rationale:
        parts.append(f"Confidence: {reasoning.confidence_rationale}")

    return "; ".join(parts) if parts else "No reasoning provided"


class ClassifiedExtraction(BaseModel):
    """Response model with classification, chain-of-thought, and extraction results."""
    classification: ExtractionClassification = Field(
        description="Classification of the extraction (fact_update, event_log, or mixed)"
    )
    chain_of_thought: str = Field(
        description="Summary of the reasoning process behind the extraction"
    )
    extraction: IntelligenceExtraction = Field(
        description="The full extraction result with entities, relations, and intel"
    )
    sync_results: Optional[SyncResults] = Field(
        default=None,
        description="Results of database sync operations (if sync_to_db was true)"
    )
