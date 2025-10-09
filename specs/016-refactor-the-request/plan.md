# Implementation Plan: Align OpenAI Client Request Structure with Rust (In-Place Update)

**Branch**: `016-refactor-the-request` | **Date**: 2025-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-refactor-the-request/spec.md`
**Approach**: Scan existing implementation and update in-place (no new data structures)

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
2. Fill Technical Context ✓
3. Fill Constitution Check section ✓
4. Evaluate Constitution Check section ✓
5. Execute Phase 0 → research.md (scan existing code) ✓
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
7. Re-evaluate Constitution Check section ✓
8. Plan Phase 2 → Describe task generation approach ✓
9. STOP - Ready for /tasks command
```

## Summary

Refactor the OpenAI client in `codex-chrome/src/models/OpenAIClient.ts` to align its request data structures and execution flow with the Rust implementation. **KEY CHANGE**: Instead of creating new data structures, we will **scan the existing TypeScript implementation** and update it in-place. The existing codebase already has Prompt, ResponsesApiRequest, and related interfaces - we just need to align them with Rust's exact field types and add missing helper methods.

**Key Technical Approach**:
- Scan existing `ResponsesAPI.ts` for current interface definitions
- Update existing interfaces to use literal types (`"auto"`, `false`, `true`)
- Add missing `ToolSpec` discriminated union to existing types file
- Create `PromptHelpers.ts` for `get_full_instructions()` and `get_formatted_input()`
- Refactor `OpenAIClient.stream()` to accept Prompt (instead of creating new client)
- Update `TurnManager` to build Prompt structure

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), targeting ES2022
**Primary Dependencies**: Chrome Extension Manifest V3, Vite build system, Vitest testing framework
**Storage**: IndexedDB (via RolloutRecorder), chrome.storage.local (for configuration)
**Testing**: Vitest with contract tests, integration tests, unit tests
**Target Platform**: Chrome Extension (browser environment, no Node.js APIs)
**Project Type**: Chrome Extension (single TypeScript codebase with browser-specific adaptations)
**Performance Goals**: <50ms request construction, <200ms to first streaming event, support 1000+ message context
**Constraints**: Must maintain backward compatibility, no breaking changes to existing test suites, preserve existing Chat API support
**Scale/Scope**: ~10 files modified (not created) in codex-chrome/src/models/ and codex-chrome/src/core/, ~300 lines updated

**User-Provided Implementation Details**:
- **Scan through existing implementation** instead of creating new data struct objects
- Update existing ResponsesAPI.ts interfaces to match Rust exactly
- Refactor existing OpenAIClient methods to use updated structures
- Update all calling points in TurnManager and Session

## Constitution Check

*No constitution file found - using minimal quality gates*

### Minimal Quality Gates
- [x] **Test-First Development**: Update contract tests to verify new literal types
- [x] **No Breaking Changes**: Existing interfaces extended, not replaced
- [x] **Documentation**: Update existing interface documentation with Rust alignment notes
- [x] **Type Safety**: Literal types ensure compile-time correctness

**Gate Status**: PASS - No constitution violations

## Project Structure

### Documentation (this feature)
```
specs/016-refactor-the-request/
├── plan.md              # This file (/plan command output) - UPDATED
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (with existing code scan) - UPDATED
├── data-model.md        # Phase 1 output (documents updates, not new entities)
├── quickstart.md        # Phase 1 output (validation scenarios)
├── contracts/           # Phase 1 output (contract tests)
│   ├── prompt-interface.contract.md
│   ├── responses-api-request.contract.md
│   └── stream-method.contract.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── models/
│   │   ├── OpenAIClient.ts              # UPDATE: Refactor stream() to accept Prompt
│   │   ├── OpenAIResponsesClient.ts     # Already exists, may need updates
│   │   ├── ModelClient.ts               # UPDATE: Add Responses API method signatures
│   │   ├── types/
│   │   │   ├── ResponsesAPI.ts          # UPDATE: Add literal types, ToolSpec
│   │   │   ├── ResponseEvent.ts         # No changes needed (already aligned)
│   │   │   └── RateLimits.ts           # No changes needed
│   │   ├── PromptHelpers.ts             # CREATE NEW: Helper functions
│   │   └── __tests__/
│   │       ├── OpenAIClient.contract.test.ts     # UPDATE: Add new contract tests
│   │       ├── Prompt.contract.test.ts           # CREATE NEW
│   │       └── integration.test.ts               # UPDATE: Test updated Prompt usage
│   └── core/
│       ├── TurnManager.ts               # UPDATE: Build Prompt structure
│       ├── Session.ts                   # UPDATE: Provide user_instructions context
│       └── __tests__/
│           └── TurnManager.integration.test.ts   # UPDATE: Test Prompt integration
└── tests/
    └── contract/                        # May not exist yet
        └── rust-alignment/              # CREATE NEW directory if needed
            ├── prompt-structure.test.ts
            └── request-payload.test.ts
```

