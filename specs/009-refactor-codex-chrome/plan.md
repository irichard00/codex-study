# Implementation Plan: Align codex-chrome Model Client with codex-rs

**Branch**: `009-refactor-codex-chrome` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-refactor-codex-chrome/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Refactor the TypeScript model client implementation in codex-chrome/src/models to align with the Rust implementation in codex-rs/core/src/client.rs. The primary goal is to preserve exact method names, data structures, and execution flow from the Rust codebase while adapting for browser environment constraints (fetch() instead of reqwest, ReadableStream instead of tokio streams, chrome.storage instead of file system).

This alignment will enable:
- Easier debugging across codebases by using identical naming
- Simplified porting of bug fixes between implementations
- Clearer architecture understanding with matching structures
- Consistent behavior for OpenAI API interactions (Responses API and Chat Completions)
- Extensible provider abstraction for future LLM APIs (Gemini, Claude, etc.)

## Technical Context

**Language/Version**: TypeScript 5.9, targeting ES2022 for Chrome Extension Manifest V3
**Primary Dependencies**:
- Vite 5.4 (build tool)
- Svelte 4.2 (UI framework)
- Vitest 3.2 (testing framework)
- zod 3.23 (schema validation)
- Chrome Extension APIs (chrome.storage, chrome.runtime)

**Storage**: IndexedDB for conversation history (via RolloutRecorder), we already have existing implementation: codex-chrome/src/storage/rollout/RolloutRecorder.ts, chrome.storage.local for configuration and auth tokens
**Testing**: Vitest with jsdom for unit tests, fake-indexeddb for IndexedDB mocking, chrome-mock for Chrome API mocking
**Target Platform**: Chrome Extension (Manifest V3) running in browser context with Service Worker background
**Project Type**: Chrome Extension (single codebase structure with background worker + UI components)
**Performance Goals**:
- SSE event processing <10ms average
- API request retry with <3 second total delay for rate limits
- Stream processing maintains real-time UI updates (<100ms latency)

**Constraints**:
- Browser environment only (no Node.js fs, no child_process)
- Service Worker restrictions (no long-running async operations, periodic wakeup)
- Chrome Extension security policies (CSP restrictions, no eval)
- Must coordinate state across multiple browser contexts (tabs, popup, background)

**Scale/Scope**:
- ~10 TypeScript files to refactor in src/models/
- ~15 method names to align with Rust implementation
- ~8 data structure types to rename/restructure
- ~20 functional requirements from spec

**Existing Assets**:
- ✅ `Prompt` interface already exists at `codex-chrome/src/models/types/ResponsesAPI.ts` (Lines 45-54) - No new creation needed
- ✅ `ResponseEvent` type already exists at `codex-chrome/src/models/types/ResponsesAPI.ts` (Lines 10-19) - Already matches Rust
- ✅ `ResponsesApiRequest` interface already exists - Already aligned with Rust

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: No project-specific constitution found at `.specify/memory/constitution.md` (template only). Proceeding with general software engineering principles for this refactoring task:

### General Engineering Principles Applied

1. **Preserve Working Code**: This is a refactoring (behavior preservation), not new features
   - ✅ Existing tests must continue to pass
   - ✅ Existing functionality must remain unchanged
   - ✅ Only internal structure and naming changes allowed

2. **Test-Driven Refactoring**: Tests guide the refactoring process
   - ✅ Run existing tests before changes
   - ✅ Add contract tests for new structure
   - ✅ Refactor incrementally, keeping tests green

3. **Minimal Scope**: Only refactor what's necessary for alignment
   - ✅ Focus on codex-chrome/src/models/ directory
   - ✅ Do not modify UI components or storage logic
   - ✅ Keep browser adaptation code (fetch, ReadableStream) as-is, just rename/restructure

4. **Documentation**: Update docs to reflect new naming
   - ✅ Update CLAUDE.md with new model client architecture
   - ✅ Generate quickstart.md for new structure
   - ✅ Document naming mappings (TS ↔ Rust)

### Refactoring-Specific Gates

- [ ] All existing unit tests pass before refactoring
- [ ] Contract tests created for new interfaces
- [ ] Type compatibility maintained (no breaking changes to consumers)
- [ ] Performance metrics remain within targets (SSE <10ms, retry <3s)

## Project Structure

