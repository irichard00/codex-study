# Contract: RolloutRecorder Class API

**Version**: 1.0.0
**Date**: 2025-10-01
**Status**: Draft

## Overview

The `RolloutRecorder` class provides the primary interface for persisting agent conversation rollouts to IndexedDB. This contract defines the behavior, error handling, and guarantees for all public methods.

---

## Class: RolloutRecorder

### Constructor

```typescript
constructor(params: RolloutRecorderParams, config?: IAgentConfigWithStorage): Promise<RolloutRecorder>
```

**Description**: Creates a new RolloutRecorder instance, either creating a new rollout or resuming an existing one.

**Parameters**:
- `params`: RolloutRecorderParams
  - For new rollout: `{ type: 'create', conversationId: string, instructions?: string }`
  - For resume: `{ type: 'resume', rolloutId: string }`
- `config`: IAgentConfigWithStorage (optional)
  - Configuration for rollout TTL and storage settings
  - If not provided, uses default 60-day TTL

**Returns**: `Promise<RolloutRecorder>`

**Behavior**:

1. **Create Mode** (`type: 'create'`):
   - Opens/creates IndexedDB database "CodexRollouts"
   - Creates new record in `rollouts` object store
   - Calculates `expiresAt` from config (default: 60 days, or 'permanent')
   - Generates SessionMeta with provided conversationId
   - Writes SessionMeta as first rollout item (sequence: 0)
   - Initializes RolloutWriter for async writes
   - Returns RolloutRecorder instance

2. **Resume Mode** (`type: 'resume'`):
   - Opens IndexedDB database "CodexRollouts"
   - Verifies rollout exists in `rollouts` object store
   - Loads last sequence number from `rollout_items`
   - Initializes RolloutWriter to append from last sequence
   - Returns RolloutRecorder instance

**Errors**:
- Throws `Error("Database not available")` if IndexedDB is not supported
- Throws `Error("Rollout not found: {rolloutId}")` if resume rolloutId doesn't exist
- Throws `Error("Database open failed: {reason}")` if IDB open fails
- Throws `Error("Invalid conversation ID")` if conversationId is not a valid UUID

**Guarantees**:
- Constructor is async and must be awaited
- Once resolved, instance is ready for immediate use
- Database connection remains open until `shutdown()` called
- SessionMeta is persisted before constructor resolves (create mode)

**Example**:
```typescript
// Create new rollout
const recorder = await new RolloutRecorder({
  type: 'create',
  conversationId: '5973b6c0-94b8-487b-a530-2aeb6098ae0e',
  instructions: 'Help me debug this code'
});

// Resume existing rollout
const resumed = await new RolloutRecorder({
  type: 'resume',
  rolloutId: '5973b6c0-94b8-487b-a530-2aeb6098ae0e'
});
```

---

### recordItems()

```typescript
recordItems(items: RolloutItem[]): Promise<void>
```

**Description**: Records rollout items to IndexedDB after filtering by persistence policy.

**Parameters**:
- `items`: RolloutItem[] - Array of rollout items to persist

**Returns**: `Promise<void>`

**Behavior**:
1. Filters items using `isPersistedRolloutItem()` policy
2. Assigns sequential sequence numbers
3. Enqueues write operation to RolloutWriter
4. Returns immediately (async batching)
5. Updates `itemCount` in rollouts metadata
6. Updates `updated` timestamp in rollouts metadata

**Filtering Policy** (matches Rust behavior):
- `SessionMeta`: Always persisted
- `ResponseItem`: Filtered by type (see rolloutPolicy.ts)
- `Compacted`: Always persisted
- `TurnContext`: Always persisted
- `EventMsg`: Filtered by type (see rolloutPolicy.ts)

**Errors**:
- Throws `Error("Database not initialized")` if called before constructor resolved
- Throws `Error("Write failed: {reason}")` if IndexedDB write fails
- Throws `Error("Invalid item format")` if item doesn't match RolloutItem schema

**Guarantees**:
- Items are persisted in the order provided
- Sequence numbers are contiguous (no gaps)
- Write is asynchronous but ordered (FIFO)
- Empty arrays are no-op (returns immediately)
- Filtered items don't consume sequence numbers

**Performance**:
- Target: <50ms for batch of 10 items
- Batches multiple items into single IndexedDB transaction
- Non-blocking (returns before write completes)

**Example**:
```typescript
await recorder.recordItems([
  {
    type: 'response_item',
    payload: { type: 'message', content: 'Hello' }
  },
  {
    type: 'response_item',
    payload: { type: 'function_call', name: 'search', args: {} }
  }
]);
```

---

### flush()

```typescript
flush(): Promise<void>
```

**Description**: Ensures all pending writes are committed to IndexedDB.

**Parameters**: None

**Returns**: `Promise<void>`

**Behavior**:
1. Waits for all queued write operations to complete
2. Ensures IndexedDB transaction.oncomplete fires
3. Resolves when all writes are committed to disk

