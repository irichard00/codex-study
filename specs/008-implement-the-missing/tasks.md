# Tasks: Browser-Compatible Session Methods from codex-rs

**Input**: Design documents from `/specs/008-implement-the-missing/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.x, Chrome Extension (Manifest v3)
   → Structure: Single project (codex-chrome/)
   → Scope: 22 browser-compatible methods (excluded 11 MCP/shell/file methods)
2. Load optional design documents ✓
   → research.md: Browser constraints, code reuse opportunities identified
   → data-model.md: Types for 22 methods (browser-compatible only)
   → contracts/: 6 contract files covering all method categories
   → quickstart.md: Testing scenarios for browser environment
3. Generate tasks by category ✓
   → Setup: TypeScript types, test infrastructure
   → Tests: Contract tests (6 files), integration tests
   → Core: 22 methods across 6 categories
   → Integration: SessionState, ActiveTurn, RolloutRecorder integration
   → Polish: JSDoc, documentation, performance validation
4. Apply task rules ✓
   → Different files/independent methods = [P] for parallel
   → Same file (Session.ts) = sequential dependencies
   → Tests before implementation (TDD)
   → Code reuse prioritized (enhance existing methods)
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
   → All 6 contracts have test tasks ✓
   → All 22 methods have implementation tasks ✓
   → All tests before implementation ✓
9. Return: SUCCESS (55 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **Browser-Compatible**: Only includes methods that work in browser environment
- **Code Reuse**: Enhances existing codex-chrome methods where possible

## Path Conventions
**Single project structure** (codex-chrome/):
- Implementation: `codex-chrome/src/core/Session.ts` (target file)
- Types: `codex-chrome/src/core/session/state/types.ts`
- Tests: `codex-chrome/tests/contract/`, `codex-chrome/tests/integration/`
- Existing components to reuse:
  - `SessionState.ts`, `ActiveTurn.ts`, `SessionServices.ts`
  - `RolloutRecorder` (rollout.ts)
  - `AgentTask.ts`, `TaskRunner.ts`

---

## Phase 3.1: Setup & Type Definitions

### T001 [P]: Create test directory structure ✅
**Category**: Setup
**Phase**: Foundation
**Dependencies**: None
**Files**:
- `codex-chrome/tests/contract/` (create)
- `codex-chrome/tests/integration/` (create)
- `codex-chrome/tests/unit/` (create)

**Description**: Create test directory structure for contract, integration, and unit tests. Set up Jest configuration if needed.

**Acceptance Criteria**:
- [x] Test directories created (already existed)
- [x] Jest config exists (or use existing)
- [x] Test infrastructure ready

**Code Reuse**: Check if test infrastructure already exists

**Status**: COMPLETED - Test infrastructure already exists

---

### T002 [P]: Add browser-compatible type definitions to types.ts ✅
**Category**: Foundation
**Phase**: 1 (Core State Management)
**Dependencies**: None
**Files**:
- `codex-chrome/src/core/session/state/types.ts`

**Description**: Add TypeScript type definitions for browser-compatible methods only. Exclude MCP types (McpConnectionManager, CallToolResult), shell types (Shell, ExecCommandContext, ApplyPatchAction, TurnDiffTracker).

Include:
- `ReviewDecision` enum (Approve, Reject, Abort) - already in protocol
- `TurnAbortReason` enum (Interrupted, Replaced, Error) - ADDED
- `RunningTask` interface - already exists
- `SessionTask` interface - TBD (used in spawn_task)
- `TokenUsageInfo` type (if missing) - already exists
- `RateLimitSnapshot` type - already exists
- Event types - will use protocol types

**Acceptance Criteria**:
- [x] All browser-compatible types defined
- [x] No MCP or shell-specific types included
- [x] Types exported properly
- [x] JSDoc comments added

**Contract Reference**: data-model.md sections 1-3
**Data Model Reference**: data-model.md lines 1-200

**Status**: COMPLETED - TurnAbortReason added, other types already exist

---

### T003 [P]: Add ConfigureSession and InitialHistory types ✅
**Category**: Foundation
**Phase**: 1
**Dependencies**: None
**Files**:
- `codex-chrome/src/core/session/state/types.ts`

**Description**: Add `ConfigureSession` interface (browser subset - exclude shell discovery) and `InitialHistory` discriminated union (New | Resumed | Forked).

**Acceptance Criteria**:
- [x] ConfigureSession defined (browser-compatible fields only)
- [x] InitialHistory enum/type defined
- [x] Integrates with existing AgentConfig
- [x] JSDoc comments added

**Contract Reference**: contracts/session-lifecycle.contract.ts lines 10-55
**Data Model Reference**: data-model.md lines 50-120

**Status**: COMPLETED - ConfigureSession, InitialHistory, and type guards added

---

## Phase 3.2: Contract Tests (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### T004 [P]: Contract test for session lifecycle methods
**Category**: Test
**Phase**: Foundation
**Dependencies**: T001, T002, T003
**Files**:
- `codex-chrome/tests/contract/session-lifecycle.test.ts` (create)

**Description**: Create contract tests for:
- `new()` factory method (partial - exclude MCP/shell init)
- `record_initial_history()` for New/Resumed/Forked modes
- `next_internal_sub_id()` ID generation

Test scenarios (from contract):
1. new() with New history creates session with fresh state
2. new() with Resumed history loads from rollout
3. new() with Forked history persists items
4. record_initial_history() builds initial context for new sessions
5. record_initial_history() reconstructs history for resumed sessions
6. next_internal_sub_id() generates unique IDs
7. Parallel initialization with Promise.all()
8. Error handling for invalid configuration
9. Error handling for failed rollout initialization
10. TurnContext populated with defaults

**Acceptance Criteria**:
- [ ] All test scenarios implemented
- [ ] Tests FAIL (no implementation yet)
- [ ] Clear failure messages
- [ ] Mock RolloutRecorder, SessionState

**Contract Reference**: contracts/session-lifecycle.contract.ts
**Code Reuse**: Use existing TurnContext, SessionState mocks

---

### T005 [P]: Contract test for event management methods
**Category**: Test
**Phase**: Event Infrastructure
**Dependencies**: T001, T002
**Files**:
- `codex-chrome/tests/contract/event-management.test.ts` (create)

**Description**: Create contract tests for:
- `send_event()` with rollout persistence
- `notify_background_event()` background notifications
- `notify_stream_error()` error notifications
- `send_token_count_event()` token usage events

Test scenarios (from contract):
1. send_event() persists EventMsg to rollout
2. send_event() emits event via event emitter
3. send_event() handles rollout persistence failure gracefully
4. notify_background_event() creates BackgroundEvent
5. notify_stream_error() creates StreamErrorEvent
6. send_token_count_event() retrieves token info from SessionState
7. send_token_count_event() emits TokenCountEvent
8. Event ordering preserved
9. Parallel event emission
10. Error propagation

**Acceptance Criteria**:
- [ ] All test scenarios implemented
- [ ] Tests FAIL (no implementation yet)
- [ ] Mock RolloutRecorder, event emitter

**Contract Reference**: contracts/event-management.contract.ts
**Code Reuse**: Enhance existing emitEvent() tests

---

### T006 [P]: Contract test for task lifecycle methods
**Category**: Test
**Phase**: Task Lifecycle
**Dependencies**: T001, T002
**Files**:
- `codex-chrome/tests/contract/task-lifecycle.test.ts` (create)

**Description**: Create contract tests for:
- `spawn_task()` with abort-and-replace
- `abort_all_tasks()` with reason tracking
- `on_task_finished()` with cleanup
- `register_new_active_task()`, `take_all_running_tasks()`, `handle_task_abort()`, `interrupt_task()`

Test scenarios (from contract):
1. spawn_task() aborts existing tasks before spawning new one
2. spawn_task() registers task in ActiveTurn
3. spawn_task() uses AbortController for cancellation
4. abort_all_tasks() calls handle_task_abort for each task
5. abort_all_tasks() clears pending input/approvals
6. on_task_finished() removes task from ActiveTurn
7. on_task_finished() emits TaskCompleteEvent
8. interrupt_task() aborts with Interrupted reason
9. Task abortion propagates AbortSignal
10. Multiple tasks tracked correctly

**Acceptance Criteria**:
- [ ] All test scenarios implemented
- [ ] Tests FAIL (no implementation yet)
- [ ] Mock AbortController, ActiveTurn

**Contract Reference**: contracts/task-lifecycle.contract.ts
**Code Reuse**: Leverage existing AgentTask tests

---

### T007 [P]: Contract test for rollout recording methods
**Category**: Test
**Phase**: Rollout & History
**Dependencies**: T001, T002
**Files**:
- `codex-chrome/tests/contract/rollout-recording.test.ts` (create)

**Description**: Create contract tests for:
- `record_conversation_items()` dual persistence
- `reconstruct_history_from_rollout()` with compaction
- `record_into_history()` history append
- `replace_history()` full replacement
- `persist_rollout_response_items()` rollout persistence
- `record_input_and_rollout_usermsg()` input recording

Test scenarios (from contract):
1. record_conversation_items() records to SessionState
2. record_conversation_items() persists to rollout
3. reconstruct_history_from_rollout() handles ResponseItems
4. reconstruct_history_from_rollout() handles Compacted items
5. record_into_history() appends without persistence
6. replace_history() replaces entire conversation
7. persist_rollout_response_items() converts to RolloutItems
8. record_input_and_rollout_usermsg() dual persistence pattern
9. Compaction rebuilds history correctly
10. Rollout persistence failure is non-fatal

**Acceptance Criteria**:
- [ ] All test scenarios implemented
- [ ] Tests FAIL (no implementation yet)
- [ ] Mock RolloutRecorder, SessionState

**Contract Reference**: contracts/rollout-recording.contract.ts
**Code Reuse**: Enhance existing reconstruction tests

---

### T008 [P]: Contract test for token tracking methods
**Category**: Test
**Phase**: Token & Rate Limit
**Dependencies**: T001, T002
**Files**:
- `codex-chrome/tests/contract/token-tracking.test.ts` (create)

**Description**: Create contract tests for:
- `update_token_usage_info()` token updates
- `update_rate_limits()` rate limit tracking

Test scenarios (from contract):
1. update_token_usage_info() updates SessionState
2. update_token_usage_info() emits TokenCountEvent
3. update_rate_limits() updates SessionState rate limits
4. update_rate_limits() emits TokenCountEvent
5. Token count includes input and output tokens
6. Rate limits include requests/tokens remaining
7. Context window tracking
8. Event emission on every update
9. Null token usage handled gracefully
10. Integration with existing token tracking

**Acceptance Criteria**:
- [ ] All test scenarios implemented
- [ ] Tests FAIL (no implementation yet)
- [ ] Mock SessionState token methods

**Contract Reference**: contracts/token-tracking.contract.ts
**Code Reuse**: Enhance existing addTokenUsage() tests

---

### T009 [P]: Contract test for approval handling methods
**Category**: Test
**Phase**: Approval System
**Dependencies**: T001, T002
**Files**:
- `codex-chrome/tests/contract/approval-handling.test.ts` (create)

**Description**: Create contract tests for:
- `notify_approval()` generic approval pattern (NOTE: NO shell/file specific approvals)

Test scenarios (from contract):
1. notify_approval() retrieves pending approval from ActiveTurn
2. notify_approval() resolves Promise with decision
3. notify_approval() removes approval from pending map
4. notify_approval() handles missing approval gracefully
5. ReviewDecision enum values (Approve, Reject, Abort)
6. Promise-based approval pattern
7. Multiple pending approvals tracked
8. Approval timeout handling
9. Concurrent approval notifications
10. Integration with ActiveTurn state

**Acceptance Criteria**:
- [ ] All test scenarios implemented
- [ ] Tests FAIL (no implementation yet)
- [ ] Mock ActiveTurn approval map

**Contract Reference**: contracts/approval-handling.contract.ts
**Code Reuse**: Use Promise-based patterns

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

**Foundation Methods (Phase 1)**

### T010: Implement next_internal_sub_id() in Session.ts
**Category**: Core
**Phase**: 1 (Foundation)
**Dependencies**: T002, T004 (failing)
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `next_internal_sub_id()` method to generate internal submission IDs for auto-generated operations. Use simple counter (JavaScript is single-threaded, no atomics needed) or crypto.randomUUID().

**Code Reuse**: Simple implementation, no dependencies

**Acceptance Criteria**:
- [ ] Method signature matches contract
- [ ] Generates unique IDs
- [ ] Returns string in format "auto-compact-{id}"
- [ ] Contract tests pass (T004)
- [ ] JSDoc comments added

**Contract Reference**: contracts/session-lifecycle.contract.ts lines 150-180
**Implementation Pattern**: `nextInternalSubId(): string`

---

### T011: Enhance SessionState with record_into_history() and replace_history()
**Category**: Core
**Phase**: 1 (Foundation)
**Dependencies**: T002, T007 (failing)
**Files**:
- `codex-chrome/src/core/session/state/SessionState.ts`

**Description**: Add or enhance `record_into_history()` (append only, no persistence) and `replace_history()` (full replacement) methods in SessionState.

**Code Reuse**: Likely already exists, verify and enhance if needed

**Acceptance Criteria**:
- [ ] record_into_history() appends ResponseItems
- [ ] replace_history() replaces entire history
- [ ] No rollout persistence in these methods
- [ ] Integration with existing SessionState methods
- [ ] Contract tests pass (T007)
- [ ] JSDoc comments added

**Contract Reference**: contracts/rollout-recording.contract.ts lines 200-250

---

### T012 [P]: Add utility getters (show_raw_agent_reasoning, notifier) to Session.ts
**Category**: Core
**Phase**: 1 (Foundation)
**Dependencies**: T002
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add simple getter methods:
- `show_raw_agent_reasoning()` - returns boolean from SessionServices or config
- `notifier()` - returns UserNotifier from SessionServices (can integrate with Chrome notifications or UI)

**Code Reuse**: Simple getters, integrate with existing SessionServices

**Acceptance Criteria**:
- [ ] show_raw_agent_reasoning() returns boolean
- [ ] notifier() returns notifier service (or stub)
- [ ] Integrates with SessionServices
- [ ] JSDoc comments added

**Implementation Pattern**: Simple accessors

---

**Event Infrastructure (Phase 2)**

### T013: Enhance emitEvent() → send_event() with rollout persistence in Session.ts
**Category**: Core
**Phase**: 2 (Event Infrastructure)
**Dependencies**: T002, T005 (failing), T010
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Enhance existing `emitEvent()` method or create new `send_event()` method that:
1. Persists event to rollout as RolloutItem::EventMsg
2. Emits event via existing event emitter
3. Handles rollout persistence failure gracefully (log and continue)

**Code Reuse**: Enhance existing `emitEvent()` method, use existing RolloutRecorder

**Acceptance Criteria**:
- [ ] Method signature: `async send_event(event: Event): Promise<void>`
- [ ] Persists EventMsg to rollout via RolloutRecorder
- [ ] Emits event via existing event emitter
- [ ] Graceful degradation on rollout failure
- [ ] Contract tests pass (T005)
- [ ] JSDoc comments added

**Contract Reference**: contracts/event-management.contract.ts lines 1-80
**Implementation Pattern**: Enhance existing method

---

### T014: Implement notify_background_event() in Session.ts
**Category**: Core
**Phase**: 2 (Event Infrastructure)
**Dependencies**: T002, T005 (failing), T013
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `notify_background_event()` helper method that creates BackgroundEventEvent and calls send_event().

**Code Reuse**: Uses send_event() from T013

**Acceptance Criteria**:
- [ ] Method signature: `async notify_background_event(sub_id: string, message: string): Promise<void>`
- [ ] Creates BackgroundEventEvent from protocol types
- [ ] Calls send_event()
- [ ] Contract tests pass (T005)
- [ ] JSDoc comments added

**Contract Reference**: contracts/event-management.contract.ts lines 120-160

---

### T015: Implement notify_stream_error() in Session.ts
**Category**: Core
**Phase**: 2 (Event Infrastructure)
**Dependencies**: T002, T005 (failing), T013
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `notify_stream_error()` helper method that creates StreamErrorEvent and calls send_event().

**Code Reuse**: Uses send_event() from T013

**Acceptance Criteria**:
- [ ] Method signature: `async notify_stream_error(sub_id: string, message: string): Promise<void>`
- [ ] Creates StreamErrorEvent from protocol types
- [ ] Calls send_event()
- [ ] Contract tests pass (T005)
- [ ] JSDoc comments added

**Contract Reference**: contracts/event-management.contract.ts lines 170-210

---

### T016: Implement send_token_count_event() in Session.ts
**Category**: Core
**Phase**: 2 (Event Infrastructure)
**Dependencies**: T002, T005 (failing), T008 (failing), T013
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `send_token_count_event()` method that retrieves token info and rate limits from SessionState and emits TokenCountEvent via send_event().

**Code Reuse**: Uses existing SessionState token methods, send_event()

**Acceptance Criteria**:
- [ ] Method signature: `async send_token_count_event(sub_id: string): Promise<void>`
- [ ] Retrieves token info from SessionState
- [ ] Creates TokenCountEvent
- [ ] Calls send_event()
- [ ] Contract tests pass (T005, T008)
- [ ] JSDoc comments added

**Contract Reference**: contracts/event-management.contract.ts lines 220-270, contracts/token-tracking.contract.ts lines 150-200

---

**Approval System (Phase 3)**

### T017: Enhance ActiveTurn with pending approval map
**Category**: Core
**Phase**: 3 (Approval System)
**Dependencies**: T002, T009 (failing)
**Files**:
- `codex-chrome/src/core/session/state/ActiveTurn.ts`

**Description**: Add `pending_approvals` Map<string, (decision: ReviewDecision) => void> to ActiveTurn for storing Promise resolvers.

**Code Reuse**: Enhance existing ActiveTurn class

**Acceptance Criteria**:
- [ ] pending_approvals Map added
- [ ] Methods to insert/remove approvals
- [ ] Integration with existing ActiveTurn state
- [ ] JSDoc comments added

**Implementation Pattern**: `private pendingApprovals = new Map<string, (decision: ReviewDecision) => void>()`

---

### T018: Implement notify_approval() in Session.ts
**Category**: Core
**Phase**: 3 (Approval System)
**Dependencies**: T002, T009 (failing), T017
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `notify_approval()` method that retrieves pending approval from ActiveTurn and resolves Promise with decision.

**Code Reuse**: Integrates with ActiveTurn from T017

**Acceptance Criteria**:
- [ ] Method signature: `async notify_approval(sub_id: string, decision: ReviewDecision): Promise<void>`
- [ ] Retrieves approval resolver from ActiveTurn
- [ ] Resolves Promise with decision
- [ ] Removes approval from pending map
- [ ] Handles missing approval gracefully
- [ ] Contract tests pass (T009)
- [ ] JSDoc comments added

**Contract Reference**: contracts/approval-handling.contract.ts lines 80-150

---

**Task Lifecycle (Phase 4)**

### T019: Add RunningTask type and task map to ActiveTurn
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T017
**Files**:
- `codex-chrome/src/core/session/state/ActiveTurn.ts`

**Description**: Add `tasks` Map<string, RunningTask> to ActiveTurn and implement task tracking methods:
- `insert_running_task(sub_id, task)`
- `remove_running_task(sub_id)`
- `drain_tasks()` - extract and clear all tasks

**Code Reuse**: Enhance existing ActiveTurn class

**Acceptance Criteria**:
- [ ] RunningTask type defined (contains AbortController, task info)
- [ ] tasks Map added to ActiveTurn
- [ ] Task tracking methods implemented
- [ ] drain_tasks() clears tasks and pending state
- [ ] JSDoc comments added

**Implementation Pattern**: Browser-native AbortController for task cancellation

---

### T020: Implement register_new_active_task() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T019
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `register_new_active_task()` private method that creates ActiveTurn if needed and registers task.

**Code Reuse**: Uses ActiveTurn from T019

**Acceptance Criteria**:
- [ ] Method signature: `private async register_new_active_task(sub_id: string, task: RunningTask): Promise<void>`
- [ ] Creates ActiveTurn if null
- [ ] Adds task to ActiveTurn tasks map
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 200-240

---

### T021: Implement take_all_running_tasks() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T019
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `take_all_running_tasks()` private method that extracts all running tasks, clears ActiveTurn, and drains pending state.

**Code Reuse**: Uses ActiveTurn drain methods

**Acceptance Criteria**:
- [ ] Method signature: `private async take_all_running_tasks(): Promise<Array<[string, RunningTask]>>`
- [ ] Extracts tasks from ActiveTurn
- [ ] Clears pending input/approvals
- [ ] Drains task map
- [ ] Sets ActiveTurn to null if empty
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 250-290

---

### T022: Implement handle_task_abort() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T021
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `handle_task_abort()` private method that aborts individual task with reason, calls task-specific cleanup, and emits TurnAbortedEvent.

**Code Reuse**: Uses AbortController, send_event()

**Acceptance Criteria**:
- [ ] Method signature: `private async handle_task_abort(sub_id: string, task: RunningTask, reason: TurnAbortReason): Promise<void>`
- [ ] Calls AbortController.abort()
- [ ] Invokes task-specific abort logic (if any)
- [ ] Emits TurnAbortedEvent via send_event()
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 300-350

---

### T023: Implement abort_all_tasks() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T021, T022
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `abort_all_tasks()` public method that aborts all running tasks with specified reason.

**Code Reuse**: Uses take_all_running_tasks(), handle_task_abort()

**Acceptance Criteria**:
- [ ] Method signature: `async abort_all_tasks(reason: TurnAbortReason): Promise<void>`
- [ ] Calls take_all_running_tasks()
- [ ] Calls handle_task_abort() for each task
- [ ] Clears all pending state
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 120-170

---

### T024: Implement on_task_finished() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T020
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `on_task_finished()` public method that removes task from ActiveTurn, clears ActiveTurn if empty, and emits TaskCompleteEvent.

**Code Reuse**: Uses ActiveTurn methods, send_event()

**Acceptance Criteria**:
- [ ] Method signature: `async on_task_finished(sub_id: string, last_agent_message: string | null): Promise<void>`
- [ ] Removes task from ActiveTurn
- [ ] Clears ActiveTurn if no tasks remain
- [ ] Emits TaskCompleteEvent
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 180-220

---

### T025: Implement spawn_task() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T020, T023
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `spawn_task()` public method that aborts existing tasks, spawns new task with AbortController, and registers in ActiveTurn.

**Code Reuse**: Uses abort_all_tasks(), register_new_active_task(), integrates with AgentTask/TaskRunner

**Acceptance Criteria**:
- [ ] Method signature: `async spawn_task<T>(sub_id: string, input: InputItem[], task: (signal: AbortSignal) => Promise<T>): Promise<void>`
- [ ] Calls abort_all_tasks(TurnAbortReason.Replaced)
- [ ] Creates AbortController for new task
- [ ] Spawns task (async, non-blocking)
- [ ] Registers RunningTask in ActiveTurn
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 40-110
**Code Reuse**: Integrate with existing AgentTask.run() or TaskRunner

---

### T026: Implement interrupt_task() in Session.ts
**Category**: Core
**Phase**: 4 (Task Lifecycle)
**Dependencies**: T002, T006 (failing), T023
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `interrupt_task()` public method (wrapper around abort_all_tasks with Interrupted reason).

**Code Reuse**: Uses abort_all_tasks()

**Acceptance Criteria**:
- [ ] Method signature: `async interrupt_task(): Promise<void>`
- [ ] Calls abort_all_tasks(TurnAbortReason.Interrupted)
- [ ] Contract tests pass (T006)
- [ ] JSDoc comments added

**Contract Reference**: contracts/task-lifecycle.contract.ts lines 360-390

---

**Rollout Recording & History (Phase 5)**

### T027: Implement persist_rollout_response_items() in Session.ts
**Category**: Core
**Phase**: 5 (Rollout & History)
**Dependencies**: T002, T007 (failing)
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `persist_rollout_response_items()` private method that converts ResponseItems to RolloutItems and persists via RolloutRecorder.

**Code Reuse**: Uses existing RolloutRecorder

**Acceptance Criteria**:
- [ ] Method signature: `private async persist_rollout_response_items(items: ResponseItem[]): Promise<void>`
- [ ] Converts ResponseItems to RolloutItem::ResponseItem
- [ ] Calls persistRolloutItems()
- [ ] Graceful degradation on failure
- [ ] Contract tests pass (T007)
- [ ] JSDoc comments added

**Contract Reference**: contracts/rollout-recording.contract.ts lines 250-290

---

### T028: Enhance record_conversation_items() in Session.ts
**Category**: Core
**Phase**: 5 (Rollout & History)
**Dependencies**: T002, T007 (failing), T011, T027
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Enhance existing `record_conversation_items()` or create new method that implements dual persistence: records to SessionState AND persists to rollout.

**Code Reuse**: Uses record_into_history() (T011), persist_rollout_response_items() (T027)

**Acceptance Criteria**:
- [ ] Method signature: `private async record_conversation_items(items: ResponseItem[]): Promise<void>`
- [ ] Calls record_into_history()
- [ ] Calls persist_rollout_response_items()
- [ ] Dual persistence pattern
- [ ] Contract tests pass (T007)
- [ ] JSDoc comments added

**Contract Reference**: contracts/rollout-recording.contract.ts lines 40-80

---

### T029: Implement record_input_and_rollout_usermsg() in Session.ts
**Category**: Core
**Phase**: 5 (Rollout & History)
**Dependencies**: T002, T007 (failing), T028
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `record_input_and_rollout_usermsg()` private method that converts input to ResponseItem, records to history, derives UserMessage events, and persists only UserMessage to rollout (not full ResponseItem).

**Code Reuse**: Uses record_conversation_items(), protocol mapping functions

**Acceptance Criteria**:
- [ ] Method signature: `private async record_input_and_rollout_usermsg(input: ResponseInputItem): Promise<void>`
- [ ] Converts input to ResponseItem
- [ ] Records to conversation history
- [ ] Derives UserMessage events
- [ ] Persists only UserMessage to rollout
- [ ] Dual persistence pattern
- [ ] Contract tests pass (T007)
- [ ] JSDoc comments added

**Contract Reference**: contracts/rollout-recording.contract.ts lines 300-360

---

### T030: Enhance reconstruct_history_from_rollout() in Session.ts
**Category**: Core
**Phase**: 5 (Rollout & History)
**Dependencies**: T002, T007 (failing), T011
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Enhance existing `reconstructHistoryFromRollout()` private method to handle compacted history with summaries. Process RolloutItem::ResponseItem and RolloutItem::Compacted.

**Code Reuse**: Enhance existing private method, use replace_history()

**Acceptance Criteria**:
- [ ] Processes RolloutItem::ResponseItem
- [ ] Processes RolloutItem::Compacted with summary rebuild
- [ ] Handles compacted history correctly
- [ ] Builds compacted history with user messages
- [ ] Contract tests pass (T007)
- [ ] JSDoc comments added

**Contract Reference**: contracts/rollout-recording.contract.ts lines 90-180

---

**Token & Rate Limit Tracking (Phase 6)**

### T031 [P]: Implement update_token_usage_info() in Session.ts
**Category**: Core
**Phase**: 6 (Token & Rate Limit)
**Dependencies**: T002, T008 (failing), T016
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `update_token_usage_info()` method that updates SessionState token info from TokenUsage and sends token count event.

**Code Reuse**: Uses existing SessionState token methods, send_token_count_event()

**Acceptance Criteria**:
- [ ] Method signature: `private async update_token_usage_info(sub_id: string, tokenUsage: TokenUsage | null): Promise<void>`
- [ ] Updates SessionState.update_token_info_from_usage()
- [ ] Calls send_token_count_event()
- [ ] Handles null tokenUsage gracefully
- [ ] Contract tests pass (T008)
- [ ] JSDoc comments added

**Contract Reference**: contracts/token-tracking.contract.ts lines 40-110

---

### T032 [P]: Implement update_rate_limits() in Session.ts
**Category**: Core
**Phase**: 6 (Token & Rate Limit)
**Dependencies**: T002, T008 (failing), T016
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `update_rate_limits()` method that updates SessionState rate limits and sends token count event.

**Code Reuse**: Uses existing SessionState methods, send_token_count_event()

**Acceptance Criteria**:
- [ ] Method signature: `private async update_rate_limits(sub_id: string, rateLimits: RateLimitSnapshot): Promise<void>`
- [ ] Updates SessionState.set_rate_limits()
- [ ] Calls send_token_count_event()
- [ ] Contract tests pass (T008)
- [ ] JSDoc comments added

**Contract Reference**: contracts/token-tracking.contract.ts lines 120-180

---

**Initialization & Utilities (Phase 7)**

### T033: Implement inject_input() in Session.ts
**Category**: Core
**Phase**: 7 (Initialization & Utilities)
**Dependencies**: T002, T019
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `inject_input()` public method that attempts to inject input into active turn, returns Result pattern (success/failure with input returned).

**Code Reuse**: Integrates with ActiveTurn pending input

**Acceptance Criteria**:
- [ ] Method signature: `async inject_input(input: InputItem[]): Promise<{ success: boolean; returned?: InputItem[] }>`
- [ ] Injects input into ActiveTurn if active
- [ ] Returns input back if no active turn
- [ ] Result pattern for error handling
- [ ] JSDoc comments added

**Implementation Pattern**: Result-like return type

---

### T034: Align turn_input_with_history() signature in Session.ts
**Category**: Core
**Phase**: 7 (Initialization & Utilities)
**Dependencies**: T002
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Verify and align `turn_input_with_history()` method signature with Rust version (combines session history with new turn items).

**Code Reuse**: Likely exists as `buildTurnInputWithHistory()`, verify signature

**Acceptance Criteria**:
- [ ] Method signature: `async turn_input_with_history(extra: ResponseItem[]): Promise<ResponseItem[]>`
- [ ] Combines history snapshot with extra items
- [ ] Returns full turn input
- [ ] JSDoc comments added

**Implementation Pattern**: Array concatenation

---

### T035: Refactor new() factory method in Session.ts (partial - exclude MCP/shell)
**Category**: Core
**Phase**: 7 (Initialization & Utilities)
**Dependencies**: T002, T004 (failing), T028
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add static `new()` factory method for Session creation with parallel initialization. EXCLUDE MCP connection manager and shell discovery. Include RolloutRecorder initialization and history metadata loading.

**Code Reuse**: Refactor existing constructor, use Promise.all() for parallel init

**Acceptance Criteria**:
- [ ] Static factory method: `static async new(configure: ConfigureSession, config: AgentConfig, initialHistory: InitialHistory, services?: SessionServices): Promise<{ session: Session; turnContext: TurnContext }>`
- [ ] Parallel async initialization with Promise.all()
- [ ] RolloutRecorder init based on initialHistory
- [ ] NO MCP connection manager
- [ ] NO shell discovery
- [ ] Returns Session and TurnContext tuple
- [ ] Contract tests pass (T004)
- [ ] JSDoc comments added

**Contract Reference**: contracts/session-lifecycle.contract.ts lines 20-55
**Code Reuse**: Use existing RolloutRecorder.create()

---

### T036: Implement record_initial_history() in Session.ts
**Category**: Core
**Phase**: 7 (Initialization & Utilities)
**Dependencies**: T002, T004 (failing), T028, T030
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add `record_initial_history()` private method that records initial conversation history based on session mode (New/Resumed/Forked).

**Code Reuse**: Uses record_conversation_items(), reconstruct_history_from_rollout()

**Acceptance Criteria**:
- [ ] Method signature: `private async record_initial_history(turnContext: TurnContext, initialHistory: InitialHistory): Promise<void>`
- [ ] New sessions: builds and records initial context
- [ ] Resumed sessions: reconstructs history from rollout
- [ ] Forked sessions: similar to resumed but persists items
- [ ] Pattern matching on InitialHistory type
- [ ] Contract tests pass (T004)
- [ ] JSDoc comments added

**Contract Reference**: contracts/session-lifecycle.contract.ts lines 90-140

---

## Phase 3.4: Integration Tests

### T037 [P]: Integration test for session lifecycle workflow
**Category**: Integration
**Phase**: Testing
**Dependencies**: T004-T036 (all core methods implemented)
**Files**:
- `codex-chrome/tests/integration/session-lifecycle.integration.test.ts` (create)

**Description**: End-to-end test for session creation, initialization, and history recording workflow.

Test scenario (from quickstart.md):
1. Create new session with fresh state
2. Initialize services
3. Record initial history
4. Verify session ready for turns
5. Create resumed session from rollout
6. Verify history reconstructed correctly

**Acceptance Criteria**:
- [ ] All integration scenarios pass
- [ ] Uses real RolloutRecorder (or realistic mock)
- [ ] Verifies end-to-end workflow
- [ ] Performance < 500ms for initialization

**Quickstart Reference**: quickstart.md Session Lifecycle section

---

### T038 [P]: Integration test for task execution workflow
**Category**: Integration
**Phase**: Testing
**Dependencies**: T006, T019-T026 (task lifecycle implemented)
**Files**:
- `codex-chrome/tests/integration/task-execution.integration.test.ts` (create)

**Description**: End-to-end test for task spawning, abortion, and completion workflow.

Test scenario (from quickstart.md):
1. Spawn task with AbortController
2. Verify task registered in ActiveTurn
3. Spawn second task (aborts first)
4. Verify first task aborted with Replaced reason
5. Interrupt task manually
6. Verify task aborted with Interrupted reason
7. Task completes successfully
8. Verify ActiveTurn cleared

**Acceptance Criteria**:
- [ ] All integration scenarios pass
- [ ] AbortController propagates correctly
- [ ] Task lifecycle events emitted
- [ ] ActiveTurn state managed correctly

**Quickstart Reference**: quickstart.md Task Lifecycle section

---

### T039 [P]: Integration test for rollout persistence workflow
**Category**: Integration
**Phase**: Testing
**Dependencies**: T007, T027-T030 (rollout methods implemented)
**Files**:
- `codex-chrome/tests/integration/rollout-persistence.integration.test.ts` (create)

**Description**: End-to-end test for recording, persisting, and reconstructing conversation history with rollout.

Test scenario (from quickstart.md):
1. Record conversation items (dual persistence)
2. Verify items in SessionState
3. Verify items in rollout
4. Compact history
5. Reconstruct from rollout
6. Verify compacted history correct
7. Handle rollout failure gracefully

**Acceptance Criteria**:
- [ ] All integration scenarios pass
- [ ] Dual persistence works
- [ ] Compaction and reconstruction work
- [ ] Graceful degradation on rollout failure

**Quickstart Reference**: quickstart.md Rollout Recording section

---

## Phase 3.5: Polish & Documentation

### T040 [P]: Add JSDoc comments to all new methods in Session.ts
**Category**: Documentation
**Phase**: Polish
**Dependencies**: T010-T036 (all implementations complete)
**Files**:
- `codex-chrome/src/core/Session.ts`

**Description**: Add comprehensive JSDoc comments to all 22 new/enhanced methods with:
- Method description
- Parameter descriptions
- Return value description
- Example usage
- Links to relevant contracts

**Acceptance Criteria**:
- [ ] All 22 methods have JSDoc
- [ ] Examples included
- [ ] TypeDoc can generate docs
- [ ] No JSDoc linting errors

---

### T041 [P]: Add JSDoc comments to new types in types.ts
**Category**: Documentation
**Phase**: Polish
**Dependencies**: T002, T003
**Files**:
- `codex-chrome/src/core/session/state/types.ts`

**Description**: Add JSDoc comments to all new browser-compatible types.

**Acceptance Criteria**:
- [ ] All types documented
- [ ] Examples for complex types
- [ ] TypeDoc compatible

---

### T042 [P]: Create migration guide for Session changes
**Category**: Documentation
**Phase**: Polish
**Dependencies**: T040
**Files**:
- `docs/migration-guide-session.md` (create)

**Description**: Document changes to Session class, new methods, and how to use them. Include examples and migration path from old patterns.

**Acceptance Criteria**:
- [ ] Migration guide created
- [ ] Examples for each new method
- [ ] Browser limitations documented
- [ ] Code samples included

---

### T043: Update CLAUDE.md with new Session methods
**Category**: Documentation
**Phase**: Polish
**Dependencies**: T040
**Files**:
- `/home/rich/dev/study/codex-study/CLAUDE.md`

**Description**: Update CLAUDE.md to include information about the 22 new Session methods, browser constraints, and code reuse patterns.

**Acceptance Criteria**:
- [ ] CLAUDE.md updated
- [ ] New methods listed
- [ ] Browser constraints documented
- [ ] Code reuse opportunities noted

---

### T044 [P]: Performance validation for session initialization
**Category**: Polish
**Phase**: Testing
**Dependencies**: T035-T036
**Files**:
- `codex-chrome/tests/performance/session-init.perf.test.ts` (create)

**Description**: Validate session initialization performance goals (<500ms) with realistic scenarios.

**Acceptance Criteria**:
- [ ] New session init < 500ms
- [ ] Resumed session init < 500ms
- [ ] Parallel initialization optimized
- [ ] Memory < 50MB per session

**Performance Goals**: plan.md lines 83-87

---

### T045 [P]: Performance validation for event dispatch
**Category**: Polish
**Phase**: Testing
**Dependencies**: T013-T016
**Files**:
- `codex-chrome/tests/performance/event-dispatch.perf.test.ts` (create)

**Description**: Validate event dispatch performance goals (<50ms) with rollout persistence.

**Acceptance Criteria**:
- [ ] send_event() < 50ms (including rollout)
- [ ] Async persistence non-blocking
- [ ] No memory leaks in event loop

**Performance Goals**: plan.md lines 83-87

---

### T046: Manual testing in Chrome extension
**Category**: Testing
**Phase**: Validation
**Dependencies**: T037-T039 (integration tests pass)
**Files**:
- N/A (manual testing)

**Description**: Load codex-chrome extension in Chrome and manually test session lifecycle, task execution, and rollout persistence.

Test checklist (from quickstart.md):
1. Load extension in Chrome
2. Open DevTools console
3. Create new session → verify no errors
4. Spawn task → verify task runs
5. Interrupt task → verify abortion
6. Check rollout persistence → verify items saved
7. Reload extension → verify session resumed
8. Check memory usage < 50MB

**Acceptance Criteria**:
- [ ] Extension loads without errors
- [ ] Session methods work in browser
- [ ] No console errors
- [ ] Performance goals met
- [ ] Rollout persistence works

**Quickstart Reference**: quickstart.md Manual Testing section

---

### T047: Final code review and cleanup
**Category**: Polish
**Phase**: Final
**Dependencies**: T040-T046 (all polish tasks complete)
**Files**:
- `codex-chrome/src/core/Session.ts`
- `codex-chrome/src/core/session/state/` (all files)

**Description**: Final code review, remove duplication, ensure consistency, verify all acceptance criteria met.

Checklist:
- [ ] All 22 methods implemented
- [ ] All contract tests pass
- [ ] All integration tests pass
- [ ] Performance goals met
- [ ] JSDoc complete
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Code follows codex-chrome conventions
- [ ] Browser constraints respected
- [ ] Code reuse maximized

**Acceptance Criteria**:
- [ ] All checklist items complete
- [ ] Ready for PR/merge

---

## Dependencies

**Critical Path** (sequential dependencies):
1. T001-T003 → T004-T009 (setup → tests)
2. T004-T009 → T010-T036 (tests → implementation)
3. T010-T036 → T037-T039 (implementation → integration tests)
4. T037-T039 → T040-T047 (integration → polish)

**Phase Dependencies**:
- Phase 1 (Foundation): T002-T003 → T010-T012
- Phase 2 (Events): T010-T012 → T013-T016
- Phase 3 (Approvals): T017 → T018
- Phase 4 (Tasks): T017, T019 → T020-T026
- Phase 5 (Rollout): T011 → T027-T030
- Phase 6 (Token): T016 → T031-T032
- Phase 7 (Init): T028, T030 → T035-T036

**Method-Level Dependencies**:
- T013 (send_event) blocks T014, T015, T016, T024, T025
- T017 (ActiveTurn approvals) blocks T018, T019
- T019 (ActiveTurn tasks) blocks T020-T026
- T011 (SessionState methods) blocks T028, T030
- T027 (persist helpers) blocks T028
- T028 (record_conversation_items) blocks T029, T035, T036
- T030 (reconstruct) blocks T036

---

## Parallel Execution Examples

**Tests (Phase 3.2) - Run all in parallel:**
```bash
# All contract tests can run simultaneously (different files)
T004 & T005 & T006 & T007 & T008 & T009 & wait
```

**Foundation (Phase 1) - Partial parallelism:**
```bash
# T002 and T003 in parallel (different files)
T002 & T003 & wait
# Then T010-T012 (same file, sequential)
T010 → T011 → T012
```

**Event Infrastructure (Phase 2) - Sequential (same file):**
```bash
T013 → T014 → T015 → T016
```

**Token Tracking (Phase 6) - Parallel:**
```bash
T031 & T032 & wait
```

**Documentation (Phase 3.5) - Parallel:**
```bash
T040 & T041 & T042 & T044 & T045 & wait
```

---

## Task Summary

**Total Tasks**: 47

**By Category**:
- Setup & Types: 3 (T001-T003)
- Contract Tests: 6 (T004-T009)
- Core Implementation: 27 (T010-T036)
- Integration Tests: 3 (T037-T039)
- Documentation: 4 (T040-T043)
- Performance & Testing: 3 (T044-T046)
- Final Polish: 1 (T047)

**By Phase**:
- Phase 1 (Foundation): 5 methods (T010-T012, T011 in SessionState)
- Phase 2 (Events): 4 methods (T013-T016)
- Phase 3 (Approvals): 2 tasks (T017-T018 = 1 method + ActiveTurn enhancement)
- Phase 4 (Task Lifecycle): 9 tasks (T019-T026 = 8 methods + ActiveTurn enhancement)
- Phase 5 (Rollout): 4 methods (T027-T030)
- Phase 6 (Token): 2 methods (T031-T032)
- Phase 7 (Init & Utils): 4 methods (T033-T036)

**Methods Implemented**: 22 browser-compatible methods
**Methods Excluded**: 11 (MCP, shell, file operations)

**Estimated Timeline**: 4-6 weeks (per plan.md)

---

## Validation Checklist
*GATE: Verify before starting implementation*

- [x] All contracts have corresponding tests (T004-T009)
- [x] All 22 methods have implementation tasks (T010-T036)
- [x] All tests come before implementation (TDD enforced)
- [x] Parallel tasks are independent (different files or truly parallel methods)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Browser constraints respected (no MCP/shell/file operations)
- [x] Code reuse opportunities identified
- [x] Integration tests cover end-to-end workflows (T037-T039)
- [x] Documentation tasks included (T040-T043)
- [x] Performance validation included (T044-T045)
- [x] Manual testing checklist provided (T046)

---

*Based on plan.md, research.md, data-model.md, contracts/, and quickstart.md*
*Generated: 2025-10-01*
*Total: 47 tasks for 22 browser-compatible Session methods*
*Ready for execution following TDD principles and code reuse strategies*
