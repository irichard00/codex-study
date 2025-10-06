# Implementation Plan: Align codex-chrome Model Client with codex-rs

**Branch**: `013-codex-chrome-is` | **Date**: 2025-10-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/rich/dev/study/codex-study/specs/013-codex-chrome-is/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ Project Type detected: Chrome Extension (browser-based)
   → ✅ Structure Decision: Single project with Chrome extension structure
3. Fill the Constitution Check section
   → Constitution file is template - no specific constraints to check
4. Evaluate Constitution Check section
   → No violations detected
   → Progress updated: Initial Constitution Check ✅
5. Execute Phase 0 → research.md
   → Resolving technical unknowns for Rust-to-TypeScript port
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check section
   → Post-design check pending
   → Progress updated: Post-Design Constitution Check pending
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
This feature aligns the codex-chrome browser extension's model client implementation with the original codex-rs Rust codebase. The primary goal is to ensure 1:1 consistency in method names, signatures, data structures, and execution flow while adapting for the browser environment constraints (fetch API, ReadableStream, API key auth). The TypeScript implementation in `codex-chrome/src/models` is refactored to match `codex-rs/core/src/client.rs` exactly, with special consideration for:

1. **Naming alignment**: All methods and types renamed to match Rust exactly (e.g., `getModelContextWindow()`, snake_case fields)
2. **Signature alignment**: Method parameters and return types mirror Rust (including Promise wrappers for async)
3. **Flow alignment**: SSE event ordering, retry logic, and error handling match Rust implementation line-by-line
4. **Browser adaptations**: Uses fetch(), ReadableStream, and API key auth instead of reqwest and OAuth
5. **Extensibility**: Abstract ModelClient base enables future Gemini/Claude clients
6. **Legacy removal**: All non-Rust-equivalent code removed (no backward compatibility)

## Technical Context
**Language/Version**: TypeScript 5.2+, targeting ES2020 for Chrome extension environment
**Primary Dependencies**: None (browser APIs only - fetch, ReadableStream, TextDecoder)
**Storage**: Chrome Storage API for API keys (separate from model client implementation)
**Testing**: Vitest with DOM environment, contract tests matching Rust test structure
**Target Platform**: Chrome Extension (Manifest V3), browser environment
**Project Type**: single - Chrome extension with specialized structure
**Performance Goals**: <10ms SSE event processing, <200ms stream initialization
**Constraints**: No Node.js APIs (no http/https modules, no Node streams), API key auth only (no OAuth)
**Scale/Scope**: 20+ files in codex-chrome/src/models/, ~40 functional requirements, OpenAI API primary (extensible to Gemini/Claude)

**User-Provided Implementation Context**:
- Source comparison: `codex-rs/core/src/client.rs` (Rust) → `codex-chrome/src/models` (TypeScript)
- Alignment requirements: Same method names, inputs/outputs, struct names, execution flow
- Browser constraints: Chrome execution environment, API key authentication
- Current support: OpenAI API enabled
- SSE streaming required
- Extensible design for future LLMs (Gemini, Claude)
- No backward compatibility - remove all legacy code

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project uses a constitution template without specific constraints filled in. Proceeding with standard best practices:
- ✅ **Test-First**: All contract tests written before implementation
- ✅ **Simplicity**: Direct port from Rust without unnecessary abstractions
- ✅ **Browser-First**: Uses native browser APIs (fetch, ReadableStream)
- ✅ **Extensibility**: Abstract base class supports multiple providers

## Project Structure

