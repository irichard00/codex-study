# Rust to TypeScript Naming Mapping

**Purpose**: Complete mapping of Rust names to TypeScript equivalents
**Source**: `codex-rs/core/src/client.rs` and related files
**Target**: `codex-chrome/src/models/`

## Naming Convention Rules

### Methods (snake_case → camelCase)
- **Rust**: `pub fn method_name()` → **TypeScript**: `methodName()`
- Public methods use camelCase in TypeScript (idiomatic)
- Private/protected methods also use camelCase

### Data Fields (snake_case → snake_case)
- **Rust**: `struct Field { field_name: Type }` → **TypeScript**: `interface Field { field_name: Type }`
- **KEEP snake_case** - matches Rust serde serialization
- Ensures wire protocol compatibility

### Types (PascalCase → PascalCase)
- **Rust**: `struct TypeName` → **TypeScript**: `interface TypeName` or `class TypeName`
- **Rust**: `enum TypeName` → **TypeScript**: `type TypeName = ...` (discriminated union)
- No change in casing

## Method Mappings (40+ methods)

### ModelClient Abstract Methods

| Rust Method | TypeScript Method | Notes |
|------------|-------------------|-------|
| `get_model_context_window()` | `getModelContextWindow()` | Line 111 |
| `get_auto_compact_token_limit()` | `getAutoCompactTokenLimit()` | Line 117 |
| `get_model_family()` | `getModelFamily()` | Line 438 |
| `get_provider()` | `getProvider()` | Line 424 |
| `get_model()` | `getModel()` | Line 433 |
| `set_model()` | `setModel()` | - |
| `get_reasoning_effort()` | `getReasoningEffort()` | Line 443 |
| `get_reasoning_summary()` | `getReasoningSummary()` | Line 447 |
| `set_reasoning_effort()` | `setReasoningEffort()` | - |
| `set_reasoning_summary()` | `setReasoningSummary()` | - |
| `get_auth_manager()` | `getAuthManager()` | Line 452 (returns undefined in browser) |
| `stream()` | `stream()` | Line 126 |
| `count_tokens()` | `countTokens()` | - |

### OpenAIResponsesClient Methods

| Rust Method | TypeScript Method | Notes |
|------------|-------------------|-------|
| `stream_responses()` | `streamResponses()` | Line 169 (private) |
| `attempt_stream_responses()` | `attemptStreamResponses()` | Line 271 (protected) |
| `process_sse()` | `processSSE()` | Line 637 (protected) |
| `parse_rate_limit_snapshot()` | `parseRateLimitSnapshot()` | Line 580 (protected) |
| `parse_rate_limit_window()` | `parseRateLimitWindow()` | Line 595 (private) |
| `calculate_backoff()` | `calculateBackoff()` | Referenced from util (protected) |
| `is_retryable_http_error()` | `isRetryableHttpError()` | Protected helper |
| `create_tools_json_for_responses_api()` | `createToolsJsonForResponsesApi()` | Line 184 (private) |
| `create_reasoning_param()` | `createReasoningParam()` | Line 185 (private) |
| `create_text_param()` | `createTextParam()` | Line 199 (private) |
| `get_full_instructions()` | `getFullInstructions()` | Line 183 (private) |
| `convert_token_usage()` | `convertTokenUsage()` | Line 525 (private) |
| `convert_to_api_usage()` | `convertToApiUsage()` | Reverse conversion (private) |

### SSEEventParser Methods

| Rust Method | TypeScript Method | Notes |
|------------|-------------------|-------|
| `parse()` | `parse()` | Parse single SSE line |
| `process_event()` | `processEvent()` | Convert to ResponseEvent |

### ResponseStream Methods

| Rust Method | TypeScript Method | Notes |
|------------|-------------------|-------|
| N/A (receiver) | `[Symbol.asyncIterator]()` | Async iteration |
| N/A (sender) | `addEvent()` | Internal API |
| N/A | `complete()` | Mark stream complete |
| N/A | `error()` | Mark stream errored |

## Type Mappings

### Core Types

