# SSE Processing API Contract

**Feature**: 010-refactor-the-codex
**Rust Reference**: `codex-rs/core/src/client.rs:624-848`
**TypeScript Target**: `codex-chrome/src/models/SSEEventParser.ts` + ModelClient.processSSE()

## Contract Overview

This contract defines Server-Sent Events (SSE) processing for the OpenAI Responses API. The TypeScript implementation must match Rust's event parsing and transformation logic.

## SSE Event Flow

### Rust Pattern (line 624-848)

```rust
async fn process_sse<S>(
    stream: S,
    tx_event: mpsc::Sender<Result<ResponseEvent>>,
    idle_timeout: Duration,
    otel_event_manager: OtelEventManager,
) where S: Stream<Item = Result<Bytes>> + Unpin {
    let mut stream = stream.eventsource();

    loop {
        let sse = timeout(idle_timeout, stream.next()).await;
        match sse {
            Ok(Some(Ok(sse))) => {
                let event: SseEvent = serde_json::from_str(&sse.data)?;
                // Process event.kind and forward to channel
            }
            // ... error handling
        }
    }
}
```

### TypeScript Pattern

```typescript
protected async *processSSE(
  stream: ReadableStream<Uint8Array>,
  headers?: Headers
): AsyncGenerator<ResponseEvent> {
  const parser = new SSEEventParser();
  const reader = stream.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = parser.parse(line.slice(6));
          if (event) {
            yield* parser.processEvent(event);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

## SSEEventParser API

### parse()

**Signature**:
```typescript
parse(data: string): SseEvent | null
```

**Contract**:
- **Input**: Raw SSE data string (without `data:` prefix)
- **Output**: Parsed `SseEvent` object, or `null` if invalid JSON
- **Behavior**:
  - Attempts to parse JSON
  - Returns null on parse failure (logs debug message)
  - Validates required fields (type)

**SseEvent Structure**:
```typescript
interface SseEvent {
  type: string;        // Event type (e.g., "response.created")
  response?: unknown;  // Response data (for completed/failed events)
  item?: unknown;      // Item data (for output_item.done events)
  delta?: string;      // Delta text (for text delta events)
}
```

**Example**:
```typescript
const data = '{"type":"response.created","response":{}}';
const event = parser.parse(data);
// Returns: { type: 'response.created', response: {} }
```

---

### processEvent()

**Signature**:
```typescript
processEvent(event: SseEvent): ResponseEvent[]
```

**Contract**:
- **Input**: Parsed `SseEvent`
- **Output**: Array of `ResponseEvent` objects (usually 0 or 1, may be multiple for batching)
- **Behavior**: Matches Rust's event.kind switch logic (line 712-846)

**Event Type Mapping** (must match Rust exactly):

1. **`"response.created"`** → `{ type: 'Created' }`
   - Rust: line 767-770

2. **`"response.output_item.done"`** → `{ type: 'OutputItemDone', item }`
   - Rust: line 731-742
   - Parses `event.item` as `ResponseItem`
   - Returns empty array if item parsing fails

3. **`"response.output_text.delta"`** → `{ type: 'OutputTextDelta', delta }`
   - Rust: line 743-749
   - Extracts `event.delta` string

4. **`"response.reasoning_summary_text.delta"`** → `{ type: 'ReasoningSummaryDelta', delta }`
   - Rust: line 751-757

5. **`"response.reasoning_text.delta"`** → `{ type: 'ReasoningContentDelta', delta }`
   - Rust: line 759-766

6. **`"response.reasoning_summary_part.added"`** → `{ type: 'ReasoningSummaryPartAdded' }`
   - Rust: line 837-842

7. **`"response.output_item.added"`** (with `type: "web_search_call"`)
   → `{ type: 'WebSearchCallBegin', callId }`
   - Rust: line 819-835
   - Only if `event.item.type === "web_search_call"`
   - Extracts `event.item.id` as `callId`

8. **`"response.completed"`** → Store completion data (no immediate yield)
   - Rust: line 798-811
   - Stores `ResponseCompleted` with id and usage
   - Actual `Completed` event yielded when stream ends

9. **`"response.failed"`** → Throws Error
   - Rust: line 772-795
   - Parses error message from `event.response.error`
   - Throws `ModelClientError` with error message

10. **Ignored Events** (return empty array):
    - Rust: line 813-818, 844
    - `"response.in_progress"`
    - `"response.output_text.done"`
    - `"response.content_part.done"`
    - `"response.function_call_arguments.delta"`
    - `"response.custom_tool_call_input.delta"`
    - `"response.custom_tool_call_input.done"`
    - `"response.reasoning_summary_text.done"`

11. **Unknown Events** → Log debug, return empty array
    - Rust: line 845 (empty match arm)
    - Console.debug but don't fail

**Example**:
```typescript
const event: SseEvent = {
  type: 'response.output_text.delta',
  delta: 'Hello',
};

