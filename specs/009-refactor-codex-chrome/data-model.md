# Data Model Documentation

**Spec ID**: 009-refactor-codex-chrome
**Phase**: 1 - Design Artifacts
**Date**: 2025-10-02
**Status**: Phase 1 Complete

## Overview

This document defines the complete data model for the codex-chrome model client refactoring, matching the Rust implementation in `codex-rs/core/src/client.rs`. All types, fields, and validation rules are documented to ensure TypeScript implementation maintains contract compatibility with Rust.

---

## Core Entities

### 1. ModelClient

**Purpose**: Main interface for streaming model responses from OpenAI/compatible providers.

**Rust Reference**: `codex-rs/core/src/client.rs` Lines 74-83

**TypeScript Class Structure**:
```typescript
class ModelClient {
  // Fields
  private config: ModelClientConfig;
  private authManager?: ChromeAuthManager;
  private provider: ModelProviderInfo;
  private conversationId: string;
  private effort?: ReasoningEffortConfig;
  private summary: ReasoningSummaryConfig;
  private client: typeof fetch; // Browser fetch API
  private otelEventManager: OtelEventManager;
}
```

**Field Definitions**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `config` | `ModelClientConfig` | Yes | Model configuration including model slug, family, context window | Must have valid `model` string |
| `authManager` | `ChromeAuthManager` | No | Manages auth tokens for OpenAI API | Optional for local models |
| `provider` | `ModelProviderInfo` | Yes | Provider metadata (base URL, retry config, timeouts) | Must be valid provider |
| `conversationId` | `string` | Yes | UUID for session tracking | Must be valid UUID v4 |
| `effort` | `ReasoningEffortConfig` | No | Reasoning effort level (`low`, `medium`, `high`) | Only for reasoning models |
| `summary` | `ReasoningSummaryConfig` | Yes | Reasoning summary config (`auto`, `enabled`, `disabled`) | Required field |
| `client` | `typeof fetch` | Yes | HTTP client (browser fetch API) | Must support streaming |
| `otelEventManager` | `OtelEventManager` | NO | Telemetry/logging manager | Can be no-op impl |

**Methods** (13 total):

| Method | Signature | Return Type | Purpose | FR Reference |
|--------|-----------|-------------|---------|--------------|
| `constructor` | `(config, authManager?, otel, provider, effort?, summary, conversationId)` | `ModelClient` | Initialize client | FR-001 |
| `getModelContextWindow` | `(): number \| undefined` | `number \| undefined` | Get max context tokens | FR-002 |
| `getAutoCompactTokenLimit` | `(): number \| undefined` | `number \| undefined` | Get auto-compact threshold | FR-003 |
| `stream` | `async (prompt: Prompt): AsyncGenerator<ResponseEvent>` | `AsyncGenerator<ResponseEvent>` | Main streaming entry point | FR-004 |
| `streamResponses` | `async (prompt: Prompt): AsyncGenerator<ResponseEvent>` | `AsyncGenerator<ResponseEvent>` | Responses API implementation | FR-005 |
| `attemptStreamResponses` | `async (attempt: number, payload: ResponsesApiRequest, auth?: AuthContext): Promise<ResponseStream>` | `Promise<ResponseStream>` | Single HTTP request attempt | FR-006 |
| `getProvider` | `(): ModelProviderInfo` | `ModelProviderInfo` | Get provider metadata | FR-007 |
| `getOtelEventManager` | `(): OtelEventManager` | `OtelEventManager` | Get telemetry manager | FR-008 |
| `getModel` | `(): string` | `string` | Get model slug | FR-009 |
| `getModelFamily` | `(): ModelFamily` | `ModelFamily` | Get model family enum | FR-010 |
| `getReasoningEffort` | `(): ReasoningEffortConfig \| undefined` | `ReasoningEffortConfig \| undefined` | Get reasoning effort | FR-011 |
| `getReasoningSummary` | `(): ReasoningSummaryConfig` | `ReasoningSummaryConfig` | Get reasoning summary | FR-012 |
| `getAuthManager` | `(): ChromeAuthManager \| undefined` | `ChromeAuthManager \| undefined` | Get auth manager | FR-013 |

**Validation Rules**:

