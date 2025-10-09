# Data Model: DOMTool Content Script Communication

**Feature**: 017-fix-domtool-content-script-communication
**Date**: 2025-10-09

## Overview

This document defines the data structures exchanged between DOMTool (background script) and content-script (page context) for DOM manipulation operations. The model focuses on message passing contracts, error reporting, and state tracking.

---

## Core Entities

### 1. DOM Operation Request

**Purpose**: Message sent from DOMTool to content script requesting a DOM operation

**Fields**:
| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| type | MessageType | Yes | Message type identifier | Must be `MessageType.DOM_ACTION` |
| action | DOMActionType | Yes | Specific DOM operation to execute | Must be one of 25 supported operations |
| requestId | string | Yes | Unique identifier for request/response matching | Format: `dom_{timestamp}_{random}` |
| selector | string | Conditional | CSS selector for target element(s) | Required for element-targeting operations |
| xpath | string | Conditional | XPath expression for element selection | Required for `findByXPath` operation |
| text | string | Conditional | Text to type or search for | Required for `type` operation |
| attribute | string | Conditional | Attribute name for get/set operations | Required for `getAttribute`, `setAttribute` |
| property | string | Conditional | Property name for get/set operations | Required for `getProperty`, `setProperty` |
| value | string | Conditional | Value to set for attributes/properties/form fields | Required for set operations |
| formData | Record<string, string> | Conditional | Key-value pairs for form filling | Required for `fillForm` operation |
| sequence | Array<DOMActionRequest> | Conditional | Array of operations for batch execution | Required for `executeSequence` |
| options | DOMActionOptions | No | Additional operation options | See DOMActionOptions |
| timestamp | number | Yes | Request creation timestamp | Unix timestamp in milliseconds |
| source | MessageSource | Yes | Origin of the message | `{ context: 'background', tabId: number }` |

**Relationships**:
- 1 Request → 1 Response (request-response pattern)
- 1 Request → 0..N Elements (query operations return multiple elements)

**State Transitions**:
```
CREATED → IN_FLIGHT → [COMPLETED | FAILED | TIMEOUT]
```

**Validation Rules**:
- `requestId` must be unique within 5-minute window
- `action` must be valid DOMActionType
- Conditional fields must be present based on `action` type
- `timeout` in options must be ≤ 30000ms
- `selector` and `xpath` are mutually exclusive

**Example**:
```typescript
{
  type: MessageType.DOM_ACTION,
  action: 'query',
  requestId: 'dom_1728489012345_abc123',
  selector: '.headline',
  options: { multiple: true, includeHidden: false },
  timestamp: 1728489012345,
  source: { context: 'background', tabId: 42 }
}
```

---

### 2. DOM Operation Response

**Purpose**: Message returned from content script to DOMTool with operation results

**Fields**:
| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| success | boolean | Yes | Whether operation succeeded | true = success, false = error |
| data | any | Conditional | Operation result data | Required if success=true |
| error | OperationError | Conditional | Error details if operation failed | Required if success=false |
| requestId | string | Yes | Matches request requestId for correlation | Must match incoming request |
| timestamp | number | Yes | Response creation timestamp | Unix timestamp in milliseconds |
| source | MessageSource | Yes | Origin of the response | `{ context: 'content', tabId: number, frameId: number }` |
| initLevel | InitializationLevel | No | Content script initialization state | For diagnostics |
| executionTime | number | No | Time taken to execute operation (ms) | For performance monitoring |

**Relationships**:
- 1 Response → 1 Request (via requestId)
- 1 Response → 0..N Elements (in data field)

**Validation Rules**:
- `requestId` must match a pending request
- Exactly one of `data` or `error` must be present
- `executionTime` must be ≥ 0 if present
- `timestamp` must be ≥ request timestamp

**Example (Success)**:
```typescript
{
  success: true,
  data: {
    elements: [
      { tagName: 'h1', className: 'headline', text: 'WSJ Top Story' }
    ],
    count: 1
  },
  requestId: 'dom_1728489012345_abc123',
  timestamp: 1728489012567,
  source: { context: 'content', tabId: 42, frameId: 0 },
  executionTime: 12
}
```

