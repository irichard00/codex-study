# ModelClient API Contracts

## Overview
This document defines the API contracts for the aligned ModelClient implementation, ensuring compatibility with OpenAI's Responses API and maintaining consistency with the Rust implementation.

## OpenAIResponsesClient

### Class Definition
```typescript
export class OpenAIResponsesClient extends ModelClient {
  constructor(
    apiKey: string,
    config: ModelClientConfig
  );

  // Core streaming method for Responses API
  async streamResponses(prompt: Prompt): Promise<ResponseStream>;

  // Alternative with direct event handling
  async streamWithEvents(
    prompt: Prompt,
    onEvent: (event: ResponseEvent) => void
  ): Promise<void>;

  // Non-streaming completion
  async complete(prompt: Prompt): Promise<ResponseCompleted>;

  // Get current model configuration
  getModelFamily(): ModelFamily;

  // Token usage for session
  getTokenUsageInfo(): TokenUsageInfo;

  // Rate limit status
  getRateLimitSnapshot(): RateLimitSnapshot | null;
}
```

### Configuration Interface
```typescript
interface ModelClientConfig {
  model: string;
  model_family: ModelFamily;
  provider: ModelProviderInfo;
  auth_manager?: AuthManager;
  conversation_id: string;
  reasoning_effort?: ReasoningEffortConfig;
  reasoning_summary?: ReasoningSummaryConfig;
  retry_config?: RetryConfig;
  model_context_window?: number;
  model_verbosity?: Verbosity;
  show_raw_agent_reasoning?: boolean;
}
```

## SSEEventParser

### Class Definition
```typescript
export class SSEEventParser {
  constructor(
    private onEvent: (event: ResponseEvent) => void,
    private onError: (error: Error) => void
  );

  // Parse raw SSE data
  parse(data: string): void;

  // Process complete SSE event
  processEvent(event: SseEvent): void;

  // Handle specific event types
  private handleOutputItemDone(item: any): void;
  private handleOutputTextDelta(delta: string): void;
  private handleReasoningDelta(delta: string): void;
  private handleResponseCompleted(response: any): void;
  private handleResponseFailed(error: any): void;

  // Extract retry delay from error
  parseRetryAfter(error: any): number | null;
}
```

### Event Processing Flow
```typescript
interface SSEProcessingFlow {
  // 1. Raw SSE data received
  onData(chunk: Uint8Array): void;

  // 2. Parse into events
  parseSSE(text: string): SseEvent[];

  // 3. Route events
  routeEvent(event: SseEvent): void;

  // 4. Emit ResponseEvent
  emitEvent(event: ResponseEvent): void;

  // 5. Handle errors
  handleError(error: Error): void;
}
```

## TokenUsageTracker

### Class Definition
```typescript
export class TokenUsageTracker {
  private total: TokenUsage;
  private last: TokenUsage;
  private history: TokenUsage[];

  // Update with new usage
  update(usage: TokenUsage): void;

  // Get aggregated info
  getInfo(): TokenUsageInfo;

  // Check if approaching limit
  shouldCompact(contextWindow: number): boolean;

  // Reset tracking
  reset(): void;

  // Get usage for time range
  getUsageForRange(startTime: number, endTime: number): TokenUsage;
}
```

## RateLimitManager

### Class Definition
```typescript
export class RateLimitManager {
  private snapshot: RateLimitSnapshot | null = null;
  private lastUpdated: number = 0;

  // Update from headers
  updateFromHeaders(headers: Headers): void;

  // Get current snapshot
  getSnapshot(): RateLimitSnapshot | null;

  // Check if should retry
  shouldRetry(): boolean;

  // Get retry delay
  getRetryDelay(): number | null;

  // Parse specific headers
  private parseRateLimitHeaders(headers: Headers): RateLimitSnapshot | null;
}
```

### Header Parsing
```typescript
interface RateLimitHeaders {
  'x-codex-primary-used-percent'?: string;
  'x-codex-primary-window-minutes'?: string;
  'x-codex-primary-reset-after-seconds'?: string;
  'x-codex-secondary-used-percent'?: string;
  'x-codex-secondary-window-minutes'?: string;
  'x-codex-secondary-reset-after-seconds'?: string;
}
```

## AuthManager Implementation

### Interface
```typescript
export interface AuthManager {
  // Get current auth
  auth(): CodexAuth | null;

  // Refresh token if needed
  async refreshToken(): Promise<void>;

  // Get account ID for headers
  getAccountId(): string | null;

  // Get plan type
  getPlanType(): PlanType | null;

  // Check if token expired
  isExpired(): boolean;

  // Update auth info
  setAuth(auth: CodexAuth): void;
}
```

### ChromeAuthManager
```typescript
export class ChromeAuthManager implements AuthManager {
  constructor(
    private storage: chrome.storage.StorageArea
  );

  async auth(): Promise<CodexAuth | null>;

  async refreshToken(): Promise<void>;

  // Store auth securely
  private async storeAuth(auth: CodexAuth): Promise<void>;

  // Load from Chrome storage
  private async loadAuth(): Promise<CodexAuth | null>;
}
```

## RetryManager

