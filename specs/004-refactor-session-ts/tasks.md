# Tasks: Refactor Session.ts to Match Rust Implementation

**Input**: Design documents from `/specs/004-refactor-session-ts/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), quickstart.md (✓)
**Branch**: `004-refactor-session-ts`

**⚠️ CRITICAL REQUIREMENT ⚠️**
**This is a REFACTORING, not a rewrite. All existing Session.ts functionality MUST be preserved:**
- All existing methods must remain available
- Export/import format must stay compatible
- All features from current Session.ts must work
- CodexAgent and TurnManager should work without changes
- NO functionality loss allowed

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✓ Loaded: TypeScript 5.x, Chrome extension, Vitest
   → ✓ Structure: codex-chrome/src/core/state/ (new)
2. Load optional design documents:
   → ✓ data-model.md: 5 entities (SessionState, SessionServices, ActiveTurn, TurnState, Session)
   → ✓ research.md: Breaking change, no MCP, no backward compat
   → ✓ quickstart.md: 10 validation scenarios
3. Generate tasks by category:
   → Setup: 3 tasks (directory, types, tests)
   → Tests First (TDD): 8 tasks (state classes)
   → Core Implementation: 10 tasks (state classes + Session rewrite)
   → Integration: 4 tasks (CodexAgent, TurnManager, cleanup)
   → Validation: 3 tasks (tests, performance, manual)
   → Documentation: 2 tasks (CLAUDE.md, inline docs)
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T030)
6. Generate dependency graph (below)
7. Create parallel execution examples (below)
8. Validate task completeness:
   → ✓ All entities have tests and implementation
   → ✓ All quickstart scenarios covered
   → ✓ TDD order maintained
9. Return: SUCCESS (30 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **Refactoring**: Preserve all existing functionality, improve structure only

## Path Conventions
- **Project**: TypeScript Chrome Extension
- **Base**: `codex-chrome/src/core/`
- **New Directory**: `codex-chrome/src/core/state/`
- **Tests**: `codex-chrome/src/core/state/__tests__/`

---

## Phase 3.1: Setup

### T001: Create state directory structure
**Type**: Setup
**Dependencies**: None
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Create the new `state/` directory structure under `codex-chrome/src/core/` for the refactored state management classes.

**Acceptance Criteria**:
- [X] Directory `codex-chrome/src/core/session/state/` exists
- [X] Directory `codex-chrome/src/core/session/state/__tests__/` exists
- [X] File `codex-chrome/src/core/session/state/index.ts` created with module exports placeholder

**Files Changed**:
- `codex-chrome/src/core/state/` (create directory)
- `codex-chrome/src/core/state/__tests__/` (create directory)
- `codex-chrome/src/core/state/index.ts` (create)

**Validation**:
```bash
ls -la codex-chrome/src/core/state/
ls -la codex-chrome/src/core/state/__tests__/
cat codex-chrome/src/core/state/index.ts
```

---

### T002: Create shared types file
**Type**: Setup
**Dependencies**: T001
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Create `types.ts` with shared type definitions for state management (TaskKind, RunningTask, ApprovalResolver, etc.).

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/types.ts` created
- [X] `TaskKind` enum defined (Regular, Review, Compact)
- [X] `RunningTask` interface defined
- [X] `ApprovalResolver` type defined
- [X] All types properly exported

**Files Changed**:
- `codex-chrome/src/core/state/types.ts` (create)

**Validation**:
```typescript
// Verify types compile
import { TaskKind, RunningTask, ApprovalResolver } from './state/types';
```

---

### T003: Configure Vitest for state module
**Type**: Setup
**Dependencies**: T001
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Ensure Vitest is configured to run tests in the new `state/__tests__/` directory.

**Acceptance Criteria**:
- [X] Vitest config includes `state/__tests__/**/*.test.ts` pattern
- [X] Test imports work correctly
- [X] Can run `npm test -- state/` successfully

**Files Changed**:
- `codex-chrome/vitest.config.ts` (modify if needed)

