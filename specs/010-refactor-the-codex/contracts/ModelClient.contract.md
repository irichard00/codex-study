# ModelClient API Contract

**Feature**: 010-refactor-the-codex
**Rust Reference**: `codex-rs/core/src/client.rs:85-445`
**TypeScript Target**: `codex-chrome/src/models/ModelClient.ts`

## Contract Overview

This contract defines the public API for the `ModelClient` abstract base class. All methods must match the Rust implementation signatures (accounting for type system differences).

## Public Methods

### 1. stream()

**Rust Signature** (line 124):
```rust
pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream>
```

**TypeScript Signature**:
```typescript
async stream(prompt: Prompt): Promise<ResponseStream>
```

**Contract**:
- **Input**: `Prompt` object with `input`, `tools`, optional `baseInstructionsOverride`
- **Output**: `Promise<ResponseStream>` that resolves to ResponseStream instance
- **Behavior**:
  - Dispatches to `streamResponses()` or `streamChat()` based on `provider.wireApi`
  - For `wireApi: 'responses'` → calls `streamResponses()`
  - For `wireApi: 'chat'` → calls `streamChat()`
  - Returns immediately with ResponseStream (events populate asynchronously)
- **Errors**:
  - Throws `ModelClientError` if prompt validation fails
  - Throws on authentication failures (401)
  - Throws on non-retryable errors (4xx except 429)
  - Retries on 5xx and 429 with exponential backoff

**Validation**:
- `prompt.input` must not be empty
- `prompt.tools` must be valid ToolDefinition array

**Example Usage**:
```typescript
const client = new OpenAIResponsesClient(config);
const prompt: Prompt = {
  input: [{ type: 'message', role: 'user', content: 'Hello' }],
  tools: [],
};

const stream = await client.stream(prompt);
for await (const event of stream) {
  console.log(event.type); // 'Created', 'OutputTextDelta', 'Completed', etc.
}
```

---

### 2. getModel()

**Rust Signature** (line 423):
```rust
pub fn get_model(&self) -> String
```

**TypeScript Signature**:
```typescript
getModel(): string
```

**Contract**:
- **Input**: None
- **Output**: String identifier of current model (e.g., "gpt-4", "gpt-5")
- **Behavior**: Returns the currently configured model slug

**Example**:
```typescript
const model = client.getModel();
// Returns: "gpt-4"
```

---

### 3. getModelFamily()

**Rust Signature** (line 428):
```rust
pub fn get_model_family(&self) -> ModelFamily
```

**TypeScript Signature**:
```typescript
getModelFamily(): ModelFamily
```

**Contract**:
- **Input**: None
- **Output**: `ModelFamily` object with family, baseInstructions, capabilities
- **Behavior**: Returns the model family configuration

**Example**:
```typescript
const family = client.getModelFamily();
// Returns: { family: "gpt-4", baseInstructions: "...", supportsReasoningSummaries: false, ... }
```

---

### 4. getModelContextWindow()

**Rust Signature** (line 109):
```rust
pub fn get_model_context_window(&self) -> Option<u64>
```

**TypeScript Signature**:
```typescript
getModelContextWindow(): number | undefined
```

**Contract**:
- **Input**: None
- **Output**: Context window size in tokens, or `undefined` if unknown
- **Behavior**:
  - Checks config override first
  - Falls back to model-specific lookup
  - Returns `undefined` for unknown models

**Example**:
```typescript
const contextWindow = client.getModelContextWindow();
// Returns: 128000 for gpt-4-turbo, undefined for unknown models
```

---

### 5. getAutoCompactTokenLimit()

**Rust Signature** (line 115):
```rust
pub fn get_auto_compact_token_limit(&self) -> Option<i64>
```

**TypeScript Signature**:
```typescript
getAutoCompactTokenLimit(): number | undefined
```

**Contract**:
- **Input**: None
- **Output**: Token limit for auto-compaction, or `undefined` if not applicable
- **Behavior**:
  - Checks config override first
  - Falls back to 80% of context window
  - Returns `undefined` if context window unknown

**Example**:
```typescript
const limit = client.getAutoCompactTokenLimit();
// Returns: 102400 (80% of 128000) for gpt-4-turbo
```

---

