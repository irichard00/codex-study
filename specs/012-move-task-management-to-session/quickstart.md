# Quickstart: Move Task Management from CodexAgent to Session

**Feature**: 012-move-task-management-to-session
**Date**: 2025-10-03
**Purpose**: Validate that task management has been successfully moved from CodexAgent to Session

## Overview

This quickstart provides step-by-step validation scenarios to ensure:
1. CodexAgent no longer holds activeTask field
2. Session manages task lifecycle via spawnTask() and abortAllTasks()
3. Task lifecycle events (TaskComplete, TurnAborted) are emitted correctly
4. Architectural alignment with Rust codex-rs is achieved

## Prerequisites

- Feature 012 implementation completed
- `codex-chrome/` build successful (`npm run build`)
- Test suite available (`npm test`)

## Validation Scenarios

### Scenario 1: Verify activeTask Removed from CodexAgent

**Goal**: Confirm CodexAgent no longer holds task state

**Steps**:
```bash
cd /home/irichard/dev/study/codex-study/s1/codex-study/codex-chrome

# Search for activeTask references in CodexAgent
grep -n "activeTask" src/core/CodexAgent.ts

# Expected: No results (or only in comments/historical references)
# Success: grep returns empty or only comment references
```

**Expected Outcome**:
- ✅ No `private activeTask` field declaration
- ✅ No `this.activeTask` assignments
- ✅ No `this.activeTask?.cancel()` calls

**Failure Signals**:
- ❌ Line 33 still contains: `private activeTask: AgentTask | null = null;`
- ❌ Any `this.activeTask = ...` assignments found

---

### Scenario 2: Verify Session Has Task Management Methods

**Goal**: Confirm Session has spawnTask() and abortAllTasks() methods

**Steps**:
```bash
cd /home/irichard/dev/study/codex-study/s1/codex-study/codex-chrome

# Check for spawnTask method
grep -n "spawnTask" src/core/Session.ts

# Check for abortAllTasks method
grep -n "abortAllTasks" src/core/Session.ts

# Check for runningTasks field
grep -n "runningTasks" src/core/Session.ts
```

**Expected Outcome**:
- ✅ `async spawnTask(` method definition found
- ✅ `async abortAllTasks(` method definition found
- ✅ `private runningTasks: Map<string, RunningTask>` field found
- ✅ Helper methods: `getRunningTasks()`, `hasRunningTask()`

**Failure Signals**:
- ❌ No spawnTask method found
- ❌ No runningTasks map found
- ❌ Session still manages tasks via old pattern

---

### Scenario 3: Test UserInput Triggers Session.spawnTask()

**Goal**: Verify CodexAgent delegates task spawning to Session

**Test Code**:
```typescript
// codex-chrome/tests/integration/task-lifecycle.test.ts

import { describe, it, expect, vi } from 'vitest';
import { CodexAgent } from '@/core/CodexAgent';
import { Session } from '@/core/Session';

describe('UserInput task spawning', () => {
  it('should call Session.spawnTask() when UserInput submitted', async () => {
    const agent = new CodexAgent();
    const session = (agent as any).session; // Access private session

    // Spy on Session.spawnTask()
    const spawnTaskSpy = vi.spyOn(session, 'spawnTask');

    // Submit UserInput operation
    agent.submitOperation({
      type: 'UserInput',
      input: [{ type: 'text', text: 'Hello' }],
      sandbox_policy: 'DangerFullAccess'
    });

    // Process submission queue
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify Session.spawnTask() was called
    expect(spawnTaskSpy).toHaveBeenCalledOnce();
    expect(spawnTaskSpy.mock.calls[0][2]).toMatch(/^sub_/); // subId
  });
});
```

**Expected Outcome**:
- ✅ spawnTaskSpy called exactly once
- ✅ spawnTaskSpy receives SessionTask, TurnContext, subId, input
- ✅ No direct AgentTask creation in CodexAgent

**Failure Signals**:
- ❌ spawnTaskSpy not called (CodexAgent still using old pattern)
- ❌ CodexAgent creates AgentTask directly

---

### Scenario 4: Test Task Replacement (Abort Old Before Spawn New)

**Goal**: Verify Session aborts existing tasks before spawning new one

**Test Code**:
```typescript
// codex-chrome/tests/unit/Session.spawnTask.test.ts

import { describe, it, expect, vi } from 'vitest';
import { Session } from '@/core/Session';
import { RegularTask } from '@/core/tasks/RegularTask';
import { TurnContext } from '@/core/TurnContext';

describe('Session.spawnTask() task replacement', () => {
  it('should abort old task before spawning new task', async () => {
    const session = new Session();
    await session.initialize();

    const abortSpy = vi.spyOn(session, 'abortAllTasks');

    // Spawn first task
    const task1 = new RegularTask();
    const context = {} as TurnContext; // Mock context
    await session.spawnTask(task1, context, 'sub_1', []);

    // Spawn second task (should abort first)
    const task2 = new RegularTask();
    await session.spawnTask(task2, context, 'sub_2', []);

    // Verify abortAllTasks called with 'Replaced' reason
    expect(abortSpy).toHaveBeenCalledWith('Replaced');
    expect(abortSpy).toHaveBeenCalledTimes(2); // Once per spawnTask
  });
});
```

