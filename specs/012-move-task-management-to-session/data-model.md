# Data Model: Move Task Management from CodexAgent to Session

**Feature**: 012-move-task-management-to-session
**Date**: 2025-10-03
**Input**: Functional requirements from `spec.md`

## Overview

This document defines the data entities and their relationships for moving task management from CodexAgent to Session.

**Key Changes**:
1. **Session** gains task management capabilities (spawnTask, abortAllTasks, runningTasks map)
2. **RunningTask** type created to represent active tasks
3. **CodexAgent** loses activeTask field, delegates to Session

## Entities

### 1. RunningTask (NEW)

**Purpose**: Represents an active task in Session state

**Type Definition**:
```typescript
// codex-chrome/src/core/session/state/types.ts

export interface RunningTask {
  /** Type of task (Regular or Compact) */
  kind: TaskKind;

  /** AbortController for cancelling task execution */
  abortController: AbortController;

  /** Promise representing the running task (returns final assistant message or null) */
  promise: Promise<string | null>;

  /** Timestamp when task was spawned (for debugging/monitoring) */
  startTime: number;
}
```

**Relationships**:
- Stored in `Session.runningTasks` map with `subId` as key
- Created by `Session.spawnTask()`
- Cleaned up by `Session.abortAllTasks()` or on task completion

**Validation Rules**:
- `kind` must be valid TaskKind enum value ('Regular' or 'Compact')
- `abortController` must be non-null AbortController instance
- `promise` must be non-null Promise
- `startTime` must be valid Unix timestamp (milliseconds)

**State Transitions**:
```
[Created] --spawn--> [Running] --complete--> [Removed from map]
                        |
                        +--abort--> [Removed from map]
```

**Browser-Specific Notes**:
- `AbortController` replaces Rust `tokio::spawn` abort handle
- `Promise` replaces Rust `JoinHandle<Result<...>>`
- No `task: Arc<dyn SessionTask>` field needed (TypeScript has promise closure)

---

### 2. Session (UPDATED)

**Purpose**: Manage conversation state AND task lifecycle (matching Rust codex-rs)

**New Fields**:
```typescript
// codex-chrome/src/core/Session.ts (add to existing class)

/** Map of running tasks keyed by submission ID */
private runningTasks: Map<string, RunningTask> = new Map();
```

**New Methods**:

#### 2.1 spawnTask()

```typescript
/**
 * Spawn a new task and manage its lifecycle
 * Matches Rust: Session::spawn_task()
 *
 * @param task - The SessionTask to execute (RegularTask or CompactTask)
 * @param context - Turn context for execution
 * @param subId - Submission ID (unique identifier for this task)
 * @param input - Input items for the task
 *
 * Behavior:
 * 1. Abort all existing tasks (automatic replacement)
 * 2. Create RunningTask with AbortController
 * 3. Register in runningTasks map
 * 4. Execute task asynchronously (don't await - fire-and-forget)
 * 5. On completion: emit TaskComplete, remove from map
 * 6. On abort: emit TurnAborted, remove from map
 */
async spawnTask(
  task: SessionTask,
  context: TurnContext,
  subId: string,
  input: InputItem[]
): Promise<void>
```

