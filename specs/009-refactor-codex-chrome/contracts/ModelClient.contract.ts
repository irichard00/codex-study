/**
 * ModelClient Contract Interface
 *
 * This interface defines the contract for the ModelClient class, matching
 * the Rust implementation in codex-rs/core/src/client.rs lines 74-445.
 *
 * Contract Requirements:
 * - All method names must match Rust implementation (converted to camelCase)
 * - All method signatures must preserve return types and parameters
 * - Field access must be controlled through getters (no direct public access)
 *
 * @contract-version 1.0.0
 * @rust-reference codex-rs/core/src/client.rs:74-445
 */

import type { Prompt } from './Prompt.contract';
import type { ResponseEvent } from './ResponseEvent.contract';
import type { ModelProviderInfo } from './ModelProviderInfo.contract';
import type { ReasoningEffortConfig, ReasoningSummaryConfig } from './Config.contract';
import type { ModelFamily } from './ModelFamily.contract';
import type { OtelEventManager } from './OtelEventManager.contract';
import type { ChromeAuthManager } from './ChromeAuthManager.contract';

/**
 * ModelClient configuration object
 */
export interface ModelClientConfig {
  /** Model slug (e.g., "gpt-4", "o1-preview") */
  model: string;

  /** Model family enum (derived from model slug) */
  modelFamily: ModelFamily;

  /** Max context window size in tokens */
  contextWindow?: number;

  /** Auto-compact threshold in tokens */
  autoCompactTokenLimit?: number;
}

/**
 * ModelClient interface matching Rust implementation
 *
 * @rust-reference codex-rs/core/src/client.rs:74-445
 */
export interface IModelClient {
  // ============================================================================
  // Constructor (Rust lines 86-107)
  // ============================================================================

  /**
   * Create a new ModelClient instance.
   *
   * @param config - Model configuration
   * @param authManager - Optional auth manager for OpenAI API
   * @param otelEventManager - Telemetry/logging manager
   * @param provider - Provider metadata and configuration
   * @param effort - Optional reasoning effort level
   * @param summary - Reasoning summary configuration
   * @param conversationId - Session UUID
   *
   * @throws {Error} If required fields are missing or invalid
   *
   * @rust-reference codex-rs/core/src/client.rs:86-107
   */
  // Note: Constructor is not part of interface, documented for reference

  // ============================================================================
  // Getter Methods (Rust lines 109-444)
  // ============================================================================

  /**
   * Get the model's context window size in tokens.
   *
   * @returns Context window size, or undefined if not configured
   *
   * @rust-reference codex-rs/core/src/client.rs:109-113
   */
  getModelContextWindow(): number | undefined;

  /**
   * Get the auto-compact token limit threshold.
   *
   * When conversation exceeds this limit, older messages are automatically
   * compacted to stay within context window.
   *
   * @returns Auto-compact threshold, or undefined if not configured
   *
   * @rust-reference codex-rs/core/src/client.rs:115-119
   */
  getAutoCompactTokenLimit(): number | undefined;

  /**
   * Get the provider metadata object.
   *
   * @returns Full ModelProviderInfo object
   *
   * @rust-reference codex-rs/core/src/client.rs:414-416
   */
  getProvider(): ModelProviderInfo;

  /**
   * Get the OpenTelemetry event manager.
   *
   * @returns Telemetry manager instance
   *
   * @rust-reference codex-rs/core/src/client.rs:418-420
   */
  getOtelEventManager(): OtelEventManager;

  /**
   * Get the current model slug.
   *
   * @returns Model slug (e.g., "gpt-4o", "o1-preview")
   *
   * @rust-reference codex-rs/core/src/client.rs:423-425
   */
  getModel(): string;

  /**
   * Get the model family enum.
   *
   * @returns ModelFamily enum value
   *
   * @rust-reference codex-rs/core/src/client.rs:428-430
   */
  getModelFamily(): ModelFamily;

  /**
   * Get the reasoning effort configuration.
   *
   * @returns Reasoning effort level, or undefined if not set
   *
   * @rust-reference codex-rs/core/src/client.rs:433-435
   */
  getReasoningEffort(): ReasoningEffortConfig | undefined;

  /**
   * Get the reasoning summary configuration.
   *
   * @returns Reasoning summary config (auto/enabled/disabled)
   *
   * @rust-reference codex-rs/core/src/client.rs:438-440
   */
  getReasoningSummary(): ReasoningSummaryConfig;

  /**
   * Get the authentication manager.
   *
   * @returns Auth manager instance, or undefined if not configured
   *
   * @rust-reference codex-rs/core/src/client.rs:442-444
   */
  getAuthManager(): ChromeAuthManager | undefined;

  // ============================================================================
  // Streaming Methods (Rust lines 124-412)
  // ============================================================================