**Errors**:
- Throws `Error("Flush failed: {reason}")` if any pending write fails
- Throws `Error("Database not initialized")` if called before constructor resolved

**Guarantees**:
- After flush() resolves, all prior recordItems() calls are persisted
- Safe to call multiple times concurrently (idempotent)
- No data loss if process terminates after flush() resolves

**Use Cases**:
- Before critical operations (e.g., navigation away)
- Before exporting rollout data
- Before shutdown
- When guaranteed persistence is required

**Performance**:
- Target: <100ms for typical batch
- Depends on pending write queue size

**Example**:
```typescript
await recorder.recordItems([...]);
await recorder.recordItems([...]);
await recorder.flush(); // Ensures both writes are committed
```

---

### getRolloutId()

```typescript
getRolloutId(): ConversationId
```

**Description**: Returns the conversation ID for this rollout.

**Parameters**: None

**Returns**: `ConversationId` (string UUID)

**Behavior**:
- Returns the UUID assigned at creation or resume
- Synchronous operation (no IndexedDB access)

**Errors**: None (cannot fail)

**Guarantees**:
- Returns same value across entire instance lifetime
- Value matches `rollouts.id` in IndexedDB

**Example**:
```typescript
const id = recorder.getRolloutId();
console.log(id); // "5973b6c0-94b8-487b-a530-2aeb6098ae0e"
```

---

### shutdown()

```typescript
shutdown(): Promise<void>
```

**Description**: Flushes pending writes and closes database connection.

**Parameters**: None

**Returns**: `Promise<void>`

**Behavior**:
1. Calls flush() to commit pending writes
2. Closes IndexedDB database connection
3. Cleans up resources (writer, timers)
4. Instance becomes unusable after shutdown

**Errors**:
- Throws `Error("Shutdown failed: {reason}")` if flush fails
- Never throws after flush succeeds (cleanup is best-effort)

**Guarantees**:
- All pending writes committed before close
- Database connection released
- Cannot call recordItems() after shutdown
- Can be called multiple times (idempotent after first call)

**Example**:
```typescript
await recorder.shutdown();
// recorder is now unusable
```

---

### cleanupExpired()

```typescript
static cleanupExpired(): Promise<number>
```

**Description**: Removes all expired rollouts from IndexedDB based on their `expiresAt` timestamp.

**Parameters**: None

**Returns**: `Promise<number>` - Count of rollouts deleted

**Behavior**:
1. Opens IndexedDB readwrite transaction
2. Queries `rollouts` store via `expiresAt` index
3. Deletes all records where `expiresAt < Date.now()`
4. Cascades delete to `rollout_items` for each deleted rollout
5. Returns count of deleted rollouts

**Errors**:
- Throws `Error("Cleanup failed: {reason}")` if IndexedDB operation fails
- Never throws if no expired rollouts found (returns 0)

**Guarantees**:
- All rollouts with `expiresAt < now` are deleted
- Permanent rollouts (`expiresAt = undefined`) are never deleted
- Atomic operation (all or nothing)

**Performance**:
- Target: <500ms for 100 expired rollouts
- Uses `expiresAt` index for efficient querying

**Use Cases**:
- Periodic background cleanup (Chrome alarms)
- Before listing conversations (lazy cleanup)
- Manual cleanup via settings UI

**Example**:
```typescript
// Cleanup expired rollouts
const deletedCount = await RolloutRecorder.cleanupExpired();
console.log(`Deleted ${deletedCount} expired rollouts`);
```

---

## Static Methods

### listConversations()

```typescript
static listConversations(
  pageSize: number,
  cursor?: Cursor
): Promise<ConversationsPage>
```

**Description**: Lists all rollouts with cursor-based pagination.

**Parameters**:
- `pageSize`: number - Number of items per page (1-100)
- `cursor`: Cursor (optional) - Resume from previous page

**Returns**: `Promise<ConversationsPage>`
```typescript
interface ConversationsPage {
  items: ConversationItem[];
  nextCursor?: Cursor;
  numScanned: number;
  reachedCap: boolean;
}
```

**Behavior**:
1. Opens IndexedDB readonly transaction
2. Queries `rollouts` object store
3. Sorts by `updated` timestamp (descending)
4. Returns up to `pageSize` items
5. Generates `nextCursor` for pagination
6. Caps scan at 100 records per call

**Filtering**:
- Only includes rollouts with SessionMeta
- Only includes rollouts with at least one user event
- Status filtering: includes 'active' and 'archived'

**Cursor Format**:
- Encodes last item's timestamp + ID
- Opaque token (internal format may change)
- Stable across calls (deterministic)

**Errors**:
- Throws `Error("Invalid page size")` if pageSize < 1 or > 100
- Throws `Error("Invalid cursor")` if cursor format is invalid
- Throws `Error("Database not available")` if IndexedDB fails

