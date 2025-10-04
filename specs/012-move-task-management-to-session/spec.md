# Feature Specification: Move Task Management from CodexAgent to Session

**Feature Branch**: `012-move-task-management-to-session`
**Created**: 2025-10-03
**Status**: Draft
**Input**: User requirement: "we should remove the activeTask field in CodexAgent in codex-chrome/src/core/CodexAgent.ts and let Session to handle the task management similar like codex-rs/core/src/tasks/mod.rs"

## Problem Statement

The TypeScript `CodexAgent` class currently holds an `activeTask` field that tracks running tasks, but the Rust `codex-rs` implementation manages all task state through `Session`. This architectural misalignment creates:

1. **State Duplication**: Task state lives in CodexAgent instead of Session
2. **Coordination Complexity**: CodexAgent must track tasks it doesn't own
3. **Divergence from Rust**: TypeScript port doesn't match proven Rust patterns

**Current (TypeScript)**:
```typescript
class CodexAgent {
  private activeTask: AgentTask | null = null; // ❌ Wrong layer
}
```

**Reference (Rust)**:
```rust
impl Session {
  pub async fn spawn_task<T: SessionTask>(...) {
    self.register_new_active_task(sub_id, running_task).await; // ✅ Correct layer
  }
}
```

---

## User Scenarios & Testing

### Primary User Story

A developer working on the Chrome extension notices that CodexAgent directly manages the `activeTask` field, but in the Rust codebase, Session owns all task lifecycle management. They need to refactor the TypeScript implementation to match the Rust architecture for consistency and maintainability.

### Acceptance Scenarios

1. **Given** a CodexAgent instance with the refactored architecture, **When** a user submits a UserInput operation, **Then** Session.spawnTask() is called instead of CodexAgent creating activeTask directly

2. **Given** a Session with a running task, **When** a new UserInput is submitted, **Then** Session automatically aborts the old task before spawning the new one (matching Rust behavior)

3. **Given** a running task, **When** the task completes successfully, **Then** Session emits a TaskComplete event with the final assistant message

4. **Given** a running task, **When** an Interrupt operation is submitted, **Then** Session.abortAllTasks() stops all tasks and emits TurnAborted events

5. **Given** CodexAgent after refactoring, **When** inspecting the class, **Then** there is no activeTask field present (moved to Session)

6. **Given** Session managing tasks, **When** querying active tasks, **Then** Session.getRunningTasks() returns the current task map

### Edge Cases

1. **Multiple rapid submissions**: Ensure only the latest task runs (old tasks aborted)
2. **Task abort during startup**: Handle abort called before task execution begins
3. **Concurrent abort calls**: Ensure idempotent abortion (no double-abort errors)
4. **Empty task map**: Handle getRunningTasks() when no tasks are active

---

## Functional Requirements

### FR1: Session Task Spawning
**ID**: FR1
**Priority**: MUST
**Description**: Session must provide a `spawnTask()` method that creates and manages task execution
**Acceptance**: Session.spawnTask(task, context, subId, input) registers task in internal state

### FR2: Automatic Task Replacement
**ID**: FR2
**Priority**: MUST
**Description**: When spawning a new task, Session must abort all existing tasks first
**Acceptance**: Calling spawnTask() twice in succession aborts the first task before starting the second

### FR3: Task State Storage
**ID**: FR3
**Priority**: MUST
**Description**: Session must maintain a `runningTasks` map tracking all active tasks
**Acceptance**: Session state includes Map<string, RunningTask> with subId keys

### FR4: Task Completion Handling
**ID**: FR4
**Priority**: MUST
**Description**: Session must emit TaskComplete event when a task finishes successfully
**Acceptance**: After task.run() completes, Session emits TaskComplete with final message

### FR5: Task Abortion Handling
**ID**: FR5
**Priority**: MUST
**Description**: Session must emit TurnAborted event when a task is aborted
**Acceptance**: When task is aborted, Session emits TurnAborted with reason

### FR6: Abort All Tasks
**ID**: FR6
**Priority**: MUST
**Description**: Session must provide abortAllTasks() to stop all running tasks
**Acceptance**: Session.abortAllTasks(reason) cancels all tasks in runningTasks map

### FR7: CodexAgent Delegation
**ID**: FR7
**Priority**: MUST
**Description**: CodexAgent must delegate task creation to Session.spawnTask()
**Acceptance**: CodexAgent handlers call session.spawnTask() instead of creating activeTask

