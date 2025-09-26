# Data Model Specification: ModelClient Alignment

## Overview
This document defines the TypeScript data models required to align the Chrome extension's ModelClient with the Rust implementation, preserving exact type names and structure from codex-rs.

## Core Event Types

### ResponseEvent
```typescript
/**
 * Response events emitted during model streaming
 * Preserves exact naming from Rust's ResponseEvent enum
 */
export type ResponseEvent =
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

### ResponseItem
```typescript
/**
 * Individual response items in conversation
 * Extended from existing protocol types
 */
export interface ResponseItem {
  id?: string;
  type: 'message' | 'reasoning' | 'function_call' | 'web_search_call' | 'local_shell_call' | 'custom_tool_call';
  role?: 'assistant' | 'user' | 'system' | 'tool';
  content?: string | ContentBlock[];
  metadata?: {
    timestamp?: number;
    model?: string;
    [key: string]: any;
  };
}

export interface ContentBlock {
  type: 'text' | 'output_text' | 'input_text' | 'error_text';
  text: string;
}
```

## Token Usage Tracking

### TokenUsage
```typescript
/**
 * Token usage statistics matching Rust's TokenUsage struct
 */
export interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}
```

### TokenUsageInfo
```typescript
/**
 * Session-level token usage aggregation
 */
export interface TokenUsageInfo {
  total_token_usage: TokenUsage;
  last_token_usage: TokenUsage;
  model_context_window?: number;
  auto_compact_token_limit?: number;
}
```

## Rate Limiting

### RateLimitSnapshot
```typescript
/**
 * Rate limit information from API headers
 */
export interface RateLimitSnapshot {
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
}
```

### RateLimitWindow
```typescript
/**
 * Individual rate limit window details
 */
export interface RateLimitWindow {
  used_percent: number;
  window_minutes?: number;
  resets_in_seconds?: number;
}
```

## Request/Response Types

### Prompt
```typescript
/**
 * Model prompt configuration matching Rust's Prompt struct
 */
export interface Prompt {
  input: ResponseItem[];
  tools: OpenAiTool[];
  base_instructions_override?: string;
  output_schema?: any;
}
```

### ResponsesApiRequest
```typescript
/**
 * OpenAI Responses API request payload
 */
export interface ResponsesApiRequest {
  model: string;
  instructions: string;
  input: ResponseItem[];
  tools: any[];
  tool_choice: 'auto' | 'none' | 'required';
  parallel_tool_calls: boolean;
  reasoning?: Reasoning;
  store: boolean;
  stream: boolean;
  include: string[];
  prompt_cache_key?: string;
  text?: TextControls;
}
```

### Reasoning
```typescript
/**
 * Reasoning configuration for capable models
 */
export interface Reasoning {
  effort?: ReasoningEffortConfig;
  summary?: ReasoningSummaryConfig;
}

export interface ReasoningEffortConfig {
  effort: 'low' | 'medium' | 'high';
}

export interface ReasoningSummaryConfig {
  enabled: boolean;
}
```

### TextControls
```typescript
/**
 * GPT-5 text generation controls
 */
export interface TextControls {
  verbosity?: Verbosity;
  format?: TextFormat;
}

export type Verbosity = 'low' | 'medium' | 'high';

export interface TextFormat {
  type: 'json_schema';
  strict: boolean;
  schema: any;
  name: string;
}
```

## SSE Event Types

### SseEvent
```typescript
/**
 * Server-Sent Event structure from OpenAI
 */
export interface SseEvent {
  type: string;
  response?: any;
  item?: any;
  delta?: string;
}
```

### ResponseCompleted
```typescript
/**
 * Final response completion event data
 */
export interface ResponseCompleted {
  id: string;
  usage?: ResponseCompletedUsage;
}

export interface ResponseCompletedUsage {
  input_tokens: number;
  input_tokens_details?: {
    cached_tokens: number;
  };
  output_tokens: number;
  output_tokens_details?: {
    reasoning_tokens: number;
  };
  total_tokens: number;
}
```

## Error Types

### ErrorResponse
```typescript
/**
 * OpenAI error response structure
 */
export interface ErrorResponse {
  error: {
    type?: string;
    code?: string;
    message?: string;
    plan_type?: PlanType;
    resets_in_seconds?: number;
  };
}

export type PlanType =
  | { type: 'known'; plan: KnownPlan }
  | { type: 'unknown'; plan: string };

export type KnownPlan = 'free' | 'pro' | 'team' | 'enterprise';
```

### UsageLimitReachedError
```typescript
/**
 * Specific error for usage limits
 */