- **FR-001**: Constructor must validate all required fields
- **FR-002**: Context window must be positive integer if present
- **FR-003**: Auto-compact limit must be less than context window
- **FR-004**: `stream()` must dispatch to `streamResponses()` or `streamChatCompletions()` based on `provider.wireApi`
- **FR-005**: `streamResponses()` must implement retry logic with max attempts from `provider.requestMaxRetries()`

---

### 2. ResponseStream

**Purpose**: Async generator yielding `ResponseEvent` objects from SSE stream.

**Rust Reference**: `codex-rs/core/src/client_common.rs` Lines 187-209

**TypeScript Structure**:
```typescript
type ResponseStream = AsyncGenerator<ResponseEvent, void, unknown>;
```

**Behavior**:
- Yields `ResponseEvent` objects incrementally as SSE events arrive
- Throws error on stream failure or timeout
- Completes after `Completed` event or error
- Must handle backpressure automatically (async generator pauses on slow consumer)

**Buffer Management**:
- No explicit buffer size (Rust uses 1600-element mpsc channel)
- Browser async generator handles backpressure natively
- Must not accumulate unbounded events in memory

**Completion Tracking**:
- Stream ends when:
  1. `response.completed` SSE event received, OR
  2. `response.failed` SSE event received, OR
  3. Idle timeout exceeded (300s default), OR
  4. HTTP request fails

**Timeout Handling**:
- Idle timeout: Max duration between SSE events (default 300s)
- Implemented via `Promise.race()` with timer
- Throws `CodexError` with type `Stream` on timeout

---

### 3. Prompt

**Purpose**: Request payload for a single model turn.

**Rust Reference**: `codex-rs/core/src/client_common.rs` Lines 26-69

**TypeScript Implementation**: **EXISTING** - Use `codex-chrome/src/models/types/ResponsesAPI.ts` Lines 45-54

**TypeScript Structure** (already implemented):
```typescript
// From codex-chrome/src/models/types/ResponsesAPI.ts
export interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[];
  /** Tools available to the model */
  tools: any[];
  /** Optional override for base instructions */
  baseInstructionsOverride?: string;
  /** Optional output schema for the model's response */
  outputSchema?: any;
}
```

**Field Validation**:

| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| `input` | `ResponseItem[]` | Yes | Must be non-empty array | N/A |
| `tools` | `any[]` | Yes | Can be empty array | `[]` |
| `baseInstructionsOverride` | `string` | No | Must be non-empty if present | `undefined` |
| `outputSchema` | `any` | No | Must be valid JSON schema | `undefined` |

**Implementation Notes**:
- ✅ **Already exists** - No new interface needed
- This interface already matches the Rust Prompt struct
- Used by OpenAIResponsesClient.streamResponses() method
- No changes required during refactoring

---

### 4. ResponseEvent

**Purpose**: Discriminated union of all SSE event types from model stream.

**Rust Reference**: `codex-rs/core/src/client_common.rs` Lines 72-87

**TypeScript Discriminated Union**:
```typescript
type ResponseEvent =
  | { type: 'Created' }
  | { type: 'OutputItemDone'; item: ResponseItem }
  | { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage }
  | { type: 'OutputTextDelta'; delta: string }
  | { type: 'ReasoningSummaryDelta'; delta: string }
  | { type: 'ReasoningContentDelta'; delta: string }
  | { type: 'ReasoningSummaryPartAdded' }
  | { type: 'WebSearchCallBegin'; callId: string }
  | { type: 'RateLimits'; limits: RateLimitSnapshot };
```

**Event Definitions**:

| Type | Payload Fields | When Emitted | SSE Mapping |
|------|----------------|--------------|-------------|
| `Created` | None | Stream start | `response.created` |
| `OutputItemDone` | `item: ResponseItem` | Message/tool call complete | `response.output_item.done` |
| `Completed` | `responseId: string`, `tokenUsage?: TokenUsage` | Stream end (success) | `response.completed` |
| `OutputTextDelta` | `delta: string` | Text chunk | `response.output_text.delta` |
| `ReasoningSummaryDelta` | `delta: string` | Reasoning summary chunk | `response.reasoning_summary_text.delta` |
| `ReasoningContentDelta` | `delta: string` | Reasoning content chunk | `response.reasoning_text.delta` |
| `ReasoningSummaryPartAdded` | None | Reasoning part added | `response.reasoning_summary_part.added` |
| `WebSearchCallBegin` | `callId: string` | Web search tool call detected | `response.output_item.added` (type check) |
| `RateLimits` | `limits: RateLimitSnapshot` | Rate limit headers parsed | HTTP headers |

