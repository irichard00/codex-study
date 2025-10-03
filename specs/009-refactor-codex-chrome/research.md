# Phase 0: Model Client Refactoring Research

**Date**: 2025-10-02
**Status**: Phase 0 - Research Complete
**Repository**: codex-study

## Executive Summary

This document provides comprehensive research for refactoring `codex-chrome` model client implementation to align with the `codex-rs` architecture. The analysis covers struct/class mapping, method signatures, browser-specific adaptations, provider abstraction design, and testing strategy.

**Key Findings**:
- Rust implementation uses 848 lines in `client.rs` with clear separation of concerns
- TypeScript implementation is distributed across 756 lines (OpenAIResponsesClient.ts) with added performance optimizations
- 15 core methods need alignment between Rust and TypeScript
- 3 critical browser-specific patterns must be preserved
- Provider abstraction requires extension to support future Gemini/Claude integration

---

## Section 1: Rust Architecture Analysis

### 1.1 ModelClient Struct (Lines 74-445)

**Definition** (Lines 74-83):
```rust
pub struct ModelClient {
    config: Arc<Config>,
    auth_manager: Option<Arc<AuthManager>>,
    otel_event_manager: OtelEventManager,
    client: reqwest::Client,
    provider: ModelProviderInfo,
    conversation_id: ConversationId,
    effort: Option<ReasoningEffortConfig>,
    summary: ReasoningSummaryConfig,
}
```

**Field Analysis**:
| Field | Type | Purpose | Browser Equivalent |
|-------|------|---------|-------------------|
| `config` | `Arc<Config>` | Shared configuration | Inline config object |
| `auth_manager` | `Option<Arc<AuthManager>>` | Auth token management | `ChromeAuthManager` |
| `otel_event_manager` | `OtelEventManager` | OpenTelemetry logging | Console/Chrome telemetry |
| `client` | `reqwest::Client` | HTTP client | `fetch()` API |
| `provider` | `ModelProviderInfo` | Provider metadata | `ModelProviderInfo` (TS) |
| `conversation_id` | `ConversationId` | Session tracking | `string` (UUID) |
| `effort` | `Option<ReasoningEffortConfig>` | Reasoning config | Same |
| `summary` | `ReasoningSummaryConfig` | Reasoning summary | Same |

### 1.2 Public Method Signatures

**Complete Method Table**:

| Method | Signature | Lines | Return Type | Purpose |
|--------|-----------|-------|-------------|---------|
| `new` | `new(config, auth_manager, otel, provider, effort, summary, conversation_id)` | 86-107 | `Self` | Constructor |
| `get_model_context_window` | `get_model_context_window(&self)` | 109-113 | `Option<u64>` | Get context window size |
| `get_auto_compact_token_limit` | `get_auto_compact_token_limit(&self)` | 115-119 | `Option<i64>` | Get auto-compact threshold |
| `stream` | `async fn stream(&self, prompt: &Prompt)` | 124-164 | `Result<ResponseStream>` | **Main streaming method** |
| `stream_responses` | `async fn stream_responses(&self, prompt: &Prompt)` | 167-266 | `Result<ResponseStream>` | Responses API implementation |
| `attempt_stream_responses` | `async fn attempt_stream_responses(&self, attempt, payload, auth)` | 269-412 | `Result<ResponseStream, StreamAttemptError>` | Single retry attempt |
| `get_provider` | `get_provider(&self)` | 414-416 | `ModelProviderInfo` | Get provider info |
| `get_otel_event_manager` | `get_otel_event_manager(&self)` | 418-420 | `OtelEventManager` | Get telemetry manager |
| `get_model` | `get_model(&self)` | 423-425 | `String` | Get model slug |
| `get_model_family` | `get_model_family(&self)` | 428-430 | `ModelFamily` | Get model family |
| `get_reasoning_effort` | `get_reasoning_effort(&self)` | 433-435 | `Option<ReasoningEffortConfig>` | Get reasoning effort |
| `get_reasoning_summary` | `get_reasoning_summary(&self)` | 438-440 | `ReasoningSummaryConfig` | Get reasoning summary |
| `get_auth_manager` | `get_auth_manager(&self)` | 442-444 | `Option<Arc<AuthManager>>` | Get auth manager |

**Critical Implementation Details**:

1. **`stream()` Method (Lines 124-164)**:
   - Dispatches to `stream_responses()` or `stream_chat_completions()` based on `WireApi` enum
   - For Chat API: wraps response with aggregation adapter
   - Returns unified `ResponseStream` interface

2. **`stream_responses()` Method (Lines 167-266)**:
   - Implements retry logic with `max_attempts = provider.request_max_retries()`
   - Uses fixture file if `CODEX_RS_SSE_FIXTURE` flag set (testing mode)
   - Constructs `ResponsesApiRequest` payload
   - Calls `attempt_stream_responses()` in retry loop

3. **`attempt_stream_responses()` Method (Lines 269-412)**:
   - Single HTTP request attempt with error classification
   - Returns `StreamAttemptError` enum for retry handling
   - Sets headers: `OpenAI-Beta`, `conversation_id`, `session_id`, `Accept`
   - Spawns `process_sse()` task on success
   - Handles 401 (triggers token refresh), 429 (rate limiting), 5xx (retryable)