### 6. getProvider()

**Rust Signature** (line 414):
```rust
pub fn get_provider(&self) -> ModelProviderInfo
```

**TypeScript Signature**:
```typescript
getProvider(): ModelProviderInfo
```

**Contract**:
- **Input**: None
- **Output**: `ModelProviderInfo` with name, baseUrl, wireApi, retry config
- **Behavior**: Returns clone/copy of provider configuration

**Example**:
```typescript
const provider = client.getProvider();
// Returns: { name: "openai", wireApi: "responses", requestMaxRetries: 3, ... }
```

---

### 7. getReasoningEffort()

**Rust Signature** (line 433):
```rust
pub fn get_reasoning_effort(&self) -> Option<ReasoningEffortConfig>
```

**TypeScript Signature**:
```typescript
getReasoningEffort(): ReasoningEffortConfig | undefined
```

**Contract**:
- **Input**: None
- **Output**: Current reasoning effort setting, or `undefined`
- **Behavior**: Returns effort level for o1/o3 models

**Example**:
```typescript
const effort = client.getReasoningEffort();
// Returns: "medium" | "high" | undefined
```

---

### 8. getReasoningSummary()

**Rust Signature** (line 437):
```rust
pub fn get_reasoning_summary(&self) -> ReasoningSummaryConfig
```

**TypeScript Signature**:
```typescript
getReasoningSummary(): ReasoningSummaryConfig
```

**Contract**:
- **Input**: None
- **Output**: Current reasoning summary setting
- **Behavior**: Returns summary mode for o1/o3 models

**Example**:
```typescript
const summary = client.getReasoningSummary();
// Returns: "enabled" | "disabled"
```

---

### 9. getAuthManager()

**Rust Signature** (line 442):
```rust
pub fn get_auth_manager(&self) -> Option<Arc<AuthManager>>
```

**TypeScript Signature**:
```typescript
getAuthManager(): undefined
```

**Contract**:
- **Input**: None
- **Output**: Always `undefined` in browser implementation
- **Behavior**: Browser uses API keys via Chrome Storage, no AuthManager

**Example**:
```typescript
const authManager = client.getAuthManager();
// Always returns: undefined (browser environment)
```

---

## Protected Methods (Internal API)

### 10. streamResponses()

**Rust Signature** (line 167):
```rust
async fn stream_responses(&self, prompt: &Prompt) -> Result<ResponseStream>
```

**TypeScript Signature**:
```typescript
protected async streamResponses(prompt: Prompt): Promise<ResponseStream>
```

**Contract**:
- **Input**: `Prompt` object
- **Output**: `Promise<ResponseStream>`
- **Behavior**:
  - Implements OpenAI Responses API streaming
  - Handles retry logic (calls `attemptStreamResponses()` in loop)
  - Returns ResponseStream with events populated asynchronously
- **Errors**: Throws `ModelClientError` after max retries exhausted

---

### 11. attemptStreamResponses()

**Rust Signature** (line 269):
```rust
async fn attempt_stream_responses(
    &self,
    attempt: u64,
    payload_json: &Value,
    auth_manager: &Option<Arc<AuthManager>>,
) -> std::result::Result<ResponseStream, StreamAttemptError>
```

**TypeScript Signature**:
```typescript
protected async attemptStreamResponses(
  attempt: number,
  payload: ResponsesApiRequest
): Promise<ResponseStream>
```

**Contract**:
- **Input**:
  - `attempt`: Current retry attempt number (0-indexed)
  - `payload`: Complete API request payload
- **Output**: `Promise<ResponseStream>` if successful
- **Behavior**:
  - Single HTTP request attempt
  - Parses response headers for rate limits
  - Spawns SSE processing
  - Returns stream immediately
- **Errors**: Throws `StreamAttemptError` with retry classification

---

### 12. processSSE()

**Rust Signature** (line 624):
```rust
async fn process_sse<S>(
    stream: S,
    tx_event: mpsc::Sender<Result<ResponseEvent>>,
    idle_timeout: Duration,
    otel_event_manager: OtelEventManager,
) where S: Stream<Item = Result<Bytes>> + Unpin
```

