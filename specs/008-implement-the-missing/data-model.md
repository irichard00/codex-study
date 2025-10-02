# Data Model: Missing Session Methods

## Overview

This document defines all data structures needed to implement the missing Session methods from codex-rs. It maps Rust types to TypeScript equivalents while preserving the SQ/EQ architecture and SessionState integration patterns.

## Core Configuration Types

### ConfigureSession

Configuration structure for initializing a new Session.

```typescript
/**
 * Session initialization configuration
 * Maps to Rust ConfigureSession struct
 */
export interface ConfigureSession {
  /** Conversation ID for this session */
  conversationId: string;

  /** Initial instructions for the agent */
  instructions?: string;

  /** Working directory for command execution */
  cwd?: string;

  /** Default model to use */
  model?: string;

  /** Approval policy for commands */
  approvalPolicy?: AskForApproval;

  /** Sandbox policy for tool execution */
  sandboxPolicy?: SandboxPolicy;

  /** Optional reasoning configuration */
  reasoningEffort?: ReasoningEffortConfig;
  reasoningSummary?: ReasoningSummaryConfig;
}
```

### InitialHistory

Enum-like union type for session initialization modes.

```typescript
/**
 * Initial history mode for session creation
 * Maps to Rust InitialHistory enum
 */
export type InitialHistory =
  | { mode: 'new' }
  | { mode: 'resumed'; rolloutItems: RolloutItem[] }
  | { mode: 'forked'; rolloutItems: RolloutItem[]; sourceConversationId: string };

/**
 * Type guard for InitialHistory modes
 */
export function isNewHistory(history: InitialHistory): history is { mode: 'new' } {
  return history.mode === 'new';
}

export function isResumedHistory(history: InitialHistory): history is { mode: 'resumed'; rolloutItems: RolloutItem[] } {
  return history.mode === 'resumed';
}

export function isForkedHistory(history: InitialHistory): history is { mode: 'forked'; rolloutItems: RolloutItem[]; sourceConversationId: string } {
  return history.mode === 'forked';
}
```

## Approval & Review Types

### ReviewDecision

Already exists in protocol/types.ts but extended here for clarity:

```typescript
/**
 * User decision in response to approval request
 * Maps to Rust ReviewDecision enum
 */
export type ReviewDecision =
  | 'approve'         // User approves the action
  | 'reject'          // User rejects the action
  | 'request_change'; // User requests modification (Rust: RequestChange)
```

### ApprovalCallback

Promise-based approval callback mechanism.

```typescript
/**
 * Approval callback for async approval resolution
 * Replaces Rust oneshot::channel pattern
 */
export interface ApprovalCallback {
  /** Unique execution ID for this approval request */
  executionId: string;

  /** Promise resolver for the approval decision */
  resolve: (decision: ReviewDecision) => void;

  /** Promise rejector for errors */
  reject: (error: Error) => void;

  /** Timestamp when approval was requested */
  requestedAt: number;

  /** Context about what is being approved */
  context: ApprovalContext;
}

/**
 * Context for approval requests
 */
export type ApprovalContext =
  | { type: 'exec_command'; command: string[]; cwd: string; reason?: string }
  | { type: 'apply_patch'; action: ApplyPatchAction; reason?: string; grantRoot?: string };
```

## Command Execution Types

### ExecCommandContext

Context for command execution lifecycle.

```typescript
/**
 * Context for command execution events
 * Maps to Rust ExecCommandContext struct
 */
export interface ExecCommandContext {
  /** Submission ID this execution belongs to */
  subId: string;

  /** Unique call ID for this execution */
  callId: string;

  /** Command to execute */
  command: string[];

  /** Working directory */
  cwd: string;

  /** Optional reason/explanation for the command */
  reason?: string;

  /** Whether this is a patch application */
  isPatchApply?: boolean;

  /** For patch apply: the patch action details */
  patchAction?: ApplyPatchAction;
}
```

### ApplyPatchAction

