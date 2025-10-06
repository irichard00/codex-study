# Data Model: codex-chrome Model Client

**Feature**: Align codex-chrome Model Client with codex-rs
**Date**: 2025-10-05
**Status**: Design Phase

## Overview

This document defines the data entities for the model client implementation, aligned with the Rust implementation in `codex-rs/core/src/client.rs`. All type field names use `snake_case` to match Rust serde serialization (FR-002, FR-037).

## Core Entities

### 1. ModelClient (Abstract Base Class)

**Purpose**: Abstract interface for LLM API clients, provider-agnostic
**Rust Reference**: `codex-rs/core/src/client.rs` lines 75-109

**Fields**:
```typescript
abstract class ModelClient {
  protected retryConfig: RetryConfig;
  // Subclass-specific fields (provider, conversationId, etc.)
}
```

**Methods**:
```typescript
// Primary streaming interface (FR-004)
abstract stream(prompt: Prompt): Promise<ResponseStream>;

// Model capability queries
abstract getModelContextWindow(): number | undefined;      // FR-007, Rust line 111
abstract getAutoCompactTokenLimit(): number | undefined;   // FR-008, Rust line 117
abstract getModelFamily(): ModelFamily;                    // FR-008, Rust line 438

// Provider information
abstract getProvider(): ModelProviderInfo;                 // Rust line 424

// Reasoning configuration (for models that support it)
abstract getReasoningEffort(): ReasoningEffortConfig | undefined;
abstract getReasoningSummary(): ReasoningSummaryConfig | undefined;

// Model selection
abstract getModel(): string;
abstract setModel(model: string): void;

// Authentication (browser environment returns undefined)
abstract getAuthManager(): undefined;  // FR-014 - no OAuth in browser

// Protected methods for implementation
protected abstract attemptStreamResponses(attempt: number, payload: any): Promise<ResponseStream>;  // FR-005
protected abstract processSSE(stream: ReadableStream<Uint8Array>, headers?: Headers): AsyncGenerator<ResponseEvent>;
protected abstract parseRateLimitSnapshot(headers?: Headers): RateLimitSnapshot | undefined;  // FR-006
```

**Validation Rules**:
- Cannot be instantiated directly (abstract class)
- Subclasses must implement all abstract methods

**State**: Immutable configuration after construction

**Relationships**:
- Extended by `OpenAIResponsesClient`, future `GeminiClient`, `ClaudeClient`
- Uses `Prompt` as input for stream()
- Returns `ResponseStream` from stream()
- Returns `ModelProviderInfo` from getProvider()

---

### 2. OpenAIResponsesClient

**Purpose**: Concrete implementation for OpenAI Responses API (experimental)
**Rust Reference**: `codex-rs/core/src/client.rs` impl for Responses API

**Fields**:
```typescript
class OpenAIResponsesClient extends ModelClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organization?: string;
  private readonly conversationId: string;
  private readonly modelFamily: ModelFamily;
  private readonly provider: ModelProviderInfo;
  private reasoningEffort?: ReasoningEffortConfig;
  private reasoningSummary?: ReasoningSummaryConfig;
  private modelVerbosity?: OpenAiVerbosity;
  private currentModel: string;
}
```

**Methods**:
- Implements all `ModelClient` abstract methods
- `stream()`: Dispatches to Responses API (FR-009, Rust line 126)
- `attemptStreamResponses()`: Single retry attempt (FR-005, Rust line 271)
- `processSSE()`: Parse SSE events (FR-017-020, Rust line 637)
- `parseRateLimitSnapshot()`: Extract rate limits (FR-006, Rust line 580)

**Validation Rules**:
- `apiKey` must be non-empty string (FR-013)
- `conversationId` must be non-empty string
- `baseUrl` defaults to `https://api.openai.com/v1`

**State Transitions**:
- Immutable configuration
- Streams created per request (stateless)

**Relationships**:
- Extends `ModelClient`
- Uses `ModelProviderInfo` for configuration
- Creates `ResponseStream` instances

---

### 3. ResponseStream

**Purpose**: Async iterable stream of ResponseEvent objects
**Rust Reference**: `codex-rs/core/src/client.rs` line 32, line 348