### Documentation (this feature)
```
specs/013-codex-chrome-is/
├── spec.md              # Feature specification
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── ModelClient.contract.ts
│   ├── ResponseStream.contract.ts
│   └── SSEEventParser.contract.ts
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── models/                      # Model client implementation (REFACTOR TARGET)
│   │   ├── ModelClient.ts           # Abstract base class (align with Rust)
│   │   ├── OpenAIResponsesClient.ts # OpenAI Responses API client
│   │   ├── OpenAIClient.ts          # OpenAI Chat Completions client
│   │   ├── ResponseStream.ts        # Stream wrapper (align with Rust)
│   │   ├── SSEEventParser.ts        # SSE parsing logic
│   │   ├── types/
│   │   │   ├── ResponseEvent.ts     # Event union type (align with Rust)
│   │   │   ├── ResponsesAPI.ts      # API types (align with Rust)
│   │   │   ├── RateLimits.ts        # Rate limit types
│   │   │   ├── TokenUsage.ts        # Token usage types (snake_case fields)
│   │   │   ├── StreamAttemptError.ts # Error enum (align with Rust)
│   │   │   └── index.ts
│   │   ├── ModelClientError.ts      # Error class
│   │   ├── ChromeAuthManager.ts     # Browser-specific auth (API keys)
│   │   ├── ModelClientFactory.ts    # Factory for creating clients
│   │   └── __tests__/               # Test files (restructure to match Rust)
│   ├── background/                  # Extension background scripts
│   ├── content/                     # Content scripts
│   ├── sidepanel/                   # UI components
│   └── tools/                       # Tool definitions
├── tests/
│   ├── contract/                    # Contract tests (NEW)
│   │   ├── ModelClient.contract.test.ts
│   │   ├── ResponseStream.contract.test.ts
│   │   └── SSEEventParser.contract.test.ts
│   ├── integration/                 # Integration tests
│   └── unit/                        # Unit tests
└── dist/                            # Build output

codex-rs/                            # Reference implementation
└── core/src/client.rs               # Source of truth for alignment
```

**Structure Decision**: Single Chrome extension project. The `codex-chrome/src/models` directory contains all model client code that needs Rust alignment. Reference Rust code is in `codex-rs/core/src/client.rs`. Tests are reorganized into contract/integration/unit structure matching Rust test patterns.

## Phase 0: Outline & Research

**Research Tasks**:
1. **Rust-to-TypeScript Type Mapping**
   - Decision: How to map Rust types to TypeScript
   - Research: `Result<T>` → `Promise<T>` (throws on error), `Option<T>` → `T | undefined`, enums → union types
   - Alternatives: Result type library (rejected - adds dependency)

2. **Browser API Equivalents**
   - Decision: Map Rust async/networking to browser APIs
   - Research: `reqwest` → `fetch()`, Rust async streams → `ReadableStream`, `tokio::mpsc` → Promise-based event emitter
   - Alternatives: Node.js streams (rejected - not available in browser)

