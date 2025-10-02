# Quickstart: RolloutRecorder Integration

**Version**: 1.0.0
**Date**: 2025-10-01

## Overview

This guide demonstrates how to integrate the RolloutRecorder into your Chrome extension to persist agent conversation history.

---

## Installation

```bash
# No external dependencies - uses browser-native IndexedDB
# All rollout code is in codex-chrome/src/storage/rollout/
```

### Import Paths

```typescript
// Import from rollout module
import { RolloutRecorder } from '@/storage/rollout';
import type {
  RolloutItem,
  RolloutLine,
  SessionMeta,
  RolloutRecorderParams
} from '@/storage/rollout';
```

---

## Basic Usage

### 1. Create a New Rollout (Default 60-day TTL)

```typescript
import { RolloutRecorder } from '@/storage/rollout';
import { v4 as uuidv4 } from 'uuid';

// Create a new conversation with default 60-day TTL
const conversationId = uuidv4();
const recorder = await new RolloutRecorder({
  type: 'create',
  conversationId,
  instructions: 'Help me debug this React component'
});

console.log('Rollout created:', recorder.getRolloutId());
```

### 1b. Create Rollout with Custom TTL

```typescript
import { RolloutRecorder } from '@/storage/rollout';
import { IAgentConfigWithStorage } from '@/config/types';

// Option 1: Custom TTL (30 days)
const config: IAgentConfigWithStorage = {
  storage: {
    rolloutTTL: 30
  }
};

const recorder = await new RolloutRecorder(
  {
    type: 'create',
    conversationId: uuidv4(),
    instructions: 'Short-term debugging session'
  },
  config
);

// Option 2: Permanent storage (never expires)
const permanentConfig: IAgentConfigWithStorage = {
  storage: {
    rolloutTTL: 'permanent'
  }
};

const permanentRecorder = await new RolloutRecorder(
  {
    type: 'create',
    conversationId: uuidv4(),
    instructions: 'Important conversation to keep forever'
  },
  permanentConfig
);
```

### 2. Record Conversation Items

```typescript
// Record agent responses
await recorder.recordItems([
  {
    type: 'response_item',
    payload: {
      type: 'message',
      content: 'I'll help you debug the component. Let me analyze the code...'
    }
  }
]);

// Record tool calls
await recorder.recordItems([
  {
    type: 'response_item',
    payload: {
      type: 'function_call',
      name: 'read_file',
      args: { path: 'src/App.tsx' }
    }
  },
  {
    type: 'response_item',
    payload: {
      type: 'function_call_output',
      name: 'read_file',
      output: '// file contents...'
    }
  }
]);
```

### 3. Flush and Shutdown

```typescript
// Ensure all writes are committed
await recorder.flush();

// Clean up when done
await recorder.shutdown();
```

---

## Resume an Existing Conversation

```typescript
// Resume from stored conversation ID
const rolloutId = '5973b6c0-94b8-487b-a530-2aeb6098ae0e';
const recorder = await new RolloutRecorder({
  type: 'resume',
  rolloutId
});

// Continue recording
await recorder.recordItems([
  {
    type: 'response_item',
    payload: { type: 'message', content: 'Continuing from where we left off...' }
  }
]);

await recorder.shutdown();
```

---

## List All Conversations

```typescript
import { RolloutRecorder } from '@/storage/rollout';

// Get first page (20 conversations)
const page1 = await RolloutRecorder.listConversations(20);

console.log('Found conversations:', page1.items.length);
page1.items.forEach(item => {
  console.log('- ', item.sessionMeta?.id, item.sessionMeta?.timestamp);
});

// Get next page if available
if (page1.nextCursor) {
  const page2 = await RolloutRecorder.listConversations(20, page1.nextCursor);
  console.log('Next page:', page2.items.length);
}
```

---

## Load Conversation History

```typescript
// Load complete conversation history
const rolloutId = '5973b6c0-94b8-487b-a530-2aeb6098ae0e';
const history = await RolloutRecorder.getRolloutHistory(rolloutId);

if (history.type === 'resumed') {
  console.log('Conversation ID:', history.payload.conversationId);
  console.log('Total items:', history.payload.history.length);

  // Process history
  history.payload.history.forEach((item, index) => {
    console.log(`[${index}] ${item.type}`);
  });
}
```

---

## Integration with Session Manager