Patch operation descriptor.

```typescript
/**
 * Patch application action
 * Maps to Rust ApplyPatchAction
 */
export interface ApplyPatchAction {
  /** File path to apply patch to */
  path: string;

  /** Patch content (unified diff format) */
  patch: string;

  /** Optional description of the change */
  description?: string;

  /** Whether to create file if it doesn't exist */
  createIfMissing?: boolean;
}
```

### ExecToolCallOutput

Result of command/tool execution.

```typescript
/**
 * Output from tool call execution
 * Maps to Rust ExecToolCallOutput struct
 */
export interface ExecToolCallOutput {
  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Exit code (0 = success) */
  exitCode: number;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Timestamp when execution started */
  startTime: number;

  /** Timestamp when execution completed */
  endTime: number;

  /** Whether execution was successful */
  success: boolean;
}
```

### ExecInvokeArgs

Arguments for executing a command with events.

```typescript
/**
 * Arguments for command execution
 * Maps to Rust ExecInvokeArgs struct
 */
export interface ExecInvokeArgs {
  /** Command to execute */
  command: string[];

  /** Working directory */
  cwd: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Timeout in milliseconds */
  timeoutMs?: number;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
```

## Token & Rate Limit Types

### TokenUsage

Already defined in events.ts, included here for completeness:

```typescript
/**
 * Token usage from model response
 * Maps to Rust TokenUsage struct
 */
export interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}
```

### RateLimitSnapshot

Rate limit state from API response.

```typescript
/**
 * Rate limit snapshot from API headers
 * Maps to Rust RateLimitSnapshot struct
 */
export interface RateLimitSnapshot {
  /** Maximum requests allowed per window */
  limit_requests?: number;

  /** Maximum tokens allowed per window */
  limit_tokens?: number;

  /** Remaining requests in current window */
  remaining_requests?: number;

  /** Remaining tokens in current window */
  remaining_tokens?: number;

  /** Timestamp when request limit resets (ISO 8601) */
  reset_requests?: string;

  /** Timestamp when token limit resets (ISO 8601) */
  reset_tokens?: string;

  /** Calculated percentage used (0-100) */
  usedPercent?: number;
}
```

## Task Lifecycle Types

### TurnAbortReason

Reason for aborting a turn.

```typescript
/**
 * Reason for turn abortion
 * Maps to Rust TurnAbortReason enum
 */
export type TurnAbortReason =
  | { type: 'interrupted' }        // User interrupted
  | { type: 'replaced' }           // Replaced by new task
  | { type: 'error'; error: string }; // Error occurred

/**
 * Type guards for TurnAbortReason
 */
export function isInterruptedAbort(reason: TurnAbortReason): reason is { type: 'interrupted' } {
  return reason.type === 'interrupted';
}

export function isReplacedAbort(reason: TurnAbortReason): reason is { type: 'replaced' } {
  return reason.type === 'replaced';
}

export function isErrorAbort(reason: TurnAbortReason): reason is { type: 'error'; error: string } {
  return reason.type === 'error';
}
```

### RunningTask

Already exists in session/state/types.ts, extended here:

```typescript
/**
 * A running task in an active turn
 * Maps to Rust RunningTask struct
 */
export interface RunningTask {
  /** Abort controller to cancel the task */
  handle: AbortController;

  /** Kind of task */
  kind: TaskKind;

  /** When the task started (milliseconds since epoch) */
  startTime: number;

  /** Subscription ID for tracking */
  subId: string;

  /** Task-specific abort handler (optional) */
  abortHandler?: (reason: TurnAbortReason) => Promise<void>;
}
```

### SessionTask

Interface for executable session tasks.

```typescript
/**
 * Session task interface
 * Maps to Rust SessionTask trait
 */
export interface SessionTask {
  /** Execute the task */
  execute(session: Session, turnContext: TurnContext, signal: AbortSignal): Promise<void>;

  /** Optional abort handler for task-specific cleanup */
  abort?(reason: TurnAbortReason): Promise<void>;

  /** Task kind identifier */
  kind: TaskKind;
}
```

