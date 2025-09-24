# AgentTask API Contract

## Overview
The AgentTask class coordinates multiple turns in response to user input, managing the entire task execution lifecycle. This is the critical missing component from codex-rs that orchestrates agent behavior.

## Interface

```typescript
class AgentTask {
  constructor(
    session: Session,
    submissionId: string,
    input: ResponseItem[],
    eventEmitter: EventEmitter,
    isReviewMode: boolean = false
  );

  // Core execution methods
  async run(): Promise<void>;
  async cancel(): Promise<void>;

  // State management
  getStatus(): TaskStatus;
  getCurrentTurnIndex(): number;
  getTokenUsage(): TokenUsage;

  // Events
  on(event: 'turn-start', listener: (turn: Turn) => void): void;
  on(event: 'turn-complete', listener: (turn: Turn) => void): void;
  on(event: 'task-complete', listener: (result: TaskResult) => void): void;
  on(event: 'error', listener: (error: TaskError) => void): void;
  on(event: 'compaction', listener: (event: CompactionEvent) => void): void;
}
```

## Core Methods

### `run(): Promise<void>`
Main execution loop that coordinates the task lifecycle.

**Responsibilities:**
1. Initialize task context
2. Run turn loop
3. Manage token budget
4. Handle review mode
5. Emit lifecycle events
6. Clean up resources

**Flow:**
```typescript
async run() {
  try {
    this.emitEvent('TaskStarted');
    await this.initializeContext();

    while (!this.isComplete() && this.currentTurnIndex < this.maxTurns) {
      if (this.shouldAutoCompact()) {
        await this.compactContext();
      }

      const turn = await this.createTurn();
      this.emitEvent('TurnStart', turn);

      await this.executeTurn(turn);

      this.emitEvent('TurnComplete', turn);
      this.currentTurnIndex++;
    }

    this.emitEvent('TaskComplete');
  } catch (error) {
    this.handleError(error);
  } finally {
    await this.cleanup();
  }
}
```

### `cancel(): Promise<void>`
Cancels the running task gracefully.

**Behavior:**
- Sets status to 'cancelled'
- Aborts current turn if running
- Cleans up active tool calls
- Emits cancellation event

### Private Methods

#### `runTurnLoop(): Promise<void>`
Manages the turn execution sequence.

**Responsibilities:**
- Create turns from input
- Execute turns sequentially
- Handle turn failures
- Manage turn context

#### `shouldAutoCompact(): boolean`
Determines if context compaction is needed.

**Logic:**
```typescript
shouldAutoCompact() {
  const usageRatio = this.tokenBudget.usedTokens / this.tokenBudget.maxTokens;
  return usageRatio > this.tokenBudget.compactionThreshold;
}
```

#### `compactContext(): Promise<void>`
Reduces context size while preserving essential information.

**Strategy:**
1. Remove redundant messages
2. Summarize old turns
3. Preserve recent context
4. Update token count

#### `handleReviewMode(): Promise<void>`
Special execution mode for review tasks.

**Behavior:**
- Limits tool usage
- Requires explicit approvals
- Provides detailed explanations

## Event Emissions

### TaskStarted
```typescript
{
  submission_id: string;
  turn_type: 'user' | 'review';
  timestamp: number;
}
```

### TurnStart
```typescript
{
  turn_index: number;
  turn_id: string;
  input_tokens: number;
}
```

### TurnComplete
```typescript
{
  turn_index: number;
  turn_id: string;
  output_tokens: number;
  tool_calls: number;
  duration_ms: number;
}
```

### TaskComplete
```typescript
{
  submission_id: string;
  total_turns: number;
  total_tokens: number;
  duration_ms: number;
  status: 'completed' | 'failed' | 'cancelled';
}
```

### CompactionEvent
```typescript
{
  timestamp: number;
  turn_index: number;
  tokens_before: number;
  tokens_after: number;
  items_removed: number;
}
```

## Integration Points

### With TaskRunner
```typescript
class TaskRunner {
  async runTask(submission: Submission): Promise<void> {
    const agentTask = new AgentTask(
      this.session,
      submission.id,
      this.parseInput(submission),
      this.eventEmitter,
      this.isReviewMode(submission)
    );

    await agentTask.run();
  }
}
```

### With TurnManager
```typescript
class AgentTask {
  private async executeTurn(turn: Turn): Promise<void> {
    const result = await this.turnManager.executeTurn(turn);
    this.updateContext(result);
  }
}
```

### With Session
```typescript
class AgentTask {
  private async initializeContext(): Promise<void> {
    this.turnContext = await this.session.getTurnContext();
    this.tabContext = await this.session.getTabContext();
  }
}
```

## Error Handling

### Error Types
```typescript
enum TaskErrorCode {
  INITIALIZATION_FAILED = 'INIT_FAILED',
  TURN_EXECUTION_FAILED = 'TURN_FAILED',
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT',
  MAX_TURNS_EXCEEDED = 'MAX_TURNS',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT'
}
```

### Recovery Strategy
1. **Retriable errors**: Retry with exponential backoff
2. **Token limit**: Auto-compact and retry
3. **Fatal errors**: Fail task and emit error
4. **User cancellation**: Clean shutdown

## Configuration

```typescript
interface AgentTaskConfig {
  maxTurns: number;           // Default: 50
  maxTokens: number;          // Default: 100000
  compactionThreshold: number; // Default: 0.75
  reviewModeRestrictions: {
    allowedTools: string[];
    requireApproval: boolean;
    maxToolCalls: number;
  };
  timeout: number;            // Default: 300000 (5 minutes)
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}
```

## Testing Requirements

### Unit Tests
- Task lifecycle management
- Turn coordination
- Token budget tracking
- Compaction logic
- Review mode handling
- Error recovery

### Integration Tests
- With TaskRunner
- With TurnManager
- With Session
- Event emission flow

### Contract Tests
```typescript
describe('AgentTask Contract', () => {
  it('should coordinate multiple turns', async () => {
    const task = new AgentTask(...);
    const events = [];

    task.on('turn-complete', (turn) => events.push(turn));
    await task.run();

    expect(events.length).toBeGreaterThan(0);
    expect(task.getStatus()).toBe('completed');
  });

  it('should auto-compact when threshold reached', async () => {
    const task = new AgentTask(...);
    let compacted = false;

    task.on('compaction', () => { compacted = true; });
    // Simulate high token usage
    await task.run();

    expect(compacted).toBe(true);
  });
});
```

## Performance Requirements

- Turn initialization: < 50ms
- Context compaction: < 200ms
- Event emission: < 5ms
- Memory usage: < 50MB per task
- Concurrent tasks: Support up to 5

## Migration Notes

### From codex-rs
The Rust implementation uses:
- `Arc<Session>` → JavaScript `Session` reference
- `mpsc::Receiver` → `AbortController` for cancellation
- `broadcast::Sender<Event>` → `EventEmitter` for events

### Key Differences
1. No thread safety concerns (single-threaded JS)
2. Use Promises instead of async Rust
3. AbortController for cancellation
4. EventEmitter for pub/sub