**Structure Decision**: Single TypeScript project (Chrome Extension). The refactoring updates existing files in codex-chrome/ rather than creating parallel structures. Key updates:
- ResponsesAPI.ts: Add literal types, ToolSpec enum
- PromptHelpers.ts: New file for utility functions
- OpenAIClient.ts: Refactor existing stream() method
- TurnManager.ts: Update to build Prompt objects

## Phase 0: Outline & Research (Updated for In-Place Modification)

**Objective**: Scan existing TypeScript implementation and identify gaps compared to Rust.

### Existing Code Scan Results

**File Analyzed**: `codex-chrome/src/models/types/ResponsesAPI.ts`

**Findings**:
1. ✅ `Prompt` interface exists with correct fields
2. ✅ `ResponsesApiRequest` interface exists with correct fields
3. ✅ Supporting interfaces exist: `Reasoning`, `TextControls`, `ModelFamily`, `ModelProviderInfo`
4. ❌ **Gap**: `tool_choice` is `string` instead of literal `"auto"`
5. ❌ **Gap**: `parallel_tool_calls` is `boolean` instead of literal `false`
6. ❌ **Gap**: `stream` is `boolean` instead of literal `true`
7. ❌ **Gap**: Missing `ToolSpec` discriminated union type
8. ❌ **Gap**: Missing helper functions `get_full_instructions()` and `get_formatted_input()`

**File Analyzed**: `codex-chrome/src/models/OpenAIClient.ts`

**Findings**:
1. ✅ OpenAIClient class exists with stream() method
2. ❌ **Gap**: stream() method accepts `CompletionRequest` instead of `Prompt`
3. ❌ **Gap**: buildCompletionRequest() doesn't follow Rust's payload structure
4. ❌ **Gap**: Missing Responses API headers (OpenAI-Beta, conversation_id)
5. ❌ **Gap**: Retry logic doesn't match Rust's StreamAttemptError pattern

### Research Decisions (Updated)

All 8 research decisions from original research.md remain valid. Key addition:

**9. In-Place Modification Strategy**
- **Decision**: Update existing interfaces and methods rather than create new ones
- **Rationale**: Minimizes breaking changes, leverages existing test coverage, reduces code duplication
- **Approach**:
  1. Update ResponsesAPI.ts interfaces with literal types
  2. Add ToolSpec type to same file
  3. Create PromptHelpers.ts for utility functions
  4. Refactor OpenAIClient.stream() signature
  5. Update TurnManager to use Prompt structure

**Output**: research.md with existing code scan and gap analysis (already created and updated)

## Phase 1: Design & Contracts (Updated)

**Prerequisites**: research.md complete ✓

### 1. Data Model Updates (`data-model.md`)

Document the **updates to existing entities** (not new entities):

**ResponsesApiRequest** (Update existing interface):
```typescript
// BEFORE (current)
export interface ResponsesApiRequest {
  tool_choice: string;           // Too permissive
  parallel_tool_calls: boolean;   // Too permissive
  stream: boolean;                // Too permissive
  // ... other fields
}

// AFTER (updated to match Rust)
export interface ResponsesApiRequest {
  tool_choice: "auto";            // Literal type
  parallel_tool_calls: false;     // Literal type
  stream: true;                   // Literal type
  // ... other fields unchanged
}
```

**ToolSpec** (Add to existing ResponsesAPI.ts):
```typescript
// NEW discriminated union type
export type ToolSpec =
  | { type: 'function'; function: ResponsesApiTool }
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | { type: 'custom'; custom: FreeformTool };

export interface ResponsesApiTool {
  name: string;
  description: string;
  strict: boolean;
  parameters: any; // JSON Schema
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

**PromptHelpers** (Create new utility file):
```typescript
// NEW FILE: codex-chrome/src/models/PromptHelpers.ts
export function get_full_instructions(prompt: Prompt, model: ModelFamily): string {
  const base = prompt.base_instructions_override || model.base_instructions;
  const parts = [base];
  if (prompt.user_instructions) {
    parts.push(prompt.user_instructions);
  }
  return parts.join('\n');
}

