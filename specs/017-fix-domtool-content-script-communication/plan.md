# Implementation Plan: Fix DOMTool Content Script Communication

**Branch**: `017-fix-domtool-content-script-communication` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-fix-domtool-content-script-communication/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detected: CSP-blocked sites handling (edge case, non-blocking)
   → Project Type: single (Chrome Extension)
   → Structure Decision: Fix existing communication layer
3. Evaluate Constitution Check section below
   → No violations - aligning existing components
   → Update Progress Tracking: Initial Constitution Check PASS
4. Execute Phase 0 → research.md
   → Research message passing patterns, error handling
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, AGENTS.md
   → Define message contracts, error types, communication flow
6. Re-evaluate Constitution Check section
   → No new violations introduced
   → Update Progress Tracking: Post-Design Constitution Check PASS
7. Plan Phase 2 → Describe task generation approach
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Fix the message communication mismatch between DOMTool (background script) and content-script (page context) that causes DOM operations to fail with misleading "host-permission restriction" errors. The core issue is that DOMTool sends 'DOM_ACTION' messages while content script expects 'TOOL_EXECUTE' messages. This fix will align message types, ensure all 25 DOM operations are properly mapped, and provide clear error messages distinguishing between communication failures and actual permission issues.

## Technical Context
**Language/Version**: TypeScript 5.x (Chrome Extension Manifest V3)
**Primary Dependencies**: Chrome Extension APIs (chrome.tabs.sendMessage, chrome.runtime.onMessage), Chrome Scripting API, MessageRouter
**Storage**: N/A (stateless message passing)
**Testing**: Unit tests for message handlers, integration tests for end-to-end DOM operations
**Target Platform**: Chrome Browser (Chromium-based browsers)
**Project Type**: single (Chrome Extension)
**Performance Goals**: <100ms message round-trip time, >99% success rate for supported operations
**Constraints**: Chrome message passing limits (6MB), content script injection timing, cross-origin restrictions
**Scale/Scope**: Fix 2 files (DOMTool.ts, content-script.ts), align 25 DOM operations, improve error handling

**Known Issues (from diagnosis)**:
1. Message type mismatch: 'DOM_ACTION' vs 'TOOL_EXECUTE' (DOMTool.ts:872-877, content-script.ts:71-74)
2. Operation mapping gap: DOMTool defines 25 ops, content script implements subset
3. Error message confusion: "No response" interpreted as "permission denied"
4. Race condition: Operations sent before content script fully initializes

**User Context (from input)**:
- Agent uses GPT-5 (via OpenAIResponsesClient.ts) to drive DOM operations
- LLM fails to read page content on wsj.com despite correct manifest permissions
- Error messages mislead the LLM about root cause (permission vs communication)
- Converts terminal-based codex-rs agent to browser-based codex-chrome agent

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution is not yet defined at `.specify/memory/constitution.md`, proceeding with general best practices:
- ✅ Minimal change scope - Fix existing communication, no architectural changes
- ✅ Backward compatibility - Maintain existing API surface for DOMTool
- ✅ Clear error handling - Distinguish error types for better debugging
- ✅ Testability - Message handlers can be unit tested independently
- ✅ Performance - No additional overhead, fix existing bottleneck

**No violations detected**. This is a bug fix that improves existing functionality without adding complexity.

## Project Structure

### Documentation (this feature)
```
specs/017-fix-domtool-content-script-communication/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── message-types.ts     # Message type definitions
│   └── error-types.ts       # Error classification
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── tools/
│   │   ├── DOMTool.ts              # MODIFY: Fix message type, error handling
│   │   └── dom/
│   │       └── chrome/
│   │           └── contentScript.ts # Helper functions (already exist)
│   ├── content/
│   │   └── content-script.ts       # MODIFY: Add DOM_ACTION handler, map all 25 ops
│   ├── models/
│   │   └── OpenAIResponsesClient.ts # REVIEW: Ensure error pass-through
│   └── core/
│       └── MessageRouter.ts        # REVIEW: Message routing logic
└── tests/
    ├── unit/
    │   ├── tools/
    │   │   └── DOMTool.test.ts        # ADD: Message type tests
    │   └── content/
    │       └── content-script.test.ts  # ADD: Handler mapping tests
    └── integration/
        └── dom-communication.test.ts   # ADD: End-to-end tests
```

