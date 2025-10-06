# Research: Rust-to-TypeScript Model Client Alignment

**Feature**: Align codex-chrome Model Client with codex-rs
**Date**: 2025-10-05
**Status**: Complete

## Research Summary

This document captures all technical research decisions for porting the Rust model client implementation (`codex-rs/core/src/client.rs`) to TypeScript for the Chrome extension environment (`codex-chrome/src/models`).

## 1. Rust-to-TypeScript Type Mapping

### Decision
Map Rust types to TypeScript idiomatically while preserving semantics:
- `Result<T>` → `Promise<T>` (throws on error)
- `Option<T>` → `T | undefined`
- Rust enums → TypeScript discriminated union types
- Rust structs → TypeScript interfaces/types with snake_case fields (matching serde serialization)

### Rationale
- **Promise<T>**: TypeScript's native async error handling via try/catch matches Rust's `Result` unwrapping semantics
- **T | undefined**: Direct mapping for optional values, no wrapper needed
- **Union types**: TypeScript discriminated unions provide type-safe pattern matching like Rust enums
- **snake_case fields**: Matches JSON serialization from Rust (serde default), ensures wire protocol compatibility

### Alternatives Considered
1. **ts-results library**: Provides Result<T, E> type
   - Rejected: Adds external dependency, TypeScript ecosystem prefers Promises for async operations

2. **camelCase fields with transformation**: Convert snake_case ↔ camelCase at boundaries
   - Rejected: Adds complexity, error-prone, requirement specifies exact matching (FR-002, FR-037)

3. **Maybe/Option monad library**:
   - Rejected: Adds dependency, T | undefined is idiomatic TypeScript

### Implementation Notes
```typescript
// Rust: pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream>
// TypeScript:
async stream(prompt: Prompt): Promise<ResponseStream>

// Rust: pub fn get_model_context_window(&self) -> Option<u64>
// TypeScript:
getModelContextWindow(): number | undefined

// Rust: enum StreamAttemptError { RetryableHttpError {...}, Fatal(CodexErr) }
// TypeScript:
type StreamAttemptError =
  | { type: 'RetryableHttpError'; status: number; retryAfter?: number }
  | { type: 'RetryableTransportError'; error: Error }
  | { type: 'Fatal'; error: Error };

// Rust: struct TokenUsage { input_tokens: u64, cached_input_tokens: u64, ... }
// TypeScript:
interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}
```

## 2. Browser API Equivalents

### Decision
Map Rust async networking and concurrency to browser-native APIs:
- `reqwest::Client` → `fetch()` API
- Rust async streams → `ReadableStream<Uint8Array>`
- `tokio::mpsc::channel` → Promise-based async event queue
- `tokio::spawn` → Async IIFE (immediately invoked async function)

### Rationale
- **fetch()**: Native browser API, no dependencies, supports streaming via ReadableStream
- **ReadableStream**: Browser standard for streaming data, perfect for SSE parsing
- **Promise-based queue**: Simpler than channels, leverages async/await naturally
- **Async IIFE**: Equivalent to Rust's `tokio::spawn` for background tasks

### Alternatives Considered
1. **XMLHttpRequest**:
   - Rejected: Legacy API, doesn't support streaming as cleanly as fetch

2. **EventSource API**: Native SSE support
   - Rejected: Cannot set custom headers (OpenAI-Beta, conversation_id) required by FR-029

3. **Node.js http/https modules**:
   - Rejected: Not available in browser environment (constraint from FR-015)

4. **RxJS Observables**: Reactive streams library
   - Rejected: Heavy dependency (1MB+), overkill for this use case

### Implementation Notes
```typescript
// Rust: self.client.post(url).headers(headers).json(&payload).send().await
// TypeScript:
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload)
});

// Rust: let stream = resp.bytes_stream().map_err(CodexErr::Reqwest);
// TypeScript:
const stream: ReadableStream<Uint8Array> = response.body!;

// Rust: let (tx_event, rx_event) = mpsc::channel::<Result<ResponseEvent>>(1600);
// TypeScript:
class ResponseStream {
  private events: ResponseEvent[] = [];
  private resolvers: Array<(value: IteratorResult<ResponseEvent>) => void> = [];

  async *[Symbol.asyncIterator](): AsyncGenerator<ResponseEvent> {
    // Yield from events queue as they arrive
  }
}

// Rust: tokio::spawn(process_sse(...));
// TypeScript:
(async () => {
  await processSSE(...);
})();
```

## 3. SSE Parsing in Browser

