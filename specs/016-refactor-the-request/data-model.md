# Data Model: OpenAI Client Request Structures

**Feature**: 016-refactor-the-request
**Date**: 2025-10-08
**Status**: Design Phase

## Overview

This document defines the core data entities for the OpenAI client refactoring. All structures are aligned with Rust codex-rs implementation from `core/src/client.rs` and `core/src/client_common.rs`.

## Core Entities

### 1. Prompt

**Purpose**: Represents the full context sent to the LLM, including conversation history, tools, and instructions.

**Rust Reference**: `codex-rs/core/src/client_common.rs:24-69`

**TypeScript Definition**:
```typescript
interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[];

  /** Tools available to the model */
  tools: ToolSpec[];

  /** Optional override for base instructions */
  base_instructions_override?: string;

  /** Optional user instructions (development guidelines) */
  user_instructions?: string;

  /** Optional output schema for structured responses */
  output_schema?: any;
}
```

**Methods**:
```typescript
/**
 * Get full instructions by combining base + user instructions
 * Rust: impl Prompt::get_full_instructions(&self, model: &ModelFamily)
 */
function get_full_instructions(prompt: Prompt, model: ModelFamily): string;

/**
 * Get formatted input for API request
 * Rust: impl Prompt::get_formatted_input(&self)
 */
function get_formatted_input(prompt: Prompt): ResponseItem[];
```

**Field Descriptions**:
- `input`: Array of ResponseItem objects representing the conversation history (messages, function calls, reasoning, etc.)
- `tools`: Array of ToolSpec objects defining available tools (functions, local_shell, web_search, custom)
- `base_instructions_override`: If present, overrides the default base instructions from ModelFamily
- `user_instructions`: User-specific development guidelines (e.g., from user_instruction.md files)
- `output_schema`: JSON schema for structured output (used with text.format field)

**Validation Rules**:
- `input` must not be empty for valid requests
- `tools` can be empty array
- `base_instructions_override` and `user_instructions` are mutually compatible (both can be present)

**Relationships**:
- Uses `ResponseItem` from protocol types (already aligned)
- Uses `ToolSpec` (defined below)
- Used by `ModelClient.stream()` as primary input

---

### 2. ResponsesApiRequest

**Purpose**: The request payload structure for OpenAI Responses API, serialized as JSON and POSTed to the API.

**Rust Reference**: `codex-rs/core/src/client_common.rs:141-161`

**TypeScript Definition**:
```typescript
interface ResponsesApiRequest {
  /** Model identifier (e.g., "gpt-5", "gpt-5-codex") */
  model: string;

  /** Full system instructions (base + user) */
  instructions: string;

  /** Conversation history and context */
  input: ResponseItem[];

  /** Tool definitions in Responses API format */
  tools: any[];

  /** Tool selection mode (always "auto") */
  tool_choice: "auto";

  /** Whether to allow parallel tool calls (always false) */
  parallel_tool_calls: false;

  /** Optional reasoning configuration */
  reasoning?: Reasoning;

  /** Whether to store the response (Azure workaround) */
  store: boolean;

  /** Whether to stream the response (always true) */
  stream: true;

  /** Additional fields to include in response */
  include: string[];

  /** Cache key for prompt caching (conversation ID) */
  prompt_cache_key?: string;

  /** Text controls (verbosity, format) */
  text?: TextControls;
}
```

**Field Descriptions**:
- `model`: Model slug from configuration (e.g., "gpt-5")
- `instructions`: Result of `get_full_instructions()` call
- `input`: Result of `get_formatted_input()` call
- `tools`: Converted from `ToolSpec[]` to Responses API format
- `tool_choice`: Fixed literal "auto" (matches Rust)
- `parallel_tool_calls`: Fixed literal false (matches Rust)
- `reasoning`: Present if model supports reasoning summaries
- `store`: True for Azure endpoints, false otherwise
- `stream`: Fixed literal true (always streaming)
- `include`: Array like `["reasoning.encrypted_content"]` when reasoning enabled
- `prompt_cache_key`: Conversation ID for provider-side caching
- `text`: Present for GPT-5 family models with verbosity/format

**Validation Rules**:
- `model`, `instructions`, `input`, `tools` are required
- `tool_choice` must be "auto" (literal type)
- `parallel_tool_calls` must be false (literal type)
- `stream` must be true (literal type)
- `store` depends on provider (Azure = true, others = false)
- `include` populated if reasoning present
- `text` only for GPT-5 family models

