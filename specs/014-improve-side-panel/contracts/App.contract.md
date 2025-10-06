# Contract: App.svelte

**Component**: `codex-chrome/src/sidepanel/App.svelte`
**Feature**: 014-improve-side-panel
**Date**: 2025-10-06

## Purpose
Main side panel container component. Manages chat state, handles user input, and displays messages/events.

## Modifications for This Feature

### 1. Display User Messages in Dialogue (FR-001, FR-002, FR-005, FR-006)

**Current Behavior**: User messages added to `messages` array but not rendered in UI.

**New Behavior**: Render `messages` array before `processedEvents` in the message container.

**Template Change**:
```svelte
<!-- BEFORE: Lines 219-228 -->
<div class="flex-1 overflow-y-auto mb-4 space-y-2" bind:this={scrollContainer}>
  {#if processedEvents.length === 0}
    <TerminalMessage type="system" content="Welcome to Codex Terminal" />
    <TerminalMessage type="default" content="Ready for input. Type a command to begin..." />
  {/if}

  {#each processedEvents as event (event.id)}
    <EventDisplay {event} />
  {/each}
</div>

<!-- AFTER: Modified template -->
<div class="flex-1 overflow-y-auto mb-4 space-y-2" bind:this={scrollContainer}>
  {#if processedEvents.length === 0 && messages.length === 0}
    <TerminalMessage type="system" content="Welcome to Codex Terminal" />
    <TerminalMessage type="default" content="Ready for input. Type a command to begin..." />
  {/if}

  {#each messages as message (message.timestamp)}
    <TerminalMessage type={message.type === 'user' ? 'input' : getMessageType(message)} content={message.content} />
  {/each}

  {#each processedEvents as event (event.id)}
    <EventDisplay {event} />
  {/each}
</div>
```

**Behavioral Contract**:
- User messages appear BEFORE processed events (chronological order within each array)
- Welcome message hidden if EITHER messages OR processedEvents exist
- Each message keyed by unique timestamp (prevents duplicate key warnings)
- User messages use `type="input"` for TerminalMessage (triggers blue styling)

### 2. Update Branding Label (FR-004)

**Current**: Line 206
```svelte
<TerminalMessage type="system" content="Codex Terminal v1.0.0" />
```

**New**: Line 206
```svelte
<TerminalMessage type="system" content="Codex For Chrome v1.0.0 (By AI Republic)" />
```

**Behavioral Contract**:
- Label updated to new branding string
- No functional changes (still `type="system"`)

### 3. Preserve Existing `sendMessage()` Logic

**Current**: Lines 135-165 (no changes needed)
```typescript
async function sendMessage() {
  if (!inputText.trim() || !isConnected) return;

  const text = inputText.trim();
  inputText = '';

  // Add user message (already exists)
  messages = [...messages, {
    type: 'user',
    content: text,
    timestamp: Date.now(),
  }];

  // Send to agent (already exists)
  try {
    await router.sendSubmission({
      id: `user_${Date.now()}`,
      op: {
        type: 'UserInput',
        items: [{ type: 'text', text }],
      },
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

**Behavioral Contract**: No changes required to `sendMessage()` function. User messages already added to array.

## Input Contract
- **Props**: None (root component)
- **User Interactions**:
  - Text input via TerminalInput component
  - Enter key submits message (via `sendMessage()`)
  - Settings button click (existing functionality)

## Output Contract
- **Visual Updates**:
  - User messages rendered in blue (via TerminalMessage `type="input"`)
  - Messages appear in chronological order
  - Input field outline visible (handled by TerminalInput.svelte)
  - Branding label shows new text
- **Events Emitted**: None (internal state changes only)
- **Side Effects**:
  - UserInput submission sent to MessageRouter (existing)
  - Auto-scroll to bottom if user at bottom (existing)

## State Contract
- **Reactive Variables**:
  - `messages`: Array<ChatMessage> (existing, now rendered)
  - `processedEvents`: ProcessedEvent[] (existing, no changes)
  - `inputText`: string (existing, no changes)
  - `isConnected`: boolean (existing, no changes)
  - `isProcessing`: boolean (existing, no changes)

## Dependencies
- **Modified Components**:
  - TerminalMessage.svelte (must support blue color for `type="input"`)
- **Unmodified Components**:
  - TerminalInput.svelte (outline handled separately)
  - EventDisplay.svelte (no changes)
  - EventProcessor.ts (no changes)

## Error Handling
No new error cases. Existing error handling preserved:
- Empty input validation (existing)
- Connection check before send (existing)
- Message send failure handling (existing)

## Testing Contract

### Unit Tests
```typescript
// tests/sidepanel/App.test.ts
describe('App.svelte - User Message Display', () => {
  it('should render user messages in blue', () => {
    // Given: User submits message
    // When: sendMessage() called
    // Then: Message appears with type="input"
  });

  it('should render messages before processedEvents', () => {
    // Given: Both messages and processedEvents exist
    // When: Component renders
    // Then: messages appear before processedEvents in DOM
  });

  it('should hide welcome message when messages exist', () => {
    // Given: messages.length > 0
    // When: Component renders
    // Then: Welcome message not visible
  });

  it('should display new branding label', () => {
    // Given: Component mounted
    // When: Rendered
    // Then: Label shows "Codex For Chrome v1.0.0 (By AI Republic)"
  });
});
```

### Integration Tests
```typescript
describe('App.svelte - User Input Flow', () => {
  it('should display user input in dialogue after submission', async () => {
    // Given: Side panel open, connected
    // When: User types "test" and presses Enter
    // Then: "test" appears in blue above input field
  });

  it('should preserve user messages when agent events arrive', async () => {
    // Given: User message displayed
    // When: Agent event arrives
    // Then: User message still visible above event
  });
});
```

## Accessibility Contract
- **Keyboard Navigation**: No changes (existing Tab/Enter support preserved)
- **Screen Readers**: Message list remains accessible (proper semantic HTML)
- **Color Contrast**: Blue text meets WCAG AA (7.2:1 ratio on black)

## Performance Contract
- **Render Time**: <16ms for up to 100 messages (unchanged)
- **Memory**: O(n) for n messages (existing behavior)
- **Auto-scroll**: Maintains smooth scroll (existing behavior)

## Breaking Changes
None. This is an additive change (rendering existing data).

## Migration Notes
No migration needed. Existing `messages` array already populated correctly.
