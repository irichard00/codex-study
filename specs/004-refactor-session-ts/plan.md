# Implementation Plan: Refactor Session.ts to Match Rust Updates

**Branch**: `004-refactor-session-ts` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-refactor-session-ts/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded, 24 functional requirements identified
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ TypeScript/Node.js environment, Chrome extension context
   → ✅ User provided explicit clarifications about SessionState and SessionServices
3. Fill the Constitution Check section
   → ⚠️  Constitution template not populated, proceeding with standard practices
4. Evaluate Constitution Check section
   → ✅ No violations, following modular architecture principles
5. Execute Phase 0 → research.md
   → ✅ Completed: Analyzed Rust commit 250b244ab, documented architectural changes
6. Execute Phase 1 → contracts, data-model.md, quickstart.md
   → ✅ data-model.md created with TypeScript type definitions
   → ✅ quickstart.md created with validation steps
   → ⚠️  No contracts/ needed (internal refactoring, no API changes)
7. Re-evaluate Constitution Check
   → ✅ Design maintains separation of concerns, testability, and type safety
8. Plan Phase 2 → Describe task generation approach
   → ✅ Documented below
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

**Primary Requirement**: Refactor the TypeScript Session class in codex-chrome to match the improved Rust implementation architecture from commit 250b244ab.

**Technical Approach**:
1. Create three new classes to separate concerns:
   - **SessionState**: Pure data container for conversation history, token tracking, and approved commands
   - **SessionServices**: Service collection for storage, notifications, and browser-specific operations (no MCP support in browser)
   - **ActiveTurn**: Turn lifecycle management with task tracking and pending state
2. Refactor existing Session class to delegate to these new classes
3. **Preserve all existing functionality** - no features removed, only structure improved
4. Maintain existing Session API for dependent code (CodexAgent, TurnManager)
5. Update only internal implementation, not external interface

**Key Benefit**: Improved code organization, testability, and alignment with the proven Rust architecture while maintaining all existing features.

**Note**: MCP (Model Context Protocol) is not implemented in codex-chrome as it's a browser-based agent without MCP support. SessionServices will focus on browser-specific services only.

**Important**: This is a **refactoring** (not a rewrite). All existing functionality must be preserved:
- Current Session methods remain available
- Existing export/import format maintained
- All features from current Session.ts preserved
- No functionality loss during refactoring

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22+
**Primary Dependencies**:
- `uuid` for conversation IDs
- Chrome Extension APIs (storage, notifications)
- Existing protocol types from `codex-chrome/src/protocol/`

**Storage**:
- IndexedDB via ConversationStore (existing)
- Chrome storage APIs for persistence
- Optional RolloutRecorder for session replay

**Testing**:
- Vitest for unit tests
- Manual testing in Chrome extension
- Integration tests for turn lifecycle

**Target Platform**: Chrome Extension (Manifest V3), modern browsers
**Project Type**: Single TypeScript project (Chrome extension)

**Performance Goals**:
- State operations (record, snapshot) < 100ms for 1000 items
- Session export/import < 50ms
- UI remains responsive during state operations

**Constraints**:
- Browser environment (no shell execution, no file system access, no MCP support)
- **Must preserve all existing functionality** - no feature removal
- Maintain existing public API for backward compatibility
- Internal refactoring only

**Scale/Scope**:
- Support conversation histories up to 10,000 messages
- Handle concurrent async operations safely
- Memory-efficient state snapshots

## Constitution Check

*Since no constitution file exists, applying standard software engineering principles:*

### Separation of Concerns ✅
- **Principle**: Each class has a single, well-defined responsibility
- **Application**: SessionState (data), SessionServices (dependencies), ActiveTurn (lifecycle)
- **Validation**: Clear boundaries, minimal coupling

### Testability ✅
- **Principle**: Code should be easily testable in isolation
- **Application**: Constructor injection for services, pure data classes
- **Validation**: Each new class can be unit tested independently

### Type Safety ✅
- **Principle**: Leverage TypeScript's type system for correctness
- **Application**: Strict interfaces, no `any` types, explicit return types
- **Validation**: All types defined in data-model.md

### Backward Compatibility ✅
- **Principle**: Refactor internal structure while preserving external behavior
- **Application**: Maintain existing API, preserve export/import format, keep all features
- **Validation**: All existing tests pass, no functionality regression

