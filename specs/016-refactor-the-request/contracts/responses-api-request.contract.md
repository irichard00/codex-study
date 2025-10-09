# Contract: ResponsesApiRequest Structure

**Feature**: 016-refactor-the-request
**Status**: Draft
**Rust Reference**: `codex-rs/core/src/client_common.rs:141-161`

## Interface Definition

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

## Contract Tests

### Test 1: Required Fields Present

**Test Name**: `test_responses_api_request_required_fields`

**Purpose**: Verify all required fields are present in payload

**Test Implementation**:
```typescript
import { describe, it, expect } from 'vitest';

describe('ResponsesApiRequest Contract', () => {
  it('should have all required fields', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'You are a helpful assistant.',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      store: false,
      stream: true,
      include: [],
    };

    expect(request).toHaveProperty('model');
    expect(request).toHaveProperty('instructions');
    expect(request).toHaveProperty('input');
    expect(request).toHaveProperty('tools');
    expect(request).toHaveProperty('tool_choice');
    expect(request).toHaveProperty('parallel_tool_calls');
    expect(request).toHaveProperty('store');
    expect(request).toHaveProperty('stream');
    expect(request).toHaveProperty('include');
  });
});
```

**Expected Result**: Test passes, all fields present

---

### Test 2: Literal Type Enforcement

**Test Name**: `test_literal_types_enforced`

**Purpose**: Verify tool_choice, parallel_tool_calls, and stream have correct literal values

**Rust Reference**: `client_common.rs:151-154` (fixed values)

**Test Implementation**:
```typescript
describe('Literal Type Enforcement', () => {
  it('should enforce tool_choice = "auto"', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto', // Must be literal "auto"
      parallel_tool_calls: false,
      store: false,
      stream: true,
      include: [],
    };

    expect(request.tool_choice).toBe('auto');

    // TypeScript compile-time check: This should fail type checking
    // const invalid: ResponsesApiRequest = { ...request, tool_choice: 'none' };
  });

  it('should enforce parallel_tool_calls = false', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false, // Must be literal false
      store: false,
      stream: true,
      include: [],
    };

    expect(request.parallel_tool_calls).toBe(false);
  });

  it('should enforce stream = true', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      store: false,
      stream: true, // Must be literal true
      include: [],
    };

    expect(request.stream).toBe(true);
  });
});
```

**Expected Result**: Tests pass, literal types enforced

---

### Test 3: Azure Endpoint Store Flag

**Test Name**: `test_azure_store_flag`

**Purpose**: Verify store flag set correctly for Azure vs standard endpoints

**Rust Reference**: `client.rs:223` (Azure workaround)

**Test Implementation**:
```typescript
describe('Azure Endpoint Handling', () => {
  it('should set store=true for Azure endpoints', () => {
    const azureProvider: ModelProviderInfo = {
      name: 'azure',
      base_url: 'https://my-resource.openai.azure.com',
      wire_api: 'Responses',
      requires_openai_auth: false,
    };

    const isAzure = azureProvider.base_url?.includes('azure.com');
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      store: isAzure ? true : false, // True for Azure
      stream: true,
      include: [],
    };

    expect(request.store).toBe(true);
  });

  it('should set store=false for standard OpenAI endpoints', () => {
    const openaiProvider: ModelProviderInfo = {
      name: 'openai',
      base_url: 'https://api.openai.com/v1',
      wire_api: 'Responses',
      requires_openai_auth: true,
    };

    const isAzure = openaiProvider.base_url?.includes('azure.com');
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      store: isAzure ? true : false, // False for standard
      stream: true,
      include: [],
    };

    expect(request.store).toBe(false);
  });
});
```

**Expected Result**: Store flag set correctly based on provider

---

### Test 4: Include Array Populated

**Test Name**: `test_include_array_reasoning`

**Purpose**: Verify include array populated when reasoning enabled

**Rust Reference**: `client.rs:191-195`

**Test Implementation**:
```typescript
describe('Include Array', () => {
  it('should include reasoning.encrypted_content when reasoning present', () => {
    const reasoning: Reasoning = {
      effort: 'medium',
      summary: true,
    };

    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      reasoning,
      store: false,
      stream: true,
      include: reasoning ? ['reasoning.encrypted_content'] : [],
    };

    expect(request.include).toContain('reasoning.encrypted_content');
  });

  it('should have empty include array when no reasoning', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      store: false,
      stream: true,
      include: [],
    };

    expect(request.include).toEqual([]);
  });
});
```

**Expected Result**: Include array populated correctly

---

### Test 5: Serialization Excludes Undefined

**Test Name**: `test_serialization_omits_undefined`

**Purpose**: Verify undefined optional fields are omitted from JSON

**Rust Reference**: `client_common.rs:157-160` (skip_serializing_if)

**Test Implementation**:
```typescript
describe('JSON Serialization', () => {
  it('should omit undefined optional fields', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      store: false,
      stream: true,
      include: [],
      // reasoning, prompt_cache_key, text are undefined
    };

    const json = JSON.parse(JSON.stringify(request));

    expect(json).not.toHaveProperty('reasoning');
    expect(json).not.toHaveProperty('prompt_cache_key');
    expect(json).not.toHaveProperty('text');
  });

  it('should include defined optional fields', () => {
    const request: ResponsesApiRequest = {
      model: 'gpt-5',
      instructions: 'Test',
      input: [],
      tools: [],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      reasoning: { effort: 'medium' },
      store: false,
      stream: true,
      include: ['reasoning.encrypted_content'],
      prompt_cache_key: 'conv_123',
      text: { verbosity: 'medium' },
    };

    const json = JSON.parse(JSON.stringify(request));

    expect(json).toHaveProperty('reasoning');
    expect(json).toHaveProperty('prompt_cache_key');
    expect(json).toHaveProperty('text');
  });
});
```

**Expected Result**: Undefined fields omitted, defined fields included

---

## Acceptance Criteria

- [ ] ResponsesApiRequest interface defined
- [ ] All required fields present
- [ ] Literal types enforced (tool_choice, parallel_tool_calls, stream)
- [ ] Store flag logic implemented for Azure
- [ ] Include array populated when reasoning enabled
- [ ] Serialization omits undefined fields
- [ ] Contract tests written and failing (no implementation yet)

## Dependencies

- `ResponseItem` type from protocol
- `Reasoning` interface
- `TextControls` interface
- `ModelProviderInfo` for Azure detection

## Implementation Notes

1. Use TypeScript literal types to enforce:
   - `tool_choice: "auto"` (not `string`)
   - `parallel_tool_calls: false` (not `boolean`)
   - `stream: true` (not `boolean`)

2. Azure detection:
   ```typescript
   const isAzure = provider.base_url?.includes('azure.com') && provider.wire_api === 'Responses';
   ```

3. Include array logic:
   ```typescript
   const include = reasoning ? ['reasoning.encrypted_content'] : [];
   ```

4. JSON serialization:
   - Use `JSON.stringify()` to exclude undefined fields automatically
   - No manual filtering needed
