# Research: Content Script Communication Fix

**Feature**: 019-debug-and-fix
**Date**: 2025-10-09
**Status**: Complete

## Problem Statement

**Error**: "Could not establish connection. Receiving end does not exist"

**Location**: `codex-chrome/src/tools/DOMTool.ts`, method `ensureContentScriptInjected()`, line with `chrome.tabs.sendMessage(tabId, { type: MessageType.PING })`

**Impact**: DOM tool operations fail completely - agent cannot interact with web pages

## Root Cause Investigation

### Hypothesis 1: Content Script File Not Injected

**Likelihood**: LOW (already fixed in feature 018)

**Evidence**:
- Feature 018 verified file path `/content.js` matches manifest.json
- Build output shows `dist/content.js` exists (15KB)
- Manifest correctly references `"js": ["content.js"]`

**Conclusion**: File path is correct, this is not the root cause

### Hypothesis 2: Content Script Injected But Initialization Failed

**Likelihood**: HIGH

**Evidence**:
- Error occurs during programmatic injection via `chrome.scripting.executeScript`
- Content script may execute but throw error during `initialize()` function
- No diagnostic logging to verify initialization completes

**Investigation Required**:
1. Check page console for "Codex content script initialized" log
2. Verify no JavaScript errors during content-script.ts execution
3. Confirm `initialize()` function completes successfully
4. Check if `router` variable is properly set (not null)

**Potential Failures**:
- Exception thrown during `MessageRouter` construction
- Exception in `setupMessageHandlers()`
- Exception in `setupDOMObservers()`
- Exception in `setupInteractionHandlers()`
- Exception in `announcePresence()` (non-fatal but indicates issues)

### Hypothesis 3: Message Listener Not Registered

**Likelihood**: VERY HIGH - PRIMARY SUSPECT

**Evidence**:
- Chrome error "Receiving end does not exist" specifically means no `chrome.runtime.onMessage` listener found
- MessageRouter.setupMessageListener() may not be called or may fail silently
- Listener registration must be synchronous during script load

**Investigation Required**:
1. Verify `MessageRouter.setupMessageListener()` is called in `initialize()`
2. Check if listener registration is wrapped in try/catch that swallows errors
3. Confirm `chrome.runtime.onMessage.addListener()` actually executes
4. Verify listener callback receives messages

**Code Flow Analysis**:
```
content-script.ts initialize()
  ↓
new MessageRouter('content')
  ↓
MessageRouter.constructor()
  ↓
this.setupMessageListener()  ← CRITICAL: Must complete synchronously
  ↓
chrome.runtime.onMessage.addListener(...)  ← Listener must be registered
```

**Potential Failures**:
- `typeof chrome === 'undefined'` check fails
- `chrome.runtime` is undefined in content script context
- Listener callback never gets registered due to early return
- Async operation delays listener registration

### Hypothesis 4: Message Listener Registered to Wrong Context

**Likelihood**: MEDIUM

**Evidence**:
- MessageRouter uses `createRouter()` to detect context (background vs content vs sidepanel)
- Context detection logic in MessageRouter.ts:615-634 uses window and chrome API checks
- Incorrect context could result in wrong source being set

**Investigation Required**:
1. Verify `createRouter()` correctly identifies content script context
2. Check that `source` parameter is 'content' not 'background'
3. Confirm listener is registered on correct chrome.runtime instance

**Code Flow Analysis**:
```typescript
// createRouter() context detection (MessageRouter.ts:615-634)
let source: ExtensionMessage['source'] = 'background';

if (typeof chrome !== 'undefined') {
  if (chrome.sidePanel) {
    source = 'sidepanel';
  } else if (typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
    source = 'popup';  // Or background
  } else if (typeof window !== 'undefined') {
    source = 'content';  ← SHOULD match content script
  }
}
```

**Potential Failures**:
- Window object undefined in content script (unlikely)
- chrome.sidePanel check triggers incorrectly
- Protocol check misidentifies content script as popup

### Hypothesis 5: Timing Issue - PING Sent Before Listener Ready

**Likelihood**: HIGH

**Evidence**:
- `chrome.scripting.executeScript` resolves when script executes
- Listener registration inside `initialize()` may be async
- No delay between injection and first PING attempt
- Current retry logic (5 attempts, exponential backoff) may not account for initialization time

**Investigation Required**:
1. Measure time from executeScript() resolution to listener being ready
2. Check if initialize() has any async operations before listener registration
3. Verify PING timing relative to content script execution

**Code Flow Analysis**:
```
DOMTool.ensureContentScriptInjected()
  ↓
chrome.scripting.executeScript({ files: ['/content.js'] })
  ↓
Promise resolves  ← Script has executed
  ↓
chrome.tabs.sendMessage(tabId, { type: MessageType.PING })
  ↓
ERROR: "Receiving end does not exist"  ← Listener not ready yet!
```

