# Data Model: Event Processor

**Feature**: Event Processor for Side Panel UI
**Date**: 2025-09-30

## Overview
Defines the data structures for transforming raw agent events into UI-ready representations. Based on analysis of 30+ event types from protocol/events.ts and patterns from Rust EventProcessorWithHumanOutput.

---

## Core Entities

### 1. ProcessedEvent

**Purpose**: Unified representation of any event after transformation, ready for UI rendering

**Fields**:
```typescript
interface ProcessedEvent {
  // Identity
  id: string;                          // Unique event ID (from Event.id)
  category: EventDisplayCategory;      // Display category
  timestamp: Date;                     // When event occurred

  // Display
  title: string;                       // Header text (e.g., "codex", "exec ls", "tool Read")
  content: string | ContentBlock[];    // Main content (text or structured)
  style: EventStyle;                   // Visual styling category

  // State
  status?: EventStatus;                // For operations: 'running' | 'success' | 'error'
  streaming?: boolean;                 // Is this event still receiving deltas?

  // Metadata
  metadata?: EventMetadata;            // Additional info (duration, tokens, etc.)

  // Interactive
  requiresApproval?: ApprovalRequest;  // For approval events
  collapsible?: boolean;               // Can be collapsed (reasoning, tool output)
  collapsed?: boolean;                 // Current collapse state
}
```

**Relationships**:
- Source: Event from protocol/types.ts
- Rendered by: EventDisplay.svelte
- Created by: EventProcessor.processEvent()

**Validation Rules**:
- id must be non-empty
- category must be valid EventDisplayCategory
- timestamp must be valid Date
- title must be non-empty
- If requiresApproval is set, category must be 'approval'

**State Transitions**:
```
New Event → category='task', streaming=true, status='running'
  ↓ (deltas arrive)
Delta Events → content accumulates, streaming=true
  ↓ (complete event)
Complete Event → streaming=false, status='success'/'error'
```

---

### 2. EventDisplayCategory

**Purpose**: Groups events by display behavior and styling

**Type**:
```typescript
type EventDisplayCategory =
  | 'task'        // TaskStarted, TaskComplete, TaskFailed
  | 'message'     // AgentMessage, AgentMessageDelta
  | 'reasoning'   // AgentReasoning*, 4 types
  | 'tool'        // McpToolCall*, ExecCommand*, WebSearch*, PatchApply*
  | 'output'      // ExecCommandOutputDelta
  | 'error'       // Error, StreamError, TaskFailed
  | 'approval'    // ExecApprovalRequest, ApplyPatchApprovalRequest
  | 'system';     // TokenCount, PlanUpdate, Notification, etc.
```

**Mapping Rules**:
- Each EventMsg.type maps to exactly one category
- Category determines which component renders the event
- Category determines default styling (overridable by EventStyle)

---

### 3. EventStyle

**Purpose**: Visual styling theme for events

**Type**:
```typescript
interface EventStyle {
  // Text
  textColor: ColorClass;      // Tailwind: 'text-green-400', etc.
  textWeight?: FontWeight;    // 'font-normal' | 'font-bold'
  textStyle?: FontStyle;      // 'italic' | 'normal'

  // Container
  bgColor?: ColorClass;       // Background color
  borderColor?: ColorClass;   // Border color

  // Icon
  icon?: IconType;            // Optional icon to display
  iconColor?: ColorClass;     // Icon color
}

type ColorClass = string;  // Tailwind color class
type FontWeight = 'font-normal' | 'font-bold';
type FontStyle = 'italic' | 'normal';
type IconType = 'info' | 'success' | 'error' | 'warning' | 'tool' | 'thinking';
```

**Style Presets** (from Rust owo_colors mapping):
```typescript
const STYLE_PRESETS = {
  task_started: { textColor: 'text-cyan-400', icon: 'info' },
  task_complete: { textColor: 'text-green-400', icon: 'success' },
  task_failed: { textColor: 'text-red-400', icon: 'error' },
  agent_message: { textColor: 'text-purple-400', textStyle: 'italic' },
  reasoning: { textColor: 'text-purple-400', textStyle: 'italic', icon: 'thinking' },
  tool_call: { textColor: 'text-purple-400' },
  tool_success: { textColor: 'text-green-400' },
  tool_error: { textColor: 'text-red-400' },
  error: { textColor: 'text-red-400', textWeight: 'font-bold', icon: 'error' },
  dimmed: { textColor: 'text-gray-500' },
};
```

---

### 4. EventMetadata

**Purpose**: Additional information specific to event types

