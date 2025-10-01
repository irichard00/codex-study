# TTL Configuration Update Summary

**Date**: 2025-10-01
**Update**: Added configurable TTL support to RolloutRecorder implementation plan

## Overview

The implementation plan has been updated to include Time-To-Live (TTL) configuration for rollout data stored in IndexedDB. This addresses the requirement: "the indexedDB should have default 60 days TTL, but allow user to set it in AgentConfig.ts to other TTL or permanent store".

## Changes Made

### 1. Updated Technical Context (`plan.md`)

Added conversion requirement #7:
- Default TTL: 60 days for rollout data
- Configurable via `AgentConfig.ts`
- Support for custom TTL values (e.g., 7, 30, 90 days)
- Support for permanent storage (no expiration)
- Automatic cleanup of expired rollouts

### 2. Extended Research (`research.md`)

Added Section 6: TTL Configuration & Automatic Cleanup
- **IndexedDB Schema Extension**: Added `expiresAt` field to `RolloutMetadataRecord`
- **AgentConfig Integration**: Defined `storage.rolloutTTL` configuration
- **Expiration Calculation**: Helper function for computing expiration timestamps
- **Cleanup Strategies**: On-demand, background (Chrome alarms), and explicit cleanup
- **Status Transitions**: Extended to include 'expired' status
- **Integration**: Works with existing `StorageQuotaManager`

### 3. Updated Data Model (`data-model.md`)

**RolloutMetadataRecord Changes**:
```typescript
interface RolloutMetadataRecord {
  // ... existing fields ...
  expiresAt?: number;  // NEW: Unix timestamp (undefined = permanent)
  status: 'active' | 'archived' | 'expired';  // UPDATED: added 'expired'
}
```

**New Configuration Types**:
```typescript
interface RolloutStorageConfig {
  rolloutTTL?: number | 'permanent';  // Days or 'permanent'
}

interface IAgentConfigWithStorage extends IAgentConfig {
  storage?: RolloutStorageConfig;
}
```

**New Helper Functions**:
- `calculateExpiresAt(config)`: Calculate expiration timestamp
- `isExpired(expiresAt)`: Check if rollout is expired
- `getDefaultTTL()`: Get default 60-day TTL in milliseconds

### 4. Updated API Contract (`contracts/RolloutRecorder.md`)

**Constructor Signature Change**:
```typescript
// OLD:
constructor(params: RolloutRecorderParams): Promise<RolloutRecorder>

// NEW:
constructor(params: RolloutRecorderParams, config?: IAgentConfigWithStorage): Promise<RolloutRecorder>
```

**New Static Method**:
```typescript
static cleanupExpired(): Promise<number>
```

**Behavior Updates**:
- Create mode now calculates `expiresAt` from config
- Default 60-day TTL if no config provided
- Supports 'permanent' option (no expiration)

### 5. Enhanced Quickstart Guide (`quickstart.md`)

**New Sections**:
1. Create Rollout with Custom TTL
   - Custom TTL example (30 days)
   - Permanent storage example
2. TTL and Automatic Cleanup
   - Manual cleanup of expired rollouts
   - Background cleanup via Chrome alarms
   - Integration with AgentConfig
   - Update TTL for existing configuration
3. Updated Storage Quota Management
   - Priority cleanup of expired rollouts
   - Cascading cleanup strategies

## Configuration Examples

### Default Behavior (60 days)
```typescript
const recorder = await new RolloutRecorder({
  type: 'create',
  conversationId: uuidv4()
});
// Rollout expires in 60 days
```

### Custom TTL (30 days)
```typescript
const config = { storage: { rolloutTTL: 30 } };
const recorder = await new RolloutRecorder(
  { type: 'create', conversationId: uuidv4() },
  config
);
// Rollout expires in 30 days
```

### Permanent Storage
```typescript
const config = { storage: { rolloutTTL: 'permanent' } };
const recorder = await new RolloutRecorder(
  { type: 'create', conversationId: uuidv4() },
  config
);
// Rollout never expires
```

### Cleanup Expired Rollouts
```typescript
const deletedCount = await RolloutRecorder.cleanupExpired();
console.log(`Deleted ${deletedCount} expired rollouts`);
```

## IndexedDB Schema Impact

### New Field
- `rollouts.expiresAt` (number | undefined): Expiration timestamp

### New Index
```typescript
// Index on expiresAt for efficient cleanup queries
createIndex('expiresAt', 'expiresAt', { unique: false });
```

### Status Values
- `'active'`: Currently in use
- `'archived'`: Manually archived by user
- `'expired'`: TTL reached (ready for cleanup)

## Cleanup Mechanism

### Automatic Cleanup Triggers
1. **Background** (Chrome alarms): Every 60 minutes
2. **On-demand** (before listing): When `listConversations()` called
3. **Manual**: Via `cleanupExpired()` static method

### Cleanup Process
1. Query all rollouts where `expiresAt < Date.now()`
2. Delete from `rollouts` object store
3. Cascade delete from `rollout_items` (foreign key: rolloutId)
4. Return count of deleted rollouts

### Performance
- Target: <500ms for 100 expired rollouts
- Uses indexed query on `expiresAt`
- Atomic transaction (all or nothing)

## Integration Points

### AgentConfig.ts
```typescript
interface IAgentConfig {
  // ... existing fields ...
  storage?: {
    rolloutTTL?: number | 'permanent';  // NEW
  };
}
```

### ConfigStorage.ts
- Persist user's TTL preference to Chrome Storage
- Load TTL configuration when creating rollouts

### StorageQuotaManager.ts
- Priority cleanup: Expired rollouts deleted first
- Fallback cleanup: Old rollouts (if still low on space)

## Migration Path

### For Existing Rollouts (created before TTL feature)
- `expiresAt = undefined` → Treated as permanent
- Can be migrated with migration script if needed

### Database Version Bump
- Current: version 1 (no `expiresAt`)
- New: version 2 (with `expiresAt`)
- `onupgradeneeded` handler adds field with default `undefined`

## Testing Requirements

### New Tests
- ✅ Constructor with custom TTL config
- ✅ Constructor with permanent config
- ✅ cleanupExpired() removes expired rollouts
- ✅ cleanupExpired() preserves permanent rollouts
- ✅ Background cleanup via Chrome alarms
- ✅ Expiration calculation accuracy
- ✅ Status transitions (active → expired)

### Updated Tests
- ✅ Constructor without config uses 60-day default
- ✅ listConversations excludes expired rollouts

## Documentation Impact

All specification documents updated:
- ✅ plan.md (Technical Context)
- ✅ research.md (Section 6 added)
- ✅ data-model.md (Schema + config types)
- ✅ contracts/RolloutRecorder.md (API updates)
- ✅ quickstart.md (Examples + cleanup guide)

## Next Steps

When implementing (`/tasks` command):
1. Add `expiresAt` field to IndexedDB schema
2. Implement `calculateExpiresAt()` helper
3. Update RolloutRecorder constructor to accept config
4. Implement `cleanupExpired()` static method
5. Add background cleanup via Chrome alarms
6. Update AgentConfig types
7. Write tests for TTL functionality
8. Update UI to allow users to configure TTL

---

**Update Status**: Complete - All specification documents updated with TTL requirements
