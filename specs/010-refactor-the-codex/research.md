# Research: Rust-to-TypeScript Model Client Alignment

**Feature**: 010-refactor-the-codex
**Date**: 2025-10-02
**Source**: codex-rs/core/src/client.rs (Rust reference implementation)
**Target**: codex-chrome/src/models/ (TypeScript browser implementation)

## Overview

This document captures research findings for aligning the TypeScript model client implementation with the Rust reference implementation. The Rust code serves as the source of truth for method signatures, types, and execution flow.

## 1. Rust → TypeScript Type System Mappings

### Core Type Mappings

| Rust Type | TypeScript Equivalent | Rationale |
|-----------|----------------------|-----------|
| `Option<T>` | `T \| undefined` | JS/TS uses undefined for absent values |
| `Result<T, E>` | `Promise<T>` (throws on error) | Async errors propagate via exceptions |
| `Arc<T>` | Direct reference to `T` | GC manages memory, no manual ref counting |
| `&str`, `String` | `string` | Immutable strings in both |
| `u64`, `i64` | `number` | JS only has IEEE 754 floats, use BigInt if >2^53 |
| `bool` | `boolean` | Direct mapping |
| `Vec<T>` | `T[]` or `Array<T>` | JS arrays are dynamic |
| `HashMap<K, V>` | `Map<K, V>` or `Record<string, V>` | Map for non-string keys |
| `enum` (variants) | Union type with `type` discriminator | `type Event = { type: 'A' } \| { type: 'B' }` |
| `struct` | `interface` or `type` | Structural typing |
| `impl Trait` | `interface` or abstract class | Nominal typing in TS classes |

### Async/Concurrency Mappings

| Rust Pattern | TypeScript Equivalent | Notes |
|--------------|----------------------|-------|
| `async fn foo() -> Result<T>` | `async foo(): Promise<T>` | Errors thrown, not returned |
| `tokio::spawn(...)` | `Promise.resolve().then(...)` or setTimeout | No threads in browser |
| `mpsc::channel()` | Custom class with event buffer | See ResponseStream pattern below |
| `impl Stream<Item = T>` | `AsyncGenerator<T>` or `AsyncIterableIterator<T>` | For-await iteration |
| `tokio::time::timeout()` | `Promise.race([fetch(), timeoutPromise()])` | AbortController for cancellation |

## 2. ResponseStream Pattern

### Rust Implementation (from client.rs)

```rust
pub struct ResponseStream {
    pub(crate) rx_event: mpsc::Receiver<Result<ResponseEvent>>,
}

impl Stream for ResponseStream {
    type Item = Result<ResponseEvent>;
    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.rx_event.poll_recv(cx)
    }
}
```

**Key characteristics**:
- Channel-based: producer sends to `tx`, consumer receives from `rx`
- Backpressure: channel has bounded capacity (1600 in Rust code)
- Poll-based: implements `Stream` trait with `poll_next`

### TypeScript Implementation Strategy

**Decision**: Implement `ResponseStream` as an async iterable class

```typescript
class ResponseStream {
  private eventBuffer: ResponseEvent[] = [];
  private isCompleted = false;
  private error: Error | null = null;

  // Producer interface
  addEvent(event: ResponseEvent): void;
  complete(): void;
  error(err: Error): void;

  // Consumer interface (async iteration)
  async *[Symbol.asyncIterator](): AsyncIterableIterator<ResponseEvent>;
}
```

**Rationale**:
- Matches Rust's producer/consumer separation
- Uses JS/TS idiom (`for await (const event of stream)`)
- Supports backpressure via buffer size limits
- Handles errors via error state + exception throwing

**Usage pattern**:
```typescript
// Producer (inside ModelClient)
const stream = new ResponseStream();
spawn(async () => {
  for (const sseEvent of sseStream) {
    stream.addEvent(parseEvent(sseEvent));
  }
  stream.complete();
});
return stream;

// Consumer
for await (const event of stream) {
  console.log(event.type);
}
```

## 3. Method Signature Alignment

### Analysis of Rust ModelClient (from client.rs:85-445)

**Public Methods**:

