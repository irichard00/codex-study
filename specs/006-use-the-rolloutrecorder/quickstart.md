# Quickstart: Replace ConversationStore with RolloutRecorder

**Feature**: 006-use-the-rolloutrecorder
**For**: Chrome Extension Developers
**Estimated Time**: 5 minutes to read, 1-2 hours to implement
**Important**: ⚠️ **No data migration** - Users will start fresh with RolloutRecorder

---

## Prerequisites

✅ **Before starting, ensure**:
- RolloutRecorder implementation is complete (Feature 005) ✓
- All RolloutRecorder tests pass (79+ tests) ✓
- Chrome extension is using ConversationStore currently ✓
- ⚠️ Users aware that conversation history will NOT be migrated (fresh start)

---

## ~~Step 1: Run Migration~~ (REMOVED - No Migration)

**No migration code needed.** Users will start fresh with RolloutRecorder.

---

## Step 1: Update Session to Use RolloutRecorder

### 1.1 Replace ConversationStore in SessionServices

**File**: `codex-chrome/src/core/session/state/SessionServices.ts`

```typescript
// OLD
import { ConversationStore } from '@/storage/ConversationStore';

export class SessionServices {
  conversationStore: ConversationStore;
  // ...
}

// NEW
import type { RolloutRecorder } from '@/storage/rollout';

export class SessionServices {
  rollout: RolloutRecorder | null;
  // ...
}
```

### 1.2 Initialize RolloutRecorder in Session

**File**: `codex-chrome/src/core/Session.ts`

```typescript
import { RolloutRecorder } from '@/storage/rollout';
import type { InitialHistory, RolloutItem } from '@/storage/rollout/types';

export class Session {
  private services: SessionServices;

  async initializeSession(
    mode: 'create' | 'resume',
    conversationId: string,
    config: AgentConfig
  ): Promise<void> {
    // Initialize RolloutRecorder
    try {
      if (mode === 'create') {
        this.services.rollout = await RolloutRecorder.create(
          { type: 'create', conversationId, instructions: this.userInstructions },
          config
        );
      } else {
        this.services.rollout = await RolloutRecorder.create(
          { type: 'resume', conversationId },
          config
        );

        // Reconstruct history from rollout
        const items = await this.services.rollout.getRolloutHistory();
        this.reconstructHistoryFromRollout(items);
      }
    } catch (e) {
      console.error('Failed to initialize rollout recorder:', e);
      this.services.rollout = null; // Graceful degradation
    }
  }

  // NEW: Persist rollout items (replaces addMessage)
  async persistRolloutItems(items: RolloutItem[]): Promise<void> {
    if (this.services.rollout) {
      try {
        await this.services.rollout.recordItems(items);
      } catch (e) {
        console.error('Failed to record rollout items:', e);
      }
    }
  }

  // NEW: Reconstruct conversation history from rollout
  private reconstructHistoryFromRollout(items: RolloutItem[]): void {
    for (const item of items) {
      if (item.type === 'response_item' || item.type === 'compacted') {
        this.conversationHistory.addResponseItem(item.payload);
      }
      // Skip event_msg, session_meta, turn_context (metadata only)
    }
  }

  // NEW: Shutdown (flush pending writes)
  async shutdown(): Promise<void> {
    if (this.services.rollout) {
      await this.services.rollout.flush();
    }
  }
}
```

---

## Step 2: Update Message Recording

### 2.1 Replace ConversationStore.addMessage()

**Old Pattern**:
```typescript
await this.conversationStore.addMessage(conversationId, {
  role: 'user',
  content: 'Hello',
  timestamp: Date.now()
});
```

**New Pattern**:
```typescript
await this.persistRolloutItems([
  {
    type: 'event_msg',
    payload: { type: 'UserMessage', content: 'Hello' }
  }
]);
```

### 2.2 Record Assistant Responses

```typescript
// Assistant message
await this.persistRolloutItems([
  {
    type: 'response_item',
    payload: { type: 'Message', content: 'Hi there!' }
  }
]);

// Tool call
await this.persistRolloutItems([
  {
    type: 'response_item',
    payload: {
      type: 'LocalShellCall',
      command: 'ls -la',
      output: '... files ...'
    }
  }
]);
```

---

## Step 3: Update StorageQuotaManager

**File**: `codex-chrome/src/storage/StorageQuotaManager.ts`

```typescript
// OLD
import { ConversationStore } from './ConversationStore';

async cleanup(): Promise<void> {
  await ConversationStore.cleanup(7); // Delete conversations older than 7 days
}

// NEW
import { RolloutRecorder } from './rollout';

async cleanup(): Promise<void> {
  const result = await RolloutRecorder.cleanupExpired();
  console.log(`Cleaned up ${result.count} expired rollouts`);
}
```

---

## Step 4: Update Service Worker Cleanup

