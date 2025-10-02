# Session Class API Contract

**Feature**: 007-remove-the-legacy
**Date**: 2025-10-01

## Overview

This contract defines the **preserved public API** of the Session class. All methods listed here MUST continue to work identically after the State removal refactoring.

---

## Constructor

### `constructor(configOrIsPersistent?: AgentConfig | boolean, isPersistent?: boolean, services?: SessionServices)`

**Purpose**: Create a new Session instance

**Parameters**:
- `configOrIsPersistent`: AgentConfig object OR boolean (backward compatibility)
- `isPersistent`: boolean (optional, default true)
- `services`: SessionServices (optional, for dependency injection)

**Postconditions**:
- ✅ `conversationId` is generated (format: `conv_{uuid}`)
- ✅ `sessionState` is initialized (empty history, no tokens)
- ✅ Runtime state initialized (executionState = 'idle', currentTurn = null)

**Contract Test**: Create session, verify ID format and initial state

---

## History Management

### `async addToHistory(entry: {timestamp: number, text: string, type: 'user'|'agent'|'system'}): Promise<void>`

**Purpose**: Add a message to conversation history

**Preconditions**:
- `entry.timestamp` is valid Unix timestamp
- `entry.text` is non-empty string
- `entry.type` is valid role

**Postconditions**:
- ✅ Entry added to SessionState history
- ✅ `messageCount` incremented
- ✅ If RolloutRecorder exists, item persisted to IndexedDB

**Side Effects**: May trigger persistence to storage

**Contract Test**: Add entry, verify in history, verify count incremented

---

### `getConversationHistory(): ConversationHistory`

**Purpose**: Get full conversation history

**Returns**: ConversationHistory object with items array

**Postconditions**:
- ✅ Returns items from SessionState
- ✅ Returned object is immutable (snapshot)

**Contract Test**: Add entries, verify all returned in order

---

### `getHistoryEntry(offset: number): ResponseItem | undefined`

**Purpose**: Get specific history item by negative offset from end

**Parameters**:
- `offset`: Negative integer (e.g., -1 for last item)

**Returns**: ResponseItem or undefined if offset out of bounds

**Contract Test**: Add 3 items, verify getHistoryEntry(-1) returns last item

---

### `getLastMessage(): ResponseItem | undefined`

**Purpose**: Get most recent message from history

**Returns**: Last ResponseItem or undefined if history empty

**Contract Test**: Empty history returns undefined, non-empty returns last

---

### `getMessagesByType(type: 'user'|'agent'|'system'): ResponseItem[]`

**Purpose**: Filter history by message role

**Returns**: Array of matching ResponseItem objects

**Contract Test**: Add mixed messages, verify filtering works correctly

---

### `clearHistory(): void`

**Purpose**: Remove all messages from history

**Postconditions**:
- ✅ SessionState history is empty
- ✅ `messageCount` reset to 0

**Contract Test**: Add entries, clear, verify empty

---

### `async compact(): Promise<void>`

**Purpose**: Reduce history size to save tokens

**Postconditions**:
- ✅ History reduced (implementation-defined strategy)
- ✅ `messageCount` updated

**Contract Test**: Add many entries, compact, verify reduction

---

## Turn Management

### `async startTurn(): Promise<void>`

**Purpose**: Begin a new conversation turn

**Preconditions**:
- No active turn exists

**Postconditions**:
- ✅ `isActiveTurn()` returns true
- ✅ `currentTurn` initialized with turn number, start time

**Throws**: Error if turn already active

**Contract Test**: Start turn, verify active, attempt second start fails

---

### `async endTurn(): Promise<void>`

**Purpose**: Complete the current turn

**Preconditions**:
- Active turn exists

**Postconditions**:
- ✅ `isActiveTurn()` returns false
- ✅ Turn moved to history
- ✅ Pending tasks drained from ActiveTurn

**Contract Test**: Start turn, end turn, verify no longer active

---

### `isActiveTurn(): boolean`

**Purpose**: Check if a turn is currently active

**Returns**: true if turn active, false otherwise

**Contract Test**: Verify false initially, true after start, false after end

---

## Token & Command Tracking

### `addTokenUsage(tokens: number): void`

**Purpose**: Record token usage for this session

**Parameters**:
- `tokens`: Non-negative integer

**Postconditions**:
- ✅ SessionState token count incremented
- ✅ Current turn token count incremented (if turn active)

**Contract Test**: Add tokens, verify SessionState total increased

---

### `addApprovedCommand(command: string): void`

**Purpose**: Mark a command as approved for auto-execution

**Parameters**:
- `command`: Non-empty string

**Postconditions**:
- ✅ SessionState approved commands set updated

**Contract Test**: Add command, verify isCommandApproved returns true

---

### `isCommandApproved(command: string): boolean`

**Purpose**: Check if command has been approved

**Returns**: true if approved, false otherwise

**Contract Test**: Non-approved returns false, approved returns true

---

## Export/Import

### `export(): {id, state, metadata}`

**Purpose**: Serialize session for persistence (following Rust implementation)

