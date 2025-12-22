# Feature Specification: NLP Extraction with Instructor

**Feature Branch**: `001-instructor-nlp-extraction`
**Created**: 2024-12-22
**Status**: Draft
**Input**: User description: "using instructor to process natural language into a structured Pydantic schema that distinguishes between 'Fact Updates' (upserting to a persons table) and 'Event Logs' (inserting into interaction_logs). The schema must include a chain_of_thought field to force reasoning before extraction, which is critical for local model accuracy. The system should use Supabase for the database layer and be architected to switch the instructor client between OpenAI and a local Ollama instance purely through environment variables."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Process Natural Language into Fact Update (Priority: P1)

A user submits natural language text containing information about a person (e.g., "John's email is john@example.com and he works at Acme Corp"). The system extracts this as a Fact Update, reasoning through the extraction via chain-of-thought, and upserts the data to the persons table.

**Why this priority**: Core functionality - the system must be able to extract and persist person-related facts. Without this, no data can be captured.

**Independent Test**: Can be fully tested by submitting person-related text and verifying the persons table is updated with correct extracted data.

**Acceptance Scenarios**:

1. **Given** a natural language input containing person attributes (name, email, company), **When** the system processes the input, **Then** the extracted data is upserted to the persons table with correct field mappings.
2. **Given** an existing person record, **When** new information about that person is submitted, **Then** the existing record is updated (upserted) rather than creating a duplicate.
3. **Given** natural language input, **When** the system extracts data, **Then** a chain_of_thought field is populated explaining the reasoning behind the extraction.

---

### User Story 2 - Process Natural Language into Event Log (Priority: P1)

A user submits natural language text describing an interaction or event (e.g., "Called John yesterday to discuss the project proposal"). The system extracts this as an Event Log, reasoning through the extraction, and inserts a new record into interaction_logs.

**Why this priority**: Core functionality alongside Fact Updates - the system must distinguish between static facts and temporal events.

**Independent Test**: Can be fully tested by submitting event-related text and verifying a new interaction_logs record is created with correct extracted data.

**Acceptance Scenarios**:

1. **Given** a natural language input describing an interaction (call, meeting, email), **When** the system processes the input, **Then** a new record is inserted into interaction_logs.
2. **Given** event text with temporal references, **When** the system extracts data, **Then** the timestamp/date is correctly parsed and stored.
3. **Given** natural language input, **When** the system extracts data, **Then** a chain_of_thought field is populated explaining the reasoning behind the extraction.

---

### User Story 3 - Switch LLM Provider via Environment (Priority: P2)

An administrator configures the system to use either a cloud-based LLM provider or a local Ollama instance by changing environment variables. No code changes are required to switch providers.

**Why this priority**: Enables flexibility for cost control and privacy requirements, but the extraction must work first (P1).

**Independent Test**: Can be tested by changing environment variables and verifying the system successfully processes requests using the configured provider.

**Acceptance Scenarios**:

1. **Given** environment variables configured for the cloud provider, **When** the system starts, **Then** it uses the cloud provider for all extractions.
2. **Given** environment variables configured for local Ollama, **When** the system starts, **Then** it uses the local Ollama instance for all extractions.
3. **Given** a provider switch via environment variables, **When** the system processes the same input with both providers, **Then** the extracted output structure is identical (content may vary by model capability).

---

### User Story 4 - Classify Input Type Automatically (Priority: P2)

The system automatically determines whether natural language input represents a Fact Update or an Event Log based on the content, without requiring the user to specify the type.

**Why this priority**: Improves user experience by removing manual classification, but manual specification could work as fallback.

**Independent Test**: Can be tested by submitting various text types and verifying correct classification without user hints.

**Acceptance Scenarios**:

1. **Given** text describing person attributes without temporal context, **When** processed, **Then** the system classifies it as a Fact Update.
2. **Given** text describing an interaction with temporal markers, **When** processed, **Then** the system classifies it as an Event Log.
3. **Given** ambiguous text, **When** processed, **Then** the system provides its classification reasoning in the chain_of_thought field and selects the most likely type.

---

### Edge Cases

- What happens when input contains both fact updates and event information in the same text?
- How does the system handle input that cannot be classified as either type?
- What happens when the LLM provider is unavailable or returns an error?
- How does the system handle malformed or incomplete person data?
- What happens when referenced person does not exist for an event log?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept natural language text as input and return structured extracted data.
- **FR-002**: System MUST classify each input as either a "Fact Update" or "Event Log" based on content analysis.
- **FR-003**: System MUST include a chain_of_thought field in all extraction results that documents the reasoning process.
- **FR-004**: System MUST upsert Fact Update extractions to the persons table (create if not exists, update if exists).
- **FR-005**: System MUST insert Event Log extractions as new records in the interaction_logs table.
- **FR-006**: System MUST determine person identity for upserts using name as the primary matching key; if name is ambiguous, the system creates a new record.
- **FR-007**: System MUST support switching between LLM providers through environment variable configuration only.
- **FR-008**: System MUST support at minimum two LLM provider modes: cloud-based and local Ollama.
- **FR-009**: System MUST validate extracted data against the expected schema before database operations.
- **FR-010**: System MUST return meaningful error messages when extraction fails or data validation fails.
- **FR-011**: System MUST handle inputs containing both facts and events by extracting both and performing appropriate database operations for each.

### Key Entities

- **Person**: Represents an individual whose information is tracked. Key attributes: name (identifier), email, company, phone, notes, last_updated timestamp.
- **Interaction Log**: Represents a temporal event or interaction. Key attributes: description, interaction_type (call, meeting, email, etc.), occurred_at timestamp, related_person (reference to Person), notes.
- **Extraction Result**: The output of processing natural language. Contains: classification (fact_update or event_log), chain_of_thought (reasoning), extracted_data (structured fields), confidence_score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System correctly classifies input type (Fact Update vs Event Log) with at least 90% accuracy on representative test inputs.
- **SC-002**: Extracted structured data matches expected fields with at least 85% field-level accuracy.
- **SC-003**: Chain-of-thought reasoning is present and coherent for 100% of extraction results.
- **SC-004**: Provider switching via environment variables works without code changes or system restart (configuration reload sufficient).
- **SC-005**: System handles provider unavailability gracefully, returning clear error messages within 30 seconds.
- **SC-006**: Upsert operations correctly update existing records (no duplicates created for same person) in 100% of matching cases.

## Assumptions

- The persons table uses name as the primary identifier for upsert matching. More sophisticated matching (email, fuzzy name) is out of scope for initial implementation.
- The system processes one input at a time; batch processing is not in initial scope.
- Users have appropriate database credentials configured via environment.
- The local Ollama instance is pre-configured and accessible when selected via environment variables.
- Input text is in English.
