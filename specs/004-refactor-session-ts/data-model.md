# Data Model: Session Refactoring

**Feature**: Refactor Session.ts to Match Rust Implementation Updates
**Date**: 2025-10-01
**Reference**: Rust state refactoring (commit 250b244ab)

## Overview

This document defines the TypeScript data models that will be created to match the Rust state refactoring. The goal is to separate concerns into three distinct layers while maintaining type safety and protocol compatibility.

---

## Core Entities

### 1. SessionState

**Purpose**: Immutable container for session-wide persistent state

**TypeScript Definition**:
```typescript
/**
 * Session-wide persistent state (port of Rust SessionState)
 * Located at: codex-chrome/src/core/state/SessionState.ts
 */
export class SessionState {
  private approvedCommands: Set<string>;
  private history: ConversationHistory;
  private tokenInfo?: TokenUsageInfo;
  private latestRateLimits?: RateLimitSnapshot;

  constructor() {
    this.approvedCommands = new Set<string>();
    this.history = {
      items: [],
      metadata: {
        sessionId: '',
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        totalTokens: 0
      }
    };
  }

  // History operations
  recordItems(items: ResponseItem[]): void;
  historySnapshot(): ResponseItem[];
  replaceHistory(items: ResponseItem[]): void;

  // Approved commands
  addApprovedCommand(cmd: string): void;
  hasApprovedCommand(cmd: string): boolean;
  approvedCommandsSnapshot(): Set<string>;

  // Token tracking
  updateTokenInfoFromUsage(
    usage: TokenUsage,
    modelContextWindow?: number
  ): void;
  getTokenInfo(): TokenUsageInfo | undefined;

  // Rate limits
  setRateLimits(snapshot: RateLimitSnapshot): void;
  getRateLimits(): RateLimitSnapshot | undefined;
  tokenInfoAndRateLimits(): [TokenUsageInfo | undefined, RateLimitSnapshot | undefined];

  // Serialization
  export(): SessionStateExport;
  static import(data: SessionStateExport): SessionState;
}

/**
 * Serialization format for SessionState
 */
export interface SessionStateExport {
  approvedCommands: string[];
  history: ConversationHistory;
  tokenInfo?: TokenUsageInfo;
  latestRateLimits?: RateLimitSnapshot;
}
```

**Relationships**:
- **Contains**: `ConversationHistory` (1:1)
- **Contains**: `TokenUsageInfo` (0:1)
- **Contains**: `RateLimitSnapshot` (0:1)
- **Owned by**: `Session` (1:1)

**Validation Rules**:
- `approvedCommands`: Must be valid command strings
- `history.items`: Must contain valid ResponseItem objects
- `tokenInfo.total_tokens`: Must be >= 0
- `latestRateLimits`: All numeric fields must be >= 0

**State Transitions**:
- History grows monotonically (append-only within turn)
- Token usage increases monotonically
- Rate limits updated atomically on API response

---

### 2. SessionServices

**Purpose**: Container for external service dependencies

**TypeScript Definition**:
```typescript
/**
 * Collection of external services used by Session (port of Rust SessionServices)
 * Located at: codex-chrome/src/core/state/SessionServices.ts
 *
 * Note: MCP (Model Context Protocol) is not supported in the browser environment
 */
export interface SessionServices {
  // Storage service (Chrome-specific)
  conversationStore?: ConversationStore;

  // User notifications
  notifier: UserNotifier;

  // Rollout recording (session persistence)
  rolloutRecorder?: RolloutRecorder;

  // Browser-specific services
  domService?: DOMService;
  tabManager?: TabManager;

  // Configuration
  showRawAgentReasoning: boolean;
}

/**
 * Factory function to create SessionServices
 */
export async function createSessionServices(
  config: AgentConfig,
  isPersistent: boolean
): Promise<SessionServices> {
  const services: SessionServices = {
    notifier: new UserNotifier(config.notifications),
    showRawAgentReasoning: config.showRawReasoning ?? false,
  };

  if (isPersistent) {
    services.conversationStore = new ConversationStore();
    await services.conversationStore.initialize();
  }

  // Note: MCP is not supported in browser environment
  // Browser-specific services can be added here if needed

  return services;
}
```