### Class Definition
```typescript
export class RetryManager {
  constructor(private config: RetryConfig);

  // Execute with retry
  async execute<T>(
    fn: () => Promise<T>,
    isRetryable: (error: any) => boolean
  ): Promise<T>;

  // Calculate backoff delay
  calculateDelay(attempt: number): number;

  // Apply jitter
  applyJitter(delay: number): number;

  // Check if should retry
  shouldRetry(
    attempt: number,
    error: any
  ): boolean;
}
```

## ResponseStreamProcessor

### Class Definition
```typescript
export class ResponseStreamProcessor extends StreamProcessor {
  constructor(
    source: 'model',
    config?: StreamConfig
  );

  // Process Responses API stream
  async processResponsesStream(
    stream: ReadableStream
  ): AsyncGenerator<ResponseEvent>;

  // Handle SSE chunks
  private async *handleSSE(
    reader: ReadableStreamDefaultReader
  ): AsyncGenerator<ResponseEvent>;

  // Buffer management
  private shouldApplyBackpressure(): boolean;
  private async waitForBuffer(): Promise<void>;
}
```

## Error Handling

### ModelClientError Extensions
```typescript
export class ModelClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public provider?: string,
    public retryable: boolean = false,
    public retryAfter?: number,
    public planType?: PlanType,
    public rateLimits?: RateLimitSnapshot
  );

  static fromOpenAIError(error: any): ModelClientError;
  static fromNetworkError(error: any): ModelClientError;
  static fromUsageLimit(error: UsageLimitReachedError): ModelClientError;
}
```

## HTTP Request/Response

### Request Headers
```typescript
interface ResponsesApiHeaders {
  'Content-Type': 'application/json';
  'Authorization': `Bearer ${apiKey}`;
  'OpenAI-Beta': 'responses=experimental';
  'conversation_id': string;
  'session_id': string;
  'Accept': 'text/event-stream';
  'chatgpt-account-id'?: string;
  'OpenAI-Organization'?: string;
}
```

### Response Processing
```typescript
interface ResponseProcessor {
  // Process streaming response
  async processStream(response: Response): Promise<ResponseStream>;

  // Process non-streaming response
  async processComplete(response: Response): Promise<ResponseCompleted>;

  // Extract rate limits
  extractRateLimits(headers: Headers): RateLimitSnapshot | null;

  // Handle errors
  handleError(response: Response): Promise<never>;
}
```

## Usage Examples

### Basic Streaming
```typescript
const client = new OpenAIResponsesClient(apiKey, {
  model: 'gpt-4',
  model_family: ModelFamilies.GPT4,
  provider: OpenAIProvider,
  conversation_id: generateId()
});

const prompt: Prompt = {
  input: [
    { type: 'message', role: 'user', content: 'Hello' }
  ],
  tools: [],
  base_instructions_override: undefined,
  output_schema: undefined
};

const stream = await client.streamResponses(prompt);

for await (const event of stream) {
  switch (event.type) {
    case 'OutputTextDelta':
      console.log(event.delta);
      break;
    case 'Completed':
      console.log('Token usage:', event.tokenUsage);
      break;
  }
}
```

### With Event Handler
```typescript
await client.streamWithEvents(prompt, (event) => {
  switch (event.type) {
    case 'OutputTextDelta':
      updateUI(event.delta);
      break;
    case 'RateLimits':
      updateRateLimitUI(event.snapshot);
      break;
    case 'WebSearchCallBegin':
      showSearchIndicator(event.callId);
      break;
  }
});
```

## Testing Contracts

### Unit Test Interface
```typescript
interface ModelClientTestSuite {
  // Test SSE parsing
  testSSEEventParsing(): Promise<void>;

  // Test retry logic
  testExponentialBackoff(): Promise<void>;

  // Test rate limit parsing
  testRateLimitHeaders(): Promise<void>;

  // Test token usage aggregation
  testTokenUsageTracking(): Promise<void>;

  // Test error handling
  testErrorScenarios(): Promise<void>;
}
```

### Mock Implementations
```typescript
export class MockResponseStream extends ResponseStream {
  constructor(events: ResponseEvent[]);

  static fromSSE(sseData: string): MockResponseStream;
  static withError(error: Error): MockResponseStream;
}

export class MockAuthManager implements AuthManager {
  constructor(auth: CodexAuth);

  setExpired(expired: boolean): void;
  triggerRefresh(): Promise<void>;
}
```

## Performance Contracts

### Metrics
```typescript
interface PerformanceMetrics {
  // SSE event processing time
  sseProcessingTime: number; // < 10ms

  // Memory usage for stream
  streamMemoryUsage: number; // < 50MB

  // UI update batching
  uiUpdateInterval: number; // < 100ms

  // Retry delay calculation
  retryDelayTime: number; // < 1ms

  // Token counting time
  tokenCountTime: number; // < 5ms
}
```

### SLA Requirements
- SSE events processed within 10ms
- Memory usage under 50MB for 1MB streams
- UI updates batched every 100ms
- 95% retry success rate
- Token usage accuracy within 1%

## Migration Path

### From Current OpenAIClient
1. Extend with Responses API support
2. Add ResponseEvent emission
3. Integrate TokenUsageTracker
4. Add RateLimitManager
5. Update retry logic

### Backward Compatibility
- Maintain existing Chat API support
- Keep current streaming interface
- Add feature flags for new capabilities
- Provide migration utilities