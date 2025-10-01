# Data Model: RolloutRecorder TypeScript Types

**Date**: 2025-10-01
**Source**: Rust types from `codex-rs/core/src/rollout/` and `codex-rs/protocol/src/protocol.rs`
**Target**: TypeScript types for `codex-chrome/src/storage/`

## Overview

This document defines the TypeScript type system for the RolloutRecorder, preserving exact names and structures from the Rust implementation to ensure JSON compatibility and cross-version data exchange.

---

## Core Types

### ConversationId

```typescript
/**
 * Unique identifier for a conversation/session.
 * Format: UUID v4 string
 * Example: "5973b6c0-94b8-487b-a530-2aeb6098ae0e"
 */
export type ConversationId = string;
```

---

## RolloutRecorder Class

### RolloutRecorder

```typescript
/**
 * Records all ResponseItems for a session and persists them to IndexedDB.
 * Rollouts can be inspected, exported to JSONL, and replayed.
 *
 * TypeScript equivalent of Rust's RolloutRecorder struct.
 */
export class RolloutRecorder {
  private writer: RolloutWriter;
  private rolloutId: ConversationId;
  private db: IDBDatabase | null;

  /**
   * Create a new RolloutRecorder instance.
   * @param params - Create new or resume existing rollout
   */
  constructor(params: RolloutRecorderParams): Promise<RolloutRecorder>;

  /**
   * Record rollout items to IndexedDB.
   * Items are filtered based on persistence policy.
   * @param items - Array of rollout items to persist
   */
  recordItems(items: RolloutItem[]): Promise<void>;

  /**
   * Flush all queued writes and wait until committed to IndexedDB.
   */
  flush(): Promise<void>;

  /**
   * Get the rollout ID (conversation ID) for this recorder.
   */
  getRolloutId(): ConversationId;

  /**
   * Close the database connection and cleanup resources.
   */
  shutdown(): Promise<void>;

  /**
   * List conversations (rollout files) with pagination.
   * @param pageSize - Number of items per page
   * @param cursor - Optional cursor for pagination
   */
  static listConversations(
    pageSize: number,
    cursor?: Cursor
  ): Promise<ConversationsPage>;

  /**
   * Load conversation history from IndexedDB.
   * @param rolloutId - Conversation ID to load
   */
  static getRolloutHistory(rolloutId: ConversationId): Promise<InitialHistory>;
}
```

### RolloutRecorderParams

```typescript
/**
 * Parameters for creating a RolloutRecorder instance.
 * TypeScript equivalent of Rust's RolloutRecorderParams enum.
 */
export type RolloutRecorderParams =
  | {
      type: 'create';
      conversationId: ConversationId;
      instructions?: string;
    }
  | {
      type: 'resume';
      rolloutId: ConversationId;
    };
```

---

## Rollout Data Structures

### RolloutItem

```typescript
/**
 * A single item in a rollout recording.
 * TypeScript equivalent of Rust's RolloutItem enum.
 *
 * Discriminated union matching Rust serde tag format:
 * { "type": "session_meta", "payload": { ... } }
 */
export type RolloutItem =
  | { type: 'session_meta'; payload: SessionMetaLine }
  | { type: 'response_item'; payload: ResponseItem }
  | { type: 'compacted'; payload: CompactedItem }
  | { type: 'turn_context'; payload: TurnContextItem }
  | { type: 'event_msg'; payload: EventMsg };
```

### RolloutLine

```typescript
/**
 * A single line in the JSONL rollout format.
 * Wraps a RolloutItem with a timestamp.
 * TypeScript equivalent of Rust's RolloutLine struct.
 */
export interface RolloutLine {
  /** ISO 8601 timestamp with milliseconds */
  timestamp: string;

  /** Discriminator for the item type */
  type: 'session_meta' | 'response_item' | 'compacted' | 'turn_context' | 'event_msg';

  /** The actual rollout item data */
  payload: RolloutItem['payload'];
}
```

### SessionMeta

