# Data Model: Codex Web Tool Test Extension

**Feature**: 034-codex-web-tool-test
**Date**: 2025-10-10

## Overview
This document defines the data structures and entities used in the test extension. Most entities are imported from the main codebase; this document describes how they're used in the test tool context.

## Core Entities

### 1. ToolDefinition (Imported)
**Source**: `codex-chrome/src/tools/BaseTool.ts`
**Purpose**: Represents a registered browser tool with its metadata and schema

**Structure**:
```typescript
type ToolDefinition =
  | { type: 'function'; function: { name: string; description: string; parameters: JsonSchema } }
  | { type: 'custom'; custom: { name: string; description: string } }
  | { type: 'local_shell' }
  | { type: 'web_search' };
```

**Usage in Test Tool**:
- Displayed in tool list (name, description)
- Used to generate parameter input forms (parameters schema)
- Shown in tool detail view for reference

**Validation Rules**:
- Must have valid type
- Function tools must have name, description, and parameters
- Parameters must be valid JsonSchema

### 2. ToolExecutionRequest (Imported)
**Source**: `codex-chrome/src/tools/BaseTool.ts`
**Purpose**: Request structure for executing a tool

**Structure**:
```typescript
interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  sessionId?: string;
  turnId?: string;
  timeout?: number;
}
```

**Usage in Test Tool**:
- Created when user clicks "Execute" button
- Populated from user input form
- sessionId/turnId set to test values (e.g., 'test-session', 'test-turn-1')
- Sent to service worker for execution

**Validation Rules**:
- toolName must match a registered tool
- parameters must match tool's parameter schema
- timeout optional, defaults to 120000ms

**State Transitions**:
```
[User Input] → [Form Validation] → [Request Creation] → [Service Worker] → [Tool Execution]
```

### 3. ToolExecutionResponse (Imported)
**Source**: `codex-chrome/src/tools/BaseTool.ts`
**Purpose**: Response structure from tool execution

**Structure**:
```typescript
interface ToolExecutionResponse {
  success: boolean;
  data?: any;
  error?: ToolError;
  duration: number;
  metadata?: Record<string, any>;
}

interface ToolError {
  code: string;
  message: string;
  details?: any;
}
```

**Usage in Test Tool**:
- Received from service worker after execution
- Displayed in result panel
- Success: show data as formatted JSON
- Error: show error code, message, and details

**Display Rules**:
- duration always shown (in ms)
- data formatted as syntax-highlighted JSON
- errors shown with distinct styling (red background)
- Large data payloads truncated with expand option

### 4. ToolListItem (Test Tool Specific)
**Purpose**: Simplified view of a tool for display in the list

**Structure**:
```typescript
interface ToolListItem {
  name: string;
  description: string;
  type: string;
  hasParameters: boolean;
}
```

**Derivation**: Created from ToolDefinition
```typescript
function toListItem(def: ToolDefinition): ToolListItem {
  const name = getToolName(def);
  const description = getToolDescription(def);
  const type = def.type;
  const hasParameters = def.type === 'function' &&
    Object.keys(def.function.parameters.properties || {}).length > 0;

  return { name, description, type, hasParameters };
}
```

**Usage in Test Tool**:
- Rendered in tool list view
- Click to navigate to detail view
- Sorted alphabetically by name

### 5. ToolDetailView (Test Tool Specific)
**Purpose**: Complete view of a tool including execution capabilities

**Structure**:
```typescript
interface ToolDetailView {
  definition: ToolDefinition;
  exampleRequest: ToolExecutionRequest;
  parameterInputs: Record<string, any>;
  executionResult?: ToolExecutionResponse;
  isExecuting: boolean;
}
```

**Fields**:
- `definition`: Full tool definition from ToolRegistry
- `exampleRequest`: Pre-filled example request for reference
- `parameterInputs`: Current user input values
- `executionResult`: Result from last execution (if any)
- `isExecuting`: Flag indicating execution in progress