**Contract Requirement**: Type names MUST match Rust enum variants exactly (case-sensitive).

---

### 5. ModelProviderInfo

**Purpose**: Provider-specific configuration and metadata.

**Rust Reference**: `codex-rs/core/src/model_provider_info.rs` Lines 44-89

**TypeScript Structure**:
```typescript
interface ModelProviderInfo {
  /** Provider name (e.g., "OpenAI", "Azure", "OSS") */
  name: string;

  /** Base API URL (e.g., "https://api.openai.com/v1") */
  baseUrl?: string;

  /** Environment variable key for API key */
  envKey?: string;

  /** Instructions for obtaining API key */
  envKeyInstructions?: string;

  /** Wire protocol format */
  wireApi: WireApi;

  /** Query parameters to append to all requests */
  queryParams?: Record<string, string>;

  /** HTTP headers to add to all requests */
  httpHeaders?: Record<string, string>;

  /** Environment-based HTTP headers (resolved at runtime) */
  envHttpHeaders?: Record<string, string>;

  /** Max retry attempts for failed requests */
  requestMaxRetries?: number;

  /** Max retry attempts for stream failures */
  streamMaxRetries?: number;

  /** Idle timeout for SSE stream (milliseconds) */
  streamIdleTimeoutMs?: number;

  /** Whether provider requires OpenAI auth */
  requiresOpenaiAuth: boolean;
}
```

**Field Defaults**:

| Field | Default Value | Notes |
|-------|---------------|-------|
| `requestMaxRetries` | `3` | Standard retry count |
| `streamMaxRetries` | `1` | Stream retry count |
| `streamIdleTimeoutMs` | `300000` | 5 minutes (300s) |
| `wireApi` | `WireApi.Chat` | Fallback to Chat API |

**Built-in Providers**:
```typescript
export const BUILT_IN_PROVIDERS: Record<string, ModelProviderInfo> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    wireApi: WireApi.Responses,
    requiresOpenaiAuth: true,
    httpHeaders: { version: EXTENSION_VERSION },
    requestMaxRetries: 3,
    streamMaxRetries: 1,
    streamIdleTimeoutMs: 300000,
  },
  // Future: azure, gemini, claude, etc.
};
```

---

### 6. WireApi Enum

**Purpose**: Protocol format discriminator.

**Rust Reference**: `codex-rs/core/src/model_provider_info.rs` Lines 31-40

**TypeScript Enum**:
```typescript
export enum WireApi {
  /** Responses API (experimental, streaming with reasoning) */
  Responses = 'responses',

  /** Chat Completions API (standard, legacy) */
  Chat = 'chat',
}
```

**Usage**:
- `stream()` method dispatches based on this value
- `Responses`: Use `streamResponses()` method
- `Chat`: Use `streamChatCompletions()` method (with aggregation adapter)

---

### 7. StreamAttemptError

**Purpose**: Error classification for retry logic.

**Rust Reference**: `codex-rs/core/src/client.rs` Lines 447-486

**TypeScript Structure**:
```typescript
class StreamAttemptError extends Error {
  readonly type: 'RetryableHttpError' | 'RetryableTransportError' | 'Fatal';

  // For RetryableHttpError
  readonly statusCode?: number;
  readonly retryAfter?: number; // seconds

  // For RetryableTransportError and Fatal
  readonly cause?: Error;

  constructor(type: StreamAttemptError['type'], options?: {
    statusCode?: number;
    retryAfter?: number;
    cause?: Error;
    message?: string;
  });

  /** Calculate backoff delay for this error and attempt number */
  delay(attempt: number): number;

  /** Convert to final CodexError for throwing */
  intoError(): CodexError;
}
```

**Error Classification Logic**:

