# Feature Specification: Frontend Data Visualization & Natural Language Input

**Feature Branch**: `002-frontend-data-viz`
**Created**: 2024-12-22
**Status**: Draft
**Input**: User description: "add a working frontend with visualisation of all tables as well as a page for inputting information in natural language. The inputs should be able to be chained. The answers to the inputs should be a row where the user can either accept deny or change any of the inputs before they go to the database. Local first architecture with offline capability"

## Clarifications

### Session 2024-12-22

- Q: Should the frontend use a local-first architecture with offline-capable data replication, or a traditional online-only client-server model? → A: Local-first with sync engine - Data replicated to browser (IndexedDB), reads are instant from local cache, writes queued and synced when ready, natural language inputs processed sequentially (next query waits for previous response), works offline with eventual consistency
- Q: When a sync conflict occurs and the server version wins, should the user's local changes be permanently discarded, or saved for potential recovery? → A: Save to conflict log - Losing changes saved to a conflict resolution table/view for user review and manual re-application if important
- Q: Should the application block user interaction until initial sync completes, or allow immediate use while syncing in the background? → A: Progressive sync with immediate access - App usable immediately with any cached data, new/updated records sync in background with progress indicator, users see data populate incrementally
- Q: How much information should users see about queued natural language inputs waiting for processing? → A: Full queue visibility with status - List showing all queued inputs with status (pending, processing, completed, failed), position in queue, estimated wait, and ability to cancel queued items
- Q: How should the application handle IndexedDB storage quota exhaustion? → A: Auto-evict oldest synced data - Automatically remove oldest successfully synced records when quota reached using LRU cache strategy, always keeping all unsynced changes and recent data, seamless operation without user intervention
- Q: What is the detailed sync flow architecture for local-first operations? → A: Five-phase sync flow: (1) Instant Local Commit - immediate UI update and IndexedDB save on user action, (2) Transaction Queue - action wrapped in transaction object placed in ordered outbox queue, (3) Upstream Sync - background process sends queued transactions to server via GraphQL mutations when network available, (4) Downstream Broadcast - server generates lightweight delta packet with diffs and pushes via WebSocket to all connected clients, (5) Confirmation Loop - client receives WebSocket message, acknowledges queued action success, reconciles any conflicts with server state

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View All Intelligence Data with Instant Local Access (Priority: P1)

A user opens the application and immediately sees all their intelligence data loaded from the local IndexedDB cache, regardless of network connectivity. The system displays all tables (entities, intel, relations, identifiers, sources) instantly from the local replica while syncing updates from Supabase in the background without blocking interaction. The sync status indicator shows connection state and any pending updates. Even first-time users with empty cache can start interacting immediately as data progressively loads in the background.

**Why this priority**: Instant access to intelligence data is critical for field operations. Local-first architecture eliminates network latency and enables offline access. Field operatives in areas with poor connectivity (remote locations, secure facilities) can access their full database without network dependency.

**Independent Test**: Can be tested by disconnecting network and verifying all cached data remains fully accessible, then reconnecting and verifying background sync updates without disrupting the view.

**Acceptance Scenarios**:

1. **Given** the user has previously synced data, **When** they open the app and navigate to the Entities view, **Then** all entities display instantly from IndexedDB cache showing type, identifiers, and creation date
2. **Given** the user is viewing the Intel table from cache, **When** background sync detects new server records, **Then** a subtle notification appears and the UI updates incrementally without disrupting the current view
3. **Given** the user is browsing Relations offline, **When** they select a relationship, **Then** they see source entity, target entity, relationship type, strength rating (1-10), and validity dates instantly from local cache with "Offline" indicator visible
4. **Given** the user is viewing Identifiers, **When** they browse the list, **Then** they see each identifier's type (name, email, phone, etc.), value, and associated entity from local cache
5. **Given** the user opens the app for the first time with empty cache, **When** initial sync begins, **Then** they can immediately interact with the UI and see records populate incrementally as sync progresses
6. **Given** the user is viewing cached data, **When** they check the sync status indicator, **Then** they see connection state (Online/Offline), last sync timestamp, and pending changes count (if any)

