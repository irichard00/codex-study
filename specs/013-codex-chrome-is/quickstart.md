# Quickstart: codex-chrome Model Client Alignment

**Feature**: Align codex-chrome Model Client with codex-rs
**Date**: 2025-10-05
**Purpose**: Integration test scenarios derived from user stories in spec.md

## Overview

This quickstart validates the aligned model client implementation through end-to-end scenarios. Each scenario corresponds to an acceptance criterion from the feature specification.

## Prerequisites

```bash
# Install dependencies
cd codex-chrome
npm install

# Set up environment (for testing)
export OPENAI_API_KEY="sk-test-..."

# Build project
npm run build

# Run tests
npm test
```

## Scenario 1: API Key Authentication & Streaming

**From Spec**: Acceptance Scenario 1 - User configures API key and initiates streaming

### Setup

```typescript
import { OpenAIResponsesClient } from './src/models/OpenAIResponsesClient';
import type { Prompt } from './src/models/types/ResponsesAPI';

// Configure client with API key
const client = new OpenAIResponsesClient({
  apiKey: process.env.OPENAI_API_KEY!,
  conversationId: 'test-session-001',
  modelFamily: {
    family: 'gpt-4',
    baseInstructions: 'You are a helpful assistant.',
    supportsReasoningSummaries: false,
    needsSpecialApplyPatchInstructions: false,
  },
  provider: {
    name: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    wireApi: 'Responses',
    requestMaxRetries: 3,
  },
});
```

### Action

```typescript
// Create prompt
const prompt: Prompt = {
  input: [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Say hello!' }],
    },
  ],
  tools: [],
};

// Initiate streaming
const stream = await client.stream(prompt);
```

### Expected Outcome

```typescript
// Consume events
for await (const event of stream) {
  switch (event.type) {
    case 'RateLimits':
      console.log('Rate limits:', event.snapshot);
      break;
    case 'Created':
      console.log('Response created');
      break;
    case 'OutputTextDelta':
      process.stdout.write(event.delta);
      break;
    case 'Completed':
      console.log('\nCompleted:', event.responseId);
      console.log('Token usage:', event.tokenUsage);
      break;
  }
}

// ✅ PASS: Stream yields events as they arrive
// ✅ PASS: Events follow correct order (RateLimits → Created → deltas → Completed)
// ✅ PASS: API key authentication successful
```

---

## Scenario 2: Rate Limit Retry

**From Spec**: Acceptance Scenario 2 - Auto-retry on 429 with retry-after header

### Setup

```typescript
// Same client configuration as Scenario 1
// Mock server to return 429 on first attempt

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.post('https://api.openai.com/v1/responses', async ({ request }, { count }) => {
    if (count === 1) {
      // First attempt: Rate limit
      return HttpResponse.json(
        { error: { message: 'Rate limit exceeded' } },
        {
          status: 429,
          headers: { 'Retry-After': '2' }, // 2 seconds
        }
      );
    }

    // Second attempt: Success
    return new HttpResponse(
      'data: {"type":"response.created"}\n\ndata: [DONE]\n\n',
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  })
);
```

### Action

```typescript
server.listen();

const startTime = Date.now();
const stream = await client.stream(prompt);

// Consume stream
for await (const event of stream) {
  // Process events...
}

const elapsed = Date.now() - startTime;
server.close();
```

### Expected Outcome

```typescript
// ✅ PASS: First request fails with 429
// ✅ PASS: Client automatically retries after ~2 seconds
// ✅ PASS: Retry-After header respected (elapsed ≈ 2000ms)
// ✅ PASS: Second request succeeds
// ✅ PASS: Stream yields events normally

assert(elapsed >= 2000);
assert(elapsed < 3000); // Allow some jitter
```

---

## Scenario 3: SSE Event Processing

**From Spec**: Acceptance Scenario 3 - Real-time SSE event emission

### Setup

