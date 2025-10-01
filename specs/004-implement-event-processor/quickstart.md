# Quickstart: Event Processor Feature

**Feature**: Event Processor for Side Panel UI
**Date**: 2025-09-30

## Purpose
This quickstart provides step-by-step instructions to validate that the event processor feature is working correctly. It covers building, testing, and verifying the implementation.

---

## Prerequisites

```bash
# Ensure you're in the Chrome extension directory
cd codex-chrome/

# Install dependencies (if not already done)
npm install

# Verify TypeScript compilation works
npm run type-check
```

---

## Quick Validation (5 minutes)

### 1. Run Unit Tests
```bash
# Run all tests
npm test

# Run only event processor tests
npm test -- EventProcessor

# Run with coverage
npm test -- --coverage
```

**Expected Output**:
```
✓ EventProcessor.test.ts (15 tests)
  ✓ should transform AgentMessage to ProcessedEvent
  ✓ should accumulate AgentMessageDelta events
  ✓ should correlate ExecCommand Begin/End events
  ✓ should process Error event with error category
  ✓ should clear state on reset
  ...

Test Files  3 passed (3)
     Tests  45 passed (45)
```

### 2. Type Check
```bash
npm run type-check
```

**Expected Output**:
```
No errors found.
```

### 3. Build Extension
```bash
npm run build
```

**Expected Output**:
```
✓ built in 2.3s
Generated dist/ directory with extension files
```

---

## Integration Validation (10 minutes)

### 4. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `codex-chrome/dist/` directory
5. Extension should appear with Codex icon

### 5. Open Side Panel

1. Click the Codex extension icon in Chrome toolbar
2. Side panel should open on the right side
3. You should see the terminal-style UI

### 6. Send Test Message

In the side panel input:
```
Hello Codex!
```

**Expected Behavior**:
- Your message appears in the chat history
- A "processing" indicator shows
- Agent response streams in with purple "codex" label
- Response text appears progressively
- Final message is rendered with formatting

### 7. Trigger Tool Call (Mock)

To test tool call rendering, you can trigger events via the developer console:

1. Open Chrome DevTools (F12)
2. In Console tab, paste:

```javascript
// Send a mock ExecCommandBegin event
chrome.runtime.sendMessage({
  type: 'EVENT',
  payload: {
    id: 'test_exec_1',
    msg: {
      type: 'ExecCommandBegin',
      data: {
        session_id: 'exec_test_1',
        command: 'ls -la',
        cwd: '/home/user'
      }
    }
  }
});

// Send mock output
setTimeout(() => {
  chrome.runtime.sendMessage({
    type: 'EVENT',
    payload: {
      id: 'test_exec_2',
      msg: {
        type: 'ExecCommandOutputDelta',
        data: {
          session_id: 'exec_test_1',
          output: 'total 48\ndrwxr-xr-x  5 user',
          stream: 'stdout'
        }
      }
    }
  });
}, 100);

// Send completion
setTimeout(() => {
  chrome.runtime.sendMessage({
    type: 'EVENT',
    payload: {
      id: 'test_exec_3',
      msg: {
        type: 'ExecCommandEnd',
        data: {
          session_id: 'exec_test_1',
          exit_code: 0,
          duration_ms: 42
        }
      }
    }
  });
}, 200);
```

**Expected Result**:
```
┌─────────────────────────────────────────┐
│ [just now] exec ls -la (succeeded in 42ms) │ <- green
│ total 48                                │ <- dimmed
│ drwxr-xr-x  5 user                     │
└─────────────────────────────────────────┘
```

---

## Feature-Specific Validation

### 8. Streaming Message Test

**Test**: Verify streaming delta accumulation

In DevTools Console:
```javascript
// Start streaming
chrome.runtime.sendMessage({
  type: 'EVENT',
  payload: {
    id: 'stream_1',
    msg: { type: 'AgentMessageDelta', data: { delta: 'Hello ' } }
  }
});

// Add more deltas
setTimeout(() => {
  chrome.runtime.sendMessage({
    type: 'EVENT',
    payload: {
      id: 'stream_2',
      msg: { type: 'AgentMessageDelta', data: { delta: 'world!' } }
    }
  });
}, 50);

// Complete stream
setTimeout(() => {
  chrome.runtime.sendMessage({
    type: 'EVENT',
    payload: {
      id: 'stream_3',
      msg: { type: 'AgentMessage', data: { message: 'Hello world!' } }
    }
  });
}, 100);
```

**Expected**:
- First delta shows "codex" header + "Hello " with blinking cursor
- Second delta adds "world!" to same message
- Final message removes cursor, shows complete "Hello world!"

---

### 9. Error Event Test

**Test**: Verify error display with prominent styling

In DevTools Console:
```javascript
chrome.runtime.sendMessage({
  type: 'EVENT',
  payload: {
    id: 'error_1',
    msg: {
      type: 'Error',
      data: { message: 'Test error message' }
    }
  }
});
```

**Expected**:
```
┌─────────────────────────────────────────┐
│ ⚠ [just now] ERROR                      │ <- red bold with icon
│ Test error message                      │ <- red text
└─────────────────────────────────────────┘
```

---

### 10. Task Lifecycle Test

**Test**: Verify task start/complete indicators

In DevTools Console:
```javascript
// Task started
chrome.runtime.sendMessage({
  type: 'EVENT',
  payload: {
    id: 'task_1',
    msg: {
      type: 'TaskStarted',
      data: {
        model: 'claude-sonnet-4-5',
        cwd: '/workspace'
      }
    }
  }
});

// Task complete
setTimeout(() => {
  chrome.runtime.sendMessage({
    type: 'EVENT',
    payload: {
      id: 'task_2',
      msg: {
        type: 'TaskComplete',
        data: {
          turn_count: 3,
          token_usage: {
            total: {
              input_tokens: 1234,
              output_tokens: 567,
              total_tokens: 1801
            }
          }
        }
      }
    }
  });
}, 2000);
```

