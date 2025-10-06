/**
 * Contract: ModelClient Abstract Base Class
 *
 * This contract defines the interface that all LLM model clients must implement.
 * Aligned with codex-rs/core/src/client.rs ModelClient struct (lines 75-109)
 *
 * Functional Requirements:
 * - FR-004: stream() accepts Prompt, returns Promise<ResponseStream>
 * - FR-007: getModelContextWindow() returns number | undefined
 * - FR-008: getAutoCompactTokenLimit() returns number | undefined
 * - FR-008: getModelFamily() returns ModelFamily
 * - Rust line 424: getProvider() returns ModelProviderInfo
 */

import type { Prompt } from '../types/ResponsesAPI';
import type { ResponseStream } from '../ResponseStream';
import type { ModelProviderInfo } from '../types/ResponsesAPI';
import type { ModelFamily } from '../types/ResponsesAPI';
import type { ReasoningEffortConfig, ReasoningSummaryConfig } from '../types/ResponsesAPI';
import type { RateLimitSnapshot } from '../types/RateLimits';
import type { ResponseEvent } from '../types/ResponseEvent';

/**
 * Contract Tests:
 *
 * 1. Abstract Class Properties
 *    - MUST NOT be instantiable directly
 *    - MUST require subclasses to implement all abstract methods
 *    - MUST provide base retry logic via protected methods
 *
 * 2. Primary Streaming Interface (FR-004)
 *    Given: A valid Prompt object with non-empty input array
 *    When: stream(prompt) is called
 *    Then: Returns Promise<ResponseStream>
 *    And: ResponseStream yields ResponseEvent objects
 *
 * 3. Model Capability Queries
 *    a) getModelContextWindow() (FR-007, Rust line 111-113)
 *       When: Called on a client instance
 *       Then: Returns number | undefined
 *       And: Value matches model's context window size
 *
 *    b) getAutoCompactTokenLimit() (FR-008, Rust line 117-119)
 *       When: Called on a client instance
 *       Then: Returns number | undefined
 *       And: Value is approximately 80% of context window (if defined)
 *
 *    c) getModelFamily() (FR-008, Rust line 438-440)
 *       When: Called on a client instance
 *       Then: Returns ModelFamily object
 *       And: Contains family, baseInstructions, and capability flags
 *
 * 4. Provider Information (Rust line 424-426)
 *    When: getProvider() is called
 *    Then: Returns ModelProviderInfo object
 *    And: Contains name, baseUrl, wireApi, retry settings
 *
 * 5. Reasoning Configuration (for supporting models)
 *    a) getReasoningEffort()
 *       When: Called on a client instance
 *       Then: Returns ReasoningEffortConfig | undefined
 *
 *    b) getReasoningSummary()
 *       When: Called on a client instance
 *       Then: Returns ReasoningSummaryConfig | undefined
 *
 * 6. Model Selection
 *    a) getModel()
 *       When: Called on a client instance
 *       Then: Returns string (current model identifier)
 *
 *    b) setModel(model: string)
 *       Given: A valid model identifier
 *       When: setModel() is called
 *       Then: getModel() returns the new model
 *
 * 7. Authentication (Browser Environment)
 *    When: getAuthManager() is called
 *    Then: Returns undefined (FR-014 - no OAuth in browser)
 *
 * 8. Protected Methods (for subclass implementation)
 *    a) attemptStreamResponses(attempt, payload) (FR-005, Rust line 271)
 *       Given: Attempt number and request payload
 *       When: Called by subclass
 *       Then: Returns Promise<ResponseStream>
 *       And: Throws on connection/auth errors
 *
 *    b) parseRateLimitSnapshot(headers?) (FR-006, Rust line 580)
 *       Given: Optional HTTP Headers object
 *       When: Called by subclass
 *       Then: Returns RateLimitSnapshot | undefined
 *       And: Extracts x-codex-primary-* and x-codex-secondary-* headers
 *
 * 9. Error Handling
 *    a) Invalid Prompt
 *       Given: Prompt with empty input array
 *       When: stream(prompt) is called
 *       Then: Throws ModelClientError
 *
 *    b) Network Errors
 *       Given: Network failure during streaming
 *       When: stream() encounters error
 *       Then: Retries up to provider.requestMaxRetries times
 *       And: Uses exponential backoff with jitter
 *
 *    c) Authentication Errors
 *       Given: Invalid API key
 *       When: stream() encounters 401 status
 *       Then: Throws immediately without retry
 *
 * 10. Retry Logic (FR-011, FR-033-035, Rust line 245-264)
 *     a) Retryable Errors (429, 5xx)
 *        Given: Response with 429 or 500-504 status
 *        When: attemptStreamResponses() fails
 *        Then: Retries with exponential backoff
 *        And: Respects Retry-After header if present
 *
 *     b) Non-Retryable Errors (4xx except 429)
 *        Given: Response with 400, 401, 403, 404 status
 *        When: attemptStreamResponses() fails
 *        Then: Throws immediately without retry
 *
 *     c) Max Retries
 *        Given: Multiple retryable failures
 *        When: Max retries (provider.requestMaxRetries) reached
 *        Then: Throws final error
 *
 * 11. Type Signatures
 *     - stream(prompt: Prompt): Promise<ResponseStream>
 *     - getModelContextWindow(): number | undefined
 *     - getAutoCompactTokenLimit(): number | undefined
 *     - getModelFamily(): ModelFamily
 *     - getProvider(): ModelProviderInfo
 *     - getReasoningEffort(): ReasoningEffortConfig | undefined
 *     - getReasoningSummary(): ReasoningSummaryConfig | undefined
 *     - getModel(): string
 *     - setModel(model: string): void
 *     - getAuthManager(): undefined
 */

