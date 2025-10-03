# Implementation Plan: Align codex-chrome Model Client with Rust Implementation

**Branch**: `010-refactor-the-codex` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-refactor-the-codex/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Project Type: single (Chrome extension)
   → Structure Decision: Chrome extension with TypeScript + Vite build
3. Fill the Constitution Check section ✓
   → Constitution template is default/empty - no specific violations
4. Evaluate Constitution Check section ✓
   → No violations - proceeding
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md ✓
   → All technical decisions resolved from Rust source code
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
7. Re-evaluate Constitution Check section ✓
   → No new violations
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach ✓
9. STOP - Ready for /tasks command
```

## Summary

Refactor the codex-chrome TypeScript model client implementation to align with the original Rust implementation in codex-rs/core/src/client.rs. The primary goal is to achieve consistency in:
- Method names (Rust snake_case → TypeScript camelCase)
- Method signatures (inputs/outputs with proper type mappings)
- Type/struct names (preserve Rust naming)
- Execution flow (match Rust's stream() → ResponseStream pattern)

Key technical differences to accommodate:
- Browser environment (no file I/O, different HTTP client)
- Chrome extension context (different auth mechanisms)
- TypeScript type system vs Rust (Promise vs Result, undefined vs Option)

## Technical Context

**Language/Version**: TypeScript 5.x (ESNext target for Chrome extension)
**Primary Dependencies**: Chrome Extension APIs, Vite (build), Vitest (testing), Svelte 4.x (UI)
**Storage**: Chrome Storage API (for auth tokens/config), in-memory state
**Testing**: Vitest with contract tests, integration tests, SSE parsing tests
**Target Platform**: Chrome Browser Extension (Manifest V3), browser environment only
**Project Type**: single - Chrome extension with background worker, content scripts, side panel
**Performance Goals**:
- SSE event processing <10ms per event
- Stream initialization <200ms
- API request retry with exponential backoff <30s total
**Constraints**:
- Browser-only environment (no Node.js APIs)
- Chrome Extension security policies (CSP restrictions)
- Must support OpenAI Responses API with SSE
- API key authentication only (no OAuth in browser extension)
**Scale/Scope**:
- ~30 model client files to refactor
- 5-7 core method signatures to align
- ~15 type definitions to rename/restructure

**Specific Inconsistencies Identified**:
1. `stream()` returns `AsyncGenerator<StreamChunk>` in TS but should return `ResponseStream` wrapper matching Rust's `Result<ResponseStream>`
2. Method names don't follow Rust naming (e.g., missing `getModelContextWindow`, `getAutoCompactTokenLimit`)
3. Missing private helper methods from Rust (e.g., `parseRateLimitSnapshot`, `attemptStreamResponses`)
4. Type names inconsistent with Rust structs
5. Execution flow differs - Rust uses channel-based ResponseStream, TS uses direct async generators

**Extra Requirements**:
1. Chrome browser execution environment - no fs, different HTTP (fetch API)
2. API key authentication via Chrome Storage API
3. OpenAI Responses API as primary target
4. Extensible design for future LLMs (Gemini, Claude via factory pattern)
5. SSE support with proper event parsing and backpressure

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution file is in template form with no specific principles defined. Proceeding with standard best practices:
- Test-first development (contract tests before implementation)
- Browser-compatible implementation (no Node.js dependencies)
- Type safety (strict TypeScript)
- Performance monitoring (SSE processing metrics)

**Status**: ✅ PASS (no constitution violations - using defaults)

## Project Structure

### Documentation (this feature)
```
specs/010-refactor-the-codex/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── ModelClient.contract.md
│   ├── ResponseStream.contract.md
│   └── SSE.contract.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── models/
│   │   ├── ModelClient.ts              # Base class - align with Rust
│   │   ├── OpenAIResponsesClient.ts    # Responses API impl
│   │   ├── ResponseStream.ts           # Stream wrapper - align with Rust
│   │   ├── SSEEventParser.ts           # Process SSE events
│   │   ├── ModelClientFactory.ts       # Extensible factory
│   │   ├── types/
│   │   │   ├── ResponseEvent.ts        # Rust ResponseEvent enum
│   │   │   ├── TokenUsage.ts          # Rust TokenUsage struct
│   │   │   ├── RateLimits.ts          # Rust RateLimitSnapshot
│   │   │   ├── ResponsesAPI.ts        # Rust Prompt, etc.
│   │   │   └── StreamAttemptError.ts  # Rust StreamAttemptError enum
│   │   └── __tests__/
│   │       ├── ModelClient.contract.test.ts
│   │       ├── ResponseStream.test.ts
│   │       └── SSEEventParser.test.ts
│   ├── background/      # Chrome extension background worker
│   ├── content/         # Content scripts
│   └── sidepanel/       # Svelte UI
├── scripts/
│   └── build.js         # Vite build for Chrome extension
└── tests/
    ├── integration/     # End-to-end tests
    └── fixtures/        # SSE test fixtures