  /**
   * Main streaming entry point - dispatches to appropriate implementation.
   *
   * This method dispatches to either streamResponses() or streamChatCompletions()
   * based on the provider's wireApi configuration.
   *
   * @param prompt - Request prompt with input, tools, and instructions
   * @returns Async generator yielding ResponseEvent objects
   *
   * @throws {CodexError} On fatal errors (4xx client errors)
   * @throws {CodexError} On timeout or max retries exceeded
   *
   * @rust-reference codex-rs/core/src/client.rs:124-164
   */
  stream(prompt: Prompt): AsyncGenerator<ResponseEvent, void, unknown>;

  /**
   * Stream responses using the Responses API (experimental).
   *
   * Implements retry logic with exponential backoff. Retries on:
   * - 429 rate limiting (uses Retry-After header)
   * - 401 unauthorized (triggers token refresh)
   * - 5xx server errors
   * - Network transport errors
   *
   * @param prompt - Request prompt
   * @returns Async generator yielding ResponseEvent objects
   *
   * @throws {CodexError} On fatal errors or max retries exceeded
   *
   * @rust-reference codex-rs/core/src/client.rs:167-266
   */
  streamResponses(prompt: Prompt): AsyncGenerator<ResponseEvent, void, unknown>;

  /**
   * Attempt a single streaming request (no retry logic).
   *
   * This is the low-level method that performs a single HTTP request
   * and spawns SSE processing. Used internally by streamResponses()
   * retry loop.
   *
   * @param attempt - Attempt number (0-indexed, for logging)
   * @param payload - Serialized request payload
   * @param auth - Optional authentication context
   * @returns Promise resolving to ResponseStream
   *
   * @throws {StreamAttemptError} Classified error for retry handling
   *
   * @rust-reference codex-rs/core/src/client.rs:269-412
   */
  attemptStreamResponses(
    attempt: number,
    payload: ResponsesApiRequest,
    auth?: AuthContext
  ): Promise<ResponseStream>;
}

/**
 * Authentication context for API requests
 */
export interface AuthContext {
  /** Access token (e.g., JWT from OpenAI auth) */
  accessToken?: string;

  /** API key (e.g., for direct API key auth) */
  apiKey?: string;
}

/**
 * ResponseStream type - async generator of ResponseEvent objects
 *
 * @rust-reference codex-rs/core/src/client_common.rs:187-209
 */
export type ResponseStream = AsyncGenerator<ResponseEvent, void, unknown>;

/**
 * Responses API request payload
 *
 * @rust-reference codex-rs/core/src/client_common.rs:143-161
 */
export interface ResponsesApiRequest {
  /** Model slug */
  model: string;

  /** System instructions */
  instructions: string;

  /** Input items (messages, tool results) */
  input: ResponseItem[];

  /** Available tools (JSON-encoded) */
  tools: Record<string, unknown>[];

  /** Tool choice strategy */
  tool_choice: 'auto' | 'required' | 'none';

  /** Whether to allow parallel tool calls */
  parallel_tool_calls: boolean;

  /** Reasoning configuration */
  reasoning?: {
    effort?: ReasoningEffortConfig;
    summary?: ReasoningSummaryConfig;
  };

  /** Whether to store conversation */
  store?: boolean;

  /** Enable streaming responses */
  stream: boolean;

  /** Fields to include in response */
  include?: string[];

  /** Prompt cache key for caching */
  prompt_cache_key?: string;

  /** Text controls (verbosity, format) */
  text?: {
    verbosity?: 'low' | 'medium' | 'high';
    format?: {
      type: 'json_schema';
      strict: boolean;
      schema: Record<string, unknown>;
      name: string;
    };
  };
}

/**
 * Response item (message, tool call, or tool result)
 *
 * @rust-reference codex-rs/protocol/src/models.rs
 */
export type ResponseItem =
  | {
      type: 'message';
      role: 'user' | 'assistant';
      content: ContentItem[];
    }
  | {
      type: 'tool_result';
      toolCallId: string;
      content: ContentItem[];
    }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

/**
 * Content item (text, image, or other content type)
 */
export type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url' | 'base64'; data: string } };

/**
 * Contract validation helper
 *
 * Use this to verify a class implements the IModelClient contract:
 *
 * @example
 * ```typescript
 * class ModelClient implements IModelClient {
 *   // ... implementation
 * }
 *
 * // Type-level validation
 * const _validateContract: IModelClient = new ModelClient(...);
 * ```
 */
export function validateModelClientContract(
  instance: unknown
): asserts instance is IModelClient {
  const required = [
    'getModelContextWindow',
    'getAutoCompactTokenLimit',
    'stream',
    'streamResponses',
    'attemptStreamResponses',
    'getProvider',
    'getOtelEventManager',
    'getModel',
    'getModelFamily',
    'getReasoningEffort',
    'getReasoningSummary',
    'getAuthManager',
  ];

  for (const method of required) {
    if (typeof (instance as any)[method] !== 'function') {
      throw new Error(`ModelClient contract violation: missing method ${method}`);
    }
  }
}
