# Research: OpenAI Client Rust-TypeScript Alignment

**Feature**: 016-refactor-the-request
**Date**: 2025-10-08
**Status**: Complete (Updated for in-place modification)
**Approach**: Scan and update existing TypeScript implementations

## Overview

This document captures all research decisions made to align the TypeScript OpenAI client implementation with the Rust codex-rs implementation. Each decision includes the rationale, alternatives considered, and references to specific Rust source code.

**IMPORTANT**: The existing TypeScript codebase already has Prompt, ResponsesApiRequest, and related interfaces defined in `codex-chrome/src/models/types/ResponsesAPI.ts`. This refactoring will **UPDATE existing structures** rather than create new ones.

## Existing Implementation Scan

### Current State Analysis

**File**: `codex-chrome/src/models/types/ResponsesAPI.ts`

**Existing Interfaces**:
1. ✅ `Prompt` - Already defined with fields: input, tools, base_instructions_override, user_instructions, output_schema
2. ✅ `ResponsesApiRequest` - Already defined with most fields, but needs literal types
3. ✅ `Reasoning` - Already defined
4. ✅ `TextControls` - Already defined
5. ✅ `ModelFamily` - Already defined
6. ✅ `ModelProviderInfo` - Already defined

**Gaps Identified**:
1. ❌ `tool_choice` is `string` instead of literal `"auto"`
2. ❌ `parallel_tool_calls` is `boolean` instead of literal `false`
3. ❌ `stream` is `boolean` instead of literal `true`
4. ❌ Missing helper functions `get_full_instructions()` and `get_formatted_input()`
5. ❌ Missing `ToolSpec` discriminated union type
6. ❌ OpenAIClient doesn't use Prompt structure in stream() method

**Implementation Strategy**:
- Update existing interfaces to add literal types
- Add missing helper functions in new file `PromptHelpers.ts`
- Define ToolSpec types in existing ResponsesAPI.ts
- Refactor OpenAIClient.stream() to accept Prompt parameter
- Update TurnManager to build Prompt structure

## Research Decisions

### 1. Rust Client Structure Analysis

**Decision**: Use Responses API structure from `client.rs:169-272` (stream_responses method)

**Rationale**:
- Responses API provides complete context (instructions + input + tools) in a single request
- Chat Completions API only supports messages array without separate instructions field
- Rust implementation uses Responses API as primary, Chat API as fallback for compatibility
- Context completeness is critical for agent behavior (tool invocation, multi-turn reasoning)

**Alternatives Considered**:
1. **Keep Chat API only**: Rejected because it requires encoding instructions as system messages, loses structure, and doesn't support specialized tool types (local_shell, web_search)
2. **Migrate to Chat API entirely**: Rejected because Rust codex-rs uses Responses API for gpt-5-codex, losing feature parity
3. **Hybrid approach with manual context assembly**: Rejected because it duplicates logic and is error-prone

**Rust Reference**:
- `codex-rs/core/src/client.rs:126-166` - `stream()` method dispatches to `stream_responses()` or Chat based on `WireApi` enum
- `codex-rs/core/src/client.rs:169-272` - `stream_responses()` implementation shows full Responses API structure

---

### 2. Prompt Structure Alignment

**Decision**: Port Rust's `Prompt` struct from `client_common.rs:24-69` with all fields and methods

**Rationale**:
- `get_full_instructions(model: ModelFamily)` centralizes instruction assembly logic (base + user + model-specific)
- `get_formatted_input()` provides clean separation between prompt building and input formatting
- Struct-based approach is type-safe and self-documenting
- Methods enable unit testing of instruction logic independently

**Alternatives Considered**:
1. **Manually construct instructions at call sites**: Rejected because it violates DRY principle, makes testing harder, and spreads logic across multiple files
2. **Use plain object without methods**: Rejected because it loses encapsulation and makes refactoring difficult
3. **Extend existing CompletionRequest interface**: Rejected because it's tied to Chat API structure

**Rust Reference**:
- `codex-rs/core/src/client_common.rs:24-69` - `Prompt` struct definition
- Lines 42-64: `get_full_instructions()` implementation shows instruction assembly with apply_patch handling
- Lines 66-68: `get_formatted_input()` implementation (simple clone)