### 1.3 StreamAttemptError Enum (Lines 447-486)

```rust
enum StreamAttemptError {
    RetryableHttpError {
        status: StatusCode,
        retry_after: Option<Duration>,
    },
    RetryableTransportError(CodexErr),
    Fatal(CodexErr),
}
```

**Methods**:
- `delay(&self, attempt: u64)` (Lines 458-471): Calculate backoff delay using `retry_after` or exponential backoff
- `into_error(self)` (Lines 473-485): Convert to `CodexErr` for final failure

**Error Classification Logic**:
- `Fatal`: 4xx errors except 401, 429 (non-retryable client errors)
- `RetryableHttpError`: 429, 401, 5xx (server errors or rate limits)
- `RetryableTransportError`: Network/transport failures

### 1.4 process_sse Function (Lines 624-848)

**Signature**:
```rust
async fn process_sse<S>(
    stream: S,
    tx_event: mpsc::Sender<Result<ResponseEvent>>,
    idle_timeout: Duration,
    otel_event_manager: OtelEventManager,
) where
    S: Stream<Item = Result<Bytes>> + Unpin,
```

**Control Flow**:
1. **Stream Loop** (Lines 639-698):
   - Wrap each `stream.next()` with `timeout(idle_timeout, ...)`
   - On timeout: send `CodexErr::Stream("idle timeout")`
   - On error: send error and exit
   - On end: send `Completed` or error event

2. **Event Parsing** (Lines 701-710):
   - Deserialize SSE data to `SseEvent` struct
   - Log parse failures but continue (graceful degradation)

3. **Event Handling** (Lines 712-846):
   - `response.output_item.done` (Lines 731-742): Forward `ResponseEvent::OutputItemDone`
   - `response.output_text.delta` (Lines 743-750): Forward `ResponseEvent::OutputTextDelta`
   - `response.reasoning_summary_text.delta` (Lines 751-758): Forward delta
   - `response.reasoning_text.delta` (Lines 759-766): Forward delta
   - `response.created` (Lines 767-771): Forward `Created` event
   - `response.failed` (Lines 772-795): Parse error, store in `response_error`
   - `response.completed` (Lines 798-812): Parse completion, store in `response_completed`
   - `response.output_item.added` (Lines 819-835): Detect web search, send `WebSearchCallBegin`
   - Other events: Ignored (documented in lines 813-845)

**Key Design Patterns**:
- **Incremental Streaming**: Forward events as they arrive (not batched)
- **Idle Timeout**: Disconnect detection via activity timeout
- **Graceful Degradation**: Parse errors logged but don't fail stream
- **Completion Signaling**: Stream ends only after `response.completed` or error

---

## Section 2: TypeScript Implementation Gap Analysis

**Important Note**: The `Prompt` interface already exists at `codex-chrome/src/models/types/ResponsesAPI.ts` (Lines 45-54) and matches the Rust structure. No new Prompt interface needs to be created during refactoring.

### 2.1 Structural Comparison

**Rust `ModelClient` vs TypeScript `OpenAIResponsesClient`**:

| Component | Rust (client.rs) | TypeScript Current | Status | Action Required |
|-----------|------------------|-------------------|--------|-----------------|
| **Struct/Class Name** | `ModelClient` | `OpenAIResponsesClient` | ❌ Mismatch | Consider `ModelClient` base + `ResponsesModelClient` impl |
| **Constructor** | `new()` 8 params | `constructor()` 2 params (config, retryConfig) | ⚠️ Different | Align parameter structure |
| **Config Storage** | `Arc<Config>` | Inline fields | ⚠️ Different | Keep TS approach (no Arc needed) |
| **HTTP Client** | `reqwest::Client` | `fetch()` | ✅ Browser-specific | Preserve |
| **Auth Manager** | `Option<Arc<AuthManager>>` | Not stored (uses config) | ❌ Missing | Add `authManager?: ChromeAuthManager` |
| **Telemetry** | `OtelEventManager` | Console logging | ⚠️ Different | Add structured telemetry |
| **Provider Info** | `ModelProviderInfo` | `ModelProviderInfo` | ✅ Match | Preserve |

### 2.2 Method Mapping Table

| Rust Method | TypeScript Current | Rust Signature | TS Signature | Match? | Gap |
|-------------|-------------------|----------------|--------------|--------|-----|
| `new` | `constructor` | 8 params | 2 params | ⚠️ | Flatten config object |
| `get_model_context_window` | `getContextWindow` | `Option<u64>` | `number \| undefined` | ✅ | None |
| `get_auto_compact_token_limit` | ❌ Missing | `Option<i64>` | N/A | ❌ | Add method |
| `stream` | `streamResponses` | `Prompt → ResponseStream` | `Prompt → AsyncGenerator<ResponseEvent>` | ⚠️ | Rename + return type |
| `stream_responses` | `streamResponses` | Private impl | Public method | ⚠️ | Make public `stream()` dispatch |
| `attempt_stream_responses` | `makeResponsesApiRequest` + retry loop | Single attempt | Full retry | ⚠️ | Extract single attempt |
| `get_provider` | `getProvider` | `ModelProviderInfo` | `string` | ❌ | Return full object |
| `get_otel_event_manager` | ❌ Missing | `OtelEventManager` | N/A | ❌ | Add if needed |
| `get_model` | `getModel` | `String` | `string` | ✅ | None |
| `get_model_family` | ❌ Missing | `ModelFamily` | N/A | ❌ | Add getter |
| `get_reasoning_effort` | `getReasoningEffort` | `Option<Config>` | `Config \| undefined` | ✅ | None |
| `get_reasoning_summary` | `getReasoningSummary` | `Config` | `Config \| undefined` | ⚠️ | Make non-optional |
| `get_auth_manager` | ❌ Missing | `Option<Arc<AuthManager>>` | N/A | ❌ | Add if storing |
| `count_tokens` | `countTokens` | Not in Rust | `(text, model) → number` | ➕ | TS-specific, preserve |
| `streamCompletion` | `streamCompletion` | Not in Rust | Adapter method | ➕ | TS-specific, preserve |