```typescript
// Mock SSE stream
const sseData = `
data: {"type":"response.created","response":{}}

data: {"type":"response.output_item.done","item":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Hello"}]}}

data: {"type":"response.output_text.delta","delta":" world"}

data: {"type":"response.completed","response":{"id":"resp_123","usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15}}}

data: [DONE]
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(sseData));
    controller.close();
  },
});
```

### Action

```typescript
// Process SSE events
const events: ResponseEvent[] = [];
for await (const event of client.processSSE(stream)) {
  events.push(event);
}
```

### Expected Outcome

```typescript
// ✅ PASS: Events parsed correctly
assert(events[0].type === 'Created');
assert(events[1].type === 'OutputItemDone');
assert(events[1].item.content[0].text === 'Hello');
assert(events[2].type === 'OutputTextDelta');
assert(events[2].delta === ' world');
assert(events[3].type === 'Completed');
assert(events[3].responseId === 'resp_123');
assert(events[3].tokenUsage.input_tokens === 10);
assert(events[3].tokenUsage.output_tokens === 5);

// ✅ PASS: All SSE event types handled (FR-018)
// ✅ PASS: Events emitted in real-time (not buffered)
// ✅ PASS: Completed event emitted last (FR-019)
```

---

## Scenario 4: Provider Extensibility

**From Spec**: Acceptance Scenario 4 - Interface consistency across providers

### Setup

```typescript
// Define custom provider client (hypothetical Gemini)
class GeminiClient extends ModelClient {
  async stream(prompt: Prompt): Promise<ResponseStream> {
    // Gemini-specific implementation
    // ...
  }

  getModelContextWindow(): number | undefined {
    return 1000000; // Gemini context window
  }

  getAutoCompactTokenLimit(): number | undefined {
    return 800000; // 80% of context window
  }

  getModelFamily(): ModelFamily {
    return {
      family: 'gemini',
      baseInstructions: 'You are a helpful assistant.',
      supportsReasoningSummaries: false,
      needsSpecialApplyPatchInstructions: false,
    };
  }

  getProvider(): ModelProviderInfo {
    return {
      name: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      wireApi: 'Chat', // Different wire protocol
      requestMaxRetries: 3,
    };
  }

  // ... implement other abstract methods
}
```

### Action

```typescript
// Use same interface for both providers
const clients: ModelClient[] = [
  new OpenAIResponsesClient(openaiConfig),
  new GeminiClient(geminiConfig),
];

for (const client of clients) {
  const stream = await client.stream(prompt);
  for await (const event of stream) {
    // Process events (same interface for all providers)
  }
}
```

### Expected Outcome

```typescript
// ✅ PASS: Same interface used for all providers
// ✅ PASS: No calling code changes needed
// ✅ PASS: Each provider implements protocol-specific logic internally
// ✅ PASS: Abstract base class enforces consistent interface
```

---

## Scenario 5: Model Capability Queries

**From Spec**: Acceptance Scenario 5 - Query context window and token limits

### Setup

```typescript
const client = new OpenAIResponsesClient({
  // ... config
  modelFamily: {
    family: 'gpt-4',
    // ...
  },
});

// Set model
client.setModel('gpt-4');
```

### Action

```typescript
const contextWindow = client.getModelContextWindow();
const autoCompactLimit = client.getAutoCompactTokenLimit();
const model = client.getModel();
const modelFamily = client.getModelFamily();
const provider = client.getProvider();
```

### Expected Outcome

```typescript
// ✅ PASS: Methods return correct values
assert(contextWindow === 8192); // GPT-4 context window
assert(autoCompactLimit === Math.floor(8192 * 0.8)); // ~6553
assert(model === 'gpt-4');
assert(modelFamily.family === 'gpt-4');
assert(provider.name === 'openai');

