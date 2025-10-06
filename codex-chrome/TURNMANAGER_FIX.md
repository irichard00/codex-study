# TurnManager Tool Definition Fix

## Problem
Runtime error when calling `stream()` with tools:
```
ModelClientError: OpenAI API error: Missing required parameter: 'tools[0].function.name'
```

Console showed:
```javascript
{
  type: 'function',
  function: {
    name: undefined,      // ❌ MISSING
    description: undefined, // ❌ MISSING
    parameters: {...}
  }
}
```

## Root Cause

### Issue 1: Incorrect Property Access (Lines 294-309)
`TurnManager.ts` was incorrectly accessing properties on `ToolDefinition`:

```typescript
// ❌ WRONG - These properties don't exist on ToolDefinition
for (const toolDef of registeredTools) {
  const isDisabled = toolsConfig.disabled?.includes(toolDef.name); // ❌
  tools.push({
    type: 'function',
    function: {
      name: toolDef.name,           // ❌ undefined
      description: toolDef.description, // ❌ undefined
      parameters: toolDef.parameters || {}, // ❌ undefined
    },
  });
}
```

### Issue 2: Missing `strict` Field
Some manually created tools were missing the required `strict` field in `ResponsesApiTool`.

## Solution

### Fix 1: Proper Tool Handling (Lines 293-318)

Now correctly extracts tool name and passes tools through unchanged:

```typescript
// ✅ CORRECT - Extract name properly and pass through original ToolDefinition
for (const toolDef of registeredTools) {
  // Extract tool name based on type
  let toolName: string;
  if (toolDef.type === 'function') {
    toolName = toolDef.function.name;
  } else if (toolDef.type === 'local_shell') {
    toolName = 'local_shell';
  } else if (toolDef.type === 'web_search') {
    toolName = 'web_search';
  } else if (toolDef.type === 'custom') {
    toolName = toolDef.custom.name;
  } else {
    console.warn('[TurnManager] Unknown tool type, skipping:', toolDef);
    continue;
  }

  // Check if tool is explicitly disabled
  const isDisabled = toolsConfig.disabled?.includes(toolName);

  if (!isDisabled) {
    // ✅ Pass through the original ToolDefinition
    // OpenAIClient will handle conversion
    tools.push(toolDef);
  }
}
```

### Fix 2: Added `strict` Field

All manually created function tools now include `strict: false`:

```typescript
// web_search tool (line 322-336)
tools.push({
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for information',
    strict: false,  // ✅ Added
    parameters: {...}
  }
});

// update_plan tool (line 340-365)
tools.push({
  type: 'function',
  function: {
    name: 'update_plan',
    description: 'Update the current task plan',
    strict: false,  // ✅ Added
    parameters: {...}
  }
});

// MCP tools (line 371-379)
const convertedMcpTools = mcpTools.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.function.name,
    description: tool.function.description,
    strict: tool.function.strict ?? false,  // ✅ Added with fallback
    parameters: tool.function.parameters || { type: 'object' as const, properties: {} },
  },
}));
```

## Understanding ToolDefinition Structure

The `ToolDefinition` type (from `src/tools/BaseTool.ts`) is a union type:

```typescript
type ToolDefinition =
  | { type: 'function'; function: ResponsesApiTool }
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | { type: 'custom'; custom: FreeformTool };
```

### Correct Property Access:

```typescript
// For function tools:
tool.function.name         // ✅
tool.function.description  // ✅
tool.function.parameters   // ✅

// NOT directly on tool:
tool.name        // ❌ undefined
tool.description // ❌ undefined
tool.parameters  // ❌ undefined
```

## Files Modified

### src/core/TurnManager.ts
1. **Lines 293-318**: Fixed tool name extraction and pass-through
   - Extract name based on tool type
   - Pass original ToolDefinition unchanged
   - OpenAIClient handles conversion

2. **Line 327**: Added `strict: false` to web_search tool

3. **Line 345**: Added `strict: false` to update_plan tool

4. **Line 376**: Added `strict` field with fallback for MCP tools

## Testing

Build succeeds:
```bash
npm run build
✅ Build complete!
```

## Before vs After

### Before
```typescript
// Tools from registry
const toolDef = {
  type: 'function',
  function: { name: 'browser_tab', description: '...', strict: false, parameters: {...} }
};

// ❌ Trying to access non-existent properties
tools.push({
  type: 'function',
  function: {
    name: toolDef.name,  // undefined!
    description: toolDef.description,  // undefined!
    parameters: toolDef.parameters || {}  // undefined!
  }
});

// Result sent to OpenAI:
{
  type: 'function',
  function: {
    name: undefined,  // ❌ OpenAI rejects
    description: undefined,  // ❌
    parameters: {}
  }
}
```

### After
```typescript
// Tools from registry
const toolDef = {
  type: 'function',
  function: { name: 'browser_tab', description: '...', strict: false, parameters: {...} }
};

// ✅ Pass through original ToolDefinition
tools.push(toolDef);

// OpenAIClient's convertToolsToOpenAIFormat() handles conversion:
{
  type: 'function',
  function: {
    name: 'browser_tab',  // ✅ Correct
    description: '...',    // ✅ Correct
    parameters: {...}      // ✅ Correct
  }
}
```

## Key Learnings

1. **Don't Reconstruct Tool Definitions**: If you already have a valid `ToolDefinition`, pass it through unchanged

2. **Extract Names Carefully**: Tool name location depends on tool type:
   - `function`: `tool.function.name`
   - `local_shell`: literal string "local_shell"
   - `web_search`: literal string "web_search"
   - `custom`: `tool.custom.name`

3. **Always Include `strict`**: The `ResponsesApiTool` interface requires the `strict` field

4. **Let OpenAIClient Convert**: Don't try to convert tools manually in TurnManager - let `OpenAIClient.convertToolsToOpenAIFormat()` handle it

## Related Files

- `src/tools/BaseTool.ts` - ToolDefinition type definition
- `src/models/OpenAIClient.ts` - Tool conversion logic
- `src/tools/ToolRegistry.ts` - Tool storage and retrieval
- `docs/TOOL_CONVERSION.md` - Conversion documentation
- `docs/TOOL_DEBUGGING.md` - Debugging guide

## Prevention

To prevent this in the future:

1. Use helper functions from `BaseTool.ts`:
   ```typescript
   import { createFunctionTool, createObjectSchema } from '@/tools/BaseTool';
   ```

2. When getting tools from registry, use them as-is:
   ```typescript
   const tools = registry.listTools();  // Already in correct format
   ```

3. When creating tools manually, include all required fields:
   ```typescript
   {
     type: 'function',
     function: {
       name: '...',        // Required
       description: '...', // Required
       strict: false,      // Required
       parameters: {...}   // Required
     }
   }
   ```

4. Let `OpenAIClient` handle conversion - don't manually reconstruct tools