**Expected Outcome**:
- ✅ abortAllTasks() called before each spawnTask()
- ✅ Reason is 'Replaced'
- ✅ Only one task in runningTasks map at end

**Failure Signals**:
- ❌ Multiple tasks running concurrently (map has >1 entry)
- ❌ abortAllTasks() not called

---

### Scenario 5: Test Task Completion Emits TaskComplete Event

**Goal**: Verify Session emits TaskComplete when task finishes

**Test Code**:
```typescript
// codex-chrome/tests/unit/Session.spawnTask.test.ts

import { describe, it, expect } from 'vitest';
import { Session } from '@/core/Session';
import { RegularTask } from '@/core/tasks/RegularTask';

describe('Session task completion events', () => {
  it('should emit TaskComplete event when task finishes', async () => {
    const session = new Session();
    await session.initialize();

    let emittedEvent: any = null;
    session.setEventEmitter(async (event) => {
      emittedEvent = event;
    });

    // Spawn task
    const task = new RegularTask();
    const context = {} as TurnContext;
    await session.spawnTask(task, context, 'sub_test', [{ type: 'text', text: 'Test' }]);

    // Wait for task to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify TaskComplete event emitted
    expect(emittedEvent).toBeDefined();
    expect(emittedEvent.type).toBe('TaskComplete');
    expect(emittedEvent.subId).toBe('sub_test');
  });
});
```

**Expected Outcome**:
- ✅ TaskComplete event emitted after task.run() completes
- ✅ Event contains correct subId
- ✅ Task removed from runningTasks map after emission

**Failure Signals**:
- ❌ No event emitted
- ❌ Event emitted from CodexAgent instead of Session

---

### Scenario 6: Test Interrupt Aborts All Tasks

**Goal**: Verify handleInterrupt() calls Session.abortAllTasks()

**Test Code**:
```typescript
// codex-chrome/tests/integration/task-lifecycle.test.ts

import { describe, it, expect, vi } from 'vitest';
import { CodexAgent } from '@/core/CodexAgent';

describe('Interrupt operation', () => {
  it('should call Session.abortAllTasks() when Interrupt submitted', async () => {
    const agent = new CodexAgent();
    const session = (agent as any).session;

    const abortSpy = vi.spyOn(session, 'abortAllTasks');

    // Submit UserInput first (start a task)
    agent.submitOperation({
      type: 'UserInput',
      input: [{ type: 'text', text: 'Start task' }],
      sandbox_policy: 'DangerFullAccess'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Submit Interrupt
    agent.submitOperation({
      type: 'Interrupt',
      reason: 'User requested stop'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify abortAllTasks called with UserInterrupt
    expect(abortSpy).toHaveBeenCalledWith('UserInterrupt');
  });
});
```

**Expected Outcome**:
- ✅ abortAllTasks() called with 'UserInterrupt' reason
- ✅ TurnAborted events emitted for all running tasks
- ✅ runningTasks map cleared

**Failure Signals**:
- ❌ CodexAgent.handleInterrupt() still calls activeTask.cancel()
- ❌ Tasks not aborted

---

### Scenario 7: Test Multiple Rapid Submissions (Edge Case)

**Goal**: Ensure only the latest task runs when multiple submissions arrive rapidly

**Test Code**:
```typescript
// codex-chrome/tests/integration/rapid-submissions.test.ts

import { describe, it, expect } from 'vitest';
import { CodexAgent } from '@/core/CodexAgent';

describe('Rapid task submissions', () => {
  it('should only run the latest task', async () => {
    const agent = new CodexAgent();
    const session = (agent as any).session;

    // Submit 3 tasks rapidly
    agent.submitOperation({
      type: 'UserInput',
      input: [{ type: 'text', text: 'Task 1' }],
      sandbox_policy: 'DangerFullAccess'
    });

    agent.submitOperation({
      type: 'UserInput',
      input: [{ type: 'text', text: 'Task 2' }],
      sandbox_policy: 'DangerFullAccess'
    });

    agent.submitOperation({
      type: 'UserInput',
      input: [{ type: 'text', text: 'Task 3' }],
      sandbox_policy: 'DangerFullAccess'
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify only 1 task running (or 0 if already completed)
    const runningTasks = session.getRunningTasks();
    expect(runningTasks.size).toBeLessThanOrEqual(1);
  });
});
```

**Expected Outcome**:
- ✅ Only latest task executes
- ✅ Previous tasks aborted with 'Replaced' reason
- ✅ No concurrent task execution