### FR8: Remove activeTask Field
**ID**: FR8
**Priority**: MUST
**Description**: CodexAgent must not contain an activeTask field after refactoring
**Acceptance**: grep for "activeTask" in CodexAgent.ts returns no results

### FR9: Running Task Query
**ID**: FR9
**Priority**: SHOULD
**Description**: Session should provide methods to query running task state
**Acceptance**: Session.hasRunningTask(subId) and getRunningTasks() work correctly

### FR10: Event Emission from Session
**ID**: FR10
**Priority**: MUST
**Description**: Session must emit task lifecycle events (TaskComplete, TurnAborted)
**Acceptance**: Events emitted from Session methods, not CodexAgent

---

## Non-Functional Requirements

### NFR1: Performance
**Description**: Task spawning must complete in <10ms (excluding task execution)
**Metric**: Measure time from spawnTask() call to task registered in map

### NFR2: Memory
**Description**: RunningTask map must not leak (tasks removed on completion/abort)
**Metric**: Check map.size === 0 after all tasks complete

### NFR3: Compatibility
**Description**: Public CodexAgent API must remain unchanged
**Metric**: submitOperation() and getNextEvent() signatures identical

### NFR4: Consistency
**Description**: Task lifecycle events must match Rust behavior exactly
**Metric**: Event order and content matches codex-rs patterns

---

## Key Entities

1. **Session**: Extended with task management capabilities (spawnTask, abortAllTasks)
2. **RunningTask**: New type representing an active task (kind, abortController, promise)
3. **CodexAgent**: Refactored to remove activeTask field, delegate to Session
4. **SessionTask**: Interface remains unchanged (RegularTask, CompactTask implementations)

---

## Out of Scope

- ❌ Concurrent task execution (Rust aborts old task before spawning new one)
- ❌ Task priority queues (FIFO submission order maintained)
- ❌ Task persistence across sessions (in-memory only)
- ❌ MCP-related task handling (no MCP in codex-chrome per previous requirements)
- ❌ Review mode tasks (not implemented in codex-chrome)

---

## Success Criteria

1. ✅ CodexAgent has no activeTask field
2. ✅ Session.spawnTask() creates and manages tasks
3. ✅ Session.abortAllTasks() stops all running tasks
4. ✅ Session emits TaskComplete and TurnAborted events
5. ✅ All existing CodexAgent tests pass with updated implementation
6. ✅ Build succeeds with no TypeScript errors
7. ✅ Architectural alignment with Rust codex-rs verified

---

## Dependencies

**Requires**:
- Completed: Feature 011 (RegularTask → AgentTask delegation)
- Session class with state management
- SessionTask interface (RegularTask, CompactTask)
- AgentTask coordinator pattern
- Event emission infrastructure

**Blocked By**: None (dependencies satisfied)

---

## Technical Constraints

1. **Browser Environment**: Use AbortController instead of tokio::spawn abort handles
2. **TypeScript Async**: Use Promise instead of Rust Future
3. **No Threads**: Single-threaded event loop (no tokio::spawn equivalent)
4. **Session State**: Must be compatible with existing Session state management

---

## Clarifications

### Session 1: Task Lifecycle Management

**Q**: How should Session manage async task execution without tokio::spawn?
**A**: Use native Promises with AbortController for cancellation

**Q**: Should Session await task completion or fire-and-forget?
**A**: Fire-and-forget (don't await), similar to Rust tokio::spawn

**Q**: How to handle task abortion mid-execution?
**A**: AbortController.abort() signals cancellation, task checks signal periodically

### Session 2: Event Emission Strategy

**Q**: Should Session emit events directly or through CodexAgent?
**A**: Session emits TaskComplete/TurnAborted directly (owns task lifecycle)

**Q**: What about BackgroundEvent during task execution?
**A**: Task itself emits BackgroundEvent (via Session callback), Session emits lifecycle events

### Session 3: State Consistency

**Q**: What happens if spawnTask() is called while a task is running?
**A**: Abort old task first (Rust pattern: abort_all_tasks before spawning)

**Q**: Should runningTasks map be exposed publicly?
**A**: Provide query methods (hasRunningTask, getRunningTasks) but keep map private

---

## Review Checklist

- [X] No implementation details (focuses on WHAT, not HOW)
- [X] All requirements testable
- [X] User scenarios clear
- [X] Success criteria measurable
- [X] Dependencies identified
- [X] Constraints documented
- [X] Clarifications captured