1. **Constructor**:
   ```rust
   pub fn new(
       config: Arc<Config>,
       auth_manager: Option<Arc<AuthManager>>,
       otel_event_manager: OtelEventManager,
       provider: ModelProviderInfo,
       effort: Option<ReasoningEffortConfig>,
       summary: ReasoningSummaryConfig,
       conversation_id: ConversationId,
   ) -> Self
   ```

   **TypeScript**:
   ```typescript
   constructor(config: {
     apiKey: string;
     modelFamily: ModelFamily;
     provider: ModelProviderInfo;
     conversationId: string;
     reasoningEffort?: ReasoningEffortConfig;
     reasoningSummary?: ReasoningSummaryConfig;
   })
   ```
   **Note**: Simplified for browser - no Arc, no OtelEventManager (use console), no AuthManager (use Chrome Storage)

2. **get_model_context_window** (line 109-113):
   ```rust
   pub fn get_model_context_window(&self) -> Option<u64>
   ```

   **TypeScript**:
   ```typescript
   getModelContextWindow(): number | undefined
   ```

3. **get_auto_compact_token_limit** (line 115-119):
   ```rust
   pub fn get_auto_compact_token_limit(&self) -> Option<i64>
   ```

   **TypeScript**:
   ```typescript
   getAutoCompactTokenLimit(): number | undefined
   ```

4. **stream** (line 124-164):
   ```rust
   pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream>
   ```

   **TypeScript**:
   ```typescript
   async stream(prompt: Prompt): Promise<ResponseStream>
   ```
   **CRITICAL**: Current TS returns `AsyncGenerator<StreamChunk>` - must change to `ResponseStream`

5. **get_provider** (line 414-416):
   ```rust
   pub fn get_provider(&self) -> ModelProviderInfo
   ```

   **TypeScript**:
   ```typescript
   getProvider(): ModelProviderInfo
   ```

6. **get_model** (line 423-425):
   ```rust
   pub fn get_model(&self) -> String
   ```

   **TypeScript**:
   ```typescript
   getModel(): string
   ```

7. **get_model_family** (line 428-430):
   ```rust
   pub fn get_model_family(&self) -> ModelFamily
   ```

   **TypeScript**:
   ```typescript
   getModelFamily(): ModelFamily
   ```

8. **get_reasoning_effort** (line 433-435):
   ```rust
   pub fn get_reasoning_effort(&self) -> Option<ReasoningEffortConfig>
   ```

   **TypeScript**:
   ```typescript
   getReasoningEffort(): ReasoningEffortConfig | undefined
   ```

9. **get_reasoning_summary** (line 437-439):
   ```rust
   pub fn get_reasoning_summary(&self) -> ReasoningSummaryConfig
   ```

   **TypeScript**:
   ```typescript
   getReasoningSummary(): ReasoningSummaryConfig
   ```

10. **get_auth_manager** (line 442-444):
    ```rust
    pub fn get_auth_manager(&self) -> Option<Arc<AuthManager>>
    ```

    **TypeScript**:
    ```typescript
    getAuthManager(): undefined  // Always undefined in browser
    ```

### Private Helper Methods

1. **stream_responses** (line 167-266):
   ```rust
   async fn stream_responses(&self, prompt: &Prompt) -> Result<ResponseStream>
   ```

   **TypeScript**:
   ```typescript
   private async streamResponses(prompt: Prompt): Promise<ResponseStream>
   ```

2. **attempt_stream_responses** (line 269-412):
   ```rust
   async fn attempt_stream_responses(
       &self,
       attempt: u64,
       payload_json: &Value,
       auth_manager: &Option<Arc<AuthManager>>,
   ) -> std::result::Result<ResponseStream, StreamAttemptError>
   ```

   **TypeScript**:
   ```typescript
   private async attemptStreamResponses(
     attempt: number,
     payload: ResponsesApiRequest,
   ): Promise<ResponseStream> // throws StreamAttemptError
   ```