**Timing Analysis**:
- executeScript resolves: Script top-level code has run
- initialize() called: Synchronous execution starts
- MessageRouter created: Constructor runs
- setupMessageListener() called: Listener should register
- **GAP**: Any async code delays listener registration

**Current Retry Logic** (DOMTool.ts:927-956):
```typescript
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
    const pongData = response?.success ? response.data : response;
    if (pongData && pongData.type === MessageType.PONG) {
      return;  // Success
    }
  } catch (error) {
    // Continue to injection
  }

  // If first attempt failed, try injecting
  if (attempt === 0) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_PATH],
    });
  }

  // Exponential backoff
  const delay = baseDelay * Math.pow(2, attempt);
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

**Issue**: After injection on attempt 0, immediately waits and retries. May need longer initial delay.

## Chrome Extension Message Listener Requirements

### Synchronous Registration

**Requirement**: `chrome.runtime.onMessage.addListener()` MUST be called synchronously during script load.

**Reference**: Chrome Extension documentation states listeners must be registered synchronously, not in async callbacks.

**Verification**:
```typescript
// ✅ CORRECT - Synchronous registration
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handler code
  return true;  // Indicates async response
});

// ❌ WRONG - Async registration (may not work reliably)
async function setup() {
  await someAsyncOperation();
  chrome.runtime.onMessage.addListener(...);  // TOO LATE
}
```

**Current Code Analysis** (content-script.ts):
```typescript
// Line 34-51: initialize() function
function initialize(): void {
  console.log('Codex content script initialized');

  router = new MessageRouter('content');  // ← Creates router
  setupMessageHandlers();  // ← Registers PING handler
  setupDOMObservers();
  setupInteractionHandlers();
  announcePresence();
}

// Line 1024: Script execution
initialize();  // ← Called synchronously at module level ✅
```

**MessageRouter Constructor** (MessageRouter.ts:115-118):
```typescript
constructor(source: ExtensionMessage['source']) {
  this.source = source;
  this.setupMessageListener();  // ← Called in constructor ✅
}
```

**setupMessageListener()** (MessageRouter.ts:123-137):
```typescript
private setupMessageListener(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;  // ← Async response support
      }
    );
    // ... additional connection listeners
  }
}
```

**Analysis**: Code structure looks correct - listener should be registered synchronously. But "receiving end does not exist" error proves it's not working.

## Diagnostic Strategy

### Phase 1: Verify Content Script Loads

**Steps**:
1. Build extension: `npm run build`
2. Load in Chrome
3. Open test page (e.g., https://example.com)
4. Open page console (F12)
5. Look for: "Codex content script initialized"

**Expected**:
- ✅ Log appears → Content script loaded and initialize() called
- ❌ No log → Script not loaded or initialization failed

### Phase 2: Verify Listener Registration

**Add Diagnostic Logging** (content-script.ts):
```typescript
function initialize(): void {
  console.log('[Codex] Content script initializing...');

  console.log('[Codex] Creating MessageRouter with source: content');
  router = new MessageRouter('content');

  console.log('[Codex] MessageRouter created, router =', router);
  console.log('[Codex] Setting up message handlers...');
  setupMessageHandlers();

  console.log('[Codex] Message handlers set up');
  console.log('[Codex] Initialization complete');
}
```

**Add Diagnostic Logging** (MessageRouter.ts:123):
```typescript
private setupMessageListener(): void {
  console.log('[MessageRouter] setupMessageListener called, source =', this.source);
  console.log('[MessageRouter] typeof chrome =', typeof chrome);
  console.log('[MessageRouter] chrome.runtime exists =', !!chrome?.runtime);

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('[MessageRouter] Registering chrome.runtime.onMessage listener');
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        console.log('[MessageRouter] Message received:', message.type);
        this.handleMessage(message, sender, sendResponse);
        return true;
      }
    );
    console.log('[MessageRouter] Listener registered successfully');
  } else {
    console.error('[MessageRouter] Cannot register listener - chrome.runtime not available!');
  }
}
```

**Expected Output** (page console):
```
[Codex] Content script initializing...
[Codex] Creating MessageRouter with source: content
[MessageRouter] setupMessageListener called, source = content
[MessageRouter] typeof chrome = object
[MessageRouter] chrome.runtime exists = true
[MessageRouter] Registering chrome.runtime.onMessage listener
[MessageRouter] Listener registered successfully
[Codex] MessageRouter created, router = MessageRouter {source: 'content', ...}
[Codex] Setting up message handlers...
[Codex] Message handlers set up
[Codex] Initialization complete
```

### Phase 3: Test PING/PONG

**Add Test Command** (background console):
```javascript
// Run in background console (chrome://extensions → service worker)
async function testPing(tabId) {
  console.log('[Test] Sending PING to tab', tabId);
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    console.log('[Test] Received response:', response);
    return response;
  } catch (error) {
    console.error('[Test] PING failed:', error);
    throw error;
  }
}

