# Research: Remove activeTask from CodexAgent, Move Task Management to Session

**Feature**: Phase 2 of CodexAgent Rust Alignment - Task Management Migration
**Date**: 2025-10-03
**Status**: Architecture Analysis

## Problem Statement

The TypeScript `CodexAgent` class currently holds an `activeTask` field that tracks the running task:

```typescript
// codex-chrome/src/core/CodexAgent.ts:33
private activeTask: AgentTask | null = null;
```

However, in the Rust `codex-rs` implementation, the **Codex struct does NOT hold active tasks**. Instead, **Session** manages all task state via:
- `spawn_task()` method
- `register_new_active_task()` internal method
- `take_all_running_tasks()` for cleanup
- Task state stored in Session's internal state

This creates an **architectural misalignment** where:
1. TypeScript: CodexAgent owns the task → CodexAgent manages lifecycle
2. Rust: Session owns tasks → Codex just coordinates submissions

## Root Cause Analysis

### Why CodexAgent Has activeTask in TypeScript

**Historical Context**:
- TypeScript port was created as a direct translation
- AgentTask was added as a browser-specific coordinator layer
- activeTask field was added to track the current running task
- CodexAgent directly creates and manages AgentTask instances

**Current Usage** (needs investigation):
```typescript
// When does CodexAgent set activeTask?
// When does it read activeTask?
// What methods depend on activeTask?
```

### Why Rust Session Manages Tasks

**Rust Architecture** (`codex-rs/core/src/tasks/mod.rs`):
```rust
impl Session {
    pub async fn spawn_task<T: SessionTask>(
        self: &Arc<Self>,
        turn_context: Arc<TurnContext>,
        sub_id: String,
        input: Vec<InputItem>,
        task: T,
    ) {
        self.abort_all_tasks(TurnAbortReason::Replaced).await;

        // Create task and spawn async execution
        let task: Arc<dyn SessionTask> = Arc::new(task);
        let handle = tokio::spawn(async move { ... });

        // Register task in Session state
        let running_task = RunningTask { handle, kind, task };
        self.register_new_active_task(sub_id, running_task).await;
    }
}
```

**Key Patterns**:
1. **Session.spawn_task()**: Single entry point for task creation
2. **Session state**: Holds all running tasks (not Codex)
3. **Automatic abort**: Before spawning new task, abort existing ones
4. **Tokio handles**: Rust uses tokio::spawn with abort handles
5. **Task completion**: Session emits TaskComplete events

## Architectural Options

### Option 1: Move activeTask to Session (RECOMMENDED)

**Approach**: Follow Rust pattern exactly - Session manages task lifecycle

**Changes Required**:

1. **Add to Session.ts**:
```typescript
class Session {
  private runningTasks: Map<string, RunningTask> = new Map();

  async spawnTask(
    task: SessionTask,
    turnContext: TurnContext,
    subId: string,
    input: InputItem[]
  ): Promise<void> {
    // Abort all existing tasks
    await this.abortAllTasks('Replaced');

    // Create and register task
    const runningTask = {
      kind: task.kind(),
      abortController: new AbortController(),
      promise: task.run(this, turnContext, subId, input)
    };
    this.runningTasks.set(subId, runningTask);

    // Execute and handle completion
    try {
      const result = await runningTask.promise;
      await this.onTaskFinished(subId, result);
    } catch (error) {
      await this.onTaskAborted(subId, error);
    }
  }

  async abortAllTasks(reason: string): Promise<void> {
    for (const [subId, task] of this.runningTasks) {
      task.abortController.abort();
      // Emit TurnAborted event
    }
    this.runningTasks.clear();
  }

  private async onTaskFinished(subId: string, result: string | null): Promise<void> {
    this.runningTasks.delete(subId);
    // Emit TaskComplete event
  }
}
```

