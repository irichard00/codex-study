# Research: Remove Legacy State from Session

**Feature**: 007-remove-the-legacy
**Date**: 2025-10-01
**Context**: Migration from dual state management (State + SessionState) to SessionState-only

## Research Objectives

1. Understand State vs SessionState feature parity
2. Identify all State methods used by Session
3. Map State methods to SessionState equivalents
4. Analyze backward compatibility requirements for import/export
5. Review existing test coverage

---

## 1. State vs SessionState Feature Parity

### Decision: SessionState is Feature-Complete for Core Requirements

**Rationale**:
After analyzing both classes:

**SessionState provides (codex-chrome/src/core/session/state/SessionState.ts)**:
- ✅ Conversation history management (`recordItems`, `historySnapshot`, `getConversationHistory`)
- ✅ Token usage tracking (`addTokenUsage`, `updateTokenInfo`)
- ✅ Approved commands (`addApprovedCommand`, `isCommandApproved`)
- ✅ Rate limit tracking (`updateRateLimits`)
- ✅ Export/import for persistence (`export()`, `import()`)
- ✅ Pure data container (no business logic)

**State provides (codex-chrome/src/core/State.ts)**:
- Conversation history (items array)
- Execution state tracking (idle/processing/executing/waiting/interrupted/error)
- Turn state (turn number, timing, token/tool counts per turn)
- Turn history (array of completed turns)
- Token usage and limits
- Tool usage statistics (per-tool counters)
- Error history
- Interrupt flags
- Rollout history
- Pending approvals management

**Missing in SessionState that State has**:
1. **Execution state tracking** (ExecutionState enum)
2. **Turn state management** (TurnState interface, currentTurn, turnHistory)
3. **Tool usage statistics** (Map<string, number>)
4. **Error history** tracking
5. **Interrupt request** flags
6. **Rollout history** (separate from conversation history)
7. **Pending approvals** management

**Alternatives Considered**:
- Keep State for missing features → Rejected: Violates single responsibility, creates dual state
- Add all State features to SessionState → Rejected: SessionState is pure data, these are runtime concerns
- Move missing features to Session class directly → **SELECTED**: Session manages runtime state, SessionState manages persistent data

**Conclusion**: SessionState handles **persistent data** (history, tokens, commands, rate limits). The missing State features are **runtime concerns** that belong in Session itself or can be removed if unused.

---

## 2. State Methods Used by Session

### Analysis Results

Grep analysis of `Session.ts` shows State usage patterns:

**Constructor** (line 70):
```typescript
this.state = new State(this.conversationId);
```

**State method calls in Session.ts**:

1. **History Management** (~15 call sites):
   - `this.state.addToHistory(entry)` - line 181
   - `this.state.getConversationHistory()` - lines 209, 268, 545, 841
   - `this.state.setConversationHistoryItems(items)` - lines 123, 320, 346
   - `this.state.setConversationHistory(history)` - line 338
   - `this.state.getHistoryEntry(offset)` - line 217
   - `this.state.getLastMessage()` - line 370
   - `this.state.getMessagesByType(type)` - line 376
   - `this.state.clearHistory()` - line 224
   - `this.state.searchMessages(query)` - line 614
   - `this.state.compact()` - line 587
   - `this.state.addResponseItem(item)` - lines 960, 968

2. **Turn Management** (~6 call sites):
   - `this.state.startTurn()` - lines 727, 779
   - `this.state.endTurn()` - lines 733, 799

3. **Token/Tool Tracking** (~3 call sites):
   - `this.state.addTokenUsage(tokens)` - line 742
   - `this.state.trackToolUsage(toolName)` - line 806

4. **Error/Interrupt Handling** (~4 call sites):
   - `this.state.addError(error, context)` - line 812
   - `this.state.requestInterrupt()` - line 819
   - `this.state.isInterruptRequested()` - line 826
   - `this.state.clearInterrupt()` - line 833

5. **Export/Import** (~2 call sites):
   - `this.state.export()` - line 844
   - `State.import(data.state)` - line 854

