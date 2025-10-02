# Quickstart Guide: Testing Missing Session Methods

## Overview

This guide provides step-by-step instructions for testing the newly implemented Session methods from codex-rs. It covers all six categories of missing methods with practical examples and integration test scenarios.

## Prerequisites

```bash
cd codex-chrome
npm install
npm run build
```

## Category 1: Session Lifecycle

### Testing `new()` Factory Method

#### Test 1.1: Create New Session

```typescript
import { Session } from '../src/core/Session';
import { AgentConfig } from '../src/config/AgentConfig';

async function testNewSession() {
  const config = new AgentConfig({
    model: 'gpt-4',
    cwd: '/workspace'
  });

  const { session, turnContext } = await Session.new(
    {
      conversationId: 'conv_test_new',
      instructions: 'You are a helpful assistant',
      cwd: '/workspace',
      model: 'gpt-4'
    },
    config,
    { mode: 'new' }
  );

  console.log('Session created:', session.getId());
  console.log('Turn context:', turnContext);

  // Verify
  assert(session.getId() === 'conv_test_new');
  assert(turnContext.model === 'gpt-4');
  assert(turnContext.cwd === '/workspace');
}
```

#### Test 1.2: Resume Existing Session

```typescript
async function testResumeSession() {
  // First, create and populate a session
  const rollout = await RolloutRecorder.create(
    { type: 'create', conversationId: 'conv_existing' },
    config
  );

  await rollout.recordItems([
    {
      type: 'response_item',
      payload: {
        role: 'user',
        content: 'Hello'
      }
    },
    {
      type: 'response_item',
      payload: {
        role: 'assistant',
        content: 'Hi there!'
      }
    }
  ]);

  // Load rollout items
  const items = await rollout.getRolloutHistory();

  // Resume session
  const { session, turnContext } = await Session.new(
    {
      conversationId: 'conv_existing',
      cwd: '/workspace'
    },
    config,
    { mode: 'resumed', rolloutItems: items }
  );

  // Verify history reconstructed
  const history = session.getConversationHistory();
  assert(history.items.length === 2);
  assert(history.items[0].content === 'Hello');
  assert(history.items[1].content === 'Hi there!');
}
```

#### Test 1.3: Fork Session

```typescript
async function testForkSession() {
  // Load source session rollout
  const sourceItems = await loadRolloutItems('conv_source');

  // Fork to new session
  const { session, turnContext } = await Session.new(
    {
      conversationId: 'conv_forked',
      cwd: '/workspace'
    },
    config,
    {
      mode: 'forked',
      rolloutItems: sourceItems,
      sourceConversationId: 'conv_source'
    }
  );

  // Verify forked history
  const history = session.getConversationHistory();
  assert(history.items.length > 0);

  // Verify new rollout created
  const forkedRollout = session.services?.rollout;
  assert(forkedRollout !== null);
}
```

### Testing `record_initial_history()`

```typescript
async function testRecordInitialHistory() {
  const session = new Session(config);
  await session.initialize();

  const turnContext = new TurnContext({
    cwd: '/workspace',
    model: 'gpt-4',
    approval_policy: 'on-request',
    sandbox_policy: { mode: 'workspace-write' },
    summary: { enabled: false }
  });

  // Test NEW mode
  await session.recordInitialHistory(
    turnContext,
    { mode: 'new' }
  );

  const history = session.getConversationHistory();
  assert(history.items.length > 0);
  assert(history.items[0].role === 'system');
  assert(history.items[0].content.includes('/workspace'));
}
```

### Testing `next_internal_sub_id()`

```typescript
async function testInternalSubId() {
  const session = new Session(config);

  const id1 = session.nextInternalSubId();
  const id2 = session.nextInternalSubId();
  const id3 = session.nextInternalSubId();

  assert(id1 !== id2);
  assert(id2 !== id3);
  assert(id1.startsWith('internal-'));
  assert(id2.startsWith('internal-'));
  assert(id3.startsWith('internal-'));
}
```