**State Transitions**:
```
[Initial Load] → definition populated, exampleRequest generated
     ↓
[User Input] → parameterInputs updated
     ↓
[Execute Click] → isExecuting = true
     ↓
[Result Received] → executionResult populated, isExecuting = false
```

**Validation Rules**:
- parameterInputs must satisfy parameter schema before execution
- Cannot execute while isExecuting = true

### 6. ViewState (Test Tool Specific)
**Purpose**: Application-level state for view routing

**Structure**:
```typescript
interface ViewState {
  currentView: 'list' | 'detail';
  selectedTool?: string;
  toolListItems: ToolListItem[];
}
```

**Fields**:
- `currentView`: Current active view
- `selectedTool`: Tool name when in detail view
- `toolListItems`: Cached list of all tools

**State Transitions**:
```
[App Load] → currentView = 'list', toolListItems populated from service worker
     ↓
[Tool Click] → currentView = 'detail', selectedTool = tool.name
     ↓
[Back Click] → currentView = 'list', selectedTool = undefined
```

**Persistence**: Stored in component state, not persisted across sessions

## Message Types

### 7. GetToolsMessage
**Purpose**: Request list of all registered tools from service worker

**Structure**:
```typescript
interface GetToolsMessage {
  type: 'GET_TOOLS';
}
```

**Response**:
```typescript
interface GetToolsResponse {
  tools: ToolDefinition[];
}
```

### 8. ExecuteToolMessage
**Purpose**: Request tool execution from service worker

**Structure**:
```typescript
interface ExecuteToolMessage {
  type: 'EXECUTE_TOOL';
  request: ToolExecutionRequest;
}
```

**Response**:
```typescript
interface ExecuteToolResponse {
  result: ToolExecutionResponse;
}
```

## Data Flow Diagrams

### Tool List Loading Flow
```
Side Panel               Service Worker              ToolRegistry
    |                          |                           |
    |---GET_TOOLS------------->|                           |
    |                          |---listTools()------------>|
    |                          |<-------ToolDefinition[]---|
    |<--ToolDefinition[]-------|                           |
    |                          |                           |
[Render List]
```

### Tool Execution Flow
```
Side Panel               Service Worker              ToolRegistry
    |                          |                           |
[User Input]                   |                           |
    |                          |                           |
    |---EXECUTE_TOOL---------->|                           |
    |   (request)              |---execute(request)------->|
    |                          |                      [Tool Handler]
    |                          |<-------response-----------|
    |<--response---------------|                           |
    |                          |                           |
[Display Result]
```

## Relationships

```
ToolRegistry (1) ----has many----> (N) ToolDefinition
                                        |
                                        |
                                   [displayed as]
                                        |
                                        v
                                   ToolListItem
                                        |
                                   [selected for]
                                        |
                                        v
                                   ToolDetailView
                                        |
                                   [generates]
                                        |
                                        v
                                ToolExecutionRequest
                                        |
                                   [produces]
                                        |
                                        v
                                ToolExecutionResponse
```

## Storage

**No persistent storage needed** for test tool.

All data is ephemeral:
- Tool list loaded on demand from ToolRegistry
- Execution results displayed but not saved
- No user preferences or settings

**Rationale**: Test tool is for immediate debugging/testing, not long-term tracking.

## Validation Summary

| Entity | Validation Point | Rules |
|--------|-----------------|-------|
| ToolDefinition | ToolRegistry registration | Type valid, required fields present |
| ToolExecutionRequest | Before execution | Tool exists, parameters match schema |
| parameterInputs | Before execution | Types match schema, required fields present |
| ViewState.selectedTool | On navigation | Tool name exists in toolListItems |

## Error Handling

All entities imported from main codebase follow existing error handling:
- ToolRegistry.execute() returns ToolExecutionResponse with error field on failure
- Validation errors shown in UI before execution attempted
- Message passing errors caught and displayed as "Communication Error"

## Future Considerations

**Not in scope for initial implementation**:
- Execution history/logging
- Saved test scenarios
- Performance metrics collection
- Tool favorites/bookmarks

These could be added later if the test tool proves valuable for ongoing development.
