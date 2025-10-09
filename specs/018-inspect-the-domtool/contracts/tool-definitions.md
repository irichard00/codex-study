# Contract: Tool Definition Transformation for OpenAI Responses API

**Feature**: 018-inspect-the-domtool
**Date**: 2025-10-09
**Status**: Active

## Overview

This contract defines the transformation rules for converting internal tool definitions to the format required by OpenAI's Responses API (experimental).

## Background

OpenAI provides TWO different APIs for tool calling:

1. **Chat Completions API** (`/v1/chat/completions`)
   - Uses NESTED structure: `{ type: 'function', function: { name, description, parameters } }`
   - Well-established, documented API

2. **Responses API** (`/v1/responses`) [EXPERIMENTAL]
   - Uses FLAT structure: `{ type: 'function', name, description, parameters }`
   - New API, different tool definition format

**codex-chrome uses Responses API** → Must use flat structure

## Participants

1. **BaseTool** (src/tools/BaseTool.ts): Creates internal tool definitions
2. **OpenAIResponsesClient** (src/models/OpenAIResponsesClient.ts): Transforms definitions for API
3. **OpenAI Responses API** (api.openai.com/v1/responses): Consumes flat definitions

## Contract Specification

### Internal Tool Definition Format

**Created by**: `BaseTool.createToolDefinition()`

```typescript
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    strict?: boolean
    parameters: JsonSchema
  }
}
```

**Example**:
```typescript
{
  type: 'function',
  function: {
    name: 'browser_dom',
    description: 'Interact with DOM elements - comprehensive DOM operations',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The DOM action to perform',
          enum: ['query', 'click', 'type', ...]
        },
        selector: {
          type: 'string',
          description: 'CSS selector to target elements'
        }
      },
      required: ['action']
    }
  }
}
```

### Responses API Tool Format

**Required by**: OpenAI Responses API (`/v1/responses`)

```typescript
interface ResponsesApiTool {
  type: 'function'
  name: string
  description: string
  strict?: boolean
  parameters: JsonSchema
}
```

**Example**:
```typescript
{
  type: 'function',
  name: 'browser_dom',  // Flattened from function.name
  description: 'Interact with DOM elements - comprehensive DOM operations',
  strict: false,
  parameters: {
    type: 'object',
    properties: {
      action: { ... },
      selector: { ... }
    },
    required: ['action']
  }
}
```

## Transformation Rules

### TR-1: Flatten Function Wrapper

**Rule**: Extract all fields from nested `function` object to top level

**Transformation**:
```typescript
// Input (internal format)
{
  type: 'function',
  function: {
    name: 'tool_name',
    description: 'Tool description',
    strict: true,
    parameters: { ... }
  }
}

// Output (Responses API format)
{
  type: 'function',
  name: 'tool_name',           // ← from function.name
  description: 'Tool description', // ← from function.description
  strict: true,                // ← from function.strict
  parameters: { ... }          // ← from function.parameters
}
```

### TR-2: Preserve Type Field

**Rule**: Keep `type: 'function'` unchanged

**Rationale**: Both formats use the same type discriminator

### TR-3: Preserve Parameters Schema

**Rule**: Copy `function.parameters` to `parameters` without modification

**Rationale**: JSON Schema format is identical in both APIs

### TR-4: Handle Optional Fields

**Rule**: Only include `strict` if present in source

**Transformation**:
```typescript
// If source has strict
function.strict: true → strict: true

// If source omits strict
function.strict: undefined → (omit strict field)
```

### TR-5: Validate Required Fields

**Rule**: Fail transformation if required fields are missing

**Required Fields**:
- `type` (must be 'function')
- `function.name` (must be non-empty string)
- `function.description` (must be non-empty string)
- `function.parameters` (must be valid JSON Schema)

**Error Handling**:
```typescript
if (!tool.type || tool.type !== 'function') {
  throw new Error('Tool type must be "function"')
}

if (!tool.function?.name) {
  throw new Error('Tool must have function.name')
}

if (!tool.function?.description) {
  throw new Error('Tool must have function.description')
}
```

## Implementation Contract

### Method Signature

**Location**: `src/models/OpenAIResponsesClient.ts`

```typescript
private createToolsJsonForResponsesApi(tools: ToolDefinition[]): ResponsesApiTool[]
```

**Input**: Array of internal tool definitions
**Output**: Array of Responses API formatted tools
**Side Effects**: None (pure function)

### Implementation