---

### User Story 2 - Submit Natural Language Input with Sequential Processing (Priority: P1)

A user wants to add new intelligence by typing natural language text (e.g., "John Smith works at Acme Corp and his email is john@acme.com"). The system queues the input and processes it sequentially through the LLM service - each input waits for the previous extraction to complete before being sent, ensuring context is maintained. The extraction queue is fully visible showing each input's status, position, and estimated wait time. Users can cancel pending inputs. Extracted entities and relationships appear as editable rows stored locally until the user commits them, at which point they're queued for background sync to Supabase.

**Why this priority**: Natural language input is the core value proposition - 10x faster than manual forms. Sequential processing with full queue visibility prevents race conditions, maintains extraction context across related inputs, and gives users transparency into the processing pipeline. Local storage of extracted data before sync ensures no data loss even offline.

**Independent Test**: Can be tested by submitting multiple natural language inputs rapidly, verifying sequential processing order, reviewing the visible queue with status updates, editing/accepting/rejecting extracted rows, and confirming accepted data syncs to the server while rejected data is discarded.

**Acceptance Scenarios**:

1. **Given** the user is on the Natural Language Input page, **When** they type "Bob Miller met Sarah Johnson at the conference in San Francisco" and submit, **Then** the input is added to the processing queue with "Pending" status, visible queue position (#1), and estimated wait time
2. **Given** the user has one input processing and submits a second input, **When** they view the queue, **Then** they see input #1 with status "Processing" and input #2 with status "Pending - Position #2" waiting for #1 to complete
3. **Given** an input is being processed, **When** extraction completes, **Then** the system displays extracted entities (Bob Miller - person, Sarah Johnson - person, San Francisco - location) and intel (meeting event) as editable rows stored locally, and queue status updates to "Completed"
4. **Given** extracted data is displayed, **When** the user reviews the results, **Then** each row shows entity type, identifiers, confidence level, and action buttons (Accept, Edit, Reject)
5. **Given** an extracted entity row, **When** the user clicks "Edit", **Then** all fields become editable and changes are saved to local IndexedDB immediately
6. **Given** the user has reviewed extracted data, **When** they click "Accept" on specific rows and "Reject" on others, **Then** only accepted rows are marked for sync queue, rejected rows are discarded from local storage
7. **Given** the user has accepted multiple extractions, **When** they are online and click "Commit to Database", **Then** all accepted data is queued for background sync to Supabase with optimistic local UI updates
8. **Given** the user has accepted extractions but is offline, **When** they click "Commit to Database", **Then** the data is queued locally with status "Pending sync - will upload when online" and remains visible in local cache
9. **Given** the user has multiple inputs queued, **When** they view the queue panel, **Then** they see each input's text snippet (first 50 chars), status (Pending/Processing/Completed/Failed), queue position, and estimated wait time based on average extraction duration
10. **Given** an input is in "Pending" status (not yet processing), **When** the user clicks the cancel button, **Then** that input is removed from the queue without affecting other queued or processing items

---

### User Story 3 - Chain Multiple Natural Language Inputs with Context Preservation (Priority: P2)

A user wants to build complex intelligence incrementally by chaining multiple related natural language inputs before committing. For example, they input "Lukas Müller is a software engineer", review the extraction, then chain a second input "He works at Tech GmbH in Berlin" where "he" correctly resolves to "Lukas Müller" through maintained context. The sequential processing queue ensures each input is processed only after the previous extraction completes, preserving context across the chain. All extractions accumulate in local storage until the user commits everything together in one batch, which is then queued for sync.

**Why this priority**: Real intelligence gathering is iterative - users often have multiple related pieces of information that build on each other over time. Chaining with context preservation enables natural conversational extraction where pronouns and references resolve correctly. Sequential processing is critical here - parallel processing would lose context. Local accumulation before sync allows users to review the complete picture before committing.

**Independent Test**: Can be tested by submitting a first input, waiting for extraction, adding a second chained input with pronouns/references, verifying context is maintained through sequential processing, removing a specific chain item mid-way, and confirming all remaining chained data commits together to the sync queue.

**Acceptance Scenarios**:

1. **Given** the user has submitted a first natural language input "Lukas Müller is a software engineer" and extraction completed, **When** they click "Add Another Input" (chain), **Then** a new input field appears while preserving the previous extraction results in the UI and in local IndexedDB context
2. **Given** the user has chained a second input "He works at Tech GmbH in Berlin", **When** the LLM processes this (after first input completes), **Then** "He" resolves to "Lukas Müller" from the previous extraction context, creating a relation between Lukas and Tech GmbH
3. **Given** the user has chained three inputs (A→B→C) with extractions stored locally, **When** they decide input B was incorrect, **Then** they can remove input B and its extractions from local storage without affecting A or C, and the chain remains A→C
4. **Given** the user has chained multiple inputs with accumulated extractions, **When** they review all extracted data, **Then** they see entities from all inputs with visual indicators showing which extraction each came from (e.g., "From input #1", "From input #2")
5. **Given** the user has chained inputs with accepted extractions stored locally, **When** they click "Commit All to Database", **Then** all accepted data from all chained inputs is batched and queued for sync to Supabase in a single transaction, with optimistic local updates
6. **Given** the user is offline and has chained multiple inputs, **When** they commit, **Then** the entire batch is queued locally with status "Pending sync - 12 entities, 5 relations waiting" and will sync when connection restores
7. **Given** a chained input references an entity from a previous input, **When** the extraction displays, **Then** the system shows the relationship visually (e.g., highlighting the resolved entity with "Referenced from input #1")

---

### User Story 4 - Work Offline with Full Functionality (Priority: P2)

A field intelligence officer loses internet connection while gathering information. The application continues functioning normally - they can view all cached data, submit natural language inputs which queue locally, edit extracted entities, and make changes. All operations are stored locally and sync automatically when connection is restored, with conflict resolution handling any simultaneous server changes.

**Why this priority**: Field intelligence work often occurs in areas with unreliable connectivity (remote locations, secure facilities, underground). Offline capability is essential for real-world usage, not optional. This is elevated to P2 because it's a core differentiator of the local-first architecture.

**Independent Test**: Can be tested by disconnecting network, performing all CRUD operations (view data, submit natural language, edit entities, chain inputs), then reconnecting and verifying all changes sync correctly with conflict resolution.

**Acceptance Scenarios**:

1. **Given** the user is online and browsing data, **When** internet connection is lost, **Then** a subtle "Offline" indicator appears but all data remains visible and browsable from local cache
2. **Given** the user is offline, **When** they submit a natural language input, **Then** the input queues locally with status "Pending sync - will process when online" and does not attempt LLM extraction
3. **Given** the user is offline with queued inputs, **When** they reconnect to the internet, **Then** the sync indicator changes to "Syncing" and queued inputs process sequentially through the LLM service
4. **Given** the user made changes offline, **When** sync completes and a conflict is detected, **Then** the conflict log saves the overwritten local version and displays notification "1 conflict detected - review in Conflict Log"
5. **Given** the user is offline, **When** they edit existing cached entities, **Then** changes are marked "Pending sync" and immediately visible in the local UI
6. **Given** the user is offline and local cache storage approaches 80% quota, **When** they continue working, **Then** oldest synced records automatically evict transparently without disrupting the user experience
7. **Given** the user reconnects after extended offline period, **When** sync begins, **Then** they see progress indicator "Syncing 47 pending changes..." and can continue working while sync runs in background

---

### User Story 5 - Monitor and Manage Sync Status (Priority: P2)

A user wants to understand what data has synced, what's pending, and if any conflicts occurred. The application provides a comprehensive sync status dashboard showing: connection state (online/offline), pending changes count, active sync progress, last sync timestamp, and access to the conflict review page. This transparency builds trust in the local-first model and helps users understand eventual consistency.

**Why this priority**: Users need visibility into the sync engine to trust the system, especially when working offline or with important intelligence data. Without this transparency, users won't understand if their data is safe or why they're seeing certain records.

**Independent Test**: Can be tested by making changes (creates, updates), going offline, accumulating pending changes, reconnecting, and verifying the sync dashboard accurately reflects all state transitions and allows conflict review.

**Acceptance Scenarios**:

1. **Given** the user has made local changes, **When** they check the sync indicator in the header, **Then** they see "3 changes pending" with a green checkmark when online or yellow warning when offline
2. **Given** sync is actively running, **When** the user views the sync status panel, **Then** they see "Syncing 12 of 25 changes" with progress bar and estimated time remaining
3. **Given** the user is online with no pending changes, **When** they view the sync indicator, **Then** it shows "All synced" with green status and timestamp "Last sync: 2 minutes ago"
4. **Given** a sync conflict occurred, **When** the user clicks the conflict notification, **Then** they navigate to the Conflict Review page showing the conflict details with both versions
5. **Given** the user is viewing a conflict in the Conflict Review page, **When** they choose to re-apply their local changes, **Then** the change is queued for sync again with a new timestamp to override the server version
6. **Given** background sync is running, **When** new server changes are detected, **Then** the UI incrementally updates affected records without disrupting the user's current view or task
7. **Given** the user wants to understand sync health, **When** they open the sync dashboard, **Then** they see: connection state, pending changes count by type (creates/updates/deletes), last sync timestamp, sync error log (if any), and conflict count

---

### User Story 6 - Filter and Search Data Tables (Priority: P3)

A user managing a large intelligence database needs to find specific records quickly. They can filter entities by type (person, organization, location), search intel records by date range or confidence level, and filter relations by relationship type. All filtering and search operations execute instantly against the local IndexedDB cache, providing sub-200ms results even for thousands of records.

**Why this priority**: While viewing all data (P1) is essential, filtering becomes critical as the database grows. This is a productivity enhancement rather than core functionality. Local-first architecture makes this extremely fast.

**Independent Test**: Can be tested by creating diverse test data, applying various filters (entity type, date range, confidence level), and verifying only matching records display with instant performance from local cache.

**Acceptance Scenarios**:

1. **Given** the user is viewing the Entities table with 5,000 cached records, **When** they select "Type: Person" filter, **Then** only person entities display within 200ms from local IndexedDB query
2. **Given** the user is viewing Intel records, **When** they filter by date range "Last 30 days", **Then** only intel with occurred_at within that range displays instantly from local cache
3. **Given** the user is viewing any table, **When** they enter a search term, **Then** records matching that term in any visible field are highlighted instantly using local full-text search
4. **Given** the user has applied multiple filters, **When** they click "Clear Filters", **Then** all records display again with instant response from cache
5. **Given** the user filters Relations by type "colleague", **When** the results display, **Then** only colleague relationships appear with their strength ratings, filtered locally without network request

---

### Edge Cases

- What happens when the LLM extraction service is unavailable or times out?
  - Display clear error message: "Intelligence extraction service unavailable. Please try again in a moment."
  - Preserve the user's input text so they don't lose their work
  - Offer a "Retry" button to re-attempt extraction

- What happens when natural language input contains no extractable entities or intel?
  - Display message: "No structured data could be extracted from this input. Please provide more specific information (names, dates, events, or relationships)."
  - Allow user to rephrase or add more detail

- What happens when a user tries to commit data with validation errors (e.g., invalid email format)?
  - Highlight the specific field with the validation error
  - Display inline error message explaining the issue
  - Prevent commit until all fields pass validation

- What happens when the user closes the browser with uncommitted chained inputs?
  - Store chained input state in browser localStorage
  - On page reload, offer to restore the previous session: "You have uncommitted inputs from your last session. Restore them?"

- What happens when displaying a table with 10,000+ records?
  - Load all records into local IndexedDB cache during initial sync
  - Use client-side pagination against local cache (50 records per page)
  - Display total count and current range: "Showing 1-50 of 10,234"
  - Implement virtual scrolling for smoother performance

- What happens when the user is offline and tries to submit natural language input?
  - Queue the input locally in IndexedDB
  - Display message: "You're offline. This input will be processed when connection is restored."
  - Show queued inputs with "Pending sync" status
  - Process queue automatically when connection detected

- What happens when sync conflicts occur (same record modified on server and locally)?
  - Apply last-write-wins strategy (server timestamp compared to local timestamp)
  - Server version immediately displayed in UI (optimistic update)
  - Overwritten local changes saved to Conflict Log with full details
  - Display notification: "Conflict detected for [Entity/Intel]. Server version kept. Your changes saved to Conflict Review."
  - User can navigate to Conflict Review page to see all conflicts and manually re-apply important changes

- What happens when an entity has 20+ identifiers?
  - Show first 5 identifiers by default
  - Add "Show all (20)" expandable link
  - Group identifiers by type (emails, phones, names)

- What happens when IndexedDB storage quota is reached?
  - Automatically evict oldest synced records using LRU strategy when quota exceeds 80%
  - Never evict unsynced changes or conflict log entries (data integrity priority)
  - Display subtle notification: "Local cache trimmed to manage storage. Older records re-sync on demand."
  - Evicted records re-fetch from server if user navigates to them
  - Track access patterns to intelligently keep frequently accessed data

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replicate all six database tables (entities, intel, relations, identifiers, sources, intel_entities) to local browser storage (IndexedDB) and display them in separate, navigable views
- **FR-002**: System MUST support pagination for tables with more than 50 records, with configurable page size, reading from local cache for instant performance
- **FR-003**: System MUST provide a dedicated Natural Language Input page with a text area for user input and a visible processing queue showing all inputs with their status (pending, processing, completed, failed), queue position, and cancel option
- **FR-004**: System MUST queue natural language inputs and process them sequentially through the LLM extraction service (next input waits for previous extraction to complete), displaying structured extraction results
- **FR-005**: System MUST display each extracted piece of data (entity, relation, intel) as an editable row with fields matching the database schema, stored locally until synced
- **FR-006**: Users MUST be able to perform three actions on each extracted row: Accept (use as-is), Edit (modify fields), or Reject (exclude from sync)
- **FR-007**: System MUST support chaining multiple natural language inputs before syncing, maintaining extraction context across inputs via sequential processing
- **FR-008**: System MUST allow users to cancel queued inputs (pending status) or remove specific chained inputs without affecting others in the queue
- **FR-027**: System MUST display estimated processing time for each queued natural language input based on average extraction duration and queue position
- **FR-009**: System MUST queue accepted and edited data for sync to the server database, with local optimistic updates applied immediately
- **FR-010**: System MUST display sync status (pending, syncing, synced, error) for all queued changes with details of what was created/updated
- **FR-011**: System MUST require user authentication via Supabase Auth before accessing any data views or input pages
- **FR-012**: System MUST apply Row Level Security (RLS) so users only see data they own or have permission to access
- **FR-013**: System MUST validate all edited fields against database constraints (e.g., entity type must be person/organization/group/vehicle/location)
- **FR-014**: System MUST handle LLM service errors gracefully with user-friendly error messages, retry options, and maintain queue position for failed extractions
- **FR-015**: System MUST preserve user input text if extraction fails, allowing correction without re-typing, stored in local queue
- **FR-016**: System MUST support filtering entities by type, intel by confidence level and date range, and relations by relationship type, executing filters against local IndexedDB cache
- **FR-017**: System MUST support text search across visible fields in each table view, searching local cache for instant results
- **FR-018**: System MUST display entity relationships visually showing source, target, type, and strength (1-10), loaded from local cache
- **FR-019**: System MUST show identifiers grouped by type (name, email, phone, etc.) when displaying entity details, from local cache
- **FR-020**: System MUST preserve uncommitted chained inputs and unsynced changes in IndexedDB (not just localStorage) and offer session restoration on page reload
- **FR-021**: System MUST display sync status indicator showing: connected/offline, pending changes count, last sync timestamp, and active sync progress
- **FR-022**: System MUST synchronize local database changes bidirectionally with Supabase (local writes queued for upload, server changes downloaded and merged), using progressive background sync that does not block user interaction
- **FR-026**: System MUST allow immediate application access using cached data while initial sync runs in background, displaying sync progress indicator and updating UI incrementally as new records arrive
- **FR-023**: System MUST handle sync conflicts using last-write-wins strategy with user notification when conflicts are detected, saving overwritten local changes to a conflict log for review and potential recovery
- **FR-025**: System MUST provide a Conflict Review page showing all conflicts with: timestamp, affected record, server version, local version (overwritten), and option to manually re-apply local changes
- **FR-024**: System MUST allow users to work completely offline with all data viewing and natural language input features functional, syncing automatically when connection restored
- **FR-028**: System MUST monitor IndexedDB storage quota and automatically evict oldest successfully synced records when quota exceeds 80%, using LRU (Least Recently Used) cache strategy while preserving all unsynced changes and recent data
- **FR-029**: System MUST never evict unsynced changes from IndexedDB regardless of storage quota, prioritizing data integrity over cache size
- **FR-030**: System MUST implement Instant Local Commit pattern - immediately update UI and save changes to IndexedDB on user action without waiting for network, ensuring instant feedback
- **FR-031**: System MUST wrap each user action in a transaction object and place it in an ordered outbox queue, allowing multiple changes to accumulate safely even when offline
- **FR-032**: System MUST implement Upstream Sync - background process detects network availability and sends queued transactions to Supabase via GraphQL mutations to update the central database
- **FR-033**: System MUST implement Downstream Broadcast - server generates lightweight delta packets containing only diffs and pushes them via WebSocket (Supabase Realtime) to all connected clients
- **FR-034**: System MUST implement Confirmation Loop - client receives WebSocket delta messages, acknowledges that its local queued action was successful, and reconciles any potential conflicts with server state using last-write-wins strategy

### Key Entities *(include if feature involves data)*

- **Entity**: Represents a person, organization, group, vehicle, or location. Has multiple identifiers and participates in relations and intel records. Core attribute is type.

- **Identifier**: A piece of identifying information for an entity (name, email, phone, address, etc.). One entity can have many identifiers of different types.

- **Relation**: A relationship between two entities with a type (parent, colleague, friend, etc.), optional strength rating (1-10), and temporal validity dates.

- **Intel**: An intelligence record representing an event, communication, sighting, report, document, media, or financial transaction. Has an occurrence time, confidence level, and links to entities.

- **Source**: A data source with a code, type, and reliability rating (A-F from completely reliable to cannot be judged). Intel records reference sources.

- **Intel_Entities**: Junction connecting intel records to entities with an optional role (subject, witness, source).

- **Extraction Result**: Temporary frontend entity representing LLM-extracted data before database commit. Contains entity, relation, or intel data with user action state (pending, accepted, edited, rejected).

- **Chained Input Session**: Temporary frontend entity representing multiple related natural language inputs and their cumulative extraction results, maintained until user commits or discards.

- **Sync Queue**: Local-first infrastructure entity tracking pending database operations (creates, updates, deletes) waiting to sync to Supabase. Contains operation type, affected table, record data, timestamp, retry count, and sync status (pending, in-progress, failed, synced).

- **Local Cache**: IndexedDB-backed replica of Supabase tables (entities, intel, relations, identifiers, sources, intel_entities) enabling instant reads and offline operation. Tracks last sync timestamp and last accessed timestamp per record for LRU eviction. Manages storage quota automatically by evicting oldest synced records when space needed.

- **Conflict Log Entry**: Record of a sync conflict containing: conflict timestamp, affected table and record ID, server version (winner), local version (overwritten), resolution status (pending review, manually resolved, dismissed), and user notes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all existing intelligence data within 3 clicks from login (dashboard → table selection → data display)
- **SC-002**: Natural language input processing completes within 5 seconds for inputs under 500 characters
- **SC-003**: 90% of users successfully extract and commit data from natural language on their first attempt without training
- **SC-004**: Users can chain 3+ related inputs and commit all data together without losing context
- **SC-005**: Data entry time reduces by 70% compared to manual form filling (measured as time from input start to database commit)
- **SC-006**: Pagination loads new table pages instantly (under 100ms) from local cache for tables with up to 10,000 records
- **SC-007**: Search and filter operations return results instantly (under 200ms) from local IndexedDB cache
- **SC-011**: Application remains fully functional offline with 100% of data viewing and natural language input features operational
- **SC-012**: Sync to server completes within 10 seconds for batches of up to 50 pending changes when connection restored
- **SC-013**: Application becomes interactive within 2 seconds of page load, even during initial sync of large datasets
- **SC-014**: Background sync updates UI incrementally without disrupting user's current task or view
- **SC-015**: Storage quota management operates transparently with zero user intervention required, maintaining seamless operation even when cache exceeds browser limits
- **SC-008**: 95% of extraction edit operations (field modification) complete successfully on first save attempt
- **SC-009**: Zero data loss for uncommitted chained inputs when browser crashes or user accidentally closes tab (session restoration)
- **SC-010**: Users can identify and correct LLM extraction errors in under 30 seconds per error through the edit interface

## Assumptions

- The LLM extraction service (`llm-service`) is already deployed and accessible at a known endpoint (configured via environment variable)
- Users are authenticated via Supabase Auth and have valid JWT tokens
- The database schema (entities, intel, relations, identifiers, sources, intel_entities) is already created via migrations
- Row Level Security (RLS) policies are already configured to restrict data access by user_id
- Supabase Realtime is enabled for change notifications to support bidirectional sync
- The LLM extraction service returns JSON matching the Pydantic schema (entities, relations, intel, classification, chain_of_thought)
- Browser IndexedDB is available with sufficient storage quota (minimum 50MB recommended for local cache)
- The frontend framework (React + TypeScript + Vite) is already initialized
- Users have modern browsers with JavaScript enabled and IndexedDB support (Chrome, Firefox, Safari, Edge - latest 2 versions)
- The LLM extraction service handles entity resolution (deduplication) - frontend displays whatever the backend returns
- Default page size for tables is 50 records unless user changes it
- Chained inputs preserve context through sequential processing - each input waits for previous extraction to complete before sending next
- Natural language inputs can be queued locally and processed when LLM service becomes available (offline queueing)
- Confidence levels from LLM extraction (confirmed, high, medium, low, unconfirmed) map directly to database enum values
- Entity types from LLM extraction (person, organization, group, vehicle, location) are already supported by the database schema
- Users accessing the application have permission to create new entities, intel, and relations in the database (enforced by RLS policies)
- Sync conflicts are rare enough that last-write-wins strategy is acceptable (no complex CRDT merge required)
- Initial sync can complete within 30 seconds for databases with up to 10,000 total records across all tables
- Users understand eventual consistency model - local changes appear instantly but may take seconds to sync to server
- Browser IndexedDB quota is at least 50MB, with automatic LRU eviction managing space when needed
- Evicted records can be re-fetched from Supabase on demand if user navigates to them after eviction
- Access patterns are relatively consistent - frequently accessed records stay hot in cache, rarely accessed records naturally evict
