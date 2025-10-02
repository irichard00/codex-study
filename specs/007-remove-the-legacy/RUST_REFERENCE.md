# Rust Reference Implementation

**Feature**: 007-remove-the-legacy
**Date**: 2025-10-01

## Key Directive

**"No need to consider about backward compatibility, only need to implement the new SessionState usage. Take the original rust session implementation as reference in codex-rs/core/src/codex.rs"**

---

## Rust Session Structure

**File**: `codex-rs/core/src/codex.rs` (lines 260-272)

```rust
/// Context for an initialized model agent
///
/// A session has at most 1 running task at a time, and can be interrupted by user input.
pub(crate) struct Session {
    conversation_id: ConversationId,
    tx_event: Sender<Event>,
    state: Mutex<SessionState>,                    // <-- Pure SessionState
    pub(crate) active_turn: Mutex<Option<ActiveTurn>>,
    services: SessionServices,
    next_internal_sub_id: AtomicU64,
}
```

**Key observations**:
- ✅ Single `state: Mutex<SessionState>` field for persistent data
- ✅ No legacy state management
- ✅ Clean separation: SessionState = data, Session = runtime + data
- ✅ ActiveTurn handled separately (not in SessionState)

---

## Rust SessionState Structure

**File**: `codex-rs/core/src/state/session.rs` (lines 0-80)

```rust
/// Persistent, session-scoped state previously stored directly on `Session`.
#[derive(Default)]
pub(crate) struct SessionState {
    pub(crate) approved_commands: HashSet<Vec<String>>,
    pub(crate) history: ConversationHistory,
    pub(crate) token_info: Option<TokenUsageInfo>,
    pub(crate) latest_rate_limits: Option<RateLimitSnapshot>,
}

impl SessionState {
    /// Create a new session state mirroring previous `State::default()` semantics.
    pub(crate) fn new() -> Self {
        Self {
            history: ConversationHistory::new(),
            ..Default::default()
        }
    }

    // History helpers
    pub(crate) fn record_items<I>(&mut self, items: I)
    where
        I: IntoIterator,
        I::Item: std::ops::Deref<Target = ResponseItem>,
    {
        self.history.record_items(items)
    }

    pub(crate) fn history_snapshot(&self) -> Vec<ResponseItem> {
        self.history.contents()
    }

    pub(crate) fn replace_history(&mut self, items: Vec<ResponseItem>) {
        self.history.replace(items);
    }

    // Approved command helpers
    pub(crate) fn add_approved_command(&mut self, cmd: Vec<String>) {
        self.approved_commands.insert(cmd);
    }

    pub(crate) fn approved_commands_ref(&self) -> &HashSet<Vec<String>> {
        &self.approved_commands
    }

    // Token/rate limit helpers
    pub(crate) fn update_token_info_from_usage(
        &mut self,
        usage: &TokenUsage,
        model_context_window: Option<u64>,
    ) {
        self.token_info = TokenUsageInfo::new_or_append(
            &self.token_info,
            &Some(usage.clone()),
            model_context_window,
        );
    }

    pub(crate) fn set_rate_limits(&mut self, snapshot: RateLimitSnapshot) {
        self.latest_rate_limits = Some(snapshot);
    }

    pub(crate) fn token_info_and_rate_limits(
        &self,
    ) -> (Option<TokenUsageInfo>, Option<RateLimitSnapshot>) {
        (self.token_info.clone(), self.latest_rate_limits.clone())
    }

    // Pending input/approval moved to TurnState.
}
```

**Key features**:
- ✅ Only persistent data (history, commands, tokens, rate limits)
- ✅ Simple helper methods (record_items, history_snapshot, etc.)
- ✅ No runtime state (turn state, execution state, etc.)
- ✅ Comment at end: "Pending input/approval moved to TurnState"

---

## TypeScript Target Implementation

**File**: `codex-chrome/src/core/Session.ts`

### Target Structure