**Relationships**:
- **Owned by**: `Session` (1:1)
- **Uses**: `ConversationStore` (0:1)
- **Uses**: `UserNotifier` (1:1)
- **Uses**: `RolloutRecorder` (0:1)
- **Uses**: `DOMService` (0:1, browser-specific)
- **Uses**: `TabManager` (0:1, browser-specific)

**Lifecycle**:
1. Created during Session initialization
2. Initialized asynchronously (parallel where possible)
3. Shared across all turns
4. Cleaned up on Session close

---

### 3. ActiveTurn

**Purpose**: Manage currently executing turn lifecycle

**TypeScript Definition**:
```typescript
/**
 * Metadata about currently running turn (port of Rust ActiveTurn)
 * Located at: codex-chrome/src/core/state/ActiveTurn.ts
 */
export class ActiveTurn {
  private tasks: Map<string, RunningTask>;
  private turnState: TurnState;

  constructor() {
    this.tasks = new Map<string, RunningTask>();
    this.turnState = new TurnState();
  }

  // Task management
  addTask(subId: string, task: RunningTask): void;
  removeTask(subId: string): boolean;
  drainTasks(): Map<string, RunningTask>;
  hasTask(subId: string): boolean;
  getTask(subId: string): RunningTask | undefined;

  // Turn state access
  clearPending(): void;
  pushPendingInput(input: ResponseInputItem): void;
  takePendingInput(): ResponseInputItem[];
  insertPendingApproval(key: string, resolver: ApprovalResolver): void;
  removePendingApproval(key: string): ApprovalResolver | undefined;

  // Cleanup
  async abort(): Promise<void>;
}

/**
 * Running task metadata
 */
export interface RunningTask {
  handle: AbortController;
  kind: TaskKind;
  startTime: number;
  subId: string;
}

/**
 * Task type discriminator
 */
export enum TaskKind {
  Regular = 'regular',
  Review = 'review',
  Compact = 'compact',
}

/**
 * Approval resolver callback
 */
export type ApprovalResolver = (decision: ReviewDecision) => void;
```

**Relationships**:
- **Contains**: `TurnState` (1:1)
- **Contains**: Multiple `RunningTask` (1:N)
- **Owned by**: `Session` (0:1) - optional, only during turn execution

**Validation Rules**:
- At most one ActiveTurn per Session
- Each RunningTask must have unique subId
- AbortController must be valid and not already aborted
- TaskKind must be one of the enum values

**State Transitions**:
```
NULL → ActiveTurn (on startTurn)
ActiveTurn → NULL (on endTurn or abort)
```

**Concurrency Notes**:
- TypeScript is single-threaded, but async operations need coordination
- Use explicit async locks if needed
- AbortController provides cancellation signal

---

### 4. TurnState

**Purpose**: Mutable state scoped to a single turn

**TypeScript Definition**:
```typescript
/**
 * Mutable state for a single turn (port of Rust TurnState)
 * Located at: codex-chrome/src/core/state/TurnState.ts
 */
export class TurnState {
  private pendingApprovals: Map<string, ApprovalResolver>;
  private pendingInput: ResponseInputItem[];

  constructor() {
    this.pendingApprovals = new Map<string, ApprovalResolver>();
    this.pendingInput = [];
  }

  // Approval management
  insertPendingApproval(
    key: string,
    resolver: ApprovalResolver
  ): ApprovalResolver | undefined {
    const existing = this.pendingApprovals.get(key);
    this.pendingApprovals.set(key, resolver);
    return existing;
  }

  removePendingApproval(key: string): ApprovalResolver | undefined {
    const resolver = this.pendingApprovals.get(key);
    this.pendingApprovals.delete(key);
    return resolver;
  }

  // Input queueing
  pushPendingInput(input: ResponseInputItem): void {
    this.pendingInput.push(input);
  }

  takePendingInput(): ResponseInputItem[] {
    const input = [...this.pendingInput];
    this.pendingInput = [];
    return input;
  }

  // Cleanup
  clearPending(): void {
    this.pendingApprovals.clear();
    this.pendingInput = [];
  }
}
```

**Relationships**:
- **Owned by**: `ActiveTurn` (1:1)
- **Contains**: Pending input items (0:N)
- **Contains**: Pending approval resolvers (0:N)

**Validation Rules**:
- Approval keys must be unique
- Pending input must be valid ResponseInputItem objects
- After clear, all collections empty