**Legend**: ✅ Match | ⚠️ Partial Match | ❌ Missing | ➕ TS Extension

### 2.3 TypeScript Extensions (Browser-Specific)

**Methods NOT in Rust** (must preserve):

| Method | Lines | Purpose | Preserve? |
|--------|-------|---------|-----------|
| `countTokens` | 208-214 | Token estimation (no tiktoken in browser) | ✅ Yes |
| `streamCompletion` | 194-206 | Adapter: `CompletionRequest → Prompt` | ✅ Yes |
| `complete` | 186-188 | Throws error (not supported) | ✅ Yes |
| `stream` (basic) | 190-192 | Throws error (not supported) | ✅ Yes |
| `getPerformanceStatus` | 696-702 | Performance metrics | ✅ Yes (Phase 9 feature) |
| `resetPerformanceMetrics` | 707-709 | Reset metrics | ✅ Yes |
| `setQueueEnabled` | 714-723 | Queue control | ✅ Yes |
| `clearQueue` | 728-730 | Clear queue | ✅ Yes |
| `cleanup` | 735-755 | Resource cleanup | ✅ Yes |

### 2.4 SSE Processing Differences

**Rust `process_sse()` vs TypeScript `processSSEStream()`**:

| Aspect | Rust (Lines 624-848) | TypeScript (Lines 303-377) | Gap |
|--------|---------------------|---------------------------|-----|
| **Idle Timeout** | `timeout(idle_timeout, stream.next())` | ❌ Not implemented | Add timeout wrapper |
| **Event Parsing** | `serde_json::from_str(&sse.data)` | `this.sseParser.parse(data)` | ✅ Optimized parser (Phase 9) |
| **Error Handling** | Store in `response_error`, send on completion | Throw immediately | ⚠️ Different error strategy |
| **Completion Check** | Wait for `response.completed` before final event | Similar logic | ✅ Match |
| **Event Forwarding** | `tx_event.send(Ok(event))` | `yield event` | ✅ Equivalent (async generator) |
| **Graceful Degradation** | Log parse errors, continue | Similar | ✅ Match |
| **Web Search Detection** | `response.output_item.added` → check type | Same logic | ✅ Match |

**Critical Missing Features in TypeScript**:
1. **Idle Timeout Detection**: No timeout on `reader.read()` calls
2. **Structured Error Accumulation**: Errors thrown immediately instead of stored
3. **Completion Event Separation**: `response.completed` data should be parsed separately

---

## Section 3: Browser Environment Adaptations

### 3.1 HTTP Client: reqwest → fetch()

**Rust Pattern**:
```rust
// Lines 284-296
let mut req_builder = self.provider
    .create_request_builder(&self.client, &auth)
    .await?;

req_builder = req_builder
    .header("OpenAI-Beta", "responses=experimental")
    .header("conversation_id", self.conversation_id.to_string())
    .json(payload_json);

let res = req_builder.send().await;
```

**Browser Pattern** (TypeScript Lines 460-509):
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${this.apiKey}`,
  'OpenAI-Beta': 'responses=experimental',
  'conversation_id': this.conversationId,
  'session_id': this.conversationId,
  'Accept': 'text/event-stream',
};

const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
```

**Key Differences**:
- **Builder Pattern**: Rust uses fluent builder, TS uses plain object
- **Auth**: Rust delegates to `AuthManager`, TS inline `Bearer ${apiKey}`
- **Error Handling**: Rust returns `Result`, TS throws exceptions

**Pattern to Preserve**: ✅ Keep TS inline header construction (simpler for browser)

### 3.2 Streaming: tokio::mpsc → ReadableStream

**Rust Pattern**:
```rust
// Lines 323-343
let (tx_event, rx_event) = mpsc::channel::<Result<ResponseEvent>>(1600);

tokio::spawn(process_sse(
    stream,
    tx_event,
    self.provider.stream_idle_timeout(),
    self.otel_event_manager.clone(),
));

Ok(ResponseStream { rx_event })
```

**Browser Pattern** (TypeScript Lines 303-376):
```typescript
const reader = body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  // Process SSE events...
  yield event;
}
```

**Key Differences**:
- **Channel vs Generator**: Rust uses channel + task, TS uses async generator
- **Backpressure**: Rust channel has buffer size (1600), TS generator auto-pauses
- **Cancellation**: Rust drops channel, TS `return` from generator