```typescript
export class Session {
  readonly conversationId: string;

  // Pure SessionState (matches Rust)
  private sessionState: SessionState;

  // Active turn (matches Rust)
  private activeTurn: ActiveTurn | null;

  // Services (matches Rust)
  private services: SessionServices | null;

  // Runtime fields (NOT in SessionState, lives in Session)
  private currentTurn: TurnState | null;
  private toolUsageStats: Map<string, number>;
  private errorHistory: Array<{timestamp: number, error: string, context?: any}>;
  private interruptRequested: boolean;
  private pendingApprovals: Map<string, any>;

  // Legacy - TO BE REMOVED
  private state: State;  // <-- DELETE THIS

  // ... methods
}
```

### What to Remove

❌ `private state: State` field
❌ `import { State } from './State'`
❌ All `this.state.method()` calls
❌ Legacy format handling in `import()`
❌ Legacy fields in `export()`
❌ `State.ts` file entirely

### What to Keep/Add

✅ `private sessionState: SessionState` (already exists)
✅ Delegate history methods to `sessionState`
✅ Add minimal runtime fields to Session directly
✅ Clean export/import (SessionState format only)
✅ Match Rust implementation pattern

---

## Implementation Checklist

### Phase 1: Remove State Field
- [ ] Delete `private state: State` field from Session
- [ ] Remove `import { State } from './State'`
- [ ] Remove all `this.state.*` method calls

### Phase 2: SessionState Delegation
- [ ] `addToHistory()` → `sessionState.recordItems()`
- [ ] `getConversationHistory()` → `sessionState.getConversationHistory()`
- [ ] Helper methods use `sessionState.historySnapshot()`
- [ ] Token tracking → `sessionState.addTokenUsage()`
- [ ] Commands → `sessionState.addApprovedCommand()`, `isCommandApproved()`

### Phase 3: Runtime State in Session
- [ ] Add `currentTurn: TurnState | null` field
- [ ] Add `toolUsageStats: Map<string, number>` field (if needed)
- [ ] Add `errorHistory` array (if needed)
- [ ] Implement runtime methods directly in Session

### Phase 4: Clean Export/Import
- [ ] `export()` returns only `{id, state: sessionState.export(), metadata}`
- [ ] Remove ALL legacy fields from export
- [ ] `import()` accepts only `{id, state, metadata}` format
- [ ] Remove ALL legacy format handling

### Phase 5: Delete State.ts
- [ ] Delete `codex-chrome/src/core/State.ts` file
- [ ] Verify no other files import State
- [ ] Run tests to confirm clean removal

---

## Key Differences: Rust vs Current TypeScript

| Aspect | Rust (codex-rs) | Current TypeScript | Target TypeScript |
|--------|-----------------|-------------------|-------------------|
| **State storage** | `state: Mutex<SessionState>` | `state: State` + `sessionState: SessionState` | `sessionState: SessionState` only |
| **History** | `sessionState.history` | `state.conversationHistory` + `sessionState.history` | `sessionState.history` only |
| **Tokens** | `sessionState.token_info` | `state.totalTokensUsed` + `sessionState.tokenInfo` | `sessionState.tokenInfo` only |
| **Commands** | `sessionState.approved_commands` | `sessionState.approvedCommands` (already correct) | No change |
| **Turn state** | Separate `ActiveTurn` | `state.currentTurn` + `activeTurn` | Session fields |
| **Import/export** | SessionState only | Dual format (legacy + modern) | SessionState only |
| **Complexity** | Simple, clean | Duplicate state tracking | Simple, clean |

---

## Migration Notes

### What's Already Correct
- ✅ `sessionState: SessionState` field exists
- ✅ Token/command methods already delegate to SessionState
- ✅ ActiveTurn is separate (matches Rust)

### What Needs Changing
- ❌ Remove duplicate `state: State` field
- ❌ Remove all State method calls
- ❌ Clean up export/import (remove legacy compatibility)
- ❌ Add minimal runtime fields to Session directly

### Estimated Effort
- **Complexity**: Low (mechanical removal)
- **Risk**: Low (following proven Rust pattern)
- **Time**: 1-2 hours implementation + 30 minutes testing
- **LOC**: ~100-150 lines removed, ~20-30 lines added

---

## References

- Rust Session: `codex-rs/core/src/codex.rs:260-272`
- Rust SessionState: `codex-rs/core/src/state/session.rs:0-80`
- TypeScript Session: `codex-chrome/src/core/Session.ts`
- TypeScript SessionState: `codex-chrome/src/core/session/state/SessionState.ts`