**Lifecycle**:
1. Created when ActiveTurn is created
2. Accumulates pending approvals and input during turn
3. Cleared on turn completion or abort
4. Destroyed with ActiveTurn

---

### 5. Refactored Session

**Purpose**: Orchestrate session lifecycle using separated state/services/turn

**TypeScript Definition**:
```typescript
/**
 * Refactored Session class with separated concerns
 * Located at: codex-chrome/src/core/Session.ts
 */
export class Session {
  private readonly conversationId: string;
  private readonly state: SessionState;
  private readonly services: SessionServices;
  private activeTurn: ActiveTurn | null;
  private readonly eventEmitter: (event: Event) => Promise<void>;
  private readonly config?: AgentConfig;

  constructor(
    config?: AgentConfig,
    services?: SessionServices
  ) {
    this.conversationId = `conv_${uuidv4()}`;
    this.config = config;
    this.state = new SessionState();
    this.services = services ?? createDefaultServices(config);
    this.activeTurn = null;
    this.eventEmitter = defaultEventEmitter;
  }

  // Initialization
  async initialize(): Promise<void>;

  // State operations (delegate to this.state)
  getConversationHistory(): ConversationHistory;
  async recordInput(items: InputItem[]): Promise<void>;
  addTokenUsage(tokens: number): void;
  addApprovedCommand(cmd: string): void;

  // Turn operations (delegate to this.activeTurn)
  async startTurn(): Promise<void>;
  async endTurn(): Promise<void>;
  async abortTurn(): Promise<void>;
  isActiveTurn(): boolean;
  getPendingInput(): ResponseInputItem[];

  // Service operations (use this.services)
  async emitEvent(event: Event): Promise<void>;
  async saveState(): Promise<void>;

  // Serialization
  export(): SessionExport;
  static import(data: SessionExport, services: SessionServices): Session;

  // Cleanup
  async close(): Promise<void>;
}

/**
 * Serialization format for Session
 */
export interface SessionExport {
  conversationId: string;
  state: SessionStateExport;
  messageCount: number;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  startTime: number;
  currentModel: string;
}
```

**Relationships**:
- **Contains**: `SessionState` (1:1, owned)
- **Contains**: `SessionServices` (1:1, owned)
- **Contains**: `ActiveTurn` (0:1, owned)
- **Uses**: `TurnContext` (passed to operations)
- **Emits**: `Event` objects via event queue

**Validation Rules**:
- `conversationId` must be unique and non-empty
- Cannot start a turn if `activeTurn` is not null
- Cannot end turn if `activeTurn` is null
- Event emitter must be set before emitting events

**State Transitions**:
```
IDLE (activeTurn = null) → ACTIVE (activeTurn = ActiveTurn)
  ↓
ACTIVE → IDLE (on turn completion)
  ↓
ACTIVE → IDLE (on turn abort)
```

---

## Supporting Types

### TokenUsageInfo

```typescript
/**
 * Token usage information
 */
export interface TokenUsageInfo {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  context_window?: number;
}
```

### RateLimitSnapshot

```typescript
/**
 * Rate limit information from API
 */
export interface RateLimitSnapshot {
  requests_limit?: number;
  requests_remaining?: number;
  requests_reset_seconds?: number;
  tokens_limit?: number;
  tokens_remaining?: number;
  tokens_reset_seconds?: number;
  timestamp: number;
}
```

### ConversationHistory

```typescript
/**
 * Conversation history structure
 */
export interface ConversationHistory {
  items: ResponseItem[];
  metadata?: {
    sessionId: string;
    startTime: number;
    lastUpdateTime: number;
    totalTokens: number;
  };
}
```

### ResponseInputItem

```typescript
/**
 * User input during turn execution
 */
export type ResponseInputItem = {
  role: 'user';
  content: ContentItem[];
};
```

### ReviewDecision

```typescript
/**
 * Approval decision
 */
export enum ReviewDecision {
  Approve = 'approve',
  Reject = 'reject',
  Skip = 'skip',
}
```

---

## Data Flow

### Turn Execution Flow

