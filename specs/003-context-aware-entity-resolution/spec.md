# Feature Specification: Context-Aware Entity Resolution

**Feature Branch**: `003-context-aware-entity-resolution`
**Created**: 2024-12-24
**Status**: Draft
**Input**: User description: "improve llm service to be able to take existing entities, identifiers, relations etc into account when reasoning. For example I want to be able to type John ate a burger yesterday with Timmy, and it recognizing that there only is one John so we can assume that that is the person etc"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resolve Unique Person Reference (Priority: P1)

A user submits natural language containing a person's first name only (e.g., "John ate a burger yesterday"). The system queries existing persons to check if there is exactly one "John" in the database and automatically resolves the reference to that specific person entity without requiring disambiguation.

**Why this priority**: Core functionality - enables users to refer to people naturally without full names or IDs. This is the foundation for context-aware entity resolution.

**Independent Test**: Can be fully tested by creating a single person named "John" in the database, submitting text with "John", and verifying the system links it to the correct person entity.

**Acceptance Scenarios**:

1. **Given** one person named "John" exists in the database, **When** user submits "John ate a burger", **Then** the system resolves "John" to the existing person entity and creates an interaction log linked to that person.
2. **Given** one person named "John Smith" exists, **When** user submits "John called me", **Then** the system matches "John" to "John Smith" based on first name matching.
3. **Given** no persons named "John" exist, **When** user submits "John ate a burger", **Then** the system creates a new person entity for "John" as a Fact Update.

---

### User Story 2 - Handle Ambiguous Person References (Priority: P1)

A user submits natural language containing a name that matches multiple existing persons (e.g., "John" when there are two Johns in the database). The system detects the ambiguity and either requests clarification or uses contextual clues to resolve the reference.

**Why this priority**: Critical for accuracy - prevents incorrect entity linking which would corrupt relationship data.

**Independent Test**: Can be tested by creating multiple persons with the same first name, submitting text with that name, and verifying the system handles the ambiguity appropriately.

**Acceptance Scenarios**:

1. **Given** multiple persons named "John" exist, **When** user submits "John ate a burger", **Then** the system prompts the user for clarification by presenting all matching persons with their distinguishing attributes (company, email, etc.).
2. **Given** two persons "John Smith" and "John Doe", **When** user submits "John Smith called", **Then** the system resolves to the correct "John Smith" using full name matching.
3. **Given** ambiguous reference with additional context (e.g., "John from Acme Corp"), **When** user submits the text, **Then** the system uses the company attribute to disambiguate between multiple Johns.

---

### User Story 3 - Resolve Multi-Person Interactions (Priority: P2)

A user submits natural language describing an interaction involving multiple people (e.g., "John ate a burger yesterday with Timmy"). The system resolves all person references and creates interaction logs that capture the multi-person nature of the event.

**Why this priority**: Extends basic resolution to realistic scenarios, but single-person resolution must work first.

**Independent Test**: Can be tested by creating persons "John" and "Timmy", submitting multi-person interaction text, and verifying both persons are correctly linked to the interaction.

**Acceptance Scenarios**:

1. **Given** persons "John" and "Timmy" exist uniquely, **When** user submits "John ate a burger with Timmy", **Then** the system creates an interaction log that references both persons.
2. **Given** mixed unique and ambiguous names, **When** user submits multi-person text, **Then** the system resolves unique references automatically and handles ambiguous ones according to the disambiguation strategy.
3. **Given** a person reference that partially matches an existing person, **When** user submits the text, **Then** the system uses fuzzy matching to suggest the most likely match.

---

### User Story 4 - Update Person Attributes with Context (Priority: P3)

A user submits natural language that updates attributes of a person identified by name (e.g., "John's new email is john.new@example.com"). The system resolves "John" to the existing person and updates their attributes without creating a duplicate.

**Why this priority**: Improves usability by allowing natural updates, but basic create/read operations are higher priority.

**Independent Test**: Can be tested by creating a person "John", submitting an update with just the first name, and verifying the existing record is updated.

**Acceptance Scenarios**:

1. **Given** one person named "John" exists, **When** user submits "John's email is john@new.com", **Then** the system updates the existing John's email attribute.
2. **Given** multiple Johns exist and one was referenced in the previous interaction, **When** user submits "His email is john@new.com", **Then** the system uses interaction history to resolve "His" to the most recently mentioned John.
3. **Given** an update with a name and disambiguating attribute, **When** user submits "John from Acme Corp changed companies to NewCo", **Then** the system finds the correct John and updates the company attribute.