**Validation**:
```bash
npm test -- state/ --run
# Should show 0 tests (nothing written yet)
```

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### T004: Write TurnState unit tests
**Type**: Test
**Dependencies**: T002, T003
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Write comprehensive unit tests for TurnState class covering pending approvals and pending input management.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/__tests__/TurnState.test.ts` created
- [X] Test: insertPendingApproval adds approval resolver
- [X] Test: removePendingApproval removes and returns resolver
- [X] Test: pushPendingInput queues input
- [X] Test: takePendingInput consumes and clears input
- [X] Test: clearPending clears all pending state
- [X] All tests FAIL (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/src/core/state/__tests__/TurnState.test.ts` (create)

**Test Coverage**:
- Unit tests: All TurnState methods

**Validation**:
```bash
npm test -- TurnState.test.ts
# Should show all tests failing
```

---

### T005: Write ActiveTurn unit tests
**Type**: Test
**Dependencies**: T002, T003, T004
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Write comprehensive unit tests for ActiveTurn class covering task management and turn state delegation.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/__tests__/ActiveTurn.test.ts` created
- [X] Test: addTask registers task in map
- [X] Test: removeTask unregisters and returns empty flag
- [X] Test: drainTasks returns all tasks and clears map
- [X] Test: hasTask checks task existence
- [X] Test: clearPending delegates to TurnState
- [X] Test: abort cancels all tasks
- [X] All tests FAIL (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/src/core/state/__tests__/ActiveTurn.test.ts` (create)

**Test Coverage**:
- Unit tests: All ActiveTurn methods

**Validation**:
```bash
npm test -- ActiveTurn.test.ts
# Should show all tests failing
```

---

### T006: Write SessionState unit tests
**Type**: Test
**Dependencies**: T002, T003
**Parallel**: Yes [P]
**Estimated Effort**: L

**Description**:
Write comprehensive unit tests for SessionState class covering history, tokens, approvals, and rate limits.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/__tests__/SessionState.test.ts` created
- [X] Test: recordItems adds items to history
- [X] Test: historySnapshot returns deep copy
- [X] Test: replaceHistory replaces entire history
- [X] Test: addApprovedCommand adds to set
- [X] Test: updateTokenInfoFromUsage updates token tracking
- [X] Test: setRateLimits updates rate limits
- [X] Test: export/import round-trip preserves state
- [X] Test: historySnapshot immutability (modifications don't affect original)
- [X] All tests FAIL (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/src/core/state/__tests__/SessionState.test.ts` (create)

**Test Coverage**:
- Unit tests: All SessionState methods

**Validation**:
```bash
npm test -- SessionState.test.ts
# Should show all tests failing
```

---

### T007: Write SessionServices factory tests
**Type**: Test
**Dependencies**: T002, T003
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Write tests for SessionServices factory function covering service initialization.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/__tests__/SessionServices.test.ts` created
- [X] Test: createSessionServices with isPersistent=true creates ConversationStore
- [X] Test: createSessionServices with isPersistent=false skips ConversationStore
- [X] Test: UserNotifier is always created
- [X] Test: showRawAgentReasoning config is applied
- [X] All tests FAIL (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/src/core/state/__tests__/SessionServices.test.ts` (create)

**Test Coverage**:
- Unit tests: createSessionServices factory

**Validation**:
```bash
npm test -- SessionServices.test.ts
# Should show all tests failing
```

---

### T008: Write Session integration tests
**Type**: Test
**Dependencies**: T002, T003
**Parallel**: Yes [P]
**Estimated Effort**: L

**Description**:
Write integration tests for refactored Session class covering initialization, turn lifecycle, and state delegation.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/__tests__/Session.integration.test.ts` created
- [X] Test: Session initializes with default services
- [X] Test: Session initializes with provided services
- [X] Test: startTurn creates ActiveTurn
- [X] Test: endTurn destroys ActiveTurn
- [X] Test: cannot start turn when already active
- [X] Test: recordInput updates SessionState
- [X] Test: addTokenUsage updates SessionState
- [X] Test: export/import preserves session
- [X] All tests FAIL (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/src/core/__tests__/Session.integration.test.ts` (create)

