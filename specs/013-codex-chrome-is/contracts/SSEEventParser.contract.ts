/**
 * Contract: SSEEventParser
 *
 * Parses Server-Sent Events from OpenAI Responses API into ResponseEvent objects.
 * Aligned with codex-rs/core/src/client.rs processSSE implementation (line 637-860)
 *
 * Functional Requirements:
 * - FR-017: Parse "data: {json}\n\n" format, handle [DONE] signal
 * - FR-018: Handle all SSE event types
 */

import type { ResponseEvent } from '../types/ResponseEvent';

/**
 * Contract Tests:
 *
 * 1. Basic SSE Format Parsing (FR-017)
 *    Given: SSE data string "data: {\"type\":\"response.created\"}\n\n"
 *    When: parse() is called
 *    Then: Returns parsed JSON object
 *    And: Removes "data: " prefix
 *
 * 2. [DONE] Signal (FR-017)
 *    Given: SSE data string "data: [DONE]\n\n"
 *    When: parse() is called
 *    Then: Returns special [DONE] indicator
 *    And: Caller terminates stream processing
 *
 * 3. Event Type Processing (FR-018)
 *    Given: Parsed SSE event with type field
 *    When: processEvent() is called
 *    Then: Maps to correct ResponseEvent variant:
 *      - "response.created" → Created
 *      - "response.output_item.done" → OutputItemDone
 *      - "response.output_text.delta" → OutputTextDelta
 *      - "response.reasoning_summary_text.delta" → ReasoningSummaryDelta
 *      - "response.reasoning_text.delta" → ReasoningContentDelta
 *      - "response.reasoning_summary_part.added" → ReasoningSummaryPartAdded
 *      - "response.output_item.added" → WebSearchCallBegin (if web_search_call)
 *      - "response.completed" → Completed
 *      - "response.failed" → throw error
 *
 * 4. Ignored Event Types (Rust line 831-857)
 *    Given: SSE events that should be ignored
 *    When: processEvent() is called
 *    Then: Returns null for:
 *      - "response.in_progress"
 *      - "response.output_text.done"
 *      - "response.content_part.done"
 *      - "response.function_call_arguments.delta"
 *      - "response.custom_tool_call_input.delta"
 *      - "response.custom_tool_call_input.done"
 *      - "response.reasoning_summary_text.done"
 *
 * 5. Malformed JSON
 *    Given: Invalid JSON in SSE data
 *    When: parse() is called
 *    Then: Logs debug message
 *    And: Returns null (skips event)
 *    And: Does not throw (continues processing stream)
 *
 * 6. Multi-line Buffering
 *    Given: SSE stream with incomplete lines
 *    When: Processing chunks
 *    Then: Buffers incomplete lines across chunks
 *    And: Only processes complete lines (ending with \n)
 *
 * 7. Performance (FR from Technical Context)
 *    Given: 1000 SSE events
 *    When: Parsing and processing events
 *    Then: Average processing time < 10ms per event
 *    And: No memory leaks from event accumulation
 */

export class SSEEventParser {
  /**
   * Parse a single SSE data line
   */
  parse(data: string): any | null;

  /**
   * Process parsed SSE event into ResponseEvent
   */
  processEvent(event: any): ResponseEvent[];
}