```
1. User submits input
   ↓
2. Session.startTurn()
   - Create ActiveTurn
   - Initialize TurnState
   ↓
3. Session.recordInput(items)
   - state.recordItems(items)
   ↓
4. Turn execution (TurnManager)
   - Uses activeTurn to track tasks
   - Uses services for MCP, storage, etc.
   ↓
5. Tool execution requires approval
   - activeTurn.insertPendingApproval(key, resolver)
   ↓
6. User provides approval
   - Resolver called with decision
   - activeTurn.removePendingApproval(key)
   ↓
7. Turn completes
   - Session.endTurn()
   - Destroy activeTurn
   - state.updateTokenInfoFromUsage()
```

### State Persistence Flow

```
1. Session.export()
   - state.export() → SessionStateExport
   - metadata → SessionMetadata
   ↓
2. Serialize to JSON
   ↓
3. Store in ConversationStore (IndexedDB)
   ↓
4. Later: Load from storage
   ↓
5. Session.import(data, services)
   - SessionState.import(data.state)
   - Reconstruct Session with services
```

---

## File Organization

```
codex-chrome/src/core/state/
├── SessionState.ts         # Session-wide persistent state
├── SessionServices.ts      # Service container
├── ActiveTurn.ts           # Turn lifecycle management
├── TurnState.ts            # Turn-scoped mutable state
├── types.ts                # Shared type definitions
├── index.ts                # Module exports
└── __tests__/
    ├── SessionState.test.ts
    ├── SessionServices.test.ts
    ├── ActiveTurn.test.ts
    └── TurnState.test.ts
```

**Updated Files**:
```
codex-chrome/src/core/
├── Session.ts              # Refactored to use state/ modules
├── CodexAgent.ts           # Updated to work with new Session
└── TurnManager.ts          # Updated to work with ActiveTurn
```

---

## Export Format

### New Format Only

**Session Export Format**:
```typescript
{
  conversationId: string;
  state: SessionStateExport;
  messageCount: number;
  metadata: SessionMetadata;
}
```

**Import Implementation**:
```typescript
static import(data: SessionExport, services: SessionServices): Session {
  const session = new Session(undefined, services);
  session.state = SessionState.import(data.state);
  return session;
}
```

**Note**: No backward compatibility with old export formats. Existing sessions will need to be reset when upgrading to this version.

---

## Testing Strategy

### Unit Tests

**SessionState**:
- `recordItems()` adds items to history
- `historySnapshot()` returns deep copy
- `replaceHistory()` replaces entire history
- `addApprovedCommand()` adds to set
- `updateTokenInfoFromUsage()` updates token info
- Export/import round-trip preserves state

**ActiveTurn**:
- `addTask()` registers task
- `removeTask()` unregisters task and returns empty flag
- `drainTasks()` returns all tasks and clears map
- `pushPendingInput()` queues input
- `takePendingInput()` consumes and clears input
- `abort()` cancels all tasks

**TurnState**:
- `insertPendingApproval()` adds approval resolver
- `removePendingApproval()` removes and returns resolver
- `clearPending()` clears all pending state

**Session**:
- `startTurn()` creates ActiveTurn
- `endTurn()` destroys ActiveTurn
- Cannot start turn when already active
- Cannot end turn when not active
- `export()` includes all state
- `import()` reconstructs from export

### Integration Tests

**Turn Lifecycle**:
- Start turn → execute → end turn
- Start turn → abort → turn cleaned up
- Pending input preserved across turn boundary

**State Persistence**:
- Export session → import session → state preserved
- Backward compatibility with old export format

### Contract Tests

**Goal**: Verify TypeScript matches Rust behavior

**Test Cases**:
1. Export Rust SessionState → Import TypeScript SessionState
2. Verify history items match
3. Verify token info matches
4. Verify approved commands match

---

## Migration Checklist

- [ ] Create `SessionState.ts` with tests
- [ ] Create `SessionServices.ts` with factory
- [ ] Create `ActiveTurn.ts` with tests
- [ ] Create `TurnState.ts` with tests
- [ ] Refactor `Session.ts` to use new classes
- [ ] Update `CodexAgent.ts` to use new Session
- [ ] Update `TurnManager.ts` to use ActiveTurn
- [ ] Add backward compatibility for import
- [ ] Verify all existing tests pass
- [ ] Add new integration tests
- [ ] Update documentation

---

## References

- **Rust Implementation**: `codex-rs/core/src/state/`
- **TypeScript Current**: `codex-chrome/src/core/Session.ts`
- **Research**: `specs/004-refactor-session-ts/research.md`
