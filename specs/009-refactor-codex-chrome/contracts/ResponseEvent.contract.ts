/**
 * ResponseEvent Contract Types
 *
 * Discriminated union of all SSE event types from model streaming API.
 * MUST match Rust ResponseEvent enum exactly (case-sensitive type names).
 *
 * @contract-version 1.0.0
 * @rust-reference codex-rs/core/src/client_common.rs:72-87
 */

/**
 * ResponseEvent discriminated union
 *
 * CRITICAL: Type names MUST match Rust enum variants exactly:
 * - Created
 * - OutputItemDone
 * - Completed
 * - OutputTextDelta
 * - ReasoningSummaryDelta
 * - ReasoningContentDelta
 * - ReasoningSummaryPartAdded
 * - WebSearchCallBegin
 * - RateLimits
 *
 * @rust-reference codex-rs/core/src/client_common.rs:72-87
 */
export type ResponseEvent =
  | ResponseEventCreated
  | ResponseEventOutputItemDone
  | ResponseEventCompleted
  | ResponseEventOutputTextDelta
  | ResponseEventReasoningSummaryDelta
  | ResponseEventReasoningContentDelta
  | ResponseEventReasoningSummaryPartAdded
  | ResponseEventWebSearchCallBegin
  | ResponseEventRateLimits;

/**
 * Stream started event
 *
 * Emitted when SSE connection established and first event received.
 *
 * @rust-mapping response.created
 */
export interface ResponseEventCreated {
  type: 'Created';
}

/**
 * Output item (message or tool call) completed event
 *
 * Emitted when a complete message or tool call has been generated.
 *
 * @rust-mapping response.output_item.done
 */
export interface ResponseEventOutputItemDone {
  type: 'OutputItemDone';
  item: ResponseItem;
}

/**
 * Stream completed successfully event
 *
 * Final event in successful stream. Contains response ID and token usage.
 *
 * @rust-mapping response.completed
 */
export interface ResponseEventCompleted {
  type: 'Completed';
  responseId: string;
  tokenUsage?: TokenUsage;
}

/**
 * Text output delta event
 *
 * Incremental text chunk for streaming message content.
 *
 * @rust-mapping response.output_text.delta
 */
export interface ResponseEventOutputTextDelta {
  type: 'OutputTextDelta';
  delta: string;
}

/**
 * Reasoning summary delta event
 *
 * Incremental text chunk for reasoning summary (o1/o3 models).
 *
 * @rust-mapping response.reasoning_summary_text.delta
 */
export interface ResponseEventReasoningSummaryDelta {
  type: 'ReasoningSummaryDelta';
  delta: string;
}

/**
 * Reasoning content delta event
 *
 * Incremental text chunk for detailed reasoning content (o1/o3 models).
 *
 * @rust-mapping response.reasoning_text.delta
 */
export interface ResponseEventReasoningContentDelta {
  type: 'ReasoningContentDelta';
  delta: string;
}

/**
 * Reasoning summary part added event
 *
 * Emitted when a reasoning summary part is added (o1/o3 models).
 *
 * @rust-mapping response.reasoning_summary_part.added
 */
export interface ResponseEventReasoningSummaryPartAdded {
  type: 'ReasoningSummaryPartAdded';
}

/**
 * Web search tool call begin event
 *
 * Emitted when web_search tool call detected in output_item.added.
 *
 * @rust-mapping response.output_item.added (type check)
 */
export interface ResponseEventWebSearchCallBegin {
  type: 'WebSearchCallBegin';
  callId: string;
}

/**
 * Rate limits snapshot event
 *
 * Parsed from HTTP response headers (X-RateLimit-*).
 *
 * @rust-mapping HTTP headers
 */
export interface ResponseEventRateLimits {
  type: 'RateLimits';
  limits: RateLimitSnapshot;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Response item - message, tool call, or tool result
 *
 * @rust-reference codex-rs/protocol/src/models.rs
 */
export type ResponseItem =
  | ResponseItemMessage
  | ResponseItemToolCall
  | ResponseItemToolResult;

/**
 * Message item (user or assistant message)
 */
export interface ResponseItemMessage {
  type: 'message';
  role: 'user' | 'assistant';
  content: ContentItem[];
}

/**
 * Tool call item (function call request)
 */
export interface ResponseItemToolCall {
  type: 'tool_call';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool result item (function call response)
 */
export interface ResponseItemToolResult {
  type: 'tool_result';
  toolCallId: string;
  content: ContentItem[];
}

/**
 * Content item - text, image, or other content type
 */
export type ContentItem = ContentItemText | ContentItemImage;

/**
 * Text content item
 */
export interface ContentItemText {
  type: 'text';
  text: string;
}

/**
 * Image content item
 */
export interface ContentItemImage {
  type: 'image';
  source: {
    type: 'url' | 'base64';
    data: string;
  };
}

/**
 * Token usage statistics
 *
 * @rust-reference codex-rs/protocol/src/protocol.rs
 */
export interface TokenUsage {
  /** Input tokens consumed */
  inputTokens: number;

  /** Output tokens generated */
  outputTokens: number;

  /** Total tokens (input + output) */
  totalTokens: number;

  /** Cached input tokens (not charged) */
  cachedInputTokens?: number;
}

/**
 * Rate limit snapshot from HTTP headers
 *
 * @rust-reference codex-rs/protocol/src/protocol.rs
 */
export interface RateLimitSnapshot {
  /** Remaining requests in current window */
  requestsRemaining?: number;

  /** Max requests per window */
  requestsLimit?: number;

  /** Remaining tokens in current window */
  tokensRemaining?: number;

  /** Max tokens per window */
  tokensLimit?: number;