### Performance ✅
- **Principle**: Optimize for common operations
- **Application**: Defensive copying only when needed, efficient data structures
- **Validation**: Benchmark targets defined in quickstart.md

## Project Structure

### Documentation (this feature)
```
specs/004-refactor-session-ts/
├── plan.md              # This file (/plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output: Rust analysis
├── data-model.md        # Phase 1 output: TypeScript types
├── quickstart.md        # Phase 1 output: Validation guide
└── tasks.md             # Phase 2 output: (/tasks command - NOT created yet)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── core/
│   │   ├── Session.ts                    # Refactored to use state/ modules
│   │   ├── CodexAgent.ts                 # Updated to use new Session API
│   │   ├── TurnManager.ts                # Updated to use ActiveTurn
│   │   ├── State.ts                      # May be deprecated or reduced
│   │   ├── TurnContext.ts                # Existing, minimal changes
│   │   └── session/state/                        # NEW directory
│   │       ├── SessionState.ts           # NEW: Pure state container
│   │       ├── SessionServices.ts        # NEW: Service collection
│   │       ├── ActiveTurn.ts             # NEW: Turn lifecycle
│   │       ├── TurnState.ts              # NEW: Turn-scoped mutable state
│   │       ├── types.ts                  # NEW: Shared type definitions
│   │       ├── index.ts                  # NEW: Module exports
│   │       └── __tests__/
│   │           ├── SessionState.test.ts
│   │           ├── SessionServices.test.ts
│   │           ├── ActiveTurn.test.ts
│   │           └── TurnState.test.ts
│   ├── protocol/
│   │   └── types.ts                      # Existing protocol types
│   └── storage/
│       └── ConversationStore.ts          # Existing storage layer
└── tests/
    └── integration/
        └── session-refactor.test.ts      # NEW: Integration tests
```

**Structure Decision**: Single TypeScript project with new `state/` subdirectory under `core/` to organize the refactored state management classes. This keeps related code together while maintaining clear separation.

## Phase 0: Outline & Research ✅

**Status**: COMPLETED

**Output**: `research.md` (20 sections, comprehensive analysis)

**Key Findings**:

1. **Rust Refactoring (commit 250b244ab)**:
   - Separated Session into 3 layers: SessionState, SessionServices, ActiveTurn
   - SessionState: Pure data (history, tokens, approvals)
   - SessionServices: External dependencies (MCP, exec, rollout, notifier)
   - ActiveTurn: Turn-scoped state with task tracking

2. **TypeScript Mapping**:
   - Direct port possible for SessionState and ActiveTurn
   - SessionServices adapted for browser (no shell, add DOM/tabs)
   - Use AbortController instead of Rust's AbortHandle
   - Use async/await with Promise-based locks instead of Mutex<T>

3. **Browser Adaptations**:
   - Replace ExecSessionManager with browser-specific services
   - Use IndexedDB for rollout recording
   - Chrome notifications API for UserNotifier
   - No sandboxing layer needed

4. **Migration Strategy**:
   - Phase 1: Create new classes (non-breaking)
   - Phase 2: Refactor Session to use new classes (breaking)
   - Phase 3: Update dependent code
   - Phase 4: Cleanup and optimization

5. **Technology Decisions**:
   - Concurrency: async/await + explicit locks where needed
   - Task abort: AbortController (standard Web API)
   - State immutability: Defensive copying
   - Service injection: Constructor injection for testability

**Research Validation**:
- ✅ All NEEDS CLARIFICATION resolved
- ✅ Technology stack decisions documented
- ✅ Migration path defined
- ✅ Performance considerations identified
- ✅ Browser-specific adaptations planned

## Phase 1: Design & Contracts ✅

**Status**: COMPLETED

**Prerequisites**: research.md complete ✅

### 1. Data Model (`data-model.md`) ✅

**Entities Defined**:

1. **SessionState**:
   - Fields: approvedCommands, history, tokenInfo, latestRateLimits
   - Operations: recordItems, historySnapshot, replaceHistory, addApprovedCommand, updateTokenInfoFromUsage, setRateLimits
   - Export/import for persistence

2. **SessionServices**:
   - Fields: mcpConnectionManager, conversationStore, notifier, rolloutRecorder, domService, tabManager, showRawAgentReasoning
   - Factory function for initialization
   - Async initialization with parallel service startup