### Documentation (this feature)
```
specs/009-refactor-codex-chrome/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── ModelClient.ts   # ModelClient interface contract
│   ├── ResponseStream.ts # ResponseStream interface contract
│   └── types.ts         # Shared type definitions matching Rust
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── models/                    # TARGET REFACTORING DIRECTORY
│   │   ├── ModelClient.ts         # Base class (align with client.rs:74-445)
│   │   ├── OpenAIResponsesClient.ts # Responses API client (align with client.rs:166-412)
│   │   ├── OpenAIClient.ts        # Chat API client (keep, align naming)
│   │   ├── ResponseStream.ts      # Event stream (align with client_common.rs ResponseStream)
│   │   ├── SSEEventParser.ts      # SSE parsing (align with client.rs:624-848)
│   │   ├── ModelClientError.ts    # Error types (align with error.rs CodexErr)
│   │   ├── ChromeAuthManager.ts   # Browser auth adapter (keep browser-specific)
│   │   ├── types/                 # Type definitions
│   │   │   ├── ResponseEvent.ts   # Align with protocol.rs ResponseEvent
│   │   │   ├── ResponsesAPI.ts    # Align with client_common.rs types
│   │   │   ├── TokenUsage.ts      # Align with protocol.rs TokenUsage
│   │   │   └── RateLimits.ts      # Align with protocol.rs RateLimitSnapshot
│   │   └── __tests__/             # Test files
│   ├── core/                      # Core agent logic (not refactored)
│   ├── storage/                   # Storage abstractions (not refactored)
│   ├── tools/                     # Tool definitions (not refactored)
│   └── protocol/                  # Protocol types (not refactored)
└── tests/
    └── contract/                  # New contract tests for refactored interfaces
```

**Structure Decision**: Single Chrome Extension project structure. Refactoring focuses on `codex-chrome/src/models/` directory only, preserving all other modules unchanged. The models directory contains model client abstractions that need alignment with Rust implementation in `codex-rs/core/src/client.rs`.

## Phase 0: Outline & Research

### Research Tasks

1. **Rust client.rs Architecture Analysis**
   - **Task**: Analyze codex-rs/core/src/client.rs structure (lines 1-1330)
   - **Focus Areas**:
     - ModelClient struct fields (config, auth_manager, provider, conversation_id, effort, summary)
     - Method signatures (new, stream, stream_responses, attempt_stream_responses, get_* methods)
     - StreamAttemptError enum variants (RetryableHttpError, RetryableTransportError, Fatal)
     - SSE processing flow (process_sse function lines 624-848)
   - **Output**: List of all Rust types, methods, and their exact signatures

2. **TypeScript Current Implementation Gap Analysis**
   - **Task**: Compare current TS implementation against Rust structure
   - **Focus Areas**:
     - Missing methods in TS that exist in Rust
     - Different naming conventions (camelCase vs snake_case)
     - Different data structures (TS classes vs Rust structs)
     - Browser-specific adaptations that should be preserved
   - **Output**: Mapping table of Rust → TypeScript renames needed

3. **Browser Environment Constraints**
   - **Task**: Document browser-specific requirements that differ from Rust
   - **Focus Areas**:
     - fetch() API vs reqwest crate
     - ReadableStream vs tokio::mpsc::channel
     - chrome.storage API vs std::fs file access
     - Browser timeout handling vs tokio::time
     - Service Worker lifecycle vs long-running process
   - **Output**: Browser adaptation patterns to preserve

4. **Provider Abstraction Patterns**
   - **Task**: Research provider abstraction for extensibility (Gemini, Claude)
   - **Focus Areas**:
     - ModelProviderInfo structure from Rust (lines 78-79)
     - WireApi enum (Responses vs Chat) handling
     - Provider-specific authentication strategies
     - Provider-specific retry policies
   - **Output**: Provider interface design that matches Rust but works in browser

5. **Testing Strategy for Refactoring**
   - **Task**: Define testing approach for behavior-preserving refactoring
   - **Focus Areas**:
     - Existing test coverage analysis
     - Contract tests for new interfaces
     - Migration tests (old → new compatibility)
     - Performance regression tests
   - **Output**: Test plan ensuring no behavior changes

### Research Consolidation

**Output**: `research.md` containing:
- Section 1: Rust Architecture (types, methods, flow diagrams)
- Section 2: Current TS Gap Analysis (rename mapping table)
- Section 3: Browser Adaptations (patterns to preserve)
- Section 4: Provider Abstraction Design (extensibility architecture)
- Section 5: Testing Strategy (refactoring test plan)

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

### Step 1: Extract Entities → `data-model.md`

From feature spec entities (FR-001 to FR-020), define TypeScript equivalents of Rust structures:

**Primary Entities**:

1. **ModelClient** (from client.rs:74-445)
   - Fields: config, authManager, provider, conversationId, effort, summary
   - Methods: new(), stream(), getModel(), getProvider(), getReasoningEffort(), etc.
   - Validation: All Rust methods must have TS equivalents

2. **ResponseStream** (from client_common.rs)
   - Structure: AsyncGenerator<ResponseEvent> wrapper
   - Events: Created, OutputItemDone, OutputTextDelta, Completed, etc.
   - State: Buffer management, completion tracking