export class UsageLimitReachedError extends Error {
  constructor(
    public plan_type?: PlanType,
    public resets_in_seconds?: number,
    public rate_limits?: RateLimitSnapshot
  ) {
    super('Usage limit reached');
    this.name = 'UsageLimitReachedError';
  }
}
```

## Authentication Types

### CodexAuth
```typescript
/**
 * Authentication information
 */
export interface CodexAuth {
  mode: AuthMode;
  token?: string;
  refresh_token?: string;
  account_id?: string;
  plan_type?: PlanType;
  expires_at?: number;
}

export enum AuthMode {
  ChatGPT = 'chatgpt',
  ApiKey = 'api_key',
  Local = 'local'
}
```

### AuthManager
```typescript
/**
 * Authentication management interface
 */
export interface AuthManager {
  auth(): CodexAuth | null;
  refresh_token(): Promise<void>;
  get_account_id(): string | null;
  get_plan_type(): PlanType | null;
}
```

## Model Configuration

### ModelProviderInfo
```typescript
/**
 * Model provider configuration
 */
export interface ModelProviderInfo {
  name: string;
  base_url?: string;
  env_key?: string;
  env_key_instructions?: string;
  wire_api: WireApi;
  query_params?: Record<string, string>;
  http_headers?: Record<string, string>;
  env_http_headers?: Record<string, string>;
  request_max_retries?: number;
  stream_max_retries?: number;
  stream_idle_timeout_ms?: number;
  requires_openai_auth: boolean;
}

export enum WireApi {
  Responses = 'responses',
  Chat = 'chat'
}
```

### ModelFamily
```typescript
/**
 * Model family configuration
 */
export interface ModelFamily {
  family: string;
  base_instructions: string;
  supports_reasoning_summaries: boolean;
  needs_special_apply_patch_instructions: boolean;
  context_window?: number;
  auto_compact_token_limit?: number;
}
```

## Stream Processing

### ResponseStream
```typescript
/**
 * Stream of response events
 */
export class ResponseStream {
  private rx_event: AsyncGenerator<ResponseEvent>;

  constructor(rx_event: AsyncGenerator<ResponseEvent>) {
    this.rx_event = rx_event;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<ResponseEvent> {
    yield* this.rx_event;
  }
}
```

### StreamMetadata
```typescript
/**
 * Stream processing metadata
 */
export interface StreamMetadata {
  conversation_id: string;
  session_id: string;
  cf_ray?: string;
  started_at: number;
  ended_at?: number;
  bytes_processed: number;
  events_processed: number;
}
```

## Retry Configuration

### RetryConfig
```typescript
/**
 * Exponential backoff retry configuration
 */
export interface RetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  backoff_factor: number;
  max_delay_ms: number;
  jitter_percent: number; // 0.1 = 10% jitter
}
```

## Tool Types

### OpenAiTool
```typescript
/**
 * Tool definition for model
 */
export type OpenAiTool =
  | { type: 'function'; function: FunctionDefinition }
  | { type: 'freeform'; function: FreeformDefinition };

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: any; // JSON Schema
}

export interface FreeformDefinition {
  name: string;
  description: string;
}
```

## Constants

```typescript
/**
 * Configuration constants matching Rust
 */
export const INITIAL_DELAY_MS = 1000;
export const BACKOFF_FACTOR = 2.0;
export const MAX_RETRIES = 3;
export const STREAM_IDLE_TIMEOUT_MS = 30000;
export const DEFAULT_CONTEXT_WINDOW = 128000;
export const AUTO_COMPACT_TOKEN_LIMIT = 100000;
```

## Type Guards

```typescript
/**
 * Type guard functions for runtime validation
 */
export function isResponseEvent(obj: any): obj is ResponseEvent {
  return obj && typeof obj.type === 'string';
}

export function isTokenUsage(obj: any): obj is TokenUsage {
  return obj &&
    typeof obj.input_tokens === 'number' &&
    typeof obj.output_tokens === 'number' &&
    typeof obj.total_tokens === 'number';
}

export function isRateLimitSnapshot(obj: any): obj is RateLimitSnapshot {
  return obj && (obj.primary || obj.secondary);
}
```

## Migration Notes

### From Current Implementation
1. **OpenAIClient**: Extend to support ResponsesApiRequest
2. **StreamProcessor**: Integrate ResponseEvent handling
3. **ModelClient**: Add TokenUsageInfo tracking
4. **RetryConfig**: Update to use proportional jitter

### Breaking Changes
1. Token usage now includes cached and reasoning tokens
2. Rate limit tracking is mandatory
3. ResponseEvent replaces simple streaming chunks
4. AuthManager abstraction required

## Validation Requirements
1. All types must preserve exact naming from Rust
2. Enums must use string literals for serialization
3. Optional fields must use TypeScript's optional syntax
4. All timestamps in milliseconds (number type)
5. All token counts as integers (number type)