3. **ActiveTurn**:
   - Fields: tasks Map, TurnState
   - Operations: addTask, removeTask, drainTasks, clearPending, pushPendingInput, takePendingInput, abort
   - Owned by Session (0:1 relationship)

4. **TurnState**:
   - Fields: pendingApprovals Map, pendingInput array
   - Operations: insertPendingApproval, removePendingApproval, pushPendingInput, takePendingInput, clearPending
   - Owned by ActiveTurn (1:1 relationship)

5. **Refactored Session**:
   - Fields: conversationId, state (SessionState), services (SessionServices), activeTurn (ActiveTurn | null), eventEmitter, config
   - Delegates operations to owned objects
   - Export/import with backward compatibility

**Validation Rules**:
- ConversationId must be unique and non-empty
- Cannot start turn if activeTurn exists
- Cannot end turn if activeTurn is null
- Token counts must be non-negative
- History items must be valid ResponseItem objects

**State Transitions**:
```
Session: IDLE (activeTurn = null) ⟷ ACTIVE (activeTurn = ActiveTurn)
Turn: NULL → ActiveTurn → NULL (on complete/abort)
```

### 2. API Contracts (`contracts/`) ⚠️

**Status**: NOT CREATED (not applicable)

**Rationale**: This is an internal refactoring of the Session class. The public API of Session remains largely unchanged, so formal API contracts are not needed. The existing TypeScript types serve as the contract.

**Public API Stability**:
- Session constructor signature may change (breaking change handled via factory)
- Export/import format extended but backward compatible
- Core methods (recordInput, getConversationHistory, startTurn, endTurn) unchanged

### 3. Test Scenarios (`quickstart.md`) ✅

**Validation Phases**:

**Phase 1**: New state classes
- SessionState: history, tokens, approvals, export/import
- ActiveTurn: task management, pending input, abort
- TurnState: approvals, input queueing, clear operations

**Phase 2**: Refactored Session
- Initialization with services
- Turn lifecycle (start, end, abort)
- State delegation (history, tokens, commands)

**Phase 3**: Integration
- Full turn execution (input → tool calls → completion)
- Persistence round-trip (export → import → verify)
- Backward compatibility (old format → import → verify)

**Phase 4**: End-to-end
- Chrome extension loading
- Manual test scenarios (conversation, tools, approvals, persistence)
- Performance benchmarks

**Success Criteria**: All tests pass, no regressions, performance targets met

### 4. Agent Context Update ⚠️

**Status**: DEFERRED (will be done after implementation)

**Rationale**: CLAUDE.md should be updated after the implementation is complete and validated, not during planning. This ensures documentation reflects the actual implementation.

**Planned Updates**:
- Add new `state/` module to Core Components section
- Update Session architecture explanation
- Add migration guide for developers
- Update recent changes section

## Phase 2: Task Planning Approach

**Status**: READY FOR /tasks COMMAND

This section describes what the /tasks command will do - **DO NOT execute during /plan**.

### Task Generation Strategy

**Source Documents**:
1. `data-model.md`: Entity definitions and relationships
2. `research.md`: Migration phases and technology decisions
3. `quickstart.md`: Validation scenarios

**Task Categories**:

1. **Setup Tasks**:
   - Create `state/` directory structure
   - Set up test files with boilerplate
   - Configure TypeScript paths for new modules

2. **Implementation Tasks (TDD Order)**:
   - **SessionState**: Create class, write tests, implement methods
   - **TurnState**: Create class, write tests, implement methods
   - **ActiveTurn**: Create class (uses TurnState), write tests, implement methods
   - **SessionServices**: Create interface and factory, write tests
   - **Session Refactoring**: Refactor Session to delegate to new classes while preserving all existing methods

3. **Integration Tasks**:
   - Verify CodexAgent works with refactored Session (should work without changes)
   - Verify TurnManager works with refactored Session (should work without changes)
   - Test full turn execution flow
   - Ensure all existing tests pass

4. **Validation Tasks**:
   - Run all automated tests
   - Perform manual testing in Chrome
   - Run performance benchmarks
   - Verify no regressions

5. **Documentation Tasks**:
   - Update CLAUDE.md with new architecture
   - Add inline documentation to new classes
   - Update README if needed

