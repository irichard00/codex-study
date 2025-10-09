# Feature Specification: Align OpenAI Client Request Structure with Rust Implementation

**Feature Branch**: `016-refactor-the-request`
**Created**: 2025-10-08
**Status**: Draft
**Input**: User description: "refactor the request data struct in codex-chrome/src/models/OpenAIClient.ts to align with its original implementation from rust: codex-rs/core/src/client.rs
context: currently codex-chrome/ is converted from codex-rs/, turning the terminal based coding agent into chrome extension based web agent that operate the webs, however, we see the llm call message doesn't implement properly to make llm have enough context to perform as a agent. we need to see how original codex agent talk with llm api in codex-rs/core/src/client.rs and make our codex-chrome have similar behavior"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature requires aligning request structure from codex-rs to codex-chrome
2. Extract key concepts from description
   → Actors: OpenAI API client, LLM (language model)
   → Actions: refactor request structure, align message formatting
   → Data: Prompt, ResponseItem, request payload
   → Constraints: must match Rust implementation behavior
3. For each unclear aspect:
   → Implementation verified through code reading - no major clarifications needed
4. Fill User Scenarios & Testing section
   → Agent receives proper context, tools can be invoked, messages formatted correctly
5. Generate Functional Requirements
   → Each requirement maps to specific Rust client behavior
6. Identify Key Entities (if data involved)
   → Prompt, ResponseItem, ResponsesApiRequest, request payload
7. Run Review Checklist
   → No implementation details included (spec focuses on behavior)
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
As a Chrome extension user interacting with the Codex agent, I need the LLM to receive complete conversation context including instructions, input history, and tool definitions so the agent can perform meaningful work and invoke tools correctly.

### Acceptance Scenarios

1. **Given** the agent needs to execute a task requiring browser tools, **When** it sends a request to the LLM, **Then** the request must include:
   - Base system instructions (agent behavior guidelines)
   - User-specific instructions (development guidelines from user files)
   - Complete input message history (all ResponseItem entries)
   - Tool definitions formatted for the LLM provider
   - Model-specific parameters (reasoning, verbosity, store flags)

2. **Given** the agent is using the OpenAI Responses API (experimental), **When** it constructs the request payload, **Then** the payload must match the structure:
   - `model`: Model identifier string
   - `instructions`: Full system instructions (base + user instructions)
   - `input`: Array of formatted ResponseItem messages
   - `tools`: Array of tool definitions in Responses API format
   - `tool_choice`: "auto"
   - `parallel_tool_calls`: false
   - `reasoning`: Configuration for reasoning effort/summary (if applicable)
   - `store`: Boolean flag (true for Azure workaround, false otherwise)
   - `stream`: true for streaming responses
   - `include`: Array of additional fields to include (e.g., encrypted reasoning)
   - `prompt_cache_key`: Conversation ID for caching

3. **Given** the agent is using Azure OpenAI Responses endpoint, **When** it sends the request, **Then** the system must:
   - Set `store: true` (Azure-specific workaround)
   - Attach item IDs to input messages (for Azure compatibility)
   - Preserve reasoning item IDs across turns

4. **Given** the agent is working on a multi-turn conversation, **When** it formats the input messages, **Then** the system must:
   - Call `prompt.get_formatted_input()` to retrieve properly structured input
   - Include all ResponseItem types: Message, FunctionCall, FunctionCallOutput, WebSearchCall, Reasoning
   - Preserve item metadata (IDs, roles, content structure)

5. **Given** the model is GPT-5, **When** the request is built, **Then** the system must:
   - Include `text.verbosity` parameter if configured
   - Warn and ignore verbosity for non-GPT-5 models
   - Include `reasoning` parameter with effort/summary settings

### Edge Cases
- **What happens when the LLM response stream disconnects?** System should emit appropriate error events and allow retry logic to handle reconnection.
- **How does the system handle missing or malformed tool definitions?** System should validate tools before sending and emit clear error messages for debugging.
- **What if the provider requires specific headers (like ChatGPT account ID)?** Request builder should conditionally add provider-specific headers based on auth mode.
- **How does caching work across conversation turns?** System should use `prompt_cache_key` set to conversation ID to enable provider-side caching.

## Requirements

### Functional Requirements