| Rust Type | TypeScript Type | Notes |
|-----------|----------------|-------|
| `ModelClient` | `ModelClient` | Abstract class |
| `OpenAIResponsesClient` (impl) | `OpenAIResponsesClient` | Concrete class |
| `ResponseStream` | `ResponseStream` | Class with async iteration |
| `Prompt` | `Prompt` | Interface |
| `ResponseEvent` | `ResponseEvent` | Discriminated union |
| `ResponseItem` | `ResponseItem` | Discriminated union |
| `ModelFamily` | `ModelFamily` | Interface |
| `ModelProviderInfo` | `ModelProviderInfo` | Interface |
| `TokenUsage` | `TokenUsage` | Interface |
| `RateLimitSnapshot` | `RateLimitSnapshot` | Interface |
| `RateLimitWindow` | `RateLimitWindow` | Interface |
| `StreamAttemptError` | `StreamAttemptError` | Discriminated union |
| `ReasoningEffortConfig` | `ReasoningEffortConfig` | Type alias |
| `ReasoningSummaryConfig` | `ReasoningSummaryConfig` | Type alias |

### Enum to Union Type Mappings

#### WireApi Enum
```rust
pub enum WireApi {
    Responses,
    Chat,
}
```
→
```typescript
type WireApi = 'Responses' | 'Chat';
```

#### StreamAttemptError Enum
```rust
enum StreamAttemptError {
    RetryableHttpError { status: StatusCode, retry_after: Option<Duration> },
    RetryableTransportError(reqwest::Error),
    Fatal(CodexErr),
}
```
→
```typescript
type StreamAttemptError =
  | { type: 'RetryableHttpError'; status: number; retryAfter?: number; requestId?: string }
  | { type: 'RetryableTransportError'; error: Error }
  | { type: 'Fatal'; error: Error };
```

#### ResponseEvent Enum (partial)
```rust
pub enum ResponseEvent {
    Created,
    OutputItemDone { item: ResponseItem },
    OutputTextDelta { delta: String },
    Completed { response_id: String, token_usage: Option<TokenUsage> },
    RateLimits { snapshot: RateLimitSnapshot },
    // ... more variants
}
```
→
```typescript
type ResponseEvent =
  | { type: 'Created' }
  | { type: 'OutputItemDone'; item: ResponseItem }
  | { type: 'OutputTextDelta'; delta: string }
  | { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage }
  | { type: 'RateLimits'; snapshot: RateLimitSnapshot }
  // ... more variants
```

## Field Mappings (snake_case preserved)

### TokenUsage Fields

| Rust Field | TypeScript Field | Type |
|-----------|-----------------|------|
| `input_tokens` | `input_tokens` | `u64` → `number` |
| `cached_input_tokens` | `cached_input_tokens` | `u64` → `number` |
| `output_tokens` | `output_tokens` | `u64` → `number` |
| `reasoning_output_tokens` | `reasoning_output_tokens` | `u64` → `number` |
| `total_tokens` | `total_tokens` | `u64` → `number` |

**IMPORTANT**: All fields remain snake_case (matches JSON wire protocol)

### RateLimitWindow Fields

| Rust Field | TypeScript Field | Type |
|-----------|-----------------|------|
| `used_percent` | `used_percent` | `f64` → `number` |
| `window_minutes` | `window_minutes` | `Option<u64>` → `number \| undefined` |
| `resets_in_seconds` | `resets_in_seconds` | `Option<u64>` → `number \| undefined` |

### ModelProviderInfo Fields

| Rust Field | TypeScript Field | Type |
|-----------|-----------------|------|
| `name` | `name` | `String` → `string` |
| `base_url` | `baseUrl` | `Option<String>` → `string \| undefined` |
| `env_key` | `envKey` | `Option<String>` → `string \| undefined` |
| `wire_api` | `wireApi` | `WireApi` → `'Responses' \| 'Chat'` |
| `request_max_retries` | `requestMaxRetries` | `Option<u32>` → `number \| undefined` |
| `stream_idle_timeout_ms` | `streamIdleTimeoutMs` | `Option<u64>` → `number \| undefined` |

**NOTE**: Some fields use camelCase in Rust config, keep consistent

### Prompt Fields

| Rust Field | TypeScript Field | Type |
|-----------|-----------------|------|
| `input` | `input` | `Vec<ResponseItem>` → `ResponseItem[]` |
| `tools` | `tools` | `Vec<ToolDefinition>` → `ToolDefinition[]` |
| `base_instructions_override` | `baseInstructionsOverride` | `Option<String>` → `string \| undefined` |
| `output_schema` | `outputSchema` | `Option<Value>` → `object \| undefined` |

### ModelFamily Fields

