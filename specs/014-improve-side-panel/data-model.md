# Data Model: Side Panel UI Improvements

**Feature**: 014-improve-side-panel
**Date**: 2025-10-06

## Overview
This feature involves UI-only changes with no persistent storage. This document describes the in-memory state structures used for rendering user messages.

## State Entities

### ChatMessage (In-Memory)
Represents a single message in the chat dialogue (user or agent).

**Location**: `codex-chrome/src/sidepanel/App.svelte` (line 16)

**Type Definition**:
```typescript
interface ChatMessage {
  type: 'user' | 'agent';
  content: string;
  timestamp: number;
}
```

**Fields**:
- `type`: Discriminator for message source
  - `'user'`: Message typed by the user
  - `'agent'`: Response from the agent (legacy system)
- `content`: Text content of the message
- `timestamp`: Unix timestamp (milliseconds) when message was created

**State Management**:
- Stored in Svelte reactive array: `let messages: Array<ChatMessage> = []`
- Updated via: `messages = [...messages, newMessage]` (immutable updates for reactivity)
- Cleared on session reset (side panel mount)

**Usage**:
- User messages: Added in `sendMessage()` function before sending to agent
- Agent messages: Added in `handleEvent()` for legacy `AgentMessage` events
- Rendered: Iterated in App.svelte template alongside `processedEvents`

### ProcessedEvent (Existing, No Changes)
Represents agent events processed by EventProcessor.

**Location**: `codex-chrome/src/types/ui.ts`

**Type Definition** (for reference):
```typescript
interface ProcessedEvent {
  id: string;
  timestamp: number;
  type: string;
  // ... other fields specific to event types
}
```

**Relationship to ChatMessage**:
- `ProcessedEvent` is used for NEW event system (EventDisplay components)
- `ChatMessage` is used for LEGACY message system (user input + old agent messages)
- Both are rendered in the same UI container but from separate arrays

## UI State Structure

### Complete Message Display State
The side panel combines two message sources:

```typescript
// In App.svelte
let messages: Array<ChatMessage> = [];           // Legacy: user input + old agent messages
let processedEvents: ProcessedEvent[] = [];      // New: agent events from EventProcessor
```

**Rendering Order** (chronological):
1. Check if `processedEvents.length === 0` (show welcome message)
2. Render `messages` array (user messages in blue, agent messages in default)
3. Render `processedEvents` array (via EventDisplay components)

**State Lifecycle**:
- **onMount**: Both arrays cleared to reset session
- **User Input**: New ChatMessage added to `messages`
- **Agent Event**: EventProcessor creates ProcessedEvent, added to `processedEvents`
- **Task Started**: `processedEvents` cleared, `messages` preserved (user can see their input history)

## Styling State

### Color Theme Variables
**Location**: `codex-chrome/src/sidepanel/styles.css`

**New Variable**:
```css
@theme {
  --color-term-blue: #60a5fa;  /* NEW: User message color */
  /* ... existing variables ... */
}
```

**Usage**: Applied to user messages via `.text-term-blue` utility class

## Data Flow

```
User types in TerminalInput
    ↓
sendMessage() called
    ↓
messages = [...messages, { type: 'user', content, timestamp }]
    ↓
Svelte reactivity triggers re-render
    ↓
Template iterates messages array
    ↓
TerminalMessage renders with type="user"
    ↓
Blue color applied via conditional class
```

## Validation Rules
- `content`: Must be non-empty string (trimmed in `sendMessage()`)
- `timestamp`: Must be valid Unix timestamp (generated via `Date.now()`)
- `type`: Must be literal 'user' or 'agent' (TypeScript enforces)

## State Persistence
- **In-Memory Only**: No persistence to IndexedDB or chrome.storage
- **Session Scope**: Cleared when side panel closes/reopens
- **Rationale**: Chat history is transient UI state, not conversation history (RolloutRecorder handles persistence)

## Relationship to Existing Systems

### EventProcessor Integration
- **Separate Concerns**: EventProcessor handles agent Events, not user input
- **No Changes Needed**: EventProcessor.ts remains untouched
- **Parallel Rendering**: Both systems coexist in the UI

### MessageRouter Integration
- **No Changes Needed**: MessageRouter already handles UserInput submissions
- **User messages are NOT Events**: They don't flow through EventProcessor
- **One-way flow**: User input → MessageRouter → Backend (no event back for user message itself)

## Migration Notes
This feature does NOT change any data structures, only adds rendering logic for existing `messages` array that was previously unused in the UI.

**Before**: `messages` array populated but never rendered
**After**: `messages` array rendered alongside `processedEvents`

## Future Considerations
- If chat history persistence is needed, integrate with RolloutRecorder (Feature 005)
- If user messages need event-like properties, create synthetic UserMessageEvent type
- If message list grows large, implement virtualization (not needed for v1.0.0)