**Fields**:
```typescript
class ResponseStream {
  private events: ResponseEvent[] = [];              // Event queue
  private resolvers: Array<(value: IteratorResult<ResponseEvent>) => void> = [];
  private completed: boolean = false;
  private error: Error | null = null;
}
```

**Methods**:
```typescript
// Async iteration support
[Symbol.asyncIterator](): AsyncIterator<ResponseEvent>;

// Internal methods for event management
addEvent(event: ResponseEvent): void;
complete(): void;
error(err: Error): void;
```

**Validation Rules**:
- Can only complete once (`completed` flag prevents duplicate completion)
- Cannot add events after completion
- Error terminates stream immediately

**State Transitions**:
```
open → [adding events] → completed
open → [adding events] → errored
```

**Event Ordering** (FR-010, Rust line 328-346):
1. RateLimits (optional, from headers)
2. Created (optional)
3. Stream events (OutputItemDone, OutputTextDelta, etc.)
4. Completed (required, emitted last)

**Relationships**:
- Yields `ResponseEvent` objects
- Created by `ModelClient.stream()`
- Consumed via `for await (const event of stream)`

---

### 4. ResponseEvent (Union Type)

**Purpose**: Discriminated union of all possible SSE event types
**Rust Reference**: `codex-rs/core/src/client_common.rs` ResponseEvent enum

**Variants**:
```typescript
type ResponseEvent =
  | { type: 'Created' }
  | { type: 'OutputItemDone'; item: ResponseItem }
  | { type: 'OutputTextDelta'; delta: string }
  | { type: 'ReasoningSummaryDelta'; delta: string }
  | { type: 'ReasoningContentDelta'; delta: string }
  | { type: 'ReasoningSummaryPartAdded' }
  | { type: 'WebSearchCallBegin'; callId: string }
  | { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage }
  | { type: 'RateLimits'; snapshot: RateLimitSnapshot };
```

**Validation Rules**:
- `type` field determines variant schema
- All variants must have `type` discriminator
- Type-specific fields validated per variant

**SSE Event Mapping** (FR-018):
- `response.created` → Created
- `response.output_item.done` → OutputItemDone
- `response.output_text.delta` → OutputTextDelta
- `response.reasoning_summary_text.delta` → ReasoningSummaryDelta
- `response.reasoning_text.delta` → ReasoningContentDelta
- `response.reasoning_summary_part.added` → ReasoningSummaryPartAdded
- `response.output_item.added` (web_search_call) → WebSearchCallBegin
- `response.completed` → Completed
- HTTP headers → RateLimits

**Relationships**:
- Emitted by `ResponseStream`
- Contains `ResponseItem` (OutputItemDone variant)
- Contains `TokenUsage` (Completed variant)
- Contains `RateLimitSnapshot` (RateLimits variant)

---

### 5. Prompt

**Purpose**: Input structure for model streaming requests
**Rust Reference**: `codex-rs/core/src/client_common.rs` Prompt struct

**Fields**:
```typescript
interface Prompt {
  input: ResponseItem[];                    // Required: conversation history
  tools: ToolDefinition[];                  // Available tools
  baseInstructionsOverride?: string;        // Optional: override base instructions
  outputSchema?: object;                    // Optional: structured output schema
}
```

**Validation Rules**:
- `input` array must not be empty (enforced in stream() method)
- `tools` array can be empty

**Relationships**:
- Input to `ModelClient.stream()`
- Contains array of `ResponseItem`
- Contains array of `ToolDefinition`

---

### 6. ModelProviderInfo

**Purpose**: Configuration for LLM API provider
**Rust Reference**: `codex-rs/core/src/model_provider_info.rs`

**Fields**:
```typescript
interface ModelProviderInfo {
  name: string;                              // Provider name (e.g., "openai")
  baseUrl?: string;                          // API base URL
  envKey?: string;                           // Environment variable name for API key
  wireApi: 'Responses' | 'Chat';             // Wire protocol (FR-024)
  requestMaxRetries?: number;                // Max retry attempts (FR-011)
  streamIdleTimeoutMs?: number;              // Stream idle timeout
  queryParams?: Record<string, string>;      // Additional query parameters
  httpHeaders?: Record<string, string>;      // Additional HTTP headers
}
```