3. **process_sse** (line 624-848):
   ```rust
   async fn process_sse<S>(
       stream: S,
       tx_event: mpsc::Sender<Result<ResponseEvent>>,
       idle_timeout: Duration,
       otel_event_manager: OtelEventManager,
   ) where S: Stream<Item = Result<Bytes>> + Unpin
   ```

   **TypeScript**:
   ```typescript
   private async *processSSE(
     stream: ReadableStream<Uint8Array>,
     headers?: Headers
   ): AsyncGenerator<ResponseEvent>
   ```
   **Note**: Returns generator instead of sending to channel (different pattern in TS)

4. **parse_rate_limit_snapshot** (line 567-583):
   ```rust
   fn parse_rate_limit_snapshot(headers: &HeaderMap) -> Option<RateLimitSnapshot>
   ```

   **TypeScript**:
   ```typescript
   private parseRateLimitSnapshot(headers?: Headers): RateLimitSnapshot | undefined
   ```

## 4. SSE Processing

### Rust Pattern (from client.rs:624-848)

The `process_sse` function:
1. Takes a stream and sends events to a channel
2. Parses SSE data lines into `SseEvent` structs
3. Matches event types and forwards `ResponseEvent` variants
4. Handles completion, errors, timeouts
5. Runs in separate task (`tokio::spawn`)

**Key event types** (line 712-846):
- `response.created` → `ResponseEvent::Created`
- `response.output_item.done` → `ResponseEvent::OutputItemDone(item)`
- `response.output_text.delta` → `ResponseEvent::OutputTextDelta(delta)`
- `response.reasoning_summary_text.delta` → `ResponseEvent::ReasoningSummaryDelta(delta)`
- `response.reasoning_text.delta` → `ResponseEvent::ReasoningContentDelta(delta)`
- `response.completed` → `ResponseEvent::Completed { response_id, token_usage }`
- `response.failed` → Error
- Ignored: `response.in_progress`, `response.output_text.done`, etc.

### TypeScript Strategy

**Decision**: Create `SSEEventParser` class to encapsulate SSE → ResponseEvent logic

```typescript
class SSEEventParser {
  parse(data: string): SseEvent | null;
  processEvent(event: SseEvent): ResponseEvent[];
}
```

**Usage in processSSE**:
```typescript
private async *processSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<ResponseEvent> {
  const parser = new SSEEventParser();
  const reader = stream.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += new TextDecoder().decode(value);
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
}
```

**Rationale**:
- Separation of concerns: parsing vs streaming
- Testable: can unit test SSEEventParser independently
- Matches Rust's separation of parsing logic

## 5. Browser Environment Deviations

### Required Adaptations

| Rust Feature | Browser Limitation | TypeScript Solution |
|--------------|-------------------|---------------------|
| `reqwest::Client` | No HTTP client library | `fetch()` API with retry logic |
| `AuthManager` with file I/O | No filesystem access | Chrome Storage API for API keys |
| `tokio::spawn` | No threads/async runtime | Promises + async generators |
| `stream_from_fixture` (test helper) | No file I/O | In-memory test fixtures as strings |
| `OtelEventManager` | No OpenTelemetry | Console logging + performance.now() |
| `create_client()` (custom TLS) | Browser manages TLS | Use fetch() defaults |
| `backoff()` utility | Custom exponential backoff | Inline calculation with Math.pow() |

### API Key Authentication

**Rust approach** (uses auth tokens from files):
```rust
let auth = auth_manager.as_ref().and_then(|m| m.auth());
```

**TypeScript approach** (Chrome Storage):
```typescript
const apiKey = await chrome.storage.local.get(['openai_api_key']);
headers['Authorization'] = `Bearer ${apiKey}`;
```

### HTTP Requests

**Rust** (client.rs:284-308):
```rust
let mut req_builder = self.provider
    .create_request_builder(&self.client, &auth)
    .await?;
req_builder = req_builder
    .header("OpenAI-Beta", "responses=experimental")
    .json(payload_json);
let res = req_builder.send().await;
```

**TypeScript**:
```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'OpenAI-Beta': 'responses=experimental',
  },
  body: JSON.stringify(payload),
});
```

## 6. Extensibility for Future LLMs

### Current Design