## Category 2: Approval Handling

### Testing `request_command_approval()`

```typescript
async function testCommandApproval() {
  const session = new Session(config);
  await session.initialize();
  await session.startTurn();

  const subId = 'sub_123';
  const callId = 'call_456';
  const command = ['git', 'commit', '-m', 'test'];
  const cwd = '/workspace';

  // Request approval (returns Promise)
  const approvalPromise = session.requestCommandApproval(
    subId,
    callId,
    command,
    cwd,
    'Need to commit changes'
  );

  // Simulate user approval (in parallel)
  setTimeout(async () => {
    await session.notifyApproval(subId, 'approve');
  }, 100);

  // Wait for decision
  const decision = await approvalPromise;

  assert(decision === 'approve');
}
```

### Testing `request_patch_approval()`

```typescript
async function testPatchApproval() {
  const session = new Session(config);
  await session.initialize();
  await session.startTurn();

  const patchAction = {
    path: '/workspace/src/main.ts',
    patch: `--- a/main.ts
+++ b/main.ts
@@ -1,3 +1,4 @@
+// New comment
 function main() {
   console.log('hello');
 }`,
    description: 'Add comment'
  };

  const approvalPromise = session.requestPatchApproval(
    'sub_123',
    'call_456',
    patchAction,
    'Adding documentation comment',
    '/workspace'
  );

  // Simulate user rejection
  setTimeout(async () => {
    await session.notifyApproval('sub_123', 'reject');
  }, 100);

  const decision = await approvalPromise;

  assert(decision === 'reject');
}
```

### Testing `notify_approval()`

```typescript
async function testNotifyApproval() {
  const session = new Session(config);
  await session.initialize();
  await session.startTurn();

  let receivedDecision: string | null = null;

  // Request approval
  session.requestCommandApproval(
    'sub_test',
    'call_test',
    ['echo', 'test'],
    '/',
    'Test command'
  ).then(decision => {
    receivedDecision = decision;
  });

  // Notify approval
  await session.notifyApproval('sub_test', 'approve');

  // Wait for promise to resolve
  await new Promise(resolve => setTimeout(resolve, 50));

  assert(receivedDecision === 'approve');
}
```

## Category 3: Event Management

### Testing `send_event()`

```typescript
async function testSendEvent() {
  const session = new Session(config);
  await session.initialize();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  await session.sendEvent({
    id: 'evt_123',
    msg: {
      type: 'AgentMessage',
      data: { message: 'Test message' }
    }
  });

  // Verify event emitted
  assert(events.length === 1);
  assert(events[0].id === 'evt_123');

  // Verify event persisted to rollout
  const rollout = session.services?.rollout;
  if (rollout) {
    const items = await rollout.getRolloutHistory();
    const eventItems = items.filter(item => item.type === 'event_msg');
    assert(eventItems.length > 0);
  }
}
```

### Testing `on_exec_command_begin()` and `on_exec_command_end()`

```typescript
async function testExecCommandEvents() {
  const session = new Session(config);
  await session.initialize();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  const turnDiffTracker = new TurnDiffTracker();

  // Begin
  await session.onExecCommandBegin(
    turnDiffTracker,
    {
      subId: 'sub_123',
      callId: 'call_456',
      command: ['npm', 'test'],
      cwd: '/workspace',
      reason: 'Run tests',
      isPatchApply: false
    }
  );

  // Verify begin event
  const beginEvents = events.filter(e => e.msg.type === 'ExecCommandBegin');
  assert(beginEvents.length === 1);
  assert(beginEvents[0].msg.data.command === 'npm test');

  // End
  await session.onExecCommandEnd(
    turnDiffTracker,
    'sub_123',
    'call_456',
    {
      stdout: 'Tests passed',
      stderr: '',
      exitCode: 0,
      durationMs: 1234,
      startTime: Date.now() - 1234,
      endTime: Date.now(),
      success: true
    },
    false
  );

  // Verify end event
  const endEvents = events.filter(e => e.msg.type === 'ExecCommandEnd');
  assert(endEvents.length === 1);
  assert(endEvents[0].msg.data.exit_code === 0);
}
```