export abstract class ModelClient {
  /**
   * Primary streaming interface
   * Rust Reference: codex-rs/core/src/client.rs line 126
   */
  abstract stream(prompt: Prompt): Promise<ResponseStream>;

  /**
   * Get model's context window size
   * Rust Reference: codex-rs/core/src/client.rs line 111-113
   */
  abstract getModelContextWindow(): number | undefined;

  /**
   * Get auto-compact token limit (typically 80% of context window)
   * Rust Reference: codex-rs/core/src/client.rs line 117-119
   */
  abstract getAutoCompactTokenLimit(): number | undefined;

  /**
   * Get model family configuration
   * Rust Reference: codex-rs/core/src/client.rs line 438-440
   */
  abstract getModelFamily(): ModelFamily;

  /**
   * Get provider information
   * Rust Reference: codex-rs/core/src/client.rs line 424-426
   */
  abstract getProvider(): ModelProviderInfo;

  /**
   * Get reasoning effort configuration
   * Rust Reference: codex-rs/core/src/client.rs line 443-445
   */
  abstract getReasoningEffort(): ReasoningEffortConfig | undefined;

  /**
   * Get reasoning summary configuration
   * Rust Reference: codex-rs/core/src/client.rs line 447-449
   */
  abstract getReasoningSummary(): ReasoningSummaryConfig | undefined;

  /**
   * Get current model identifier
   * Rust Reference: codex-rs/core/src/client.rs line 433-435
   */
  abstract getModel(): string;

  /**
   * Set model identifier
   */
  abstract setModel(model: string): void;

  /**
   * Get auth manager (returns undefined in browser environment)
   * Rust Reference: codex-rs/core/src/client.rs line 452-454
   * Browser Deviation: Always returns undefined (no OAuth)
   */
  abstract getAuthManager(): undefined;

  /**
   * Attempt a single streaming request
   * Rust Reference: codex-rs/core/src/client.rs line 271
   */
  protected abstract attemptStreamResponses(
    attempt: number,
    payload: any
  ): Promise<ResponseStream>;

  /**
   * Parse rate limit information from HTTP headers
   * Rust Reference: codex-rs/core/src/client.rs line 580
   */
  protected abstract parseRateLimitSnapshot(
    headers?: Headers
  ): RateLimitSnapshot | undefined;

  /**
   * Process Server-Sent Events stream
   * Rust Reference: codex-rs/core/src/client.rs line 637
   */
  protected abstract processSSE(
    stream: ReadableStream<Uint8Array>,
    headers?: Headers
  ): AsyncGenerator<ResponseEvent>;
}
