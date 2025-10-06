# Feature Specification: Align codex-chrome Model Client Implementation with codex-rs

**Feature Branch**: `013-codex-chrome-is`
**Created**: 2025-10-05
**Status**: Draft
**Input**: User description: "codex-chrome/ is converted from codex-rs, it is converted from rust into typescript and codex-chrome is a chrome extension agent that run in browser. And codex-chrome/src/models are converted from codex-rs/core/src/client.rs, however, we still see several inconsistency implementation.
This task is to make the implementation is consistent from original rust code including
1. same method names
2. same method input and output
3. same necessary struct name
4. same execution flow

also some extra requirements:
1. codex-chrome is executed in chrome, consider the execution environment difference
2. support api key authentication method
3. currently enable it for openAI api
4. support sse
5. make it extensible for future llms (gemini, claude, etc)
6. no backward compability needed remove any legacy code from codex-chrome/"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature scope: Align TypeScript model client with Rust implementation
2. Extract key concepts from description
   → Actors: Browser-based LLM client, API providers (OpenAI, future: Gemini, Claude)
   → Actions: Standardize naming, align interfaces, support SSE streaming, authenticate with API keys
   → Data: API requests/responses, SSE events, authentication tokens, rate limits
   → Constraints: Browser environment, no OAuth flows, OpenAI API first, extensible design
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Should we preserve existing test files or create new ones?]
   → [NEEDS CLARIFICATION: What is the exact scope of "legacy code" to remove?]
4. Fill User Scenarios & Testing section
   → Primary scenario: Developer using model client to stream LLM responses
5. Generate Functional Requirements
   → Each requirement must be testable
6. Identify Key Entities (if data involved)
   → ModelClient, ResponseStream, SSE Events, Authentication
7. Run Review Checklist
   → Spec has uncertainties marked with [NEEDS CLARIFICATION]
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A developer building a Chrome extension agent needs to interact with LLM APIs (OpenAI, and potentially Gemini/Claude in the future) to generate streaming responses. The model client must:
- Accept API key authentication configured by the user
- Support streaming responses via Server-Sent Events (SSE)
- Handle rate limiting and retry logic gracefully
- Provide consistent behavior matching the original Rust implementation from codex-rs
- Work reliably in the browser environment (no Node.js-specific features)

### Acceptance Scenarios

1. **Given** a user has configured an OpenAI API key, **When** they initiate a streaming request with a prompt, **Then** the system must return a response stream that yields events as they arrive from the API

2. **Given** an API request fails with a retryable error (429 rate limit), **When** the error includes a retry-after header, **Then** the system must automatically retry the request after the specified delay

3. **Given** a streaming response is in progress, **When** SSE events arrive from the OpenAI API, **Then** the system must parse and emit corresponding ResponseEvent objects in real-time

4. **Given** a developer wants to switch from OpenAI to a future LLM provider (Gemini, Claude), **When** they create a new provider-specific client, **Then** the client interface must remain consistent and require no changes to calling code

5. **Given** the model client is initialized with provider configuration, **When** queried for model capabilities (context window, token limits), **Then** the system must return accurate information matching the original Rust implementation

### Edge Cases
- What happens when an API key is invalid or missing? → System must throw authentication error immediately without retry
- How does the system handle SSE stream interruptions or timeouts? → System must detect idle timeout and close stream with appropriate error
- What happens when rate limit headers are missing from response? → System must use exponential backoff without server-provided timing
- How does the system handle response.failed SSE events? → System must parse error message and terminate stream with appropriate error
- What happens when Azure-specific workarounds are needed? → System must detect Azure endpoints and apply store=true workaround

## Requirements *(mandatory)*

### Functional Requirements

#### Method Naming Alignment
- **FR-001**: System MUST rename all TypeScript methods to match Rust naming conventions exactly (e.g., `getContextWindow()` → `getModelContextWindow()`, `stream()` matches Rust `pub async fn stream()`)
- **FR-002**: System MUST use snake_case for all struct/type field names to match Rust serialization format (e.g., `inputTokens` → `input_tokens`)
- **FR-003**: System MUST name all error types consistently with Rust equivalents (e.g., `StreamAttemptError` enum with same variants)

#### Method Signatures & Behavior
- **FR-004**: The `stream()` method MUST accept a `Prompt` parameter and return `Promise<ResponseStream>` matching Rust's `async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream>`
- **FR-005**: The `attemptStreamResponses()` method MUST take `(attempt: number, payload: any)` parameters matching Rust's signature at line 269
- **FR-006**: The `parseRateLimitSnapshot()` method MUST accept HTTP headers and return `RateLimitSnapshot | undefined` matching Rust's `Option<RateLimitSnapshot>` return type
- **FR-007**: System MUST implement `getAutoCompactTokenLimit()` returning token limit for auto-compaction, matching Rust lines 115-119
- **FR-008**: System MUST implement `getModelFamily()` returning model family configuration object

#### Execution Flow Consistency
- **FR-009**: The `stream()` method MUST dispatch to either Responses API or Chat Completions based on provider's `wire_api` setting, matching Rust lines 121-134
- **FR-010**: SSE processing MUST yield `RateLimits` event first (from headers), then stream events, then `Completed` event last, matching Rust event ordering
- **FR-011**: System MUST retry failed requests up to `provider.requestMaxRetries` times with exponential backoff, matching Rust retry loop (lines 245-264)
- **FR-012**: System MUST handle `response.failed` SSE events by parsing error message and retry-after delay from error object, matching Rust lines 785-808

