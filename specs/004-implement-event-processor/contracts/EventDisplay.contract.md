# EventDisplay Component Contract

## Overview
The EventDisplay Svelte component renders ProcessedEvent objects in the side panel UI. It selects appropriate child components based on event category and handles interaction behaviors.

## Component API

### Props

```typescript
interface EventDisplayProps {
  /** The processed event to display */
  event: ProcessedEvent;

  /** Whether this event is currently selected/focused (optional) */
  selected?: boolean;

  /** Callback when event is clicked (optional) */
  onClick?: (event: ProcessedEvent) => void;

  /** Callback when collapse state changes (optional) */
  onToggleCollapse?: (event: ProcessedEvent, collapsed: boolean) => void;
}
```

### Events

```typescript
/** Emitted when user clicks on the event */
dispatch('click', { event: ProcessedEvent });

/** Emitted when user toggles collapse state */
dispatch('toggleCollapse', { event: ProcessedEvent, collapsed: boolean });

/** Emitted when approval action is taken */
dispatch('approval', { event: ProcessedEvent, decision: 'approve' | 'reject' | 'change' });
```

## Rendering Contract

### Category-Based Component Selection

The component MUST render different child components based on `event.category`:

| Category    | Component             | Description                        |
|-------------|-----------------------|------------------------------------|
| `task`      | TaskEvent.svelte      | Task lifecycle indicators          |
| `message`   | MessageEvent.svelte   | Agent messages (with streaming)    |
| `reasoning` | ReasoningEvent.svelte | Agent thinking process (collapsible) |
| `tool`      | ToolCallEvent.svelte  | Tool execution with metadata       |
| `output`    | OutputEvent.svelte    | Terminal-style output              |
| `error`     | ErrorEvent.svelte     | Error display with prominence      |
| `approval`  | ApprovalEvent.svelte  | Interactive approval UI            |
| `system`    | SystemEvent.svelte    | System notifications               |

### Styling Requirements

1. **Base Container**:
   - Apply event.style.textColor to text
   - Apply event.style.bgColor to background
   - Apply event.style.borderColor to left border
   - Add hover effect (subtle background change)
   - Add selected state styling if selected prop is true

2. **Timestamp Display**:
   - Show relative time by default: formatTime(event.timestamp, 'relative')
   - Show absolute time on hover (tooltip or title attribute)
   - Use dimmed text color (text-gray-500)

3. **Title Formatting**:
   - Apply event.style.textWeight (font-bold if specified)
   - Apply event.style.textStyle (italic if specified)
   - Show event.style.icon if present (before title)

4. **Content Rendering**:
   - If content is string: Render as markdown with syntax highlighting
   - If content is ContentBlock[]: Render each block with appropriate component
   - Preserve whitespace for code/command content
   - Apply word-wrap for long text

5. **Collapsible Behavior**:
   - If event.collapsible is true:
     - Show expand/collapse icon
     - Hide content when event.collapsed is true
     - Show content when event.collapsed is false
     - Toggle on header click
   - If event.collapsible is false:
     - Do not show expand/collapse UI
     - Always show content

6. **Streaming Indicator**:
   - If event.streaming is true:
     - Show animated cursor at end of content
     - Add subtle pulse animation to container
   - If event.streaming is false:
     - No streaming indicators

## Accessibility Contract

1. **Keyboard Navigation**:
   - Event container must be focusable (tabindex="0")
   - Enter/Space toggles collapse if collapsible
   - Arrow keys navigate between events

2. **Screen Readers**:
   - Use semantic HTML (article for container)
   - Add aria-label with event category and title
   - Add aria-expanded for collapsible events
   - Add role="status" for streaming events

3. **Color Contrast**:
   - All text must meet WCAG AA contrast ratio (4.5:1)
   - Error events must be distinguishable without color (icon + bold)

## Performance Contract

1. **Rendering**:
   - Initial render: <16ms (60fps)
   - Re-render on prop change: <8ms
   - No unnecessary re-renders (use proper reactivity)

2. **Memory**:
   - Component instance: <10KB
   - No memory leaks on unmount
   - Clean up event listeners

3. **Virtual Scrolling**:
   - Support for windowed rendering (only render visible events)
   - Maintain scroll position on new events
   - Auto-scroll to latest event when at bottom

## Behavioral Tests

### Test 1: Render Simple Message Event
```typescript
const event: ProcessedEvent = {
  id: 'evt_1',
  category: 'message',
  timestamp: new Date(),
  title: 'codex',
  content: 'Hello world',
  style: { textColor: 'text-purple-400', textStyle: 'italic' }
};

// Expected: MessageEvent component rendered with purple italic text
```

