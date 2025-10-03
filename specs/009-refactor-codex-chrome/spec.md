# Feature Specification: Align codex-chrome Model Client with codex-rs Implementation

**Feature Branch**: `009-refactor-codex-chrome`
**Created**: 2025-10-02
**Status**: Draft
**Input**: User description: "refactor codex-chrome/src/models according to codex-rs/core/src/client.rs to make the LLM model client implementation in codex-chrome/ can align with original codex-rs/. Currently codex-chrome/ is converted from codex-rs/, turning the terminal based coding agent into chrome extension based web agent that operate the webs. We've notice the implementation for llm client is a little different makes it hard to debug. We want to make the model client implementation can be aligned between typescript and rust
1. keep the original methods and data struct name as much as possible
2. take the runtime environment difference into consideration: codex-chrome/ is a web agent running as chrome extension while codex-rs is terminal based agent running in desktop
3. currently main foncus on openai api call
4. keep the api key based llm call
5. make it extensible for future llm api (gemini, claude, etc)"

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A developer debugging issues across the codex-chrome and codex-rs codebases needs to understand the model client behavior in both implementations. Currently, the TypeScript implementation in codex-chrome has diverged from the Rust implementation in client.rs, using different naming conventions, structures, and flow patterns. This makes it difficult to:
- Compare behavior between implementations
- Port bug fixes from one codebase to the other
- Understand the intended architecture when reading code

After the refactoring, the developer should be able to identify equivalent components by their names (e.g., `ModelClient`, `stream_responses`, `attempt_stream_responses`, `process_sse`) and trace similar execution flows in both codebases, accounting only for runtime environment differences (browser vs. terminal).

### Acceptance Scenarios

1. **Given** a developer examining the Rust `ModelClient::stream()` method, **When** they look at the TypeScript equivalent, **Then** they find a method with the same name and similar structure that delegates to either Responses API or Chat API streaming based on wire_api configuration

2. **Given** a developer debugging SSE event processing in the Rust `process_sse()` function, **When** they look for the equivalent TypeScript code, **Then** they find a `processSSE()` method with matching event types (response.created, response.output_item.done, etc.) and similar state management

3. **Given** a developer understanding retry logic in `attempt_stream_responses()` in Rust, **When** they examine the TypeScript implementation, **Then** they find an `attemptStreamResponses()` method with similar retry attempt counting, error classification (Fatal vs. Retryable), and backoff calculation

4. **Given** a Chrome extension using the model client to make API calls, **When** the client needs to make an OpenAI API request, **Then** the system uses the browser's `fetch()` API instead of reqwest while preserving the same request structure, headers, and error handling patterns

5. **Given** a developer adding support for a new LLM provider (Gemini, Claude), **When** they examine the model client architecture, **Then** they find a clear provider abstraction pattern (ModelProviderInfo) and can add a new provider without modifying core streaming logic

6. **Given** the TypeScript implementation needs to handle SSE streams, **When** processing events from ReadableStream, **Then** the system uses browser-native stream readers instead of tokio streams while maintaining the same event parsing and state management logic

### Edge Cases

- What happens when the browser environment doesn't support streaming responses (older browsers)?
  - System should detect lack of ReadableStream support and provide clear error message

- How does the system handle authentication differences between terminal (local token files) and browser (chrome.storage API)?
  - AuthManager abstraction should handle both environments through different implementations of the same interface

- What happens when SSE connection is interrupted in a browser tab being suspended?
  - Browser-specific timeout and reconnection logic should be implemented while preserving the same timeout constants and retry patterns from Rust

- How does rate limiting work when requests can come from multiple browser tabs?
  - Browser extension should coordinate rate limiting across tabs using chrome.storage shared state or single background service worker

---

## Requirements *(mandatory)*

### Functional Requirements

#### Core Alignment Requirements

- **FR-001**: System MUST preserve exact method names from codex-rs client.rs in TypeScript implementation (stream, attemptStreamResponses, processSSE, parseRateLimitSnapshot, etc.)

- **FR-002**: System MUST preserve exact data structure names from Rust implementation (ModelClient, Prompt, ResponseEvent, ResponseStream, ModelProviderInfo, StreamAttemptError equivalent)