```typescript
import { RolloutRecorder } from '@/storage/rollout';
import { Session } from './session/Session';

class SessionManager {
  private recorder: RolloutRecorder | null = null;

  async startSession(instructions?: string): Promise<void> {
    const conversationId = uuidv4();

    // Create rollout recorder
    this.recorder = await new RolloutRecorder({
      type: 'create',
      conversationId,
      instructions
    });

    // Create session
    this.session = new Session(conversationId);

    // Intercept session events and record them
    this.session.on('response', async (items) => {
      if (this.recorder) {
        await this.recorder.recordItems(items);
      }
    });
  }

  async resumeSession(rolloutId: string): Promise<void> {
    // Resume rollout
    this.recorder = await new RolloutRecorder({
      type: 'resume',
      rolloutId
    });

    // Load history
    const history = await RolloutRecorder.getRolloutHistory(rolloutId);

    if (history.type === 'resumed') {
      // Restore session from history
      this.session = Session.fromHistory(history.payload.history);
    }
  }

  async endSession(): Promise<void> {
    if (this.recorder) {
      await this.recorder.flush();
      await this.recorder.shutdown();
      this.recorder = null;
    }
  }
}
```

---

## Export to JSONL

```typescript
// Export conversation to JSONL format (compatible with Rust CLI)
async function exportToJsonl(rolloutId: string): Promise<string> {
  const history = await RolloutRecorder.getRolloutHistory(rolloutId);

  if (history.type !== 'resumed') {
    return '';
  }

  const lines = history.payload.history.map(item => {
    const line = {
      timestamp: new Date().toISOString(),
      type: item.type,
      payload: item.payload
    };
    return JSON.stringify(line);
  });

  return lines.join('\n');
}

// Usage
const jsonl = await exportToJsonl('5973b6c0-...');
const blob = new Blob([jsonl], { type: 'application/jsonl' });
const url = URL.createObjectURL(blob);
// Download or process blob
```

---

## Import from JSONL

```typescript
// Import JSONL file created by Rust CLI
async function importFromJsonl(jsonlContent: string): Promise<string> {
  const lines = jsonlContent.split('\n').filter(l => l.trim());
  const items: RolloutItem[] = [];

  let conversationId: string | null = null;

  for (const line of lines) {
    const parsed = JSON.parse(line);

    // Extract conversation ID from SessionMeta
    if (parsed.type === 'session_meta' && !conversationId) {
      conversationId = parsed.payload.id;
    }

    items.push({
      type: parsed.type,
      payload: parsed.payload
    });
  }

  if (!conversationId) {
    throw new Error('No SessionMeta found in JSONL');
  }

  // Create rollout and bulk insert items
  const recorder = await new RolloutRecorder({
    type: 'create',
    conversationId
  });

  await recorder.recordItems(items);
  await recorder.flush();
  await recorder.shutdown();

  return conversationId;
}
```

---

## Error Handling

```typescript
async function safeRecordItems(recorder: RolloutRecorder, items: RolloutItem[]): Promise<boolean> {
  try {
    await recorder.recordItems(items);
    await recorder.flush();
    return true;
  } catch (error) {
    if (error.message.includes('Database not initialized')) {
      console.error('Recorder not initialized');
    } else if (error.message.includes('Write failed')) {
      console.error('Failed to write to IndexedDB:', error);
    } else if (error.message.includes('quota')) {
      console.error('Storage quota exceeded');
      // Trigger cleanup
      await cleanupOldRollouts();
    } else {
      console.error('Unexpected error:', error);
    }
    return false;
  }
}
```

---

## TTL and Automatic Cleanup

### Cleanup Expired Rollouts

```typescript
// Manual cleanup of expired rollouts
const deletedCount = await RolloutRecorder.cleanupExpired();
console.log(`Cleaned up ${deletedCount} expired rollouts`);
```

### Background Cleanup (Chrome Extension Service Worker)

```typescript
// Setup periodic cleanup in service worker
chrome.runtime.onInstalled.addListener(() => {
  // Create alarm for hourly cleanup
  chrome.alarms.create('rollout-cleanup', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'rollout-cleanup') {
    const deletedCount = await RolloutRecorder.cleanupExpired();
    console.log(`Background cleanup: deleted ${deletedCount} rollouts`);
  }
});
```

### Integrate TTL with AgentConfig