### Testing `run_exec_with_events()`

```typescript
async function testRunExecWithEvents() {
  const session = new Session(config);
  await session.initialize();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  const turnDiffTracker = new TurnDiffTracker();

  const output = await session.runExecWithEvents(
    turnDiffTracker,
    {
      subId: 'sub_123',
      callId: 'call_456',
      command: ['echo', 'hello'],
      cwd: '/workspace',
      isPatchApply: false
    },
    {
      command: ['echo', 'hello'],
      cwd: '/workspace',
      timeoutMs: 5000
    }
  );

  // Verify output
  assert(output.exitCode === 0);
  assert(output.stdout.includes('hello'));

  // Verify events: begin + end
  assert(events.length >= 2);
  assert(events.some(e => e.msg.type === 'ExecCommandBegin'));
  assert(events.some(e => e.msg.type === 'ExecCommandEnd'));
}
```

## Category 4: Task Lifecycle

### Testing `spawn_task()`

```typescript
class TestTask implements SessionTask {
  kind = TaskKind.Regular;
  executed = false;

  async execute(
    session: Session,
    turnContext: TurnContext,
    signal: AbortSignal
  ): Promise<void> {
    this.executed = true;
    await new Promise(resolve => setTimeout(resolve, 100));

    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
  }
}

async function testSpawnTask() {
  const session = new Session(config);
  await session.initialize();

  const task = new TestTask();
  const turnContext = session.getTurnContext();

  await session.spawnTask(
    turnContext,
    'sub_123',
    [],
    task
  );

  // Wait for task to execute
  await new Promise(resolve => setTimeout(resolve, 200));

  assert(task.executed === true);
}
```

### Testing `abort_all_tasks()`

```typescript
async function testAbortAllTasks() {
  const session = new Session(config);
  await session.initialize();

  let abortCalled = false;

  class AbortableTask implements SessionTask {
    kind = TaskKind.Regular;

    async execute(
      session: Session,
      turnContext: TurnContext,
      signal: AbortSignal
    ): Promise<void> {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async abort(reason: TurnAbortReason): Promise<void> {
      abortCalled = true;
    }
  }

  const task = new AbortableTask();
  const turnContext = session.getTurnContext();

  // Spawn task
  await session.spawnTask(turnContext, 'sub_123', [], task);

  // Abort immediately
  await session.abortAllTasks({ type: 'interrupted' });

  // Verify abort called
  await new Promise(resolve => setTimeout(resolve, 100));
  assert(abortCalled === true);
}
```

### Testing `on_task_finished()`

```typescript
async function testOnTaskFinished() {
  const session = new Session(config);
  await session.initialize();
  await session.startTurn();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  // Register a task
  const runningTask: RunningTask = {
    handle: new AbortController(),
    kind: TaskKind.Regular,
    startTime: Date.now(),
    subId: 'sub_123'
  };

  await session.registerNewActiveTask('sub_123', runningTask);

  // Finish the task
  await session.onTaskFinished('sub_123', 'Task completed successfully');

  // Verify TaskComplete event
  const completeEvents = events.filter(e => e.msg.type === 'TaskComplete');
  assert(completeEvents.length === 1);
  assert(completeEvents[0].msg.data.submission_id === 'sub_123');
  assert(completeEvents[0].msg.data.last_agent_message === 'Task completed successfully');

  // Verify active turn cleared
  assert(!session.isActiveTurn());
}
```

### Testing `interrupt_task()`