6. **Getters** (1 call site):
   - `this.getState()` - line 719 (returns State instance)

**Total**: ~31 direct State method invocations

---

## 3. Mapping State Methods to SessionState

### Migration Strategy

| State Method | SessionState Equivalent | Migration Action |
|--------------|------------------------|------------------|
| `addToHistory(entry)` | `recordItems([item])` | Convert entry format, call SessionState |
| `getConversationHistory()` | `getConversationHistory()` | Direct delegation |
| `setConversationHistoryItems(items)` | `recordItems(items)` after clear | Create helper method in Session |
| `setConversationHistory(history)` | `recordItems(history.items)` after clear | Create helper method in Session |
| `getHistoryEntry(offset)` | Access `historySnapshot()[index]` | Implement in Session |
| `getLastMessage()` | Access `historySnapshot()[length-1]` | Implement in Session |
| `getMessagesByType(type)` | Filter `historySnapshot()` | Implement in Session |
| `clearHistory()` | Create new SessionState instance | Implement in Session |
| `searchMessages(query)` | Filter `historySnapshot()` | Implement in Session |
| `compact()` | Slice history, create new state | Implement in Session |
| `addResponseItem(item)` | `recordItems([item])` | Direct delegation |
| **Turn Management** | | |
| `startTurn()` | N/A | Move to Session class field |
| `endTurn()` | N/A | Move to Session class field |
| `getCurrentTurn()` | N/A | Move to Session class field |
| `getTurnHistory()` | N/A | Move to Session class field |
| **Token/Tool Tracking** | | |
| `addTokenUsage(tokens)` | `addTokenUsage(tokens)` | Direct delegation ✅ Already done |
| `trackToolUsage(toolName)` | N/A | Move to Session class field |
| `getToolUsageStats()` | N/A | Move to Session class field |
| **Error/Interrupt** | | |
| `addError()`, `getErrorHistory()` | N/A | Move to Session class field |
| `requestInterrupt()`, `isInterruptRequested()`, `clearInterrupt()` | N/A | Move to Session class field |
| **Export/Import** | | |
| `export()` | `sessionState.export()` | Already delegated in Session.export() |
| `import()` | `SessionState.import()` | Already delegated in Session.import() |
| **Execution State** | | |
| `getExecutionState()`, `setExecutionState()` | N/A | Move to Session class field |
| `isIdle()`, `isProcessing()` | N/A | Move to Session class field |
| **Pending Approvals** | | |
| `addPendingApproval()`, etc. | N/A | Move to Session class field |

**Key Insight**: Most State features are runtime concerns that should live in Session as private fields, not in a persistent state container.

---

## 4. Backward Compatibility Requirements

### Decision: NO Backward Compatibility Required

**User Direction**: "no need to consider about backward compatibility, only need to implement the new SessionState usage"

**Rust Reference Implementation** (codex-rs/core/src/state/session.rs):
- No legacy format handling
- Pure SessionState implementation
- Simple, clean structure

**Simplified Migration Plan**:
1. **Import**: SessionState format ONLY
   - Remove all legacy format handling
   - Only support modern `SessionState.import()` format
   - **Action**: Delete legacy import code paths

2. **Export**: SessionState format ONLY
   - Keep only `sessionState.export()`
   - Remove all legacy compatibility fields
   - **Action**: Clean export to match Rust implementation

**Rationale**: Following Rust implementation pattern exactly. No gradual migration needed, clean break from legacy State.

---

## 5. Existing Test Coverage

### Test Files Affected

From glob results, session state tests:
```
codex-chrome/src/core/session/state/__tests__/
├── SessionState.test.ts                    # Pure SessionState unit tests
├── Session.integration.test.ts             # Session with SessionState integration
├── Persistence.integration.test.ts         # Export/import testing
├── FreshSession.integration.test.ts        # New session creation
├── TurnExecution.integration.test.ts       # Turn execution with SessionState
├── SessionServices.test.ts                 # Service layer tests
├── ActiveTurn.test.ts                      # Turn management
└── TurnState.test.ts                       # Turn state tracking
```

