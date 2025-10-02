# Data Model: Session State Management

**Feature**: 007-remove-the-legacy
**Date**: 2025-10-01

## Overview

This refactoring does not introduce new data entities. Instead, it consolidates existing state management into a cleaner architecture.

---

## Core Entities

### SessionState (Persistent Data)

**Purpose**: Pure data container for session state that persists across browser sessions

**Fields**:
- `history: ResponseItem[]` - Conversation history (messages, tool calls, responses)
- `approvedCommands: Set<string>` - Commands approved by user for auto-execution
- `tokenInfo?: TokenUsageInfo` - Token usage tracking (total, prompt, completion)
- `latestRateLimits?: RateLimitSnapshot` - API rate limit information

**Operations**:
- `recordItems(items: ResponseItem[])` - Append to history
- `historySnapshot()` - Get immutable copy of history
- `addTokenUsage(tokens: number)` - Increment token counter
- `addApprovedCommand(command: string)` - Mark command as approved
- `isCommandApproved(command: string)` - Check approval status
- `export()` - Serialize for persistence
- `import(data)` - Deserialize from storage

**Persistence**: Stored via RolloutRecorder in IndexedDB

**Lifecycle**: Created on session start, persisted on changes, restored on resume

---

### Session Runtime State (Ephemeral Data)

**Purpose**: Runtime state that does NOT persist (managed directly in Session class)

**Fields** (to be added as private fields in Session):

1. **Execution State**
   - `executionState: ExecutionState` - Current execution phase (idle/processing/executing/waiting/interrupted/error)
   - Used for: UI state, workflow control

2. **Turn State**
   - `currentTurn: TurnState | null` - Active turn metadata (turn number, start time, token count)
   - `turnHistory: TurnState[]` - Completed turns
   - Used for: Turn boundaries, statistics

3. **Tool Usage**
   - `toolUsageStats: Map<string, number>` - Per-tool invocation counters
   - Used for: Analytics, debugging

4. **Error Tracking**
   - `errorHistory: Array<{timestamp, error, context}>` - Recent errors
   - Used for: Debugging, user feedback

5. **Interrupt Management**
   - `interruptRequested: boolean` - User interrupt flag
   - Used for: Turn cancellation

6. **Pending Approvals**
   - `pendingApprovals: Map<string, any>` - Awaiting user approval
   - Used for: Approval policy enforcement

**Lifecycle**: Created fresh on each session, cleared on session close

---

## State Separation Rationale

### Persistent State (SessionState)
- **What**: Conversation history, user preferences, API usage
- **Why**: Must survive browser restarts, session resume
- **Where**: SessionState class → RolloutRecorder → IndexedDB

### Ephemeral State (Session fields)
- **What**: Runtime execution metadata, UI state, temporary flags
- **Why**: Only relevant during active session, wasteful to persist
- **Where**: Session class private fields (in-memory only)

---

## Data Flow

### Session Creation (New)
```
1. new Session() creates:
   - sessionState = new SessionState()
   - executionState = 'idle'
   - currentTurn = null
   - Other runtime fields initialized empty
```

### Session Resume (Existing)
```
1. Session.import(data) restores:
   - sessionState = SessionState.import(data.state)
   - Runtime fields re-initialized fresh (not from data)
```

### During Execution
```
1. User message → session.addToHistory()
   - sessionState.recordItems([message])  // Persisted
   - executionState = 'processing'        // Runtime only

2. Turn start → session.startTurn()
   - currentTurn = {turnNumber, startTime, ...}  // Runtime
   - No SessionState change

3. Agent response → session.addToHistory()
   - sessionState.recordItems([response])  // Persisted

4. Token usage → session.addTokenUsage()
   - sessionState.addTokenUsage(tokens)    // Persisted
   - currentTurn.tokenCount += tokens      // Runtime
```

### Session Export
```
session.export() returns:
{
  id: conversationId,
  state: sessionState.export(),  // Persistent data only
  metadata: {
    created, lastAccessed, messageCount
  }
}
// Runtime state (executionState, currentTurn, etc.) NOT exported
```

---

## Migration Impact

### Removed Data
- **State class instance**: No longer stored in Session
- **State export in session data**: Legacy format removed from new exports

### Preserved Data
- **All conversation history**: Migrated to SessionState
- **Token usage**: Migrated to SessionState
- **Approved commands**: Migrated to SessionState

### Added Data (in Session class)
- Runtime state fields (previously in State, now in Session directly)

---

## Validation Rules

### SessionState
- ✅ History items must be valid ResponseItem objects
- ✅ Token counts must be non-negative
- ✅ Approved commands must be non-empty strings

### Session Runtime State
- ✅ executionState must be valid ExecutionState enum value
- ✅ currentTurn exists only when executionState is 'processing' or 'executing'
- ✅ pendingApprovals removed when approved or rejected

---

## References

- SessionState implementation: `codex-chrome/src/core/session/state/SessionState.ts`
- Session class: `codex-chrome/src/core/Session.ts`
- Protocol types: `codex-chrome/src/protocol/types.ts`
