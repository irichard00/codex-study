# Quickstart Guide: Implementing Missing Codex Chrome Components

## Overview
This guide walks through implementing the critical missing components for the codex-chrome extension. We already have ~80% of the infrastructure in place - this guide focuses ONLY on the missing pieces.

## What's Already Implemented ✅
- Chrome extension setup (Vite, TypeScript, Svelte)
- Protocol types (Submission, Op, Event, EventMsg)
- Basic infrastructure (CodexAgent, Session, MessageRouter, QueueProcessor)
- Model clients (OpenAI, Anthropic)
- Basic browser tools (TabTool, DOMTool, StorageTool, NavigationTool)
- ApprovalManager and DiffTracker
- UI components (sidepanel, popup)

## What's Missing and Needs Implementation ❌
1. **AgentTask** - Critical coordinator class
2. **StreamProcessor** - Browser streaming handler
3. **Enhanced Browser Tools** - Advanced automation
4. **Persistence Layer** - IndexedDB storage

## Quick Implementation Steps

### Step 1: Implement AgentTask (Priority 1)

The most critical missing component. This coordinates the entire task execution.

```typescript
// src/core/AgentTask.ts
import type { Session } from './Session';
import type { ResponseItem, Turn } from '../protocol/types';
import { EventEmitter } from '../utils/EventEmitter';

export class AgentTask {
  private session: Session;
  private submissionId: string;
  private input: ResponseItem[];
  private eventEmitter: EventEmitter;
  private isReviewMode: boolean;
  private currentTurnIndex = 0;
  private maxTurns = 50;
  private status: 'running' | 'completed' | 'failed' | 'cancelled' = 'running';

  constructor(
    session: Session,
    submissionId: string,
    input: ResponseItem[],
    eventEmitter: EventEmitter,
    isReviewMode = false
  ) {
    this.session = session;
    this.submissionId = submissionId;
    this.input = input;
    this.eventEmitter = eventEmitter;
    this.isReviewMode = isReviewMode;
  }

  async run(): Promise<void> {
    try {
      this.eventEmitter.emit('TaskStarted', {
        submission_id: this.submissionId,
        turn_type: this.isReviewMode ? 'review' : 'user'
      });

      await this.runTurnLoop();

      this.status = 'completed';
      this.eventEmitter.emit('TaskComplete', {
        submission_id: this.submissionId
      });
    } catch (error) {
      this.status = 'failed';
      this.handleError(error);
    }
  }

  private async runTurnLoop(): Promise<void> {
    while (this.currentTurnIndex < this.maxTurns && this.status === 'running') {
      if (this.shouldAutoCompact()) {
        await this.compactContext();
      }

      const turn = await this.session.turnManager.createTurn(this.input);
      await this.session.turnManager.executeTurn(turn);

      this.currentTurnIndex++;

      if (await this.isTaskComplete()) {
        break;
      }
    }
  }

  private shouldAutoCompact(): boolean {
    const tokenUsage = this.session.getTokenUsage();
    return tokenUsage.used / tokenUsage.max > 0.75;
  }

  private async compactContext(): Promise<void> {
    // Implement context compaction
    this.eventEmitter.emit('CompactionEvent', {
      turn_index: this.currentTurnIndex,
      timestamp: Date.now()
    });
  }

  // ... rest of implementation
}
```

### Step 2: Wire AgentTask into TaskRunner

Update the existing TaskRunner to use AgentTask:

```typescript
// src/core/TaskRunner.ts (update existing)
import { AgentTask } from './AgentTask';

export class TaskRunner {
  async runTask(submission: Submission): Promise<void> {
    const agentTask = new AgentTask(
      this.session,
      submission.id,
      this.parseInput(submission),
      this.eventEmitter,
      this.isReviewMode(submission)
    );

    this.currentTask = agentTask;
    await agentTask.run();
  }
}
```

### Step 3: Implement StreamProcessor

Handle browser streaming efficiently:

```typescript
// src/core/StreamProcessor.ts
export class StreamProcessor {
  private buffer: Uint8Array[] = [];
  private status: 'idle' | 'streaming' | 'paused' | 'completed' = 'idle';
  private updateCallbacks: ((update: UIUpdate) => void)[] = [];

  async start(stream: ReadableStream): Promise<void> {
    const reader = stream.getReader();
    this.status = 'streaming';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await this.processChunk(value);

        if (this.shouldApplyBackpressure()) {
          this.pause();
          await this.waitForBuffer();
          this.resume();
        }
      }

      this.status = 'completed';
    } finally {
      reader.releaseLock();
    }
  }

  // ... implementation
}
```

