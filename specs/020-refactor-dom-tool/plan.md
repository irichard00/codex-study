
# Implementation Plan: Refactor DOMTool to High-Level DOM Reading

**Branch**: `020-refactor-dom-tool` | **Date**: 2025-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-refactor-dom-tool/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Refactor the DOMTool from atomic element operations (query, click, type, etc.) to a single high-level `captureDOM()` operation that captures and serializes the entire DOM structure. The implementation calls `get_serialized_dom_tree()` from the existing DomService to provide AI agents with comprehensive page snapshots including DOM tree, accessibility tree, element metadata, and visibility information. The response includes both `serialized_tree` (for LLM consumption) and `selector_map` (for direct element detail lookup), eliminating the need for a separate `getElement()` method.

## Technical Context
**Language/Version**: TypeScript 5.9+ (ES2020 target)
**Primary Dependencies**: Chrome Extension APIs (chrome.tabs, chrome.scripting, chrome.debugger), Svelte 4.2, Vite 5.4, Zod 3.23 for validation
**Storage**: N/A (operates on in-memory DOM state)
**Testing**: Vitest 3.2, @testing-library/svelte, jsdom for DOM mocking
**Target Platform**: Chrome Extension (Manifest V3), browser environment
**Project Type**: Single project (Chrome extension with background/content/sidepanel structure)
**Performance Goals**: <500ms for DOM capture on typical pages (<5000 nodes), <2s for complex pages (<20000 nodes)
**Constraints**: Chrome extension security model (CSP, cross-origin restrictions), memory efficient serialization for LLM token limits, max 15 iframes and depth 3
**Scale/Scope**: Handle web pages with up to 20,000 DOM nodes, support nested iframes and shadow DOM, provide accessibility tree integration
**User Implementation Details**:
- Refactor codex-chrome/src/tools/DOMTool.ts to utilize codex-chrome/src/tools/dom/service.ts
- Only implement captureDOM() which calls get_serialized_dom_tree() from service.ts
- No need to implement getElement() - simplified scope
- Fix potential bugs in service.ts to fit Chrome extension use case (replace CDP calls with Chrome APIs)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS - No constitutional violations

Since the project constitution is not yet fully defined (template only), applying general software engineering principles:
- ✅ **Simplicity**: Refactoring existing code to use existing service (DomService) - no new complex abstractions
- ✅ **Testability**: Will maintain existing test structure with Vitest, add contract tests for new interface
- ✅ **Single Responsibility**: DOMTool will focus solely on high-level DOM reading, delegating to DomService for tree operations
- ✅ **No Over-Engineering**: Removing atomic operations reduces complexity, DomService already exists
- ✅ **Chrome Extension Best Practices**: Following Manifest V3 patterns, proper use of content scripts and background service workers

**Notes**: This is a simplification refactor - reducing the API surface from 23+ atomic operations to 1-2 high-level operations.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── tools/
│   │   ├── DOMTool.ts           # Main refactor target - simplify to high-level operations
│   │   ├── BaseTool.ts           # Base class for all tools
│   │   └── dom/
│   │       ├── service.ts        # DomService - needs Chrome API adaptation
│   │       ├── serializer/
│   │       │   └── serializer.ts # DOM tree serialization logic
│   │       ├── views.ts          # Type definitions for DOM structures
│   │       ├── enhancedSnapshot.ts # Snapshot processing utilities
│   │       └── chrome/
│   │           └── contentScript.ts # Chrome-specific DOM access
│   ├── content/
│   │   └── content-script.ts    # Content script entry point
│   ├── background/
│   │   └── background.ts        # Background service worker
│   └── core/
│       ├── CodexAgent.ts        # Agent using DOMTool
│       └── MessageRouter.ts     # Message routing
├── tests/
│   ├── tools/
│   │   └── DOMTool.test.ts      # DOMTool tests
│   └── integration/
└── specs/020-refactor-dom-tool/ # This feature's design docs
    ├── spec.md
    ├── plan.md                   # This file
    ├── research.md               # Phase 0 output
    ├── data-model.md             # Phase 1 output
    ├── quickstart.md             # Phase 1 output
    ├── contracts/                # Phase 1 output
    └── tasks.md                  # Phase 2 output (via /tasks command)