### Decision
Implement manual SSE parsing using ReadableStream and TextDecoder:
1. Get ReadableStream from fetch response.body
2. Use TextDecoder to convert Uint8Array chunks to text
3. Buffer incomplete lines across chunks
4. Parse "data: {json}\n\n" format manually
5. Handle [DONE] termination signal

### Rationale
- **Custom headers required**: OpenAI Responses API needs `OpenAI-Beta`, `conversation_id`, `session_id` (FR-029)
- **EventSource limitation**: Cannot set custom headers
- **Full control**: Can match Rust's exact parsing logic (lines 637-860 in client.rs)
- **Performance**: Zero-copy parsing with TextDecoder streaming mode

### Alternatives Considered
1. **EventSource API with proxy**:
   - Rejected: Adds complexity, requires server-side proxy

2. **fetch-event-source library**:
   - Rejected: External dependency, doesn't match Rust implementation exactly

### Implementation Notes
```typescript
async *processSSE(
  stream: ReadableStream<Uint8Array>,
  headers?: Headers
): AsyncGenerator<ResponseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode chunk and append to buffer
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line

      // Process complete lines
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix

          if (data === '[DONE]') return;

          const event = JSON.parse(data);
          // Process event based on type
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

Matches Rust implementation at `client.rs:637-712`.

## 4. Test Structure Alignment

### Decision
Reorganize tests to match Rust's test organization:
- **Contract tests**: `tests/contract/` - Interface/behavior contracts (like Rust's `#[test]` in client.rs)
- **Integration tests**: `tests/integration/` - End-to-end scenarios (like Rust's `tests/` directory)
- **Unit tests**: `tests/unit/` - Individual function tests (like Rust's `mod tests`)

### Rationale
- **Consistency**: Mirrors Rust test structure (requirement for alignment)
- **TDD workflow**: Contract tests define interfaces before implementation
- **Separation**: Clear boundary between contract (interface), integration (flow), and unit (logic)

### Alternatives Considered
1. **Keep existing `__tests__/` structure**:
   - Rejected: Requirement is alignment with Rust (FR-040 references)

2. **Flat test structure**:
   - Rejected: Harder to maintain, doesn't scale

### Implementation Notes
```
tests/
├── contract/
│   ├── ModelClient.contract.test.ts       # Interface contracts
│   ├── ResponseStream.contract.test.ts
│   ├── OpenAIResponsesClient.contract.test.ts
│   └── SSEEventParser.contract.test.ts
├── integration/
│   ├── streaming.integration.test.ts      # End-to-end scenarios
│   ├── retry.integration.test.ts
│   └── rate-limits.integration.test.ts
└── unit/
    ├── parseRateLimitSnapshot.test.ts     # Individual functions
    ├── calculateBackoff.test.ts
    └── convertTokenUsage.test.ts
```

Matches Rust's test organization:
- `client.rs` has inline `#[test]` (→ contract tests)
- `codex-rs/core/tests/` (→ integration tests)
- Test modules (→ unit tests)

## 5. Method Naming Conventions

### Decision
Use exact Rust method names with TypeScript camelCase convention:
- Rust public methods: Keep same name (already camelCase-like: `stream`, `get_model_context_window`)
- Convert snake_case to camelCase: `get_model_context_window` → `getModelContextWindow`
- Data fields: Keep snake_case (matches Rust serde serialization)

### Rationale
- **Alignment requirement**: FR-001 specifies exact method name matching
- **TypeScript idiom**: Methods use camelCase in TypeScript (idiomatic)
- **Data consistency**: snake_case fields match JSON wire protocol from Rust
- **1:1 mapping**: Easy to find equivalent code in Rust codebase

### Alternatives Considered
1. **Full snake_case (Rust style)**:
   - Rejected: Not idiomatic TypeScript, violates linter rules

2. **Full camelCase (TypeScript style)**:
   - Rejected: Breaks wire protocol, requires field transformations (FR-037 forbids)

### Implementation Notes
```typescript
// Rust: pub fn get_model_context_window(&self) -> Option<u64>
// TypeScript:
getModelContextWindow(): number | undefined

// Rust: pub fn get_auto_compact_token_limit(&self) -> Option<i64>
// TypeScript:
getAutoCompactTokenLimit(): number | undefined

// Rust: pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream>
// TypeScript:
async stream(prompt: Prompt): Promise<ResponseStream>

// Rust: pub fn get_provider(&self) -> ModelProviderInfo
// TypeScript:
getProvider(): ModelProviderInfo

// Data fields (keep snake_case):
interface TokenUsage {
  input_tokens: number;          // Rust: input_tokens: u64
  cached_input_tokens: number;    // Rust: cached_input_tokens
  output_tokens: number;          // Rust: output_tokens
  reasoning_output_tokens: number; // Rust: reasoning_output_tokens
  total_tokens: number;           // Rust: total_tokens
}
```

## 6. Legacy Code Identification

### Decision
Remove any TypeScript code without a corresponding Rust equivalent in `client.rs`:

**Files to Remove**:
1. **AnthropicClient.ts** - No Anthropic support in Rust client.rs
2. **Custom retry variations** - Use only Rust's backoff() logic
3. **RequestQueue.ts** - No queue in Rust (handles concurrency differently)
4. **Deprecated method aliases** - No backward compatibility (FR-026)
5. **RateLimitManager.ts** - Rate limiting handled inline in Rust
6. **TokenUsageTracker.ts** - Not in Rust client.rs (may be elsewhere)

**Files to Keep/Align**:
1. **ModelClient.ts** - Maps to Rust `ModelClient` struct
2. **OpenAIResponsesClient.ts** - Maps to Rust `ModelClient` impl for Responses API
3. **OpenAIClient.ts** - Maps to Rust Chat Completions support
4. **ResponseStream.ts** - Maps to Rust `ResponseStream` struct
5. **SSEEventParser.ts** - Maps to Rust `process_sse()` function
6. **types/** - Maps to Rust type definitions
7. **ModelClientError.ts** - Maps to Rust `CodexErr` enum
8. **ChromeAuthManager.ts** - Browser-specific (replaces Rust `AuthManager`)
9. **ModelClientFactory.ts** - Factory pattern (not in Rust but needed for extension)

### Rationale
- **Explicit requirement**: FR-025, FR-027 require removal of non-Rust code
- **No backward compatibility**: FR-026 allows breaking changes
- **Simplification**: Reduces maintenance burden
- **Alignment**: Ensures 1:1 mapping to Rust

### Alternatives Considered
1. **Deprecate instead of remove**:
   - Rejected: FR-026 forbids backward compatibility

2. **Keep for future use**:
   - Rejected: YAGNI principle, can re-add when Rust adds support

### Implementation Notes

**Removal Checklist**:
- [ ] Remove `AnthropicClient.ts` and all references
- [ ] Remove `RequestQueue.ts` and related types
- [ ] Remove `RateLimitManager.ts`
- [ ] Remove `TokenUsageTracker.ts` (verify not used elsewhere first)
- [ ] Remove any custom retry logic that differs from Rust `backoff()`
- [ ] Remove deprecated method names (e.g., old `getContextWindow()` if it becomes `getModelContextWindow()`)
- [ ] Update imports throughout codebase
- [ ] Remove related tests

**Validation**:
- Compare TypeScript files 1:1 with Rust client.rs structure
- Ensure every TypeScript class/method has Rust equivalent
- Document browser-specific adaptations (ChromeAuthManager, fetch vs reqwest)

## Unknowns Resolved

All NEEDS CLARIFICATION items from Technical Context have been researched and decided:

| Unknown | Resolution |
|---------|------------|
| Rust-to-TS type mapping | Promise<T>, T \| undefined, union types, snake_case fields |
| Browser API equivalents | fetch(), ReadableStream, async IIFE for spawn |
| SSE parsing approach | Manual ReadableStream parsing with TextDecoder |
| Test structure | contract/integration/unit matching Rust organization |
| Method naming | camelCase methods, snake_case data fields |
| Legacy code scope | Remove all non-Rust equivalent code (detailed list above) |

## References

1. **Rust Source**: `codex-rs/core/src/client.rs` (lines 1-1343)
2. **TypeScript Target**: `codex-chrome/src/models/` directory
3. **Rust SSE Processing**: Lines 637-860 in client.rs
4. **Rust Retry Logic**: Lines 245-264 in client.rs (backoff utility)
5. **Rust Type Definitions**: `codex-rs/core/src/protocol.rs` for TokenUsage, RateLimitSnapshot, etc.
6. **OpenAI Responses API**: Experimental endpoint documentation
7. **MDN Streams API**: ReadableStream, TextDecoder references
8. **TypeScript Handbook**: Discriminated unions, async iterators

## Next Steps

Phase 0 complete ✅

Proceed to Phase 1:
1. Generate data-model.md from entities identified in research
2. Create contract files in specs/013-codex-chrome-is/contracts/
3. Write failing contract tests
4. Generate quickstart.md with user scenarios
5. Update CLAUDE.md with Rust alignment context