**Validation Rules**:
- `wireApi` must be "Responses" or "Chat"
- `requestMaxRetries` defaults to 3 if not specified
- `streamIdleTimeoutMs` defaults to provider-specific value

**Relationships**:
- Used by `ModelClient` for configuration
- Returned by `ModelClient.getProvider()`

---

### 7. RateLimitSnapshot

**Purpose**: Rate limit information from HTTP headers
**Rust Reference**: `codex-rs/core/src/protocol.rs` lines 580-595

**Fields**:
```typescript
interface RateLimitSnapshot {
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
}

interface RateLimitWindow {
  used_percent: number;                      // 0.0-100.0
  window_minutes?: number;                   // Window size in minutes
  resets_in_seconds?: number;                // Time until reset
}
```

**Validation Rules**:
- At least one of `primary` or `secondary` must be present
- `used_percent` must be 0.0-100.0
- All fields use snake_case (FR-002, FR-037)

**Header Mapping** (FR-006, Rust line 580):
- Primary: `x-codex-primary-used-percent`, `x-codex-primary-window-minutes`, `x-codex-primary-resets-in-seconds`
- Secondary: `x-codex-secondary-used-percent`, `x-codex-secondary-window-minutes`, `x-codex-secondary-resets-in-seconds`

**Relationships**:
- Extracted from HTTP headers by `parseRateLimitSnapshot()`
- Included in `RateLimits` ResponseEvent

---

### 8. TokenUsage

**Purpose**: Token usage statistics from model response
**Rust Reference**: `codex-rs/core/src/protocol.rs` TokenUsage struct

**Fields**:
```typescript
interface TokenUsage {
  input_tokens: number;                      // Prompt tokens
  cached_input_tokens: number;               // Cached prompt tokens
  output_tokens: number;                     // Completion tokens
  reasoning_output_tokens: number;           // Reasoning tokens (o1 models)
  total_tokens: number;                      // Total tokens
}
```

**Validation Rules**:
- All fields must be non-negative integers
- `total_tokens` should equal sum of input + output tokens
- All fields use snake_case (FR-002, FR-037)

**Conversion** (Rust line 525):
```typescript
// From API ResponseCompletedUsage to internal TokenUsage
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

**Relationships**:
- Included in `Completed` ResponseEvent
- Converted from API format to internal format

---

### 9. StreamAttemptError (Union Type)

**Purpose**: Error types for streaming request attempts
**Rust Reference**: `codex-rs/core/src/client.rs` lines 457-499

**Variants**:
```typescript
type StreamAttemptError =
  | {
      type: 'RetryableHttpError';
      status: number;
      retryAfter?: number;                   // Milliseconds
      requestId?: string;
    }
  | {
      type: 'RetryableTransportError';
      error: Error;
    }
  | {
      type: 'Fatal';
      error: Error;
    };
```

**Retryability Rules** (FR-033):
- **Retryable**: 500, 502, 503, 504, 429, transport errors
- **Fatal**: 400, 401, 403, 404, client errors

**Delay Calculation** (FR-034, FR-035, Rust line 469):
```typescript
function calculateDelay(error: StreamAttemptError, attempt: number): number {
  if (error.type === 'RetryableHttpError' && error.retryAfter) {
    return error.retryAfter;  // Use server-provided delay
  }
  return backoff(attempt);    // Exponential backoff with jitter
}
```

**Relationships**:
- Internal error type in retry logic
- Not exposed to consumers (converted to ModelClientError)

---

### 10. ModelFamily

**Purpose**: Model family configuration
**Rust Reference**: `codex-rs/core/src/model_family.rs`

**Fields**:
```typescript
interface ModelFamily {
  family: string;                            // e.g., "gpt-4", "gpt-5"
  baseInstructions: string;                  // Base system instructions
  supportsReasoningSummaries: boolean;       // Supports reasoning (o1, GPT-5)
  needsSpecialApplyPatchInstructions: boolean;
}
```

**Relationships**:
- Returned by `ModelClient.getModelFamily()`
- Used to determine API features (reasoning, verbosity, etc.)

---

### 11. ResponseItem (Union Type)

**Purpose**: Individual items in conversation history
**Rust Reference**: `codex-protocol::models::ResponseItem`

**Variants** (FR-040):
```typescript
type ResponseItem =
  | MessageItem
  | ReasoningItem
  | FunctionCallItem
  | FunctionCallOutputItem
  | WebSearchCallItem
  | LocalShellCallItem
  | CustomToolCallItem;

