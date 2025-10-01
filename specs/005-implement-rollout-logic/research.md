# Research: Rollout Recorder Rust → TypeScript Conversion

**Date**: 2025-10-01
**Context**: Converting `codex-rs/core/src/rollout/recorder.rs` to `codex-chrome/src/storage/RolloutRecorder.ts`

## Executive Summary

The RolloutRecorder is a session persistence system that records agent conversation rollouts to enable replay and inspection. The Rust version uses file-based JSONL storage with async I/O via tokio. The TypeScript version will use IndexedDB with Promise-based async, preserving all method names, type names, and JSON structures for cross-version compatibility.

## Research Findings

### 1. Rust → TypeScript Type Mapping

**Decision**: Direct structural mapping with TypeScript equivalents

**Rust Source Analysis** (`codex-rs/core/src/rollout/recorder.rs` + `codex-rs/protocol/src/protocol.rs`):

```rust
// Rust structs → TypeScript interfaces/types
pub struct RolloutRecorder {
    tx: Sender<RolloutCmd>,
    pub(crate) rollout_path: PathBuf,
}

pub enum RolloutRecorderParams {
    Create { conversation_id: ConversationId, instructions: Option<String> },
    Resume { path: PathBuf },
}

pub struct SessionMeta {
    pub id: ConversationId,        // UUID string
    pub timestamp: String,         // ISO 8601
    pub cwd: PathBuf,             // string in TS
    pub originator: String,
    pub cli_version: String,
    pub instructions: Option<String>,
}

pub struct SessionMetaLine {
    #[serde(flatten)]
    pub meta: SessionMeta,
    pub git: Option<GitInfo>,
}

pub struct RolloutLine {
    pub timestamp: String,        // ISO 8601
    #[serde(flatten)]
    pub item: RolloutItem,
}

pub enum RolloutItem {
    SessionMeta(SessionMetaLine),
    ResponseItem(ResponseItem),
    Compacted(CompactedItem),
    TurnContext(TurnContextItem),
    EventMsg(EventMsg),
}
```

**TypeScript Mapping**:

```typescript
// TypeScript equivalents

export class RolloutRecorder {
  private writer: RolloutWriter;
  private rolloutId: string; // IDB database ID

  constructor(params: RolloutRecorderParams) { }
}

export type RolloutRecorderParams =
  | { type: 'create'; conversationId: ConversationId; instructions?: string }
  | { type: 'resume'; rolloutId: string };

export interface SessionMeta {
  id: ConversationId;      // string (UUID)
  timestamp: string;       // ISO 8601
  cwd: string;            // path as string
  originator: string;
  cliVersion: string;
  instructions?: string;
}

export interface SessionMetaLine extends SessionMeta {
  git?: GitInfo;
}

export interface RolloutLine {
  timestamp: string;
  type: 'session_meta' | 'response_item' | 'compacted' | 'turn_context' | 'event_msg';
  payload: RolloutItem;
}

export type RolloutItem =
  | { type: 'session_meta'; payload: SessionMetaLine }
  | { type: 'response_item'; payload: ResponseItem }
  | { type: 'compacted'; payload: CompactedItem }
  | { type: 'turn_context'; payload: TurnContextItem }
  | { type: 'event_msg'; payload: EventMsg };
```

**Rationale**:
- Rust enums with data → TypeScript discriminated unions (tagged with `type` field)
- Rust `Option<T>` → TypeScript `T | undefined` or optional properties (`?`)
- Rust `PathBuf` → TypeScript `string`
- Rust `serde(flatten)` → TypeScript interface extension (`extends`)
- Preserve exact JSON structure for cross-version compatibility

**Alternatives Considered**:
- Class-based approach for enums → rejected (less idiomatic TypeScript, harder to serialize)
- String literal unions without payloads → rejected (loses type information)

---

### 2. File-based JSONL → IndexedDB Schema

**Decision**: IndexedDB with three object stores: `rollouts`, `rollout_items`, `rollout_metadata`

**Rust JSONL Format** (analyzed from `recorder.rs:332-407`):

```
File: ~/.codex/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl

Line 1: {"timestamp":"2025-10-01T12:00:00.000Z","type":"session_meta","payload":{...}}
Line 2: {"timestamp":"2025-10-01T12:00:01.123Z","type":"response_item","payload":{...}}
Line 3: {"timestamp":"2025-10-01T12:00:02.456Z","type":"response_item","payload":{...}}
...
```