## Rollout & History Types

### RolloutItem

Already exists in storage/rollout.ts, documented here:

```typescript
/**
 * Rollout item for persistence
 * Maps to Rust RolloutItem enum
 */
export type RolloutItem =
  | { type: 'response_item'; payload: ResponseItem }
  | { type: 'event_msg'; payload: EventMsg }
  | { type: 'compacted'; payload: CompactedHistory }
  | { type: 'session_meta'; payload: SessionMetadata }
  | { type: 'turn_context'; payload: TurnContextRecord };

/**
 * Compacted history summary
 */
export interface CompactedHistory {
  /** Summary message */
  message: string;

  /** Number of items that were compacted */
  originalCount: number;

  /** Timestamp when compaction occurred */
  compactedAt: number;
}

/**
 * Session metadata for rollout
 */
export interface SessionMetadata {
  conversationId: string;
  createdAt: number;
  model?: string;
  instructions?: string;
}

/**
 * Turn context record for rollout
 */
export interface TurnContextRecord {
  turnNumber: number;
  timestamp: number;
  model: string;
  cwd: string;
  approvalPolicy: AskForApproval;
  sandboxPolicy: SandboxPolicy;
}
```

## State Transition Diagrams

### Session Lifecycle

```
┌─────────┐
│  new()  │
└────┬────┘
     │
     ▼
┌──────────────────────┐
│ initialize()         │
│ - Setup services     │
│ - Load rollout       │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ record_initial_history()         │
│ - New: build_initial_context()   │
│ - Resumed: reconstruct_history() │
│ - Forked: persist + reconstruct  │
└────┬─────────────────────────────┘
     │
     ▼
┌─────────────┐
│   Active    │ ◄──┐
│   Session   │    │
└─────┬───────┘    │
      │            │
      │  spawn_task()
      │            │
      └────────────┘
           │
           │ abort_all_tasks()
           │ on_task_finished()
           ▼
      ┌─────────┐
      │ Cleanup │
      └─────────┘
```

### Approval Flow

```
┌─────────────────────────┐
│ request_*_approval()    │
│ - Create callback       │
│ - Store in activeTurn   │
│ - Emit approval event   │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Wait for decision   │ ◄─────┐
│ (Promise pending)   │       │
└────┬────────────────┘       │
     │                        │
     │ notify_approval()      │
     │                        │
     ▼                        │
┌──────────────────────┐      │
│ Resolve callback     │      │
│ - Find by executionId│      │
│ - Call resolver      │      │
│ - Remove from map    │      │
└────┬─────────────────┘      │
     │                        │
     ▼                        │
┌──────────────────┐          │
│ Resume execution │ ─────────┘
└──────────────────┘
```

### Turn Execution with Events

```
┌──────────────────────┐
│ run_exec_with_events │
└────┬─────────────────┘
     │
     ▼
┌───────────────────────┐
│ on_exec_command_begin │
│ - Emit begin event    │
│ - Track diff          │
└────┬──────────────────┘
     │
     ▼
┌──────────────────────┐
│ process_exec_tool_   │
│   call()             │
│ - Execute command    │
│ - Capture output     │
└────┬─────────────────┘
     │
     ▼
┌─────────────────────┐
│ on_exec_command_end │
│ - Emit end event    │
│ - Emit diff event   │
└─────────────────────┘
```

## Type Mapping: Rust → TypeScript