```typescript
async function testInterruptTask() {
  const session = new Session(config);
  await session.initialize();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  class LongRunningTask implements SessionTask {
    kind = TaskKind.Regular;

    async execute(
      session: Session,
      turnContext: TurnContext,
      signal: AbortSignal
    ): Promise<void> {
      for (let i = 0; i < 10; i++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  const task = new LongRunningTask();
  const turnContext = session.getTurnContext();

  // Spawn task
  await session.spawnTask(turnContext, 'sub_123', [], task);

  // Interrupt after 200ms
  setTimeout(async () => {
    await session.interruptTask();
  }, 200);

  // Wait for abort
  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify TurnAborted event
  const abortEvents = events.filter(e => e.msg.type === 'TurnAborted');
  assert(abortEvents.length > 0);
  assert(abortEvents[0].msg.data.reason === 'user_interrupt');
}
```

## Category 5: Rollout Recording

### Testing `persist_rollout_items()`

```typescript
async function testPersistRolloutItems() {
  const session = new Session(config);
  await session.initializeSession('create', 'conv_rollout_test', config);

  const items: RolloutItem[] = [
    {
      type: 'response_item',
      payload: {
        role: 'user',
        content: 'Test message'
      }
    },
    {
      type: 'event_msg',
      payload: {
        type: 'AgentMessage',
        data: { message: 'Response' }
      }
    }
  ];

  await session.persistRolloutItems(items);

  // Verify persisted
  const rollout = session.services?.rollout;
  if (rollout) {
    const history = await rollout.getRolloutHistory();
    assert(history.length >= 2);
  }
}
```

### Testing `reconstruct_history_from_rollout()`

```typescript
async function testReconstructHistory() {
  const session = new Session(config);
  const turnContext = session.getTurnContext();

  const rolloutItems: RolloutItem[] = [
    {
      type: 'response_item',
      payload: {
        role: 'user',
        content: 'Hello'
      }
    },
    {
      type: 'response_item',
      payload: {
        role: 'assistant',
        content: 'Hi there!'
      }
    },
    {
      type: 'compacted',
      payload: {
        message: '5 messages summarized',
        originalCount: 5,
        compactedAt: Date.now()
      }
    },
    {
      type: 'event_msg',
      payload: {
        type: 'AgentMessage',
        data: { message: 'Test' }
      }
    }
  ];

  const history = session.reconstructHistoryFromRollout(
    turnContext,
    rolloutItems
  );

  // Verify reconstruction
  assert(history.length === 3); // 2 messages + 1 compacted summary
  assert(history[0].content === 'Hello');
  assert(history[1].content === 'Hi there!');
  assert(history[2].content.includes('5 messages summarized'));
}
```

## Category 6: Token Tracking

### Testing `update_token_usage_info()`

```typescript
async function testUpdateTokenUsage() {
  const session = new Session(config);
  await session.initialize();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  const tokenUsage: TokenUsage = {
    input_tokens: 100,
    cached_input_tokens: 20,
    output_tokens: 50,
    reasoning_output_tokens: 10,
    total_tokens: 150
  };

  await session.updateTokenUsageInfo(
    'sub_123',
    session.getTurnContext(),
    tokenUsage
  );

  // Verify TokenCount event emitted
  const tokenEvents = events.filter(e => e.msg.type === 'TokenCount');
  assert(tokenEvents.length === 1);
  assert(tokenEvents[0].msg.data.info.total_token_usage.total_tokens === 150);
}
```

### Testing `update_rate_limits()`

```typescript
async function testUpdateRateLimits() {
  const session = new Session(config);
  await session.initialize();

  const events: Event[] = [];
  session.setEventEmitter(async (event) => {
    events.push(event);
  });

  const rateLimits: RateLimitSnapshot = {
    limit_requests: 1000,
    limit_tokens: 100000,
    remaining_requests: 950,
    remaining_tokens: 95000,
    reset_requests: new Date(Date.now() + 3600000).toISOString(),
    reset_tokens: new Date(Date.now() + 3600000).toISOString()
  };

  await session.updateRateLimits('sub_123', rateLimits);

  // Verify TokenCount event with rate limits
  const tokenEvents = events.filter(e => e.msg.type === 'TokenCount');
  assert(tokenEvents.length === 1);
  assert(tokenEvents[0].msg.data.rate_limits !== undefined);
  assert(tokenEvents[0].msg.data.rate_limits.primary_used_percent < 10);
}
```