**TypeScript Signature**:
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
  - Parses SSE data lines
  - Converts SSE events to ResponseEvent variants
  - Handles timeout (idle_timeout from provider config)
  - Yields events as they arrive
  - Throws on stream errors or timeout
- **Event Mapping** (from Rust line 712-846):
  - `response.created` → `{ type: 'Created' }`
  - `response.output_item.done` → `{ type: 'OutputItemDone', item }`
  - `response.output_text.delta` → `{ type: 'OutputTextDelta', delta }`
  - `response.completed` → `{ type: 'Completed', responseId, tokenUsage }`
  - `response.failed` → throws Error

---

### 13. parseRateLimitSnapshot()

**Rust Signature** (line 567):
```rust
fn parse_rate_limit_snapshot(headers: &HeaderMap) -> Option<RateLimitSnapshot>
```

**TypeScript Signature**:
```typescript
protected parseRateLimitSnapshot(headers?: Headers): RateLimitSnapshot | undefined
```

**Contract**:
- **Input**: Optional HTTP response headers
- **Output**: `RateLimitSnapshot` if rate limit headers present, `undefined` otherwise
- **Behavior**:
  - Parses `x-codex-primary-*` headers
  - Parses `x-codex-secondary-*` headers
  - Returns `undefined` if no rate limit data found
- **Headers Parsed**:
  - `x-codex-primary-used-percent`
  - `x-codex-primary-window-minutes`
  - `x-codex-primary-reset-after-seconds`
  - `x-codex-secondary-*` (same pattern)

---

## Contract Test Requirements

Contract tests must verify:

1. **Method Signatures**:
   - All public methods exist
   - Method parameters match contract
   - Return types match contract

2. **Behavior**:
   - `stream()` returns ResponseStream instance
   - `stream()` dispatches based on `wireApi`
   - Getter methods return correct types
   - Protected methods follow Rust flow

3. **Error Handling**:
   - Validation errors throw ModelClientError
   - Retry logic matches Rust (max retries, backoff)
   - StreamAttemptError classification correct

4. **SSE Processing**:
   - All Rust event types handled
   - Event mapping matches Rust implementation
   - Timeout behavior matches Rust
   - Error events throw exceptions

## Example Contract Test

```typescript
describe('ModelClient Contract', () => {
  let client: ModelClient;

  beforeEach(() => {
    client = new OpenAIResponsesClient({
      apiKey: 'test-key',
      conversationId: 'test-conv',
      modelFamily: { family: 'gpt-4', /* ... */ },
      provider: { name: 'openai', wireApi: 'responses', /* ... */ },
    });
  });

  describe('stream()', () => {
    it('returns ResponseStream matching Rust Result<ResponseStream>', async () => {
      const prompt: Prompt = {
        input: [{ type: 'message', role: 'user', content: 'Hi' }],
        tools: [],
      };

      const result = await client.stream(prompt);

      // Verify type
      expect(result).toBeInstanceOf(ResponseStream);

      // Verify async iterable
      expect(result[Symbol.asyncIterator]).toBeDefined();
    });

    it('throws on empty input array', async () => {
      const prompt: Prompt = { input: [], tools: [] };

      await expect(client.stream(prompt)).rejects.toThrow(ModelClientError);
    });
  });

  describe('getModelContextWindow()', () => {
    it('returns number | undefined matching Rust Option<u64>', () => {
      const result = client.getModelContextWindow();

      expect(result === undefined || typeof result === 'number').toBe(true);
    });
  });

  describe('parseRateLimitSnapshot()', () => {
    it('parses headers matching Rust logic', () => {
      const headers = new Headers({
        'x-codex-primary-used-percent': '75.5',
        'x-codex-primary-window-minutes': '60',
      });

      const snapshot = (client as any).parseRateLimitSnapshot(headers);

      expect(snapshot).toBeDefined();
      expect(snapshot.primary.used_percent).toBe(75.5);
      expect(snapshot.primary.window_minutes).toBe(60);
    });
  });
});
```

## Summary

Contract defines 13 methods (9 public, 4 protected) matching Rust implementation:
- All signatures align with Rust (accounting for type mappings)
- Behavior matches Rust execution flow
- Error handling preserves Rust retry/error classification
- SSE processing matches Rust event mapping
- Contract tests verify compliance