### Step 4: Add Enhanced Browser Tools

Create advanced tools that extend the existing ones:

```typescript
// src/tools/WebScrapingTool.ts
import { BaseTool } from './BaseTool';

export class WebScrapingTool extends BaseTool {
  name = 'web_scraping';
  description = 'Extract structured data from web pages';

  async execute(params: ScrapingParams): Promise<any> {
    const tab = await chrome.tabs.get(params.tabId);

    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: params.tabId },
      func: this.extractData,
      args: [params.pattern]
    });

    // ... implementation
  }

  private extractData(pattern: ScrapingPattern): any {
    // Runs in page context
    const elements = document.querySelectorAll(pattern.selector);
    return Array.from(elements).map(el => ({
      text: el.textContent,
      html: el.innerHTML,
      attributes: Object.fromEntries(
        Array.from(el.attributes).map(a => [a.name, a.value])
      )
    }));
  }
}
```

### Step 5: Implement Persistence Layer

Add IndexedDB storage for conversations:

```typescript
// src/storage/ConversationStore.ts
export class ConversationStore {
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CodexConversations', 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('updated', 'updated');
        }

        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId');
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ... CRUD operations
}
```

## Integration Checklist

### 1. Update CodexAgent.ts
```typescript
// Add AgentTask to the main agent
import { AgentTask } from './AgentTask';

export class CodexAgent {
  // ... existing code

  async processSubmission(submission: Submission): Promise<void> {
    if (submission.op.type === 'UserTurn') {
      // Use AgentTask instead of direct TaskRunner
      const task = new AgentTask(
        this.session,
        submission.id,
        this.parseInput(submission.op),
        this.eventEmitter
      );
      await task.run();
    }
    // ... handle other operations
  }
}
```

### 2. Register New Tools
```typescript
// src/tools/index.ts
import { WebScrapingTool } from './WebScrapingTool';
import { FormAutomationTool } from './FormAutomationTool';
import { NetworkInterceptTool } from './NetworkInterceptTool';

export function registerAdvancedTools(registry: ToolRegistry): void {
  registry.register(new WebScrapingTool());
  registry.register(new FormAutomationTool());
  registry.register(new NetworkInterceptTool());
}
```

### 3. Initialize Storage on Extension Start
```typescript
// src/background/service-worker.ts
import { ConversationStore } from '../storage/ConversationStore';
import { CacheManager } from '../storage/CacheManager';

// On extension startup
chrome.runtime.onInstalled.addListener(async () => {
  const store = new ConversationStore();
  await store.initialize();

  const cache = new CacheManager();
  await cache.initialize();
});
```

## Testing the Implementation

### Test AgentTask Integration
```bash
# Run existing tests to ensure nothing breaks
npm test

# Add new test for AgentTask
npm test -- AgentTask
```

### Manual Testing Steps
1. Load extension in Chrome developer mode
2. Open side panel
3. Start a conversation that requires multiple turns
4. Verify AgentTask coordinates properly
5. Check IndexedDB in DevTools for persistence

## Common Issues and Solutions

### Issue: AgentTask not coordinating turns
**Solution**: Ensure TaskRunner is updated to use AgentTask instead of direct turn execution.

### Issue: Streaming responses not showing in UI
**Solution**: Connect StreamProcessor to UI update system via EventEmitter.

### Issue: IndexedDB quota exceeded
**Solution**: Implement cleanup in ConversationStore for old conversations.

## Next Steps

1. **Implement AgentTask first** - It's the critical missing piece
2. **Test with existing infrastructure** - Ensure compatibility
3. **Add StreamProcessor** - Improve UI responsiveness
4. **Enhance tools incrementally** - Start with WebScrapingTool
5. **Add persistence last** - Once core functionality works

## Quick Commands

```bash
# Build the extension
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev

# Type check
npm run type-check
```

## Resources

- [AgentTask Contract](./contracts/AgentTask.md) - Full API specification
- [Data Model](./data-model-missing.md) - Complete type definitions
- [Research](./research.md) - Analysis of missing components
- [Original codex-rs](../../codex-rs/core/src/codex.rs) - Reference implementation

## Support

For issues or questions:
- Check the [implementation plan](./implementation-plan.md)
- Review the [contracts](./contracts/) for API details
- Reference the original codex-rs code for behavior