## Integration Test Scenarios

### Scenario 1: Complete Session Lifecycle

```typescript
async function integrationTestCompleteLifecycle() {
  // 1. Create new session
  const { session, turnContext } = await Session.new(
    {
      conversationId: 'conv_integration',
      instructions: 'You are a helpful assistant',
      cwd: '/workspace',
      model: 'gpt-4'
    },
    config,
    { mode: 'new' }
  );

  // 2. Start turn and spawn task
  await session.startTurn();

  const task = new TestTask();
  await session.spawnTask(turnContext, 'sub_001', [], task);

  // 3. Wait for task completion
  await new Promise(resolve => setTimeout(resolve, 200));

  // 4. Record conversation items
  await session.recordConversationItems([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi!' }
  ]);

  // 5. Update token usage
  await session.updateTokenUsageInfo('sub_001', turnContext, {
    input_tokens: 50,
    cached_input_tokens: 0,
    output_tokens: 30,
    reasoning_output_tokens: 0,
    total_tokens: 80
  });

  // 6. End turn
  await session.endTurn();

  // 7. Verify state
  const history = session.getConversationHistory();
  assert(history.items.length >= 2);

  // 8. Shutdown
  await session.shutdown();
}
```

### Scenario 2: Approval Workflow

```typescript
async function integrationTestApprovalWorkflow() {
  const { session, turnContext } = await Session.new(
    {
      conversationId: 'conv_approval',
      cwd: '/workspace',
      approvalPolicy: 'on-request'
    },
    config,
    { mode: 'new' }
  );

  await session.startTurn();

  // Simulate agent requesting command execution
  const approvalPromise = session.requestCommandApproval(
    'sub_001',
    'call_001',
    ['npm', 'install', 'axios'],
    '/workspace',
    'Need to install axios dependency'
  );

  // Simulate UI showing approval request and user approving
  setTimeout(async () => {
    await session.notifyApproval('sub_001', 'approve');
  }, 100);

  const decision = await approvalPromise;

  if (decision === 'approve') {
    // Execute command with events
    const turnDiffTracker = new TurnDiffTracker();
    const output = await session.runExecWithEvents(
      turnDiffTracker,
      {
        subId: 'sub_001',
        callId: 'call_001',
        command: ['npm', 'install', 'axios'],
        cwd: '/workspace',
        isPatchApply: false
      },
      {
        command: ['npm', 'install', 'axios'],
        cwd: '/workspace',
        timeoutMs: 30000
      }
    );

    assert(output.exitCode === 0);
  }

  await session.endTurn();
  await session.shutdown();
}
```

### Scenario 3: Session Resume and Fork

```typescript
async function integrationTestResumeAndFork() {
  // 1. Create original session
  const { session: original } = await Session.new(
    {
      conversationId: 'conv_original',
      cwd: '/workspace'
    },
    config,
    { mode: 'new' }
  );

  // 2. Add conversation history
  await original.recordConversationItems([
    { role: 'user', content: 'What is TypeScript?' },
    { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript...' },
    { role: 'user', content: 'How do I install it?' },
    { role: 'assistant', content: 'You can install it with npm install -g typescript' }
  ]);

  await original.shutdown();

  // 3. Resume original session
  const originalRollout = await loadRolloutItems('conv_original');
  const { session: resumed } = await Session.new(
    {
      conversationId: 'conv_original',
      cwd: '/workspace'
    },
    config,
    { mode: 'resumed', rolloutItems: originalRollout }
  );

  const resumedHistory = resumed.getConversationHistory();
  assert(resumedHistory.items.length === 4);

  // 4. Fork to new conversation
  const { session: forked } = await Session.new(
    {
      conversationId: 'conv_forked',
      cwd: '/workspace'
    },
    config,
    {
      mode: 'forked',
      rolloutItems: originalRollout,
      sourceConversationId: 'conv_original'
    }
  );

  const forkedHistory = forked.getConversationHistory();
  assert(forkedHistory.items.length === 4);

  // 5. Continue forked conversation
  await forked.recordConversationItems([
    { role: 'user', content: 'Can you show me an example?' },
    { role: 'assistant', content: 'Sure! Here is a TypeScript example...' }
  ]);

  const updatedHistory = forked.getConversationHistory();
  assert(updatedHistory.items.length === 6);

  await resumed.shutdown();
  await forked.shutdown();
}
```