**Implementation Notes**:
- Call `this.abortAllTasks('Replaced')` before spawning new task
- Create `AbortController` for cancellation
- Execute task.run() in Promise (fire-and-forget, don't await spawnTask)
- Handle both success (emit TaskComplete) and error (emit TurnAborted)
- Use try/finally to ensure cleanup

#### 2.2 abortAllTasks()

```typescript
/**
 * Abort all running tasks
 * Matches Rust: Session::abort_all_tasks()
 *
 * @param reason - Why tasks are being aborted (Replaced, UserInterrupt, etc.)
 *
 * Behavior:
 * 1. Iterate over runningTasks map
 * 2. Call abortController.abort() for each task
 * 3. Emit TurnAborted event for each task
 * 4. Clear runningTasks map
 */
async abortAllTasks(reason: TurnAbortReason): Promise<void>
```

**Implementation Notes**:
- Idempotent (safe to call multiple times)
- Emit events BEFORE clearing map (events reference subId)
- Use `for...of` loop over `this.runningTasks.entries()`

#### 2.3 getRunningTasks()

```typescript
/**
 * Get snapshot of running tasks (for debugging/monitoring)
 *
 * @returns Copy of runningTasks map (not live reference)
 */
getRunningTasks(): Map<string, RunningTask>
```

**Implementation Notes**:
- Return new Map (shallow copy) to prevent external mutation
- Used for status queries, not task control

#### 2.4 hasRunningTask()

```typescript
/**
 * Check if a specific task is running
 *
 * @param subId - Submission ID to check
 * @returns true if task exists in runningTasks map
 */
hasRunningTask(subId: string): boolean
```

**Implementation Notes**:
- Simple map.has() check
- Used for conditional logic in CodexAgent

#### 2.5 onTaskFinished() (private)

```typescript
/**
 * Handle task completion (internal callback)
 *
 * @param subId - Submission ID of completed task
 * @param result - Final assistant message (or null)
 */
private async onTaskFinished(subId: string, result: string | null): Promise<void>
```

**Behavior**:
- Remove task from runningTasks map
- Emit TaskComplete event via eventEmitter
- Log completion for debugging

#### 2.6 onTaskAborted() (private)

```typescript
/**
 * Handle task abortion (internal callback)
 *
 * @param subId - Submission ID of aborted task
 * @param error - Error that caused abort (or AbortError)
 */
private async onTaskAborted(subId: string, error: any): Promise<void>
```

**Behavior**:
- Remove task from runningTasks map
- Emit TurnAborted event via eventEmitter
- Log abort reason for debugging

**Relationships**:
- Session creates and manages RunningTask instances
- Session emits TaskComplete/TurnAborted events (not CodexAgent)
- CodexAgent calls session.spawnTask() to start tasks

**Validation Rules**:
- spawnTask() must abort old tasks BEFORE creating new one (prevent race conditions)
- Only one task per subId allowed in map (enforced by Map semantics)
- Events must be emitted BEFORE removing from map (observers need subId)

**State Transitions**:
```
[Session.runningTasks empty]
    |
    v
spawnTask(task, context, subId, input)
    |
    +---> abortAllTasks('Replaced')  // Clear old tasks
    |
    +---> Create RunningTask
    |
    +---> runningTasks.set(subId, runningTask)
    |
    +---> Execute task.run() (async, don't await)
            |
            +---> [Success] onTaskFinished(subId, result)
            |         |
            |         +---> Emit TaskComplete
            |         +---> runningTasks.delete(subId)
            |
            +---> [Abort] onTaskAborted(subId, error)
                      |
                      +---> Emit TurnAborted
                      +---> runningTasks.delete(subId)
```

---

### 3. CodexAgent (UPDATED)

**Purpose**: Coordinate submissions and events (NO task state management)

**Fields to REMOVE**:
```typescript
// DELETE THIS LINE from codex-chrome/src/core/CodexAgent.ts:33
private activeTask: AgentTask | null = null;
```

**Methods to UPDATE**:

#### 3.1 handleUserInput() (MODIFIED)

```typescript
// codex-chrome/src/core/CodexAgent.ts (~line 400)
private async handleUserInput(op: UserInputOp): Promise<void> {
  // ... existing TurnContext creation ...

  // CREATE SessionTask instance
  const task = new RegularTask();

  // DELEGATE to Session.spawnTask() (CHANGED - was setting activeTask)
  await this.session.spawnTask(task, turnContext, subId, input);

  // Session will emit TaskComplete/TurnAborted events
  // No need to track activeTask here
}
```

**Change**: Replace `this.activeTask = new AgentTask(...)` with `await this.session.spawnTask(task, ...)`

#### 3.2 handleInterrupt() (MODIFIED)

```typescript
// codex-chrome/src/core/CodexAgent.ts (~line 450)
private async handleInterrupt(op: InterruptOp): Promise<void> {
  // DELEGATE to Session.abortAllTasks() (CHANGED - was activeTask.cancel())
  await this.session.abortAllTasks('UserInterrupt');

  // Session will emit TurnAborted events
}
```

**Change**: Replace `this.activeTask?.cancel()` with `await this.session.abortAllTasks('UserInterrupt')`

**Relationships**:
- CodexAgent calls session.spawnTask() to start tasks
- CodexAgent NO LONGER tracks task state (Session owns it)
- CodexAgent still manages submission/event queues (SQ/EQ pattern unchanged)

**Validation Rules**:
- activeTask field MUST NOT exist after refactor (enforced by grep check)
- No direct AgentTask creation in CodexAgent (SessionTask creates AgentTask internally)
- Public API (submitOperation, getNextEvent) MUST remain unchanged

---

### 4. SessionTask (NO CHANGES)

**Purpose**: Interface for tasks executed by Session

**Definition**:
```typescript
// codex-chrome/src/core/tasks/SessionTask.ts (NO CHANGES)
export interface SessionTask {
  kind(): TaskKind;
  run(session: Session, context: TurnContext, subId: string, input: InputItem[]): Promise<string | null>;
  abort(session: Session, subId: string): Promise<void>;
}
```

**Implementations**:
- **RegularTask**: Delegates to AgentTask (no changes from Feature 011)
- **CompactTask**: Calls session.compact() (no changes)

**Note**: SessionTask implementations remain unchanged. Only Session and CodexAgent are modified.

---

## Type Conversions

### TurnAbortReason Enum

```typescript
// codex-chrome/src/core/session/state/types.ts (EXISTING)
export type TurnAbortReason =
  | 'Replaced'        // New task spawned, old task replaced
  | 'UserInterrupt'   // User called Interrupt operation
  | 'Error'           // Task failed with error
  | 'Timeout';        // Task exceeded time limit (future)
```

**Usage**: Passed to `Session.abortAllTasks(reason)` and emitted in TurnAborted events

---

## Rust → TypeScript Mapping

| Rust (codex-rs) | TypeScript (codex-chrome) | Notes |
|-----------------|---------------------------|-------|
| `Session.spawn_task()` | `Session.spawnTask()` | Same behavior, different casing |
| `Session.abort_all_tasks()` | `Session.abortAllTasks()` | Same behavior |
| `Session.register_new_active_task()` | (internal to spawnTask) | Not exposed publicly |
| `tokio::spawn(...)` | `Promise` fire-and-forget | Browser async pattern |
| `JoinHandle.abort_handle()` | `AbortController` | Browser cancellation API |
| `Arc<dyn SessionTask>` | `SessionTask` interface | TypeScript interface vs Rust trait object |
| `RunningTask { handle, kind, task }` | `RunningTask { kind, abortController, promise, startTime }` | Similar fields, adapted for browser |

---

## Summary of Changes

**Files Modified**:
1. `codex-chrome/src/core/session/state/types.ts`: +10 lines (RunningTask type)
2. `codex-chrome/src/core/Session.ts`: +100 lines (spawnTask, abortAllTasks, helpers)
3. `codex-chrome/src/core/CodexAgent.ts`: ~50 lines modified (remove activeTask, update handlers)

**Total Impact**: ~160 lines (10 new type, 100 new Session methods, 50 CodexAgent refactor)

**Architectural Change**: Task state ownership moves from CodexAgent → Session, matching Rust codex-rs pattern.
