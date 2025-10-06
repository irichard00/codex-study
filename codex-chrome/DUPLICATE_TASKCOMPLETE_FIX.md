# Duplicate TaskComplete Display Fix

## Problem
Three identical "Task complete" messages were appearing in the side panel UI after each turn:
```
Task complete
success
Task completed in 0 turn(s)

Task complete
success
Task completed in 0 turn(s)

Task complete
success
Task completed in 0 turn(s)
```

## Root Cause
The `TaskComplete` event was being processed by **both**:
1. **EventProcessor** - Creates inline display in the event stream
2. **UserNotifier** - Creates system notifications via `notifySuccess()` or `notifyAgentTurnComplete()`

Both were rendering displays in the UI, creating duplicate entries.

## Architecture Issue

### EventProcessor (Correct - Inline Display)
Location: `src/sidepanel/components/event_display/EventProcessor.ts` lines 308-339

```typescript
if (msg.type === 'TaskComplete') {
  const tokenUsage = msg.data.token_usage?.total;
  let content = `Task completed in ${msg.data.turn_count || 0} turn(s)`;

  return {
    id: event.id,
    category: 'task',
    timestamp: new Date(),
    title: 'Task complete',
    content,
    style: STYLE_PRESETS.task_complete,
    status: 'success',
    collapsible: false,
  };
}
```

This creates a **ProcessedEvent** that's added to the event display list in the side panel.

### UserNotifier (Incorrect - Duplicate Display)
Location: `src/core/UserNotifier.ts` lines 659-678 (BEFORE FIX)

```typescript
case 'TaskComplete':
  const data = eventMsg.data as any;
  if (data?.turn_id && data?.input_messages) {
    await this.notifyAgentTurnComplete(
      data.turn_id,
      data.input_messages,
      data.last_agent_message
    );
  } else {
    await this.notifySuccess('Task Completed', 'Task completed successfully');
  }
  break;
```

Both `notifyAgentTurnComplete()` and `notifySuccess()` call `notify()` which creates **another notification** that gets displayed in the UI.

## The Fix

### Disabled UserNotifier's TaskComplete Handling
Location: `src/core/UserNotifier.ts` lines 659-678 (AFTER FIX)

```typescript
case 'TaskComplete':
  // TaskComplete events are handled by EventProcessor for inline display
  // UserNotifier should only handle system-level notifications
  // Commenting out to avoid duplicate displays in the UI
  /*
  // Enhanced to match Rust implementation
  const data = eventMsg.data as any;
  if (data?.turn_id && data?.input_messages) {
    await this.notifyAgentTurnComplete(
      data.turn_id,
      data.input_messages,
      data.last_agent_message
    );
  } else {
    await this.notifySuccess('Task Completed', 'Task completed successfully');
  }
  */
  break;
```

## Why This is Correct

### UserNotifier's Purpose
UserNotifier is designed for **system-level notifications** such as:
- Browser notifications (via chrome.notifications API)
- Native messaging notifications
- External command notifications

It's NOT meant for inline UI displays in the event stream.

### EventProcessor's Purpose
EventProcessor is designed to:
- Convert EventMsg to ProcessedEvent for display
- Manage streaming state
- Create inline displays in the side panel event list

This is the correct place for displaying TaskComplete events.

## Event Flow (After Fix)

```
TaskRunner.run()
  ↓
TaskRunner.emitTaskComplete()
  ↓
Session.emitEvent({ type: 'TaskComplete', data: {...} })
  ↓
┌─────────────────────────┬─────────────────────────┐
│ UserNotifier            │ EventProcessor          │
│ (DISABLED)              │ (ACTIVE)                │
│ - No display            │ - Creates ProcessedEvent│
│ - Could send browser    │ - Adds to event list    │
│   notification          │ - Shows in UI ✅         │
└─────────────────────────┴─────────────────────────┘
```

## Result

**Before Fix**: 3 duplicate "Task complete" displays
**After Fix**: 1 clean "Task complete" display ✅

## Files Modified

### src/core/UserNotifier.ts
- **Lines 659-678**: Commented out TaskComplete handling
- **Reason**: Prevents duplicate displays in the UI
- **Note**: Could be re-enabled later for browser notifications if needed

## Similar Events to Review

Other events that might have similar duplication issues:
- `TaskFailed` - Currently handled by both (line 680 in UserNotifier)
- `TaskStarted` - Check if duplicated
- `TurnAborted` - Check if duplicated

These should be reviewed to ensure they follow the same pattern:
- **EventProcessor**: Inline display
- **UserNotifier**: System notifications only (if needed)

## Testing

### Verification Steps
1. Reload the extension
2. Send a message
3. Wait for task completion
4. Verify only ONE "Task complete" message appears

### Expected Console Output
```
[TaskRunner] Emitting TaskComplete event
[EventProcessor] Processing TaskComplete event
[EventProcessor] Created ProcessedEvent: Task complete (0 turns)
```

### What NOT to See
```
[UserNotifier] Handling TaskComplete  ❌ (should not appear)
[UserNotifier] Sending notification    ❌ (should not appear)
```

## Future Improvements

If browser notifications are needed for TaskComplete:
1. Add configuration option `enableBrowserNotifications`
2. Check the option in UserNotifier before sending notifications
3. Ensure notifications use chrome.notifications API, not inline UI displays

Example:
```typescript
case 'TaskComplete':
  if (this.config.enableBrowserNotifications) {
    chrome.notifications.create({
      type: 'basic',
      title: 'Task Complete',
      message: 'Your task has completed successfully',
      iconUrl: '/icons/success.png'
    });
  }
  break;
```

This way:
- EventProcessor handles inline UI ✅
- UserNotifier handles browser notifications ✅
- No duplication ✅