| Rust Field | TypeScript Field | Type |
|-----------|-----------------|------|
| `family` | `family` | `String` → `string` |
| `base_instructions` | `baseInstructions` | `String` → `string` |
| `supports_reasoning_summaries` | `supportsReasoningSummaries` | `bool` → `boolean` |
| `needs_special_apply_patch_instructions` | `needsSpecialApplyPatchInstructions` | `bool` → `boolean` |

## Type Conversion Mappings

### Rust → TypeScript Types

| Rust Type | TypeScript Type | Notes |
|-----------|----------------|-------|
| `Result<T>` | `Promise<T>` | Async methods throw on error |
| `Option<T>` | `T \| undefined` | No wrapper needed |
| `u64`, `u32`, `i64` | `number` | JavaScript numbers |
| `f64` | `number` | Floating point |
| `String` | `string` | No change |
| `bool` | `boolean` | No change |
| `Vec<T>` | `T[]` | Array notation |
| `HashMap<K, V>` | `Record<K, V>` or `Map<K, V>` | Depends on usage |
| `&str` | `string` | Borrowed string → owned |
| `&self` | `this` | Method receiver |
| `Duration` | `number` | Milliseconds |
| `StatusCode` | `number` | HTTP status code |

### Async/Concurrency Mappings

| Rust Pattern | TypeScript Pattern | Notes |
|--------------|-------------------|-------|
| `async fn` | `async function` | Same syntax |
| `await` | `await` | Same syntax |
| `tokio::mpsc::channel` | Promise-based queue | Event queue in ResponseStream |
| `tokio::spawn` | Async IIFE `(async () => {})()` | Background task |
| `futures::Stream` | `AsyncIterable` / `AsyncGenerator` | For-await-of |
| `reqwest::Client` | `fetch()` | Browser API |
| `Response::bytes_stream()` | `response.body` (ReadableStream) | Browser API |

## Deprecated Names to Remove

### Old Method Names (Pre-Alignment)
- `getContextWindow()` → DELETE (use `getModelContextWindow()`)
- `getTokenLimit()` → DELETE (use `getAutoCompactTokenLimit()`)
- Any camelCase field accessors → DELETE (access fields directly)

### Old Type Names
- Any types with camelCase fields → DELETE (replace with snake_case)
- `InputTokens`, `OutputTokens` (if separate) → DELETE (use `TokenUsage`)

### Old Classes/Files
- `AnthropicClient` → DELETE (no Rust equivalent)
- `RequestQueue` → DELETE (no Rust equivalent, handled differently)
- `RateLimitManager` → DELETE (handled inline)
- `TokenUsageTracker` → DELETE (if not in Rust client.rs)

## Complete Method Signature Examples

### Before Alignment
```typescript
// OLD - INCORRECT
class ModelClient {
  getContextWindow(): number | undefined { ... }
}

interface TokenUsage {
  inputTokens: number;  // WRONG - camelCase
  outputTokens: number; // WRONG - camelCase
}
```

### After Alignment
```typescript
// NEW - CORRECT
abstract class ModelClient {
  abstract getModelContextWindow(): number | undefined;
  abstract getAutoCompactTokenLimit(): number | undefined;
}

interface TokenUsage {
  input_tokens: number;  // CORRECT - snake_case
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}
```

## Validation Checklist

Use this to verify naming alignment:

- [ ] All public methods use camelCase (e.g., `getModelContextWindow`)
- [ ] All data fields use snake_case (e.g., `input_tokens`)
- [ ] All type names use PascalCase (e.g., `ModelClient`)
- [ ] Rust enums mapped to TypeScript discriminated unions
- [ ] `Result<T>` → `Promise<T>` (throws on error)
- [ ] `Option<T>` → `T | undefined`
- [ ] All deprecated names removed
- [ ] No backward compatibility aliases
- [ ] Method signatures match Rust exactly (params and return types)
- [ ] Field names match JSON wire protocol (snake_case)

## Quick Reference

**Method naming**: Rust `get_model_context_window()` → TS `getModelContextWindow()`
**Field naming**: Rust `input_tokens` → TS `input_tokens` (KEEP snake_case)
**Type naming**: Rust `ModelClient` → TS `ModelClient` (no change)

**Key Rule**: Methods = camelCase, Data = snake_case, Types = PascalCase

---

This document serves as the single source of truth for all naming decisions during the alignment implementation.
