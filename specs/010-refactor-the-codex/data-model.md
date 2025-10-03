# Data Model: Model Client Types & Structures

**Feature**: 010-refactor-the-codex
**Date**: 2025-10-02
**Source**: Rust structs from codex-rs/core/src/client.rs and client_common.rs
**Target**: TypeScript types in codex-chrome/src/models/types/

## Overview

This document defines all data structures for the model client refactoring, aligned with the Rust reference implementation. Each type includes:
- Rust source reference
- TypeScript equivalent
- Field mappings
- Validation rules

## Core Entities

### 1. ModelClient (Base Class)

**Rust Reference**: `codex-rs/core/src/client.rs:74-445`

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

**TypeScript Equivalent**:

```typescript
abstract class ModelClient {
  // Configuration (simplified for browser)
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly provider: ModelProviderInfo;
  protected readonly conversationId: string;
  protected readonly modelFamily: ModelFamily;

  // Reasoning config
  protected reasoningEffort?: ReasoningEffortConfig;
  protected reasoningSummary?: ReasoningSummaryConfig;

  // State
  protected currentModel: string;

  // Public methods (match Rust signatures)
  abstract stream(prompt: Prompt): Promise<ResponseStream>;
  abstract getModel(): string;
  abstract getModelFamily(): ModelFamily;
  abstract getModelContextWindow(): number | undefined;
  abstract getAutoCompactTokenLimit(): number | undefined;
  abstract getProvider(): ModelProviderInfo;
  abstract getAuthManager(): undefined;  // Always undefined in browser
  abstract getReasoningEffort(): ReasoningEffortConfig | undefined;
  abstract getReasoningSummary(): ReasoningSummaryConfig | undefined;

  // Protected helpers (match Rust private methods)
  protected abstract streamResponses(prompt: Prompt): Promise<ResponseStream>;
  protected abstract attemptStreamResponses(
    attempt: number,
    payload: ResponsesApiRequest
  ): Promise<ResponseStream>;
  protected abstract processSSE(
    stream: ReadableStream<Uint8Array>,
    headers?: Headers
  ): AsyncGenerator<ResponseEvent>;
  protected abstract parseRateLimitSnapshot(
    headers?: Headers
  ): RateLimitSnapshot | undefined;
}
```

**Field Mappings**:
- `Arc<Config>` → individual config fields (no Arc needed in JS)
- `Option<Arc<AuthManager>>` → `undefined` (no auth manager in browser)
- `OtelEventManager` → console logging (simplified)
- `reqwest::Client` → fetch API (no explicit client object)
- `ConversationId` → `string`

---

### 2. Prompt

**Rust Reference**: `codex-rs/core/src/client_common.rs:24-69`

```rust
pub struct Prompt {
    pub input: Vec<ResponseItem>,
    pub(crate) tools: Vec<OpenAiTool>,
    pub base_instructions_override: Option<String>,
    pub output_schema: Option<Value>,
}
```

**TypeScript Equivalent**:

```typescript
interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[];

  /** Tools available to the model */
  tools: ToolDefinition[];

  /** Optional override for base instructions */
  baseInstructionsOverride?: string;

  /** Optional output schema for structured responses */
  outputSchema?: Record<string, unknown>;
}
```

**Validation Rules**:
- `input` must not be empty array
- `tools` defaults to empty array
- `baseInstructionsOverride` is optional
- `outputSchema` must be valid JSON Schema if provided

---

### 3. ResponseEvent (Union Type)

**Rust Reference**: `codex-rs/core/src/client_common.rs:71-87`

```rust
pub enum ResponseEvent {
    Created,
    OutputItemDone(ResponseItem),
    Completed {
        response_id: String,
        token_usage: Option<TokenUsage>,
    },
    OutputTextDelta(String),
    ReasoningSummaryDelta(String),
    ReasoningContentDelta(String),
    ReasoningSummaryPartAdded,
    WebSearchCallBegin {
        call_id: String,
    },
    RateLimits(RateLimitSnapshot),
}
```

**TypeScript Equivalent**:

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
  | { type: 'RateLimits'; snapshot: RateLimitSnapshot };
```

**Type Discriminator**: `type` field
**Field Mappings**:
- Rust enum variant names → `type` field values (PascalCase preserved)
- Rust field names → camelCase (e.g., `response_id` → `responseId`)
- `Option<TokenUsage>` → `tokenUsage?: TokenUsage`

---

### 4. ResponseStream

**Rust Reference**: `codex-rs/core/src/client_common.rs:149-164`

```rust
pub struct ResponseStream {
    pub(crate) rx_event: mpsc::Receiver<Result<ResponseEvent>>,
}

impl Stream for ResponseStream {
    type Item = Result<ResponseEvent>;
    // ... poll_next implementation
}
```

**TypeScript Equivalent**:

```typescript
class ResponseStream {
  private eventBuffer: ResponseEvent[] = [];
  private isCompleted: boolean = false;
  private error: Error | null = null;
  private waitingResolvers: Array<(value: IteratorResult<ResponseEvent>) => void> = [];
  private abortController: AbortController;

