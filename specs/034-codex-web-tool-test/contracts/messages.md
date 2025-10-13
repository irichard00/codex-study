# Message Contracts: Codex Web Tool Test Extension

**Feature**: 034-codex-web-tool-test
**Date**: 2025-10-10

## Overview
This document defines the message contracts for communication between the side panel UI and the service worker background script.

All messages use Chrome's `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` APIs.

## Message Format

All messages follow this base structure:

```typescript
interface BaseMessage {
  type: string;
  // Additional fields per message type
}
```

Responses can be:
- Success: Return data directly
- Error: Throw error (caught by message handler)

## Service Worker → Side Panel Messages

These messages are sent by the service worker in response to side panel requests.

None - all communication is request/response initiated by side panel.

## Side Panel → Service Worker Messages

### 1. GET_TOOLS

**Purpose**: Retrieve list of all registered tools from ToolRegistry

**Request Schema**:
```typescript
interface GetToolsMessage {
  type: 'GET_TOOLS';
}
```

**Response Schema**:
```typescript
interface GetToolsResponse {
  tools: ToolDefinition[];
}
```

**ToolDefinition** (from BaseTool.ts):
```typescript
type ToolDefinition =
  | { type: 'function'; function: { name: string; description: string; parameters: JsonSchema } }
  | { type: 'custom'; custom: { name: string; description: string } }
  | { type: 'local_shell' }
  | { type: 'web_search' };
```

**Success Response Example**:
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "dom_snapshot",
        "description": "Capture DOM snapshot of current page",
        "parameters": {
          "type": "object",
          "properties": {
            "includeStyles": { "type": "boolean" },
            "maxDepth": { "type": "number" }
          },
          "required": ["includeStyles"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "navigate",
        "description": "Navigate to URL",
        "parameters": {
          "type": "object",
          "properties": {
            "url": { "type": "string" }
          },
          "required": ["url"]
        }
      }
    }
  ]
}
```

**Error Scenarios**:
- ToolRegistry not initialized → Error: "ToolRegistry not ready"
- Service worker not responding → Chrome runtime error (caught by side panel)

**Timing**: Should return within 100ms

---

### 2. EXECUTE_TOOL

**Purpose**: Execute a specific tool with provided parameters

**Request Schema**:
```typescript
interface ExecuteToolMessage {
  type: 'EXECUTE_TOOL';
  request: ToolExecutionRequest;
}

interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  sessionId?: string;
  turnId?: string;
  timeout?: number;
}
```

**Response Schema**:
```typescript
interface ExecuteToolResponse {
  result: ToolExecutionResponse;
}

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

**Success Response Example**:
```json
{
  "result": {
    "success": true,
    "data": {
      "title": "Example Page",
      "url": "https://example.com",
      "elements": 42
    },
    "duration": 123
  }
}
```

**Error Response Example** (tool execution failed):
```json
{
  "result": {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Parameter validation failed",
      "details": [
        {
          "parameter": "url",
          "message": "Required parameter missing",
          "code": "REQUIRED"
        }
      ]
    },
    "duration": 5
  }
}
```

**Error Scenarios**:
- Tool not found → error.code = "TOOL_NOT_FOUND"
- Invalid parameters → error.code = "VALIDATION_ERROR"
- Tool execution timeout → error.code = "TIMEOUT"
- Tool execution error → error.code = "EXECUTION_ERROR"
- Service worker error → Chrome runtime error

**Timing**: Variable depending on tool (typically 100ms - 5s)

---

## Message Handler Patterns

### Service Worker Handler

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ error: error.message }));

  return true; // Indicates async response
});

async function handleMessage(message: BaseMessage): Promise<any> {
  switch (message.type) {
    case 'GET_TOOLS':
      return handleGetTools();

    case 'EXECUTE_TOOL':
      return handleExecuteTool(message as ExecuteToolMessage);

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
```

### Side Panel Sender

```typescript
async function sendToBackground<T>(message: BaseMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

// Usage
const response = await sendToBackground<GetToolsResponse>({ type: 'GET_TOOLS' });
const tools = response.tools;
```

## Message Flow Sequence Diagrams

### GET_TOOLS Flow

```
Side Panel                     Service Worker                ToolRegistry
    |                               |                              |
    |--GET_TOOLS------------------>|                              |
    |                               |--listTools()---------------->|
    |                               |<--ToolDefinition[]-----------|
    |<--{tools: [...]}-------------|                              |
    |                               |                              |
```

### EXECUTE_TOOL Flow

```
Side Panel                     Service Worker                ToolRegistry           Tool Handler
    |                               |                              |                      |
    |--EXECUTE_TOOL--------------->|                              |                      |
    |  {toolName, parameters}       |                              |                      |
    |                               |--execute(request)---------->|                      |
    |                               |                              |--validate()          |
    |                               |                              |--handler(params)--->|
    |                               |                              |                 [executes]
    |                               |                              |<--result------------|
    |                               |<--ToolExecutionResponse-----|                      |
    |<--{result}-------------------|                              |                      |
    |                               |                              |                      |
```

## Error Handling Contract

All message handlers MUST:
1. Catch all errors (no unhandled exceptions)
2. Return structured error responses
3. Include error code for programmatic handling
4. Include human-readable error message
5. Optionally include details for debugging

Error response structure:
```typescript
interface ErrorResponse {
  error: {
    code: string;      // Machine-readable error code
    message: string;   // Human-readable message
    details?: any;     // Optional debug information
  }
}
```

Standard error codes:
- `TOOL_NOT_FOUND` - Requested tool doesn't exist
- `VALIDATION_ERROR` - Parameter validation failed
- `TIMEOUT` - Tool execution exceeded timeout
- `EXECUTION_ERROR` - Tool handler threw error
- `UNKNOWN_MESSAGE_TYPE` - Message type not recognized
- `REGISTRY_NOT_READY` - ToolRegistry not initialized

## Testing Contracts

All contracts MUST be validated with:

1. **Type checking**: TypeScript compilation validates structure
2. **Schema validation**: Runtime validation of message types
3. **Error scenarios**: Test each error code path
4. **Timeout handling**: Test tool execution timeout

## Contract Versioning

**Current Version**: 1.0.0

Since this is an internal test tool, versioning is simple:
- Breaking changes → Increment version
- Service worker and side panel always deployed together
- No backward compatibility needed

## Performance Requirements

| Message Type | Max Response Time | Typical Response Time |
|--------------|-------------------|----------------------|
| GET_TOOLS | 200ms | <50ms |
| EXECUTE_TOOL | 30s (with timeout) | 100ms - 5s |

## Security Considerations

- All messages are internal (side panel ↔ service worker)
- No external message sources accepted
- Validate sender context before processing
- Tool execution runs in isolated context (service worker)

## Future Extensions

**Not in current scope**:
- CANCEL_EXECUTION message (abort running tool)
- GET_TOOL_HISTORY message (retrieve past executions)
- BATCH_EXECUTE message (execute multiple tools)

These could be added if needed for enhanced testing capabilities.
