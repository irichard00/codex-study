# Research: Session Refactoring Analysis

**Feature**: Refactor Session.ts to Match Rust Implementation Updates
**Research Date**: 2025-10-01
**Rust Commit**: [250b244ab](https://github.com/irichard00/codex-study/commit/250b244ab4223817b8b4f28d827bfd892153ae3e) - "ref: full state refactor"

## Executive Summary

The Rust implementation underwent a major state refactoring (commit 250b244ab) that separated concerns into three distinct layers:
1. **SessionState**: Pure data state (history, tokens, approvals)
2. **SessionServices**: External service integrations (MCP, exec, rollout, notifications)
3. **ActiveTurn**: Turn-scoped mutable state (tasks, approvals, pending input)

This research analyzes the changes and provides recommendations for applying the same architecture to the TypeScript implementation in codex-chrome.

---

## 1. Current State Analysis

### TypeScript Implementation (codex-chrome/src/core/)

**Current Files:**
- `Session.ts` (754 lines): Monolithic class mixing concerns
- `State.ts` (612 lines): Manages execution state, turn tracking, history
- `TurnContext.ts`: Configuration for turn execution

**Issues Identified:**
1. `Session.ts` mixes state management, service coordination, and business logic
2. No clear separation between session-wide state and turn-scoped state
3. Services (MCP, storage, notifications) are directly embedded in Session
4. Turn lifecycle management is scattered across Session and State
5. Pending approvals and input are handled in multiple places

### Rust Implementation (codex-rs/core/src/)

**After Refactoring:**
- `codex.rs`: Session struct with clean separation
- `state/session.rs`: SessionState - pure data container
- `state/service.rs`: SessionServices - service collection
- `state/turn.rs`: ActiveTurn - turn lifecycle management
- `state/mod.rs`: Module exports

**Key Improvements:**
1. Clear responsibility boundaries
2. SessionState is immutable snapshot-friendly
3. SessionServices centralizes external dependencies
4. ActiveTurn manages concurrent turn execution safely
5. Mutex-protected turn state prevents race conditions

---

## 2. Architectural Changes in Rust

### 2.1 SessionState (state/session.rs)

**Purpose**: Hold session-wide persistent state

**Fields:**
```rust
pub(crate) struct SessionState {
    pub(crate) approved_commands: HashSet<Vec<String>>,
    pub(crate) history: ConversationHistory,
    pub(crate) token_info: Option<TokenUsageInfo>,
    pub(crate) latest_rate_limits: Option<RateLimitSnapshot>,
}
```

**Operations:**
- `record_items()`: Add items to conversation history
- `history_snapshot()`: Get immutable history view
- `replace_history()`: Replace entire history (for compaction)
- `add_approved_command()`: Track approved commands
- `update_token_info_from_usage()`: Update token tracking
- `set_rate_limits()`: Update rate limit info

**Design Principles:**
- Pure data container, no business logic
- All mutations through explicit methods
- No direct field access from outside
- Supports atomic operations for concurrency

### 2.2 SessionServices (state/service.rs)

**Purpose**: Centralize external service dependencies

**Fields:**
```rust
pub(crate) struct SessionServices {
    pub(crate) mcp_connection_manager: McpConnectionManager,
    pub(crate) session_manager: ExecSessionManager,
    pub(crate) unified_exec_manager: UnifiedExecSessionManager,
    pub(crate) notifier: UserNotifier,
    pub(crate) rollout: Mutex<Option<RolloutRecorder>>,
    pub(crate) codex_linux_sandbox_exe: Option<PathBuf>,
    pub(crate) user_shell: crate::shell::Shell,
    pub(crate) show_raw_agent_reasoning: bool,
}
```

**Design Principles:**
- Single ownership point for all services
- Initialized once during session creation
- Passed as immutable reference to operations
- Mutex-protected for async-safe access
- Easy to mock for testing

### 2.3 ActiveTurn (state/turn.rs)

**Purpose**: Manage currently executing turn

**Structure:**
```rust
pub(crate) struct ActiveTurn {
    pub(crate) tasks: IndexMap<String, RunningTask>,
    pub(crate) turn_state: Arc<Mutex<TurnState>>,
}

pub(crate) struct TurnState {
    pending_approvals: HashMap<String, oneshot::Sender<ReviewDecision>>,
    pending_input: Vec<ResponseInputItem>,
}
```

**Operations:**
- `add_task()`: Register running task
- `remove_task()`: Unregister completed task
- `drain_tasks()`: Get all tasks (for cleanup)
- `clear_pending()`: Clear approvals and input
- `push_pending_input()`: Queue user input during turn
- `take_pending_input()`: Consume queued input

**Design Principles:**
- One ActiveTurn per session maximum
- Mutex-protected turn state for async safety
- Task tracking with abort handles
- Pending state isolated from session state

### 2.4 Session Structure After Refactoring

**Before (codex-rs prior to 250b244ab):**
```rust
struct Session {
    // Mix of state, services, and turn info
    conversation_id: ConversationId,
    history: ConversationHistory,
    mcp_manager: McpConnectionManager,
    exec_manager: ExecSessionManager,
    notifier: UserNotifier,
    rollout: RolloutRecorder,
    approved_commands: HashSet<Vec<String>>,
    // ... more mixed concerns
}
```

**After (codex-rs commit 250b244ab):**
```rust
pub(crate) struct Session {
    conversation_id: ConversationId,
    tx_event: Sender<Event>,
    state: Mutex<SessionState>,          // ← Separated
    active_turn: Mutex<Option<ActiveTurn>>, // ← Separated
    services: SessionServices,            // ← Separated
    next_internal_sub_id: AtomicU64,
}
```

**Benefits:**
1. Clear separation of concerns
2. State can be snapshotted atomically
3. Services can be shared/mocked easily
4. Turn lifecycle is explicit
5. Reduced lock contention (separate mutexes)

---

## 3. TypeScript Mapping Strategy

### 3.1 SessionState.ts (NEW)

**Responsibilities:**
- Conversation history management
- Token usage tracking
- Approved command tracking
- Rate limit information

**Operations to Port:**
```typescript
class SessionState {
  private approvedCommands: Set<string[]>;
  private history: ConversationHistory;
  private tokenInfo?: TokenUsageInfo;
  private latestRateLimits?: RateLimitSnapshot;

  recordItems(items: ResponseItem[]): void
  historySnapshot(): ResponseItem[]
  replaceHistory(items: ResponseItem[]): void
  addApprovedCommand(cmd: string[]): void
  updateTokenInfoFromUsage(usage: TokenUsage, contextWindow?: number): void
  setRateLimits(snapshot: RateLimitSnapshot): void
}
```

**Source Material:**
- Extract from current `State.ts` lines 39-301 (history management)
- Extract from current `Session.ts` lines 303-338 (token tracking)
- Add approved commands from Rust `SessionState`

### 3.2 SessionServices.ts (NEW)

**Responsibilities:**
- Storage service (Chrome extension specific)
- User notifier
- Rollout recorder placeholder
- DOM manipulation service (Chrome extension specific)
- Tab manager (Chrome extension specific)

**Note**: MCP (Model Context Protocol) is NOT included as codex-chrome is a browser-based agent without MCP support.

**Structure:**
```typescript
interface SessionServices {
  conversationStore?: ConversationStore;
  notifier: UserNotifier;
  rolloutRecorder?: RolloutRecorder;
  domService?: DOMService;
  tabManager?: TabManager;
  showRawAgentReasoning: boolean;
  // Chrome extension specific services only
  // No MCP support in browser environment
}
```

**Source Material:**
- Extract from current `Session.ts` lines 39-41 (conversationStore, isPersistent)
- Add notifier from existing implementation
- Add browser-specific services (DOM, tabs)
- MCP is explicitly excluded (not supported in browser)

### 3.3 ActiveTurn.ts (NEW)

**Responsibilities:**
- Track currently running tasks
- Manage pending approvals (turn-scoped)
- Queue pending input during turn execution
- Task abort handling

**Structure:**
```typescript
interface RunningTask {
  handle: AbortController;
  kind: TaskKind;
  startTime: number;
}

class ActiveTurn {
  private tasks: Map<string, RunningTask>;
  private turnState: TurnState;

  addTask(subId: string, task: RunningTask): void
  removeTask(subId: string): boolean
  drainTasks(): Map<string, RunningTask>
  clearPending(): void
  pushPendingInput(input: ResponseInputItem): void
  takePendingInput(): ResponseInputItem[]
}

class TurnState {
  private pendingApprovals: Map<string, (decision: ReviewDecision) => void>;
  private pendingInput: ResponseInputItem[];
}
```

**Source Material:**
- Extract from current `Session.ts` lines 421-433 (pending input)
- Extract from current `State.ts` lines 78-80 (pending approvals)
- Add task tracking from Rust implementation

### 3.4 Refactored Session.ts

**New Structure:**
```typescript
class Session {
  private readonly conversationId: string;
  private readonly state: SessionState;           // ← New
  private readonly services: SessionServices;     // ← New
  private activeTurn: ActiveTurn | null = null;   // ← New
  private readonly eventEmitter: (event: Event) => Promise<void>;
  private readonly config?: AgentConfig;

  constructor(config?: AgentConfig, isPersistent?: boolean)
  async initialize(): Promise<void>

  // State operations (delegate to this.state)
  getConversationHistory(): ConversationHistory
  recordInput(items: InputItem[]): Promise<void>
  addTokenUsage(tokens: number): void

  // Turn operations (delegate to this.activeTurn)
  async startTurn(): Promise<void>
  async endTurn(): Promise<void>
  getPendingInput(): Promise<ResponseInputItem[]>

  // Service operations (use this.services)
  async getMcpTools(): Promise<ToolDefinition[]>
  async emitEvent(event: Event): Promise<void>
}
```

**Benefits:**
1. Clear delegation model
2. Easy to test (mock services)
3. State can be exported/imported atomically
4. Turn lifecycle is explicit
5. Matches Rust architecture

---

## 4. Migration Path

### Phase 1: Create New State Classes

**Tasks:**
1. Create `SessionState.ts` with conversation history management
2. Create `SessionServices.ts` interface and implementation
3. Create `ActiveTurn.ts` with turn lifecycle
4. Create `TurnState.ts` for turn-scoped mutable state

**Validation:**
- All new classes have unit tests
- Export/import functionality works
- Clean implementation without legacy constraints

### Phase 2: Replace Session.ts (Breaking Change)

**Tasks:**
1. Completely rewrite `Session.ts` to use new classes
2. Remove all backward compatibility code
3. Implement new export format only
4. Update all tests to use new structure
5. Remove or deprecate old State.ts if not needed

**Validation:**
- All tests pass with new implementation
- Session export/import works with new format
- Turn lifecycle works correctly
- No legacy code remains

### Phase 3: Update Dependent Code

**Tasks:**
1. Update `CodexAgent.ts` to use new Session interface
2. Update `TurnManager.ts` to work with ActiveTurn
3. Update `State.ts` to remove duplicated functionality
4. Update storage integration to use SessionState

**Validation:**
- Integration tests pass
- End-to-end scenarios work
- No regressions in UI

### Phase 4: Cleanup (Optional)

**Tasks:**
1. Remove obsolete code from `State.ts`
2. Consolidate turn tracking logic
3. Document new architecture
4. Update CLAUDE.md with new structure

---

## 5. Technology Stack Decisions

### 5.1 Concurrency Control

**Decision**: Use async/await + explicit locks where needed

**Rationale**:
- TypeScript doesn't have Rust's `Mutex<T>`
- JavaScript is single-threaded, but async operations need coordination
- Use Promise-based locks for critical sections

**Implementation**:
```typescript
class AsyncMutex {
  private locked: boolean = false;
  private queue: Array<() => void> = [];

  async lock(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>(resolve => this.queue.push(resolve));
  }

  unlock(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}
```

**Alternatives Considered**:
- External mutex library (async-mutex)
- No locking (risky for concurrent operations)

**Why Chosen**:
- Simple, no external dependencies
- Sufficient for single-threaded environment
- Matches Rust's `Mutex<T>` pattern conceptually

### 5.2 Task Abort Handling

**Decision**: Use `AbortController` for task cancellation

**Rationale**:
- Standard Web API for cancellation
- Compatible with fetch() and async operations
- TypeScript-friendly

**Implementation**:
```typescript
interface RunningTask {
  handle: AbortController;
  kind: TaskKind;
}

async function runTask(task: RunningTask) {
  const signal = task.handle.signal;
  try {
    await doWork(signal);
  } catch (error) {
    if (error.name === 'AbortError') {
      // Task was cancelled
    }
  }
}
```

**Alternatives Considered**:
- Promise rejection
- Manual cancellation flags

**Why Chosen**:
- Standard API, well-supported
- Integrates with fetch and other async APIs
- Matches Rust's `AbortHandle` concept

### 5.3 State Immutability

**Decision**: Use defensive copying for state exports

**Rationale**:
- TypeScript doesn't enforce immutability like Rust
- Need to prevent accidental mutations
- Performance acceptable for snapshot operations

**Implementation**:
```typescript
class SessionState {
  historySnapshot(): ResponseItem[] {
    return JSON.parse(JSON.stringify(this.history.items));
  }

  export(): SessionStateExport {
    return {
      approvedCommands: Array.from(this.approvedCommands),
      history: { ...this.history, items: [...this.history.items] },
      tokenInfo: this.tokenInfo ? { ...this.tokenInfo } : undefined,
    };
  }
}
```

**Alternatives Considered**:
- Immer.js (immutability library)
- Readonly types only (no runtime protection)
- Proxy-based immutability

**Why Chosen**:
- No external dependencies
- Explicit and clear
- Matches Rust's clone/copy semantics

### 5.4 Service Injection

**Decision**: Constructor injection for SessionServices

**Rationale**:
- Testability (easy to mock)
- Explicit dependencies
- Matches Rust pattern

**Implementation**:
```typescript
class Session {
  constructor(
    config: AgentConfig,
    services: SessionServices,
    eventEmitter: (event: Event) => Promise<void>
  ) {
    this.services = services;
    // ...
  }
}

// Factory function for production
async function createSession(config: AgentConfig): Promise<Session> {
  const services: SessionServices = {
    mcpConnectionManager: await createMcpManager(config),
    conversationStore: await createStore(config),
    notifier: new UserNotifier(config),
  };

  return new Session(config, services, defaultEventEmitter);
}
```

**Alternatives Considered**:
- Service locator pattern
- Global singletons
- Builder pattern

**Why Chosen**:
- Most testable
- Clear dependencies
- Type-safe

---

## 6. Browser-Specific Considerations

### 6.1 Service Differences

| Rust Service | TypeScript Equivalent | Notes |
|--------------|----------------------|-------|
| `ExecSessionManager` | N/A | No shell execution in browser |
| `UnifiedExecSessionManager` | N/A | No unified exec in browser |
| `RolloutRecorder` | `RolloutRecorder` (placeholder) | May use IndexedDB |
| `McpConnectionManager` | N/A | MCP not supported in browser |
| `UserNotifier` | `UserNotifier` | Chrome notifications API |
| `codex_linux_sandbox_exe` | N/A | No sandboxing in browser |
| `user_shell` | N/A | No shell in browser |

### 6.2 Storage Adaptation

**Rust**: File-based rollout recording
**TypeScript**: IndexedDB-based storage

**Adaptation Strategy**:
- Keep RolloutRecorder interface
- Implement browser-specific backend
- Use same serialization format
- Support export/import for cross-platform

### 6.3 Concurrency Model

**Rust**: Tokio async runtime with true parallelism
**TypeScript**: Single-threaded event loop

**Implications**:
- No true concurrent execution
- Mutex overhead is minimal (no context switching)
- Focus on preventing re-entrancy bugs
- Async/await sufficient for coordination

---

## 7. Performance Considerations

### 7.1 State Snapshot Overhead

**Concern**: Frequent snapshots could be expensive

**Mitigation**:
- Snapshot only when needed (export, persistence)
- Use structural sharing where possible
- Profile before optimizing

**Benchmarks Needed**:
- Snapshot 1000-item history
- Deep copy vs shallow copy
- JSON serialization performance

### 7.2 Mutex Lock Contention

**Concern**: Lock contention could block UI

**Mitigation**:
- Keep critical sections small
- Use async locks (don't block event loop)
- Separate mutexes for state and turn

**Benchmarks Needed**:
- Lock acquisition time
- Hold time for typical operations
- Contention under concurrent operations

---

## 8. Testing Strategy

### 8.1 Unit Tests

**SessionState**:
- History recording and retrieval
- Token tracking accuracy
- Approved command management
- Export/import round-trip

**SessionServices**:
- Service initialization
- Service mocking
- Error handling

**ActiveTurn**:
- Task lifecycle
- Pending input queueing
- Approval management
- Concurrent turn prevention

### 8.2 Integration Tests

**Session**:
- Turn execution flow
- State persistence
- Service coordination
- Error recovery

### 8.3 Contract Tests

**Goal**: Ensure TypeScript behavior matches Rust

**Approach**:
1. Generate test cases from Rust test suite
2. Export Rust session state, import in TypeScript
3. Verify identical behavior
4. Test edge cases (empty history, interrupted turns, etc.)

---

## 9. Open Questions & Risks

### 9.1 Open Questions

1. **Q**: Should SessionState use Immer.js for immutability?
   **A**: No, use defensive copying. Simpler, no dependencies.

2. **Q**: How to handle service initialization failures?
   **A**: Follow Rust pattern - graceful degradation for optional services.

3. **Q**: Should we support cross-platform session resumption?
   **A**: Yes, but mark as experimental initially.

4. **Q**: How to handle schema evolution for persisted state?
   **A**: Version field + migration functions.

### 9.2 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking changes to Session API | High | High | Backward compatibility layer |
| Performance regression | Medium | Medium | Benchmark before/after |
| Incomplete Rust port | Low | High | Careful code review, tests |
| Browser storage limitations | Medium | Low | Warn user, implement quotas |

---

## 10. Recommendations

### Immediate Actions

1. ✅ **Create SessionState.ts**: Pure state container matching Rust
2. ✅ **Create SessionServices.ts**: Service collection interface
3. ✅ **Create ActiveTurn.ts**: Turn lifecycle management
4. ✅ **Write comprehensive unit tests**: Before refactoring Session.ts

### Phase 1 Deliverables

- `SessionState.ts` with history, tokens, approvals
- `SessionServices.ts` with service interfaces
- `ActiveTurn.ts` with task and approval tracking
- `TurnState.ts` with mutable turn state
- Unit tests for all new classes (>80% coverage)

### Phase 2 Deliverables

- Refactored `Session.ts` using new classes
- Updated `CodexAgent.ts` and `TurnManager.ts`
- Integration tests passing
- Documentation updated

### Success Criteria

1. All existing tests pass
2. Session export/import maintains backward compatibility
3. Turn lifecycle works correctly
4. No performance regressions
5. Code coverage maintained or improved

---

## References

- **Rust Commit**: [250b244ab](https://github.com/irichard00/codex-study/commit/250b244ab4223817b8b4f28d827bfd892153ae3e)
- **Rust Source**: `codex-rs/core/src/state/`
- **TypeScript Source**: `codex-chrome/src/core/`
- **Previous Research**: `docs/specs/data-model.md`
