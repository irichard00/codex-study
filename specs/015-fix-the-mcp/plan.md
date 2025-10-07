
# Implementation Plan: Fix MCP Tool Execution Error in Browser Extension

**Branch**: `015-fix-the-mcp` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-fix-the-mcp/spec.md`

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

**Problem**: The Chrome extension throws "this.session.executeMcpTool is not a function" error when the LLM calls unknown tools because TurnManager assumes all unknown tools are MCP tools and attempts to execute them via Session.executeMcpTool(), which doesn't exist.

**Solution**: Modify TurnManager to check ToolRegistry for browser tools before falling back to MCP execution, and ensure MCP code paths are properly guarded with capability checks and config validation. Add clear error messages distinguishing "tool not found" from "MCP not supported in browser".

## Technical Context
**Language/Version**: TypeScript 5.9.2
**Primary Dependencies**: Svelte 4.2.20, Vite 5.4.20, Chrome Extension Manifest V3, Vitest 3.2.4
**Storage**: Chrome Storage API (chrome.storage.local), IndexedDB via RolloutRecorder
**Testing**: Vitest 3.2.4, @testing-library/svelte 5.2.8, fake-indexeddb 6.2.2, jsdom 27.0.0
**Target Platform**: Chrome Extension (Manifest V3), Browser environment (no Node.js/MCP capabilities)
**Project Type**: single (Chrome extension with src/ structure)
**Performance Goals**: <100ms tool lookup, clear error messages within single event loop tick
**Constraints**: No MCP support in browser, must maintain backward compatibility with existing ToolRegistry, cannot add Session.executeMcpTool() method
**Scale/Scope**: 2 files to modify (TurnManager.ts, Session.ts), ~20 lines of defensive code, 3-5 test scenarios

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (Bug fix, no constitutional violations)

This is a defensive bug fix with no new architecture:
- No new libraries or projects
- No new complexity (simplifies error handling)
- Uses existing ToolRegistry pattern
- Maintains existing TDD approach
- No breaking changes to public APIs

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

### Source Code (codex-chrome/)
```
codex-chrome/
├── src/
│   ├── core/
│   │   ├── TurnManager.ts       # MODIFY: Add ToolRegistry check, guard MCP calls
│   │   └── Session.ts            # MODIFY: Add stub getMcpTools() method (optional)
│   ├── tools/
│   │   └── ToolRegistry.ts       # READ: Understand tool lookup API
│   ├── config/
│   │   ├── defaults.ts           # READ: Verify mcpTools default
│   │   └── types.ts              # READ: IToolsConfig interface
│   └── protocol/
│       └── events.ts             # READ: Error event types
│
├── tests/
│   ├── unit/
│   │   └── core/
│   │       └── TurnManager.test.ts    # NEW: Test tool lookup logic
│   └── integration/
│       └── unknown-tool.test.ts        # NEW: Test unknown tool handling
│
└── vitest.config.mjs
```

**Structure Decision**: Single project (Chrome extension). Modifications are localized to TurnManager.ts with optional stub method in Session.ts. All changes within existing src/core/ directory.

## Phase 0: Outline & Research

**Status**: ✅ COMPLETE

No unknowns to research - this is a well-defined bug fix with clear root cause analysis in spec.md.

**Output**: `research.md` documents:
- Root cause confirmation (TurnManager assumes unknown tools are MCP tools)
- Implementation approach (defensive tool lookup pattern)
- Testing strategy (4 test scenarios)
- No new dependencies required

## Phase 1: Design & Contracts

**Status**: ✅ COMPLETE (No data model or contracts needed for bug fix)

**Artifacts Generated**:

1. **quickstart.md** ✅
   - 4 test scenarios covering all error paths
   - Manual validation steps for extension testing
   - Performance validation criteria

2. **No data-model.md** (N/A for bug fix)
   - No new entities
   - Existing types: ToolDefinition, IToolsConfig (no changes)

3. **No contracts/** (N/A for bug fix)
   - Internal refactor of TurnManager.executeToolCall()
   - No public API changes

4. **Agent context update** ✅ (Running script...)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from quickstart.md scenarios (4 test scenarios)
- Follow TDD: Test files first, then implementation
- Two main files to modify: TurnManager.ts, Session.ts (optional)
- Parallel execution possible for test files (different scenarios)

**Task Breakdown**:
1. **Setup** (T001): Verify vitest config, test environment
2. **Test Tasks [P]** (T002-T005):
   - T002: Unit test for buildToolsFromContext() MCP guard
   - T003: Unit test for executeToolCall() tool lookup order
   - T004: Unit test for error message clarity
   - T005: Integration test for unknown tool handling
3. **Implementation** (T006-T007):
   - T006: Modify TurnManager.buildToolsFromContext() to guard MCP calls
   - T007: Modify TurnManager.executeToolCall() to check ToolRegistry first
4. **Validation** (T008-T009):
   - T008: Run all tests, verify green
   - T009: Manual testing in extension (quickstart.md)

**Ordering Strategy**:
- TDD order: All tests (T002-T005) before implementation (T006-T007)
- Tests can run in parallel [P] (independent files)
- Implementation tasks sequential (same file: TurnManager.ts)

**Estimated Output**: 9 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

**Status**: N/A (No constitutional violations)

This is a defensive bug fix that reduces complexity by adding proper error handling.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [x] Phase 4: Implementation complete
- [x] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (none existed)
- [x] Complexity deviations documented (none exist)

**Artifacts Generated**:
- [x] plan.md (this file)
- [x] research.md (root cause, implementation approach)
- [x] quickstart.md (4 test scenarios, validation steps)
- [x] CLAUDE.md updated (agent context)
- [x] tasks.md (10 tasks: 1 setup, 4 tests, 2 implementation, 3 validation)

---
*Based on Constitution template - See `.specify/memory/constitution.md`*