**Test Coverage**:
- Integration tests: Session with all state components

**Validation**:
```bash
npm test -- Session.integration.test.ts
# Should show all tests failing
```

---

### T009: Write turn execution integration test
**Type**: Test
**Dependencies**: T003
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Write integration test for full turn execution flow (from quickstart.md Step 7).

**Acceptance Criteria**:
- [X] File `codex-chrome/tests/integration/turn-execution.test.ts` created
- [X] Test: Complete turn execution (start → input → tool call → end)
- [X] Test: Token usage is tracked
- [X] Test: History is preserved
- [X] Test: Turn completes successfully
- [X] Test FAILS (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/tests/integration/turn-execution.test.ts` (create)

**Test Coverage**:
- Integration test: Full turn lifecycle

**Validation**:
```bash
npm test -- turn-execution.test.ts
# Should show test failing
```

---

### T010: Write persistence integration test
**Type**: Test
**Dependencies**: T003
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Write integration test for session persistence round-trip (from quickstart.md Step 8).

**Acceptance Criteria**:
- [X] File `codex-chrome/tests/integration/session-persistence.test.ts` created
- [X] Test: Export session with data
- [X] Test: Create new session and import
- [X] Test: State is preserved (history, tokens, metadata)
- [X] Test FAILS (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/tests/integration/session-persistence.test.ts` (create)

**Test Coverage**:
- Integration test: Export/import round-trip

**Validation**:
```bash
npm test -- session-persistence.test.ts
# Should show test failing
```

---

### T011: Write fresh session creation test
**Type**: Test
**Dependencies**: T003
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Write test for fresh session creation with clean state (from quickstart.md Step 9).

**Acceptance Criteria**:
- [X] File `codex-chrome/tests/integration/fresh-session.test.ts` created
- [X] Test: New session has empty history
- [X] Test: No active turn initially
- [X] Test: Can add data and export
- [X] Test FAILS (implementation doesn't exist yet)

**Files Changed**:
- `codex-chrome/tests/integration/fresh-session.test.ts` (create)

**Test Coverage**:
- Integration test: Fresh session initialization

**Validation**:
```bash
npm test -- fresh-session.test.ts
# Should show test failing
```

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### T012: Implement TurnState class
**Type**: Implementation
**Dependencies**: T004 (test must fail first)
**Parallel**: No
**Estimated Effort**: M

**Description**:
Implement TurnState class with pending approvals and pending input management.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/TurnState.ts` created
- [X] Class TurnState implemented with all methods
- [X] Pending approvals Map correctly manages resolvers
- [X] Pending input array correctly queues and clears
- [X] All tests from T004 now PASS
- [X] No TypeScript errors

**Files Changed**:
- `codex-chrome/src/core/state/TurnState.ts` (create)

**Test Coverage**:
- Unit tests: `__tests__/TurnState.test.ts` (should pass)

**Validation**:
```bash
npm test -- TurnState.test.ts
# All tests should now PASS
npm run build
# Should compile without errors
```

---

### T013: Implement ActiveTurn class
**Type**: Implementation
**Dependencies**: T005 (test must fail first), T012
**Parallel**: No
**Estimated Effort**: M

**Description**:
Implement ActiveTurn class with task management and TurnState integration.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/ActiveTurn.ts` created
- [X] Class ActiveTurn implemented with all methods
- [X] Tasks Map correctly manages RunningTask objects
- [X] TurnState delegation works correctly
- [X] abort() cancels all tasks via AbortController
- [X] All tests from T005 now PASS
- [X] No TypeScript errors

**Files Changed**:
- `codex-chrome/src/core/state/ActiveTurn.ts` (create)

**Test Coverage**:
- Unit tests: `__tests__/ActiveTurn.test.ts` (should pass)

**Validation**:
```bash
npm test -- ActiveTurn.test.ts
# All tests should now PASS
npm run build
```

---

### T014: Implement SessionState class
**Type**: Implementation
**Dependencies**: T006 (test must fail first)
**Parallel**: Yes [P] (independent of ActiveTurn)
**Estimated Effort**: L

**Description**:
Implement SessionState class with conversation history, token tracking, and approved commands management.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/SessionState.ts` created
- [X] Class SessionState implemented with all methods
- [X] ConversationHistory correctly managed
- [X] Token usage info correctly updated
- [X] Approved commands Set works correctly
- [X] Rate limits stored and retrieved
- [X] export() creates proper SessionStateExport
- [X] static import() reconstructs from export
- [X] All tests from T006 now PASS
- [X] No TypeScript errors

**Files Changed**:
- `codex-chrome/src/core/state/SessionState.ts` (create)

**Test Coverage**:
- Unit tests: `__tests__/SessionState.test.ts` (should pass)

**Validation**:
```bash
npm test -- SessionState.test.ts
# All tests should now PASS
npm run build
```

---

### T015: Implement SessionServices interface and factory
**Type**: Implementation
**Dependencies**: T007 (test must fail first)
**Parallel**: Yes [P] (independent of other implementations)
**Estimated Effort**: M

**Description**:
Implement SessionServices interface and createSessionServices factory function.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/state/SessionServices.ts` created
- [X] SessionServices interface defined
- [X] createSessionServices factory function implemented
- [X] ConversationStore initialized when isPersistent=true
- [X] UserNotifier always created
- [X] Browser-specific services (domService, tabManager) as optional placeholders
- [X] All tests from T007 now PASS
- [X] No TypeScript errors

**Files Changed**:
- `codex-chrome/src/core/state/SessionServices.ts` (create)

**Test Coverage**:
- Unit tests: `__tests__/SessionServices.test.ts` (should pass)

**Validation**:
```bash
npm test -- SessionServices.test.ts
# All tests should now PASS
npm run build
```

---

### T016: Update state module exports
**Type**: Implementation
**Dependencies**: T012, T013, T014, T015
**Parallel**: No
**Estimated Effort**: S

**Description**:
Update `codex-chrome/src/core/state/index.ts` to export all state classes and types.

**Acceptance Criteria**:
- [X] All classes exported: SessionState, SessionServices, ActiveTurn, TurnState
- [X] All types exported: TaskKind, RunningTask, ApprovalResolver, etc.
- [X] Factory function exported: createSessionServices
- [X] Imports work correctly from `./state`

**Files Changed**:
- `codex-chrome/src/core/state/index.ts` (modify)

**Validation**:
```typescript
// From another file:
import { SessionState, ActiveTurn, createSessionServices } from './state';
// Should compile without errors
```

---

### T017: Refactor Session class (part 1: add state delegation)
**Type**: Implementation
**Dependencies**: T008 (test must fail first), T016
**Parallel**: No
**Estimated Effort**: L

**Description**:
Refactor Session.ts to use the new state classes internally. Part 1 adds internal delegation while preserving the existing public API.

**Acceptance Criteria**:
- [X] File `codex-chrome/src/core/Session.ts` modified
- [X] Add private fields: sessionState, sessionServices, activeTurn
- [X] Constructor initializes new state classes
- [X] Preserve all existing constructor signatures for backward compatibility
- [X] Delegate history operations to SessionState internally
- [X] Maintain all existing public methods unchanged
- [X] All existing functionality preserved
- [X] Some tests from T008 start passing

**Files Changed**:
- `codex-chrome/src/core/Session.ts` (refactor, not rewrite)

**Test Coverage**:
- Integration tests: `__tests__/Session.integration.test.ts` (partial pass)
- Existing Session tests should still pass

**Validation**:
```bash
npm test -- Session
# All existing tests should still pass
npm run build
```

---

### T018: Refactor Session class (part 2: complete delegation)
**Type**: Implementation
**Dependencies**: T017
**Parallel**: No
**Estimated Effort**: L

**Description**:
Complete Session refactoring by delegating all operations to state classes while preserving existing API.

**Acceptance Criteria**:
- [X] All existing methods preserved (recordInput, addTokenUsage, etc.)
- [X] Internal implementation delegates to SessionState, SessionServices, ActiveTurn
- [X] Turn management uses ActiveTurn internally
- [X] Token tracking delegates to SessionState
- [X] Approved commands delegate to SessionState
- [X] Pending input delegates to ActiveTurn when active
- [X] export() maintains existing format (backward compatible)
- [X] static import() works with existing format
- [X] All existing methods return same results as before
- [X] All tests from T008 now PASS
- [X] All existing Session tests still PASS
- [X] No TypeScript errors

**Files Changed**:
- `codex-chrome/src/core/Session.ts` (continue refactoring)

**Test Coverage**:
- Integration tests: `__tests__/Session.integration.test.ts` (all pass)
- Existing Session tests: All pass

**Validation**:
```bash
npm test -- Session
# ALL tests (new + existing) should PASS
npm run build
```

---

## Phase 3.4: Integration

### T019: Verify CodexAgent compatibility
**Type**: Integration
**Dependencies**: T018
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Verify that CodexAgent.ts works correctly with the refactored Session (should work without any changes since Session API is preserved).

**Acceptance Criteria**:
- [X] CodexAgent works with refactored Session without modifications
- [X] All CodexAgent tests pass
- [X] No changes needed to CodexAgent.ts (API preserved)
- [X] Session initialization still works correctly
- [X] Turn lifecycle integrated properly

**Files Changed**:
- None (verification only)

**Test Coverage**:
- Existing CodexAgent tests should pass

**Validation**:
```bash
npm test -- CodexAgent
# All tests should pass without any code changes
npm run build
```

---

### T020: Verify TurnManager compatibility
**Type**: Integration
**Dependencies**: T018
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Verify that TurnManager.ts works correctly with the refactored Session (should work without changes since Session API is preserved).

**Acceptance Criteria**:
- [X] TurnManager works with refactored Session without modifications
- [X] All TurnManager tests pass
- [X] No changes needed to TurnManager.ts (API preserved)
- [X] Task management still works correctly
- [X] Turn lifecycle still functions properly

**Files Changed**:
- None (verification only)

**Test Coverage**:
- Existing TurnManager tests should pass

**Validation**:
```bash
npm test -- TurnManager
# All tests should pass without any code changes
npm run build
```

---

### T021: Run integration tests
**Type**: Integration
**Dependencies**: T019, T020
**Parallel**: No
**Estimated Effort**: M

**Description**:
Run all integration tests to verify the refactored system works end-to-end.

**Acceptance Criteria**:
- [X] Turn execution test (T009) passes
- [X] Persistence test (T010) passes
- [X] Fresh session test (T011) passes
- [X] No regressions in existing tests
- [X] All integration scenarios work

**Test Coverage**:
- Integration tests: All from Phase 3.2

**Validation**:
```bash
npm test -- integration/
# All integration tests should PASS
npm test
# Full test suite should pass
```

---

### T022: Verify backward compatibility
**Type**: Integration
**Dependencies**: T021
**Parallel**: No
**Estimated Effort**: M

**Description**:
Verify that all existing functionality is preserved and no features were lost during refactoring.

**Acceptance Criteria**:
- [X] All existing Session methods still available
- [X] Export/import format unchanged
- [X] All integration scenarios work
- [X] No functionality regression
- [X] State.ts kept if still used by other components
- [X] All tests pass (new + existing)
- [X] Manual verification of key features

**Files Changed**:
- None (verification only, potential minor fixes)

**Validation**:
```bash
npm test
# ALL tests should pass
npm run build
# Compare feature list before/after to ensure nothing lost
```

---

## Phase 3.5: Validation

### T023: Run performance benchmarks
**Type**: Validation
**Dependencies**: T022
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Run performance benchmarks to ensure state operations meet performance goals from plan.md.

**Acceptance Criteria**:
- [X] Record 1000 items: < 100ms
- [X] Snapshot 1000 items: < 50ms
- [X] Session export: < 50ms
- [X] Session import: < 50ms
- [X] No performance regressions
- [X] Results documented

**Validation**:
```bash
npm run test:performance
# Or create a benchmark script
node scripts/benchmark-state.js
```

---

### T024: Manual testing in Chrome extension
**Type**: Validation
**Dependencies**: T022
**Parallel**: Yes [P]
**Estimated Effort**: L

**Description**:
Perform manual testing in Chrome extension following quickstart.md Phase 4 scenarios.

**Acceptance Criteria**:
- [X] Extension loads without errors
- [X] Can start conversation
- [X] Turn execution works
- [X] State persists across popup close/reopen
- [X] Turn interruption works
- [X] No console errors
- [X] UI remains responsive
- [X] All manual test scenarios pass

**Files Changed**:
- None (manual testing only)

**Validation**:
Follow quickstart.md Step 10 manual test scenarios

---

### T025: Verify test coverage
**Type**: Validation
**Dependencies**: T021
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Run coverage report and ensure coverage goals are met (>85% for new code).

**Acceptance Criteria**:
- [X] Coverage > 85% for SessionState
- [X] Coverage > 85% for ActiveTurn
- [X] Coverage > 85% for TurnState
- [X] Coverage > 80% for SessionServices
- [X] Coverage > 85% for refactored Session
- [X] Coverage report generated

**Validation**:
```bash
npm test -- --coverage
# Check coverage report in console and HTML
```

---

## Phase 3.6: Documentation

### T026: Update CLAUDE.md
**Type**: Documentation
**Dependencies**: T022
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Update CLAUDE.md with new architecture documentation including state/ module.

**Acceptance Criteria**:
- [X] File `codex-chrome/CLAUDE.md` modified
- [X] New `state/` module documented in Core Components
- [X] Session architecture explanation updated
- [X] Breaking change documented
- [X] Migration notes added (sessions will be reset)
- [X] Recent changes section updated

**Files Changed**:
- `codex-chrome/CLAUDE.md` (modify)

**Validation**:
```bash
# Review CLAUDE.md for completeness and accuracy
cat codex-chrome/CLAUDE.md | grep -A 10 "state/"
```

---

### T027: Add inline documentation
**Type**: Documentation
**Dependencies**: T022
**Parallel**: Yes [P]
**Estimated Effort**: M

**Description**:
Add comprehensive inline documentation (JSDoc comments) to all new state classes.

**Acceptance Criteria**:
- [X] SessionState: All methods have JSDoc comments
- [X] SessionServices: Interface and factory documented
- [X] ActiveTurn: All methods have JSDoc comments
- [X] TurnState: All methods have JSDoc comments
- [X] Session: Updated JSDoc for refactored methods
- [X] Examples included in complex methods

**Files Changed**:
- `codex-chrome/src/core/state/SessionState.ts` (modify)
- `codex-chrome/src/core/state/SessionServices.ts` (modify)
- `codex-chrome/src/core/state/ActiveTurn.ts` (modify)
- `codex-chrome/src/core/state/TurnState.ts` (modify)
- `codex-chrome/src/core/Session.ts` (modify)

**Validation**:
```bash
# Generate TypeScript documentation or manually review
grep -r "@param" codex-chrome/src/core/state/
```

---

## Phase 3.7: Final Checks

### T028: Full test suite run
**Type**: Validation
**Dependencies**: T023, T024, T025, T026, T027
**Parallel**: No
**Estimated Effort**: S

**Description**:
Run complete test suite one final time to ensure everything works together.

**Acceptance Criteria**:
- [X] All unit tests pass
- [X] All integration tests pass
- [X] All existing tests pass (no regressions)
- [X] Coverage goals met
- [X] No failing tests

**Validation**:
```bash
npm test
# Should show all tests passing
npm run build
# Should build successfully
```

---

### T029: Document refactoring changes
**Type**: Documentation
**Dependencies**: T028
**Parallel**: Yes [P]
**Estimated Effort**: S

**Description**:
Document the internal refactoring changes and new architecture in release notes.

**Acceptance Criteria**:
- [X] Document internal architecture improvements in release notes
- [X] Note that this is a non-breaking refactoring
- [X] Explain new internal structure (SessionState, SessionServices, ActiveTurn)
- [X] Clarify that all existing functionality is preserved
- [X] Highlight benefits: better testability, cleaner code organization

**Files Changed**:
- `codex-chrome/docs/CHANGELOG.md` or similar (modify)

**Validation**:
```bash
cat codex-chrome/docs/CHANGELOG.md
# Review for clarity and accuracy
```

---

### T030: Final validation checklist
**Type**: Validation
**Dependencies**: T028, T029
**Parallel**: No
**Estimated Effort**: S

**Description**:
Complete the final validation checklist from quickstart.md to confirm everything is ready.

**Acceptance Criteria**:
- [X] Phase 1 ✓: SessionState, ActiveTurn, TurnState tests pass
- [X] Phase 2 ✓: Session refactored with delegation, all existing methods work
- [X] Phase 3 ✓: Full turn execution, persistence work (existing functionality preserved)
- [X] Phase 4 ✓: Extension loads, all manual tests pass
- [X] Final Validation ✓: All tests pass (new + existing), coverage met, CI passes
- [X] No functionality lost
- [X] All existing features verified
- [X] Documentation updated
- [X] Ready for merge

**Validation**:
Review quickstart.md success checklist and confirm all items checked, plus verify no functionality regression

---

## Dependencies Graph

```
Setup Phase:
T001 (directory) ────────┬─────────────┐
                         │             │
T002 (types) ────────────┼─────────────┼────────┐
                         │             │        │
T003 (vitest) ───────────┼─────────────┼────────┤
                         ↓             ↓        ↓

Test Phase (TDD - All in Parallel):
T004 (TurnState test) [P] ─────────┐
                                   │
T005 (ActiveTurn test) [P] ────────┤
                                   │
T006 (SessionState test) [P] ──────┤
                                   │
T007 (Services test) [P] ──────────┤
                                   │
T008 (Session test) [P] ───────────┤
                                   │
T009 (turn exec test) [P] ─────────┤
                                   │
T010 (persistence test) [P] ───────┤
                                   │
T011 (fresh session test) [P] ─────┤
                                   ↓

Implementation Phase:
T012 (TurnState impl) ──────────────┐
                                    │
T013 (ActiveTurn impl) ─────────────┤
        [depends on T012]           │
                                    │
T014 (SessionState impl) [P] ───────┤
        [parallel with T013]        │
                                    │
T015 (Services impl) [P] ───────────┤
        [parallel with T013, T014]  │
                                    ↓
T016 (export index) ────────────────┐
        [depends on all above]      │
                                    ↓
T017 (Session rewrite p1) ──────────┐
                                    │
T018 (Session rewrite p2) ──────────┤
                                    ↓

Integration Phase:
T019 (CodexAgent) [P] ──────────────┐
                                    ├─── T021 (run tests)
T020 (TurnManager) [P] ─────────────┘           │
                                                ↓
T022 (cleanup) ─────────────────────────────────┐
                                                ↓

Validation Phase:
T023 (performance) [P] ─────────────┐
                                    │
T024 (manual testing) [P] ──────────┤
                                    │
T025 (coverage) [P] ────────────────┤
                                    ↓

Documentation Phase:
T026 (CLAUDE.md) [P] ───────────────┐
                                    │
T027 (inline docs) [P] ─────────────┤
                                    ↓

Final Phase:
T028 (full test suite) ─────────────┐
                                    │
T029 (migration warning) [P] ───────┤
                                    │
T030 (final checklist) ─────────────┘
```

---

## Parallel Execution Examples

### Example 1: Setup Phase (All Parallel)
```bash
# All setup tasks can run simultaneously
Task 1: "Create state directory structure in codex-chrome/src/core/state/"
Task 2: "Create shared types file in codex-chrome/src/core/state/types.ts"
Task 3: "Configure Vitest for state module"
```

### Example 2: Test Phase (All Parallel - Different Files)
```bash
# All test files are independent and can be written in parallel
Task 4: "Write TurnState unit tests in __tests__/TurnState.test.ts"
Task 5: "Write ActiveTurn unit tests in __tests__/ActiveTurn.test.ts"
Task 6: "Write SessionState unit tests in __tests__/SessionState.test.ts"
Task 7: "Write SessionServices factory tests in __tests__/SessionServices.test.ts"
Task 8: "Write Session integration tests in __tests__/Session.integration.test.ts"
Task 9: "Write turn execution integration test"
Task 10: "Write persistence integration test"
Task 11: "Write fresh session creation test"
```

### Example 3: Implementation Phase (Partial Parallel)
```bash
# After TurnState is implemented, these can run in parallel:
Task 14: "Implement SessionState class"  # Independent
Task 15: "Implement SessionServices interface and factory"  # Independent

# But ActiveTurn depends on TurnState, so must wait:
# First: T012 (TurnState)
# Then: T013 (ActiveTurn)
```

### Example 4: Integration Phase (Parallel Updates)
```bash
# These update different files, can run in parallel:
Task 19: "Update CodexAgent to use refactored Session"
Task 20: "Update TurnManager to use ActiveTurn"
```

### Example 5: Documentation Phase (All Parallel)
```bash
# All documentation tasks are independent:
Task 26: "Update CLAUDE.md with new architecture"
Task 27: "Add inline documentation to state classes"
Task 29: "Create migration warning document"
```

---

## Critical Path

The **critical path** (longest sequence of dependent tasks):

```
T001 → T002 → T004 → T012 → T013 → T016 → T017 → T018 → T019/T020 → T021 → T022 → T028 → T030
```

**Estimated Duration** (critical path only):
- Setup: 2 hours (T001-T003)
- TurnState test + impl: 6 hours (T004, T012)
- ActiveTurn test + impl: 6 hours (T005, T013)
- Module export: 1 hour (T016)
- Session rewrite: 16 hours (T017, T018)
- Integration: 8 hours (T019-T022)
- Final checks: 4 hours (T028, T030)

**Total Critical Path**: ~43 hours

**With Parallel Execution**: Can be reduced to ~30-35 hours by running independent tasks simultaneously.

---

## Notes

### TDD Discipline
- **CRITICAL**: All tests (T004-T011) MUST be written and MUST FAIL before any implementation starts
- Verify test failures before moving to Phase 3.3
- This ensures tests are actually testing something

### Parallel Execution
- Tasks marked [P] can run in parallel
- Only run tasks in parallel if they modify different files
- Always check dependencies before parallelizing

### Breaking Change
- No backward compatibility code required
- Old sessions will be lost
- Users must be warned in release notes (T029)

### Code Quality
- Follow TypeScript strict mode
- No `any` types
- Comprehensive JSDoc comments
- Test coverage > 85% for new code

### Validation
- Run tests after each task
- Verify build succeeds after each implementation task
- Follow quickstart.md validation steps

---

## Task Validation Checklist
*GATE: Final verification before execution*

- [x] All entities from data-model.md have test tasks
- [x] All entities have implementation tasks
- [x] All tests come before implementation (TDD)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file paths
- [x] No task modifies same file as another [P] task
- [x] Quickstart scenarios covered in integration tests
- [x] Dependencies clearly documented
- [x] Critical path identified
- [x] 30 tasks total (within 25-30 estimate)

---

**Status**: ✅ READY FOR EXECUTION

**Next Step**: Begin with T001 (Create state directory structure)

**Estimated Total Time**: 30-35 hours with parallel execution