| HTTP Status | Error Type | Retryable? | Notes |
|-------------|------------|------------|-------|
| 401 Unauthorized | `RetryableHttpError` | Yes | Trigger token refresh |
| 429 Too Many Requests | `RetryableHttpError` | Yes | Parse `retry-after` header |
| 5xx Server Error | `RetryableHttpError` | Yes | Server-side issue |
| 400-499 (other) | `Fatal` | No | Client error (bad request) |
| Network timeout | `RetryableTransportError` | Yes | Connection issue |
| Network refused | `RetryableTransportError` | Yes | Connection issue |
| Parse error | `Fatal` | No | Invalid response |

**Backoff Calculation**:
```typescript
delay(attempt: number): number {
  if (this.type === 'RetryableHttpError' && this.retryAfter) {
    // Use server-provided retry-after (convert to ms)
    return this.retryAfter * 1000;
  }

  // Exponential backoff with jitter: 2^attempt * 1000 + random(0-1000)
  const baseDelay = Math.pow(2, attempt) * 1000;
  const jitter = Math.random() * 1000;
  return baseDelay + jitter;
}
```

**Example Usage**:
```typescript
try {
  return await this.attemptStreamResponses(attempt, payload, auth);
} catch (error) {
  const streamError = StreamAttemptError.fromError(error);

  if (streamError.type === 'Fatal') {
    throw streamError.intoError();
  }

  if (attempt >= maxRetries) {
    throw streamError.intoError();
  }

  const delayMs = streamError.delay(attempt);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}
```

---

## Supporting Types

### TokenUsage
```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

### RateLimitSnapshot
```typescript
interface RateLimitSnapshot {
  requestsRemaining?: number;
  requestsLimit?: number;
  tokensRemaining?: number;
  tokensLimit?: number;
  requestsResetAt?: Date;
  tokensResetAt?: Date;
}
```

### ReasoningEffortConfig
```typescript
enum ReasoningEffortConfig {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}
```

### ReasoningSummaryConfig
```typescript
enum ReasoningSummaryConfig {
  Auto = 'auto',
  Enabled = 'enabled',
  Disabled = 'disabled',
}
```

### ModelFamily
```typescript
enum ModelFamily {
  GPT4 = 'gpt-4',
  GPT35 = 'gpt-3.5',
  O1 = 'o1',
  GPT4o = 'gpt-4o',
  // ... other families
}
```

### ResponseItem
```typescript
type ResponseItem =
  | { type: 'message'; role: 'user' | 'assistant'; content: ContentItem[] }
  | { type: 'tool_result'; toolCallId: string; content: ContentItem[] }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> };
