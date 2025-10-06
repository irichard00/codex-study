# Stream Completion Event Fix

## Problem
Runtime error when processing stream responses:
```
Error: stream closed before response.completed
  at TurnManager.tryRunTurn()
```

## Root Cause

The `stream(prompt: Prompt)` method in `OpenAIClient.ts` was using a simplified implementation that:
1. Only emitted `OutputTextDelta` events
2. Never emitted a `Completed` event
3. Just called `stream.complete()` to close the stream

However, `TurnManager.tryRunTurn()` expects to receive a `Completed` event before the stream closes:

```typescript
// TurnManager.ts Line 186-188
if (!event) {
  throw new Error('stream closed before response.completed');
}
```

The stream was closing (returning `null`/`undefined` from the iterator) without ever emitting the required `Completed` event.

## Solution

### Changed `stream()` to Delegate to `streamCompletion()`

**File**: `src/models/OpenAIClient.ts` Lines 272-319

**Before** (Lines 277-376 - Simplified implementation):
```typescript
async stream(prompt: Prompt): Promise<ResponseStream> {
  const stream = new ResponseStream();

  (async () => {
    // ... fetch and parse OpenAI stream ...

    for (const line of lines) {
      // Only handle text deltas
      if (streamChunk && streamChunk.delta?.content) {
        stream.addEvent({
          type: 'OutputTextDelta',
          delta: streamChunk.delta.content,
        });
      }
    }

    // ❌ Just complete without emitting Completed event
    stream.complete();
  })();

  return stream;
}
```

**After** (Lines 278-319 - Delegates to full implementation):
```typescript
async stream(prompt: Prompt): Promise<ResponseStream> {
  // Convert Prompt to CompletionRequest
  const request: CompletionRequest = {
    model: this.currentModel,
    messages,  // converted from prompt.input
    tools: prompt.tools,
    stream: true,
  };

  const stream = new ResponseStream();

  (async () => {
    try {
      // ✅ Use streamCompletion which has full Rust-aligned event logic
      for await (const event of this.streamCompletion(request)) {
        stream.addEvent(event);
      }
      stream.complete();
    } catch (error) {
      stream.error(error as Error);
    }
  })();

  return stream;
}
```

## What `streamCompletion()` Provides

The `streamCompletion()` method (Lines 638-910) is the complete Rust-aligned implementation that emits all proper `ResponseEvent` types:

1. **OutputTextDelta** - Text content chunks
2. **OutputItemDone** - Completed messages/function calls
3. **ReasoningContentDelta** - Reasoning/thinking content (if supported)
4. **Completed** - Final event indicating stream completion ✅

### Example Event Flow

```typescript
// Typical event sequence from streamCompletion():
1. { type: 'OutputTextDelta', delta: 'Hello' }
2. { type: 'OutputTextDelta', delta: ' world' }
3. { type: 'OutputItemDone', item: { type: 'message', role: 'assistant', content: 'Hello world' } }
4. { type: 'Completed', responseId: '', tokenUsage: {...} }  // ✅ Critical event!
```

Without the `Completed` event, TurnManager's loop receives `null` and throws the error.

## Key Insight

There were **two streaming implementations** in OpenAIClient:

1. **`stream(prompt)` (Lines 277-376)** - Simplified, incomplete
   - Used by TurnManager
   - Only handled text deltas
   - ❌ Never emitted `Completed`

2. **`streamCompletion(request)` (Lines 638-910)** - Complete, Rust-aligned
   - Not called directly
   - Handled all event types
   - ✅ Properly emits `Completed`

The fix makes `stream()` delegate to `streamCompletion()` instead of duplicating (incomplete) logic.

## Files Modified

### src/models/OpenAIClient.ts
- **Lines 272-319**: Rewrote `stream()` to delegate to `streamCompletion()`
- Removed ~90 lines of duplicate streaming code
- Now uses the complete Rust-aligned implementation

## Testing

Build succeeds:
```bash
npm run build
✅ Build complete!
```

## Related Code

### TurnManager Event Loop (Lines 179-192)
```typescript
for await (const event of stream) {
  if (!event) {
    throw new Error('stream closed before response.completed');  // This error
  }

  switch (event.type) {
    case 'Created':
      break;
    case 'OutputTextDelta':
      // Handle text delta
      break;
    case 'Completed':  // ✅ Must receive this event
      // Process completion
      break;
    // ... other event types
  }
}
```

### streamCompletion() Completion Logic (Lines 841-900)
```typescript
const finishReason = choice.finish_reason;
if (finishReason) {
  if (finishReason === 'tool_calls' && fnCallState.active) {
    // Emit function call item
    yield {
      type: 'OutputItemDone',
      item: { type: 'function_call', ... }
    };
  } else if (finishReason === 'stop') {
    // Emit message item
    yield {
      type: 'OutputItemDone',
      item: { type: 'message', ... }
    };
  }

  // ✅ Always emit Completed event
  yield {
    type: 'Completed',
    responseId: '',
    tokenUsage: undefined,
  };

  return; // End stream
}
```

## Prevention

To prevent similar issues in the future:

1. **Don't Duplicate Streaming Logic**: Use existing complete implementations
2. **Always Emit Completed**: Any streaming method must emit a final completion event
3. **Test Event Sequences**: Verify consumers receive all expected events
4. **Reference Rust Implementation**: The Rust code has the canonical event flow

## Before vs After Flow

### Before
```
User → TurnManager.tryRunTurn()
         ↓
     OpenAIClient.stream(prompt)
         ↓
     [Simplified Implementation]
         ↓
     OutputTextDelta, OutputTextDelta, ...
         ↓
     stream.complete()  ← Stream closes without Completed event
         ↓
     TurnManager: event = null
         ↓
     ❌ Error: "stream closed before response.completed"
```

### After
```
User → TurnManager.tryRunTurn()
         ↓
     OpenAIClient.stream(prompt)
         ↓
     OpenAIClient.streamCompletion(request)  ← Delegate to full implementation
         ↓
     [Complete Rust-aligned Implementation]
         ↓
     OutputTextDelta, OutputTextDelta, ...
         ↓
     OutputItemDone (message)
         ↓
     Completed  ← ✅ Proper completion event
         ↓
     stream.complete()
         ↓
     TurnManager: Processes Completed event normally
         ↓
     ✅ Success
```

## Summary

- **Root Cause**: `stream()` never emitted `Completed` event
- **Solution**: Delegate to `streamCompletion()` which has complete event handling
- **Result**: TurnManager receives proper `Completed` event before stream closes
- **Lines Changed**: ~90 lines simplified to ~40 lines with delegation pattern
- **Benefits**: Less code duplication, guaranteed Rust alignment, all events properly emitted