**IndexedDB Schema**:

```typescript
// Database: CodexRollouts, version 1

// Store 1: rollouts (metadata for each conversation)
interface RolloutMetadataRecord {
  id: string;              // Primary key: conversation UUID
  created: number;         // Timestamp
  updated: number;         // Timestamp
  sessionMeta: SessionMetaLine;
  itemCount: number;
  status: 'active' | 'archived';
}
// Indexes: created, updated, status

// Store 2: rollout_items (individual rollout entries)
interface RolloutItemRecord {
  id: string;              // Primary key: auto-generated
  rolloutId: string;       // Foreign key to rollouts.id
  timestamp: string;       // ISO 8601
  sequence: number;        // Order within rollout (0, 1, 2, ...)
  type: string;            // 'session_meta' | 'response_item' | etc.
  payload: any;            // The actual item data
}
// Indexes: rolloutId, timestamp, [rolloutId, sequence]

// Store 3: rollout_export_cache (for JSONL export compatibility)
interface ExportCacheRecord {
  rolloutId: string;       // Primary key
  jsonl: string;          // Full JSONL export
  lastExported: number;
}
```

**Rationale**:
- `rollouts` store: Fast lookup of conversation metadata, supports listing/filtering
- `rollout_items` store: Stores individual rollout lines, indexed for efficient range queries
- `rollout_export_cache`: Optional cache for JSONL exports (regenerated on demand)
- Sequence number ensures ordering within a conversation
- Compound index `[rolloutId, sequence]` enables efficient chronological retrieval

**Migration from JSONL** (for import feature):
1. Parse JSONL file line-by-line
2. Extract `SessionMeta` from first line → create `rollouts` record
3. Parse remaining lines → create `rollout_items` records with sequence numbers
4. Store original JSONL in export cache (optional)