3. **Prompt** (from client_common.rs)
   - Fields: input, tools, baseInstructionsOverride, outputSchema
   - Validation: Same structure as Rust Prompt

4. **ResponseEvent** (from protocol.rs)
   - Variants: Created | OutputItemDone | OutputTextDelta | ReasoningContentDelta | Completed | RateLimits | WebSearchCallBegin
   - Type safety: Discriminated union matching Rust enum exactly

5. **ModelProviderInfo** (from model_provider_info.rs)
   - Fields: name, baseUrl, wireApi, requestMaxRetries, streamIdleTimeoutMs, httpHeaders
   - Purpose: Provider-specific configuration

6. **StreamAttemptError** (internal error classification)
   - Variants: RetryableHttpError | RetryableTransportError | Fatal
   - Methods: delay(attempt), intoError()

### Step 2: Generate API Contracts → `/contracts/`

From functional requirements (FR-001 to FR-020):

**Contract Files**:

1. **ModelClient.contract.ts** (FR-001, FR-002, FR-003)
   ```typescript
   // Matches client.rs:74-445
   interface ModelClient {
     // FR-001: Exact method names
     stream(prompt: Prompt): AsyncGenerator<ResponseEvent>
     attemptStreamResponses(attempt: number, payload: any): Promise<ResponseStream>
     processSSE(stream: ReadableStream, headers: Headers): AsyncGenerator<ResponseEvent>
     parseRateLimitSnapshot(headers: Headers): RateLimitSnapshot | null

     // FR-011, FR-012: OpenAI support
     getProvider(): string
     getModel(): string

     // FR-013, FR-014: Reasoning support
     getReasoningEffort(): ReasoningEffortConfig | undefined
     getReasoningSummary(): ReasoningSummaryConfig | undefined
   }
   ```

2. **ResponseEvent.contract.ts** (FR-004)
   ```typescript
   // Matches protocol.rs ResponseEvent enum exactly
   type ResponseEvent =
     | { type: 'Created' }
     | { type: 'OutputItemDone', item: ResponseItem }
     | { type: 'OutputTextDelta', delta: string }
     | { type: 'ReasoningContentDelta', delta: string }
     | { type: 'ReasoningSummaryDelta', delta: string }
     | { type: 'Completed', responseId: string, tokenUsage?: TokenUsage }
     | { type: 'RateLimits', snapshot: RateLimitSnapshot }
     | { type: 'WebSearchCallBegin', callId: string }
     | { type: 'ReasoningSummaryPartAdded' }
   ```

3. **StreamAttemptError.contract.ts** (FR-005)
   ```typescript
   // Matches client.rs:447-486 StreamAttemptError enum
   type StreamAttemptError =
     | { type: 'RetryableHttpError', status: number, retryAfter?: number }
     | { type: 'RetryableTransportError', error: Error }
     | { type: 'Fatal', error: Error }
   ```

4. **BrowserAdaptations.contract.ts** (FR-006 to FR-010)
   ```typescript
   // Browser-specific interfaces that replace Rust tokio/reqwest
   interface BrowserHttpClient {
     fetch(url: string, init: RequestInit): Promise<Response>  // replaces reqwest
   }

   interface BrowserStreamReader {
     read(): Promise<ReadableStreamReadResult<Uint8Array>>  // replaces tokio::stream
   }

   interface BrowserAuthStorage {
     getAuth(): Promise<CodexAuth | null>  // replaces fs::read
     setAuth(auth: CodexAuth): Promise<void>  // replaces fs::write
   }
   ```

### Step 3: Generate Contract Tests

For each contract, create failing tests (TDD):

**Test Files**:
1. `contracts/ModelClient.test.ts` - Test ModelClient interface compliance
2. `contracts/ResponseEvent.test.ts` - Test ResponseEvent type structure
3. `contracts/StreamAttemptError.test.ts` - Test error classification
4. `contracts/BrowserAdaptations.test.ts` - Test browser-specific adapters

Tests assert:
- Method signatures match contracts
- Type structures match Rust equivalents
- Error handling preserves classification
- Browser adaptations maintain same behavior

### Step 4: Extract Test Scenarios from User Stories

From acceptance scenarios in spec:

**Integration Test Scenarios**:

1. **Developer Debugging Scenario** (Spec line 27-29)
   - Test: Find equivalent TS method for Rust `ModelClient::stream()`
   - Assert: Method exists with same name, delegates to Responses/Chat based on wireApi

2. **SSE Processing Scenario** (Spec line 31-33)
   - Test: Find `processSSE()` method in TS matching Rust `process_sse()`
   - Assert: Same event types handled, same state management

