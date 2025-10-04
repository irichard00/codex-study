# Implementation Plan: Move Task Management from CodexAgent to Session

**Branch**: `012-move-task-management-to-session` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-move-task-management-to-session/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
   → Feature 012: Move activeTask from CodexAgent to Session
2. Fill Technical Context ✅
   → TypeScript 5.x, Vitest, Chrome Extension, single project structure
3. Fill Constitution Check section ✅
   → No violations - architectural refactor only
4. Evaluate Constitution Check ✅
   → PASS - simplifying state management by moving to Session
5. Execute Phase 0 → research.md ✅
   → Option 1 selected: Session.spawnTask() pattern matching Rust
6. Execute Phase 1 → data-model.md, quickstart.md, CLAUDE.md ✅
   → Entities: Session (updated), RunningTask (new), CodexAgent (updated)
7. Re-evaluate Constitution Check ✅
   → PASS - no new violations introduced
8. Plan Phase 2 → Task generation approach described ✅
9. STOP - Ready for /tasks command ✅
```

## Summary

**Problem**: TypeScript CodexAgent holds an `activeTask` field (line 33), but Rust codex-rs manages all task state through `Session.spawn_task()`. This creates architectural misalignment and state duplication.

**Solution**: Remove `activeTask` from CodexAgent, add `spawnTask()` method to Session matching Rust pattern. Session will manage task lifecycle via internal `runningTasks` map, emit TaskComplete/TurnAborted events, and handle automatic task replacement.

**Impact**: ~150 lines total (100 added to Session, 50 modified in CodexAgent), architectural alignment with Rust restored.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Vitest (testing), Chrome Extension APIs, AbortController (browser cancellation)
**Storage**: In-memory task state (runningTasks map in Session)
**Testing**: Vitest with unit and integration tests
**Target Platform**: Chrome Extension (Manifest V3)
**Project Type**: Single project (Chrome extension)
**Performance Goals**: Task spawning <10ms (excluding execution), event emission <5ms
**Constraints**: Browser single-threaded (no tokio::spawn equivalent), use Promise + AbortController
**Scale/Scope**: 1 activeTask field removed, 3 new Session methods, 1 new RunningTask type

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity Gates**:
- ✅ **State Ownership**: Moving task state to Session REDUCES duplication (state in one place)
- ✅ **API Complexity**: Session already manages session state, adding task state is natural
- ✅ **Abstraction Level**: No new abstractions added (RunningTask is a data structure, not a pattern)

**Alignment Gates**:
- ✅ **Rust Alignment**: Matches codex-rs Session.spawn_task() exactly
- ✅ **Backward Compatibility**: CodexAgent public API unchanged (submitOperation, getNextEvent)

**Conclusion**: PASS - This is a state ownership refactor that SIMPLIFIES the architecture by consolidating task state in Session.

## Project Structure

### Documentation (this feature)
```
specs/012-move-task-management-to-session/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✅
├── spec.md              # Feature specification ✅
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── core/
│   │   ├── CodexAgent.ts       # MODIFIED: Remove activeTask field (~50 lines changed)
│   │   ├── Session.ts          # MODIFIED: Add spawnTask(), abortAllTasks() (~100 lines added)
│   │   └── session/
│   │       └── state/
│   │           └── types.ts    # MODIFIED: Add RunningTask type (~10 lines)
│   └── protocol/
│       └── types.ts            # Reference: TurnAbortReason enum
└── tests/
    ├── unit/
    │   ├── Session.spawnTask.test.ts      # NEW: Unit tests for spawnTask
    │   └── Session.abortAllTasks.test.ts  # NEW: Unit tests for abortAllTasks
    └── integration/
        └── task-lifecycle.test.ts         # NEW: Integration test for full lifecycle