**TypeScript Implementation**:
```typescript
interface Prompt {
  input: ResponseItem[];
  tools: ToolSpec[];
  base_instructions_override?: string;
  user_instructions?: string;  // NEW: TypeScript-specific addition
  output_schema?: any;
}

function get_full_instructions(prompt: Prompt, model: ModelFamily): string {
  const base = prompt.base_instructions_override || model.base_instructions;
  // TODO: Add user_instructions if present
  // TODO: Add apply_patch instructions if needed
  return base;
}

function get_formatted_input(prompt: Prompt): ResponseItem[] {
  return [...prompt.input]; // Clone array
}
```

---

### 3. Model Difference Handling (gpt-5-codex vs gpt-5)

**Decision**: Abstract model slug into configuration, preserve Responses API structure regardless of model

**Rationale**:
- API structure is model-agnostic - only the `model` field value changes
- Responses API supports all GPT-5 family models (gpt-5, gpt-5-codex, gpt-5-turbo)
- Configuration-based approach enables runtime model switching without code changes
- Matches Rust pattern where model is passed to `ModelClient::new()`

**Alternatives Considered**:
1. **Separate clients per model**: Rejected because it creates unnecessary code duplication and complicates testing
2. **Model-specific payload builders**: Rejected because it introduces conditional logic that's hard to maintain
3. **Hard-code gpt-5**: Rejected because it prevents using gpt-5-codex or other variants

**Rust Reference**:
- `codex-rs/core/src/client.rs:88-109` - `ModelClient::new()` accepts model config
- `codex-rs/core/src/client.rs:225` - Model used directly in payload: `model: &self.config.model`

**TypeScript Implementation**:
```typescript
class OpenAIResponsesClient {
  private model: string; // 'gpt-5', 'gpt-5-codex', etc.

  constructor(config: { model: string; ... }) {
    this.model = config.model;
  }

  buildPayload(prompt: Prompt): ResponsesApiRequest {
    return {
      model: this.model, // Use configured model
      // ... other fields
    };
  }
}
```

---

### 4. Wire API Selection

**Decision**: Support both Responses API (primary) and Chat API (fallback) via `WireApi` enum

**Rationale**:
- Matches Rust pattern from `client.rs:126-166` where `stream()` dispatches based on `wire_api`
- Enables graceful degradation if Responses API unavailable or rate-limited
- Preserves existing Chat API tests and workflows
- Future-proofs for additional API types (e.g., Assistants API)

**Alternatives Considered**:
1. **Responses API only**: Rejected because it breaks existing tests and removes fallback option
2. **Chat API only**: Rejected because it prevents using Responses API benefits (context structure, specialized tools)
3. **Separate client classes**: Rejected because it complicates factory logic and session management

**Rust Reference**:
- `codex-rs/core/src/model_provider_info.rs` - `WireApi` enum: `Responses` | `Chat`
- `codex-rs/core/src/client.rs:126-166` - `stream()` dispatch logic:
  ```rust
  match self.provider.wire_api {
      WireApi::Responses => self.stream_responses(prompt).await,
      WireApi::Chat => { /* Chat implementation */ }
  }
  ```

**TypeScript Implementation**:
```typescript
type WireApi = 'Responses' | 'Chat';

class ModelClient {
  protected provider: ModelProviderInfo;

  async stream(prompt: Prompt): Promise<ResponseStream> {
    if (this.provider.wire_api === 'Responses') {
      return this.streamResponses(prompt);
    } else {
      return this.streamChat(prompt);
    }
  }
}
```

---

### 5. Request Payload Construction

**Decision**: Mirror Rust's `ResponsesApiRequest` from `client_common.rs:141-161` field-by-field

**Rationale**:
- Field-by-field alignment ensures identical LLM context between Rust and TypeScript
- Prevents subtle bugs from missing or misnamed fields
- Makes maintenance easier (changes to Rust can be ported mechanically)
- Enables cross-language contract testing

**Alternatives Considered**:
1. **Extend existing payload with new fields**: Rejected because it creates hybrid structure that's confusing
2. **Use different field names**: Rejected because it breaks alignment and requires mental mapping
3. **Omit optional fields**: Rejected because Rust uses them for specific features (reasoning, caching)