**Example (Error)**:
```typescript
{
  success: false,
  error: {
    type: 'ELEMENT_NOT_FOUND',
    message: 'No element matching selector ".headline" found on page',
    operation: 'query',
    context: { selector: '.headline', pageURL: 'https://wsj.com' },
    suggestedAction: 'Verify selector is correct or wait for dynamic content to load'
  },
  requestId: 'dom_1728489012345_abc123',
  timestamp: 1728489012567,
  source: { context: 'content', tabId: 42, frameId: 0 }
}
```

---

### 3. Operation Error

**Purpose**: Structured error information for failed operations

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | ErrorCode | Yes | Classified error type |
| message | string | Yes | Human-readable error description |
| operation | DOMActionType | Yes | Operation that failed |
| context | ErrorContext | No | Additional error context (selector, element state, etc.) |
| suggestedAction | string | No | Actionable guidance for resolving error |

**Error Codes**:
```typescript
enum ErrorCode {
  // Element errors
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_INTERACTABLE = 'ELEMENT_NOT_INTERACTABLE',

  // Communication errors
  TIMEOUT = 'TIMEOUT',
  CONTENT_SCRIPT_NOT_LOADED = 'CONTENT_SCRIPT_NOT_LOADED',
  SCRIPT_INJECTION_FAILED = 'SCRIPT_INJECTION_FAILED',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CROSS_ORIGIN_FRAME = 'CROSS_ORIGIN_FRAME',
  CSP_BLOCKED = 'CSP_BLOCKED',

  // Input errors
  INVALID_SELECTOR = 'INVALID_SELECTOR',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',

  // System errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTEXT_INVALIDATED = 'CONTEXT_INVALIDATED',
  UNKNOWN = 'UNKNOWN'
}
```

**Error Context**:
```typescript
interface ErrorContext {
  selector?: string;
  xpath?: string;
  elementState?: 'hidden' | 'obscured' | 'disabled' | 'removed';
  pageURL?: string;
  tabId?: number;
  frameId?: number;
  originalError?: string;
}
```

**Validation Rules**:
- `message` must be non-empty
- `type` must be valid ErrorCode
- `suggestedAction` should provide actionable guidance (not just "try again")

---

### 4. Content Script State

**Purpose**: Tracks initialization and readiness state of content script

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tabId | number | Yes | Tab identifier |
| status | ContentScriptStatus | Yes | Current status |
| initLevel | InitializationLevel | Yes | Initialization level reached |
| lastPingTime | number | No | Last successful PING timestamp |
| lastPongTime | number | No | Last PONG response timestamp |
| injectionTime | number | No | When script was injected |
| errorCount | number | Yes | Number of consecutive errors |
| version | string | No | Content script version |
| capabilities | string[] | No | Available capabilities |

**Status Values**:
```typescript
enum ContentScriptStatus {
  IDLE = 'idle',                 // Not injected
  INJECTING = 'injecting',       // Injection in progress
  READY = 'ready',               // Ready for operations
  FAILED = 'failed',             // Injection or init failed
  DISCONNECTED = 'disconnected'  // Was ready, now unresponsive
}
```

**Initialization Levels**:
```typescript
enum InitializationLevel {
  NOT_INJECTED = 0,
  INJECTED = 1,
  HANDLERS_READY = 2,
  DOM_READY = 3,
  FULLY_READY = 4
}
```

**State Transitions**:
```
IDLE → INJECTING → READY → [DISCONNECTED | FAILED]
                ↓
              FAILED
```

**Validation Rules**:
- `status` and `initLevel` must be consistent
- `errorCount` resets to 0 when status changes to READY
- `lastPongTime` must be ≥ `lastPingTime` if both present

---

### 5. DOM Action Options

**Purpose**: Optional parameters for DOM operations