**Failure Signals**:
- ❌ Multiple tasks running simultaneously
- ❌ Old tasks not aborted

---

### Scenario 8: Build Validation

**Goal**: Ensure TypeScript compilation succeeds

**Steps**:
```bash
cd /home/irichard/dev/study/codex-study/s1/codex-study/codex-chrome

# Clean build
npm run build
```

**Expected Outcome**:
- ✅ Build completes successfully
- ✅ No TypeScript errors related to activeTask removal
- ✅ No type mismatches in Session methods
- ✅ Output: `✓ built in X.XXs`

**Failure Signals**:
- ❌ TypeScript error: Cannot find name 'activeTask'
- ❌ Type mismatch in Session.spawnTask() parameters
- ❌ Missing RunningTask type definition

---

## Success Criteria

**All scenarios must pass** for feature to be considered complete:

1. ✅ **Scenario 1**: activeTask field removed from CodexAgent
2. ✅ **Scenario 2**: Session has spawnTask(), abortAllTasks(), runningTasks
3. ✅ **Scenario 3**: UserInput triggers Session.spawnTask()
4. ✅ **Scenario 4**: Task replacement works (abort old before spawn new)
5. ✅ **Scenario 5**: TaskComplete event emitted on completion
6. ✅ **Scenario 6**: Interrupt operation aborts all tasks
7. ✅ **Scenario 7**: Rapid submissions handled correctly
8. ✅ **Scenario 8**: Build succeeds with no TypeScript errors

## Architectural Validation

**Final Check - Rust Alignment**:
```bash
# Compare TypeScript Session with Rust Session
# Check that TypeScript methods match Rust signatures

# Rust reference: codex-rs/core/src/tasks/mod.rs
# TypeScript implementation: codex-chrome/src/core/Session.ts

# Verify matching patterns:
# - spawn_task() → spawnTask()
# - abort_all_tasks() → abortAllTasks()
# - RunningTask struct → RunningTask interface
# - Event emission timing (after task completion/abort)
```

**Expected Alignment**:
- ✅ Session owns task state (not Codex/CodexAgent)
- ✅ Automatic task replacement before spawning new
- ✅ Event emission from Session (not CodexAgent)
- ✅ AbortController pattern matches Rust abort handles

---

## Troubleshooting

### Issue: activeTask still exists in CodexAgent

**Solution**:
1. Verify T008 (remove activeTask field) was executed
2. Check git diff to see if line 33 was modified
3. Re-run: `grep -n "private activeTask" src/core/CodexAgent.ts`

### Issue: Session.spawnTask() not found

**Solution**:
1. Verify T005 (add spawnTask method) was executed
2. Check Session.ts for method definition
3. Ensure TypeScript compilation didn't fail

### Issue: Tests fail with "spawnTask is not a function"

**Solution**:
1. Rebuild: `npm run build`
2. Check Session.ts exports spawnTask correctly
3. Verify Session instance is initialized before calling

### Issue: Multiple tasks running concurrently

**Solution**:
1. Check spawnTask() calls abortAllTasks() at start
2. Verify abortAllTasks() clears runningTasks map
3. Add logging to track task spawning order

---

## Performance Benchmarks

**Non-Functional Requirements Validation**:

```typescript
// Performance test (optional)
describe('Session performance', () => {
  it('should spawn task in <10ms', async () => {
    const session = new Session();
    const task = new RegularTask();
    const context = {} as TurnContext;

    const start = performance.now();
    await session.spawnTask(task, context, 'perf_test', []);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // NFR1: <10ms
  });

  it('should not leak memory (runningTasks cleared)', async () => {
    const session = new Session();

    // Spawn and complete 100 tasks
    for (let i = 0; i < 100; i++) {
      const task = new RegularTask();
      await session.spawnTask(task, {} as TurnContext, `task_${i}`, []);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Verify map is empty after all complete
    expect(session.getRunningTasks().size).toBe(0); // NFR2: No leaks
  });
});
```

**Expected Performance**:
- ✅ Task spawning: <10ms (NFR1)
- ✅ Memory: runningTasks map.size === 0 after all tasks complete (NFR2)
- ✅ Compatibility: Public CodexAgent API unchanged (NFR3)

---

## Completion Checklist

Before marking Feature 012 as complete:

- [ ] All 8 validation scenarios pass
- [ ] Build succeeds with no errors
- [ ] activeTask field completely removed from CodexAgent
- [ ] Session.spawnTask() and abortAllTasks() working correctly
- [ ] Task lifecycle events emitted from Session
- [ ] Rust alignment verified (Session owns tasks, not Codex)
- [ ] Performance benchmarks met (NFR1-NFR4)
- [ ] No regressions in existing tests
- [ ] CLAUDE.md updated with new architecture

---

**Ready for /tasks command** to generate detailed implementation tasks.