```typescript
private createToolsJsonForResponsesApi(tools: any[]): any[] {
  if (!tools || !Array.isArray(tools)) {
    return [];
  }

  return tools
    .map(tool => {
      // Validate tool structure
      if (!tool || typeof tool !== 'object') {
        console.warn('[OpenAIResponsesClient] Invalid tool object:', tool);
        return null;
      }

      // Handle function tools
      if (tool.type === 'function') {
        if (!tool.function?.name || !tool.function?.description) {
          console.error('[OpenAIResponsesClient] Function tool missing required fields:', tool);
          return null;
        }

        // Transform to flat structure
        return {
          type: 'function',
          name: tool.function.name,
          description: tool.function.description,
          strict: tool.function.strict || false,
          parameters: tool.function.parameters || { type: 'object', properties: {} },
        };
      }

      // Handle other tool types (local_shell, web_search, etc.)
      return tool;
    })
    .filter((tool): tool is NonNullable<typeof tool> => tool !== null);
}
```

## Testing Requirements

### Test 1: Basic Transformation

```typescript
describe('createToolsJsonForResponsesApi', () => {
  it('should transform nested function definition to flat structure', () => {
    const input = [{
      type: 'function',
      function: {
        name: 'browser_dom',
        description: 'Interact with DOM elements',
        parameters: { type: 'object', properties: { action: { type: 'string' } } }
      }
    }];

    const output = client.createToolsJsonForResponsesApi(input);

    expect(output).toEqual([{
      type: 'function',
      name: 'browser_dom',
      description: 'Interact with DOM elements',
      strict: false,
      parameters: { type: 'object', properties: { action: { type: 'string' } } }
    }]);

    expect(output[0]).not.toHaveProperty('function');
  });
});
```

### Test 2: Preserve Optional Fields

```typescript
it('should preserve strict field when present', () => {
  const input = [{
    type: 'function',
    function: {
      name: 'test_tool',
      description: 'Test',
      strict: true,
      parameters: {}
    }
  }];

  const output = client.createToolsJsonForResponsesApi(input);

  expect(output[0].strict).toBe(true);
});
```

### Test 3: Handle Missing Fields

```typescript
it('should filter out invalid tools', () => {
  const input = [
    { type: 'function', function: { name: 'valid', description: 'Valid tool', parameters: {} } },
    { type: 'function', function: { name: 'invalid' } }, // Missing description
    { type: 'function' }, // Missing function object
    null,
    undefined
  ];

  const output = client.createToolsJsonForResponsesApi(input);

  expect(output).toHaveLength(1);
  expect(output[0].name).toBe('valid');
});
```

### Test 4: Preserve Parameters Schema

```typescript
it('should preserve complex parameters schema', () => {
  const complexSchema = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['query', 'click'] },
      selector: { type: 'string' },
      options: {
        type: 'object',
        properties: {
          timeout: { type: 'number', default: 5000 }
        }
      }
    },
    required: ['action'],
    additionalProperties: false
  };

  const input = [{
    type: 'function',
    function: {
      name: 'dom_tool',
      description: 'DOM operations',
      parameters: complexSchema
    }
  }];

  const output = client.createToolsJsonForResponsesApi(input);

  expect(output[0].parameters).toEqual(complexSchema);
});
```

## Invariants

### INV-1: No Nested Function Property

**Rule**: Output MUST NOT contain a nested `function` property

**Verification**:
```typescript
const output = createToolsJsonForResponsesApi(input);
output.forEach(tool => {
  expect(tool).not.toHaveProperty('function');
});
```

### INV-2: All Required Fields Present

**Rule**: Output MUST have type, name, description, and parameters

**Verification**:
```typescript
output.forEach(tool => {
  expect(tool.type).toBe('function');
  expect(tool.name).toBeTruthy();
  expect(tool.description).toBeTruthy();
  expect(tool.parameters).toBeDefined();
});
```

### INV-3: One-to-One or Filtered Mapping

**Rule**: Output array length ≤ input array length (some may be filtered)

**Verification**:
```typescript
expect(output.length).toBeLessThanOrEqual(input.length);
```

## Error Handling

### Error Case 1: Invalid Tool Type

**Input**: `{ type: 'invalid' }`
**Behavior**: Log warning, filter out
**Output**: Empty array (if only invalid tool)

### Error Case 2: Missing Required Fields

**Input**: `{ type: 'function', function: { name: 'test' } }`
**Behavior**: Log error, filter out
**Reason**: Missing description

### Error Case 3: Null/Undefined Tools

**Input**: `[null, undefined, {...}]`
**Behavior**: Filter out null/undefined
**Output**: Only valid tools

## Compliance

**Last Verified**: 2025-10-09
**Compliance Status**: ⚠️ **NEEDS VERIFICATION**

**Action Items**:
1. Review current implementation in OpenAIResponsesClient.ts:793-854
2. Verify transformation follows all rules
3. Add test cases for edge cases
4. Validate against OpenAI Responses API spec

## References

- OpenAI Responses API (experimental): Internal OpenAI documentation
- Chat Completions API: https://platform.openai.com/docs/api-reference/chat/create
- Tool Calling Guide: https://platform.openai.com/docs/guides/function-calling