**Structure Decision**: Minimal intervention - fix the two files with mismatched message handling (DOMTool.ts and content-script.ts) while maintaining existing architecture and dependencies. No new modules or major refactoring required.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - NEEDS CLARIFICATION: CSP-blocked sites handling → Research CSP detection patterns
   - Best practices for Chrome extension message passing error handling
   - Patterns for content script initialization verification
   - LLM error message interpretation impact

2. **Generate and dispatch research tasks**:
   ```
   Task 1: "Research Chrome extension message passing patterns for robust error handling"
   Task 2: "Find patterns for content script ready-state verification in Manifest V3"
   Task 3: "Research CSP detection and graceful degradation strategies"
   Task 4: "Analyze how error message clarity affects LLM agent performance"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - DOM Operation Request (action, selector, options, requestId)
   - DOM Operation Response (success, data, error)
   - Content Script State (loaded, initialized, ready)
   - Message Route (type, payload, sender, receiver)
   - Operation Error (code, message, operation, context)

2. **Generate API contracts** from functional requirements:
   - Message type contract: Unified 'DOM_ACTION' or switch to 'TOOL_EXECUTE'
   - Operation mapping contract: All 25 operations with parameter schemas
   - Error response contract: Structured error with type, message, actionable guidance
   - Health check contract: PING/PONG protocol
   - Output TypeScript interfaces to `/contracts/`

3. **Generate contract tests** from contracts:
   - Test: DOMTool sends messages in correct format
   - Test: Content script handles all 25 operation types
   - Test: Error responses include operation context
   - Test: PING/PONG verifies content script availability
   - Tests must fail (implementation not fixed yet)

4. **Extract test scenarios** from user stories:
   - Scenario: Open wsj.com and extract headline (FR-001, FR-002)
   - Scenario: Handle element not found vs communication failure (FR-003, FR-010)
   - Scenario: Verify content script before operation (FR-005, FR-015)
   - Scenario: All 25 operations execute successfully (FR-002)

5. **Update agent file incrementally** (O(1) operation):
   - Check if AGENTS.md exists (for opencode/general agent context)
   - Add: TypeScript 5.x + Chrome Extension Manifest V3
   - Add: Chrome Extension APIs (tabs, scripting, runtime messaging)
   - Add: Message passing architecture (background ↔ content script)
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*.ts, failing tests, quickstart.md, AGENTS.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load spec requirements and diagnosis
- Create tasks in dependency order: diagnose → fix → test → validate
- Each task is atomic and testable
- Include verification steps for each task

**Specific Task Categories**:
1. **Diagnostic Tasks** (3-4 tasks)
   - Trace actual message flow from DOMTool to content script
   - Identify all 25 operations and their current mapping status
   - Document error path and message transformation
   - Verify PING/PONG implementation correctness

2. **Fix Tasks** (5-7 tasks)
   - Align message type between DOMTool and content script
   - Implement missing operation mappings in content script
   - Add structured error responses with error codes
   - Improve content script initialization verification
   - Add retry logic for transient failures
   - Enhance error messages with actionable guidance

3. **Test Tasks** (4-5 tasks) [P]
   - Unit tests for each message handler
   - Integration tests for all 25 operations
   - Error scenario tests (timeout, injection failure, element not found)
   - End-to-end test: wsj.com headline extraction

4. **Validation Tasks** (2-3 tasks)
   - Verify error messages are LLM-friendly
   - Performance test: message round-trip time
   - Cross-site compatibility test (wsj.com, github.com, google.com)

**Ordering Strategy**:
- Diagnostic tasks first (understand current state)
- Core fix tasks (message alignment, operation mapping)
- Error handling improvements
- Tests in parallel with fixes (TDD)
- Validation last (ensure fix works end-to-end)

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, verify wsj.com scenario)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. This is a straightforward bug fix with:
- 2 files modified (DOMTool.ts, content-script.ts)
- No new dependencies
- No architectural changes
- Clear scope and boundaries

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (CSP handling documented as edge case)
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- [x] plan.md (this file)
- [x] research.md (Phase 0 output)
- [x] data-model.md (Phase 1 output)
- [x] contracts/message-types.ts (Phase 1 output)
- [x] quickstart.md (Phase 1 output)
- [x] AGENTS.md updated (Phase 1 output)

---
*Based on general best practices - Constitution v2.1.1 not yet defined at `.specify/memory/constitution.md`*