**Coverage Assessment**:
- ✅ SessionState is well-tested (unit + integration)
- ✅ Import/export scenarios covered
- ✅ Turn management tested separately (ActiveTurn)
- ⚠️  Need to verify State removal doesn't break existing tests
- ⚠️  Need to add tests for Session methods that move from State delegation to direct implementation

**Action Items**:
1. Run existing test suite to establish baseline
2. Identify tests that import/use State directly
3. Update tests to verify Session behavior without State
4. Add tests for new Session methods (getLastMessage, searchMessages, etc.)

---

## 6. Risk Analysis

### Low Risk Areas
- ✅ SessionState is already implemented and tested
- ✅ Import/export already supports dual formats
- ✅ Public API preservation (no breaking changes to Session interface)

### Medium Risk Areas
- ⚠️  Turn state management migration (currentTurn, turnHistory)
- ⚠️  Tool usage statistics tracking
- ⚠️  Error history tracking
- ⚠️  Interrupt flag management

**Mitigation**: Move these as simple private fields in Session, not complex refactoring

### High Risk Areas
- 🔴 Execution state machine (idle/processing/executing/waiting/interrupted/error)
  - Used in: `setExecutionState()`, `isIdle()`, `isProcessing()`
  - **Mitigation**: Add private `executionState: ExecutionState` field to Session

- 🔴 Pending approvals management (Map<string, any>)
  - Used in: `addPendingApproval()`, `getPendingApproval()`, etc.
  - **Mitigation**: Add private `pendingApprovals: Map<string, any>` field to Session

---

## Summary & Recommendations

### Implementation Approach (Following Rust Pattern)

**Reference**: codex-rs/core/src/codex.rs lines 260-272
```rust
pub(crate) struct Session {
    conversation_id: ConversationId,
    tx_event: Sender<Event>,
    state: Mutex<SessionState>,  // <-- Pure SessionState, no legacy
    pub(crate) active_turn: Mutex<Option<ActiveTurn>>,
    services: SessionServices,
    next_internal_sub_id: AtomicU64,
}
```

**TypeScript equivalent**:
```typescript
export class Session {
  readonly conversationId: string;
  private sessionState: SessionState;  // Pure state (matches Rust)
  private activeTurn: ActiveTurn | null;
  private services: SessionServices | null;
  // Runtime fields (NOT in Rust SessionState)
  private currentTurn: TurnState | null;
  private toolUsageStats: Map<string, number>;
  // etc.
}
```

1. **Phase 1: Clean Removal**
   - Remove `private state: State` field completely
   - Remove State.ts import
   - No migration of State functionality needed

2. **Phase 2: SessionState Delegation**
   - History methods → delegate to `sessionState` (already mostly done)
   - Token/command methods → delegate to `sessionState` (already done)
   - Keep only pure SessionState delegation (match Rust)

3. **Phase 3: Runtime State in Session**
   - Add minimal runtime fields to Session directly
   - Follow Rust pattern: SessionState = persistent, Session = runtime + persistent

4. **Phase 4: Clean Import/Export**
   - Export: Only SessionState (match Rust)
   - Import: Only SessionState format
   - No legacy compatibility code

5. **Phase 5: Delete State.ts**
   - Remove file entirely (clean break)
   - Update tests to use SessionState only

### Estimated Effort
- **Very low complexity**: Clean removal, no backward compat logic
- **High confidence**: Following proven Rust implementation exactly
- **Time estimate**: 1-2 hours implementation + 30 min testing

---

## References

- SessionState implementation: `codex-chrome/src/core/session/state/SessionState.ts`
- State implementation: `codex-chrome/src/core/State.ts`
- Session implementation: `codex-chrome/src/core/Session.ts`
- Rust reference: `codex-rs/core/src/state/session.rs`
- Test suite: `codex-chrome/src/core/session/state/__tests__/`