  // Producer interface (matches Rust tx_event.send)
  addEvent(event: ResponseEvent): void;
  complete(): void;
  error(err: Error): void;
  abort(): void;

  // Consumer interface (matches Rust Stream trait)
  [Symbol.asyncIterator](): AsyncIterableIterator<ResponseEvent>;

  // Utility methods
  getBufferSize(): number;
  isStreamCompleted(): boolean;
  isAborted(): boolean;

  // Helper methods
  toArray(): Promise<ResponseEvent[]>;
  take(count: number): AsyncGenerator<ResponseEvent>;
  filter(predicate: (event: ResponseEvent) => boolean): AsyncGenerator<ResponseEvent>;
  map<T>(mapper: (event: ResponseEvent) => T): AsyncGenerator<T>;
}
```

**Behavioral Equivalence**:
- Rust `mpsc::Receiver<Result<ResponseEvent>>` → TS event buffer + async iteration
- Rust `tx_event.send(Ok(event))` → TS `stream.addEvent(event)`
- Rust `tx_event.send(Err(error))` → TS `stream.error(error)`
- Rust channel capacity (1600) → TS buffer max size (configurable, default 1000)
- Rust backpressure → TS throws error when buffer full

---

### 5. TokenUsage

**Rust Reference**: `codex-rs/core/src/protocol.rs` (referenced in client.rs:512-527)

```rust
pub struct TokenUsage {
    pub input_tokens: u64,
    pub cached_input_tokens: u64,
    pub output_tokens: u64,
    pub reasoning_output_tokens: u64,
    pub total_tokens: u64,
}
```

**TypeScript Equivalent**:

```typescript
interface TokenUsage {
  /** Number of tokens in the prompt */
  input_tokens: number;

  /** Number of cached input tokens (from prompt caching) */
  cached_input_tokens: number;

  /** Number of tokens in the completion */
  output_tokens: number;

  /** Number of reasoning tokens (o1/o3 models) */
  reasoning_output_tokens: number;

  /** Total tokens used (input + output) */
  total_tokens: number;
}
```

**Field Naming**: Preserves Rust snake_case for consistency with API responses

**Validation Rules**:
- All fields must be non-negative integers
- `total_tokens` should equal `input_tokens + output_tokens`
- `cached_input_tokens` ≤ `input_tokens`

---

### 6. RateLimitSnapshot

**Rust Reference**: `codex-rs/core/src/protocol.rs` (referenced in client.rs:567-583)

```rust
pub struct RateLimitSnapshot {
    pub primary: Option<RateLimitWindow>,
    pub secondary: Option<RateLimitWindow>,
}

pub struct RateLimitWindow {
    pub used_percent: f64,
    pub window_minutes: Option<u64>,
    pub resets_in_seconds: Option<u64>,
}
```

**TypeScript Equivalent**:

```typescript
interface RateLimitSnapshot {
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
}

interface RateLimitWindow {
  /** Percentage of rate limit consumed (0.0 - 100.0) */
  used_percent: number;

  /** Window duration in minutes */
  window_minutes?: number;

  /** Seconds until rate limit resets */
  resets_in_seconds?: number;
}
```

**Parsing Logic** (from Rust):
```typescript
private parseRateLimitSnapshot(headers?: Headers): RateLimitSnapshot | undefined {
  if (!headers) return undefined;

  const primary = this.parseRateLimitWindow(
    headers,
    'x-codex-primary-used-percent',
    'x-codex-primary-window-minutes',
    'x-codex-primary-reset-after-seconds'
  );

  const secondary = this.parseRateLimitWindow(
    headers,
    'x-codex-secondary-used-percent',
    'x-codex-secondary-window-minutes',
    'x-codex-secondary-reset-after-seconds'
  );

  if (!primary && !secondary) return undefined;
  return { primary, secondary };
}
```

---

### 7. StreamAttemptError (Error Classification)

**Rust Reference**: `codex-rs/core/src/client.rs:447-486`

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

**TypeScript Equivalent**:

```typescript
class StreamAttemptError extends Error {
  constructor(
    message: string,
    public readonly errorType: 'retryable_http' | 'retryable_transport' | 'fatal',
    public readonly statusCode?: number,
    public readonly retryAfter?: number, // milliseconds
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StreamAttemptError';
  }

  /** Check if error is retryable */
  isRetryable(): boolean {
    return this.errorType !== 'fatal';
  }

  /** Get delay for retry (implements Rust's delay() method) */
  getRetryDelay(attempt: number): number {
    if (this.retryAfter !== undefined) {
      return this.retryAfter;
    }
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }
}
```

**Usage Pattern** (matches Rust retry logic):
```typescript
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await this.attemptStreamResponses(attempt, payload);
  } catch (error) {
    if (error instanceof StreamAttemptError) {
      if (!error.isRetryable() || attempt === maxRetries) {
        throw error;
      }
      const delay = error.getRetryDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    throw error;
  }
}
```

---

### 8. ModelProviderInfo

**Rust Reference**: `codex-rs/core/src/model_provider_info.rs`

```rust
pub struct ModelProviderInfo {
    pub name: String,
    pub base_url: Option<String>,
    pub wire_api: WireApi,
    pub request_max_retries: Option<u64>,
    pub stream_idle_timeout_ms: Option<u64>,
    // ... other fields
}