3. **Retry Logic Scenario** (Spec line 35-37)
   - Test: Find `attemptStreamResponses()` in TS matching Rust
   - Assert: Similar retry counting, error classification, backoff

4. **Browser Fetch Scenario** (Spec line 39-41)
   - Test: Verify fetch() used instead of reqwest
   - Assert: Same request structure, headers, error handling

5. **Provider Extensibility Scenario** (Spec line 43-45)
   - Test: Add mock Gemini provider using ModelProviderInfo
   - Assert: Can add provider without modifying core streaming logic

**Quickstart Test** (most critical user story):

File: `quickstart.md` Section: "Verify Alignment"
```typescript
// Test 1: Method name alignment
const client = new ModelClient(config)
const stream = client.stream(prompt)  // Matches Rust: ModelClient::stream()

// Test 2: SSE processing alignment
for await (const event of stream) {
  // Events match Rust ResponseEvent enum
  if (event.type === 'OutputItemDone') { /* ... */ }
  if (event.type === 'Completed') { /* ... */ }
}

// Test 3: Error handling alignment
try {
  await client.attemptStreamResponses(attempt, payload)
} catch (err) {
  // Error classification matches Rust StreamAttemptError
  if (err.retryable) { /* backoff logic matches Rust */ }
}
```

### Step 5: Update CLAUDE.md

Run the update script:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

Add new sections:
- **Model Client Architecture**: Updated structure matching Rust client.rs
- **Naming Conventions**: Rust → TypeScript mapping table
- **Browser Adaptations**: Patterns for fetch, ReadableStream, chrome.storage
- **Recent Changes**: Entry for refactoring to align with codex-rs

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **Load templates and design docs**
   - Load `.specify/templates/tasks-template.md` as base structure
   - Load `contracts/*.ts` for contract test tasks
   - Load `data-model.md` for refactoring tasks
   - Load `research.md` for rename mappings

2. **Generate test tasks first (TDD order)**
   - Each contract → contract test task [P] (parallel safe)
   - Each user story → integration test task (sequential)
   - Baseline: Run existing tests to capture current state

3. **Generate refactoring tasks (incremental)**
   - Task per file in src/models/ (based on rename mapping)
   - Order: Types first → Base classes → Implementations → Tests
   - Each task: Rename methods/types, preserve behavior, verify tests pass

4. **Generate validation tasks (final verification)**
   - Run all contract tests
   - Run all existing tests (regression check)
   - Performance benchmarks (SSE <10ms, retry <3s)
   - Update documentation (CLAUDE.md, README)

**Ordering Strategy**:

1. **Pre-refactoring** (Tasks 1-5)
   - Baseline test run
   - Create contract tests (parallel [P])
   - Run contract tests (expected failures)

2. **Core Types Refactoring** (Tasks 6-10) [P]
   - ResponseEvent.ts rename
   - TokenUsage.ts rename
   - RateLimits.ts rename
   - StreamAttemptError creation
   - Prompt.ts alignment

3. **Base Class Refactoring** (Tasks 11-15)
   - ModelClient.ts method renames (sequential - base class)
   - ResponseStream.ts structure alignment
   - ModelClientError.ts → StreamAttemptError mapping

4. **Implementation Refactoring** (Tasks 16-22) [P]
   - OpenAIResponsesClient.ts method renames
   - OpenAIClient.ts method renames
   - SSEEventParser.ts function renames
   - ChromeAuthManager.ts (preserve, minimal changes)

5. **Test Updates** (Tasks 23-26)
   - Update unit tests for new names
   - Update integration tests
   - Run contract tests (should pass now)
   - Run all existing tests (regression check)

6. **Documentation & Validation** (Tasks 27-30)
   - Update CLAUDE.md
   - Update quickstart.md
   - Performance benchmarks
   - Final validation

**Estimated Output**: ~30 numbered, ordered tasks in tasks.md with:
- [P] markers for parallel execution (independent files)
- Dependencies clearly marked (e.g., "After task 11")
- Test-first ordering (contract tests before refactoring)
- Incremental validation (tests run after each phase)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md with ~30 tasks)
**Phase 4**: Implementation (execute tasks.md following TDD and incremental refactoring)
**Phase 5**: Validation (all tests pass, performance maintained, docs updated)

## Complexity Tracking

*No constitutional violations detected for this refactoring task.*

This is a straightforward refactoring with clear goals:
- Preserve behavior (no new features)
- Rename to match Rust implementation
- Maintain test coverage
- Document changes

No complexity deviations needed.

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command - 27 tasks created)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (refactoring, no constitutional constraints)
- [x] Post-Design Constitution Check: PASS (design maintains simplicity)
- [x] All NEEDS CLARIFICATION resolved (technical context complete)
- [x] Complexity deviations documented (none needed)

---
*Based on general software engineering principles - No project-specific constitution active*