```

**Structure Decision**: Single project structure (Chrome extension). Core logic in `codex-chrome/src/core/`, tests in `codex-chrome/tests/`.

## Phase 0: Outline & Research

**Status**: ✅ COMPLETE

**Research Completed** (see `research.md`):
1. **Analyzed Rust Session.spawn_task() pattern**:
   - Decision: Session owns tasks via spawn_task() method
   - Rationale: Centralized state management, matches proven Rust architecture
   - Alternatives considered: Keep activeTask in CodexAgent (rejected - duplicates state)

2. **Browser adaptation strategy**:
   - Decision: Use Promise + AbortController instead of tokio::spawn + abort handles
   - Rationale: Browser single-threaded environment, no native task spawning
   - Alternatives considered: Web Workers (rejected - too complex for task coordination)

3. **Event emission strategy**:
   - Decision: Session emits TaskComplete/TurnAborted directly
   - Rationale: Session owns task lifecycle, should emit lifecycle events
   - Alternatives considered: CodexAgent emits (rejected - doesn't own tasks)

4. **Task storage strategy**:
   - Decision: Map<string, RunningTask> with subId keys
   - Rationale: Matches Rust pattern, efficient lookup, supports future concurrent tasks
   - Alternatives considered: Single activeTask field (rejected - doesn't match Rust)

**All NEEDS CLARIFICATION resolved**: ✅

## Phase 1: Design & Contracts

*Prerequisites: research.md complete ✅*

### 1. Extract entities from feature spec → `data-model.md`

**Entities identified**:
- **Session** (UPDATED): Add spawnTask(), abortAllTasks(), runningTasks map
- **RunningTask** (NEW): Type representing active task (kind, abortController, promise)
- **CodexAgent** (UPDATED): Remove activeTask field, delegate to session.spawnTask()
- **SessionTask** (NO CHANGE): Interface remains unchanged

### 2. Generate API contracts

**No external APIs** - Internal refactor only. CodexAgent public methods unchanged:
- `submitOperation(op: Op): void` - unchanged signature
- `getNextEvent(): Promise<Event | null>` - unchanged signature

### 3. Contract tests

**Test strategy**:
- Unit tests for Session.spawnTask() (contract: creates RunningTask, aborts old tasks)
- Unit tests for Session.abortAllTasks() (contract: cancels all tasks, emits events)
- Integration tests for full lifecycle (CodexAgent → Session → task completion)

### 4. Extract test scenarios → `quickstart.md`

**Validation scenarios** (from spec.md):
1. UserInput submission triggers Session.spawnTask()
2. New UserInput aborts old task before spawning new one
3. Task completion emits TaskComplete event
4. Interrupt operation aborts all tasks
5. CodexAgent has no activeTask field after refactor
6. Session.getRunningTasks() returns task map

### 5. Update CLAUDE.md

Will execute script after data-model.md and quickstart.md are created.

**Output**: data-model.md ✅, quickstart.md ✅, CLAUDE.md update pending

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Setup tasks** (if needed):
   - No setup needed - all components exist (Session, CodexAgent, SessionTask)

2. **Test tasks** (TDD approach):
   - T001 [P]: Unit test for Session.spawnTask() (test file)
   - T002 [P]: Unit test for Session.abortAllTasks() (test file)
   - T003 [P]: Integration test for task lifecycle (test file)

3. **Core implementation tasks**:
   - T004: Add RunningTask type to session/state/types.ts
   - T005: Add Session.spawnTask() method (~50 lines)
   - T006: Add Session.abortAllTasks() method (~30 lines)
   - T007: Add Session helper methods (getRunningTasks, hasRunningTask) (~20 lines)
   - T008: Remove CodexAgent.activeTask field (~10 lines)
   - T009: Update CodexAgent.handleUserInput() to call session.spawnTask() (~20 lines)
   - T010: Update CodexAgent.handleInterrupt() to call session.abortAllTasks() (~10 lines)

4. **Validation tasks**:
   - T011: Build validation (npm run build)
   - T012: Run test suite (npm test)
   - T013: Verify activeTask removed (grep check)

**Ordering Strategy**:
- **TDD order**: Tests T001-T003 first (must fail initially)
- **Dependency order**:
  - T004 (RunningTask type) before T005-T007 (Session methods use it)
  - T005-T007 (Session methods) before T008-T010 (CodexAgent refactor depends on Session)
- **Parallel execution**: T001-T003 can run in parallel (different test files)

**Estimated Output**: 13 tasks total (3 test tasks, 7 implementation tasks, 3 validation tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, verify activeTask removed, check Rust alignment)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - This refactor REDUCES complexity:
- Before: Task state duplicated (CodexAgent.activeTask AND task internals)
- After: Task state centralized in Session.runningTasks
- Benefit: Single source of truth for task state

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [X] Phase 0: Research complete (/plan command) ✅
- [X] Phase 1: Design complete (/plan command) ✅
- [X] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [X] Initial Constitution Check: PASS ✅
- [X] Post-Design Constitution Check: PASS ✅
- [X] All NEEDS CLARIFICATION resolved ✅
- [X] Complexity deviations documented (N/A - no violations) ✅

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