interface MessageItem {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: 'input_text' | 'output_text'; text: string }>;
  id?: string;
}

// Other variants follow similar structure
```

**Validation Rules**:
- `type` field determines variant schema
- Each variant has specific required/optional fields

**Relationships**:
- Used in `Prompt.input` array
- Emitted in `OutputItemDone` ResponseEvent

---

## Data Flow

### 1. Streaming Request Flow

```
User Code
  → ModelClient.stream(prompt)
    → OpenAIResponsesClient.stream()
      → attemptStreamResponses() [with retries]
        → fetch() with headers
        → processSSE(response.body)
          → parseRateLimitSnapshot(headers)
            → yield RateLimits event
          → parse SSE events
            → yield stream events
          → yield Completed event
        → return ResponseStream
  → for await (const event of stream)
    → consume ResponseEvent objects
```

### 2. Error Handling Flow

```
attemptStreamResponses()
  → fetch() throws
    → Catch error
      → Classify as StreamAttemptError
        → RetryableHttpError (429, 5xx) → retry
        → RetryableTransportError (network) → retry
        → Fatal (401, 404) → throw immediately
      → Calculate backoff delay
      → Sleep and retry
  → Max retries reached
    → Convert to ModelClientError
    → Throw to user
```

### 3. SSE Event Processing Flow

```
processSSE(stream)
  → ReadableStream.getReader()
  → read() chunks
    → TextDecoder.decode()
    → Buffer and split lines
    → Extract "data: {json}" lines
      → JSON.parse()
      → Match event type
        → response.output_item.done → yield OutputItemDone
        → response.output_text.delta → yield OutputTextDelta
        → response.completed → store, yield at end
        → response.failed → throw error
  → Stream ends
    → yield Completed (stored from earlier)
```

## Validation Matrix

| Entity | Required Fields | Optional Fields | Validation Rules |
|--------|----------------|-----------------|------------------|
| ModelClient | (abstract) | (abstract) | Cannot instantiate |
| OpenAIResponsesClient | apiKey, conversationId, modelFamily, provider | organization, reasoningEffort, reasoningSummary, modelVerbosity | apiKey non-empty |
| ResponseStream | events, completed | error | Single completion only |
| ResponseEvent | type | variant-specific | Type determines schema |
| Prompt | input, tools | baseInstructionsOverride, outputSchema | input non-empty |
| ModelProviderInfo | name, wireApi | baseUrl, requestMaxRetries, etc. | wireApi = "Responses"\|"Chat" |
| RateLimitSnapshot | one of primary/secondary | both optional | At least one present |
| TokenUsage | all fields required | none | All non-negative |
| StreamAttemptError | type | variant-specific | Determines retryability |
| ModelFamily | family, baseInstructions, booleans | none | - |
| ResponseItem | type | variant-specific | Type determines schema |

## Naming Conventions Summary

**Methods** (camelCase):
- `stream()`, `getModelContextWindow()`, `getAutoCompactTokenLimit()`, `getModelFamily()`, `getProvider()`

**Data Fields** (snake_case):
- `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`
- `used_percent`, `window_minutes`, `resets_in_seconds`
- All interface/type fields matching JSON serialization

**Types** (PascalCase):
- `ModelClient`, `ResponseStream`, `ResponseEvent`, `TokenUsage`, `RateLimitSnapshot`

This aligns with Rust's public API (methods) and serde serialization (data) conventions.

---

**Status**: Phase 1 Step 1 Complete ✅
**Next**: Generate contracts in `contracts/` directory