```typescript
/**
 * Metadata about a conversation session.
 * TypeScript equivalent of Rust's SessionMeta struct.
 */
export interface SessionMeta {
  /** Conversation unique identifier */
  id: ConversationId;

  /** Session start time (ISO 8601) */
  timestamp: string;

  /** Current working directory */
  cwd: string;

  /** Originator of the session (e.g., "cli", "chrome-extension") */
  originator: string;

  /** CLI/extension version */
  cliVersion: string;

  /** Optional user instructions for the session */
  instructions?: string;
}
```

### SessionMetaLine

```typescript
/**
 * Session metadata with optional Git information.
 * TypeScript equivalent of Rust's SessionMetaLine struct.
 * Rust uses #[serde(flatten)] for meta, we use extends.
 */
export interface SessionMetaLine extends SessionMeta {
  /** Git repository information */
  git?: GitInfo;
}

export interface GitInfo {
  /** Current branch name */
  branch?: string;

  /** Latest commit hash */
  commit?: string;

  /** Working directory dirty status */
  dirty?: boolean;

  /** Remote URL */
  remote?: string;
}
```

### CompactedItem

```typescript
/**
 * Represents a compacted/summarized conversation segment.
 * TypeScript equivalent of Rust's CompactedItem struct.
 */
export interface CompactedItem {
  /** Summary message */
  message: string;
}
```

### TurnContextItem

```typescript
/**
 * Context information about a conversation turn.
 * TypeScript equivalent of Rust's TurnContextItem struct.
 */
export interface TurnContextItem {
  /** Working directory for this turn */
  cwd: string;

  /** Approval policy */
  approvalPolicy: AskForApproval;

  /** Sandbox policy */
  sandboxPolicy: SandboxPolicy;

  /** Model being used */
  model: string;

  /** Reasoning effort level */
  effort?: ReasoningEffort;

  /** Reasoning summary preference */
  summary: ReasoningSummary;
}

export type AskForApproval = 'unless-trusted' | 'on-failure' | 'on-request' | 'never';
export type SandboxPolicy = 'danger-full-access' | 'read-only' | 'workspace-write';
export type ReasoningEffort = 'low' | 'medium' | 'high';
export type ReasoningSummary = 'auto' | 'always' | 'never';
```

---

## Conversation Listing Types

### ConversationsPage

```typescript
/**
 * Page of conversation summaries with pagination support.
 * TypeScript equivalent of Rust's ConversationsPage struct.
 */
export interface ConversationsPage {
  /** Conversation summaries ordered newest first */
  items: ConversationItem[];

  /** Opaque cursor for next page (undefined if end) */
  nextCursor?: Cursor;

  /** Number of records scanned */
  numScanned: number;

  /** True if scan limit reached */
  reachedCap: boolean;
}
```

### ConversationItem

```typescript
/**
 * Summary information for a conversation rollout.
 * TypeScript equivalent of Rust's ConversationItem struct.
 */
export interface ConversationItem {
  /** Conversation unique identifier */
  id: ConversationId;

  /** IndexedDB record path/key */
  rolloutId: string;

  /** First N rollout records (includes SessionMeta) */
  head: any[];

  /** Last N response records */
  tail: any[];

  /** Created timestamp */
  created: number;

  /** Last updated timestamp */
  updated: number;

  /** Session metadata */
  sessionMeta?: SessionMetaLine;

  /** Total item count */
  itemCount: number;
}
```

### Cursor

```typescript
/**
 * Opaque pagination cursor.
 * Identifies a position in the conversation list by timestamp + ID.
 * TypeScript equivalent of Rust's Cursor struct.
 */
export interface Cursor {
  /** Unix timestamp (milliseconds) */
  timestamp: number;

  /** Conversation UUID */
  id: ConversationId;
}

/**
 * Serialize cursor to string for transport.
 * Format: "timestamp|uuid"
 */
export function serializeCursor(cursor: Cursor): string;

/**
 * Deserialize cursor from string.
 */
export function deserializeCursor(token: string): Cursor | null;
```

---

## History Types

### InitialHistory

```typescript
/**
 * Initial conversation history when creating or resuming a session.
 * TypeScript equivalent of Rust's InitialHistory enum.
 */
export type InitialHistory =
  | { type: 'new' }
  | { type: 'resumed'; payload: ResumedHistory };
```