**Type**:
```typescript
interface EventMetadata {
  // Time & Performance
  duration?: number;              // Operation duration in ms
  startTime?: Date;               // Operation start time
  endTime?: Date;                 // Operation end time

  // Token Usage (TokenCount events)
  tokenUsage?: {
    input: number;
    cached: number;
    output: number;
    reasoning: number;
    total: number;
  };

  // Command Execution
  command?: string;               // Original command
  exitCode?: number;              // Exit code (0 = success)
  workingDir?: string;            // CWD for command

  // Tool Calls
  toolName?: string;              // MCP tool name
  toolParams?: Record<string, any>; // Tool parameters

  // File Operations
  filesChanged?: number;          // Number of files in patch
  diffSummary?: string;           // Patch summary

  // Model Info
  model?: string;                 // Model name
  turnCount?: number;             // Turn number
}
```

---

### 5. OperationState

**Purpose**: Track multi-event operations (Begin → Delta → End)

**Type**:
```typescript
interface OperationState {
  // Identity
  callId: string;                      // Unique operation ID
  type: 'exec' | 'tool' | 'patch';     // Operation type

  // Timing
  startTime: Date;                     // When operation began

  // Content
  buffer: string;                      // Accumulated deltas
  processedEventId?: string;           // ID of ProcessedEvent for this operation

  // Metadata
  metadata: Record<string, any>;       // Type-specific data
}
```

**Lifecycle**:
```
Begin Event → Create OperationState in map
  ↓
Delta Events → Append to buffer
  ↓
End Event → Calculate duration, remove from map
```

**Storage**: Managed by EventProcessor in `Map<callId, OperationState>`

---

### 6. StreamingState

**Purpose**: Track streaming message/reasoning content

**Type**:
```typescript
interface StreamingState {
  // Identity
  type: 'message' | 'reasoning' | 'raw_reasoning';

  // Content
  buffer: string;                      // Accumulated deltas
  processedEventId?: string;           // Associated ProcessedEvent

  // Timing
  startTime: Date;
  lastUpdateTime: Date;

  // Display
  headerShown: boolean;                // Has header been displayed?
}
```

**Rules**:
- Only one StreamingState per type at a time
- Header shown only once (answer_started, reasoning_started from Rust)
- Final event (AgentMessage, AgentReasoning) closes stream

---

### 7. ApprovalRequest

**Purpose**: Data for interactive approval UI

**Type**:
```typescript
interface ApprovalRequest {
  id: string;                          // Approval request ID
  type: 'exec' | 'patch';              // What needs approval

  // Content
  command?: string;                    // For exec approvals
  explanation?: string;                // Why this action

  patch?: {                            // For patch approvals
    path: string;
    diff: string;
  };

  // Response
  onApprove: () => void;               // Callback for approval
  onReject: () => void;                // Callback for rejection
  onRequestChange?: () => void;        // Optional: request changes
}
```

**Validation**:
- Either command OR patch must be set (never both)
- Callbacks must be provided
- id must match submission ID for response correlation

---

### 8. ContentBlock

**Purpose**: Structured content for rich formatting (code, diffs, etc.)

**Type**:
```typescript
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'diff'; additions: string[]; deletions: string[]; context: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };
```

**Usage**:
- ProcessedEvent.content can be string or ContentBlock[]
- EventDisplay.svelte renders appropriate component for each block type
- Enables syntax highlighting, diff coloring, etc.

---

## Data Flow

### Event Processing Pipeline

```
1. Raw Event (protocol/events.ts)
   ↓
2. EventProcessor.processEvent()
   - Determine category
   - Check for streaming/operation state
   - Extract content & metadata
   - Apply formatting
   ↓
3. ProcessedEvent
   ↓
4. EventDisplay.svelte
   - Select component based on category
   - Apply styling
   - Render content
   ↓
5. User sees formatted event in UI
```

### Multi-Event Operations

```
ExecCommandBegin
   ↓ Create OperationState
ExecCommandOutputDelta (×N)
   ↓ Append to buffer in OperationState
ExecCommandEnd
   ↓ Calculate duration, create ProcessedEvent, remove OperationState
```

### Streaming Messages

```
AgentMessageDelta (first)
   ↓ Create StreamingState, show header
AgentMessageDelta (×N)
   ↓ Append to buffer
AgentMessage
   ↓ Create ProcessedEvent with full content, clear StreamingState
```

---

## Validation & Constraints

### Event Processing Rules

1. **Idempotency**: Processing same event twice produces same ProcessedEvent
2. **Order Independence**: Events can arrive out of order (handle gracefully)
3. **Missing Call IDs**: If End event arrives without Begin, show with "unknown operation" label
4. **Unknown Event Types**: Create generic ProcessedEvent with category='system'
5. **Content Length**: Truncate extremely long content (>10,000 chars) with "... (truncated)" indicator

### Performance Constraints