#### Authentication & Browser Environment
- **FR-013**: System MUST support API key authentication via Authorization header (`Bearer <api_key>`)
- **FR-014**: System MUST NOT implement OAuth flows or token refresh (browser environment constraint)
- **FR-015**: System MUST use browser's `fetch()` API for HTTP requests (no Node.js http/https modules)
- **FR-016**: System MUST use browser's native ReadableStream for SSE parsing (no Node.js streams)

#### SSE Streaming Support
- **FR-017**: System MUST parse Server-Sent Events with `data:` prefix and handle `[DONE]` termination signal
- **FR-018**: System MUST handle all SSE event types from Rust implementation: `response.created`, `response.output_item.done`, `response.output_text.delta`, `response.reasoning_summary_text.delta`, `response.reasoning_text.delta`, `response.reasoning_summary_part.added`, `response.output_item.added`, `response.completed`, `response.failed`
- **FR-019**: System MUST store `response.completed` event and emit it only after stream ends (not inline), matching Rust behavior at lines 811-824
- **FR-020**: System MUST forward `response.output_item.done` events immediately for real-time streaming, matching Rust lines 744-754

#### Extensibility for Future LLMs
- **FR-021**: System MUST define abstract base `ModelClient` class with provider-agnostic interface
- **FR-022**: System MUST support `ModelProviderInfo` configuration object with provider-specific settings (baseUrl, wireApi, retryConfig, etc.)
- **FR-023**: System MUST allow provider-specific subclasses (`OpenAIResponsesClient`, future: `GeminiClient`, `ClaudeClient`) to implement protocol-specific logic
- **FR-024**: System MUST support both Responses API and Chat Completions API wire protocols via `wire_api` discriminator

#### Legacy Code Removal
- **FR-025**: System MUST remove any TypeScript code that does not have a corresponding Rust equivalent in `codex-rs/core/src/client.rs`
- **FR-026**: System MUST remove deprecated method names and replace with Rust-aligned names (no aliases for backward compatibility)
- **FR-027**: System MUST remove any custom retry logic that differs from Rust implementation and replace with exact port

#### OpenAI API Support (Current Implementation)
- **FR-028**: System MUST support OpenAI Responses API experimental endpoint (`/v1/responses`)
- **FR-029**: System MUST include required headers: `OpenAI-Beta: responses=experimental`, `conversation_id`, `session_id`, `Accept: text/event-stream`
- **FR-030**: System MUST support Azure OpenAI endpoints with `store: true` workaround when Azure is detected in baseUrl
- **FR-031**: System MUST support reasoning effort and reasoning summary configuration for models that support it
- **FR-032**: System MUST support GPT-5 verbosity controls via `text.verbosity` parameter

#### Error Handling & Retry Logic
- **FR-033**: System MUST distinguish between retryable errors (500, 502, 503, 504, 429) and fatal errors (400, 401, 403, 404)
- **FR-034**: System MUST extract `Retry-After` header from 429 responses and use it for backoff timing
- **FR-035**: System MUST implement exponential backoff with jitter for retry delays, matching Rust `backoff()` utility
- **FR-036**: System MUST parse `usage_limit_reached` error type from API and include plan_type and resets_in_seconds in error

#### Type System & Data Structures
- **FR-037**: System MUST define all response types with snake_case field names matching Rust serialization (e.g., `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`)
- **FR-038**: System MUST define `ResponseEvent` union type with all event variants from Rust implementation
- **FR-039**: System MUST define `RateLimitSnapshot` with `primary` and `secondary` optional `RateLimitWindow` objects
- **FR-040**: System MUST define `ResponseItem` union type matching Rust's `codex_protocol::models::ResponseItem` variants

### Key Entities

- **ModelClient**: Abstract base class representing a client that can communicate with an LLM API provider. Contains retry logic, rate limiting, and provider-agnostic interface. Maps to Rust's `ModelClient` struct at lines 75-109.

- **OpenAIResponsesClient**: Concrete implementation of ModelClient for OpenAI's experimental Responses API. Handles SSE streaming, reasoning parameters, and Azure-specific workarounds. Maps to Rust's `ModelClient` implementation for Responses API.

- **ResponseStream**: Channel-like object that yields `ResponseEvent` objects as they arrive from the API. Maps to Rust's `ResponseStream { rx_event: mpsc::Receiver<Result<ResponseEvent>> }` at line 348.

- **ResponseEvent**: Union type representing different types of events emitted during streaming (Created, OutputItemDone, OutputTextDelta, ReasoningSummaryDelta, Completed, RateLimits, etc.). Maps to Rust's `ResponseEvent` enum.

- **Prompt**: Input structure containing messages (input array) and available tools. Maps to Rust's `Prompt` type used in `stream()` method signature.

- **ModelProviderInfo**: Configuration object describing an LLM provider's API characteristics (baseUrl, wireApi, retry settings, timeout settings). Maps to Rust's `ModelProviderInfo` struct.

- **RateLimitSnapshot**: Structure containing rate limit information extracted from HTTP headers, with primary and secondary rate limit windows. Maps to Rust's `RateLimitSnapshot` struct at lines 580-595.

- **TokenUsage**: Structure containing token usage statistics (input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, total_tokens). Maps to Rust's `TokenUsage` struct.

- **StreamAttemptError**: Error type representing different failure modes during streaming attempts (RetryableHttpError, RetryableTransportError, Fatal). Maps to Rust's `StreamAttemptError` enum at lines 457-499.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

**Outstanding Clarifications**:
1. Should existing test files be preserved or replaced with new tests matching Rust test structure?
2. What is the exact definition of "legacy code" to remove? Are there specific files or patterns to eliminate?

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (pending clarifications)

---
