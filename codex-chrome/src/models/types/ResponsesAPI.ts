// Import types from their respective modules
import type { TokenUsage } from './TokenUsage';
import type { RateLimitSnapshot } from './RateLimits';
import type { ResponseItem } from '../../protocol/types';

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


/**
 * API request payload for Responses API
 * Based on Rust's ResponsesApiRequest struct
 */
export interface ResponsesApiRequest {
  model: string;
  instructions: string;
  input: ResponseItem[];
  tools: any[];
  tool_choice: string;
  parallel_tool_calls: boolean;
  reasoning?: Reasoning;
  store: boolean;
  stream: boolean;
  include: string[];
  prompt_cache_key?: string;
  text?: TextControls;
}

/**
 * Prompt structure for model requests
 * Based on Rust's Prompt struct
 */
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
  baseInstructions: string;
  supportsReasoningSummaries: boolean;
  needsSpecialApplyPatchInstructions: boolean;
}

/**
 * Model provider information
 * Based on codex-rs ModelProviderInfo
 */
export interface ModelProviderInfo {
  name: string;
  baseUrl?: string;
  envKey?: string;
  envKeyInstructions?: string;
  wireApi: WireApi;
  queryParams?: Record<string, string>;
  httpHeaders?: Record<string, string>;
  envHttpHeaders?: Record<string, string>;
  requestMaxRetries?: number;
  streamMaxRetries?: number;
  streamIdleTimeoutMs?: number;
  requiresOpenaiAuth: boolean;
}

/**
 * Wire API types
 * Based on Rust's WireApi enum
 */
export type WireApi = 'Responses' | 'Chat';

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