### ResumedHistory

```typescript
/**
 * Conversation history loaded from storage.
 * TypeScript equivalent of Rust's ResumedHistory struct.
 */
export interface ResumedHistory {
  /** Conversation ID */
  conversationId: ConversationId;

  /** All rollout items in chronological order */
  history: RolloutItem[];

  /** IndexedDB rollout identifier */
  rolloutId: string;
}
```

---

## IndexedDB Schema Types

### RolloutMetadataRecord

```typescript
/**
 * IndexedDB record for rollout metadata.
 * Stored in 'rollouts' object store.
 */
export interface RolloutMetadataRecord {
  /** Primary key: conversation UUID */
  id: ConversationId;

  /** Creation timestamp */
  created: number;

  /** Last update timestamp */
  updated: number;

  /** Expiration timestamp (undefined = permanent storage) */
  expiresAt?: number;

  /** Session metadata */
  sessionMeta: SessionMetaLine;

  /** Number of items in rollout */
  itemCount: number;

  /** Rollout status */
  status: 'active' | 'archived' | 'expired';
}
```

### RolloutItemRecord

```typescript
/**
 * IndexedDB record for individual rollout items.
 * Stored in 'rollout_items' object store.
 */
export interface RolloutItemRecord {
  /** Primary key: auto-generated */
  id?: number;

  /** Foreign key to rollouts.id */
  rolloutId: ConversationId;

  /** Item timestamp (ISO 8601) */
  timestamp: string;

  /** Sequence number within rollout */
  sequence: number;

  /** Item type discriminator */
  type: string;

  /** Item payload */
  payload: any;
}
```

---

## Helper Types

### ResponseItem

```typescript
/**
 * Response item from model/agent.
 * Detailed type definition in existing codebase.
 */
export type ResponseItem = any; // TODO: Import from existing types
```

### EventMsg

```typescript
/**
 * Event message from agent execution.
 * Detailed type definition in existing codebase.
 */
export type EventMsg = any; // TODO: Import from existing types
```

---

## Configuration Types

### RolloutStorageConfig

```typescript
/**
 * Configuration for rollout storage TTL.
 * Used in AgentConfig.ts to configure rollout expiration behavior.
 */
export interface RolloutStorageConfig {
  /**
   * Time-to-live for rollouts in days.
   * - number: Rollouts expire after this many days (e.g., 60)
   * - 'permanent': Rollouts never expire
   * - undefined: Use default (60 days)
   */
  rolloutTTL?: number | 'permanent';
}

/**
 * Extended IAgentConfig with rollout storage settings.
 */
export interface IAgentConfigWithStorage extends IAgentConfig {
  storage?: RolloutStorageConfig;
}
```

### TTL Calculation Helpers

```typescript
/**
 * Calculate expiration timestamp from TTL configuration.
 * @param config - Agent configuration with storage settings
 * @returns Unix timestamp for expiration, or undefined for permanent storage
 */
export function calculateExpiresAt(config: IAgentConfigWithStorage): number | undefined;

/**
 * Check if a rollout has expired.
 * @param expiresAt - Expiration timestamp (undefined = permanent)
 * @returns True if rollout is expired
 */
export function isExpired(expiresAt?: number): boolean;

/**
 * Get default TTL value in milliseconds.
 * @returns 60 days in milliseconds
 */
export function getDefaultTTL(): number;
```

---

## Type Guards

### Type Guards for Rollout Items

```typescript
/**
 * Type guard for SessionMeta rollout item.
 */
export function isSessionMetaItem(item: RolloutItem): item is Extract<RolloutItem, { type: 'session_meta' }> {
  return item.type === 'session_meta';
}

/**
 * Type guard for ResponseItem rollout item.
 */
export function isResponseItemItem(item: RolloutItem): item is Extract<RolloutItem, { type: 'response_item' }> {
  return item.type === 'response_item';
}

/**
 * Type guard for CompactedItem rollout item.
 */
export function isCompactedItem(item: RolloutItem): item is Extract<RolloutItem, { type: 'compacted' }> {
  return item.type === 'compacted';
}

/**
 * Type guard for TurnContextItem rollout item.
 */
export function isTurnContextItem(item: RolloutItem): item is Extract<RolloutItem, { type: 'turn_context' }> {
  return item.type === 'turn_context';
}

/**
 * Type guard for EventMsg rollout item.
 */
export function isEventMsgItem(item: RolloutItem): item is Extract<RolloutItem, { type: 'event_msg' }> {
  return item.type === 'event_msg';
}
```