### Ordering Strategy

**Principles**:
- TDD: Tests before implementation
- Dependency order: Low-level to high-level (TurnState → ActiveTurn → SessionState → Session)
- Parallel where possible: Mark independent tasks with [P]

**Dependency Graph**:
```
Setup [P]
  ↓
TurnState (tests → impl)
  ↓
ActiveTurn (tests → impl, depends on TurnState)
  ‖  (parallel)
SessionState (tests → impl, independent of ActiveTurn)
  ‖  (parallel)
SessionServices (interface → factory, independent)
  ↓
Session (refactor, depends on all above)
  ↓
CodexAgent (update, depends on Session)
  ‖  (parallel)
TurnManager (update, depends on ActiveTurn)
  ↓
Integration tests (depends on all)
  ↓
Documentation (depends on implementation)
```

### Task Template

Each task will follow this format:

```markdown
## Task N: [Task Name]

**Type**: [Setup|Implementation|Test|Integration|Documentation]
**Dependencies**: [Task IDs this depends on]
**Parallel**: [Yes|No] - Can run in parallel with other tasks
**Estimated Effort**: [S|M|L] - Small/Medium/Large

### Description
[What needs to be done]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Files Changed
- `path/to/file.ts` (create/modify/delete)

### Test Coverage
- Unit tests: path/to/test.ts
- Integration tests: path/to/integration.ts

### Validation
[How to verify this task is complete]
```

### Estimated Output

**Total Tasks**: ~25-30 tasks

**Breakdown**:
- Setup: 3 tasks
- TurnState: 2 tasks (test + impl)
- ActiveTurn: 2 tasks (test + impl)
- SessionState: 2 tasks (test + impl)
- SessionServices: 2 tasks (interface + factory)
- Session refactoring: 3 tasks (delegate methods + preserve API + test compatibility)
- Integration: 3 tasks (verify existing code works, regression tests)
- Documentation: 2 tasks
- Performance validation: 1 task
- Manual testing: 2 tasks

**Parallel Execution Opportunities**:
- Setup tasks [P]
- SessionState and ActiveTurn implementation [P]
- CodexAgent and TurnManager updates [P]
- Test file creation [P]

**Critical Path**: Setup → TurnState → ActiveTurn → Session → Integration → Documentation

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan.

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
- Will generate detailed, numbered tasks based on strategy above
- Each task will have clear acceptance criteria
- Tasks will be ordered by dependencies

**Phase 4**: Implementation (execute tasks.md following constitutional principles)
- Follow TDD: Write tests first
- Implement in dependency order
- Review and test continuously
- Maintain backward compatibility

**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)
- Run full test suite
- Execute all quickstart validation steps
- Verify performance benchmarks
- Test in Chrome extension manually
- Confirm no regressions

## Complexity Tracking

*No constitutional violations detected. Standard modular architecture applies.*

| Concern | Assessment | Justification |
|---------|------------|---------------|
| New abstractions | Appropriate | Matches proven Rust design, improves testability |
| Preserving functionality | Critical | Must maintain all existing features during refactoring |
| Browser adaptations | Necessary | Chrome extension has different capabilities than terminal |
| Multiple new files | Appropriate | Separation of concerns, better organization |

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning approach documented (/plan command) ✅
- [ ] Phase 3: Tasks generated (/tasks command) - READY
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented ✅

**Artifact Status**:
- [x] research.md created ✅
- [x] data-model.md created ✅
- [x] quickstart.md created ✅
- [ ] tasks.md created (awaiting /tasks command)

---

## Summary for /tasks Command

**Ready for task generation**: ✅

**Key Inputs**:
1. **data-model.md**: 5 core entities defined with complete interfaces
2. **research.md**: 4-phase migration strategy documented
3. **quickstart.md**: 10 validation scenarios defined

**Task Generation Parameters**:
- Total tasks: ~25-30
- Parallel opportunities: ~8 tasks can run in parallel
- Critical path: 12-15 tasks
- Test coverage target: >85% for new code

**Next Command**: `/tasks` to generate detailed task breakdown in tasks.md

---

*Based on user-provided context: Rust commit 250b244ab introduced SessionState (state/session.rs) and SessionServices (state/service.rs) to improve organization. This plan applies the same architectural improvement to the TypeScript implementation.*