  /** When request limit resets (ISO 8601 timestamp) */
  requestsResetAt?: string;

  /** When token limit resets (ISO 8601 timestamp) */
  tokensResetAt?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Created event
 */
export function isCreatedEvent(event: ResponseEvent): event is ResponseEventCreated {
  return event.type === 'Created';
}

/**
 * Type guard for OutputItemDone event
 */
export function isOutputItemDoneEvent(
  event: ResponseEvent
): event is ResponseEventOutputItemDone {
  return event.type === 'OutputItemDone';
}

/**
 * Type guard for Completed event
 */
export function isCompletedEvent(
  event: ResponseEvent
): event is ResponseEventCompleted {
  return event.type === 'Completed';
}

/**
 * Type guard for OutputTextDelta event
 */
export function isOutputTextDeltaEvent(
  event: ResponseEvent
): event is ResponseEventOutputTextDelta {
  return event.type === 'OutputTextDelta';
}

/**
 * Type guard for ReasoningSummaryDelta event
 */
export function isReasoningSummaryDeltaEvent(
  event: ResponseEvent
): event is ResponseEventReasoningSummaryDelta {
  return event.type === 'ReasoningSummaryDelta';
}

/**
 * Type guard for ReasoningContentDelta event
 */
export function isReasoningContentDeltaEvent(
  event: ResponseEvent
): event is ResponseEventReasoningContentDelta {
  return event.type === 'ReasoningContentDelta';
}

/**
 * Type guard for ReasoningSummaryPartAdded event
 */
export function isReasoningSummaryPartAddedEvent(
  event: ResponseEvent
): event is ResponseEventReasoningSummaryPartAdded {
  return event.type === 'ReasoningSummaryPartAdded';
}

/**
 * Type guard for WebSearchCallBegin event
 */
export function isWebSearchCallBeginEvent(
  event: ResponseEvent
): event is ResponseEventWebSearchCallBegin {
  return event.type === 'WebSearchCallBegin';
}

/**
 * Type guard for RateLimits event
 */
export function isRateLimitsEvent(
  event: ResponseEvent
): event is ResponseEventRateLimits {
  return event.type === 'RateLimits';
}

// ============================================================================
// Event Matchers (Rust-style pattern matching helper)
// ============================================================================

/**
 * Pattern matcher for ResponseEvent (Rust-style match expression)
 *
 * @example
 * ```typescript
 * matchResponseEvent(event, {
 *   Created: () => console.log('Stream started'),
 *   OutputTextDelta: (delta) => process.stdout.write(delta),
 *   Completed: ({ responseId, tokenUsage }) => {
 *     console.log(`Done: ${responseId}, used ${tokenUsage?.totalTokens} tokens`);
 *   },
 *   _: () => console.log('Other event'),
 * });
 * ```
 */
export function matchResponseEvent<T>(
  event: ResponseEvent,
  handlers: {
    Created?: () => T;
    OutputItemDone?: (item: ResponseItem) => T;
    Completed?: (data: { responseId: string; tokenUsage?: TokenUsage }) => T;
    OutputTextDelta?: (delta: string) => T;
    ReasoningSummaryDelta?: (delta: string) => T;
    ReasoningContentDelta?: (delta: string) => T;
    ReasoningSummaryPartAdded?: () => T;
    WebSearchCallBegin?: (callId: string) => T;
    RateLimits?: (limits: RateLimitSnapshot) => T;
    _?: () => T; // Default case
  }
): T | undefined {
  switch (event.type) {
    case 'Created':
      return handlers.Created?.();
    case 'OutputItemDone':
      return handlers.OutputItemDone?.(event.item);
    case 'Completed':
      return handlers.Completed?.({
        responseId: event.responseId,
        tokenUsage: event.tokenUsage,
      });
    case 'OutputTextDelta':
      return handlers.OutputTextDelta?.(event.delta);
    case 'ReasoningSummaryDelta':
      return handlers.ReasoningSummaryDelta?.(event.delta);
    case 'ReasoningContentDelta':
      return handlers.ReasoningContentDelta?.(event.delta);
    case 'ReasoningSummaryPartAdded':
      return handlers.ReasoningSummaryPartAdded?.();
    case 'WebSearchCallBegin':
      return handlers.WebSearchCallBegin?.(event.callId);
    case 'RateLimits':
      return handlers.RateLimits?.(event.limits);
    default:
      return handlers._?.();
  }
}

// ============================================================================
// Contract Validation
// ============================================================================

/**
 * Validate ResponseEvent type names match Rust enum variants
 *
 * This function performs runtime validation to ensure type discriminators
 * match the Rust implementation exactly.
 *
 * @throws {Error} If event type is not recognized
 */
export function validateResponseEventType(event: unknown): asserts event is ResponseEvent {
  if (typeof event !== 'object' || event === null) {
    throw new Error('ResponseEvent must be an object');
  }

  const typedEvent = event as { type?: string };

  const validTypes = [
    'Created',
    'OutputItemDone',
    'Completed',
    'OutputTextDelta',
    'ReasoningSummaryDelta',
    'ReasoningContentDelta',
    'ReasoningSummaryPartAdded',
    'WebSearchCallBegin',
    'RateLimits',
  ];

  if (!validTypes.includes(typedEvent.type ?? '')) {
    throw new Error(
      `Invalid ResponseEvent type: ${typedEvent.type}. Must be one of: ${validTypes.join(', ')}`
    );
  }
}

/**
 * Create a ResponseEvent from unknown data with validation
 *
 * @throws {Error} If data does not match ResponseEvent contract
 */
export function fromUnknown(data: unknown): ResponseEvent {
  validateResponseEventType(data);
  return data;
}
