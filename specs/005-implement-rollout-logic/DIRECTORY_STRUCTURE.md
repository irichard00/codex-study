# Directory Structure Update

**Date**: 2025-10-01
**Update**: Organized rollout code in dedicated subdirectory

## Overview

The implementation plan has been updated to organize all rollout-related code in a dedicated subdirectory: `codex-chrome/src/storage/rollout/`. This provides better modularity, maintainability, and follows TypeScript project organization best practices.

## Directory Structure

### Source Code: `codex-chrome/src/storage/rollout/`

```
codex-chrome/src/storage/rollout/
├── RolloutRecorder.ts    # Main public class
├── RolloutWriter.ts      # IndexedDB async writer
├── types.ts              # Type definitions
├── policy.ts             # Persistence filters
├── listing.ts            # Conversation listing & pagination
├── cleanup.ts            # TTL cleanup logic
├── helpers.ts            # Utility functions
└── index.ts              # Public API exports
```

### Test Code: `tests/storage/rollout/`

```
tests/storage/rollout/
├── RolloutRecorder.test.ts
├── RolloutWriter.test.ts
├── policy.test.ts
├── listing.test.ts
├── cleanup.test.ts
└── helpers.test.ts
```

## Module Responsibilities

### 1. RolloutRecorder.ts
**Main public class** - Entry point for all rollout operations
- Constructor (create/resume)
- Instance methods: `recordItems()`, `flush()`, `shutdown()`, `getRolloutId()`
- Static methods: `listConversations()`, `getRolloutHistory()`, `cleanupExpired()`

### 2. RolloutWriter.ts
**Internal IndexedDB writer** - Handles async write operations
- Write queue management
- Batch write optimization
- Transaction handling
- Not exported publicly

### 3. types.ts
**Type definitions** - All TypeScript types and interfaces
- `RolloutItem`, `RolloutLine`, `SessionMeta`, `SessionMetaLine`
- `RolloutRecorderParams`, `RolloutMetadataRecord`, `RolloutItemRecord`
- `ConversationItem`, `ConversationsPage`, `Cursor`
- `RolloutStorageConfig`, `IAgentConfigWithStorage`
- Type guards: `isSessionMetaItem()`, `isResponseItemItem()`, etc.

### 4. policy.ts
**Persistence filters** - Determines which items to persist
- `isPersistedRolloutItem(item: RolloutItem): boolean`
- `shouldPersistResponseItem(item: ResponseItem): boolean`
- `shouldPersistEventMsg(event: EventMsg): boolean`
- Matches Rust `rollout/policy.rs` behavior

### 5. listing.ts
**Conversation listing** - Pagination and conversation discovery
- `listConversations(pageSize: number, cursor?: Cursor): Promise<ConversationsPage>`
- Cursor-based pagination implementation
- IndexedDB range queries
- Matches Rust `rollout/list.rs` behavior

### 6. cleanup.ts
**TTL management** - Automatic cleanup of expired rollouts
- `cleanupExpired(): Promise<number>`
- Background cleanup scheduling (Chrome alarms)
- Integration with StorageQuotaManager
- Expiration tracking

### 7. helpers.ts
**Utility functions** - Shared helper functions
- `calculateExpiresAt(config: IAgentConfig): number | undefined`
- `isExpired(expiresAt?: number): boolean`
- `getDefaultTTL(): number`
- `generateId(prefix: string): string`
- `formatTimestamp(date: Date): string`
- `serializeCursor(cursor: Cursor): string`
- `deserializeCursor(token: string): Cursor | null`

### 8. index.ts
**Public exports** - Module entry point
```typescript
// Main class
export { RolloutRecorder } from './RolloutRecorder';

// Types
export type {
  RolloutRecorderParams,
  RolloutItem,
  RolloutLine,
  SessionMeta,
  SessionMetaLine,
  ConversationItem,
  ConversationsPage,
  Cursor,
  RolloutStorageConfig,
  IAgentConfigWithStorage
} from './types';

// Type guards
export {
  isSessionMetaItem,
  isResponseItemItem,
  isCompactedItem,
  isTurnContextItem,
  isEventMsgItem
} from './types';

// Utilities (optional - can keep internal)
export {
  calculateExpiresAt,
  isExpired,
  getDefaultTTL
} from './helpers';
```

## Import Patterns

### External Usage (from outside rollout/)

```typescript
// Import main class
import { RolloutRecorder } from '@/storage/rollout';

// Import types
import type {
  RolloutItem,
  SessionMeta,
  ConversationItem
} from '@/storage/rollout';

// Import utilities
import { calculateExpiresAt } from '@/storage/rollout';
```

### Internal Usage (within rollout/ modules)