// ✅ PASS: Method names match Rust exactly (FR-001)
// getModelContextWindow() ✓ (not getContextWindow())
// getAutoCompactTokenLimit() ✓
// getModelFamily() ✓
```

---

## Edge Cases

### Edge Case 1: Invalid API Key

```typescript
// Given: Invalid API key
const client = new OpenAIResponsesClient({
  apiKey: 'invalid-key',
  // ... other config
});

// When: Streaming request
try {
  const stream = await client.stream(prompt);
  for await (const event of stream) {
    // Should not reach here
  }
  assert.fail('Should have thrown');
} catch (error) {
  // Then: Throws auth error immediately without retry
  assert(error instanceof ModelClientError);
  assert(error.statusCode === 401);
  // ✅ PASS: No retry on auth error (FR-033)
}
```

### Edge Case 2: SSE Stream Timeout

```typescript
// Given: SSE stream that hangs
const slowStream = new ReadableStream({
  start(controller) {
    // Never sends data (simulates timeout)
  },
});

// When: Processing with timeout
try {
  const events = [];
  for await (const event of client.processSSE(slowStream)) {
    events.push(event);
  }
} catch (error) {
  // Then: Idle timeout detected and stream closed
  assert(error.message.includes('idle timeout'));
  // ✅ PASS: Timeout handling works
}
```

### Edge Case 3: Missing Rate Limit Headers

```typescript
// Given: Response without rate limit headers
const headers = new Headers();
const snapshot = client.parseRateLimitSnapshot(headers);

// Then: Returns undefined
assert(snapshot === undefined);
// ✅ PASS: Handles missing headers gracefully

// Given: Response with partial headers (only primary)
headers.set('x-codex-primary-used-percent', '75.5');
const partialSnapshot = client.parseRateLimitSnapshot(headers);

// Then: Returns snapshot with only primary window
assert(partialSnapshot.primary !== undefined);
assert(partialSnapshot.secondary === undefined);
// ✅ PASS: Partial data handled correctly
```

### Edge Case 4: response.failed SSE Event

```typescript
// Given: SSE stream with response.failed event
const failedData = `
data: {"type":"response.failed","response":{"error":{"message":"Internal error","code":"internal_error"}}}
`;

// When: Processing SSE
try {
  for await (const event of client.processSSE(failedStream)) {
    // Should not yield events
  }
} catch (error) {
  // Then: Throws with error message
  assert(error.message === 'Internal error');
  // ✅ PASS: response.failed handled correctly (FR-012)
}
```

### Edge Case 5: Azure Endpoint Detection

```typescript
// Given: Azure OpenAI endpoint
const azureClient = new OpenAIResponsesClient({
  baseUrl: 'https://my-resource.openai.azure.com',
  // ... other config
});

// When: Building request payload
const stream = await azureClient.stream(prompt);

// Then: store: true workaround applied
// (Internal verification - check request payload)
// ✅ PASS: Azure workaround detected and applied (FR-030)
```

---

## Validation Checklist

After running all scenarios:

- [ ] All 5 acceptance scenarios pass
- [ ] All 5 edge cases handled correctly
- [ ] Method names match Rust exactly (FR-001)
- [ ] Field names use snake_case (FR-002, FR-037)
- [ ] SSE event ordering correct (FR-010)
- [ ] Retry logic matches Rust (FR-011, FR-033-035)
- [ ] All SSE event types handled (FR-018)
- [ ] Browser APIs used exclusively (FR-015-016)
- [ ] No OAuth/token refresh code (FR-014)
- [ ] Legacy code removed (FR-025-027)

## Success Criteria

**All tests pass** ✅ means:
1. Model client aligned with Rust implementation
2. Contract tests verify interface compliance
3. Integration tests validate end-to-end workflows
4. Edge cases handled robustly
5. Performance goals met (<10ms SSE processing, <200ms stream init)

**Next Steps**: Run `/tasks` to generate implementation tasks from this quickstart and Phase 1 design artifacts.