**Rust**: Uses `WireApi` enum to dispatch between Responses and Chat APIs (line 125-163):
```rust
match self.provider.wire_api {
    WireApi::Responses => self.stream_responses(prompt).await,
    WireApi::Chat => { /* chat completions logic */ }
}
```

### TypeScript Strategy

**Decision**: Use factory pattern with provider-specific clients

```typescript
// Factory
class ModelClientFactory {
  static create(config: ModelClientConfig): ModelClient {
    switch (config.provider.wireApi) {
      case 'responses':
        return new OpenAIResponsesClient(config);
      case 'chat':
        return new OpenAIChatClient(config);
      case 'anthropic':
        return new AnthropicClient(config);
      case 'gemini':
        return new GeminiClient(config);
      default:
        throw new Error(`Unknown provider: ${config.provider.name}`);
    }
  }
}

// Base interface
abstract class ModelClient {
  abstract stream(prompt: Prompt): Promise<ResponseStream>;
  // ... other methods
}
```

**Rationale**:
- Follows Rust's dispatch pattern
- Easy to add new providers (implement ModelClient interface)
- Type-safe via abstract class + concrete implementations
- Matches existing `ModelClientFactory.ts` pattern

## 7. Performance Considerations

### SSE Processing Performance Target

**From plan.md**: <10ms per event

**Rust achieves this via**:
- Zero-copy parsing where possible
- Channel with 1600 event buffer
- Concurrent processing (tokio tasks)

**TypeScript strategy**:
- Reuse TextDecoder instance (no per-event allocation)
- Batch process lines (parse multiple events per read)
- Use object pooling for frequently allocated types
- Early returns on ignored event types

**Measurement**:
```typescript
class SSEEventParser {
  private metrics = { totalProcessed: 0, totalTime: 0 };

  parse(data: string): SseEvent | null {
    const start = performance.now();
    // ... parsing logic
    this.metrics.totalTime += performance.now() - start;
    this.metrics.totalProcessed++;
    return event;
  }

  getPerformanceMetrics() {
    return {
      averageTime: this.metrics.totalTime / this.metrics.totalProcessed,
      totalProcessed: this.metrics.totalProcessed,
    };
  }
}
```

## 8. Testing Strategy

### Contract Tests (TDD Approach)

**Rust tests** (client.rs:913-1329):
- Table-driven tests for event types
- Fixture-based SSE parsing tests
- Error handling tests

**TypeScript strategy**:
1. Port Rust test fixtures to TypeScript
2. Write contract tests verifying:
   - Method signatures match Rust
   - Return types match (accounting for type mappings)
   - Event types match Rust enum variants
3. Tests FAIL initially (no implementation)
4. Refactor to make tests pass

**Example test**:
```typescript
describe('ModelClient Contract', () => {
  it('stream() returns ResponseStream matching Rust signature', async () => {
    const client = new OpenAIResponsesClient(config);
    const prompt: Prompt = { input: [], tools: [] };

    const stream = await client.stream(prompt);

    // Contract: returns ResponseStream
    expect(stream).toBeInstanceOf(ResponseStream);

    // Contract: ResponseStream is async iterable
    expect(stream[Symbol.asyncIterator]).toBeDefined();

    // Contract: yields ResponseEvent
    for await (const event of stream) {
      expect(['Created', 'OutputItemDone', 'Completed', /* ... */])
        .toContain(event.type);
    }
  });
});
```

## Summary of Research Decisions

1. **Type Mappings**: Use standard Rust→TS mappings (Option→undefined, Result→Promise)
2. **ResponseStream**: Implement as async iterable class matching Rust channel pattern
3. **Method Names**: Convert snake_case to camelCase while preserving semantics
4. **SSE Processing**: Extract into SSEEventParser class matching Rust's process_sse
5. **Browser Adaptations**: Use fetch(), Chrome Storage, document all deviations
6. **Extensibility**: Factory pattern with provider-specific clients
7. **Performance**: <10ms per event via batching and object reuse
8. **Testing**: TDD with contract tests ported from Rust fixtures

All decisions documented and ready for implementation phase.