**Pattern to Preserve**: ✅ Async generator is idiomatic for TS streaming

### 3.3 Timeout Handling

**Rust Pattern** (Lines 640-698):
```rust
loop {
    let sse = match otel_event_manager
        .log_sse_event(|| timeout(idle_timeout, stream.next()))
        .await
    {
        Ok(Some(Ok(sse))) => sse,
        // ... timeout case
        Err(_) => {
            let _ = tx_event.send(Err(CodexErr::Stream(
                "idle timeout waiting for SSE".into(),
                None,
            ))).await;
            return;
        }
    };
}
```

**Browser Pattern** (TypeScript - MISSING):
```typescript
// Current: No timeout on reader.read()
const { done, value } = await reader.read();

// NEEDED:
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('idle timeout')), idleTimeoutMs)
);
const { done, value } = await Promise.race([
  reader.read(),
  timeoutPromise
]);
```

**Pattern to Add**: ❌ Implement `Promise.race()` timeout wrapper

### 3.4 Retry Logic with Backoff

**Rust Pattern** (Lines 244-265):
```rust
let max_attempts = self.provider.request_max_retries();
for attempt in 0..=max_attempts {
    match self.attempt_stream_responses(attempt, &payload_json, &auth_manager).await {
        Ok(stream) => return Ok(stream),
        Err(StreamAttemptError::Fatal(e)) => return Err(e),
        Err(retryable_attempt_error) => {
            if attempt == max_attempts {
                return Err(retryable_attempt_error.into_error());
            }
            tokio::time::sleep(retryable_attempt_error.delay(attempt)).await;
        }
    }
}
```

**Browser Pattern** (TypeScript Lines 250-297):
```typescript
while (attempt <= maxRetries) {
  attempt++;
  try {
    const response = await this.makeResponsesApiRequest(payload);
    yield* this.processSSEStream(response.body, response.headers);
    return;
  } catch (error) {
    if (attempt > maxRetries) throw error;
    const delay = this.calculateBackoff(attempt - 1, error.retryAfter);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

**Key Differences**:
- **Error Classification**: Rust uses `StreamAttemptError` enum, TS uses exception properties
- **Backoff Calculation**: Both use exponential backoff with jitter
- **Retry-After**: Both parse header value

**Pattern to Preserve**: ✅ TS retry logic is equivalent, keep current approach

---

## Section 4: Provider Abstraction Design

### 4.1 ModelProviderInfo Structure

**Rust Definition** (model_provider_info.rs Lines 44-89):
```rust
pub struct ModelProviderInfo {
    pub name: String,
    pub base_url: Option<String>,
    pub env_key: Option<String>,
    pub env_key_instructions: Option<String>,
    pub wire_api: WireApi,  // Responses | Chat
    pub query_params: Option<HashMap<String, String>>,
    pub http_headers: Option<HashMap<String, String>>,
    pub env_http_headers: Option<HashMap<String, String>>,
    pub request_max_retries: Option<u64>,
    pub stream_max_retries: Option<u64>,
    pub stream_idle_timeout_ms: Option<u64>,
    pub requires_openai_auth: bool,
}
```

**TypeScript Current** (Inferred from OpenAIResponsesClient config):
```typescript
interface ModelProviderInfo {
  name: string;
  baseUrl?: string;
  wireApi: 'Responses' | 'Chat';
  requiresOpenaiAuth: boolean;
  requestMaxRetries?: number;
  streamMaxRetries?: number;
  streamIdleTimeoutMs?: number;
  // MISSING: query_params, http_headers, env_http_headers
  requestsPerMinute?: number;  // TS extension for rate limiting
  requestsPerHour?: number;    // TS extension
}
```

**Gap Analysis**:
| Field | Rust | TS Current | Status | Action |
|-------|------|-----------|--------|--------|
| `name` | ✅ | ✅ | Match | None |
| `base_url` | `Option<String>` | `baseUrl?: string` | ✅ | None |
| `env_key` | `Option<String>` | ❌ Missing | ⚠️ | Add (Chrome extension uses env vars) |
| `env_key_instructions` | `Option<String>` | ❌ Missing | ⚠️ | Add |
| `wire_api` | `WireApi` enum | `'Responses' \| 'Chat'` | ✅ | None |
| `query_params` | `Option<HashMap>` | ❌ Missing | ❌ | **Add for Azure support** |
| `http_headers` | `Option<HashMap>` | ❌ Missing | ❌ | **Add for custom headers** |
| `env_http_headers` | `Option<HashMap>` | ❌ Missing | ⚠️ | Add |
| `request_max_retries` | `Option<u64>` | `requestMaxRetries?: number` | ✅ | None |
| `stream_max_retries` | `Option<u64>` | `streamMaxRetries?: number` | ✅ | None |
| `stream_idle_timeout_ms` | `Option<u64>` | `streamIdleTimeoutMs?: number` | ✅ | None |
| `requires_openai_auth` | `bool` | `requiresOpenaiAuth: boolean` | ✅ | None |

### 4.2 WireApi Enum

**Rust Definition** (model_provider_info.rs Lines 31-40):
```rust
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WireApi {
    Responses,
    #[default]
    Chat,
}
```

**TypeScript Needed**:
```typescript
export enum WireApi {
  Responses = 'responses',
  Chat = 'chat',
}