const responseEvents = parser.processEvent(event);
// Returns: [{ type: 'OutputTextDelta', delta: 'Hello' }]
```

---

## processSSE() Integration

**Signature**:
```typescript
protected async *processSSE(
  stream: ReadableStream<Uint8Array>,
  headers?: Headers
): AsyncGenerator<ResponseEvent>
```

**Contract**:
- **Input**:
  - `stream`: ReadableStream from fetch response body
  - `headers`: Optional HTTP response headers
- **Output**: AsyncGenerator yielding `ResponseEvent` objects
- **Behavior**:
  1. Yield rate limits if headers present (call `parseRateLimitSnapshot()`)
  2. Process SSE stream line-by-line
  3. Parse each `data:` line via `SSEEventParser.parse()`
  4. Convert to ResponseEvent via `SSEEventParser.processEvent()`
  5. Yield ResponseEvent objects as they're generated
  6. On stream end: yield final `Completed` event if stored
  7. On stream end without completion: throw error

**Timeout Handling**:
- Use `Promise.race()` with timeout promise
- Timeout duration from `provider.streamIdleTimeoutMs`
- Throw `ResponseStreamError('TIMEOUT')` on timeout

**Completion Handling** (Rust line 651-688):
```typescript
let responseCompleted: { id: string; usage?: TokenUsage } | null = null;

// During event processing:
if (event.type === 'response.completed') {
  responseCompleted = {
    id: event.response.id,
    usage: event.response.usage ? convertTokenUsage(event.response.usage) : undefined,
  };
  // Don't yield yet - wait for stream end
}

// After stream ends:
if (responseCompleted) {
  yield {
    type: 'Completed',
    responseId: responseCompleted.id,
    tokenUsage: responseCompleted.usage,
  };
} else {
  throw new Error('Stream closed before response.completed');
}
```

---

## Token Usage Conversion

**Rust Structure** (line 503-538):
```rust
struct ResponseCompletedUsage {
    input_tokens: u64,
    input_tokens_details: Option<ResponseCompletedInputTokensDetails>,
    output_tokens: u64,
    output_tokens_details: Option<ResponseCompletedOutputTokensDetails>,
    total_tokens: u64,
}

struct ResponseCompletedInputTokensDetails {
    cached_tokens: u64,
}

struct ResponseCompletedOutputTokensDetails {
    reasoning_tokens: u64,
}
```

**TypeScript Conversion**:
```typescript
function convertTokenUsage(usage: ResponseCompletedUsage): TokenUsage {
  return {
    input_tokens: usage.input_tokens,
    cached_input_tokens: usage.input_tokens_details?.cached_tokens || 0,
    output_tokens: usage.output_tokens,
    reasoning_output_tokens: usage.output_tokens_details?.reasoning_tokens || 0,
    total_tokens: usage.total_tokens,
  };
}
```

---

## Error Handling

### Parse Errors

**Rust Behavior** (line 704-710):
```rust
let event: SseEvent = match serde_json::from_str(&sse.data) {
    Ok(event) => event,
    Err(e) => {
        debug!("Failed to parse SSE event: {e}, data: {}", &sse.data);
        continue;  // Skip event, don't fail stream
    }
};
```

**TypeScript Equivalent**:
```typescript
parse(data: string): SseEvent | null {
  try {
    return JSON.parse(data) as SseEvent;
  } catch (e) {
    console.debug('Failed to parse SSE event:', e, 'data:', data);
    return null;  // Skip event
  }
}
```

### Stream Errors

**Rust Behavior** (line 645-650):
```rust
Ok(Some(Err(e))) => {
    debug!("SSE Error: {e:#}");
    let event = CodexErr::Stream(e.to_string(), None);
    let _ = tx_event.send(Err(event)).await;
    return;
}
```

**TypeScript Equivalent**:
```typescript
try {
  const { done, value } = await reader.read();
  // ... process value
} catch (e) {
  console.debug('SSE Error:', e);
  throw new ResponseStreamError('Stream error', 'STREAM_ERROR', e);
}
```

### Idle Timeout

**Rust Behavior** (line 690-698):
```rust
Err(_) => {  // timeout elapsed
    let _ = tx_event
        .send(Err(CodexErr::Stream(
            "idle timeout waiting for SSE".into(),
            None,
        )))
        .await;
    return;
}
```

**TypeScript Equivalent**:
```typescript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new ResponseStreamError(
      `Idle timeout waiting for SSE (${timeout}ms)`,
      'TIMEOUT'
    ));
  }, timeout);
});