export function get_formatted_input(prompt: Prompt): ResponseItem[] {
  return [...prompt.input]; // Clone array
}
```

### 2. API Contracts (`/contracts/`)

Contracts already created - no changes needed:
- prompt-interface.contract.md ✓
- responses-api-request.contract.md ✓
- stream-method.contract.md ✓

### 3. Contract Tests

Update existing test files to verify literal types:

**File**: `codex-chrome/src/models/__tests__/ResponsesApiRequest.contract.test.ts`
```typescript
it('should enforce tool_choice literal type', () => {
  const request: ResponsesApiRequest = {
    // ...
    tool_choice: 'auto', // Must be literal "auto"
  };

  expect(request.tool_choice).toBe('auto');

  // TypeScript compile error (demonstrates type safety):
  // const invalid: ResponsesApiRequest = { ...request, tool_choice: 'none' }; // Error!
});
```

### 4. Integration Test Scenarios

Quickstart.md already created with 6 validation scenarios ✓

### 5. Agent File Update

Already executed: `.specify/scripts/bash/update-agent-context.sh claude` ✓

**Output**: Updated data-model.md (documents updates), contracts (already exist), quickstart.md (already exists), CLAUDE.md (already updated)

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy** (Updated for in-place modification):
1. Load `.specify/templates/tasks-template.md` as base
2. Generate tasks from Phase 1 design docs with focus on **updating existing code**:
   - Update tasks (not create tasks) for existing interfaces
   - Create tasks for new utility files only
   - Refactor tasks for existing methods
   - Test update tasks for existing test files

**Ordering Strategy**:
- **TDD order**: Update contract tests before implementation
- **Dependency order**:
  1. Update type definitions in ResponsesAPI.ts (literal types, ToolSpec)
  2. Create PromptHelpers.ts with utility functions
  3. Update OpenAIClient.stream() signature and implementation
  4. Update TurnManager to build Prompt
  5. Update Session to provide user_instructions
  6. Update integration tests
  7. Run quickstart validation
- **Parallel execution markers [P]**: Independent file updates

**Task Categories** (Updated):
- **Phase 1 (Type Updates)**: 4-6 tasks
  - Update ResponsesApiRequest interface with literal types
  - Add ToolSpec discriminated union to ResponsesAPI.ts
  - Create PromptHelpers.ts with get_full_instructions() and get_formatted_input()
  - Update existing contract tests to verify literal types [P]

- **Phase 2 (Client Refactoring)**: 8-10 tasks
  - Refactor OpenAIClient.stream() to accept Prompt parameter
  - Update buildCompletionRequest() to use Prompt helpers
  - Add Responses API headers (OpenAI-Beta, conversation_id, session_id)
  - Update attemptStreamResponses() retry logic
  - Update Azure endpoint detection and item ID attachment
  - Update OpenAIResponsesClient if needed

- **Phase 3 (Integration Updates)**: 6-8 tasks
  - Update TurnManager.buildCompletionRequest() to create Prompt
  - Update Session to provide user_instructions field
  - Update tool conversion utilities for ToolSpec format
  - Update TurnManager integration tests
  - Update Session integration tests [P]

- **Phase 4 (Validation)**: 3-4 tasks
  - Execute quickstart.md scenarios
  - Run full test suite and verify no regressions
  - Verify backward compatibility with existing code
  - Update documentation

**Estimated Output**: 21-28 numbered, ordered tasks in tasks.md

**Key Difference from Original Plan**: Tasks focus on **updating** existing files rather than creating new structures. This reduces implementation complexity and risk of breaking changes.

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following test-first principles)
**Phase 5**: Validation (run all tests, execute quickstart.md, verify no regressions)

## Complexity Tracking

*No constitutional violations - section left empty*

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (with existing code scan) (/plan command)
- [x] Phase 1: Design complete (updated for in-place modification) (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (no violations)
- [x] Post-Design Constitution Check: PASS (no new violations)
- [x] All NEEDS CLARIFICATION resolved (explicit requirements provided)
- [x] Complexity deviations documented (none)
- [x] Existing code scanned and gaps identified

---
*Implementation plan ready for /tasks command - focuses on updating existing code rather than creating new structures*