**Serialization Notes**:
- Fields with `undefined` values should be omitted from JSON
- `reasoning`, `prompt_cache_key`, `text` have `#[serde(skip_serializing_if = "Option::is_none")]` in Rust
- TypeScript should use same pattern (omit if undefined)

---

### 3. ToolSpec

**Purpose**: Represents a tool definition in the Responses API format, supporting multiple tool types.

**Rust Reference**: `codex-rs/core/src/client_common.rs:163-209`

**TypeScript Definition**:
```typescript
/**
 * Tool specification enum matching Rust's ToolSpec
 * Uses discriminated union pattern for type safety
 */
type ToolSpec =
  | { type: 'function'; function: ResponsesApiTool }
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | { type: 'custom'; custom: FreeformTool };

/**
 * Function tool definition
 */
interface ResponsesApiTool {
  name: string;
  description: string;
  strict: boolean;
  parameters: JsonSchema;
}

/**
 * Freeform tool definition for custom tools
 */
interface FreeformTool {
  name: string;
  description: string;
  format: FreeformToolFormat;
}

/**
 * Format specification for freeform tools
 */
interface FreeformToolFormat {
  type: string;
  syntax: string;
  definition: string;
}
```

**Variant Descriptions**:
- `function`: Standard function tool with JSON schema parameters
- `local_shell`: Browser command execution (empty object, type-only)
- `web_search`: Web search capability (empty object, type-only)
- `custom`: Freeform tool with custom format definition

**Field Descriptions (ResponsesApiTool)**:
- `name`: Tool name (e.g., "get_current_weather")
- `description`: Tool description for LLM
- `strict`: Whether to enforce strict schema validation
- `parameters`: JSON schema defining tool input structure

**Validation Rules**:
- `name` must be non-empty and follow naming conventions
- `description` must be non-empty
- `parameters` must be valid JSON schema (type: object recommended)
- `strict: true` requires all fields in `properties` to be in `required`

**Serialization**:
```json
// Function tool
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather",
    "strict": true,
    "parameters": {
      "type": "object",
      "properties": { "location": { "type": "string" } },
      "required": ["location"]
    }
  }
}

// Local shell tool
{
  "type": "local_shell"
}

// Web search tool
{
  "type": "web_search"
}

// Custom tool
{
  "type": "custom",
  "custom": {
    "name": "browser_action",
    "description": "Perform browser action",
    "format": {
      "type": "typescript",
      "syntax": "interface",
      "definition": "interface Action { ... }"
    }
  }
}
```

---

### 4. Reasoning

**Purpose**: Configuration for LLM reasoning behavior (effort and summary settings).

**Rust Reference**: `codex-rs/core/src/client_common.rs:89-95`

**TypeScript Definition**:
```typescript
interface Reasoning {
  effort?: ReasoningEffortConfig;
  summary?: ReasoningSummaryConfig;
}

type ReasoningEffortConfig = 'low' | 'medium' | 'high';
type ReasoningSummaryConfig = boolean | { enabled: boolean };
```

**Field Descriptions**:
- `effort`: Reasoning effort level (low = faster, high = more thorough)
- `summary`: Whether to include reasoning summaries

**Usage**:
```typescript
// Only present if model supports reasoning summaries
const reasoning: Reasoning | undefined = modelFamily.supports_reasoning_summaries
  ? { effort: 'medium', summary: true }
  : undefined;
```

---

### 5. TextControls

**Purpose**: Text output controls for GPT-5 family models (verbosity and structured output format).

**Rust Reference**: `codex-rs/core/src/client_common.rs:113-119`

**TypeScript Definition**:
```typescript
interface TextControls {
  verbosity?: OpenAiVerbosity;
  format?: TextFormat;
}

type OpenAiVerbosity = 'low' | 'medium' | 'high';

interface TextFormat {
  type: TextFormatType;
  strict: boolean;
  schema: any;
  name: string;
}

type TextFormatType = 'json_schema';
```

**Field Descriptions**:
- `verbosity`: Output verbosity level (GPT-5 only)
- `format`: Structured output schema (JSON schema enforcement)