**Returns**:
```typescript
{
  id: string,                    // conversationId
  state: SessionStateExport,     // SessionState.export()
  metadata: {
    created: number,
    lastAccessed: number,
    messageCount: number
  }
}
```

**Postconditions**:
- ✅ Only SessionState data exported (no runtime state)
- ✅ Clean format matching Rust implementation
- ✅ NO legacy State format fields

**Contract Test**: Export, verify structure matches schema

---

### `static import(data: {id, state, metadata}, services?: SessionServices): Session`

**Purpose**: Deserialize session from storage (SessionState format ONLY)

**Parameters**:
- `data`: Exported session data (SessionState format only)
- `services`: Optional SessionServices

**Returns**: Reconstructed Session instance

**Preconditions**:
- `data.state` must exist and be valid SessionStateExport
- NO legacy format support

**Postconditions**:
- ✅ SessionState restored from data.state
- ✅ Runtime state initialized fresh (not from data)

**Contract Test**: Export session A, import to session B, verify history matches

---

## Metadata

### `getMetadata(): {conversationId, messageCount, startTime, currentModel}`

**Purpose**: Get session metadata

**Returns**: Object with session info

**Contract Test**: Verify all fields present and correct types

---

### `getSessionId(): string`

**Purpose**: Get session identifier

**Returns**: conversationId string

**Contract Test**: Verify ID format matches `conv_{uuid}`

---

### `isEmpty(): boolean`

**Purpose**: Check if session has no history

**Returns**: true if history empty, false otherwise

**Contract Test**: New session is empty, session with message is not empty

---

## Error Handling

### `addError(error: string, context?: any): void`

**Purpose**: Record an error that occurred during session

**Parameters**:
- `error`: Error message string
- `context`: Optional error context

**Postconditions**:
- ✅ Error added to errorHistory (Session field, not persisted)

**Contract Test**: Add error, verify tracking (implementation detail)

---

### `requestInterrupt(): void`

**Purpose**: Request turn interruption

**Postconditions**:
- ✅ `isInterruptRequested()` returns true

**Contract Test**: Request interrupt, verify flag set

---

### `isInterruptRequested(): boolean`

**Purpose**: Check if interrupt requested

**Returns**: true if requested, false otherwise

**Contract Test**: Initially false, true after request, false after clear

---

### `clearInterrupt(): void`

**Purpose**: Clear interrupt flag

**Postconditions**:
- ✅ `isInterruptRequested()` returns false

**Contract Test**: Request, clear, verify false

---

## Tool Usage Tracking

### `trackToolUsage(toolName: string): void`

**Purpose**: Record a tool invocation

**Parameters**:
- `toolName`: Tool identifier

**Postconditions**:
- ✅ Tool usage counter incremented (Session field)

**Contract Test**: Track tool, verify count increased (implementation detail)

---

## Session Lifecycle

### `async initialize(): Promise<void>`

**Purpose**: Initialize session with storage and services

**Postconditions**:
- ✅ Services created if not provided
- ✅ Session ready for use

**Contract Test**: Initialize, verify no errors

---

### `async initializeSession(mode: 'create'|'resume', conversationId: string, config?: AgentConfig): Promise<void>`

**Purpose**: Initialize with RolloutRecorder

**Parameters**:
- `mode`: 'create' for new rollout, 'resume' for existing
- `conversationId`: Conversation identifier
- `config`: Optional AgentConfig

**Postconditions**:
- ✅ RolloutRecorder created/resumed
- ✅ History reconstructed if resuming

**Contract Test**: Create session, verify rollout initialized

---

### `async reset(): Promise<void>`

**Purpose**: Reset session to initial state (new conversation)

**Postconditions**:
- ✅ History cleared
- ✅ New conversationId generated
- ✅ Runtime state reset

**Contract Test**: Add data, reset, verify clean state

---

### `async close(): Promise<void>`

**Purpose**: Close session and cleanup resources

**Postconditions**:
- ✅ Conversation marked inactive (if persistent)
- ✅ Storage closed

**Contract Test**: Create session, close, verify cleanup

---

### `async shutdown(): Promise<void>`

**Purpose**: Graceful shutdown, flush pending data

**Postconditions**:
- ✅ RolloutRecorder flushed if exists

**Contract Test**: Make changes, shutdown, verify data flushed

---

## Breaking Change Policy

**CRITICAL**: The following changes are **NOT ALLOWED** in this refactoring:

❌ Removing any public method
❌ Changing method signatures (parameters or return types)
❌ Changing method behavior for valid inputs
❌ Breaking existing tests

✅ **Allowed changes**:
- Internal implementation (State → SessionState migration)
- Private field additions/removals
- Performance improvements
- Bug fixes that don't break valid use cases

---

## Test Coverage Requirements

Each contract item MUST have:
1. ✅ At least one passing test verifying the contract
2. ✅ Edge case tests (empty inputs, boundary conditions)
3. ✅ Integration test verifying behavior in realistic scenario

**Test Files**:
- `Session.integration.test.ts` - End-to-end contract tests
- `Persistence.integration.test.ts` - Export/import contract tests
- Individual method tests in unit test files