**Fields**:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| waitFor | number \| 'visible' \| 'hidden' | 0 | Time to wait before action (ms) or condition |
| scrollIntoView | boolean | false | Scroll element into view before action |
| force | boolean | false | Force action even if element not visible |
| timeout | number | 5000 | Operation timeout (ms) |
| delay | number | 0 | Delay between keystrokes for typing (ms) |
| clear | boolean | false | Clear field before typing |
| multiple | boolean | false | Return multiple elements for query |
| includeHidden | boolean | false | Include hidden elements in results |
| button | 'left' \| 'right' \| 'middle' | 'left' | Mouse button for click |
| clickCount | number | 1 | Number of clicks |
| offsetX | number | 0 | X offset from element center for click |
| offsetY | number | 0 | Y offset from element center for click |
| pressEnter | boolean | false | Press Enter after typing |
| pollInterval | number | 100 | Polling interval for wait operations (ms) |

**Validation Rules**:
- `timeout` must be 100-30000ms
- `delay` must be 0-1000ms
- `clickCount` must be 1-3
- `pollInterval` must be 50-1000ms

---

### 6. DOM Element Info

**Purpose**: Information about a DOM element returned by query operations

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tagName | string | Yes | HTML tag name (lowercase) |
| id | string | No | Element ID attribute |
| className | string | No | Element class attribute |
| textContent | string | No | Element text content (truncated to 500 chars) |
| innerHTML | string | No | Element inner HTML (only if requested) |
| attributes | Record<string, string> | Yes | All element attributes |
| boundingBox | BoundingBox | No | Element position and size |
| visible | boolean | Yes | Whether element is visible |
| enabled | boolean | No | Whether element is enabled (for inputs) |
| focused | boolean | No | Whether element has focus |

**BoundingBox**:
```typescript
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}
```

---

## Entity Relationships

```
DOMTool (Background)
    |
    | sends DOM Operation Request
    ↓
Content Script (Page Context)
    |
    | processes operation
    |
    | returns DOM Operation Response
    ↓
DOMTool (Background)
    |
    | updates Content Script State
```

---

## Message Flow Diagrams

### Successful Operation Flow
```
DOMTool                          Content Script
   |                                    |
   |-- DOM_ACTION (query) ------------>|
   |    { selector: ".headline" }      |
   |                                    |--[query DOM]
   |                                    |
   |<-- Response (success) ------------|
   |    { elements: [...], count: 1 }  |
   |                                    |
```

### Error Handling Flow
```
DOMTool                          Content Script
   |                                    |
   |-- DOM_ACTION (click) ------------>|
   |    { selector: ".button" }        |
   |                                    |--[element not found]
   |                                    |
   |<-- Response (error) --------------|
   |    { type: ELEMENT_NOT_FOUND,     |
   |      suggestedAction: "..." }     |
   |                                    |
   |--[classify error]                 |
   |--[return to LLM with context]     |
```

### Content Script Injection Flow
```
DOMTool                          Content Script
   |                                    |
   |--[PING check]                      |
   |    (no response)                   |
   |                                    |
   |--[inject script]                   |
   |                                    |--[initialize]
   |                                    |--[register handlers]
   |                                    |
   |--[PING retry 1] ------------------>|
   |    (timeout)                       |
   |                                    |
   |--[PING retry 2] ------------------>|
   |<-- PONG (ready) -------------------|
   |                                    |
   |--[send actual operation]           |
```

---

## Validation & Constraints

### Message Size Limits
- Maximum message size: 6MB (Chrome limit)
- Recommended maximum: 1MB for performance
- Large results (screenshots, full DOM) should be chunked or stored

### Timeout Constraints
- PING/PONG: 500ms
- Simple operations (query, click): 5s
- Complex operations (snapshot, accessibility tree): 15s
- Total operation time (including retries): 30s

### Rate Limiting
- Maximum 100 operations/second per tab
- Maximum 10 concurrent operations per tab
- Circuit breaker opens after 5 consecutive failures

### Error Recovery
- Retry policy: 3 attempts with exponential backoff
- Retryable errors: TIMEOUT, CONTENT_SCRIPT_NOT_LOADED, CONTEXT_INVALIDATED
- Non-retryable errors: PERMISSION_DENIED, INVALID_SELECTOR, CSP_BLOCKED

---

## Data Persistence

**None Required**: All entities are transient message-passing structures. State is tracked in memory only and reset on:
- Tab navigation
- Extension reload
- Tab closure
- Content script context invalidation

---

**Data Model Complete**: Ready for contract generation
