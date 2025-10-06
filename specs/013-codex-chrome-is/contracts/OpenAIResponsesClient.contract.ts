/**
 * Contract: OpenAIResponsesClient
 *
 * Concrete implementation of ModelClient for OpenAI's experimental Responses API.
 * Aligned with codex-rs/core/src/client.rs ModelClient implementation
 *
 * Functional Requirements:
 * - FR-013: API key authentication via Authorization header
 * - FR-028-032: OpenAI Responses API support
 * - FR-009: Dispatch based on wire_api setting
 * - FR-011: Retry logic with exponential backoff
 */

import { ModelClient } from './ModelClient.contract';
import type { Prompt, ModelFamily, ModelProviderInfo } from '../types/ResponsesAPI';
import type { ResponseStream } from '../ResponseStream';

/**
 * Contract Tests:
 *
 * 1. Constructor Validation (FR-013)
 *    a) Valid Configuration
 *       Given: Config with non-empty apiKey, conversationId, modelFamily, provider
 *       When: new OpenAIResponsesClient(config) is called
 *       Then: Instance is created successfully
 *
 *    b) Missing API Key
 *       Given: Config with empty or missing apiKey
 *       When: Constructor is called
 *       Then: Throws ModelClientError
 *
 * 2. HTTP Request Headers (FR-029, Rust line 293-298)
 *    Given: A streaming request
 *    When: attemptStreamResponses() makes HTTP request
 *    Then: Includes header "Authorization: Bearer {apiKey}"
 *    And: Includes header "OpenAI-Beta: responses=experimental"
 *    And: Includes header "conversation_id: {conversationId}"
 *    And: Includes header "session_id: {conversationId}"
 *    And: Includes header "Accept: text/event-stream"
 *    And: Includes header "OpenAI-Organization: {organization}" if configured
 *
 * 3. Azure Workaround (FR-030, Rust line 223, 238)
 *    Given: Provider baseUrl contains "azure"
 *    When: Building request payload
 *    Then: Sets store: true in payload
 *    And: Attaches item IDs for reasoning items
 *
 * 4. Reasoning Support (FR-031, Rust line 186-189)
 *    Given: Model family supports reasoning summaries
 *    When: Building request payload
 *    Then: Includes reasoning parameter with effort and summary config
 *    And: Includes "reasoning.encrypted_content" in include array
 *
 * 5. GPT-5 Verbosity (FR-032, Rust line 199-214)
 *    Given: Model family is "gpt-5" and verbosity is configured
 *    When: Building request payload
 *    Then: Includes text.verbosity parameter
 *    And: Warns if verbosity set for non-gpt-5 models
 *
 * 6. SSE Event Processing (FR-017-020, Rust line 637-860)
 *    a) Event Parsing
 *       Given: ReadableStream with SSE data
 *       When: processSSE() is called
 *       Then: Parses "data: {json}\n\n" format
 *       And: Handles [DONE] termination signal
 *
 *    b) Event Type Handling (FR-018)
 *       Given: SSE events of various types
 *       When: Processing events
 *       Then: Maps all event types correctly:
 *         - response.created → Created
 *         - response.output_item.done → OutputItemDone
 *         - response.output_text.delta → OutputTextDelta
 *         - response.reasoning_summary_text.delta → ReasoningSummaryDelta
 *         - response.reasoning_text.delta → ReasoningContentDelta
 *         - response.reasoning_summary_part.added → ReasoningSummaryPartAdded
 *         - response.output_item.added (web_search) → WebSearchCallBegin
 *         - response.completed → Completed
 *
 *    c) response.failed Handling (FR-012, Rust line 785-808)
 *       Given: SSE event type "response.failed"
 *       When: Event is processed
 *       Then: Parses error message from response.error
 *       And: Parses retry-after delay if present
 *       And: Throws with appropriate error
 *
 * 7. Rate Limit Parsing (FR-006, Rust line 580-619)
 *    Given: HTTP headers with rate limit information
 *    When: parseRateLimitSnapshot() is called
 *    Then: Extracts primary rate limit window from headers
 *    And: Extracts secondary rate limit window from headers
 *    And: Returns RateLimitSnapshot with both windows
 *    And: Returns undefined if no rate limit headers present
 *
 * 8. Retry Logic (FR-011, FR-033-035, Rust line 245-264)
 *    a) Rate Limit (429)
 *       Given: Response with 429 status
 *       When: Request fails
 *       Then: Retries after Retry-After delay
 *       And: Uses exponential backoff if no Retry-After header
 *
 *    b) Server Errors (5xx)
 *       Given: Response with 500, 502, 503, 504 status
 *       When: Request fails
 *       Then: Retries with exponential backoff
 *
 *    c) Client Errors (4xx except 429)
 *       Given: Response with 400, 401, 403, 404 status
 *       When: Request fails
 *       Then: Throws immediately without retry
 *
 *    d) Max Retries
 *       Given: provider.requestMaxRetries = 3
 *       When: Request fails 4 times
 *       Then: Final attempt throws error
 *
 * 9. Wire API Dispatch (FR-009, Rust line 127-165)
 *    Given: Provider with wireApi = "Responses"
 *    When: stream() is called
 *    Then: Dispatches to Responses API implementation
 *
 *    Given: Provider with wireApi = "Chat"
 *    When: stream() is called
 *    Then: Dispatches to Chat Completions API implementation
 *
 * 10. Browser Environment Constraints (FR-015-016)
 *     Given: Any streaming request
 *     When: Making HTTP request
 *     Then: Uses browser fetch() API (not Node.js http)
 *     And: Uses ReadableStream (not Node.js streams)
 *     And: Uses TextDecoder for decoding
 */

export class OpenAIResponsesClient extends ModelClient {
  constructor(config: {
    apiKey: string;
    conversationId: string;
    modelFamily: ModelFamily;
    provider: ModelProviderInfo;
    baseUrl?: string;
    organization?: string;
    reasoningEffort?: any;
    reasoningSummary?: any;
    modelVerbosity?: any;
  });
}
