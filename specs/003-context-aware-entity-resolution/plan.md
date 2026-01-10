# Implementation Plan: Context-Aware Entity Resolution

**Branch**: `003-context-aware-entity-resolution` | **Date**: 2024-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-context-aware-entity-resolution/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable the LLM service to resolve person references in natural language by querying existing entities and identifiers in the database. When a user mentions "John ate a burger with Timmy," the system will query the database for existing persons matching "John" and "Timmy," automatically resolve unique matches, prompt for clarification when ambiguous, and link resolved entities to interaction logs. Uses exact matching, fuzzy matching (Jaro-Winkler: 80% for first names, 70% for last names), and contextual attribute matching (company, email) to achieve 95% resolution accuracy.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: FastAPI 0.109.0, Instructor 1.0.0, Supabase >=2.25.1, Pydantic (via FastAPI), RapidFuzz 3.14.3
**Storage**: PostgreSQL via Supabase (entities, identifiers, intel tables)
**Testing**: pytest 7.4.3, pytest-asyncio 0.21.1, vcrpy >=6.0.0 (for LLM mocking)
**Target Platform**: Linux server (LLM service component)
**Project Type**: Web application (extends existing llm-service)
**Performance Goals**: Entity resolution within 2 seconds for database queries with <1000 persons; LLM reasoning latency dependent on provider (2-5s typical)
**Constraints**: Must maintain existing single-input-at-a-time processing model; no batch operations initially; resolution confidence must be >80% to auto-resolve
**Scale/Scope**: Expected 100-10,000 person entities initially; support 2-4 person references per input; fuzzy matching algorithm must be O(n) or better for practical performance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with [Tether Constitution](../../.specify/memory/constitution.md):

- [x] **Type-First Development**: All components use strict type checking (Pydantic/TypeScript strict/Go stdlib types)
  - *Compliance*: Entity resolution models will use Pydantic for EntityResolutionResult, ResolutionContext. All fuzzy matching scores typed as float (0-1). Chain-of-thought reasoning typed as str.

- [x] **Minimal Dependencies**: New dependencies justified and pinned to specific versions
  - *Compliance*: Adding RapidFuzz==3.14.3 for fuzzy string matching. Justified: zero runtime dependencies, best-in-class performance, Jaro-Winkler support. Pinned to specific version per constitution.

- [x] **Test Coverage**: Critical paths have tests (LLM extraction, DB sync, API contracts, auth flows)
  - *Compliance*: Will add tests for: exact matching, fuzzy matching thresholds, ambiguity detection, multi-person resolution, contextual disambiguation. Use VCR cassettes for LLM interactions.

- [x] **Architecture Boundaries**: No cross-service imports, services communicate via API contracts
  - *Compliance*: All changes within llm-service/ directory. Database queries via existing Supabase client. No new cross-service dependencies.

- [x] **Environment Configuration**: All runtime config uses environment variables, no hardcoded secrets
  - *Compliance*: Fuzzy matching thresholds configurable via environment (default: FUZZY_MATCH_FIRST_NAME_THRESHOLD=0.8, FUZZY_MATCH_LAST_NAME_THRESHOLD=0.7). No new secrets required.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
llm-service/
├── app/
│   ├── models/
│   │   └── resolution.py          # NEW: EntityResolutionResult, ResolutionContext Pydantic models
│   ├── services/
│   │   ├── entity_resolver.py     # NEW: Core entity resolution logic
│   │   └── extraction.py          # MODIFY: Integrate entity resolution into extraction flow
│   ├── utils/
│   │   └── entity_matcher.py      # EXISTING: May need enhancement for fuzzy matching
│   └── routes/
│       └── extract.py             # MODIFY: Update response models to include resolution metadata
└── tests/
    ├── unit/
    │   └── test_entity_resolver.py  # NEW: Unit tests for resolution logic
    ├── integration/
    │   └── test_resolution_flow.py  # NEW: End-to-end resolution tests with DB
    └── cassettes/                  # NEW: VCR cassettes for entity resolution LLM calls
```

**Structure Decision**: Web application (Option 2). This feature extends the existing llm-service backend component. All changes are isolated to the llm-service/ directory, maintaining clear architecture boundaries per Constitution Principle IV. No frontend changes required initially (clarification prompts will be API responses, frontend integration is future work).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All constitution principles are satisfied or pending research completion (fuzzy matching library selection).