## Running Tests

### Unit Tests

```bash
# Run specific test file
npm test -- src/core/__tests__/Session.missing-methods.test.ts

# Run all Session tests
npm test -- src/core/__tests__/Session.*.test.ts

# Run with coverage
npm test -- --coverage src/core/__tests__/Session.missing-methods.test.ts
```

### Integration Tests

```bash
# Run integration tests
npm test -- src/core/__tests__/Session.integration.test.ts

# Run all integration tests
npm test -- **/*.integration.test.ts
```

### Manual Testing in Chrome Extension

1. Build the extension:
   ```bash
   npm run build
   ```

2. Load in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `codex-chrome/dist` folder

3. Test in browser console:
   ```javascript
   // Access Session in content script or sidepanel
   const session = window.__codexSession;

   // Test method
   const id = session.nextInternalSubId();
   console.log('Internal submission ID:', id);
   ```

## Verification Checklist

### Session Lifecycle
- [ ] `Session.new()` creates session with correct initialization mode
- [ ] `initialize()` sets up services properly
- [ ] `record_initial_history()` handles new/resumed/forked modes
- [ ] `next_internal_sub_id()` generates unique IDs

### Approval Handling
- [ ] `request_command_approval()` returns Promise
- [ ] `request_patch_approval()` validates patch syntax
- [ ] `notify_approval()` resolves pending approvals
- [ ] Multiple approvals can be pending simultaneously

### Event Management
- [ ] `send_event()` persists to rollout and emits
- [ ] `on_exec_command_begin()` emits correct event type
- [ ] `on_exec_command_end()` includes output details
- [ ] `run_exec_with_events()` wraps execution with events

### Task Lifecycle
- [ ] `spawn_task()` aborts previous tasks
- [ ] `abort_all_tasks()` handles multiple tasks
- [ ] `on_task_finished()` emits TaskComplete event
- [ ] `interrupt_task()` is idempotent

### Rollout Recording
- [ ] `persist_rollout_items()` handles persistence failures gracefully
- [ ] `reconstruct_history_from_rollout()` processes all item types
- [ ] Compacted items are reconstructed as summaries
- [ ] Event messages are skipped during reconstruction

### Token Tracking
- [ ] `update_token_usage_info()` accumulates totals
- [ ] `update_rate_limits()` stores latest snapshot
- [ ] TokenCount events include both usage and limits
- [ ] Rate limit percentages are calculated correctly

## Troubleshooting

### Common Issues

1. **Rollout persistence fails**: Check that RolloutRecorder is initialized
2. **Approval timeout**: Ensure `notify_approval()` is called with correct subId
3. **Task not aborting**: Verify task checks `signal.aborted` in execute loop
4. **Events not emitting**: Check that `setEventEmitter()` was called
5. **History not reconstructed**: Verify rollout items are in correct format

### Debug Commands

```typescript
// Enable debug logging
localStorage.setItem('debug', 'codex:*');

// Check SessionState
console.log(session.sessionState.export());

// Check ActiveTurn
console.log(session.isActiveTurn());

// Check rollout items
const rollout = session.services?.rollout;
if (rollout) {
  const items = await rollout.getRolloutHistory();
  console.log('Rollout items:', items);
}
```

## Next Steps

After verifying all methods work correctly:

1. Review performance metrics
2. Add error handling improvements
3. Write comprehensive documentation
4. Update API reference
5. Create migration guide for existing code
6. Add telemetry for monitoring