const { value, done } = await Promise.race([
  reader.read(),
  timeoutPromise,
]);
```

---

## Contract Test Requirements

Tests must verify:

1. **Event Parsing**:
   - All Rust event types parsed correctly
   - Invalid JSON returns null (no throw)
   - Missing fields handled gracefully

2. **Event Mapping**:
   - Each Rust event.kind → correct ResponseEvent variant
   - Field names converted correctly (snake_case → camelCase)
   - Ignored events return empty array

3. **Stream Processing**:
   - Line buffering works correctly
   - Multiple events in single chunk handled
   - Partial lines buffered until complete

4. **Completion**:
   - `response.completed` data stored
   - Final `Completed` event yielded after stream ends
   - Error thrown if stream ends without completion

5. **Error Handling**:
   - Parse errors don't fail stream
   - Stream errors throw exception
   - Timeout throws after idle period

6. **Performance**:
   - Event processing <10ms per event
   - Batch processing multiple events per read

## Example Contract Test

```typescript
describe('SSE Processing Contract', () => {
  let parser: SSEEventParser;

  beforeEach(() => {
    parser = new SSEEventParser();
  });

  describe('Event Mapping (matches Rust)', () => {
    it('response.created → Created', () => {
      const event: SseEvent = { type: 'response.created', response: {} };
      const result = parser.processEvent(event);

      expect(result).toEqual([{ type: 'Created' }]);
    });

    it('response.output_text.delta → OutputTextDelta', () => {
      const event: SseEvent = {
        type: 'response.output_text.delta',
        delta: 'Hello',
      };
      const result = parser.processEvent(event);

      expect(result).toEqual([{ type: 'OutputTextDelta', delta: 'Hello' }]);
    });

    it('response.failed → throws error', () => {
      const event: SseEvent = {
        type: 'response.failed',
        response: {
          error: { message: 'Test error' },
        },
      };

      expect(() => parser.processEvent(event)).toThrow('Test error');
    });

    it('ignores response.in_progress', () => {
      const event: SseEvent = { type: 'response.in_progress' };
      const result = parser.processEvent(event);

      expect(result).toEqual([]);
    });
  });

  describe('processSSE() Integration', () => {
    it('processes full SSE stream matching Rust behavior', async () => {
      const sseData = `
data: {"type":"response.created","response":{}}

data: {"type":"response.output_text.delta","delta":"Hi"}

data: {"type":"response.completed","response":{"id":"123","usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15}}}

      `.trim();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      });

      const events: ResponseEvent[] = [];
      const client = new OpenAIResponsesClient(config);

      for await (const event of (client as any).processSSE(stream)) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('Created');
      expect(events[1].type).toBe('OutputTextDelta');
      expect(events[2].type).toBe('Completed');
      expect((events[2] as any).responseId).toBe('123');
    });
  });

  describe('Performance', () => {
    it('processes events in <10ms', () => {
      const event: SseEvent = {
        type: 'response.output_text.delta',
        delta: 'Test',
      };

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        parser.processEvent(event);
      }
      const elapsed = performance.now() - start;

      const avgTime = elapsed / 1000;
      expect(avgTime).toBeLessThan(10); // <10ms per event
    });
  });
});
```

## Summary

SSE processing contract defines:
- 2 SSEEventParser methods (parse, processEvent)
- 1 ModelClient method (processSSE)
- 11 event type mappings (exact match to Rust)
- Error handling (parse errors, stream errors, timeout)
- Completion handling (store then yield)
- Performance requirement (<10ms per event)
- Full behavioral equivalence to Rust's process_sse function