pub enum WireApi {
    Responses,
    Chat,
}
```

**TypeScript Equivalent**:

```typescript
interface ModelProviderInfo {
  /** Provider name (e.g., "openai", "anthropic") */
  name: string;

  /** Base URL for API requests */
  baseUrl?: string;

  /** Wire protocol to use */
  wireApi: 'responses' | 'chat';

  /** Maximum number of request retries */
  requestMaxRetries?: number;

  /** Idle timeout for SSE streams (milliseconds) */
  streamIdleTimeoutMs?: number;
}
```

**Default Values** (match Rust):
- `requestMaxRetries`: 3
- `streamIdleTimeoutMs`: 60000 (60 seconds)
- `wireApi`: 'responses' (for OpenAI)

---

### 9. ModelFamily

**Rust Reference**: `codex-rs/core/src/model_family.rs`

```rust
pub struct ModelFamily {
    pub family: String,
    pub base_instructions: String,
    pub supports_reasoning_summaries: bool,
    pub needs_special_apply_patch_instructions: bool,
}
```

**TypeScript Equivalent**:

```typescript
interface ModelFamily {
  /** Model family identifier (e.g., "gpt-4", "gpt-5") */
  family: string;

  /** Base system instructions for this model family */
  baseInstructions: string;

  /** Whether this model supports reasoning summaries */
  supportsReasoningSummaries: boolean;

  /** Whether this model needs special apply_patch instructions */
  needsSpecialApplyPatchInstructions: boolean;
}
```

---

### 10. ResponsesApiRequest

**Rust Reference**: `codex-rs/core/src/client_common.rs:166-178`

```rust
pub(crate) struct ResponsesApiRequest<'a> {
    pub(crate) model: &'a str,
    pub(crate) instructions: &'a str,
    pub(crate) input: &'a [ResponseItem],
    pub(crate) tools: &'a [Value],
    pub(crate) tool_choice: &'a str,
    pub(crate) parallel_tool_calls: bool,
    pub(crate) reasoning: Option<Reasoning>,
    pub(crate) store: bool,
    pub(crate) stream: bool,
    pub(crate) include: Vec<String>,
    pub(crate) prompt_cache_key: Option<String>,
    pub(crate) text: Option<TextControls>,
}
```

**TypeScript Equivalent**:

```typescript
interface ResponsesApiRequest {
  /** Model identifier */
  model: string;

  /** System instructions */
  instructions: string;

  /** Input conversation items */
  input: ResponseItem[];

  /** Available tools */
  tools: unknown[];

  /** Tool choice strategy */
  tool_choice: 'auto' | 'required' | 'none';

  /** Allow parallel tool calls */
  parallel_tool_calls: boolean;

  /** Reasoning configuration */
  reasoning?: Reasoning;

  /** Store conversation (Azure workaround) */
  store: boolean;

  /** Enable streaming */
  stream: boolean;

  /** Fields to include in response */
  include: string[];

  /** Prompt caching key */
  prompt_cache_key?: string;

  /** Text output controls */
  text?: TextControls;
}
```

---

## Type Hierarchy

```
ModelClient (abstract)
├── OpenAIResponsesClient (concrete)
├── OpenAIChatClient (future)
├── AnthropicClient (future)
└── GeminiClient (future)

Prompt
└── input: ResponseItem[]
    └── (defined in codex-protocol)

ResponseEvent (discriminated union)
├── Created
├── OutputItemDone
├── Completed
├── OutputTextDelta
├── ReasoningSummaryDelta
├── ReasoningContentDelta
├── ReasoningSummaryPartAdded
├── WebSearchCallBegin
└── RateLimits

ResponseStream (class)
└── Implements AsyncIterableIterator<ResponseEvent>
```

## Validation & Constraints

### ModelClient
- `apiKey` must not be empty
- `conversationId` must be valid UUID or string ID
- `modelFamily.family` must match known families

### Prompt
- `input` array must have at least 1 item
- `tools` array validated against ToolDefinition schema
- `outputSchema` must be valid JSON Schema if provided

### ResponseEvent
- All variants must have `type` field
- `OutputItemDone.item` must be valid ResponseItem
- `Completed.responseId` must not be empty
- `Completed.tokenUsage` fields must be non-negative

### ResponseStream
- Buffer size limited to prevent memory issues
- Timeout configured per provider settings
- Supports abort via AbortController

### TokenUsage
- All counts must be ≥ 0
- `total_tokens` = `input_tokens` + `output_tokens`

### RateLimitSnapshot
- `used_percent` in range [0, 100]
- `window_minutes` and `resets_in_seconds` must be positive if present

## Summary

All data structures aligned with Rust reference implementation:
- 10 core types/interfaces defined
- Rust → TypeScript type mappings documented
- Field naming preserves Rust conventions (snake_case for API types, camelCase for methods)
- Validation rules extracted from Rust code
- Behavioral equivalence maintained (especially ResponseStream)

Next: Create API contracts defining method signatures
