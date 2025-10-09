# Tasks: Align OpenAI Client Request Structure with Rust

**Input**: Design documents from `/specs/016-refactor-the-request/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓
**Approach**: Direct implementation without backward compatibility concerns

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.x, Chrome Extension, Vitest
   → Structure: codex-chrome/src/models/, codex-chrome/src/core/
2. Load design documents ✓
   → data-model.md: Prompt, ResponsesApiRequest, ToolSpec
   → contracts/: 3 contract files (prompt, request, stream)
   → research.md: 9 technical decisions
3. Generate tasks by category:
   → Setup: No new project setup needed (updating existing)
   → Tests: 3 contract test files, 2 integration tests
   → Core: Update 4 type files, create 1 helper file
   → Implementation: Update 3 client files, 2 core files
   → Validation: 6 quickstart scenarios
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file updates = sequential
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T024)
6. Dependencies: Types → Helpers → Client → TurnManager → Integration
7. Return: SUCCESS (24 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **Direct implementation**: No backward compatibility concerns
- All file paths are absolute from repository root

## Path Conventions
- Base: `/home/irichard/dev/study/codex-study/s1/codex-study/codex-chrome/`
- Models: `src/models/`
- Core: `src/core/`
- Tests: `src/models/__tests__/`, `src/core/__tests__/`

---

## Phase 3.1: Type Definitions (Update Existing + Add Missing)

### T001 [X] [P] Update ResponsesApiRequest literal types in ResponsesAPI.ts
**File**: `codex-chrome/src/models/types/ResponsesAPI.ts`
**Action**: Update existing `ResponsesApiRequest` interface
**Changes**:
- Change `tool_choice: string` → `tool_choice: "auto"` (literal type)
- Change `parallel_tool_calls: boolean` → `parallel_tool_calls: false` (literal type)
- Change `stream: boolean` → `stream: true` (literal type)
**Rust Reference**: `codex-rs/core/src/client_common.rs:141-161`
**Contract**: `contracts/responses-api-request.contract.md`

### T002 [X] [P] Add ToolSpec discriminated union to ResponsesAPI.ts
**File**: `codex-chrome/src/models/types/ResponsesAPI.ts`
**Action**: Add new type definitions (append to existing file)
**Add**:
```typescript
export type ToolSpec =
  | { type: 'function'; function: ResponsesApiTool }
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | { type: 'custom'; custom: FreeformTool };

export interface ResponsesApiTool {
  name: string;
  description: string;
  strict: boolean;
  parameters: any;
}

export interface FreeformTool {
  name: string;
  description: string;
  format: FreeformToolFormat;
}

export interface FreeformToolFormat {
  type: string;
  syntax: string;
  definition: string;
}
```
**Rust Reference**: `codex-rs/core/src/client_common.rs:163-209`
**Contract**: `contracts/prompt-interface.contract.md`

### T003 [X] [P] Update Prompt interface to use ToolSpec in ResponsesAPI.ts
**File**: `codex-chrome/src/models/types/ResponsesAPI.ts`
**Action**: Update existing `Prompt` interface
**Change**: `tools: any[]` → `tools: ToolSpec[]`
**Depends on**: T002 (ToolSpec must be defined first)
**Contract**: `contracts/prompt-interface.contract.md`

---

## Phase 3.2: Helper Functions (TDD - Tests First)

### T004 [X] [P] Create contract tests for Prompt helpers
**File**: `codex-chrome/src/models/__tests__/Prompt.contract.test.ts` (NEW)
**Action**: Create new test file
**Tests**:
1. `get_full_instructions()` combines base + user instructions
2. `get_full_instructions()` uses override when provided
3. `get_formatted_input()` returns cloned input array
4. `get_formatted_input()` preserves all ResponseItem types
**Expected**: All tests FAIL (no implementation yet)
**Contract**: `contracts/prompt-interface.contract.md`

### T005 [X] [P] Create contract tests for ResponsesApiRequest literal types
**File**: `codex-chrome/src/models/__tests__/ResponsesApiRequest.contract.test.ts` (NEW)
**Action**: Create new test file
**Tests**:
1. Enforce `tool_choice: "auto"` literal type
2. Enforce `parallel_tool_calls: false` literal type
3. Enforce `stream: true` literal type
4. Verify store flag for Azure vs standard endpoints
5. Verify include array populated when reasoning enabled
6. Verify undefined fields omitted from JSON serialization
**Expected**: All tests FAIL or compile errors (due to T001 literal types)
**Contract**: `contracts/responses-api-request.contract.md`

### T006 [X] [P] Create contract tests for stream method execution flow
**File**: `codex-chrome/src/models/__tests__/OpenAIClient.stream.contract.test.ts` (NEW)
**Action**: Create new test file
**Tests**:
1. `stream()` dispatches to `streamResponses()` for Responses API
2. Request headers include `OpenAI-Beta: responses=experimental`
3. Request headers include `conversation_id` and `session_id`
4. Retry logic with exponential backoff
5. Retry-After header parsing
6. Auth token refresh on 401 Unauthorized
**Expected**: All tests FAIL (implementation not updated yet)
**Contract**: `contracts/stream-method.contract.md`

---

## Phase 3.3: Implementation (Core Updates)

### T007 [X] Create PromptHelpers.ts with utility functions
**File**: `codex-chrome/src/models/PromptHelpers.ts` (NEW)
**Action**: Create new file with helper functions
**Functions**:
```typescript
export function get_full_instructions(prompt: Prompt, model: ModelFamily): string {
  const base = prompt.base_instructions_override || model.base_instructions;
  const parts = [base];
  if (prompt.user_instructions) {
    parts.push(prompt.user_instructions);
  }
  return parts.join('\n');
}