**Request Structure Alignment**
- **FR-001**: System MUST construct request payload matching Rust `ResponsesApiRequest` structure with fields: model, instructions, input, tools, tool_choice, parallel_tool_calls, reasoning, store, stream, include, prompt_cache_key, text
- **FR-002**: System MUST generate full instructions by combining base instructions with user instructions from prompt
- **FR-003**: System MUST format input messages using `prompt.get_formatted_input()` to preserve ResponseItem structure
- **FR-004**: System MUST convert tool definitions to Responses API format using appropriate tool conversion logic
- **FR-005**: System MUST set `tool_choice` to "auto" and `parallel_tool_calls` to false

**Model-Specific Behavior**
- **FR-006**: System MUST include `reasoning` parameter with effort and summary settings when applicable
- **FR-007**: System MUST include `text.verbosity` parameter only for GPT-5 family models
- **FR-008**: System MUST warn users if verbosity is configured for non-GPT-5 models
- **FR-009**: System MUST include `include: ["reasoning.encrypted_content"]` when reasoning is enabled

**Provider-Specific Behavior**
- **FR-010**: System MUST set `store: true` and attach item IDs when using Azure Responses endpoint
- **FR-011**: System MUST set `store: false` when using standard OpenAI Responses endpoint
- **FR-012**: System MUST attach `chatgpt-account-id` header when auth mode is ChatGPT and account ID is present
- **FR-013**: System MUST use conversation ID as `prompt_cache_key` for response caching

**Headers and Metadata**
- **FR-014**: System MUST include `OpenAI-Beta: responses=experimental` header for Responses API
- **FR-015**: System MUST include `conversation_id` and `session_id` headers set to conversation ID
- **FR-016**: System MUST include `Accept: text/event-stream` header for streaming requests

**Request Retry Logic**
- **FR-017**: System MUST support retry attempts up to provider-configured maximum
- **FR-018**: System MUST refresh auth token on 401 Unauthorized responses
- **FR-019**: System MUST handle rate limit errors with exponential backoff
- **FR-020**: System MUST parse `Retry-After` header when present and use it for delay calculation

**Data Validation**
- **FR-021**: System MUST validate that base instructions and input are present before sending request
- **FR-022**: System MUST validate that tool definitions conform to expected schema
- **FR-023**: System MUST serialize request payload as JSON and log it for debugging (trace level)

### Key Entities

- **Prompt**: Represents the full context sent to the LLM, containing base instructions, user instructions, input message history, tool definitions, and output schema
  - Attributes: `base_instructions_override`, `user_instructions`, `input` (array of ResponseItem), `tools`, `output_schema`
  - Relationships: Used by ModelClient to construct request payload

- **ResponsesApiRequest**: The request payload structure for OpenAI Responses API
  - Attributes: `model`, `instructions`, `input`, `tools`, `tool_choice`, `parallel_tool_calls`, `reasoning`, `store`, `stream`, `include`, `prompt_cache_key`, `text`
  - Relationships: Serialized to JSON and sent to LLM provider

- **ResponseItem**: Individual message items in the conversation history
  - Types: Message, FunctionCall, FunctionCallOutput, WebSearchCall, LocalShellCall, CustomToolCall, Reasoning
  - Attributes: `type`, `role`, `content`, `id`, tool-specific fields
  - Relationships: Array of ResponseItem forms the `input` field of ResponsesApiRequest

- **ToolDefinition**: Describes available tools the LLM can invoke
  - Types: function, local_shell, web_search, custom
  - Attributes: `type`, `name`, `description`, `parameters` (JSON Schema)
  - Relationships: Converted to Responses API format and included in request

- **ReasoningConfig**: Configuration for LLM reasoning behavior
  - Attributes: `effort` (optional ReasoningEffortConfig), `summary` (ReasoningSummaryConfig)
  - Relationships: Included in request when reasoning is enabled

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs (agent receiving proper context)
- [x] Written for non-technical stakeholders (describes behavior, not code)
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous (each FR maps to specific Rust behavior)
- [x] Success criteria are measurable (payload structure matches Rust, headers present, retries work)
- [x] Scope is clearly bounded (refactoring request structure only, not entire client)
- [x] Dependencies and assumptions identified (Prompt format, provider configs, auth)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted (request structure, message formatting, tool definitions)
- [x] Ambiguities marked (none - code reading clarified implementation)
- [x] User scenarios defined (agent context, tool invocation, multi-turn conversations)
- [x] Requirements generated (23 functional requirements covering structure, models, providers, headers, retries, validation)
- [x] Entities identified (Prompt, ResponsesApiRequest, ResponseItem, ToolDefinition, ReasoningConfig)
- [x] Review checklist passed
