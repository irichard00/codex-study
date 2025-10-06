# UI Rendering Debug - OutputTextDelta Not Showing

## Problem
OutputTextDelta events are being emitted by the model client but not rendering in the side panel UI.

## Event Flow (Expected)
1. **OpenAIClient.streamCompletion()** emits `OutputTextDelta` events as tokens stream in
2. **TurnManager** receives OutputTextDelta and emits `AgentMessageDelta` events to UI
3. **EventProcessor** accumulates AgentMessageDelta in buffer but returns `null` (no display yet)
4. **OpenAIClient.streamCompletion()** finishes and emits `OutputItemDone` with message item
5. **TurnManager.handleResponseItem()** calls `mapResponseItemToEventMessages()` for message item
6. **mapResponseItemToEventMessages()** finds `output_text` ContentItem and creates `AgentMessage` event
7. **TurnManager** emits the `AgentMessage` event
8. **EventProcessor** receives `AgentMessage`, flushes accumulated buffer, and displays content to UI

## Debug Logging Added

### TurnManager.ts (lines 535, 540)
```typescript
console.log(`[handleResponseItem] Processing ${item.type} item, mapped to ${eventMsgs.length} events:`, eventMsgs.map(e => e.type));
console.log(`[handleResponseItem] Emitting event: ${msg.type}`, msg.data);
```

### EventProcessor.ts (lines 194, 207, 219)
```typescript
console.log('[EventProcessor] Creating new streaming state for AgentMessageDelta');
console.log(`[EventProcessor] Accumulated AgentMessageDelta, buffer length: ${state.buffer.length}`);
console.log(`[EventProcessor] AgentMessage received, content length: ${content.length}, buffer length: ${state?.buffer?.length || 0}`);
```

## What to Check in Console

### 1. Verify OutputItemDone is Processed
Look for:
```
[handleResponseItem] Processing message item, mapped to 1 events: ['AgentMessage']
```

This confirms that when `OutputItemDone` with a message item arrives, `mapResponseItemToEventMessages()` creates an `AgentMessage` event.

### 2. Verify AgentMessage is Emitted
Look for:
```
[handleResponseItem] Emitting event: AgentMessage {message: '...'}
```

This confirms TurnManager actually emits the `AgentMessage` event to the UI.

### 3. Verify EventProcessor Receives AgentMessage
Look for:
```
[EventProcessor] AgentMessage received, content length: 123, buffer length: 123
```

This confirms EventProcessor receives the `AgentMessage` event and has accumulated deltas in buffer.

### 4. Check for Missing AgentMessage
If you see:
- ✅ AgentMessageDelta accumulation logs (buffer growing)
- ❌ No AgentMessage received log

Then the problem is that `OutputItemDone` is not triggering `AgentMessage` emission.

### 5. Check Message Item Structure
If AgentMessage is not being emitted, verify the message item structure in `streamCompletion()`:
```typescript
{
  type: 'OutputItemDone',
  item: {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: assistantText }], // Must be array!
  },
}
```

## Expected Console Output Sequence

```
[OpenAIClient.stream] Event 1: OutputTextDelta
[EventProcessor] Creating new streaming state for AgentMessageDelta
[EventProcessor] Accumulated AgentMessageDelta, buffer length: 10

[OpenAIClient.stream] Event 2: OutputTextDelta
[EventProcessor] Accumulated AgentMessageDelta, buffer length: 25

... (more deltas) ...

[streamCompletion] Received [DONE], emitting final events
[streamCompletion] Emitting final OutputItemDone (message)

[handleResponseItem] Processing message item, mapped to 1 events: ['AgentMessage']
[handleResponseItem] Emitting event: AgentMessage {message: 'Full response text'}

[EventProcessor] AgentMessage received, content length: 150, buffer length: 150
```

## Key Files

- **src/models/OpenAIClient.ts**: Lines 866-896 (streamCompletion OutputItemDone emission)
- **src/core/TurnManager.ts**:
  - Lines 529-545 (handleResponseItem message processing)
  - Lines 196-204 (OutputItemDone case in tryRunTurn)
- **src/core/events/EventMapping.ts**: Lines 19-77 (mapResponseItemToEventMessages)
- **src/sidepanel/components/event_display/EventProcessor.ts**: Lines 188-234 (AgentMessageDelta/AgentMessage handling)

## Next Steps

1. **Reload the extension** with the debug logging
2. **Test with a simple prompt** (e.g., "Hello")
3. **Check console** for the log sequence above
4. **Identify where the flow breaks**:
   - If AgentMessageDelta accumulates but no AgentMessage arrives → OutputItemDone not triggering mapResponseItemToEventMessages
   - If AgentMessage is emitted but EventProcessor doesn't receive it → Event routing issue
   - If EventProcessor receives AgentMessage but doesn't display → ProcessedEvent not being added to UI

## Potential Issues

### Issue 1: OutputItemDone Not Calling handleResponseItem
**Location**: TurnManager.ts line 196-204
**Check**: Verify that when `event.type === 'OutputItemDone'`, it calls `this.handleResponseItem(event.item)`

### Issue 2: mapResponseItemToEventMessages Returns Empty Array
**Location**: EventMapping.ts line 32-60
**Check**: Verify that message items with `output_text` ContentItem create AgentMessage events
**Common Cause**: Content array is empty or contains wrong ContentItem type

### Issue 3: Event Not Reaching EventProcessor
**Check**: Verify event routing from Session → UI
**Common Cause**: Event listener not attached or event type mismatch

### Issue 4: EventProcessor Not Displaying ProcessedEvent
**Check**: Verify that when EventProcessor returns ProcessedEvent, it's added to UI component
**Common Cause**: UI component not reacting to new ProcessedEvent

## Success Criteria

✅ Console shows AgentMessageDelta accumulation
✅ Console shows AgentMessage emission after OutputItemDone
✅ Console shows EventProcessor receiving AgentMessage
✅ Side panel UI displays the full response text