export function get_formatted_input(prompt: Prompt): ResponseItem[] {
  return [...prompt.input];
}
```
**Rust Reference**: `codex-rs/core/src/client_common.rs:42-68`
**Tests**: T004 should now pass
**Depends on**: T001, T002, T003 (types must be updated first)

### T008 [X] Update OpenAIResponsesClient to build request from Prompt
**File**: `codex-chrome/src/models/OpenAIResponsesClient.ts`
**Action**: Update existing `buildRequestPayload()` or similar method
**Changes**:
- Accept `Prompt` parameter
- Use `get_full_instructions(prompt, modelFamily)` for instructions
- Use `get_formatted_input(prompt)` for input
- Convert `prompt.tools` (ToolSpec[]) to Responses API format
- Set literal values: `tool_choice: "auto"`, `parallel_tool_calls: false`, `stream: true`
- Use `prompt.output_schema` for `text.format` if present
- Set `prompt_cache_key` to conversation ID
**Rust Reference**: `codex-rs/core/src/client.rs:215-247`
**Tests**: T005 should now pass
**Depends on**: T007 (PromptHelpers)

### T009 [X] Add Responses API headers to OpenAIResponsesClient
**File**: `codex-chrome/src/models/OpenAIResponsesClient.ts`
**Action**: Update request headers in `attemptStreamResponses()` or similar
**Add headers**:
- `OpenAI-Beta: responses=experimental`
- `conversation_id: <conversationId>`
- `session_id: <conversationId>`
- `Accept: text/event-stream`
**Rust Reference**: `codex-rs/core/src/client.rs:296-302`
**Tests**: T006 header tests should now pass
**Depends on**: T008

### T010 [X] Update ModelClient.stream() to accept Prompt parameter
**File**: `codex-chrome/src/models/ModelClient.ts`
**Action**: Update abstract method signature
**Change**: `abstract stream(request: any): Promise<ResponseStream>`
→ `abstract stream(prompt: Prompt): Promise<ResponseStream>`
**Note**: This is a breaking change (no backward compatibility)
**Depends on**: T001, T002, T003 (Prompt types updated)

### T011 [X] Update OpenAIClient.stream() implementation
**File**: `codex-chrome/src/models/OpenAIClient.ts`
**Action**: Update concrete implementation
**Changes**:
- Update signature to accept `Prompt` parameter
- Dispatch to `streamResponses(prompt)` for Responses API
- Dispatch to `streamChat(prompt)` for Chat API (if exists)
- Remove old `CompletionRequest` handling
**Rust Reference**: `codex-rs/core/src/client.rs:126-166`
**Tests**: T006 dispatch tests should now pass
**Depends on**: T010 (ModelClient signature updated)

### T012 [X] Implement Azure endpoint workaround in OpenAIResponsesClient
**File**: `codex-chrome/src/models/OpenAIResponsesClient.ts`
**Action**: Add Azure detection and item ID attachment
**Functions**:
```typescript
function isAzureResponsesEndpoint(provider: ModelProviderInfo): boolean {
  return provider.base_url?.includes('azure.com') && provider.wire_api === 'Responses';
}

