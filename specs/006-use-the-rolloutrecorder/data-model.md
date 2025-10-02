# Data Model: ConversationStore → RolloutRecorder Replacement

**Feature**: 006-use-the-rolloutrecorder
**Date**: 2025-10-01
**Important**: This is a code replacement only - **NO DATA MIGRATION** is performed.

---

## 1. Current Data Model (ConversationStore)

### 1.1 ConversationStore Schema

**Database**: `CodexConversations` (IndexedDB)

**Object Stores**:

```typescript
// 1. conversations - Main conversation metadata
interface Conversation {
  id: string;                    // UUID
  title: string;                 // Generated from first message
  createdAt: number;             // Unix timestamp (ms)
  updatedAt: number;             // Unix timestamp (ms)
  messageCount: number;          // Cached count
  instructions?: string;         // Session instructions
}
// Index: 'by-updated' (updatedAt, for sorting)

// 2. messages - Individual conversation messages
interface Message {
  id: string;                    // UUID
  conversationId: string;        // FK to conversations
  role: 'user' | 'assistant' | 'system';
  content: string;               // Message text
  timestamp: number;             // Unix timestamp (ms)
  toolCalls?: ToolCallReference[];  // Optional tool call refs
}
// Index: 'by-conversation' (conversationId, timestamp)

// 3. toolCalls - Tool execution records
interface ToolCall {
  id: string;                    // UUID
  messageId: string;             // FK to messages
  toolName: string;              // e.g., 'exec_command', 'web_search'
  input: any;                    // Tool input parameters (JSON)
  output?: any;                  // Tool output (JSON)
  status: 'pending' | 'success' | 'error';
  timestamp: number;             // Unix timestamp (ms)
}
// Index: 'by-message' (messageId)

// 4. searchIndex - Full-text search (tokenized)
interface SearchToken {
  token: string;                 // Lowercased word
  conversationId: string;        // FK to conversations
  messageId: string;             // FK to messages
}
// Index: 'by-token' (token)
```

**Total Storage**: ~4 object stores, multiple indices

---

## 2. New Data Model (RolloutRecorder)

### 2.1 RolloutRecorder Schema

**Database**: `CodexRollouts` (IndexedDB)

**Object Stores**:

```typescript
// 1. rollouts - Session metadata (replaces 'conversations')
interface Rollout {
  id: string;                    // Conversation ID (UUID)
  timestamp: number;             // Creation timestamp (ms)
  expiresAt?: number;            // TTL expiration (ms), undefined = permanent
  instructions?: string;         // Session instructions
  title?: string;                // Generated title (optional)
  cwd?: string;                  // Working directory (from SessionMeta)
  originator?: string;           // Source (e.g., 'chrome-extension')
}
// Index: 'by-timestamp' (timestamp, for pagination)
// Index: 'by-expires' (expiresAt, for cleanup)

// 2. rollout_items - All conversation events (replaces 'messages' + 'toolCalls')
interface RolloutItemRecord {
  id: string;                    // Auto-generated UUID
  rolloutId: string;             // FK to rollouts (conversation ID)
  sequence: number;              // Monotonic sequence within rollout
  timestamp: number;             // Item timestamp (ms)
  type: 'session_meta' | 'response_item' | 'event_msg' | 'compacted' | 'turn_context';
  payload: RolloutItemPayload;   // Discriminated union based on type
}
// Index: 'by-rollout' (rolloutId, sequence)
// Index: 'by-timestamp' (timestamp)

// Payload types (discriminated union)
type RolloutItemPayload =
  | SessionMetaLine
  | ResponseItemPayload
  | EventMsgPayload
  | CompactedItem
  | TurnContextItem;
```

**Total Storage**: 2 object stores, 4 indices (simplified from 4 stores + 3 indices)

---

## 3. ~~Migration Mapping~~ (NOT APPLICABLE - No Migration)

### 3.1 Data Comparison (for reference only)

**Note**: No migration is performed. This comparison shows how the data models differ:

| ConversationStore | RolloutRecorder | Notes |
|-------------------|-----------------|-------|
| `Conversation` | `Rollout` | Fresh rollouts created for new conversations only |
| `Message` (role='user') | `RolloutItemRecord` (type='event_msg') | New implementation in Session |
| `Message` (role='assistant') | `RolloutItemRecord` (type='response_item') | New implementation in Session |
| `ToolCall` | Embedded in `response_item` payload | New implementation in Session |
| `SearchToken` | **Not used** | Not implemented in RolloutRecorder |

**Old data**: ConversationStore database remains untouched (users can manually delete if desired)

### 3.2 ~~Field Mapping~~ (Removed - No Migration)

**Not applicable** - No migration code needed. Session will create fresh rollouts using RolloutRecorder API.

---

## 4. ~~Migration Entities~~ (Removed - No Migration)

Not applicable - no migration entities needed.

---

## 5. ~~Data Validation~~ (Removed - No Migration)

Not applicable - no migration validation needed.

---

## 6. ~~Rollback Strategy~~ (Removed - No Migration)

Not applicable - no rollback needed (fresh start).

---

## 7. Schema Version Management (Simplified)

### 7.1 Version Tracking (Simplified)

Only RolloutRecorder schema version needs tracking (no migration from ConversationStore):

```typescript
interface SchemaVersion {
  database: 'CodexRollouts';
  version: number;
}

// Store in chrome.storage.local
const SCHEMA_VERSION: SchemaVersion = {
  database: 'CodexRollouts',
  version: 1,
};
```

### 7.2 Future Schema Updates

When RolloutRecorder schema needs updates, handle via standard schema migration:

```typescript
async function migrateRolloutSchema(fromVersion: number, toVersion: number): Promise<void> {
  // Example: Add new field to rollouts
  if (fromVersion === 1 && toVersion === 2) {
    const rollouts = await getAllRollouts();
    for (const rollout of rollouts) {
      await updateRollout(rollout.id, {
        ...rollout,
        newField: defaultValue,
      });
    }
  }
}
```

---

## 8. Summary

**Code Replacement Overview**:
- **Old**: ConversationStore (4 object stores: conversations, messages, toolCalls, searchIndex)
- **New**: RolloutRecorder (2 object stores: rollouts, rollout_items)
- **Migration**: **NONE** - Users start fresh with RolloutRecorder
- **Old Data**: ConversationStore database remains (user can manually delete)

**Key Changes**:
1. Session creates new rollouts (no preservation of old conversations)
2. All new messages stored as RolloutItems
3. ToolCalls embedded in ResponseItems
4. No searchIndex in new implementation

**Simplifications from No Migration**:
- No migration validation code
- No pre/post-migration checks
- No batch processing logic
- No rollback mechanism
- No migration status tracking

---

**Data Model Complete**: Simplified for code replacement only (no migration). Ready for contract generation (Phase 1).
