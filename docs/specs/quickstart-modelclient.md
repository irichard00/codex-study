# ModelClient Alignment Quick Start Guide

## Overview
This guide helps developers quickly implement the aligned ModelClient with OpenAI Responses API support in the Chrome extension.

## Prerequisites
- Node.js 20+ and pnpm
- Chrome 120+ for extension development
- OpenAI API key
- TypeScript 5.0+

## Installation

### 1. Set up development environment
```bash
# Clone the repository
git clone https://github.com/your-org/codex-study.git
cd codex-study/codex-chrome

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### 2. Create feature branch
```bash
git checkout -b feature/modelclient-alignment
```

## Quick Implementation

### Step 1: Add Core Types
Create `src/models/types/ResponseEvent.ts`:

```typescript
export type ResponseEvent =
  | { type: 'Created' }
  | { type: 'OutputItemDone'; item: ResponseItem }
  | { type: 'OutputTextDelta'; delta: string }
  | { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage };

export interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}
```

### Step 2: Create OpenAI Responses Client
Create `src/models/OpenAIResponsesClient.ts`:

```typescript
import { ModelClient } from './ModelClient';
import { ResponseEvent, TokenUsage } from './types/ResponseEvent';

export class OpenAIResponsesClient extends ModelClient {
  private baseUrl = 'https://api.openai.com/v1';

  async streamResponses(prompt: Prompt): Promise<AsyncGenerator<ResponseEvent>> {
    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'responses=experimental',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model: this.model,
        instructions: prompt.instructions,
        input: prompt.input,
        stream: true
      })
    });

    return this.processSSEStream(response.body!);
  }

  private async *processSSEStream(
    stream: ReadableStream
  ): AsyncGenerator<ResponseEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          const event = JSON.parse(data);
          const responseEvent = this.parseSSEEvent(event);
          if (responseEvent) yield responseEvent;
        }
      }
    }
  }

  private parseSSEEvent(event: any): ResponseEvent | null {
    switch (event.type) {
      case 'response.created':
        return { type: 'Created' };
      case 'response.output_text.delta':
        return { type: 'OutputTextDelta', delta: event.delta };
      case 'response.completed':
        return {
          type: 'Completed',
          responseId: event.response.id,
          tokenUsage: this.extractTokenUsage(event.response.usage)
        };
      default:
        return null;
    }
  }
}
```

### Step 3: Add Rate Limit Support
Create `src/models/RateLimitManager.ts`:

```typescript
export class RateLimitManager {
  private snapshot: RateLimitSnapshot | null = null;

  updateFromHeaders(headers: Headers): void {
    const primary = this.parseWindow(
      headers.get('x-codex-primary-used-percent'),
      headers.get('x-codex-primary-window-minutes'),
      headers.get('x-codex-primary-reset-after-seconds')
    );

    if (primary) {
      this.snapshot = { primary };
    }
  }

  private parseWindow(
    usedPercent: string | null,
    windowMinutes: string | null,
    resetsInSeconds: string | null
  ): RateLimitWindow | null {
    if (!usedPercent) return null;

    return {
      used_percent: parseFloat(usedPercent),
      window_minutes: windowMinutes ? parseInt(windowMinutes) : undefined,
      resets_in_seconds: resetsInSeconds ? parseInt(resetsInSeconds) : undefined
    };
  }

  getSnapshot(): RateLimitSnapshot | null {
    return this.snapshot;
  }
}
```

### Step 4: Implement Retry Logic
Update `src/models/ModelClient.ts`:

```typescript
protected calculateBackoff(attempt: number): number {
  const INITIAL_DELAY_MS = 1000;
  const BACKOFF_FACTOR = 2.0;

  const exp = Math.pow(BACKOFF_FACTOR, Math.max(0, attempt - 1));
  const base = INITIAL_DELAY_MS * exp;
  const jitter = 0.9 + Math.random() * 0.2; // 10% jitter
  return Math.floor(base * jitter);
}

