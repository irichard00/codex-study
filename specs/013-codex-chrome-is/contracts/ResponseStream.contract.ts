/**
 * Contract: ResponseStream
 *
 * Async iterable stream that yields ResponseEvent objects as they arrive from the LLM API.
 * Aligned with codex-rs/core/src/client_common.rs ResponseStream struct
 *
 * Functional Requirements:
 * - FR-010: Events yielded in order: RateLimits (optional) → stream events → Completed (required last)
 * - Implements AsyncIterable<ResponseEvent> for for-await-of consumption
 */

import type { ResponseEvent } from '../types/ResponseEvent';

/**
 * Contract Tests:
 *
 * 1. Async Iterable Interface
 *    Given: A ResponseStream instance
 *    When: Used in for-await-of loop
 *    Then: Yields ResponseEvent objects one at a time
 *    And: Implements AsyncIterable<ResponseEvent>
 *
 * 2. Event Ordering (FR-010, Rust line 328-346)
 *    Given: A streaming response with rate limits and events
 *    When: Events are consumed
 *    Then: RateLimits event yielded first (if present)
 *    And: Stream events (Created, OutputItemDone, deltas) yielded next
 *    And: Completed event yielded last
 *    And: No events yielded after Completed
 *
 * 3. Event Addition
 *    Given: A ResponseStream instance
 *    When: addEvent(event) is called
 *    Then: Event is queued for iteration
 *    And: Async iterator receives event in order
 *
 * 4. Stream Completion
 *    Given: A ResponseStream with pending events
 *    When: complete() is called
 *    Then: All pending events are yielded
 *    And: Iteration terminates
 *    And: Further addEvent() calls are ignored or throw
 *
 * 5. Error Handling
 *    Given: A ResponseStream instance
 *    When: error(err) is called
 *    Then: Current iteration throws the error
 *    And: Stream is terminated
 *    And: No further events can be added
 *
 * 6. Single Completion
 *    Given: A ResponseStream that has been completed
 *    When: complete() is called again
 *    Then: Second call is ignored (idempotent)
 *
 * 7. Completed Event Special Handling (FR-019, Rust line 811-824)
 *    Given: A Completed ResponseEvent during SSE processing
 *    When: Event is received from API
 *    Then: Event is stored (not yielded immediately)
 *    And: Event is yielded only after stream ends
 *
 * 8. Real-time Streaming (FR-020, Rust line 744-754)
 *    Given: OutputItemDone events during SSE processing
 *    When: Events are received from API
 *    Then: Events are yielded immediately (not buffered)
 *    And: Enables real-time UI updates
 *
 * 9. Memory Management
 *    Given: A long-running stream
 *    When: Events are consumed via iteration
 *    Then: Consumed events are removed from memory
 *    And: Stream does not accumulate unbounded events
 *
 * 10. Concurrency
 *     Given: Multiple consumers iterating the same stream
 *     When: Events are added concurrently
 *     Then: Each consumer receives all events exactly once
 *     Or: Stream throws if multiple iterations attempted (implementation-specific)
 */

export class ResponseStream {
  /**
   * Async iterator support for for-await-of loops
   */
  [Symbol.asyncIterator](): AsyncIterator<ResponseEvent>;

  /**
   * Add an event to the stream
   * Internal API used by processSSE()
   */
  addEvent(event: ResponseEvent): void;

  /**
   * Mark stream as completed
   * Triggers final event emission and terminates iteration
   */
  complete(): void;

  /**
   * Mark stream as errored
   * Throws error to consumers and terminates iteration
   */
  error(err: Error): void;
}