function attachItemIds(payload: any, items: ResponseItem[]): void {
  // Iterate payload.input and attach IDs from items
}
```
**Logic**:
- Set `store: true` if Azure, `false` otherwise
- Call `attachItemIds()` if Azure
**Rust Reference**: `codex-rs/core/src/client.rs:557-582`
**Tests**: T005 Azure tests should now pass
**Depends on**: T008

### T013 [X] Update retry logic with StreamAttemptError pattern
**File**: `codex-chrome/src/models/OpenAIResponsesClient.ts`
**Action**: Update `streamResponses()` retry loop
**Add**:
```typescript
type StreamAttemptError =
  | { type: 'RetryableHttpError'; status: number; retryAfter?: number }
  | { type: 'RetryableTransportError'; error: Error }
  | { type: 'Fatal'; error: Error };
```
**Logic**:
- Retry up to `requestMaxRetries` for retryable errors
- Throw immediately for fatal errors
- Use exponential backoff: `Math.min(1000 * Math.pow(2, attempt), 30000)`
- Parse `Retry-After` header and use if present
- Refresh auth token on 401 errors
**Rust Reference**: `codex-rs/core/src/client.rs:249-269, 461-503`
**Tests**: T006 retry tests should now pass
**Depends on**: T011

---

## Phase 3.4: Integration (TurnManager and Session)

### T014 [X] Update TurnManager to build Prompt structure
**File**: `codex-chrome/src/core/TurnManager.ts`
**Action**: Update method that calls `modelClient.stream()`
**Changes**:
- Build `Prompt` object instead of old request format
- Set `prompt.input` from conversation history
- Set `prompt.tools` from available browser tools
- Set `prompt.user_instructions` from session/config
- Pass `Prompt` to `modelClient.stream(prompt)`
**Remove**: Old `CompletionRequest` or similar structure
**Depends on**: T011 (OpenAIClient.stream() signature updated)

### T015 [X] Update Session to provide user_instructions field
**File**: `codex-chrome/src/core/Session.ts`
**Action**: Add method to get user instructions
**Add**:
```typescript
getUserInstructions(): string | undefined {
  // Load from chrome.storage.local or config
  // Or return development guidelines
  return this.config.userInstructions;
}
```
**Usage**: TurnManager calls this when building Prompt
**Depends on**: None (independent addition)

### T016 [X] Update tool conversion utilities for ToolSpec format
**File**: `codex-chrome/src/core/tools/` or similar (find existing tool conversion code)
**Action**: Update tool conversion to produce ToolSpec union type
**Changes**:
- Convert browser tools to `{ type: 'function', function: { ... } }`
- Add `{ type: 'web_search' }` if web search enabled
- Add `{ type: 'local_shell' }` if browser command execution enabled
**Return type**: `ToolSpec[]` (not `any[]`)
**Depends on**: T002 (ToolSpec defined)

---

## Phase 3.5: Integration Tests

### T017 [X] [P] Create TurnManager integration test for Prompt usage
**File**: `codex-chrome/src/core/__tests__/TurnManager.integration.test.ts`
**Action**: Update or create integration test
**Tests**:
1. TurnManager builds Prompt with user_instructions
2. Prompt includes all conversation context in input
3. Prompt includes browser tools in tools array
4. ModelClient.stream() called with Prompt structure
**Expected**: Tests pass after T014, T015, T016
**Depends on**: T014, T015, T016

### T018 [X] [P] Create Session integration test for user_instructions
**File**: `codex-chrome/src/core/session/state/__tests__/Session.integration.test.ts`
**Action**: Update existing test file
**Tests**:
1. Session.getUserInstructions() returns configured value
2. Session.getUserInstructions() returns undefined if not configured
3. TurnManager receives user_instructions from Session
**Expected**: Tests pass after T015
**Depends on**: T015

---

## Phase 3.6: Validation (Quickstart Scenarios)

### T019 [X] Execute Scenario 1: Build Prompt with full context
**File**: Run manual test from `quickstart.md` scenario 1
**Action**: Create test prompt, call `get_full_instructions()` and `get_formatted_input()`
**Verify**:
- Instructions combine base + user
- Input is cloned (not same reference)
- Prompt structure matches Rust
**Manual or automated**: Can be automated in test file
**Depends on**: T007

### T020 [X] Execute Scenario 2: Build ResponsesApiRequest payload
**File**: Run manual test from `quickstart.md` scenario 2
**Action**: Create client, build payload, verify structure
**Verify**:
- All required fields present
- `tool_choice = "auto"`, `parallel_tool_calls = false`, `stream = true`
- `store` flag correct for provider type
- `prompt_cache_key` = conversation ID
**Depends on**: T008, T012

### T021 [X] Execute Scenario 3: Stream request with Responses API
**File**: Run manual test from `quickstart.md` scenario 3
**Action**: Mock fetch, stream request, verify events and headers
**Verify**:
- stream() method executes successfully
- Events emitted in correct order
- Headers include OpenAI-Beta, conversation_id, Accept
**Depends on**: T011, T009

### T022 [X] Execute Scenario 4: Azure endpoint handling
**File**: Run manual test from `quickstart.md` scenario 4
**Action**: Create Azure client, build payload, verify Azure-specific fields
**Verify**:
- `store = true` for Azure
- Item IDs preserved in input array
**Depends on**: T012

### T023 [X] Execute Scenario 5: Retry logic with backoff
**File**: Run manual test from `quickstart.md` scenario 5
**Action**: Mock fetch to fail first 2 attempts, verify retry behavior
**Verify**:
- Retry attempted 3 times
- Exponential backoff applied
- Request succeeds on third attempt
**Depends on**: T013

### T024 [X] Execute Scenario 6: Integration with TurnManager
**File**: Run manual test from `quickstart.md` scenario 6
**Action**: Create TurnManager, submit user message, verify Prompt structure
**Verify**:
- TurnManager builds Prompt with user_instructions
- Prompt includes all conversation context
- Tools array populated with browser tools
**Depends on**: T014, T015, T016

---

## Dependencies

### Phase Order
1. **T001-T003** (Types) must complete first
2. **T004-T006** (Contract tests) can run parallel [P]
3. **T007** (PromptHelpers) depends on types
4. **T008-T013** (Client implementation) sequential, each depends on previous
5. **T014-T016** (Integration) can run after client updates
6. **T017-T018** (Integration tests) depend on T014-T016
7. **T019-T024** (Validation) can run as each dependency completes

### Critical Path
```
T001,T002,T003 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T019-T024
                  ↓
                T004,T005,T006 (tests verify implementation)