**Rust Reference**:
- `codex-rs/core/src/client_common.rs:141-161` - `ResponsesApiRequest` struct:
  ```rust
  pub(crate) struct ResponsesApiRequest<'a> {
      pub(crate) model: &'a str,
      pub(crate) instructions: &'a str,
      pub(crate) input: &'a Vec<ResponseItem>,
      pub(crate) tools: &'a [serde_json::Value],
      pub(crate) tool_choice: &'static str,  // Always "auto"
      pub(crate) parallel_tool_calls: bool,  // Always false
      pub(crate) reasoning: Option<Reasoning>,
      pub(crate) store: bool,
      pub(crate) stream: bool,  // Always true
      pub(crate) include: Vec<String>,
      pub(crate) prompt_cache_key: Option<String>,
      pub(crate) text: Option<TextControls>,
  }
  ```

**TypeScript Implementation**:
```typescript
interface ResponsesApiRequest {
  model: string;
  instructions: string;
  input: ResponseItem[];
  tools: any[];
  tool_choice: "auto";           // Literal type, always "auto"
  parallel_tool_calls: false;     // Literal type, always false
  reasoning?: Reasoning;
  store: boolean;
  stream: true;                   // Literal type, always true
  include: string[];
  prompt_cache_key?: string;
  text?: TextControls;
}
```

---

### 6. Tool Definition Format

**Decision**: Use Rust's `ToolSpec` enum from `client_common.rs:163-209` with variants: Function, LocalShell, WebSearch, Freeform

**Rationale**:
- Responses API requires specific tool types (not just generic functions)
- Enum-based approach provides type safety and exhaustiveness checking
- LocalShell and WebSearch are first-class tool types in Responses API
- Freeform enables custom tools with arbitrary schemas

**Alternatives Considered**:
1. **Keep generic tool format**: Rejected because it loses type safety and doesn't support specialized tools
2. **String-based tool types**: Rejected because it's error-prone (typos, missing cases)
3. **Separate interfaces per tool type**: Rejected because it complicates tool array handling

**Rust Reference**:
- `codex-rs/core/src/client_common.rs:163-209` - `ToolSpec` enum:
  ```rust
  #[derive(Debug, Clone, Serialize, PartialEq)]
  #[serde(tag = "type")]
  pub(crate) enum ToolSpec {
      #[serde(rename = "function")]
      Function(ResponsesApiTool),
      #[serde(rename = "local_shell")]
      LocalShell {},
      #[serde(rename = "web_search")]
      WebSearch {},
      #[serde(rename = "custom")]
      Freeform(FreeformTool),
  }
  ```

**TypeScript Implementation**:
```typescript
type ToolSpec =
  | { type: 'function'; function: ResponsesApiTool }
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | { type: 'custom'; custom: FreeformTool };

interface ResponsesApiTool {
  name: string;
  description: string;
  strict: boolean;
  parameters: JsonSchema;
}

interface FreeformTool {
  name: string;
  description: string;
  format: { type: string; syntax: string; definition: string };
}
```

---

### 7. Retry and Error Handling

**Decision**: Port `StreamAttemptError` from `client.rs:461-503` and retry logic from `stream_responses`

**Rationale**:
- Identical error classification (Fatal vs Retryable HTTP/Transport) ensures consistent behavior
- Exponential backoff with jitter prevents thundering herd
- Retry-After header parsing matches OpenAI API spec
- Auth token refresh on 401 enables seamless re-authentication

**Alternatives Considered**:
1. **Use fetch retry libraries**: Rejected because they don't support Rust-specific error classification
2. **Simple fixed retry count**: Rejected because it doesn't handle rate limits gracefully
3. **No retries**: Rejected because it reduces reliability

**Rust Reference**:
- `codex-rs/core/src/client.rs:461-503` - `StreamAttemptError` enum:
  ```rust
  enum StreamAttemptError {
      RetryableHttpError { status, retry_after, request_id },
      RetryableTransportError(CodexErr),
      Fatal(CodexErr),
  }
  ```