---

### Edge Cases

- What happens when a nickname is used that doesn't match any formal names in the database?
- How does the system handle typos or misspellings in person names?
- What happens when a person reference is completely ambiguous and lacks contextual clues?
- How does the system handle pronoun references (he, she, they) that require resolving to a previously mentioned person?
- What happens when input mentions a person who shares a name with a recently deleted person?
- How does the system handle partial name matches (e.g., "Tim" when database has "Timmy" or "Timothy")?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST query existing persons in the database before processing natural language input to build a context of known entities.
- **FR-002**: System MUST attempt to resolve person references (names) in natural language to existing person entities using exact and fuzzy matching.
- **FR-003**: System MUST automatically resolve a person reference when exactly one matching person exists in the database.
- **FR-004**: System MUST detect when a person reference is ambiguous (matches multiple existing persons).
- **FR-005**: System MUST handle ambiguous person references by prompting the user for clarification, presenting all matching persons with their distinguishing attributes.
- **FR-006**: System MUST support resolving multiple person references within a single natural language input.
- **FR-007**: System MUST use contextual attributes (company, email, location, etc.) mentioned in the input to disambiguate person references when available.
- **FR-008**: System MUST create new person entities only when no reasonable match exists in the database (confidence below threshold).
- **FR-009**: System MUST provide reasoning in the chain_of_thought field explaining how person references were resolved or why new entities were created.
- **FR-010**: System MUST maintain a confidence score for each entity resolution indicating match certainty.
- **FR-011**: System MUST support partial name matching (e.g., "John" matching "John Smith", "Tim" matching "Timothy").
- **FR-012**: System MUST link resolved person entities to interaction logs when the input describes an event.
- **FR-013**: System MUST update existing person attributes when input provides new information about a resolved person.

### Key Entities

- **Person**: Existing entity representing tracked individuals. Key attributes: name, email, company, phone. Used as the resolution target for person references.
- **Entity Resolution Result**: Output of the matching process. Contains: input_reference (name as mentioned), resolved_person_id (database ID if matched), confidence_score (0-1), resolution_method (exact_match, fuzzy_match, contextual_match, new_entity), reasoning (from chain_of_thought).
- **Resolution Context**: The set of existing entities and recent interaction history available when processing new input. Includes: all persons in database, recent interaction logs (for pronoun resolution), session history (for conversational context).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System correctly resolves unique person references (one match exists) with 95% accuracy on test inputs.
- **SC-002**: System detects ambiguous person references (multiple matches) with 95% accuracy.
- **SC-003**: System resolves person references using contextual clues (company, email, etc.) with at least 85% accuracy when clues are present.
- **SC-004**: Users can create interaction logs referencing existing people using only first names when unambiguous, reducing input verbosity by at least 50% compared to requiring full names or IDs.
- **SC-005**: System correctly handles multi-person interactions, resolving all person references in inputs mentioning 2-4 people with at least 90% accuracy.
- **SC-006**: System avoids creating duplicate person entities for ambiguous references, maintaining data integrity with less than 5% false new-entity creation rate.
- **SC-007**: Entity resolution chain-of-thought reasoning is present and explains the matching logic for 100% of processed inputs.

## Assumptions

- The persons table contains sufficient historical data to make entity resolution valuable. If the database is empty or has very few persons, resolution will default to creating new entities.
- Person names are stored in a consistent format (first name, last name, or full name field) that enables matching logic.
- Users typically refer to people using first names or full names, not middle names or nicknames (nickname support is a future enhancement).
- The system processes one natural language input at a time; batch processing is not in initial scope.
- Fuzzy matching uses a threshold of 80% similarity (Jaro-Winkler) for first names and a more lenient 70% similarity for last names to account for common variations and typos.
- Context from previous interactions in the same session is available for pronoun resolution, but cross-session context is not required in the initial implementation.
- The LLM provider has sufficient capability to perform entity resolution reasoning (tested with models like GPT-4, Claude, or high-quality local models).

## Dependencies

- Builds on existing NLP extraction functionality from feature 000-instructor-nlp-extraction.
- Requires read access to the persons and interaction_logs tables in Supabase.
- May benefit from future enhancements to store entity resolution metadata for learning and improving match accuracy over time.
