// Import types from their respective modules
import type { ResponseItem } from '../../protocol/types';

// Re-export ResponseEvent from its dedicated file
export type { ResponseEvent } from './ResponseEvent';


/**
 * API request payload for Responses API
 * Based on Rust's ResponsesApiRequest struct
 *
 * **Rust Reference**: `codex-rs/core/src/client_common.rs:141-161`
 */
export interface ResponsesApiRequest {
  model: string;
  instructions: string;
  input: ResponseItem[];
  tools: any[];
  /** Tool selection mode - always "auto" (literal type enforced) */
  tool_choice: "auto";
  /** Whether to allow parallel tool calls - always false (literal type enforced) */
  parallel_tool_calls: false;
  reasoning?: Reasoning;
  store: boolean;
  /** Whether to stream the response - always true (literal type enforced) */
  stream: true;
  include: string[];
  prompt_cache_key?: string;
  text?: TextControls;
}

/**
 * Prompt structure for model requests
 *
 * This interface matches Rust's Prompt struct exactly, containing the input
 * messages, tool definitions, and optional configuration overrides.
 *
 * **Rust Reference**: `codex-rs/core/src/client_common.rs` Lines 24-69
 *
 * **Type Mapping**:
 * - Rust `Vec<ResponseItem>` → TypeScript `ResponseItem[]`
 * - Rust `Vec<OpenAiTool>` → TypeScript `any[]` (tool definitions)
 * - Rust `Option<String>` → TypeScript `string | undefined`
 * - Rust `Option<serde_json::Value>` → TypeScript `any | undefined`
 *
 * **Field Name Convention**:
 * - input: Matches Rust exactly
 * - tools: Matches Rust exactly
 * - base_instructions_override: snake_case (Rust: base_instructions_override)
 * - output_schema: snake_case (Rust: output_schema)
 *
 * @example
 * ```typescript
 * const prompt: Prompt = {
 *   input: [{ type: 'message', role: 'user', content: 'Hello' }],
 *   tools: [],
 * };
 * const stream = await client.stream(prompt);
 * ```
 */
export interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[];  // Rust: input: Vec<ResponseItem>
  /** Tools available to the model */
  tools: ToolSpec[];  // Rust: tools: Vec<OpenAiTool>
  /** Optional override for base instructions */
  base_instructions_override?: string;  // Rust: base_instructions_override: Option<String>
  /** Optional user instructions (development guidelines) */
  user_instructions?: string;
  /** Optional output schema for the model's response */
  output_schema?: any;  // Rust: output_schema: Option<serde_json::Value>
}

/**
 * Reasoning configuration
 * Based on Rust's Reasoning struct
 */
export interface Reasoning {
  effort?: ReasoningEffortConfig;
  summary?: ReasoningSummaryConfig;
}

/**
 * Text controls for GPT-5 family models
 * Based on Rust's TextControls struct
 */
export interface TextControls {
  verbosity?: OpenAiVerbosity;
  format?: TextFormat;
}

/**
 * Text format configuration
 * Based on Rust's TextFormat struct
 */
export interface TextFormat {
  type: TextFormatType;
  strict: boolean;
  schema: any;
  name: string;
}

/**
 * Text format types
 * Based on Rust's TextFormatType enum
 */
export type TextFormatType = 'json_schema';

/**
 * OpenAI verbosity levels
 * Based on Rust's OpenAiVerbosity enum
 */
export type OpenAiVerbosity = 'low' | 'medium' | 'high';

/**
 * Reasoning effort configuration
 * Placeholder type - should match config types
 */
export type ReasoningEffortConfig = 'low' | 'medium' | 'high';

/**
 * Reasoning summary configuration
 * Placeholder type - should match config types
 */
export type ReasoningSummaryConfig = boolean | { enabled: boolean };

/**
 * Model family information
 * Based on codex-rs ModelFamily
 */
export interface ModelFamily {
  family: string;
  base_instructions: string;
  supports_reasoning_summaries: boolean;
  needs_special_apply_patch_instructions: boolean;
}

/**
 * Model provider information
 * Based on codex-rs ModelProviderInfo
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

/**
 * Wire API types
 * Based on Rust's WireApi enum
 */
export type WireApi = 'Responses' | 'Chat';

/**
 * Tool specification discriminated union
 * Matches Rust's ToolSpec enum from client_common.rs
 *
 * **Rust Reference**: `codex-rs/core/src/client_common.rs:163-209`
 */
export type ToolSpec =
  | { type: 'function'; function: ResponsesApiTool }
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | { type: 'custom'; custom: FreeformTool };

/**
 * Function tool definition for Responses API
 * Based on Rust's ResponsesApiTool struct
 */
export interface ResponsesApiTool {
  name: string;
  description: string;
  strict: boolean;
  parameters: any; // JSON Schema
}

/**
 * Freeform tool definition for custom tools
 * Based on Rust's FreeformTool struct
 */
export interface FreeformTool {
  name: string;
  description: string;
  format: FreeformToolFormat;
}

/**
 * Format specification for freeform tools
 * Based on Rust's FreeformToolFormat struct
 */
export interface FreeformToolFormat {
  type: string;
  syntax: string;
  definition: string;
}

// Type guards for ResponseEvent variants
export function isResponseEvent(obj: any): obj is ResponseEvent {
  return obj && typeof obj.type === 'string';
}

export function isCreated(event: ResponseEvent): event is { type: 'Created' } {
  return event.type === 'Created';
}

export function isOutputItemDone(event: ResponseEvent): event is { type: 'OutputItemDone'; item: ResponseItem } {
  return event.type === 'OutputItemDone';
}

export function isCompleted(event: ResponseEvent): event is { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage } {
  return event.type === 'Completed';
}

export function isOutputTextDelta(event: ResponseEvent): event is { type: 'OutputTextDelta'; delta: string } {
  return event.type === 'OutputTextDelta';
}

export function isReasoningSummaryDelta(event: ResponseEvent): event is { type: 'ReasoningSummaryDelta'; delta: string } {
  return event.type === 'ReasoningSummaryDelta';
}

export function isReasoningContentDelta(event: ResponseEvent): event is { type: 'ReasoningContentDelta'; delta: string } {
  return event.type === 'ReasoningContentDelta';
}

export function isReasoningSummaryPartAdded(event: ResponseEvent): event is { type: 'ReasoningSummaryPartAdded' } {
  return event.type === 'ReasoningSummaryPartAdded';
}

export function isWebSearchCallBegin(event: ResponseEvent): event is { type: 'WebSearchCallBegin'; callId: string } {
  return event.type === 'WebSearchCallBegin';
}

export function isRateLimits(event: ResponseEvent): event is { type: 'RateLimits'; snapshot: RateLimitSnapshot } {
  return event.type === 'RateLimits';
}