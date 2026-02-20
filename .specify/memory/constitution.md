<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0
- Type: MINOR (New principle added: Test-Driven Development)
- Principles modified:
  - Added: VI. Test-Driven Development (TDD)
  - Existing principles I-V unchanged
- Added sections: Principle VI with TDD requirements and rationale
- Removed sections: None
- Templates status:
  - ✅ plan-template.md: Updated Constitution Check section to include TDD requirement
  - ✅ tasks-template.md: Updated to mandate tests-first approach across all user stories
  - ✅ spec-template.md: No constitution-specific constraints required
- Follow-up: None - all templates updated to reflect TDD mandate
-->

# Tether Constitution

## Core Principles

### I. Type-First Development

Every component MUST use strict type checking. Python code requires Pydantic models for data validation and type hints for all function signatures. TypeScript code requires strict mode enabled. Go code follows standard library type conventions. No implicit type coercion or untyped data structures permitted in production code.

**Rationale**: Type safety prevents runtime errors in intelligence extraction where incorrect data types could corrupt the knowledge graph. The LLM service demonstrates this - Pydantic validates every extraction before database sync, preventing malformed entities from entering the system.

### II. Minimal Dependencies

Prefer standard library and established frameworks over third-party utilities. New dependencies require explicit justification. Dependencies MUST be pinned to specific versions in requirements files.

**Rationale**: The project already spans Python (FastAPI, Instructor), Go (stdlib), TypeScript (React, Vite), and Supabase. Each additional dependency increases maintenance burden and potential security vulnerabilities. The LLM service uses only essential packages: FastAPI for routing, Instructor for structured extraction, Pydantic for validation.

### III. Test Coverage for Critical Paths

Tests are MANDATORY for:
- LLM extraction logic and classification
- Database synchronization operations
- API contract endpoints
- Authentication and authorization flows

Tests use VCR cassettes for LLM interactions to ensure fast, deterministic test execution without requiring live LLM calls.

**Rationale**: Intelligence extraction is non-deterministic by nature. VCR cassettes enable fast regression testing (80 seconds for 20 tests) while maintaining confidence in extraction quality. Contract tests prevent breaking changes to API interfaces used by multiple services.

### IV. Clear Architecture Boundaries

Each service maintains clear separation:
- **llm-service/**: Python NLP extraction service (FastAPI + Instructor + Supabase)
- **frontend/**: React + TypeScript + Vite UI
- **handlers/**, **models/**, **services/**: Go backend API
- **supabase/**: Database migrations and RLS policies

Services communicate via well-defined API contracts. Database access follows Row Level Security (RLS) policies. No cross-service module imports permitted.

**Rationale**: Multi-language architecture requires strict boundaries to prevent coupling. The LLM service exposes REST endpoints consumed by the Go backend - they share only the database schema, not code. This enables independent deployment and technology choices per service.

### V. Configuration via Environment

All runtime configuration MUST use environment variables. No hardcoded URLs, API keys, or provider settings in code. Support for multiple deployment environments (development, staging, production) through .env files.

**Rationale**: The LLM service switches between OpenAI and Ollama providers purely through LLM_PROVIDER environment variable. This enables local development with Ollama (free, private) and production with OpenAI (faster, more capable) without code changes.

### VI. Test-Driven Development (TDD)

All new features and bug fixes MUST follow Test-Driven Development:
1. **Write tests FIRST** before implementation - tests must FAIL initially
2. **Implement minimum code** to make tests pass
3. **Refactor** while keeping tests green

Tests MUST:
- Cover all user stories and acceptance criteria
- Use descriptive test names that document expected behavior
- Be independent and able to run in any order
- Follow the Arrange-Act-Assert (AAA) pattern
- Use VCR cassettes for LLM interactions (deterministic, fast)

**Rationale**: TDD ensures code is testable by design and prevents over-engineering. Writing tests first clarifies requirements before implementation, reducing rework. For the LLM service, TDD with VCR cassettes caught extraction regressions early (80 seconds for 20 tests) and documented expected extraction behavior better than comments. Tests become living documentation of system behavior and acceptance criteria.

## Development Workflow

### Code Review Requirements

All changes MUST:
- Pass type checking (mypy for Python, tsc for TypeScript, go build for Go)
- Pass linting (ruff for Python, ESLint for TypeScript)
- Include tests for new critical paths (see Principle III)
- Update relevant spec.md and tasks.md in /specs/ directory

### Testing Gates

Before merging:
- Unit tests pass locally
- Integration tests pass against local Supabase instance
- VCR cassettes recorded for any new LLM interactions
- Contract tests validate API endpoint schemas

### Deployment Approval

Production deployments require:
- All tests passing in CI
- Database migrations reviewed and tested
- Environment variables documented in .env.example
- Feature specification complete in /specs/

## Security Requirements

### Authentication

All API endpoints requiring user context MUST:
- Accept Supabase JWT token via Authorization header
- Validate token using Supabase Auth
- Extract user_id from validated token
- Apply Row Level Security via user_id context

### Data Validation

User input MUST:
- Be validated using Pydantic schemas (Python) or type guards (TypeScript)
- Sanitize against SQL injection via parameterized queries
- Reject malformed requests with 400 Bad Request and clear error messages

### Environment Secrets

Secrets MUST:
- Never be committed to version control
- Be documented in .env.example with placeholder values
- Use SUPABASE_SERVICE_KEY only in backend services, never exposed to frontend
- Rotate regularly for production environments

## Governance

This constitution supersedes all other development practices. Changes to principles require:
1. Documented rationale for the change
2. Review of impact on existing specs and templates
3. Migration plan if existing code violates new principle

All code reviews MUST verify compliance with these principles. Violations require explicit justification or rejection of PR.

**Version**: 1.1.0 | **Ratified**: 2024-12-22 | **Last Amended**: 2025-12-24
