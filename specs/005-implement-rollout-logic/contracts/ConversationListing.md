# Contract: Conversation Listing & Pagination API

**Version**: 1.0.0
**Date**: 2025-10-01

## Overview

Defines the cursor-based pagination API for listing conversations, matching the Rust implementation's behavior.

## Cursor Format

```typescript
interface Cursor {
  timestamp: number;  // Unix milliseconds
  id: ConversationId; // UUID string
}
```

**Serialization**: `"timestamp|uuid"`
**Example**: `"1696176000000|5973b6c0-94b8-487b-a530-2aeb6098ae0e"`

## API: listConversations()

**Signature**: `listConversations(pageSize: number, cursor?: Cursor): Promise<ConversationsPage>`

**Pagination Algorithm**:
1. Query `rollouts` store via `updated` index (descending)
2. If cursor provided, start from IDBKeyRange.upperBound([cursor.timestamp, cursor.id], true)
3. Collect up to `pageSize` items
4. Generate next cursor from last item
5. Cap at MAX_SCAN (100) records

**Ordering**: Newest first (updated DESC, then id DESC for ties)

**Stability**: Same cursor always returns same results (deterministic)

## Response Schema

```typescript
interface ConversationsPage {
  items: ConversationItem[];
  nextCursor?: Cursor;        // undefined = end of list
  numScanned: number;
  reachedCap: boolean;        // true = more results may exist
}
```

## Performance

- Target: <200ms for 50 items
- Uses IndexedDB compound index
- No full table scans
- Bounded scan limit prevents long-running queries

## References

- Rust impl: `codex-rs/core/src/rollout/list.rs`
- IDB cursors: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor)