**Usage**:
```typescript
// Only for GPT-5 family models
const text: TextControls | undefined = modelFamily.family === 'gpt-5'
  ? {
      verbosity: 'medium',
      format: outputSchema ? {
        type: 'json_schema',
        strict: true,
        schema: outputSchema,
        name: 'codex_output_schema'
      } : undefined
    }
  : undefined;
```

---

### 6. ModelFamily

**Purpose**: Model family metadata and configuration.

**Rust Reference**: `codex-rs/core/src/model_family.rs`

**TypeScript Definition**:
```typescript
interface ModelFamily {
  family: string;
  base_instructions: string;
  supports_reasoning_summaries: boolean;
  needs_special_apply_patch_instructions: boolean;
}
```

**Field Descriptions**:
- `family`: Model family name (e.g., "gpt-5", "gpt-4", "gpt-3.5")
- `base_instructions`: Default system instructions for the model
- `supports_reasoning_summaries`: Whether model supports reasoning API
- `needs_special_apply_patch_instructions`: Whether to add apply_patch tool instructions

---

### 7. ModelProviderInfo

**Purpose**: Provider configuration and API settings.

**Rust Reference**: `codex-rs/core/src/model_provider_info.rs`

**TypeScript Definition**:
```typescript
interface ModelProviderInfo {
  name: string;
  base_url?: string;
  env_key?: string;
  env_key_instructions?: string;
  wire_api: WireApi;
  query_params?: Record<string, string>;
  http_headers?: Record<string, string>;
  env_http_headers?: Record<string, string>;
  request_max_retries?: number;
  stream_max_retries?: number;
  stream_idle_timeout_ms?: number;
  requires_openai_auth: boolean;
}

type WireApi = 'Responses' | 'Chat';
```

**Field Descriptions**:
- `name`: Provider name (e.g., "openai", "azure")
- `base_url`: API base URL (e.g., "https://api.openai.com/v1")
- `wire_api`: Which API to use (Responses or Chat)
- `request_max_retries`: Max retry attempts (default 3)
- `stream_idle_timeout_ms`: Idle timeout for SSE streams (default 120000)

---

## Entity Relationships

```
Prompt
  ├── input: ResponseItem[]  (protocol types)
  ├── tools: ToolSpec[]
  └── output_schema?: any

ResponsesApiRequest
  ├── instructions: string  (from Prompt.get_full_instructions())
  ├── input: ResponseItem[]  (from Prompt.get_formatted_input())
  ├── tools: any[]  (converted from ToolSpec[])
  ├── reasoning?: Reasoning
  └── text?: TextControls

ModelClient
  ├── stream(prompt: Prompt) -> ResponseStream
  ├── uses: ModelFamily, ModelProviderInfo
  └── builds: ResponsesApiRequest
```

---

## State Transitions

### Request Building Flow

```
1. User provides Prompt
   ↓
2. get_full_instructions(prompt, model)
   ↓
3. get_formatted_input(prompt)
   ↓
4. Convert tools to Responses API format
   ↓
5. Build ResponsesApiRequest
   ↓
6. Serialize to JSON
   ↓
7. POST to API
```

### Tool Conversion Flow

```
ToolSpec (TypeScript)
   ↓
Convert to Responses API format
   ↓
{
  type: 'function',
  function: { name, description, parameters }
}
or
{
  type: 'local_shell'
}
or
{
  type: 'web_search'
}
```

---

## Validation Summary

### Required Fields
- Prompt: `input`, `tools`
- ResponsesApiRequest: `model`, `instructions`, `input`, `tools`, `tool_choice`, `parallel_tool_calls`, `store`, `stream`, `include`

### Literal Types (Compile-time Enforcement)
- `tool_choice`: Must be `"auto"`
- `parallel_tool_calls`: Must be `false`
- `stream`: Must be `true`

### Conditional Fields
- `reasoning`: Only if `modelFamily.supports_reasoning_summaries`
- `text`: Only if `modelFamily.family === 'gpt-5'`
- `store`: `true` for Azure, `false` otherwise

---

## Next Steps

1. Create contract test files for each entity
2. Implement TypeScript interfaces in `codex-chrome/src/models/types/ResponsesAPI.ts`
3. Implement helper functions (`get_full_instructions`, `get_formatted_input`)
4. Implement OpenAIResponsesClient class
5. Update TurnManager to use new Prompt structure