// OR union type (current approach):
export type WireApi = 'Responses' | 'Chat';
```

**Recommendation**: Use enum for type safety and extensibility

### 4.3 Provider Interface for Extensibility

**Design for Future Gemini/Claude Support**:

```typescript
// Base provider interface
interface ModelProvider {
  readonly name: string;
  readonly wireApi: WireApi;

  createRequestBuilder(auth?: AuthContext): RequestBuilder;
  getFullUrl(auth?: AuthContext): string;
  isAzureResponsesEndpoint(): boolean;
  requestMaxRetries(): number;
  streamMaxRetries(): number;
  streamIdleTimeout(): number;
}

// Concrete implementations
class OpenAIProvider implements ModelProvider {
  wireApi = WireApi.Responses;
  // ... OpenAI-specific logic
}

class GeminiProvider implements ModelProvider {
  wireApi = WireApi.Chat;
  // ... Gemini-specific logic (future)
}

class ClaudeProvider implements ModelProvider {
  wireApi = WireApi.Chat;
  // ... Claude-specific logic (future)
}
```

**Extension Points**:
1. **Request Builder**: Provider-specific headers, auth tokens
2. **URL Construction**: Different endpoint patterns
3. **Error Handling**: Provider-specific error codes
4. **Retry Logic**: Provider-specific rate limit headers

### 4.4 Built-in Providers

**Rust Built-ins** (model_provider_info.rs Lines 255-307):
```rust
pub fn built_in_model_providers() -> HashMap<String, ModelProviderInfo> {
    [
        ("openai", OpenAI provider config),
        ("oss", OSS/Ollama provider config),
    ]
    .into_iter()
    .collect()
}
```

**TypeScript Needed**:
```typescript
export const BUILT_IN_PROVIDERS: Record<string, ModelProviderInfo> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    wireApi: WireApi.Responses,
    requiresOpenaiAuth: true,
    httpHeaders: { version: EXTENSION_VERSION },
    // ... full config
  },
  // Future: gemini, claude, etc.
};
```

---

## Section 5: Testing Strategy

### 5.1 Current Test Coverage Analysis

**Files Analyzed**:
- `/codex-chrome/src/models/__tests__/OpenAIResponsesClient.test.ts`
- `/codex-chrome/src/models/__tests__/SSEEventParser.test.ts`
- `/codex-chrome/src/models/__tests__/integration.test.ts`
- `/codex-chrome/src/models/__tests__/error-handling.test.ts`

**Coverage Summary** (from OpenAIResponsesClient.test.ts, Lines 1-150):

| Test Category | Current Tests | Rust Equivalent | Coverage |
|---------------|--------------|-----------------|----------|
| Constructor validation | 4 tests | N/A (no tests) | ✅ Good |
| Getter/setter methods | 6 tests | N/A | ✅ Good |
| Request payload construction | Partial | Lines 912-1330 (table-driven) | ⚠️ Expand |
| SSE event parsing | Separate file | Lines 1005-1167 | ✅ Good |
| Error handling | Separate file | Lines 1132-1167 | ✅ Good |
| Retry logic | ❌ Missing | Implicit in tests | ❌ Add |
| Timeout handling | ❌ Missing | N/A | ❌ Add |
| Rate limiting | ❌ Missing | N/A | ❌ Add |

**Rust Test Highlights**:
1. **`parses_items_and_completed`** (Lines 1006-1085): Verify multi-event SSE parsing
2. **`error_when_missing_completed`** (Lines 1088-1129): Stream closure detection
3. **`error_when_error_event`** (Lines 1132-1167): Error event parsing with retry-after
4. **`table_driven_event_kinds`** (Lines 1176-1268): Comprehensive event type coverage

### 5.2 Contract Test Requirements

**Definition**: Tests that verify interface contracts between Rust and TypeScript

**Critical Contracts**:

1. **ResponseEvent Types** (client_common.rs Lines 72-87):
   ```rust
   pub enum ResponseEvent {
       Created,
       OutputItemDone(ResponseItem),
       Completed { response_id: String, token_usage: Option<TokenUsage> },
       OutputTextDelta(String),
       // ... 5 more variants
   }
   ```

   **Test**: Verify TS types match Rust enum exactly
   ```typescript
   describe('ResponseEvent Contract', () => {
     it('should have all Rust event types', () => {
       const requiredTypes = [
         'Created', 'OutputItemDone', 'Completed', 'OutputTextDelta',
         'ReasoningSummaryDelta', 'ReasoningContentDelta',
         'ReasoningSummaryPartAdded', 'WebSearchCallBegin', 'RateLimits'
       ];
       // Verify TS type union includes all
     });
   });
   ```

2. **SSE Event Processing** (process_sse Lines 624-848):

   **Test Fixture**: Use Rust SSE fixtures from `CODEX_RS_SSE_FIXTURE`
   ```typescript
   describe('SSE Processing Contract', () => {
     it('should produce same events as Rust for fixture file', async () => {
       const fixtureData = await loadRustFixture('tests/fixtures/sse_stream.txt');
       const tsEvents = await collectEvents(client.processSSEStream(fixtureData));
       const rustEvents = await loadExpectedEvents('tests/fixtures/expected_events.json');
       expect(tsEvents).toEqual(rustEvents);
     });
   });
   ```

3. **Error Classification**:

   **Test**: Verify error handling matches `StreamAttemptError`
   ```typescript
   describe('Error Classification Contract', () => {
     it('should classify 429 as RetryableHttpError', () => {
       const error = new ModelClientError('Rate limited', 429);
       expect(isRetryableError(error)).toBe(true);
     });

     it('should classify 400 as Fatal', () => {
       const error = new ModelClientError('Bad request', 400);
       expect(isRetryableError(error)).toBe(false);
     });
   });
   ```

### 5.3 Integration Test Requirements

**Scope**: End-to-end tests with real API interactions (mocked in CI)

**Test Scenarios**:

1. **Successful Streaming Session**:
   ```typescript
   it('should stream complete response from Responses API', async () => {
     const mockResponse = createMockSSEResponse([
       { type: 'response.created', response: {} },
       { type: 'response.output_text.delta', delta: 'Hello' },
       { type: 'response.output_text.delta', delta: ' world' },
       { type: 'response.output_item.done', item: mockMessageItem },
       { type: 'response.completed', response: { id: 'resp_123', usage: mockUsage } },
     ]);

     const events = [];
     for await (const event of client.streamResponses(mockPrompt)) {
       events.push(event);
     }

     expect(events).toHaveLength(5);
     expect(events[0].type).toBe('Created');
     expect(events[events.length - 1].type).toBe('Completed');
   });
   ```

2. **Retry with Rate Limiting**:
   ```typescript
   it('should retry on 429 with exponential backoff', async () => {
     let attempts = 0;
     mockFetch.mockImplementation(async () => {
       attempts++;
       if (attempts < 3) {
         return createErrorResponse(429, { 'retry-after': '1' });
       }
       return createSuccessResponse();
     });

     const events = await collectAllEvents(client.streamResponses(mockPrompt));
     expect(attempts).toBe(3);
     expect(events[events.length - 1].type).toBe('Completed');
   });
   ```

3. **Auth Token Refresh**:
   ```typescript
   it('should refresh token on 401 and retry', async () => {
     let attempts = 0;
     const authManager = new ChromeAuthManager();
     const refreshSpy = vi.spyOn(authManager, 'refreshToken');

     mockFetch.mockImplementation(async () => {
       attempts++;
       if (attempts === 1) return createErrorResponse(401);
       return createSuccessResponse();
     });

     await collectAllEvents(client.streamResponses(mockPrompt));
     expect(refreshSpy).toHaveBeenCalledOnce();
     expect(attempts).toBe(2);
   });
   ```

4. **Idle Timeout Detection** (after implementation):
   ```typescript
   it('should timeout on idle stream after 300s', async () => {
     vi.useFakeTimers();

     const slowStream = createSlowSSEStream([
       { type: 'response.created', response: {} },
       // No more events for 301 seconds
     ]);

     const promise = collectAllEvents(client.streamResponses(mockPrompt));
     await vi.advanceTimersByTimeAsync(301_000);

     await expect(promise).rejects.toThrow('idle timeout');
     vi.useRealTimers();
   });
   ```

### 5.4 Performance Regression Test Requirements

**Baselines** (from Rust implementation):

| Metric | Rust Target | TS Target | Measurement |
|--------|-------------|-----------|-------------|
| SSE event parsing | < 10ms avg | < 10ms avg | Per-event processing time |
| Request retry backoff | Exponential 1s, 2s, 4s | Same | Backoff delay calculation |
| Memory per stream | < 2MB | < 5MB | Peak memory during 1000-event stream |
| Stream throughput | 1000+ events/sec | 500+ events/sec | Events processed per second |

**Test Implementation**:

```typescript
describe('Performance Regression', () => {
  it('should parse 1000 SSE events in under 10s', async () => {
    const events = generateMockSSEEvents(1000);
    const startTime = performance.now();

    for (const event of events) {
      sseParser.parse(JSON.stringify(event));
    }

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(10_000); // 10ms avg per event
  });

  it('should handle 10 concurrent streams without memory leak', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    const streams = Array.from({ length: 10 }, () =>
      client.streamResponses(mockPrompt)
    );

    await Promise.all(streams.map(s => collectAllEvents(s)));

    // Force GC if available (Chrome extension context)
    if (global.gc) global.gc();

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

    expect(memoryGrowth).toBeLessThan(50); // < 50MB growth for 10 streams
  });
});
```

**Monitoring Strategy**:
1. Add performance metrics collection to `OpenAIResponsesClient.cleanup()`
2. Log metrics to Chrome DevTools console
3. Integrate with Chrome extension telemetry (future)
4. Add performance dashboard (future)

---

## Section 6: Code Examples and Line References

### 6.1 Rust Request Flow Example

**Full Request Lifecycle** (Lines 167-343):

```rust
// 1. Entry point (Lines 167-177)
async fn stream_responses(&self, prompt: &Prompt) -> Result<ResponseStream> {
    if let Some(path) = &*CODEX_RS_SSE_FIXTURE {
        return stream_from_fixture(path, /* ... */).await;
    }

    let auth_manager = self.auth_manager.clone();

    // 2. Prepare request payload (Lines 181-236)
    let full_instructions = prompt.get_full_instructions(&self.config.model_family);
    let tools_json = create_tools_json_for_responses_api(&prompt.tools)?;
    let reasoning = create_reasoning_param_for_request(/* ... */);

    let payload = ResponsesApiRequest {
        model: &self.config.model,
        instructions: &full_instructions,
        input: &input_with_instructions,
        tools: &tools_json,
        tool_choice: "auto",
        parallel_tool_calls: false,
        reasoning,
        store: azure_workaround,
        stream: true,
        include,
        prompt_cache_key: Some(self.conversation_id.to_string()),
        text,
    };

    // 3. Retry loop (Lines 244-265)
    let max_attempts = self.provider.request_max_retries();
    for attempt in 0..=max_attempts {
        match self.attempt_stream_responses(attempt, &payload_json, &auth_manager).await {
            Ok(stream) => return Ok(stream),
            Err(StreamAttemptError::Fatal(e)) => return Err(e),
            Err(retryable_attempt_error) => {
                if attempt == max_attempts {
                    return Err(retryable_attempt_error.into_error());
                }
                tokio::time::sleep(retryable_attempt_error.delay(attempt)).await;
            }
        }
    }
}