```typescript
// Within RolloutRecorder.ts
import { RolloutWriter } from './RolloutWriter';
import type { RolloutItem, SessionMeta } from './types';
import { isPersistedRolloutItem } from './policy';
import { listConversations } from './listing';
import { cleanupExpired } from './cleanup';
import { calculateExpiresAt } from './helpers';
```

## Benefits of This Structure

### 1. Modularity
- Each file has a single, well-defined responsibility
- Clear boundaries between different concerns
- Easy to understand what each module does

### 2. Maintainability
- Changes to one aspect (e.g., cleanup) don't affect others
- Easy to locate specific functionality
- Reduces cognitive load when working on code

### 3. Testability
- Each module can be tested independently
- Mock dependencies easily
- Focused unit tests

### 4. Scalability
- Easy to add new features (e.g., `export.ts` for JSONL export)
- Can split large modules further if needed
- Clear structure guides future development

### 5. Clean Public API
- Single import point for consumers
- Internal modules hidden from external use
- Version bumps don't affect import paths

### 6. TypeScript Best Practices
- Follows module organization conventions
- Enables tree-shaking (unused modules not bundled)
- Better IDE autocomplete and navigation

## Rust Parallel

The structure mirrors Rust's module organization:

| Rust File | TypeScript File | Purpose |
|-----------|-----------------|---------|
| `rollout/mod.rs` | `rollout/index.ts` | Public exports |
| `rollout/recorder.rs` | `rollout/RolloutRecorder.ts` | Main class |
| `rollout/policy.rs` | `rollout/policy.ts` | Persistence filters |
| `rollout/list.rs` | `rollout/listing.ts` | Pagination |
| (internal) | `rollout/RolloutWriter.ts` | Async writer |
| (inline) | `rollout/types.ts` | Type definitions |
| (inline) | `rollout/cleanup.ts` | TTL cleanup |
| (inline) | `rollout/helpers.ts` | Utilities |

## Migration from Flat Structure

If previously designed with flat structure:

### Before
```
codex-chrome/src/storage/
├── RolloutRecorder.ts
├── RolloutWriter.ts
├── rolloutTypes.ts
├── rolloutPolicy.ts
└── ConversationListing.ts
```

### After
```
codex-chrome/src/storage/
├── rollout/
│   ├── RolloutRecorder.ts
│   ├── RolloutWriter.ts
│   ├── types.ts
│   ├── policy.ts
│   ├── listing.ts
│   ├── cleanup.ts
│   ├── helpers.ts
│   └── index.ts
├── ConversationStore.ts
├── CacheManager.ts
└── StorageQuotaManager.ts
```

### Import Changes
```typescript
// Old
import { RolloutRecorder } from '@/storage/RolloutRecorder';

// New
import { RolloutRecorder } from '@/storage/rollout';
```

## File Size Estimates

| File | Estimated Lines | Complexity |
|------|-----------------|------------|
| RolloutRecorder.ts | 300-400 | Medium |
| RolloutWriter.ts | 150-200 | Medium |
| types.ts | 200-300 | Low |
| policy.ts | 100-150 | Low |
| listing.ts | 200-250 | Medium |
| cleanup.ts | 150-200 | Medium |
| helpers.ts | 100-150 | Low |
| index.ts | 20-30 | Low |
| **Total** | **~1,220-1,680** | - |

## Testing Structure

### Unit Tests (tests/storage/rollout/)
- One test file per source file
- Mock dependencies
- Focus on individual module behavior

### Integration Tests (tests/integration/)
- Test cross-module interactions
- Real IndexedDB (fake-indexeddb)
- End-to-end scenarios

### Example Test Organization
```typescript
// tests/storage/rollout/RolloutRecorder.test.ts
describe('RolloutRecorder', () => {
  describe('constructor', () => {
    it('should create new rollout', ...);
    it('should resume existing rollout', ...);
  });

  describe('recordItems', () => {
    it('should record items', ...);
  });
});

// tests/integration/rollout-integration.test.ts
describe('Rollout Integration', () => {
  it('should create, record, flush, and resume', ...);
});
```

## Documentation Impact

Updated files:
- ✅ `plan.md`: Project Structure section
- ✅ `research.md`: Section 7 (Module Organization)
- ✅ `quickstart.md`: Import paths updated
- ✅ `DIRECTORY_STRUCTURE.md`: This file

## Next Steps (Implementation)

1. Create directory: `mkdir -p codex-chrome/src/storage/rollout`
2. Create test directory: `mkdir -p tests/storage/rollout`
3. Implement modules in order:
   - `types.ts` (foundational)
   - `helpers.ts` (utilities)
   - `policy.ts` (filters)
   - `RolloutWriter.ts` (writer)
   - `listing.ts` (pagination)
   - `cleanup.ts` (TTL)
   - `RolloutRecorder.ts` (main class)
   - `index.ts` (exports)
4. Write tests for each module
5. Integration tests

---

**Structure Status**: Complete - All specification documents updated with modular directory structure