**Alternatives Considered**:
- Single object store with nested arrays → rejected (poor query performance for large rollouts)
- Store JSONL as blob → rejected (no indexing, can't query individual items)
- One IndexedDB database per conversation → rejected (Chrome has DB limits, harder to manage)

---

### 3. Async Pattern Conversion: tokio → Promises

**Decision**: Replace tokio channels with Promise-based async queue

**Rust Pattern** (from `recorder.rs:145-157`):

```rust
// Rust: Multi-producer, single-consumer channel
let (tx, rx) = mpsc::channel::<RolloutCmd>(256);

// Spawn background task
tokio::task::spawn(rollout_writer(file, rx, meta, cwd));

// Send commands to writer
self.tx.send(RolloutCmd::AddItems(items)).await
```

**TypeScript Pattern**:

```typescript
// TypeScript: Promise-based async queue

export class RolloutWriter {
  private db: IDBDatabase;
  private writeQueue: Promise<void> = Promise.resolve();
  private pendingWrites: RolloutItemRecord[] = [];
  private batchTimeout: number | null = null;

  async addItems(items: RolloutItem[]): Promise<void> {
    // Enqueue write operation
    this.writeQueue = this.writeQueue.then(() => this.batchWrite(items));
    return this.writeQueue;
  }

  private async batchWrite(items: RolloutItem[]): Promise<void> {
    // Batch multiple writes into single transaction
    const transaction = this.db.transaction(['rollout_items'], 'readwrite');
    const store = transaction.objectStore('rollout_items');

    for (const item of items) {
      store.add(item);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async flush(): Promise<void> {
    // Wait for all pending writes
    return this.writeQueue;
  }
}
```

**Rationale**:
- JavaScript is single-threaded → no need for multi-threaded concurrency
- Promise chaining serializes writes (preserves order)
- IndexedDB transactions handle concurrency/atomicity
- Batching improves performance (write multiple items in one transaction)

**Key Differences**:
- Rust: Explicit task spawning with channels
- TypeScript: Promise chains with sequential execution
- Rust: Bounded channel (backpressure via buffer)
- TypeScript: Unbounded queue (memory-based backpressure from IndexedDB)

**Alternatives Considered**:
- Web Workers for background writing → rejected (unnecessary complexity, IPC overhead)
- Async iterators/generators → rejected (less familiar pattern, harder to reason about)
- Event emitters → rejected (harder to track completion, error handling)

---

### 4. Conversation Listing & Pagination

**Decision**: Cursor-based pagination with IndexedDB range queries

**Rust Implementation** (from `list.rs:88-202`):

```rust
pub struct Cursor {
    ts: OffsetDateTime,
    id: Uuid,
}

pub struct ConversationsPage {
    pub items: Vec<ConversationItem>,
    pub next_cursor: Option<Cursor>,
    pub num_scanned_files: usize,
    pub reached_scan_cap: bool,
}

// Pagination algorithm:
// 1. Sort by (timestamp DESC, uuid DESC)
// 2. Cursor encodes last item: "2025-10-01T12:00:00|uuid"
// 3. Resume by seeking past cursor position
// 4. Cap at MAX_SCAN_FILES to bound work
```

**TypeScript Implementation**:

```typescript
export interface Cursor {
  timestamp: number;  // Unix timestamp
  id: string;        // UUID
}

export interface ConversationsPage {
  items: ConversationItem[];
  nextCursor?: Cursor;
  numScanned: number;
  reachedCap: boolean;
}

export class ConversationListing {
  private db: IDBDatabase;
  private readonly MAX_SCAN = 100;

  async listConversations(
    pageSize: number,
    cursor?: Cursor
  ): Promise<ConversationsPage> {
    const store = this.db
      .transaction(['rollouts'], 'readonly')
      .objectStore('rollouts');

    const index = store.index('updated'); // Sorted by updated timestamp

    // Build range query
    const range = cursor
      ? IDBKeyRange.upperBound([cursor.timestamp, cursor.id], true)
      : undefined;

    const items: ConversationItem[] = [];
    let numScanned = 0;

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range, 'prev'); // Descending order

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (!cursor || items.length >= pageSize || numScanned >= this.MAX_SCAN) {
          resolve({
            items,
            nextCursor: this.buildNextCursor(items),
            numScanned,
            reachedCap: numScanned >= this.MAX_SCAN
          });
          return;
        }

        items.push(this.convertToConversationItem(cursor.value));
        numScanned++;
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private buildNextCursor(items: ConversationItem[]): Cursor | undefined {
    if (items.length === 0) return undefined;
    const last = items[items.length - 1];
    return { timestamp: last.updated, id: last.id };
  }
}
```

**Cursor Format**:
- Rust: `"2025-10-01T12:00:00|uuid"` (ISO string + UUID)
- TypeScript: `{ timestamp: 1696176000000, id: "uuid" }` (object, serializable to JSON)
- Both: Opaque token, stable across requests

**Performance Characteristics**:
- Rust: File system traversal O(N files), bounded by MAX_SCAN_FILES
- TypeScript: IndexedDB cursor iteration O(N records), bounded by MAX_SCAN
- Both: Resumable pagination for large datasets
- Both: Stable ordering (timestamp DESC, then ID DESC for ties)

**Alternatives Considered**:
- Offset-based pagination (`LIMIT/OFFSET`) → rejected (unstable under concurrent writes)
- Keyset pagination without cursor → rejected (harder to encode/decode, less opaque)
- Load all conversations into memory → rejected (doesn't scale)

---

### 5. JSON Serialization Compatibility

**Decision**: Use same JSON structure as Rust for export/import features

**Requirement**: Chrome extension must be able to import JSONL files created by Rust CLI and vice versa.

**Rust Serialization** (from `recorder.rs:386-407`):

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct RolloutLine {
    pub timestamp: String,
    #[serde(flatten)]
    pub item: RolloutItem,
}

// Serialized as:
{
  "timestamp": "2025-10-01T12:00:00.000Z",
  "type": "session_meta",
  "payload": { ... }
}
```

**TypeScript Serialization**:

```typescript
export interface RolloutLine {
  timestamp: string;
  type: string;
  payload: any;
}

// Serialization helper
export function serializeRolloutLine(line: RolloutLine): string {
  return JSON.stringify({
    timestamp: line.timestamp,
    type: line.type,
    payload: line.payload
  });
}

// Deserialization helper
export function deserializeRolloutLine(json: string): RolloutLine {
  const obj = JSON.parse(json);
  return {
    timestamp: obj.timestamp,
    type: obj.type,
    payload: obj.payload
  };
}
```

**Validation**:
- Timestamp format: ISO 8601 with milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- Type field: Must match enum discriminator
- Payload: Must conform to type-specific schema

**Export Feature**:
```typescript
async exportToJsonl(rolloutId: string): Promise<string> {
  const items = await this.getRolloutItems(rolloutId);
  return items.map(item => serializeRolloutLine(item)).join('\n');
}
```

**Import Feature**:
```typescript
async importFromJsonl(jsonl: string): Promise<string> {
  const lines = jsonl.split('\n').filter(l => l.trim());
  const items = lines.map(line => deserializeRolloutLine(line));
  return await this.createRolloutFromItems(items);
}
```

---

---

### 6. TTL Configuration & Automatic Cleanup

**Decision**: Configurable TTL with automatic cleanup, default 60 days

**Requirement**: IndexedDB rollouts should have a default 60-day expiration, configurable via AgentConfig.ts

**IndexedDB Schema Extension**:

```typescript
interface RolloutMetadataRecord {
  id: ConversationId;
  created: number;         // Unix timestamp
  updated: number;
  expiresAt?: number;      // Unix timestamp (undefined = permanent)
  sessionMeta: SessionMetaLine;
  itemCount: number;
  status: 'active' | 'archived' | 'expired';
}
```

**AgentConfig Integration**:

```typescript
// codex-chrome/src/config/types.ts
interface IAgentConfig {
  // ... existing fields ...
  storage?: {
    rolloutTTL?: number | 'permanent';  // TTL in days, or 'permanent'
  };
}

// Default configuration
const DEFAULT_CONFIG: IAgentConfig = {
  storage: {
    rolloutTTL: 60  // 60 days default
  }
};
```

**Expiration Calculation**:

```typescript
function calculateExpiresAt(config: IAgentConfig): number | undefined {
  const ttl = config.storage?.rolloutTTL;

  if (ttl === 'permanent' || ttl === undefined) {
    return undefined; // No expiration
  }

  const days = typeof ttl === 'number' ? ttl : 60;
  const milliseconds = days * 24 * 60 * 60 * 1000;
  return Date.now() + milliseconds;
}
```

**Cleanup Strategy**:

1. **On-demand cleanup** (when listConversations called):
   ```typescript
   async function cleanupExpiredRollouts(): Promise<number> {
     const now = Date.now();
     const store = db.transaction(['rollouts'], 'readwrite').objectStore('rollouts');
     const index = store.index('expiresAt');
     const range = IDBKeyRange.upperBound(now);

     let deletedCount = 0;
     const request = index.openCursor(range);

     request.onsuccess = (event) => {
       const cursor = event.target.result;
       if (cursor) {
         cursor.delete();
         deletedCount++;
         cursor.continue();
       }
     };

     return deletedCount;
   }
   ```

2. **Background cleanup** (periodic):
   ```typescript
   // Service worker background task
   chrome.alarms.create('rollout-cleanup', { periodInMinutes: 60 });
   chrome.alarms.onAlarm.addListener(async (alarm) => {
     if (alarm.name === 'rollout-cleanup') {
       await cleanupExpiredRollouts();
     }
   });
   ```

3. **Explicit cleanup method**:
   ```typescript
   class RolloutRecorder {
     static async cleanup(olderThanDays?: number): Promise<number> {
       const cutoff = olderThanDays
         ? Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
         : Date.now();

       // Delete rollouts where expiresAt < cutoff
       // OR where updated < cutoff (for permanent rollouts)
     }
   }
   ```

**TTL Update on Access**:

- Option 1: Extend expiration on every access (sliding window)
- Option 2: Fixed expiration from creation (chosen for simplicity)

**Status Transitions**:

```
create → active → archived (manual)
                → expired (TTL reached)
```

**Integration with StorageQuotaManager**:

```typescript
// Prioritize cleanup of expired rollouts
async function optimizeStorage(): Promise<void> {
  // 1. Delete expired rollouts first
  await cleanupExpiredRollouts();

  // 2. If still low on space, archive old rollouts
  if (await shouldCleanup()) {
    await archiveOldRollouts();
  }
}
```

**Rationale**:
- Default 60 days balances storage efficiency with conversation retention
- Permanent option for critical conversations
- Automatic cleanup prevents unbounded growth
- User control via AgentConfig enables customization per user needs

**Alternatives Considered**:
- LRU eviction → rejected (TTL is more predictable for users)
- Manual-only cleanup → rejected (requires user action, storage can fill up)
- Fixed TTL (no configuration) → rejected (users need flexibility)

---

## Implementation Checklist

- [x] Type mappings documented (Rust structs/enums → TS interfaces/types)
- [x] IndexedDB schema designed (3 object stores, indexes)
- [x] Async patterns converted (tokio channels → Promise chains)
- [x] Pagination algorithm designed (cursor-based, IDB range queries)
- [x] JSON compatibility verified (same structure as Rust)
- [x] TTL configuration designed (60-day default, configurable, permanent option)
- [ ] Performance benchmarks (write latency, read latency) - deferred to testing
- [ ] Error handling patterns (Rust Result → TS Error/Promise rejection) - deferred to contracts

## References

1. Rust source: `codex-rs/core/src/rollout/recorder.rs` (lines 1-408)
2. Rust protocol: `codex-rs/protocol/src/protocol.rs` (RolloutItem, RolloutLine, SessionMeta)
3. Rust listing: `codex-rs/core/src/rollout/list.rs` (pagination, cursor)
4. Existing TS storage: `codex-chrome/src/storage/ConversationStore.ts` (IndexedDB patterns)
5. IndexedDB API: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

---

### 7. Module Organization & File Structure

**Decision**: Organize rollout code in dedicated subdirectory with modular file structure

**Requirement**: "the new rollout related code should store in codex-chrome/src/storage/rollout, which create a sub dir rollout under codex-chrome/src/storage"

**Directory Structure**:

```
codex-chrome/src/storage/rollout/
├── RolloutRecorder.ts    # Main public class
├── RolloutWriter.ts      # IndexedDB async writer
├── types.ts              # Type definitions (RolloutItem, RolloutLine, etc.)
├── policy.ts             # Persistence policy filters
├── listing.ts            # Conversation listing & pagination
├── cleanup.ts            # TTL cleanup logic
├── helpers.ts            # Utility functions (TTL calc, validation)
└── index.ts              # Public API exports
```

**Module Responsibilities**:

1. **RolloutRecorder.ts** (Main Class):
   - Public API entry point
   - Orchestrates writer, cleanup, listing
   - Constructor, recordItems, flush, shutdown
   - Static methods: listConversations, getRolloutHistory, cleanupExpired

2. **RolloutWriter.ts** (Async Writer):
   - IndexedDB transaction management
   - Write queue and batching
   - Atomic write operations
   - Internal class (not exported)

3. **types.ts** (Type Definitions):
   - All TypeScript types/interfaces
   - RolloutItem, RolloutLine, SessionMeta, etc.
   - Configuration types (RolloutStorageConfig)
   - Type guards and validators

4. **policy.ts** (Persistence Filters):
   - isPersistedRolloutItem() filtering logic
   - Matches Rust rollout/policy.rs behavior
   - Determines which items to persist

5. **listing.ts** (Pagination):
   - Conversation listing logic
   - Cursor-based pagination
   - ConversationsPage generation
   - Matches Rust rollout/list.rs

6. **cleanup.ts** (TTL Management):
   - cleanupExpired() implementation
   - Background cleanup scheduling
   - Integration with Chrome alarms
   - Storage quota integration

7. **helpers.ts** (Utilities):
   - calculateExpiresAt()
   - isExpired()
   - getDefaultTTL()
   - UUID generation
   - Timestamp formatting

8. **index.ts** (Public Exports):
   ```typescript
   // Public API
   export { RolloutRecorder } from './RolloutRecorder';
   export type {
     RolloutRecorderParams,
     RolloutItem,
     RolloutLine,
     SessionMeta,
     // ... other public types
   } from './types';
   ```

**Import Paths**:

```typescript
// External usage (from outside rollout/)
import { RolloutRecorder } from '@/storage/rollout';
import type { RolloutItem, SessionMeta } from '@/storage/rollout';

// Internal usage (within rollout/)
import { RolloutWriter } from './RolloutWriter';
import type { RolloutItem } from './types';
import { isPersistedRolloutItem } from './policy';
```

**Benefits**:
- **Modularity**: Clear separation of concerns
- **Maintainability**: Easy to locate and update specific functionality
- **Testability**: Each module can be tested independently
- **Scalability**: Easy to add new features (e.g., import/export in separate file)
- **Clean imports**: Single import path for external consumers

**Rust Parallel**:
```
codex-rs/core/src/rollout/
├── mod.rs          → index.ts (exports)
├── recorder.rs     → RolloutRecorder.ts
├── policy.rs       → policy.ts
└── list.rs         → listing.ts
```

**Alternatives Considered**:
- Single file (RolloutRecorder.ts) → rejected (too large, poor separation)
- Flat structure in storage/ → rejected (clutters main directory)
- Deeper nesting (storage/rollout/core/, storage/rollout/utils/) → rejected (over-engineering)

---

**Research Complete**: All technical unknowns resolved. Ready for Phase 1 (Design & Contracts).