| Rust Type | TypeScript Equivalent | Notes |
|-----------|----------------------|-------|
| `Arc<T>` | `T` or `WeakRef<T>` | No shared ownership needed in single-threaded JS |
| `Mutex<T>` | `T` | No mutex needed (single-threaded) |
| `Result<T, E>` | `T \| Error` or custom `Result<T, E>` | Use try/catch or custom Result type |
| `Option<T>` | `T \| undefined` | TypeScript optional types |
| `Vec<T>` | `T[]` | Arrays |
| `HashMap<K, V>` | `Map<K, V>` | ES6 Map |
| `oneshot::channel()` | `Promise<T>` with external resolver | Promise + resolver pattern |
| `tokio::spawn` | `async` function | No separate spawn needed |
| `AbortHandle` | `AbortController` | Web API standard |
| `async fn` | `async function` | Direct mapping |
| `impl Trait` | Interface or type | TypeScript interfaces |
| Enum with data | Discriminated union | `type T = { type: 'A', data: X } \| { type: 'B', data: Y }` |

## Integration with Existing Types

### SessionState Integration

The missing methods integrate with existing SessionState:

```typescript
// Existing in SessionState:
- historySnapshot(): ResponseItem[]
- recordItems(items: ResponseItem[]): void
- getConversationHistory(): ConversationHistory
- addTokenUsage(tokens: number): void
- addApprovedCommand(command: string): void
- isCommandApproved(command: string): boolean

// New methods needed in SessionState:
- replaceHistory(items: ResponseItem[]): void
- updateTokenInfoFromUsage(usage: TokenUsage): void
- setRateLimits(limits: RateLimitSnapshot): void
- tokenInfoAndRateLimits(): { tokenInfo: TokenUsageInfo; rateLimits?: RateLimitSnapshot }
```

### ActiveTurn Integration

The missing methods integrate with existing ActiveTurn:

```typescript
// Existing in ActiveTurn:
- pushPendingInput(item: InputItem): void
- takePendingInput(): InputItem[]
- addTask(subId: string, task: RunningTask): void
- removeTask(subId: string): RunningTask | undefined
- drain(): Map<string, RunningTask>

// New methods needed in ActiveTurn:
- registerApproval(executionId: string, callback: ApprovalCallback): void
- resolveApproval(executionId: string, decision: ReviewDecision): boolean
- clearApprovals(): void
- drainApprovals(): Map<string, ApprovalCallback>
```

### SessionServices Integration

```typescript
// Existing in SessionServices:
- rollout: RolloutRecorder | null

// New services needed:
- mcpManager: McpConnectionManager | null
- notifier: UserNotifier | null
- userShell: Shell | null
- showRawAgentReasoning: boolean
```

## Error Handling

### Custom Result Type (Optional)

```typescript
/**
 * Result type for methods that can fail
 * Matches Rust Result<T, E> pattern
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create success result
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create error result
 */
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard for success
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard for error
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
```

### Error Classes

```typescript
/**
 * Session-specific errors
 */
export class SessionError extends Error {
  constructor(message: string, public code: string, public context?: any) {
    super(message);
    this.name = 'SessionError';
  }
}

export class ApprovalTimeoutError extends SessionError {
  constructor(executionId: string) {
    super(`Approval request timed out: ${executionId}`, 'APPROVAL_TIMEOUT', { executionId });
  }
}

export class TaskAbortedError extends SessionError {
  constructor(reason: TurnAbortReason) {
    super(`Task aborted: ${JSON.stringify(reason)}`, 'TASK_ABORTED', { reason });
  }
}

export class RolloutPersistenceError extends SessionError {
  constructor(message: string, cause?: Error) {
    super(message, 'ROLLOUT_PERSISTENCE', { cause });
  }
}
```

## Summary

This data model provides:

1. **Type-safe protocol types** - All Rust types mapped to TypeScript equivalents
2. **State management structures** - Integration with SessionState, ActiveTurn, SessionServices
3. **Approval system types** - Promise-based approval callbacks replacing Rust channels
4. **Command execution types** - Full lifecycle context and output structures
5. **Task lifecycle types** - Running tasks, abort reasons, task interfaces
6. **Rollout types** - History reconstruction and persistence structures
7. **Error handling** - Custom error types and optional Result pattern

All types follow the existing codex-chrome patterns while preserving compatibility with the Rust implementation's protocol.