```typescript
// Load user's TTL preference from config
import { ConfigManager } from './config/ConfigManager';

async function createRolloutWithUserPreferences(
  conversationId: string,
  instructions?: string
): Promise<RolloutRecorder> {
  const configManager = new ConfigManager();
  const userConfig = await configManager.load();

  // Create rollout with user's preferred TTL
  return new RolloutRecorder(
    { type: 'create', conversationId, instructions },
    userConfig
  );
}
```

### Update TTL for Existing Rollout

```typescript
// Update TTL configuration via AgentConfig
async function updateRolloutTTL(ttlDays: number | 'permanent'): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  // Update config
  config.storage = {
    ...config.storage,
    rolloutTTL: ttlDays
  };

  await configManager.save(config);
  console.log(`Rollout TTL updated to: ${ttlDays}`);
}

// Usage
await updateRolloutTTL(90); // 90 days
await updateRolloutTTL('permanent'); // Never expire
```

## Storage Quota Management

```typescript
import { StorageQuotaManager } from './storage/StorageQuotaManager';

async function checkStorageAndRecord(
  recorder: RolloutRecorder,
  items: RolloutItem[]
): Promise<void> {
  const quotaManager = new StorageQuotaManager();
  const quota = await quotaManager.getQuota();

  if (quota.percentage > 90) {
    console.warn('Storage nearly full, cleaning up');

    // 1. First, cleanup expired rollouts
    const expiredCount = await RolloutRecorder.cleanupExpired();
    console.log(`Deleted ${expiredCount} expired rollouts`);

    // 2. If still low on space, cleanup old rollouts
    const updatedQuota = await quotaManager.getQuota();
    if (updatedQuota.percentage > 85) {
      await cleanupOldRollouts();
    }
  }

  await recorder.recordItems(items);
}

async function cleanupOldRollouts(): Promise<void> {
  const page = await RolloutRecorder.listConversations(100);

  // Keep only last 50 conversations, delete older ones
  const toDelete = page.items.slice(50);

  for (const item of toDelete) {
    // Delete rollout (implementation depends on IndexedDB schema)
    await deleteRollout(item.id);
  }
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RolloutRecorder } from './RolloutRecorder';
import 'fake-indexeddb/auto';

describe('RolloutRecorder', () => {
  let recorder: RolloutRecorder;

  beforeEach(async () => {
    recorder = await new RolloutRecorder({
      type: 'create',
      conversationId: '5973b6c0-94b8-487b-a530-2aeb6098ae0e',
      instructions: 'Test conversation'
    });
  });

  it('should create new rollout', () => {
    expect(recorder.getRolloutId()).toBe('5973b6c0-94b8-487b-a530-2aeb6098ae0e');
  });

  it('should record items', async () => {
    await recorder.recordItems([
      {
        type: 'response_item',
        payload: { type: 'message', content: 'Hello' }
      }
    ]);

    await recorder.flush();

    const history = await RolloutRecorder.getRolloutHistory(recorder.getRolloutId());
    expect(history.type).toBe('resumed');
    if (history.type === 'resumed') {
      expect(history.payload.history.length).toBeGreaterThan(0);
    }
  });

  afterEach(async () => {
    await recorder.shutdown();
  });
});
```

---

## Performance Tips

1. **Batch Writes**: Group multiple `recordItems()` calls, then flush once
2. **Avoid Excessive Flushing**: Only flush when persistence is critical
3. **Pagination**: Use cursor-based pagination for large conversation lists
4. **Cleanup**: Regularly delete old rollouts to manage storage

---

## Troubleshooting

### "Database not initialized"
**Cause**: Constructor not awaited
**Solution**: Ensure `await new RolloutRecorder(...)`

### "Rollout not found"
**Cause**: Invalid rolloutId in resume mode
**Solution**: Verify rolloutId exists via `listConversations()`

### "Quota exceeded"
**Cause**: IndexedDB storage full
**Solution**: Implement cleanup strategy, delete old rollouts

### Slow list performance
**Cause**: Too many conversations
**Solution**: Reduce pageSize, implement filtering

---

## Next Steps

1. Implement RolloutRecorder class following contracts
2. Add persistence policy filtering (rolloutPolicy.ts)
3. Integrate with existing Session/Codex classes
4. Add storage quota monitoring
5. Implement JSONL export/import features

---

## References

- Contract: `./contracts/RolloutRecorder.md`
- Data Model: `./data-model.md`
- Research: `./research.md`
- Rust Implementation: `codex-rs/core/src/rollout/recorder.rs`