```

### Parallel Execution Groups
```
Group 1: T001, T002 (same file, sequential)
Group 2: T004, T005, T006 (different files, parallel)
Group 3: T015, T016 (different files, parallel with T014 done)
Group 4: T017, T018 (different files, parallel)
Group 5: T019-T024 (can run as dependencies complete)
```

---

## Parallel Example

### Launch contract tests together (after T001-T003):
```bash
# Terminal 1
vitest codex-chrome/src/models/__tests__/Prompt.contract.test.ts

# Terminal 2
vitest codex-chrome/src/models/__tests__/ResponsesApiRequest.contract.test.ts

# Terminal 3
vitest codex-chrome/src/models/__tests__/OpenAIClient.stream.contract.test.ts
```

### Launch integration tests together (after T014-T016):
```bash
# Terminal 1
vitest codex-chrome/src/core/__tests__/TurnManager.integration.test.ts

# Terminal 2
vitest codex-chrome/src/core/session/state/__tests__/Session.integration.test.ts
```

---

## Notes

- **No backward compatibility**: Directly implement new code, breaking changes are acceptable
- **Contract tests must fail first**: T004-T006 MUST fail before implementing T007-T013
- **Type safety**: Literal types (`"auto"`, `false`, `true`) enforce correctness at compile time
- **Rust alignment**: Every task references specific Rust source lines for verification
- **Performance**: Target <50ms request construction, <200ms to first streaming event

---

## Validation Checklist

- [x] All contracts have corresponding tests (T004, T005, T006)
- [x] All entities have implementation tasks (Prompt: T007, ResponsesApiRequest: T008)
- [x] All tests come before implementation (T004-T006 before T007-T013)
- [x] Parallel tasks truly independent (marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Quickstart scenarios mapped to validation tasks (T019-T024)
- [x] Dependencies explicitly documented

---

**Total Tasks**: 24
**Estimated Time**: 8-12 hours (with parallel execution)
**Ready for execution**: Yes ✓