3. **SSE Parsing in Browser**
   - Decision: How to parse SSE without EventSource API (need custom headers)
   - Research: Manual ReadableStream parsing with TextDecoder, line-by-line event extraction
   - Alternatives: EventSource API (rejected - can't set custom headers like OpenAI-Beta)

4. **Test Structure Alignment**
   - Decision: How to structure tests to match Rust's test organization
   - Research: Vitest contract tests, integration tests, match Rust's `#[cfg(test)]` mod structure
   - Alternatives: Keep existing test structure (rejected - requirement is alignment)

5. **Method Naming Conventions**
   - Decision: Exact naming match or TypeScript conventions
   - Research: Use exact Rust names (snake_case for data, camelCase for methods matching Rust's public API)
   - Alternatives: Full TypeScript conventions (rejected - requirement is consistency)

6. **Legacy Code Identification**
   - Decision: What constitutes "legacy code" to remove
   - Research: Any code without Rust equivalent in client.rs (AnthropicClient, custom retry logic variations, RequestQueue if not in Rust)
   - Alternatives: Keep for backward compatibility (rejected - explicit requirement to remove)

**Output**: research.md with all decisions documented

## Phase 1: Design & Contracts

### Step 1: Extract entities → data-model.md

**Core Entities** (from spec Key Entities section):

1. **ModelClient** (abstract base)
   - Fields: provider, retryConfig, conversationId
   - Methods: stream(), getModelContextWindow(), getAutoCompactTokenLimit(), getModelFamily(), getProvider(), getReasoningEffort(), getReasoningSummary()
   - Validation: Abstract class, cannot be instantiated directly
   - State: Immutable after construction

2. **OpenAIResponsesClient** (concrete implementation)
   - Fields: apiKey, baseUrl, organization, modelFamily, reasoningEffort, reasoningSummary, modelVerbosity
   - Methods: stream(), attemptStreamResponses(), processSSE(), parseRateLimitSnapshot()
   - Validation: API key required (non-empty string)
   - State: Configuration immutable, streams created per request

3. **ResponseStream**
   - Fields: events queue (internal), completion state
   - Methods: [Symbol.asyncIterator](), addEvent(), complete(), error()
   - Validation: Can only complete once
   - State Transitions: open → (adding events) → (completed | errored)

4. **ResponseEvent** (union type)
   - Variants: Created | OutputItemDone | OutputTextDelta | ReasoningSummaryDelta | ReasoningContentDelta | Completed | RateLimits | WebSearchCallBegin | ReasoningSummaryPartAdded
   - Fields: Variant-specific (type discriminator + payload)
   - Validation: Type field must match variant schema

5. **Prompt**
   - Fields: input (ResponseItem[]), tools (ToolDefinition[]), baseInstructionsOverride?, outputSchema?
   - Validation: input array must not be empty
   - Relationships: Used as input to stream() method

6. **ModelProviderInfo**
   - Fields: name, baseUrl, envKey, wireApi, requestMaxRetries, streamIdleTimeoutMs
   - Validation: wireApi must be "Responses" or "Chat"
   - Relationships: Configuration for ModelClient

7. **RateLimitSnapshot**
   - Fields: primary (RateLimitWindow?), secondary (RateLimitWindow?)
   - Sub-entity RateLimitWindow: used_percent, window_minutes?, resets_in_seconds?
   - Validation: At least one window must be present
   - Relationships: Extracted from HTTP headers, emitted as ResponseEvent

8. **TokenUsage**
   - Fields: input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, total_tokens
   - Validation: All fields must be non-negative integers
   - Relationships: Included in Completed event

9. **StreamAttemptError** (union type)
   - Variants: RetryableHttpError | RetryableTransportError | Fatal
   - Fields: Variant-specific error details, retry delay
   - Validation: Status codes determine retryability
   - Relationships: Internal error handling in stream retry logic

### Step 2: Generate API contracts → /contracts/

**Contract Files**:

1. **ModelClient.contract.ts**
   - Interface: Abstract class methods
   - Test cases:
     - stream() accepts Prompt, returns Promise<ResponseStream>
     - getModelContextWindow() returns number | undefined
     - getAutoCompactTokenLimit() returns number | undefined
     - getModelFamily() returns ModelFamily object
     - getProvider() returns ModelProviderInfo
     - Abstract methods must be implemented by subclasses

2. **ResponseStream.contract.ts**
   - Interface: Async iterable that yields ResponseEvent
   - Test cases:
     - Implements AsyncIterable<ResponseEvent>
     - Events yielded in order: RateLimits (optional) → stream events → Completed
     - Can be consumed with for-await-of loop
     - Error propagation works correctly

3. **OpenAIResponsesClient.contract.ts**
   - Interface: Concrete ModelClient implementation
   - Test cases:
     - Constructor validates API key (throws if empty)
     - stream() makes HTTP request with correct headers
     - attemptStreamResponses() handles retry logic
     - processSSE() parses events correctly
     - parseRateLimitSnapshot() extracts rate limits from headers
     - Matches Rust client.rs behavior line-by-line

4. **SSEEventParser.contract.ts**
   - Interface: Parse SSE event strings
   - Test cases:
     - Parses "data: {json}\n\n" format
     - Handles [DONE] termination signal
     - Processes all event types from FR-018
     - Matches Rust SSE processing logic

### Step 3: Generate contract tests

Contract tests created in `tests/contract/` directory, failing initially (TDD):
- `ModelClient.contract.test.ts`: Tests abstract interface
- `ResponseStream.contract.test.ts`: Tests streaming behavior
- `OpenAIResponsesClient.contract.test.ts`: Tests OpenAI implementation
- `SSEEventParser.contract.test.ts`: Tests SSE parsing

### Step 4: Extract test scenarios → quickstart.md

From spec User Scenarios:
1. **Scenario 1**: API key authentication & streaming
   - Setup: Configure API key
   - Action: Initiate streaming request
   - Expected: ResponseStream yields events

2. **Scenario 2**: Rate limit retry
   - Setup: Configure client
   - Action: Trigger 429 error
   - Expected: Auto-retry after delay

3. **Scenario 3**: SSE event processing
   - Setup: Start stream
   - Action: Receive SSE events
   - Expected: Events emitted in real-time

4. **Scenario 4**: Provider extensibility
   - Setup: Create custom provider client
   - Action: Use same interface
   - Expected: No calling code changes

5. **Scenario 5**: Model capability queries
   - Setup: Initialize client
   - Action: Query context window
   - Expected: Correct value returned

### Step 5: Update CLAUDE.md

Running update script:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

Updates will include:
- New TypeScript + Chrome Extension context
- Rust alignment requirements
- SSE streaming with fetch/ReadableStream
- Test structure (contract/integration/unit)
- Keep under 150 lines

**Output**: data-model.md, contracts/, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base
2. Generate from Phase 1 artifacts:
   - Each contract → contract test task [P]
   - Each entity in data-model.md → type definition task [P]
   - Each method in ModelClient → implementation task
   - Each user scenario → integration test task
3. Add refactoring tasks:
   - Rename methods (FR-001)
   - Convert field names to snake_case (FR-002)
   - Align error types (FR-003)
   - Remove legacy code (FR-025, FR-026, FR-027)

**Ordering Strategy**:
1. **Setup Phase** (tasks 1-5):
   - Read Rust reference implementation
   - Document naming mappings
   - Identify legacy code to remove
   - Update type definitions (snake_case fields)
   - Setup contract test infrastructure

2. **Type System Phase** (tasks 6-15) [P]:
   - Define ResponseEvent union type
   - Define ResponsesAPI types
   - Define RateLimitSnapshot types
   - Define TokenUsage types
   - Define StreamAttemptError enum
   - Define Prompt types
   - Define ModelProviderInfo types
   - Define ModelFamily types
   - Update all imports
   - Remove deprecated types

3. **Contract Test Phase** (tasks 16-20) [P]:
   - Write ModelClient contract tests
   - Write ResponseStream contract tests
   - Write OpenAIResponsesClient contract tests
   - Write SSEEventParser contract tests
   - Verify all tests fail (TDD checkpoint)

4. **Core Implementation Phase** (tasks 21-35):
   - Refactor ModelClient base class (method names, signatures)
   - Implement getModelContextWindow() (FR-007)
   - Implement getAutoCompactTokenLimit() (FR-008)
   - Implement getModelFamily()
   - Refactor ResponseStream (event ordering FR-010)
   - Refactor OpenAIResponsesClient.stream() (FR-004, FR-009)
   - Refactor attemptStreamResponses() (FR-005)
   - Implement retry logic (FR-011, FR-033-035)
   - Refactor processSSE() (FR-010, FR-017-020)
   - Implement parseRateLimitSnapshot() (FR-006, FR-039)
   - Handle response.failed events (FR-012, FR-036)
   - Update SSEEventParser (FR-018)
   - Implement browser-specific auth (FR-013-016)
   - Remove OAuth/token refresh code (FR-014)
   - Run contract tests (expect pass)

5. **Legacy Removal Phase** (tasks 36-40) [P]:
   - Remove AnthropicClient (if no Rust equivalent)
   - Remove deprecated method aliases
   - Remove custom retry logic variations
   - Remove RequestQueue (if not in Rust)
   - Remove any other non-Rust code

6. **Integration Test Phase** (tasks 41-45):
   - Write user scenario 1 integration test (API key + streaming)
   - Write user scenario 2 integration test (rate limit retry)
   - Write user scenario 3 integration test (SSE processing)
   - Write user scenario 4 integration test (extensibility)
   - Write user scenario 5 integration test (capability queries)

7. **Validation Phase** (tasks 46-50):
   - Run all contract tests
   - Run all integration tests
   - Run existing unit tests (verify no regressions)
   - Compare with Rust implementation (line-by-line review)
   - Update documentation

**Estimated Output**: 50 numbered, ordered tasks in tasks.md

**Parallelization**: Tasks marked [P] are independent and can run in parallel within their phase.

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (run tests, execute quickstart.md, verify Rust alignment)

## Complexity Tracking
*No constitution violations - this section intentionally empty*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [x] Phase 3: Tasks generated (/tasks command) ✅
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (no specific constraints)
- [x] Post-Design Constitution Check: PASS (design follows TDD, browser-first, simplicity)
- [x] All NEEDS CLARIFICATION resolved (addressed by user input)
- [x] Complexity deviations documented (none)

**Generated Artifacts**:
- [x] research.md - Rust-to-TypeScript mapping decisions
- [x] data-model.md - Entity definitions aligned with Rust
- [x] contracts/ModelClient.contract.ts - Abstract base interface
- [x] contracts/ResponseStream.contract.ts - Stream iteration contract
- [x] contracts/OpenAIResponsesClient.contract.ts - OpenAI implementation contract
- [x] contracts/SSEEventParser.contract.ts - SSE parsing contract
- [x] quickstart.md - Integration test scenarios
- [x] CLAUDE.md - Updated with Rust alignment context
- [x] tasks.md - 70 implementation tasks with dependencies

---
**Status**: Phase 0-3 complete ✅ | Ready for implementation (Phase 4)