```

### OpenAiTool
```typescript
type OpenAiTool =
  | { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
  | { type: 'web_search' }
  | { type: 'code_interpreter' };
```

---

## Validation Rules

### Constructor Validation (FR-001)

**Required Fields**:
- `config.model`: Must be non-empty string
- `provider`: Must be valid `ModelProviderInfo`
- `conversationId`: Must be valid UUID v4
- `summary`: Must be valid `ReasoningSummaryConfig`

**Optional Fields**:
- `authManager`: Required if `provider.requiresOpenaiAuth === true`
- `effort`: Only valid for reasoning-capable models (o1, o3 families)

**Example**:
```typescript
constructor(config, authManager, otel, provider, effort, summary, conversationId) {
  if (!config.model || typeof config.model !== 'string') {
    throw new Error('config.model is required');
  }

  if (!UUID_REGEX.test(conversationId)) {
    throw new Error('conversationId must be valid UUID v4');
  }

  if (provider.requiresOpenaiAuth && !authManager) {
    throw new Error('authManager required for provider ' + provider.name);
  }

  // ... assign fields
}
```

### Context Window Validation (FR-002)

**Rule**: If present, `contextWindow` must be positive integer.

```typescript
getModelContextWindow(): number | undefined {
  const window = this.config.contextWindow;
  if (window !== undefined && (window <= 0 || !Number.isInteger(window))) {
    throw new Error('contextWindow must be positive integer');
  }
  return window;
}
```

### Auto-Compact Validation (FR-003)

**Rule**: If present, `autoCompactTokenLimit` must be less than `contextWindow`.

```typescript
getAutoCompactTokenLimit(): number | undefined {
  const limit = this.config.autoCompactTokenLimit;
  const window = this.getModelContextWindow();

  if (limit !== undefined && window !== undefined && limit >= window) {
    throw new Error('autoCompactTokenLimit must be less than contextWindow');
  }

  return limit;
}
```

### Stream Dispatch Validation (FR-004)

**Rule**: `stream()` must dispatch based on `provider.wireApi`.

```typescript
async *stream(prompt: Prompt): AsyncGenerator<ResponseEvent> {
  if (this.provider.wireApi === WireApi.Responses) {
    yield* this.streamResponses(prompt);
  } else if (this.provider.wireApi === WireApi.Chat) {
    // Wrap chat stream with aggregation adapter
    yield* this.streamChatCompletionsWithAdapter(prompt);
  } else {
    throw new Error('Unknown wire API: ' + this.provider.wireApi);
  }
}
```

### Retry Logic Validation (FR-005)

**Rule**: Must retry up to `provider.requestMaxRetries()` times with exponential backoff.

```typescript
async *streamResponses(prompt: Prompt): AsyncGenerator<ResponseEvent> {
  const maxRetries = this.provider.requestMaxRetries ?? 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      yield* await this.attemptStreamResponses(attempt, payload, auth);
      return; // Success
    } catch (error) {
      const streamError = StreamAttemptError.fromError(error);

      if (streamError.type === 'Fatal' || attempt >= maxRetries) {
        throw streamError.intoError();
      }

      // Wait with backoff before retry
      await new Promise(resolve => setTimeout(resolve, streamError.delay(attempt)));
    }
  }
}
```

---

## Browser-Specific Adaptations

### HTTP Client: fetch() API

**Rust Equivalent**: `reqwest::Client`

**Browser Pattern**:
```typescript
async makeRequest(url: string, options: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await this.authManager?.getToken()}`,
    'OpenAI-Beta': 'responses=experimental',
    'conversation_id': this.conversationId,
    'session_id': this.conversationId,
    'Accept': 'text/event-stream',
    ...this.provider.httpHeaders,
  };

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(options.body),
  });
}
```

### Streaming: ReadableStream

**Rust Equivalent**: `tokio::sync::mpsc::channel`

**Browser Pattern**:
```typescript
async *processSSEStream(
  body: ReadableStream<Uint8Array>,
  headers: Headers
): AsyncGenerator<ResponseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const idleTimeout = this.provider.streamIdleTimeoutMs ?? 300000;

  try {
    while (true) {
      // Wrap read with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('idle timeout')), idleTimeout)
      );

      const { done, value } = await Promise.race([
        reader.read(),
        timeoutPromise,
      ]) as ReadableStreamReadResult<Uint8Array>;

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const events = this.parseSSEBuffer(buffer);
      buffer = events.remainder;

      for (const event of events.parsed) {
        yield this.convertToResponseEvent(event);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### Timeout Handling

**Rust Equivalent**: `tokio::time::timeout()`

**Browser Pattern**:
```typescript
async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
}
```

---

## Type Safety Checklist

- [ ] All `ResponseEvent` variants have exact type names from Rust
- [ ] `ModelProviderInfo` includes all 12 fields from Rust
- [ ] `Prompt` structure matches Rust `Prompt` exactly
- [ ] `StreamAttemptError` covers all 3 error categories
- [ ] `WireApi` enum values match Rust serialization
- [ ] All method signatures match Rust method names (camelCase conversion)
- [ ] Validation rules enforce Rust constraints in TypeScript

---

## Testing Requirements

### Unit Tests
1. Constructor validation (all required/optional field combinations)
2. Getter methods return correct values
3. Error classification logic matches Rust
4. Backoff calculation matches exponential formula

### Integration Tests
1. End-to-end streaming with real API (mocked in CI)
2. Retry logic with 429 rate limiting
3. Auth token refresh on 401
4. Idle timeout detection
5. SSE parsing with Rust fixtures

### Contract Tests
1. `ResponseEvent` types match Rust enum
2. SSE processing produces same events as Rust for fixture data
3. Error handling matches `StreamAttemptError` classification

---

## References

- Rust Implementation: `codex-rs/core/src/client.rs`
- Protocol Types: `codex-rs/core/src/client_common.rs`
- Provider Config: `codex-rs/core/src/model_provider_info.rs`
- Research Document: `specs/009-refactor-codex-chrome/research.md`