codex-rs/                # Reference implementation (READ-ONLY)
└── core/
    └── src/
        ├── client.rs           # Source of truth for ModelClient
        └── client_common.rs    # Prompt, ResponseEvent, ResponseStream
```

**Structure Decision**: Single Chrome extension project. The refactoring affects only the `codex-chrome/src/models/` directory. The Rust codebase in `codex-rs/` serves as read-only reference - we extract method signatures and flow patterns from it to guide the TypeScript refactoring.

## Phase 0: Outline & Research

### Research Completed

All technical decisions are derived from analyzing the Rust source code:

1. **Rust → TypeScript Type Mappings**:
   - Decision: Use established type mapping patterns
   - Rationale: Browser environment requires different primitives
   - Mappings:
     * `Option<T>` → `T | undefined`
     * `Result<T, E>` → `Promise<T>` (throw on error)
     * `Arc<T>` → direct reference (GC handles memory)
     * `mpsc::channel` → `ResponseStream` class with event buffer
     * `async fn` → `async` method
     * `impl Stream` → `AsyncGenerator` or `ResponseStream` wrapper

2. **ResponseStream Pattern**:
   - Decision: Implement ResponseStream as async iterable class
   - Rationale: Matches Rust's channel-based streaming while using JS idioms
   - Pattern:
     * `ResponseStream` class wraps event buffer
     * Implements `AsyncIterableIterator<ResponseEvent>`
     * Producer calls `addEvent()`, consumer uses `for await`
     * Maintains backpressure and timeout logic from Rust

3. **Method Name Alignment**:
   - Decision: Convert Rust snake_case to TypeScript camelCase
   - Rationale: Follow language conventions while preserving semantics
   - Examples:
     * `get_model()` → `getModel()`
     * `get_model_context_window()` → `getModelContextWindow()`
     * `get_auto_compact_token_limit()` → `getAutoCompactTokenLimit()`
     * `parse_rate_limit_snapshot()` → `parseRateLimitSnapshot()`
     * `attempt_stream_responses()` → `attemptStreamResponses()`

4. **SSE Processing**:
   - Decision: Extract SSE parsing into dedicated class matching Rust's `process_sse` function
   - Rationale: Separation of concerns, testability
   - Implementation: `SSEEventParser` class processes raw SSE → `ResponseEvent`

5. **Browser Environment Adaptations**:
   - Decision: Document required changes from Rust implementation
   - Deviations:
     * HTTP: `reqwest::Client` → `fetch()` API
     * Auth: `AuthManager` with file tokens → Chrome Storage API
     * Streams: `tokio::spawn` → async generators / ResponseStream
     * No `stream_from_fixture` (Rust test helper with file I/O)
   - All deviations documented in code comments

**Output**: research.md (see separate file)

## Phase 1: Design & Contracts

### 1. Data Model (`data-model.md`)

Key entities extracted from Rust source and aligned to TypeScript:

**ModelClient** (base class):
- Methods: `stream()`, `getModel()`, `getModelFamily()`, `getModelContextWindow()`, `getAutoCompactTokenLimit()`, `getProvider()`, `getAuthManager()`, `getReasoningEffort()`, `getReasoningSummary()`
- Private helpers: `streamResponses()`, `attemptStreamResponses()`, `processSSE()`, `parseRateLimitSnapshot()`

**ResponseStream**:
- Wraps event channel pattern from Rust
- Methods: `[Symbol.asyncIterator]()`, `addEvent()`, `complete()`, `error()`
- Provides async iteration over `ResponseEvent`

**ResponseEvent** (union type matching Rust enum):
- Variants: `Created`, `OutputItemDone`, `Completed`, `OutputTextDelta`, `ReasoningSummaryDelta`, `ReasoningContentDelta`, `ReasoningSummaryPartAdded`, `WebSearchCallBegin`, `RateLimits`

**Supporting Types**:
- `Prompt`: Input format with messages, tools, instructions
- `TokenUsage`: Token consumption metrics
- `RateLimitSnapshot`: Rate limit state from headers
- `StreamAttemptError`: Retry error classification

### 2. API Contracts (`contracts/`)

Three primary contracts defined:

**ModelClient.contract.md**:
- `stream(prompt: Prompt): Promise<ResponseStream>` - Main entry point, matches Rust signature
- `getModelContextWindow(): number | undefined` - Context window lookup
- `getAutoCompactTokenLimit(): number | undefined` - Auto-compact threshold
- Return types align with Rust (Promise wraps Result, undefined wraps Option)

**ResponseStream.contract.md**:
- `[Symbol.asyncIterator](): AsyncIterableIterator<ResponseEvent>` - Consumption interface
- `addEvent(event: ResponseEvent): void` - Producer interface
- `complete(): void`, `error(err: Error): void` - Lifecycle control

**SSE.contract.md**:
- Input: `ReadableStream<Uint8Array>` from fetch response
- Output: `AsyncGenerator<ResponseEvent>`
- Matches Rust's `process_sse()` function signature

### 3. Contract Tests

Tests written BEFORE implementation:

- `ModelClient.contract.test.ts`: Verifies method signatures match Rust
- `ResponseStream.test.ts`: Tests stream lifecycle, backpressure, iteration
- `SSEEventParser.test.ts`: Validates SSE parsing against Rust fixtures

All tests currently FAIL (no implementation yet) - this is expected for TDD.

### 4. Quickstart (`quickstart.md`)

Step-by-step validation scenario:
1. Create OpenAI Responses client with API key
2. Call `stream()` method with simple prompt
3. Iterate over ResponseStream events
4. Verify event types match Rust implementation
5. Check token usage in Completed event

This scenario validates the refactored API matches Rust behavior.

### 5. Agent Context Update

Running update script for Claude Code:

**Output**: CLAUDE.md updated with:
- New architecture section on Rust-to-TypeScript alignment
- Type mapping reference table
- Method naming conventions
- Recent refactoring changes
- Contract test locations

**Output**: All Phase 1 artifacts generated in `/specs/010-refactor-the-codex/`

## Phase 2: Task Planning Approach

**Task Generation Strategy**:

The `/tasks` command will generate tasks from Phase 1 design docs following this approach:

1. **Contract Test Tasks** (Priority: HIGH, Parallelizable):
   - Task: Write ModelClient contract tests verifying Rust method signatures
   - Task: Write ResponseStream iteration and lifecycle tests
   - Task: Write SSEEventParser tests with Rust-derived fixtures
   - All tests must FAIL initially (TDD red phase)

2. **Type Definition Tasks** (Priority: HIGH, Parallelizable):
   - Task: Align ResponseEvent type with Rust enum variants
   - Task: Update TokenUsage structure to match Rust
   - Task: Align RateLimitSnapshot with Rust headers parsing
   - Task: Update Prompt type to match Rust structure

3. **Core Refactoring Tasks** (Priority: CRITICAL, Sequential):
   - Task: Refactor ModelClient.stream() to return ResponseStream
   - Task: Add missing getter methods (getModelContextWindow, etc.)
   - Task: Implement parseRateLimitSnapshot() matching Rust
   - Task: Implement attemptStreamResponses() retry logic
   - Task: Refactor SSE processing to match Rust process_sse()

4. **ResponseStream Implementation** (Priority: HIGH):
   - Task: Implement ResponseStream class with async iteration
   - Task: Add event buffering and backpressure handling
   - Task: Implement timeout and abort signal handling

5. **Integration Tasks** (Priority: MEDIUM):
   - Task: Update OpenAIResponsesClient to use new signatures
   - Task: Update ModelClientFactory for extensibility
   - Task: Update existing callers (CodexAgent, etc.)

6. **Documentation Tasks** (Priority: LOW):
   - Task: Document type mappings in inline comments
   - Task: Document browser environment deviations
   - Task: Add JSDoc references to Rust source lines

**Ordering Strategy**:
- TDD: Contract tests → Type definitions → Implementation
- Dependency: Types → Base classes → Concrete implementations
- Parallel: Independent type files can be done simultaneously [P]
- Sequential: stream() refactoring must precede dependent changes

**Estimated Output**: ~25-30 tasks covering:
- 3 contract test tasks
- 4 type alignment tasks
- 6 method refactoring tasks
- 4 ResponseStream tasks
- 5 integration tasks
- 3 documentation tasks

**IMPORTANT**: This phase will be executed by the `/tasks` command, NOT by `/plan`

## Phase 3+: Future Implementation

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (contract tests pass, integration tests pass, Chrome extension works)

Success criteria:
- All contract tests pass
- Method signatures match Rust (accounting for type system differences)
- ResponseStream behavior matches Rust channel pattern
- Existing Chrome extension functionality preserved
- Performance: SSE processing <10ms per event (validated via existing metrics)

## Complexity Tracking

No constitutional violations or complexity deviations to justify.

This refactoring simplifies the codebase by aligning with proven Rust patterns rather than introducing new complexity.

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution (default template) - No custom constitution defined*