- **FR-003**: System MUST maintain the same execution flow: stream() → attemptStreamResponses() (with retry loop) → processSSE() → event emission

- **FR-004**: System MUST preserve SSE event type names from Rust implementation (response.created, response.output_item.done, response.output_text.delta, response.completed, response.failed, etc.)

- **FR-005**: System MUST preserve error classification logic: fatal errors (4xx except 429, 401), retryable errors (5xx, 429, network errors), with same retry backoff algorithm

#### Browser Environment Adaptations

- **FR-006**: System MUST use browser-native fetch() API for HTTP requests instead of reqwest while preserving identical request headers, body structure, and error handling

- **FR-007**: System MUST use browser-native ReadableStream readers for SSE processing instead of tokio streams while maintaining same event parsing logic

- **FR-008**: System MUST handle authentication through browser storage APIs (chrome.storage or equivalent) instead of file system access while maintaining AuthManager interface compatibility

- **FR-009**: System MUST implement timeout handling compatible with browser event loop instead of tokio::time while using same timeout duration values from Rust config

- **FR-010**: System MUST coordinate rate limiting across browser contexts (tabs, background worker) using shared state instead of process-local state

#### OpenAI API Requirements

- **FR-011**: System MUST support OpenAI API key based authentication for all API calls

- **FR-012**: System MUST implement both Responses API (/v1/responses) and Chat Completions API (/v1/chat/completions) endpoints matching Rust WireApi::Responses and WireApi::Chat distinction

- **FR-013**: System MUST support OpenAI reasoning parameters (effort, summary) for models that support reasoning (matching Rust create_reasoning_param_for_request logic)

- **FR-014**: System MUST support OpenAI verbosity and output schema parameters for GPT-5 family models (matching Rust create_text_param_for_request logic)

- **FR-015**: System MUST parse OpenAI rate limit headers (x-codex-primary-*, x-codex-secondary-*, retry-after) matching Rust parse_rate_limit_snapshot logic

#### Extensibility Requirements

- **FR-016**: System MUST define ModelProviderInfo interface supporting provider-specific configuration (base_url, wire_api, request_max_retries, stream_idle_timeout_ms, etc.)

- **FR-017**: System MUST implement provider abstraction allowing addition of new LLM providers (Gemini, Claude) without modifying core ModelClient stream processing logic

- **FR-018**: System MUST support provider-specific request building through ModelProviderInfo.create_request_builder equivalent

- **FR-019**: System MUST support provider-specific authentication through pluggable auth implementations (API key, OAuth, ChatGPT auth)

- **FR-020**: System MUST allow provider-specific retry policies through ModelProviderInfo configuration

### Key Entities *(include if feature involves data)*

- **ModelClient**: Core client struct containing config, auth_manager, provider, conversation_id, effort, summary. Exposes stream() method as primary interface. In TypeScript, this is a class with same properties and methods as Rust implementation.

- **ResponseStream**: Channel-based stream of ResponseEvent objects. In Rust uses mpsc::channel, in TypeScript uses async generator or custom event emitter matching same interface.

- **Prompt**: Input structure containing instructions, input items, tools, base_instructions_override, output_schema. Same structure in both Rust and TypeScript.

- **ResponseEvent**: Discriminated union of event types (Created, OutputItemDone, OutputTextDelta, ReasoningContentDelta, Completed, RateLimits, WebSearchCallBegin, etc.). Same variants in both implementations.

- **ModelProviderInfo**: Provider configuration containing name, base_url, wire_api, request_max_retries, stream_idle_timeout_ms, http_headers, etc. Same fields in TypeScript as Rust struct.

- **StreamAttemptError**: Internal error classification (RetryableHttpError, RetryableTransportError, Fatal) with delay calculation. TypeScript implementation should mirror Rust enum structure.

- **SseEvent**: Raw SSE event structure with type, response, item, delta fields. Identical parsing logic in both implementations.

- **ResponseCompleted**: SSE completion event containing id and usage statistics. Same structure and TokenUsage conversion logic.

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