2. **Update CodexAgent.ts**:
```typescript
class CodexAgent {
  // REMOVE: private activeTask: AgentTask | null = null;

  private async handleUserInput(op: UserInputOp): Promise<void> {
    // Create task instance
    const task = new RegularTask();

    // Delegate to Session.spawnTask() instead of managing activeTask
    await this.session.spawnTask(task, turnContext, subId, input);
  }
}
```

**Benefits**:
- ✅ Aligns with Rust architecture
- ✅ Session has full visibility into task state
- ✅ Centralized task lifecycle management
- ✅ Automatic cleanup of old tasks
- ✅ Session can emit task events directly

**Tradeoffs**:
- Requires Session to handle async task execution
- CodexAgent becomes purely a coordinator (doesn't track tasks)

### Option 2: Keep activeTask, Add Session.getActiveTask() (NOT RECOMMENDED)

**Approach**: Expose activeTask via Session but keep it in CodexAgent

```typescript
class CodexAgent {
  private activeTask: AgentTask | null = null; // Keep

  getSession(): Session {
    return this.session.withActiveTask(this.activeTask);
  }
}
```

**Rejected because**:
- ❌ Doesn't align with Rust architecture
- ❌ Duplicates state (activeTask in CodexAgent, exposed via Session)
- ❌ Session doesn't truly own task lifecycle

### Option 3: Session Wrapper Pattern (NOT RECOMMENDED)

**Approach**: Create SessionTaskManager wrapper

```typescript
class SessionTaskManager {
  constructor(private session: Session) {}

  async spawnTask(...) { ... }
}

class CodexAgent {
  private taskManager: SessionTaskManager;
  // No activeTask field
}
```

**Rejected because**:
- ❌ Adds unnecessary layer
- ❌ Session should manage its own tasks directly
- ❌ Extra complexity without benefit

## Decision

**SELECTED: Option 1 - Move activeTask to Session**

**Rationale**:
1. **Architectural Alignment**: Matches Rust `codex-rs` exactly
2. **Centralized State**: Session owns all task-related state
3. **Clean Separation**: CodexAgent = SQ/EQ coordinator, Session = task executor
4. **Future-Proof**: Supports multiple concurrent tasks (if needed later)

## Implementation Strategy

### Phase 1: Add Session Task Management

**Changes**:
1. Add `runningTasks: Map<string, RunningTask>` to Session
2. Add `spawnTask()` method to Session
3. Add `abortAllTasks()` method to Session
4. Add `onTaskFinished()` / `onTaskAborted()` handlers
5. Emit TaskComplete/TurnAborted events from Session

**Files**:
- `codex-chrome/src/core/Session.ts` (~100 lines added)
- `codex-chrome/src/core/session/state/types.ts` (add RunningTask type)

### Phase 2: Remove activeTask from CodexAgent

**Changes**:
1. Remove `private activeTask: AgentTask | null` field
2. Update all handlers to call `session.spawnTask()` instead
3. Remove direct AgentTask creation in CodexAgent
4. Remove activeTask references in approval/abort flows

**Files**:
- `codex-chrome/src/core/CodexAgent.ts` (~50 lines changed)

### Phase 3: Update AgentTask Integration

**Analysis**: AgentTask is a browser-specific coordinator that sits between SessionTask and TaskRunner.

**Current Architecture**:
```
CodexAgent → AgentTask → TaskRunner
```

**New Architecture**:
```
CodexAgent → Session.spawnTask()
    └→ SessionTask (RegularTask/CompactTask)
        └→ AgentTask (browser coordinator)
            └→ TaskRunner (execution)
```

**Decision**: Keep AgentTask as-is, but Session creates it (not CodexAgent)

### Phase 4: Event Emission Updates

**Current**: CodexAgent emits TaskComplete after activeTask finishes
**New**: Session emits TaskComplete after spawnTask() completes

**Changes**:
- Move TaskComplete emission to Session.onTaskFinished()
- Move TurnAborted emission to Session.onTaskAborted()

## Type Definitions

### RunningTask Type

```typescript
// codex-chrome/src/core/session/state/types.ts
export interface RunningTask {
  kind: TaskKind;
  abortController: AbortController;
  promise: Promise<string | null>;
  startTime: number;
}
```

### Session Method Signatures

```typescript
class Session {
  async spawnTask(
    task: SessionTask,
    turnContext: TurnContext,
    subId: string,
    input: InputItem[]
  ): Promise<void>;

  async abortAllTasks(reason: TurnAbortReason): Promise<void>;

  getRunningTasks(): Map<string, RunningTask>;

  hasRunningTask(subId: string): boolean;
}
```

## Rust Reference Patterns

### Rust Session.spawn_task()

```rust
pub async fn spawn_task<T: SessionTask>(
    self: &Arc<Self>,
    turn_context: Arc<TurnContext>,
    sub_id: String,
    input: Vec<InputItem>,
    task: T,
) {
    self.abort_all_tasks(TurnAbortReason::Replaced).await;

    let task: Arc<dyn SessionTask> = Arc::new(task);
    let handle = tokio::spawn(async move {
        let last_agent_message = task_for_run.run(...).await;
        sess.on_task_finished(sub_clone, last_agent_message).await;
    }).abort_handle();

    let running_task = RunningTask { handle, kind, task };
    self.register_new_active_task(sub_id, running_task).await;
}
```

**TypeScript Equivalent**:
```typescript
async spawnTask(
  task: SessionTask,
  turnContext: TurnContext,
  subId: string,
  input: InputItem[]
): Promise<void> {
  await this.abortAllTasks('Replaced');

  const abortController = new AbortController();
  const promise = (async () => {
    try {
      return await task.run(this, turnContext, subId, input);
    } finally {
      await this.onTaskFinished(subId);
    }
  })();

  this.runningTasks.set(subId, {
    kind: task.kind(),
    abortController,
    promise,
    startTime: Date.now()
  });

  // Don't await - let task run async
}
```

## Testing Strategy

### Unit Tests

1. **Session.spawnTask()**:
   - Test task registration
   - Test old task abortion before new task
   - Test task completion handling

2. **Session.abortAllTasks()**:
   - Test multiple tasks aborted
   - Test TurnAborted events emitted
   - Test runningTasks map cleared

3. **CodexAgent (updated)**:
   - Test activeTask field removed
   - Test session.spawnTask() called correctly
   - Test no direct AgentTask creation

### Integration Tests

1. **Full Task Lifecycle**:
   - Submit UserInput op
   - Verify Session.spawnTask() called
   - Verify task runs to completion
   - Verify TaskComplete event emitted

2. **Task Replacement**:
   - Start task A
   - Submit new UserInput (task B)
   - Verify task A aborted
   - Verify task B started

## Migration Path

**Backward Compatibility**:
- CodexAgent public API unchanged (submitOperation, getNextEvent)
- Internal refactor only (activeTask → Session.spawnTask)

**Rollout**:
1. Add Session.spawnTask() (new functionality)
2. Update CodexAgent to use Session.spawnTask()
3. Remove activeTask field
4. Verify all tests pass

## Risks and Mitigations

**Risk 1**: Breaking task lifecycle events
**Mitigation**: Move event emission to Session carefully, preserve event order

**Risk 2**: Concurrent task handling edge cases
**Mitigation**: Follow Rust pattern exactly (abort old before spawning new)

**Risk 3**: AbortController not canceling properly
**Mitigation**: Test abort flow thoroughly, ensure cleanup

## Conclusion

**Problem**: CodexAgent holds activeTask, diverging from Rust where Session manages tasks

**Solution**: Remove activeTask from CodexAgent, add Session.spawnTask() matching Rust pattern

**Impact**: ~150 lines changed (100 added to Session, 50 modified in CodexAgent)

**Risk**: Low - internal refactor, public API unchanged

**Benefit**: Full architectural alignment with proven Rust implementation