```

**Structure Decision**: Single project (Chrome extension) with modular tool architecture. The refactoring focuses on `src/tools/DOMTool.ts` and `src/tools/dom/service.ts`, maintaining the existing Chrome extension structure with background/content/sidepanel separation.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

The /tasks command will create tasks.md with the following task categories:

1. **Contract Tests** (TDD - write tests first):
   - Test for DOMCaptureRequest validation
   - Test for DOMCaptureResponse structure (includes selector_map)
   - Test for error handling (all error codes)
   - Test for caching behavior
   - Mark [P] - can be written in parallel

2. **Content Script Implementation**:
   - Implement DOM traversal in content script
   - Implement snapshot capture (bounds, styles, attributes)
   - Implement string interning for efficient transfer
   - Implement ARIA attribute extraction
   - Implement iframe detection and traversal
   - Implement shadow DOM detection and traversal
   - Dependencies: Must complete in order

3. **DomService Chrome API Adaptation**:
   - Refactor `_get_targets_for_page()` to use chrome.webNavigation
   - Refactor `_get_viewport_ratio()` to use content script query
   - Refactor `_get_all_trees()` to delegate to content script
   - Implement `_get_ax_tree_for_all_frames()` with ARIA fallback
   - Add Chrome API error handling
   - Dependencies: Content script must exist first

4. **DOMTool Refactoring**:
   - Remove atomic operation methods (query, click, type, etc.)
   - Implement `captureDOM()` method that calls `get_serialized_dom_tree()` from DomService
   - Implement `clearCache()` method
   - Add request validation using Zod schemas
   - Update tool definition for BaseTool
   - Return selector_map in response for direct element lookup
   - Dependencies: DomService must be adapted first

5. **Caching Layer**:
   - Implement cache storage (Map-based LRU)
   - Implement cache key generation
   - Implement cache invalidation on navigation
   - Add cache metrics
   - Mark [P] with DOMTool refactor

6. **Message Passing**:
   - Define message protocol between background and content script
   - Implement message handlers in content script
   - Implement message handlers in background
   - Add timeout handling
   - Add error propagation

7. **Integration Tests**:
   - Test full DOM capture flow (background → content → background)
   - Test selector_map element lookup
   - Test caching behavior
   - Test error scenarios (cross-origin, timeout, etc.)
   - Test with real HTML fixtures
   - Dependencies: All implementation complete

8. **Performance Optimization**:
   - Add performance timing instrumentation
   - Test with large pages (10,000+ nodes)
   - Optimize string interning
   - Optimize tree traversal
   - Dependencies: Integration tests passing

9. **Documentation Updates**:
   - Update CLAUDE.md with new API
   - Add JSDoc comments to all public methods
   - Update README if needed
   - Mark [P] with implementation

**Ordering Strategy**:
1. Contract tests (Phase 1) - [P]
2. Content script implementation (Phase 2) - Sequential
3. DomService adaptation (Phase 3) - Depends on content script
4. DOMTool refactoring (Phase 4) - Depends on DomService
5. Message passing (Phase 5) - Can be parallel with Phase 4
6. Caching (Phase 6) - Depends on Phase 4
7. Integration tests (Phase 7) - Depends on all above
8. Performance optimization (Phase 8) - Depends on Phase 7
9. Documentation (Phase 9) - [P] with Phase 4-6

**Estimated Output**: ~40-50 numbered, ordered tasks in tasks.md

**Key Dependencies**:
- Tests → Implementation (TDD)
- Content script → DomService → DOMTool (architectural)
- Implementation → Integration tests → Performance (validation)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command) - tasks.md created with 44 ordered tasks
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (via user-provided implementation details)
- [x] Complexity deviations documented (N/A - simplification refactor)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