protected async withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxRetries) break;

      if (!this.isRetryable(error)) break;

      const delay = this.calculateBackoff(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

## Testing

### Basic Test
```typescript
import { OpenAIResponsesClient } from './OpenAIResponsesClient';

async function testStreaming() {
  const client = new OpenAIResponsesClient('your-api-key', {
    model: 'gpt-4',
    conversation_id: 'test-123'
  });

  const prompt = {
    instructions: 'You are a helpful assistant',
    input: [
      { type: 'message', role: 'user', content: 'Hello!' }
    ]
  };

  const stream = await client.streamResponses(prompt);

  for await (const event of stream) {
    console.log('Event:', event.type);
    if (event.type === 'OutputTextDelta') {
      process.stdout.write(event.delta);
    }
  }
}
```

### Chrome Extension Integration
```typescript
// In background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'STREAM_COMPLETION') {
    handleStreaming(request.prompt).then(sendResponse);
    return true; // Keep channel open
  }
});

async function handleStreaming(prompt: any) {
  const client = new OpenAIResponsesClient(apiKey, config);
  const events: ResponseEvent[] = [];

  const stream = await client.streamResponses(prompt);
  for await (const event of stream) {
    events.push(event);

    // Send to content script
    chrome.tabs.sendMessage(activeTabId, {
      type: 'STREAM_EVENT',
      event
    });
  }

  return { success: true, events };
}
```

## Common Patterns

### 1. Event Routing
```typescript
class EventRouter {
  private handlers = new Map<string, (event: ResponseEvent) => void>();

  on(eventType: string, handler: (event: ResponseEvent) => void) {
    this.handlers.set(eventType, handler);
  }

  route(event: ResponseEvent) {
    const handler = this.handlers.get(event.type);
    if (handler) handler(event);
  }
}

// Usage
const router = new EventRouter();
router.on('OutputTextDelta', (event) => {
  updateUI(event.delta);
});
router.on('Completed', (event) => {
  console.log('Tokens:', event.tokenUsage);
});
```

### 2. Token Tracking
```typescript
class TokenTracker {
  private total: TokenUsage = {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0
  };

  update(usage: TokenUsage) {
    this.total.input_tokens += usage.input_tokens;
    this.total.output_tokens += usage.output_tokens;
    this.total.total_tokens += usage.total_tokens;
  }

  shouldCompact(limit: number): boolean {
    return this.total.total_tokens > limit * 0.8;
  }
}
```

### 3. Error Recovery
```typescript
async function streamWithRecovery(client: OpenAIResponsesClient, prompt: any) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const stream = await client.streamResponses(prompt);
      return stream;
    } catch (error: any) {
      attempts++;

      if (error.statusCode === 429) {
        const retryAfter = error.retryAfter || 5000;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
      } else if (attempts === maxAttempts) {
        throw error;
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. SSE Parsing Errors
```typescript
// Add debug logging
private parseSSEEvent(event: any): ResponseEvent | null {
  console.debug('Parsing SSE event:', event.type);
  try {
    // parsing logic
  } catch (error) {
    console.error('SSE parse error:', error, event);
    return null;
  }
}
```

#### 2. Rate Limiting
```typescript
// Check rate limits before requests
const rateLimits = client.getRateLimitSnapshot();
if (rateLimits?.primary?.used_percent > 90) {
  console.warn('Approaching rate limit:', rateLimits);
  // Implement backoff
}
```

#### 3. Memory Issues
```typescript
// Implement stream cleanup
async function* streamWithCleanup(stream: AsyncGenerator<ResponseEvent>) {
  try {
    yield* stream;
  } finally {
    // Cleanup resources
    if ('return' in stream) {
      await stream.return();
    }
  }
}
```

## Migration Checklist

- [ ] Install new dependencies
- [ ] Add ResponseEvent types
- [ ] Create OpenAIResponsesClient
- [ ] Implement SSE parser
- [ ] Add rate limit tracking
- [ ] Update retry logic
- [ ] Add token usage tracking
- [ ] Create unit tests
- [ ] Test in Chrome extension
- [ ] Update documentation

## Next Steps

1. **Extend Features**
   - Add reasoning support
   - Implement web search events
   - Add GPT-5 text controls

2. **Optimize Performance**
   - Use Web Workers for SSE parsing
   - Implement stream buffering
   - Add request queuing

3. **Improve Testing**
   - Add mock SSE streams
   - Create integration tests
   - Add performance benchmarks

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review the [API contracts](./contracts/modelclient-api.md)
- Consult the [data model specification](./data-model-modelclient.md)