1. **Processing Time**: <5ms per event for transformation
2. **Memory**: ProcessedEvents should be lightweight (<1KB each)
3. **Operation Map Size**: Limit to 100 concurrent operations (warn if exceeded)
4. **Buffer Size**: Limit StreamingState buffer to 100KB (prevents memory leak)

---

## Type Definitions Location

```typescript
// codex-chrome/src/types/ui.ts
export {
  ProcessedEvent,
  EventDisplayCategory,
  EventStyle,
  EventMetadata,
  OperationState,
  StreamingState,
  ApprovalRequest,
  ContentBlock,
  // ... supporting types
};
```

---

## Examples

### Example 1: Simple Agent Message

**Input Event**:
```typescript
{
  id: 'evt_123',
  msg: {
    type: 'AgentMessage',
    data: { message: 'I will help you with that task.' }
  }
}
```

**Output ProcessedEvent**:
```typescript
{
  id: 'evt_123',
  category: 'message',
  timestamp: new Date('2025-09-30T14:23:45'),
  title: 'codex',
  content: 'I will help you with that task.',
  style: {
    textColor: 'text-purple-400',
    textStyle: 'italic'
  },
  streaming: false,
  collapsible: false
}
```

---

### Example 2: Command Execution Sequence

**Input Events**:
```typescript
// Event 1
{ id: 'evt_200', msg: { type: 'ExecCommandBegin', data: {
  call_id: 'exec_001',
  command: 'ls -la',
  cwd: '/home/user'
}}}

// Event 2-5: Deltas
{ id: 'evt_201', msg: { type: 'ExecCommandOutputDelta', data: {
  session_id: 'exec_001',
  output: 'total 48\n',
  stream: 'stdout'
}}}
// ... more deltas

// Event 6
{ id: 'evt_205', msg: { type: 'ExecCommandEnd', data: {
  session_id: 'exec_001',
  exit_code: 0,
  duration_ms: 42
}}}
```

**Output ProcessedEvent** (created on ExecCommandEnd):
```typescript
{
  id: 'evt_205',
  category: 'tool',
  timestamp: new Date('2025-09-30T14:23:47'),
  title: 'exec ls -la',
  content: 'total 48\ndrwxr-xr-x  5 user user  4096 Sep 30 14:23 .\n...',
  style: {
    textColor: 'text-green-400',
    icon: 'success'
  },
  status: 'success',
  metadata: {
    command: 'ls -la',
    exitCode: 0,
    workingDir: '/home/user',
    duration: 42
  },
  collapsible: true,
  collapsed: false
}
```

---

### Example 3: Error Event

**Input Event**:
```typescript
{
  id: 'evt_500',
  msg: {
    type: 'Error',
    data: { message: 'Failed to connect to model API' }
  }
}
```

**Output ProcessedEvent**:
```typescript
{
  id: 'evt_500',
  category: 'error',
  timestamp: new Date('2025-09-30T14:24:10'),
  title: 'ERROR',
  content: 'Failed to connect to model API',
  style: {
    textColor: 'text-red-400',
    textWeight: 'font-bold',
    icon: 'error',
    borderColor: 'border-red-400'
  },
  status: 'error',
  collapsible: false
}
```

---

## Migration & Compatibility

### From Current Implementation

**Current App.svelte Event Handling**:
```typescript
// Old (line 69-98)
switch (msg.type) {
  case 'AgentMessage':
    messages = [...messages, { type: 'agent', content: msg.data.message, ... }];
}
```

**New EventProcessor Pattern**:
```typescript
// New
const processed = eventProcessor.processEvent(event);
processedEvents = [...processedEvents, processed];
```

**Migration Strategy**:
1. Add EventProcessor alongside existing handleEvent()
2. Gradually migrate event types from switch to processor
3. Remove old switch statement when all types migrated
4. Existing message format is compatible (can coexist during migration)

---

## Testing Considerations

### Unit Test Data

Create fixtures for each event type:
```typescript
// tests/fixtures/events.ts
export const MOCK_EVENTS = {
  agentMessage: { id: 'test_1', msg: { type: 'AgentMessage', ... } },
  execBegin: { id: 'test_2', msg: { type: 'ExecCommandBegin', ... } },
  // ... all 30+ types
};

export const EXPECTED_PROCESSED = {
  agentMessage: { id: 'test_1', category: 'message', ... },
  // ... expected outputs
};
```

### Edge Cases to Test

1. Missing call_id in End event (orphaned operation)
2. Duplicate Begin events with same call_id (should warn/replace)
3. Delta events for non-existent operation (should buffer or discard)
4. Extremely long content (>100KB)
5. Malformed event data (missing required fields)
6. Rapid streaming (100 deltas in 1 second)
7. Out-of-order events (End before Begin)

---

**Status**: ✅ Data Model Complete - Ready for Contract Generation