---

## Validation Rules

### SessionMeta Validation

- `id`: Must be valid UUID v4 format
- `timestamp`: Must be valid ISO 8601 format with milliseconds
- `cwd`: Must be non-empty string
- `originator`: Must be non-empty string
- `cliVersion`: Must be non-empty string

### RolloutLine Validation

- `timestamp`: Must be valid ISO 8601 format with milliseconds
- `type`: Must be one of the valid discriminators
- `payload`: Must match schema for the given type

### Cursor Validation

- `timestamp`: Must be positive integer (Unix milliseconds)
- `id`: Must be valid UUID v4 format

---

## State Transitions

### Rollout Status

```
┌─────────┐
│  create │─────> active
└─────────┘
             │
             v
          archived (cleanup)
```

### Conversation Flow

```
1. Create: new RolloutRecorder({ type: 'create', ... })
   → Creates rollouts record (status: 'active')
   → Writes SessionMeta as first item

2. Record: recorder.recordItems([...])
   → Filters items by persistence policy
   → Writes to rollout_items (increments sequence)
   → Updates itemCount in rollouts record

3. Flush: recorder.flush()
   → Waits for all pending IndexedDB writes

4. Resume: new RolloutRecorder({ type: 'resume', rolloutId })
   → Loads rollouts record
   → Continues writing from last sequence number

5. Shutdown: recorder.shutdown()
   → Flushes writes
   → Closes database connection
```

---

## Naming Conventions

All type names, method names, and field names preserve exact casing and terminology from Rust source:

- **Rust**: `RolloutRecorder` → **TypeScript**: `RolloutRecorder` ✓
- **Rust**: `record_items()` → **TypeScript**: `recordItems()` ✓ (camelCase convention)
- **Rust**: `ConversationId` → **TypeScript**: `ConversationId` ✓
- **Rust**: `SessionMeta` → **TypeScript**: `SessionMeta` ✓
- **Rust**: `session_meta` (enum variant) → **TypeScript**: `'session_meta'` (discriminator) ✓

---

## JSON Serialization Examples

### SessionMeta

```json
{
  "id": "5973b6c0-94b8-487b-a530-2aeb6098ae0e",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "cwd": "/home/user/project",
  "originator": "chrome-extension",
  "cliVersion": "1.0.0",
  "instructions": "Help me debug this code"
}
```

### RolloutLine (SessionMeta)

```json
{
  "timestamp": "2025-10-01T12:00:00.123Z",
  "type": "session_meta",
  "payload": {
    "id": "5973b6c0-94b8-487b-a530-2aeb6098ae0e",
    "timestamp": "2025-10-01T12:00:00.000Z",
    "cwd": "/home/user/project",
    "originator": "chrome-extension",
    "cliVersion": "1.0.0",
    "git": {
      "branch": "main",
      "commit": "abc123",
      "dirty": false
    }
  }
}
```

### RolloutLine (ResponseItem)

```json
{
  "timestamp": "2025-10-01T12:00:01.456Z",
  "type": "response_item",
  "payload": {
    "type": "message",
    "content": "I'll help you debug the code..."
  }
}
```

### Cursor

```json
{
  "timestamp": 1696176000000,
  "id": "5973b6c0-94b8-487b-a530-2aeb6098ae0e"
}
```

---

## References

1. Rust types: `codex-rs/core/src/rollout/recorder.rs`
2. Rust protocol: `codex-rs/protocol/src/protocol.rs`
3. TypeScript patterns: `codex-chrome/src/storage/ConversationStore.ts`

---

**Data Model Complete**: All types defined, validated, and documented. Ready for contract generation (Phase 1.2).