**Expected**:
- TaskStarted shows cyan "Task started" with model info
- Processing indicator appears
- After 2 seconds, TaskComplete shows green "Task complete" with token usage
- Processing indicator disappears

---

### 11. Token Count Display Test

**Test**: Verify token usage formatting

In DevTools Console:
```javascript
chrome.runtime.sendMessage({
  type: 'EVENT',
  payload: {
    id: 'token_1',
    msg: {
      type: 'TokenCount',
      data: {
        info: {
          total_token_usage: {
            input_tokens: 1234,
            cached_input_tokens: 500,
            output_tokens: 678,
            reasoning_output_tokens: 123,
            total_tokens: 2035
          }
        }
      }
    }
  }
});
```

**Expected**:
```
┌─────────────────────────────────────────┐
│ [just now] Tokens used: 2,035           │ <- dimmed system text
│   Input: 1,234 (500 cached)            │
│   Output: 678                           │
│   Reasoning: 123                        │
└─────────────────────────────────────────┘
```

---

## Performance Validation

### 12. Stress Test (Rapid Events)

**Test**: Verify UI remains responsive under load

In DevTools Console:
```javascript
// Send 100 events rapidly
for (let i = 0; i < 100; i++) {
  chrome.runtime.sendMessage({
    type: 'EVENT',
    payload: {
      id: `stress_${i}`,
      msg: {
        type: 'AgentMessageDelta',
        data: { delta: `Event ${i} ` }
      }
    }
  });
}

// Complete stream
chrome.runtime.sendMessage({
  type: 'EVENT',
  payload: {
    id: 'stress_final',
    msg: {
      type: 'AgentMessage',
      data: { message: 'Stress test complete' }
    }
  }
});
```

**Expected**:
- UI updates smoothly (no jank or freezing)
- All deltas accumulate correctly
- Final message shows complete accumulated content
- Scroll remains smooth

**Performance Metrics** (Chrome DevTools Performance tab):
- Frame rate should stay near 60fps
- No long tasks >500ms (UI throttle interval)
- No memory leaks (heap size stabilizes)

---

## Accessibility Validation

### 13. Keyboard Navigation

**Test**: Verify keyboard controls work

1. Click in side panel to focus
2. Press Tab repeatedly
3. Each event should receive focus (visible outline)
4. Press Enter on collapsible event
5. Event should expand/collapse
6. Press Arrow Up/Down
7. Focus should move between events

**Expected**: All events are keyboard-accessible without mouse

---

### 14. Screen Reader Test (Optional)

**Test**: With screen reader enabled (NVDA/JAWS/VoiceOver):

1. Navigate through events with screen reader
2. Each event should announce:
   - Category (e.g., "message", "error")
   - Title
   - Content
   - Status (if applicable)
   - Collapse state (if collapsible)

**Expected**: All information is conveyed via screen reader

---

## Troubleshooting

### Issue: Events not appearing

**Check**:
1. Is MessageRouter initialized? Check browser console for errors
2. Are events being sent? Add console.log in MessageRouter.onMessage
3. Is EventProcessor returning null? Check processing logic

**Debug**:
```javascript
// In App.svelte
console.log('Raw event:', event);
console.log('Processed:', processedEvent);
```

---

### Issue: Styling not applied

**Check**:
1. Is Tailwind CSS included? Check `<head>` for tailwind stylesheet
2. Are classes being generated? Run `npm run build` to regenerate
3. Are style objects correct? Check EventProcessor.getStyleForCategory()

**Debug**:
```svelte
<!-- In EventDisplay.svelte -->
<div>Style: {JSON.stringify(event.style)}</div>
```

---

### Issue: Performance degradation

**Check**:
1. How many events in history? Check processedEvents.length
2. Is virtual scrolling enabled? Check scroll container config
3. Are there memory leaks? Use Chrome DevTools Memory profiler

**Debug**:
```javascript
// Check event count
console.log('Total events:', processedEvents.length);

// Check memory usage
console.log('Memory:', performance.memory?.usedJSHeapSize);
```

---

## Success Criteria

✅ All unit tests pass (45/45)
✅ Type checking passes with no errors
✅ Extension loads in Chrome without errors
✅ Side panel opens and displays UI
✅ Simple agent messages render correctly
✅ Streaming messages accumulate with cursor animation
✅ Tool calls show with green/red status and duration
✅ Errors display prominently in red
✅ Task lifecycle events update status indicators
✅ Token counts format with thousands separators
✅ Rapid events (100/second) don't cause UI lag
✅ Keyboard navigation works for all events
✅ Performance: 60fps, 500ms UI throttle, smooth event processing

---

## Next Steps

After completing this quickstart:

1. **Real Integration**: Connect to actual CodexAgent for end-to-end testing
2. **User Testing**: Have users try the extension with real prompts
3. **Performance Profiling**: Run extended stress tests with production load
4. **Accessibility Audit**: Full WCAG 2.1 AA compliance check
5. **Cross-browser Testing**: Test in Edge, Brave, etc. (all Chromium-based)

---

## Additional Resources

- **Architecture Diagram**: See research.md section "Data Flow"
- **Event Types Reference**: codex-chrome/src/protocol/events.ts
- **Component Hierarchy**: See data-model.md section "Data Flow"
- **Contract Tests**: specs/004-implement-event-processor/contracts/

---

**Status**: ✅ Quickstart Complete - Ready for Implementation Validation