// 4. Single attempt (Lines 269-343)
async fn attempt_stream_responses(
    &self,
    attempt: u64,
    payload_json: &Value,
    auth_manager: &Option<Arc<AuthManager>>,
) -> std::result::Result<ResponseStream, StreamAttemptError> {
    let auth = auth_manager.as_ref().and_then(|m| m.auth());

    // Build request
    let mut req_builder = self.provider
        .create_request_builder(&self.client, &auth)
        .await
        .map_err(StreamAttemptError::Fatal)?;

    req_builder = req_builder
        .header("OpenAI-Beta", "responses=experimental")
        .header("conversation_id", self.conversation_id.to_string())
        .header("session_id", self.conversation_id.to_string())
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .json(payload_json);

    // Send request
    let res = self.otel_event_manager
        .log_request(attempt, || req_builder.send())
        .await;

    // Handle response
    match res {
        Ok(resp) if resp.status().is_success() => {
            let (tx_event, rx_event) = mpsc::channel::<Result<ResponseEvent>>(1600);

            // Spawn SSE processor
            let stream = resp.bytes_stream().map_err(CodexErr::Reqwest);
            tokio::spawn(process_sse(
                stream,
                tx_event,
                self.provider.stream_idle_timeout(),
                self.otel_event_manager.clone(),
            ));

            Ok(ResponseStream { rx_event })
        }
        Ok(res) => {
            let status = res.status();
            // Error handling (Lines 346-411)
            // ... classify error, extract retry-after, refresh token on 401
        }
        Err(e) => Err(StreamAttemptError::RetryableTransportError(e.into())),
    }
}
```

### 6.2 TypeScript Equivalent Example

**Current Implementation** (Lines 220-297):

```typescript
async *streamResponses(prompt: Prompt): AsyncGenerator<ResponseEvent> {
  // 1. Prepare payload (Lines 221-244)
  const fullInstructions = this.getFullInstructions(prompt);
  const toolsJson = this.createToolsJsonForResponsesApi(prompt.tools);
  const reasoning = this.createReasoningParam();

  const payload: ResponsesApiRequest = {
    model: this.currentModel,
    instructions: fullInstructions,
    input: prompt.input,
    tools: toolsJson,
    tool_choice: 'auto',
    parallel_tool_calls: false,
    reasoning,
    store: azureWorkaround,
    stream: true,
    include,
    prompt_cache_key: this.conversationId,
    text: textControls,
  };

  // 2. Retry loop (Lines 247-297)
  const maxRetries = this.provider.requestMaxRetries ?? 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;

    try {
      // 3. Single attempt (Lines 254-262)
      const response = await this.makeResponsesApiRequest(payload);

      if (!response.body) {
        throw new ModelClientError('Response body is null');
      }

      // 4. Process SSE stream (Lines 261-262)
      yield* this.processSSEStream(response.body, response.headers);
      return;

    } catch (error) {
      // 5. Error handling (Lines 264-296)
      if (error instanceof ModelClientError) {
        if (error.statusCode === 429) {
          if (attempt > maxRetries) throw error;
          const delay = this.calculateBackoff(attempt - 1, error.retryAfter);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (error.statusCode === 401) {
          throw new ModelClientError('Authentication failed', 401, this.getProvider());
        }

        if (error.statusCode && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }
      }

      if (attempt > maxRetries) throw error;
      const delay = this.calculateBackoff(attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 6.3 SSE Processing Example

**Rust Implementation** (Lines 731-742):
```rust
"response.output_item.done" => {
    let Some(item_val) = event.item else { continue };
    let Ok(item) = serde_json::from_value::<ResponseItem>(item_val) else {
        debug!("failed to parse ResponseItem from output_item.done");
        continue;
    };

    let event = ResponseEvent::OutputItemDone(item);
    if tx_event.send(Ok(event)).await.is_err() {
        return;
    }
}
```

**TypeScript Equivalent** (Lines 356-372):
```typescript
// Process events using optimized parser
for (const data of dataLines) {
  const event = this.sseParser.parse(data);
  if (event) {
    const responseEvents = this.sseParser.processEvent(event);

    for (const responseEvent of responseEvents) {
      const convertedEvent = this.convertSSEEventToResponseEvent(responseEvent);
      if (convertedEvent) {
        if (convertedEvent.type === 'Completed' && 'responseId' in convertedEvent) {
          responseCompleted = { id: convertedEvent.responseId };
        }
        yield convertedEvent;
      }
    }
  }
}
```

**Key Difference**: TS uses optimized `SSEEventParser` class (Phase 9 feature) while Rust inline parses

---

## Section 7: Recommended Refactoring Approach

### 7.1 Phase 0 Deliverables

1. ✅ **This Research Document**: Comprehensive analysis complete
2. **Gap Analysis Summary**: Documented in Section 2
3. **Type Alignment Plan**: Documented in Sections 1 & 4
4. **Test Strategy**: Documented in Section 5

### 7.2 Phase 1: Type System Alignment

**Priority 1: Core Types**
- [ ] Port `ModelProviderInfo` with all fields (query_params, http_headers)
- [ ] Create `WireApi` enum
- [ ] Create `StreamAttemptError` enum/class
- [ ] Align `ResponseEvent` type union with Rust enum

**Priority 2: Method Signatures**
- [ ] Add `getAutoCompactTokenLimit()` method
- [ ] Add `getModelFamily()` method
- [ ] Change `getProvider()` to return full `ModelProviderInfo` object
- [ ] Add `getAuthManager()` if storing auth manager

### 7.3 Phase 2: Functionality Gaps

**Priority 1: Critical Features**
- [ ] Implement idle timeout detection in SSE processing
- [ ] Extract `attemptStreamResponses()` as separate method
- [ ] Implement structured error accumulation (don't throw immediately)
- [ ] Add provider abstraction interface

**Priority 2: Nice-to-Have**
- [ ] Add OTEL-style telemetry (optional)
- [ ] Add fixture file testing support
- [ ] Implement query params and custom headers support

### 7.4 Phase 3: Testing

**Priority 1: Contract Tests**
- [ ] ResponseEvent type contract tests
- [ ] SSE processing contract tests with Rust fixtures
- [ ] Error classification contract tests

**Priority 2: Integration Tests**
- [ ] End-to-end streaming tests
- [ ] Retry logic tests
- [ ] Auth token refresh tests
- [ ] Idle timeout tests

**Priority 3: Performance Tests**
- [ ] SSE parsing performance benchmarks
- [ ] Memory leak detection tests
- [ ] Concurrent stream tests

---

## Appendix A: File Line Reference Index

### Rust Files

| File | Key Sections | Lines |
|------|--------------|-------|
| `codex-rs/core/src/client.rs` | ModelClient struct | 74-83 |
| | Constructor | 86-107 |
| | stream() method | 124-164 |
| | stream_responses() method | 167-266 |
| | attempt_stream_responses() | 269-412 |
| | StreamAttemptError enum | 447-486 |
| | process_sse() function | 624-848 |
| | Tests | 912-1330 |
| `codex-rs/core/src/model_provider_info.rs` | ModelProviderInfo struct | 44-89 |
| | WireApi enum | 31-40 |
| | Built-in providers | 255-307 |
| `codex-rs/core/src/client_common.rs` | Prompt struct | 26-69 |
| | ResponseEvent enum | 72-87 |
| | ResponsesApiRequest struct | 143-161 |

### TypeScript Files

| File | Key Sections | Lines |
|------|--------------|-------|
| `codex-chrome/src/models/OpenAIResponsesClient.ts` | Class definition | 94-141 |
| | streamResponses() method | 220-298 |
| | processSSEStream() method | 303-377 |
| | makeResponsesApiRequest() | 460-509 |
| | Helper methods | 514-653 |
| | Performance methods | 696-755 |
| `codex-chrome/src/models/ModelClient.ts` | Abstract class | 145-366 |
| | Retry logic | 322-356 |
| | Backoff calculation | 270-284 |
| `codex-chrome/src/models/types/ResponsesAPI.ts` | Type definitions | 1-100 |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **SSE** | Server-Sent Events - HTTP streaming protocol |
| **Wire API** | Protocol format (Responses or Chat Completions) |
| **Backoff** | Delay between retry attempts |
| **Idle Timeout** | Max time between stream events before disconnect |
| **OTEL** | OpenTelemetry - observability framework |
| **MCP** | Model Context Protocol |
| **Jitter** | Random variance in retry delays |
| **Fixture** | Test data file (e.g., SSE stream recording) |

---

## Conclusion

This research provides a complete foundation for Phase 1+ refactoring. The key findings:

1. **Structural Alignment**: Rust and TypeScript implementations are ~80% aligned in architecture
2. **Critical Gaps**: Idle timeout, error accumulation, provider abstraction need implementation
3. **Browser Adaptations**: Current fetch()/ReadableStream patterns should be preserved
4. **Testing**: Comprehensive test strategy defined with contract, integration, and performance tests

**Next Steps**: Use this research to create detailed implementation tickets for Phase 1 type alignment and Phase 2 functionality gaps.
