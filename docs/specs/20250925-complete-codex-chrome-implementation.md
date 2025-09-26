# Feature Specification

## Overview
Align the ModelClient implementation between codex-rs and codex-chrome, converting the terminal-based Rust agent code to a Chrome extension TypeScript implementation with direct OpenAI API integration using API keys.

## Background
The codex-chrome project is a TypeScript port of the codex-rs Rust implementation, adapted for browser/Chrome extension context. Currently, the ModelClient implementations between the two versions are not fully aligned. The Rust version uses SSE (Server-Sent Events) processing with the OpenAI Responses API and sophisticated retry logic, while the TypeScript version needs similar capabilities adapted for browser environments.

## Requirements
### Functional Requirements
- Implement OpenAI Responses API compatibility in TypeScript ModelClient
- Support SSE event stream processing similar to Rust's process_sse function
- Implement ResponseEvent types matching Rust protocol (Created, OutputItemDone, OutputTextDelta, etc.)
- Add proper retry logic with exponential backoff and jitter
- Support rate limit handling and parsing (x-codex-primary headers)
- Implement token usage tracking and reporting
- Support reasoning content streaming (reasoning summaries and deltas)
- Handle WebSearchCallBegin events for search operations
- Support both streaming and non-streaming completion modes
- Use API key authentication instead of OAuth flow

### Non-Functional Requirements
- Maintain type safety with TypeScript
- Preserve exact type names from Rust protocol for consistency
- Ensure browser-compatible implementation (no Node.js dependencies)
- Support Chrome extension security constraints
- Optimize for streaming performance with batched UI updates
- Handle network errors gracefully with proper retries
- Minimize memory footprint for long-running streams

## Technical Design
### Architecture
The ModelClient will follow a layered architecture:
1. **API Layer**: Direct OpenAI API integration with fetch API
2. **Stream Processing Layer**: SSE parsing and event generation
3. **Event Layer**: ResponseEvent types matching Rust protocol
4. **Retry Layer**: Exponential backoff with jitter
5. **Metrics Layer**: Token usage and rate limit tracking

### Components
#### OpenAIClient Enhancement
- Add Responses API endpoint support (`/v1/responses`)
- Implement SSE stream parser for response events
- Add rate limit header parsing
- Support reasoning content streaming
- Add token usage aggregation

#### ResponseEvent Types
- Port all ResponseEvent variants from Rust:
  - Created
  - OutputItemDone(ResponseItem)
  - OutputTextDelta(string)
  - ReasoningSummaryDelta(string)
  - ReasoningContentDelta(string)
  - ReasoningSummaryPartAdded
  - WebSearchCallBegin { call_id: string }
  - Completed { response_id: string, token_usage: TokenUsage }
  - RateLimits(RateLimitSnapshot)

#### SSE Event Processing
- Parse SSE events with proper error handling
- Handle event types:
  - response.created
  - response.output_item.done
  - response.output_text.delta
  - response.reasoning_summary_text.delta
  - response.reasoning_text.delta
  - response.reasoning_summary_part.added
  - response.completed
  - response.failed
  - response.output_item.added (for web search detection)

#### Retry Logic
- Implement retry with exponential backoff (matching Rust's backoff function)
- Parse Retry-After headers for rate limiting
- Handle 401, 429, 5xx status codes appropriately
- Support max retry configuration

### Data Model
```typescript
// ResponseEvent types
type ResponseEvent =
  | { type: 'Created' }
  | { type: 'OutputItemDone'; item: ResponseItem }
  | { type: 'OutputTextDelta'; delta: string }
  | { type: 'ReasoningSummaryDelta'; delta: string }
  | { type: 'ReasoningContentDelta'; delta: string }
  | { type: 'ReasoningSummaryPartAdded' }
  | { type: 'WebSearchCallBegin'; callId: string }
  | { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage }
  | { type: 'RateLimits'; snapshot: RateLimitSnapshot };

// Token usage tracking
interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

// Rate limit tracking
interface RateLimitSnapshot {
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
}

interface RateLimitWindow {
  usedPercent: number;
  windowMinutes?: number;
  resetsInSeconds?: number;
}
```

## Implementation Plan
### Phase 1: Core SSE Processing
- Implement SSE event parser in OpenAIClient
- Add ResponseEvent type definitions
- Create event stream processor matching Rust's process_sse
- Add proper error handling for malformed SSE events

### Phase 2: Responses API Integration
- Add support for OpenAI Responses API endpoint
- Implement request payload structure (ResponsesApiRequest)
- Add reasoning and text control parameters
- Support prompt cache key and conversation ID headers

### Phase 3: Retry and Rate Limiting
- Implement exponential backoff retry logic
- Add rate limit header parsing
- Handle Retry-After header parsing with regex
- Add token refresh logic for 401 errors

### Phase 4: Token Usage and Metrics
- Implement token usage aggregation from response.completed events
- Add metrics tracking for streaming performance
- Support cached token tracking
- Add reasoning token tracking

### Phase 5: API Key Authentication
- Replace OAuth flow with direct API key authentication
- Add secure API key storage in Chrome extension storage
- Implement API key validation
- Add organization header support

## Testing Strategy
- Unit tests for SSE event parsing
- Integration tests with mock SSE streams
- Contract tests matching Rust implementation behavior
- Performance tests for streaming with large responses
- Error handling tests for network failures and rate limits
- Chrome extension sandbox testing for API calls

## Success Criteria
- TypeScript ModelClient produces same event stream as Rust implementation
- All ResponseEvent types are properly handled
- Retry logic matches Rust behavior with exponential backoff
- Rate limit headers are correctly parsed and respected
- Token usage is accurately tracked and reported
- API key authentication works reliably in Chrome extension context
- Streaming performance is optimized for browser environment
- Error handling is robust with proper user feedback