// Get active tab ID first
const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
await testPing(tabs[0].id);
```

**Expected**:
- ✅ Response with `type: 'PONG'`, `initLevel: 4`
- ❌ Error: "Could not establish connection. Receiving end does not exist"

### Phase 4: Verify Context Detection

**Add Diagnostic** (MessageRouter.ts createRouter):
```typescript
export function createRouter(): MessageRouter {
  let source: ExtensionMessage['source'] = 'background';

  console.log('[createRouter] Detecting context...');
  console.log('[createRouter] typeof chrome =', typeof chrome);
  console.log('[createRouter] typeof window =', typeof window);
  console.log('[createRouter] window.location =', typeof window !== 'undefined' ? window.location?.href : 'undefined');

  if (typeof chrome !== 'undefined') {
    if (chrome.sidePanel) {
      source = 'sidepanel';
      console.log('[createRouter] Detected: sidepanel');
    } else if (typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
      if (typeof document !== 'undefined' && document.querySelector('body')) {
        source = 'popup';
        console.log('[createRouter] Detected: popup');
      }
    } else if (typeof window !== 'undefined') {
      source = 'content';
      console.log('[createRouter] Detected: content script');
    }
  }

  console.log('[createRouter] Final source =', source);
  return new MessageRouter(source);
}
```

## Decision: Diagnostic-First Approach

**Strategy**: Add comprehensive diagnostic logging before attempting fix

**Rationale**:
1. Error message is clear but root cause is ambiguous (5 hypotheses)
2. Guessing at fix without diagnosis may waste time
3. Logging is non-invasive and helps future debugging
4. Can verify fix works by observing log output

**Implementation Plan**:
1. Add diagnostic logging to content-script.ts initialize()
2. Add diagnostic logging to MessageRouter.setupMessageListener()
3. Add diagnostic logging to MessageRouter.handleMessage()
4. Add test command for manual PING testing
5. Rebuild and test with diagnostics
6. Analyze log output to identify root cause
7. Implement targeted fix based on findings
8. Verify fix resolves issue
9. Remove or reduce verbose logging (keep key checkpoints)

## Research Findings Summary

### Finding 1: Listener Registration Appears Correct

**Evidence**: Code review shows synchronous registration pattern
**But**: Error proves listener not responding
**Conclusion**: Need runtime diagnostics to find actual failure point

### Finding 2: Multiple Potential Failure Modes

**Identified**:
1. Initialization exception (swallowed error)
2. Listener not actually registered (chrome.runtime unavailable)
3. Wrong context detected (not 'content')
4. Timing issue (listener registered after PING sent)
5. Message not reaching handler (routing issue)

**Decision**: Instrumentation needed to eliminate possibilities

### Finding 3: Existing Retry Logic May Be Insufficient

**Current**: 5 attempts with exponential backoff starting at 100ms
**Issue**: First injection happens on attempt 0, retry on attempt 1 (100ms later)
**Problem**: Content script initialization may take >100ms

**Recommendation**: Consider longer initial delay after injection (200-500ms)

### Finding 4: No Verification of Listener Readiness

**Current**: Assumes content script ready after executeScript resolves
**Reality**: Script executed but listener may not be registered yet
**Recommendation**: Health check (PING/PONG) should verify listener before considering injection complete

## Technical Decisions

### Decision 1: Add Diagnostic Logging

**Chosen**: Comprehensive console logging at key checkpoints
**Alternatives**: Chrome DevTools breakpoints (manual), unit tests (won't catch runtime issues)
**Rationale**: Logging provides runtime visibility without disrupting execution

### Decision 2: Keep Synchronous Initialization

**Chosen**: Maintain current synchronous initialize() pattern
**Alternatives**: Async initialization with ready signal
**Rationale**: Synchronous is correct pattern for Chrome listeners, don't change working architecture

### Decision 3: Enhance Retry Logic After Diagnosis

**Chosen**: Wait for diagnostic findings before modifying retry
**Alternatives**: Immediately increase delays
**Rationale**: Don't add delays if root cause is listener not registering at all

### Decision 4: Add Health Check Verification

**Chosen**: PING/PONG must succeed before considering injection complete
**Alternatives**: Trust executeScript resolution, add fixed delay
**Rationale**: Explicit verification is more reliable than assumptions

## Next Steps (Phase 1)

1. Create contract: `content-script-lifecycle.md` - Define initialization states and invariants
2. Create quickstart: Manual diagnostic procedure for developers
3. Create contract tests: Verify listener registration and PING/PONG response
4. Plan tasks: Diagnostic → Fix → Verify → Document