**Guarantees**:
- Results ordered by most recently updated first
- Stable pagination (same cursor returns same results)
- No duplicates across pages
- No missing items (unless deleted between calls)

**Performance**:
- Target: <200ms for page of 50 items
- Uses IndexedDB indexes (no full table scan)

**Example**:
```typescript
// First page
const page1 = await RolloutRecorder.listConversations(20);
console.log(page1.items); // First 20 conversations
console.log(page1.nextCursor); // { timestamp: ..., id: ... }

// Next page
if (page1.nextCursor) {
  const page2 = await RolloutRecorder.listConversations(20, page1.nextCursor);
  console.log(page2.items); // Next 20 conversations
}
```

---

### getRolloutHistory()

```typescript
static getRolloutHistory(rolloutId: ConversationId): Promise<InitialHistory>
```

**Description**: Loads complete conversation history from IndexedDB.

**Parameters**:
- `rolloutId`: ConversationId - UUID of conversation to load

**Returns**: `Promise<InitialHistory>`
```typescript
type InitialHistory =
  | { type: 'new' }
  | { type: 'resumed'; payload: ResumedHistory };

interface ResumedHistory {
  conversationId: ConversationId;
  history: RolloutItem[];
  rolloutId: string;
}
```

**Behavior**:
1. Opens IndexedDB readonly transaction
2. Verifies rollout exists in `rollouts` store
3. Queries `rollout_items` by rolloutId
4. Orders by sequence number
5. Parses each item into RolloutItem type
6. Returns full history array

**Errors**:
- Returns `{ type: 'new' }` if rolloutId not found
- Throws `Error("Corrupted rollout: {reason}")` if parse fails
- Throws `Error("Database not available")` if IndexedDB fails

**Guarantees**:
- Items returned in chronological order (by sequence)
- All items included (no filtering)
- SessionMeta is first item (sequence 0)
- Empty rollout returns `{ type: 'new' }`

**Performance**:
- Target: <200ms for 1000 items
- Scales linearly with item count
- Uses compound index [rolloutId, sequence]

**Example**:
```typescript
const history = await RolloutRecorder.getRolloutHistory('5973b6c0-...');

if (history.type === 'resumed') {
  console.log(history.payload.conversationId);
  console.log(history.payload.history.length); // Total items
  console.log(history.payload.history[0]); // SessionMeta
}
```

---

## Error Handling

### Error Categories

1. **Validation Errors** (thrown synchronously):
   - Invalid UUID format
   - Invalid page size
   - Malformed cursor

2. **Database Errors** (thrown from async operations):
   - Database not available
   - Database open failed
   - Write failed
   - Read failed

3. **Data Errors** (thrown during operations):
   - Rollout not found
   - Corrupted rollout data
   - Invalid item format

### Error Response Format

All errors include:
- Clear error message
- Error type/category
- Original error cause (when applicable)

```typescript
try {
  await recorder.recordItems([...]);
} catch (error) {
  if (error.message.includes('Database not initialized')) {
    // Handle initialization error
  } else if (error.message.includes('Write failed')) {
    // Handle write error
  }
}
```

---

## Thread Safety & Concurrency

- IndexedDB transactions provide atomicity
- Write queue serializes all writes (FIFO order)
- Multiple RolloutRecorder instances can coexist
- Concurrent writes to different rollouts are safe
- Concurrent writes to same rollout from different instances may interleave

**Best Practice**: Single RolloutRecorder instance per conversation.

---

## Versioning

**Database Version**: 1
**Schema Version**: 1.0.0

**Migration Strategy**:
- Version bumps trigger onupgradeneeded
- Backward compatible reads
- Forward compatible writes (ignore unknown fields)

---

## Testing Requirements

### Unit Tests

- ✅ Constructor creates new rollout
- ✅ Constructor resumes existing rollout
- ✅ recordItems persists to IndexedDB
- ✅ recordItems filters by policy
- ✅ flush waits for all writes
- ✅ listConversations returns paginated results
- ✅ getRolloutHistory loads complete history
- ✅ shutdown closes database

### Integration Tests

- ✅ Create → record → flush → resume cycle
- ✅ Pagination across multiple pages
- ✅ Concurrent recorder instances
- ✅ Large rollout (10,000+ items)

### Error Tests

- ✅ Invalid conversation ID rejected
- ✅ Missing rollout throws error
- ✅ Database unavailable handled gracefully

---

## Performance Benchmarks

| Operation | Target | Measured |
|-----------|--------|----------|
| Constructor (create) | <100ms | TBD |
| Constructor (resume) | <100ms | TBD |
| recordItems (10 items) | <50ms | TBD |
| flush() | <100ms | TBD |
| listConversations (50 items) | <200ms | TBD |
| getRolloutHistory (1000 items) | <200ms | TBD |

---

## References

1. Rust implementation: `codex-rs/core/src/rollout/recorder.rs`
2. Data model: `../data-model.md`
3. IndexedDB API: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

**Contract Status**: Draft - Ready for implementation and testing