**File**: `codex-chrome/src/background/service-worker.ts`

```typescript
import { RolloutRecorder } from '@/storage/rollout';

// Schedule periodic cleanup
chrome.alarms.create('rollout-cleanup', {
  periodInMinutes: 60 // Every hour
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'rollout-cleanup') {
    try {
      const result = await RolloutRecorder.cleanupExpired();
      console.log(`🧹 Cleanup: ${result.count} expired rollouts deleted`);
    } catch (e) {
      console.error('Cleanup failed:', e);
    }
  }
});
```

---

## Step 5: Remove ConversationStore

### 5.1 Delete Legacy Files

```bash
# Remove ConversationStore implementation
rm codex-chrome/src/storage/ConversationStore.ts

# Remove ConversationStore tests
rm codex-chrome/tests/storage/ConversationStore.test.ts

# Remove ConversationStore types (if separate file)
rm codex-chrome/src/storage/types/ConversationStore.ts
```

### 5.2 Remove Imports

Search and remove all ConversationStore imports:

```bash
# Find all files importing ConversationStore
grep -r "import.*ConversationStore" codex-chrome/src/

# Expected files to update:
# - Session.ts
# - SessionServices.ts
# - StorageQuotaManager.ts
# - service-worker.ts
```

---

## Step 6: ~~Verify Migration~~ → Verify Implementation

### 6.1 ~~Check Migration Status~~ (Not Applicable)

No migration to verify.

### 6.2 Verify Rollout Data

```typescript
import { RolloutRecorder } from '@/storage/rollout';

// List all conversations
const page = await RolloutRecorder.listConversations(50);
console.log(`Found ${page.items.length} conversations`);

// Check a specific conversation
const conversationId = 'your-conversation-id';
const items = await RolloutRecorder.getRolloutHistory(conversationId);
console.log(`Conversation has ${items.length} items`);
```

### 6.3 Test New Session

```typescript
// Create new session
const session = new Session();
await session.initializeSession('create', uuidv4(), config);

// Send message
await session.persistRolloutItems([
  { type: 'event_msg', payload: { type: 'UserMessage', content: 'Test message' } }
]);

// Verify persistence
const items = await session.services.rollout?.getRolloutHistory();
console.log('Items persisted:', items?.length); // Should be 1+
```

---

## Step 7: ~~Rollback~~ (Not Applicable - No Migration)

No rollback needed since there's no migration.

---

## Testing Checklist

- [ ] ~~Migration runs successfully~~ → Not applicable (no migration)
- [ ] ~~All conversations migrated~~ → Not applicable
- [ ] ~~Message order preserved~~ → Not applicable
- [ ] ~~Tool calls converted~~ → Not applicable
- [ ] New sessions create rollouts in RolloutRecorder ✓
- [ ] Resumed sessions load history from RolloutRecorder ✓
- [ ] TTL expiration works (test with short TTL) ✓
- [ ] Cleanup deletes expired rollouts ✓
- [ ] StorageQuotaManager uses RolloutRecorder ✓
- [ ] No references to ConversationStore remain in code ✓
- [ ] Extension works without errors ✓
- [ ] Users understand conversation history is not migrated ✓

---

## Troubleshooting

### Issue: ~~Migration fails with "quota exceeded"~~
**Not applicable** - No migration

### Issue: Rollout items have wrong sequence numbers
**Solution**: Verify Session implementation assigns sequences correctly when recording items

### Issue: ~~Tool calls are missing after migration~~
**Not applicable** - Tool calls handled in new Session implementation

### Issue: Session fails to resume
**Solution**: Verify `RolloutRecorder.getRolloutHistory()` returns items, check conversationId

### Issue: Users complain about lost conversation history
**Solution**: This is expected - no migration performed. Direct users to manually export/backup if needed before updating

---

## Performance Expectations

Based on Feature 005 performance tests:

- **Write 10 items**: ~1ms (target: <50ms) ✅
- **Read 1000 items**: ~9ms (target: <200ms) ✅
- **List 50 conversations**: ~4ms (target: <200ms) ✅
- **Cleanup 100 rollouts**: ~22ms (target: <500ms) ✅

~~Migration performance~~ (Not applicable - no migration)

---

## Next Steps

1. ✅ ~~Complete migration~~ → Not applicable
2. ✅ Verify all tests pass
3. ✅ Remove ConversationStore code
4. ✅ Update documentation (CLAUDE.md)
5. ✅ Test in production-like environment
6. ⚠️ Inform users about fresh start (no conversation history migrated)
7. 🚀 Deploy to users

---

**Code Replacement Complete!** 🎉

Your Chrome extension now uses RolloutRecorder for conversation storage, aligned with the codex-rs architecture.

**Important**: Users will start with empty conversation history. ConversationStore database remains untouched (users can manually delete if desired).