### Test 2: Toggle Collapsible Event
```typescript
const event: ProcessedEvent = {
  id: 'evt_2',
  category: 'tool',
  timestamp: new Date(),
  title: 'exec ls',
  content: 'file1\nfile2\nfile3',
  style: { textColor: 'text-green-400' },
  collapsible: true,
  collapsed: false
};

// User clicks header
// Expected: collapsed becomes true, content hidden, toggleCollapse event emitted
```

### Test 3: Show Streaming Indicator
```typescript
const event: ProcessedEvent = {
  id: 'evt_3',
  category: 'message',
  timestamp: new Date(),
  title: 'codex',
  content: 'Generating response...',
  style: { textColor: 'text-purple-400' },
  streaming: true
};

// Expected: Animated cursor after content, pulsing container
```

### Test 4: Handle Approval Event
```typescript
const event: ProcessedEvent = {
  id: 'evt_4',
  category: 'approval',
  timestamp: new Date(),
  title: 'Approval Required',
  content: 'exec rm -rf /',
  style: { textColor: 'text-yellow-400' },
  requiresApproval: {
    id: 'approval_1',
    type: 'exec',
    command: 'rm -rf /',
    explanation: 'This will delete all files',
    onApprove: () => {},
    onReject: () => {}
  }
};

// Expected: ApprovalEvent component with approve/reject buttons
// User clicks approve -> onApprove called, approval event emitted
```

### Test 5: Truncate Long Content
```typescript
const longContent = 'line\n'.repeat(100); // 100 lines
const event: ProcessedEvent = {
  id: 'evt_5',
  category: 'output',
  timestamp: new Date(),
  title: 'exec output',
  content: longContent,
  style: { textColor: 'text-gray-400' }
};

// Expected: First 20 lines shown, "... (80 more lines)" indicator
// Optional: "Show all" button to expand
```

## Error Handling Contract

1. **Missing Required Props**:
   - If event prop is missing: Show error placeholder, do not crash

2. **Malformed Event Data**:
   - If event.category is invalid: Default to 'system' category
   - If event.content is null/undefined: Show "(no content)"
   - If event.timestamp is invalid: Use current time

3. **Component Errors**:
   - Wrap child components in error boundaries
   - Show fallback UI if child component throws
   - Log errors to console for debugging

## Integration Points

### With App.svelte
```typescript
// App.svelte receives events from MessageRouter
handleEvent(event: Event) {
  const processed = eventProcessor.processEvent(event);
  if (processed) {
    processedEvents = [...processedEvents, processed];
  }
}

// Renders events
{#each processedEvents as event}
  <EventDisplay {event} />
{/each}
```

### With EventProcessor
```typescript
// EventProcessor transforms events
const processed = eventProcessor.processEvent(rawEvent);
// EventDisplay renders transformed event
```

### With Child Components
```typescript
// EventDisplay delegates to category-specific component
{#if event.category === 'message'}
  <MessageEvent {event} />
{:else if event.category === 'tool'}
  <ToolCallEvent {event} />
{/if}
```

## Visual Examples

### Message Event
```
┌─────────────────────────────────────────┐
│ [2s ago] codex                          │ <- italic purple
│ I'll help you with that task.          │ <- normal text
└─────────────────────────────────────────┘
```

### Tool Event (Collapsed)
```
┌─────────────────────────────────────────┐
│ [5s ago] ▶ exec ls -la (succeeded in 42ms) │ <- green with icon
└─────────────────────────────────────────┘
```

### Tool Event (Expanded)
```
┌─────────────────────────────────────────┐
│ [5s ago] ▼ exec ls -la (succeeded in 42ms) │ <- green
│ total 48                                │ <- dimmed output
│ drwxr-xr-x  5 user user  4096 Sep 30   │
│ ...                                     │
└─────────────────────────────────────────┘
```

### Error Event
```
┌─────────────────────────────────────────┐
│ ⚠ [1m ago] ERROR                        │ <- red bold with icon
│ Failed to connect to model API         │ <- red text
└─────────────────────────────────────────┘
```

### Streaming Event
```
┌─────────────────────────────────────────┐
│ [just now] codex                        │ <- purple italic
│ Generating a response about...▊        │ <- blinking cursor
└─────────────────────────────────────────┘
   ↑ subtle pulse animation
```

---

**Status**: ✅ Contract Complete - Ready for Implementation