- `codex-rs/core/src/client.rs:249-269` - Retry loop in `stream_responses`:
  ```rust
  for attempt in 0..=max_attempts {
      match self.attempt_stream_responses(attempt, &payload_json, &auth_manager).await {
          Ok(stream) => return Ok(stream),
          Err(StreamAttemptError::Fatal(e)) => return Err(e),
          Err(retryable) => {
              if attempt == max_attempts {
                  return Err(retryable.into_error());
              }
              tokio::time::sleep(retryable.delay(attempt)).await;
          }
      }
  }
  ```

**TypeScript Implementation**:
```typescript
type StreamAttemptError =
  | { type: 'RetryableHttpError'; status: number; retryAfter?: number; requestId?: string }
  | { type: 'RetryableTransportError'; error: Error }
  | { type: 'Fatal'; error: Error };

async function streamResponses(prompt: Prompt): Promise<ResponseStream> {
  const maxAttempts = this.provider.request_max_retries || 3;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const result = await this.attemptStreamResponses(attempt, payload);
      return result;
    } catch (error) {
      if (isFatalError(error) || attempt === maxAttempts) {
        throw error;
      }
      await sleep(calculateBackoff(attempt, error));
    }
  }
}
```

---

### 8. Azure Endpoint Workaround

**Decision**: Implement `attach_item_ids` from `client.rs:557-582` and `store: true` flag for Azure endpoints

**Rationale**:
- Azure Responses API has different requirements than standard OpenAI API
- `store: false` with no ID causes error, `store: false` with ID causes "ID not found" error
- Workaround is documented in Rust code with explanation
- Preserves reasoning item IDs across turns for continuity

**Alternatives Considered**:
1. **Skip Azure support**: Rejected because it limits deployment options (enterprise customers use Azure)
2. **Always use store: true**: Rejected because standard OpenAI API shouldn't store responses
3. **Manual ID assignment**: Rejected because it's error-prone and hard to test

**Rust Reference**:
- `codex-rs/core/src/client.rs:215-247` - Azure detection and `store` flag:
  ```rust
  let azure_workaround = self.provider.is_azure_responses_endpoint();
  let payload = ResponsesApiRequest {
      // ...
      store: azure_workaround,  // true for Azure, false otherwise
      // ...
  };

  if azure_workaround {
      attach_item_ids(&mut payload_json, &input_with_instructions);
  }
  ```
- `codex-rs/core/src/client.rs:557-582` - `attach_item_ids` implementation:
  ```rust
  fn attach_item_ids(payload_json: &mut Value, original_items: &[ResponseItem]) {
      // Iterates items and attaches IDs where present
      if let ResponseItem::Reasoning { id, .. } | /* ... */ = item {
          if !id.is_empty() {
              obj.insert("id".to_string(), Value::String(id.clone()));
          }
      }
  }
  ```

**TypeScript Implementation**:
```typescript
function isAzureResponsesEndpoint(provider: ModelProviderInfo): boolean {
  return provider.base_url?.includes('azure.com') && provider.wire_api === 'Responses';
}

function attachItemIds(payload: any, items: ResponseItem[]): void {
  if (!payload.input || !Array.isArray(payload.input)) return;

  payload.input.forEach((valueItem, i) => {
    const item = items[i];
    if (!item) return;

    // Extract ID from ResponseItem variants
    const id =
      (item.type === 'reasoning' && item.id) ||
      (item.type === 'message' && item.id) ||
      (item.type === 'function_call' && item.id) ||
      // ... other types
      undefined;

    if (id && id.length > 0) {
      valueItem.id = id;
    }
  });
}

// Usage in buildPayload:
const azureWorkaround = isAzureResponsesEndpoint(this.provider);
const payload = {
  // ...
  store: azureWorkaround,
  // ...
};

if (azureWorkaround) {
  attachItemIds(payload, prompt.input);
}
```

---

## Summary

All 8 research decisions document the alignment strategy between Rust and TypeScript implementations. Key themes:

1. **Structure Preservation**: TypeScript mirrors Rust structs/enums exactly (Prompt, ResponsesApiRequest, ToolSpec)
2. **API Fidelity**: Responses API chosen for complete context, Chat API preserved for fallback
3. **Error Handling**: Retry logic and error classification match Rust exactly
4. **Platform Adaptations**: Azure workaround ported, browser-specific changes (fetch vs reqwest) documented
5. **Type Safety**: Literal types and discriminated unions ensure compile-time correctness

Next phase: Design data models and contracts based on these decisions.
