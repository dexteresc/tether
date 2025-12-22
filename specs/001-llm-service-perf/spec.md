# Feature Specification: Improve Consistency and Performance of LLM Service

**Feature Branch**: `001-llm-service-perf`  
**Created**: 2025-12-22  
**Status**: Draft  
**Input**: User description: "improve consistency and performance of llm service. I want all tests passing with a below 2 minute time for all tests to run"

## Clarifications

### Session 2025-12-22
- Q: Model Selection Strategy? → A: Use the same local model for both production and testing (do not switch to a different lightweight model for tests).
- Q: Test Execution Strategy? → A: Record & Replay (VCR) - Use cached cassettes of the real local model to ensure speed and 100% consistency in standard test runs.
- Q: Consistency Strategy for Instructor? → A: Validation Retries - Enable Instructor's `max_retries` to automatically handle and self-correct Pydantic validation failures from the local model.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rapid Test Feedback (Priority: P1)

As a developer, I want the entire test suite for the LLM service to run in under 2 minutes so that I can iterate quickly without breaking flow.

**Why this priority**: Fast feedback loops are essential for productivity and maintaining code quality. Long running tests discourage frequent testing.

**Independent Test**: Run the full test suite command and measure the total execution time.

**Acceptance Scenarios**:

1. **Given** the codebase is in a stable state, **When** I run the full test suite, **Then** all tests pass.
2. **Given** the test suite is triggered, **When** execution completes, **Then** the total elapsed time is less than 2 minutes.

---

### User Story 2 - Reliable Test Execution (Priority: P1)

As a developer, I want the tests to pass consistently every time I run them, assuming the code hasn't changed, so that I don't waste time investigating false positives (flaky tests).

**Why this priority**: Flaky tests erode trust in the test suite and hide real bugs.

**Independent Test**: Run the test suite multiple times in succession (e.g., 5 times) without changes.

**Acceptance Scenarios**:

1. **Given** a passing test suite, **When** I run it 5 times in a row, **Then** it passes 100% of the time with no failures.
2. **Given** tests that rely on LLM outputs, **When** they are executed, **Then** they handle non-deterministic behavior gracefully (e.g., via mocking or robust assertions) to ensure consistency.

### Edge Cases

- What happens when an external LLM provider is down or slow? (Tests should ideally be isolated from this for speed/consistency).
- How does the system handle network latency during testing?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST support running all unit and integration tests for the LLM service.
- **FR-002**: The test execution MUST be optimized to complete all tests in under 2 minutes on standard development hardware.
- **FR-003**: The testing infrastructure MUST provide mechanisms (e.g., mocking, recording, or deterministic configuration) to eliminate dependency on live, variable external LLM API calls during standard test runs.
- **FR-004**: The extraction service MUST allow configuration for deterministic outputs where possible (e.g., setting temperature to 0, using fixed seeds if supported) to aid consistency.
- **FR-005**: Test assertions MUST be robust enough to handle acceptable variations in LLM text generation while correctly identifying semantic failures.
- **FR-006**: The system MUST use the same local model configuration for both production execution and testing (no separate test-only models).
- **FR-007**: The extraction service MUST utilize Instructor's self-correction mechanism with a configurable number of retries (e.g., `max_retries=3`) to ensure high reliability in structured data extraction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Total execution time for the full LLM service test suite is strictly less than 2 minutes.
- **SC-002**: 100% of tests pass across 5 consecutive executions on the same commit (zero flakiness).
- **SC-003**: 100% of external API calls in the standard test suite are mocked or stubbed to ensure isolation and speed.
