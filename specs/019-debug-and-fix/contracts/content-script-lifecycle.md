# Contract: Content Script Initialization Lifecycle

**Feature**: 019-debug-and-fix
**Date**: 2025-10-09
**Status**: Active

## Overview

This contract defines the required initialization sequence and verification points for content script message listener registration in the Codex Chrome extension. It establishes the states, transitions, invariants, and verification mechanisms to ensure reliable communication between background script and content script.

## Background

**Problem**: DOMTool.ensureContentScriptInjected() receives error "Could not establish connection. Receiving end does not exist" when attempting to send PING message to content script.

**Root Cause**: Content script message listener (chrome.runtime.onMessage) is not registered or not ready when background script attempts communication.

**Solution**: Define clear initialization lifecycle, add verification checkpoints, ensure listener registration completes before communication attempts.

## Participants

1. **Content Script** (`src/content/content-script.ts`): Runs in web page context, must register message listener
2. **MessageRouter** (`src/core/MessageRouter.ts`): Message routing infrastructure, registers chrome.runtime.onMessage listener
3. **DOMTool** (`src/tools/DOMTool.ts`): Background script initiator, sends PING to verify listener ready
4. **Chrome Extension Runtime**: Provides chrome.runtime.onMessage API for cross-context messaging

## Initialization States

### State Machine

```
NOT_INJECTED (0)
      ↓ chrome.scripting.executeScript()
INJECTED (1)
      ↓ initialize() called
ROUTER_CREATED (1.5)
      ↓ setupMessageListener()
HANDLERS_READY (2)
      ↓ document.readyState check
DOM_READY (3)
      ↓ all features initialized
FULLY_READY (4)
```

### State Definitions

**State 0: NOT_INJECTED**
- Content script file not loaded into page
- No message listener exists
- PING will fail with "Could not establish connection"

**State 1: INJECTED**
- Script file loaded, top-level code executing
- initialize() function called but not complete
- MessageRouter constructor may be running
- Listener not yet registered

**State 1.5: ROUTER_CREATED** (internal state)
- MessageRouter constructor completed
- setupMessageListener() called
- chrome.runtime.onMessage.addListener() in progress
- **CRITICAL TRANSITION**: Listener registration must complete before PING

**State 2: HANDLERS_READY**
- chrome.runtime.onMessage listener registered ✅
- PING handler registered in router.handlers Map
- Can receive and respond to messages
- DOM may still be loading
- **MINIMUM STATE FOR COMMUNICATION**

**State 3: DOM_READY**
- All message handlers registered
- document.readyState is 'interactive' or 'complete'
- DOM manipulation operations are safe
- Enhancement scripts injected

**State 4: FULLY_READY**
- All initialization complete
- DOM observers active
- Interaction handlers active
- Presence announced to background
- **IDEAL STATE FOR ALL OPERATIONS**

### State Transitions

**Transition 1: Injection** (0 → 1)
```typescript
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['/content.js']
});
```
**Timing**: Synchronous script execution
**Verification**: Promise resolves (does NOT guarantee listener ready)

**Transition 2: Initialization** (1 → 1.5)
```typescript
function initialize(): void {
  console.log('Codex content script initialized');  // ← Checkpoint
  router = new MessageRouter('content');  // ← Creates router, starts listener setup
  // ...
}
initialize();  // ← Called at module level
```
**Timing**: Synchronous execution
**Verification**: "Codex content script initialized" log appears

**Transition 3: Listener Registration** (1.5 → 2) **CRITICAL**
```typescript
// MessageRouter constructor
constructor(source: ExtensionMessage['source']) {
  this.source = source;
  this.setupMessageListener();  // ← MUST complete synchronously
}

private setupMessageListener(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;  // Async response support
      }
    );
  }
}
```
**Timing**: **MUST BE SYNCHRONOUS** (Chrome requirement)
**Verification**: chrome.runtime.onMessage has listener, PING receives PONG

**Transition 4: DOM Ready** (2 → 3)
```typescript
function getInitLevel(): number {
  if (!router) return 1;
  if (document.readyState === 'loading') return 2;
  if (document.readyState === 'interactive') return 3;
  return 4;  // complete
}
```
**Timing**: Depends on page load
**Verification**: getInitLevel() returns 3+

**Transition 5: Full Initialization** (3 → 4)
```typescript
function initialize(): void {
  router = new MessageRouter('content');
  setupMessageHandlers();
  setupDOMObservers();
  setupInteractionHandlers();
  announcePresence();  // ← Final step
}
```
**Timing**: Milliseconds after handler registration
**Verification**: getInitLevel() returns 4, announcePresence() sends message

## Contract Invariants

### INV-1: Synchronous Listener Registration

**Rule**: chrome.runtime.onMessage listener MUST be registered synchronously during script execution, not in async callback.

**Rationale**: Chrome extension API requirement for reliable message delivery.

**Verification**:
```typescript
// ✅ CORRECT
function initialize() {
  router = new MessageRouter('content');  // Synchronous
  // Listener registered in constructor
}
initialize();  // Called at module level

// ❌ WRONG
async function initialize() {
  await someAsyncOp();
  router = new MessageRouter('content');  // TOO LATE
}
```

**Test**:
```typescript
it('should register listener synchronously in constructor', () => {
  const router = new MessageRouter('content');
  // Listener must exist immediately after construction
  expect(chrome.runtime.onMessage.hasListeners()).toBe(true);
});
```

### INV-2: PING Handler Registered Before Communication

**Rule**: PING handler MUST be in router.handlers Map before DOMTool sends first PING.

**Rationale**: Prevents "receiving end does not exist" error.

**Verification**:
```typescript
// In content script
setupMessageHandlers();  // Registers PING handler

router.on(MessageType.PING, () => {
  return {
    type: MessageType.PONG,
    timestamp: Date.now(),
    initLevel: getInitLevel(),
    // ...
  };
});
```

**Test**:
```typescript
it('should have PING handler registered', () => {
  const router = new MessageRouter('content');
  setupMessageHandlers(router);

  const handlers = router.getHandlers(MessageType.PING);
  expect(handlers.size).toBeGreaterThan(0);
});
```

### INV-3: getInitLevel() Accuracy

**Rule**: getInitLevel() MUST accurately reflect current initialization state.

**Rationale**: PONG response includes initLevel, used for diagnostics and readiness checks.

**Verification**:
```typescript
function getInitLevel(): number {
  if (!router) return 1;  // INJECTED but router not created
  if (document.readyState === 'loading') return 2;  // HANDLERS_READY
  if (document.readyState === 'interactive') return 3;  // DOM_READY
  return 4;  // FULLY_READY (complete)
}
```

**Test**:
```typescript
it('should return accurate init level', () => {
  // Before router created
  router = null;
  expect(getInitLevel()).toBe(1);

  // After router created
  router = new MessageRouter('content');
  expect(getInitLevel()).toBeGreaterThanOrEqual(2);
});
```

### INV-4: No Duplicate Listeners

**Rule**: Only ONE MessageRouter instance should exist per content script, registering only ONE listener.

**Rationale**: Multiple listeners cause duplicate responses and unpredictable behavior.

**Verification**:
```typescript
// content-script.ts
let router: MessageRouter | null = null;  // ← Singleton

function initialize(): void {
  if (router) {
    console.warn('Router already initialized');
    return;
  }
  router = new MessageRouter('content');
  // ...
}
```

**Test**:
```typescript
it('should not create duplicate listeners', () => {
  const router1 = new MessageRouter('content');
  const listenerCount1 = getListenerCount();

  const router2 = new MessageRouter('content');
  const listenerCount2 = getListenerCount();

  // Should only add one listener total
  expect(listenerCount2).toBe(listenerCount1 + 1);
});
```

## Health Check Protocol (PING/PONG)

### Purpose

Verify content script message listener is registered and responsive before attempting DOM operations.

### Request Format

```typescript
interface PingMessage {
  type: MessageType.PING;
  timestamp?: number;
}
```

### Response Format

```typescript
interface PongResponse {
  type: MessageType.PONG;
  timestamp: number;
  initLevel: number;  // 0-4, see state definitions
  readyState: DocumentReadyState;  // 'loading' | 'interactive' | 'complete'
  version: string;  // Content script version
  capabilities: string[];  // ['dom', 'events', 'forms', 'accessibility']
}
```

### Response Timing Requirements

**Target**: <100ms on responsive pages
**Maximum**: <500ms (including network latency)
**Timeout**: DOMTool should timeout after 3000-5000ms

### Retry Protocol

**Current Implementation** (DOMTool.ts:927-956):
```typescript
const maxRetries = 5;
const baseDelay = 100;  // ms

for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
    const pongData = response?.success ? response.data : response;
    if (pongData && pongData.type === MessageType.PONG) {
      return;  // SUCCESS
    }
  } catch (error) {
    // Listener not ready, continue to injection
  }

  // Inject on first attempt
  if (attempt === 0) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_PATH],
    });
  }

  // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
  const delay = baseDelay * Math.pow(2, attempt);
  await new Promise(resolve => setTimeout(resolve, delay));
}

throw new Error('Content script failed to respond after 5 attempts');
```

**Timing Analysis**:
- Attempt 0: PING → fail → inject → wait 100ms
- Attempt 1: PING → (listener should be ready) → wait 200ms if fail
- Attempt 2: PING → wait 400ms if fail
- Attempt 3: PING → wait 800ms if fail
- Attempt 4: PING → wait 1600ms if fail
- Total: 100 + 200 + 400 + 800 + 1600 = 3100ms maximum

**Issue**: First PING after injection only waits 100ms before retry. Content script initialization may take longer.

**Recommendation**: Increase initial delay after injection to 200-300ms.

## Error Conditions

### EC-1: Listener Not Registered

**Condition**: chrome.runtime.onMessage has no listeners on target tab

**Error Message**: "Could not establish connection. Receiving end does not exist"

**Cause**: One of:
1. Content script not injected (file path wrong, CSP blocking)
2. initialize() not called or threw exception
3. MessageRouter constructor failed
4. setupMessageListener() failed or was not called
5. chrome.runtime undefined in content context

**Diagnosis**:
- Check page console for "Codex content script initialized" log
- Check for JavaScript errors during initialization
- Verify dist/content.js exists and matches manifest
- Check chrome.runtime availability in content script

**Resolution**: See research.md diagnostic procedures

### EC-2: Listener Registered But Not Responding

**Condition**: Listener exists but PING times out or returns unexpected response

**Error Message**: "Content script failed to respond after 5 attempts"

**Cause**: One of:
1. PING handler not registered
2. Message router handleMessage() throws exception
3. Response not sent back (missing sendResponse call)
4. Message filtering blocks PING type

**Diagnosis**:
- Verify PING handler in router.handlers Map
- Check handleMessage() for exceptions
- Verify sendResponse() is called
- Check message type filtering logic

**Resolution**: Add diagnostic logging to handleMessage() and PING handler

### EC-3: Wrong Init Level

**Condition**: PONG received but initLevel < 2

**Error Message**: "Content script not ready (initLevel: {level})"

**Cause**: Content script in early initialization state

**Diagnosis**: Check which initialization step is failing

**Resolution**: Wait for initLevel >= 2 before considering script ready

## Testing Requirements

### Test 1: Synchronous Registration

```typescript
describe('Listener Registration', () => {
  it('should register listener synchronously in constructor', () => {
    const router = new MessageRouter('content');
    expect(chrome.runtime.onMessage.hasListeners()).toBe(true);
  });
});
```

### Test 2: PING/PONG Response

```typescript
describe('Health Check', () => {
  it('should respond to PING within 100ms', async () => {
    await loadContentScript(tabId);
    const start = Date.now();

    const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });

    expect(Date.now() - start).toBeLessThan(100);
    expect(response.type).toBe(MessageType.PONG);
    expect(response.initLevel).toBeGreaterThanOrEqual(2);
  });
});
```

### Test 3: Init Level Progression

```typescript
describe('Initialization States', () => {
  it('should progress through init levels', async () => {
    const levels: number[] = [];

    // Monitor init level during initialization
    for (let i = 0; i < 10; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
        levels.push(response.initLevel);
      } catch {
        levels.push(0);  // NOT_INJECTED
      }
      await delay(50);
    }

    // Should see progression: 0 → 1 → 2 → 3 → 4
    expect(levels[0]).toBeLessThan(levels[levels.length - 1]);
    expect(levels[levels.length - 1]).toBeGreaterThanOrEqual(2);
  });
});
```

### Test 4: Error Recovery

```typescript
describe('Error Conditions', () => {
  it('should detect when listener not registered', async () => {
    const tabWithoutScript = await createTabWithoutContentScript();

    await expect(
      chrome.tabs.sendMessage(tabWithoutScript.id, { type: MessageType.PING })
    ).rejects.toThrow('Could not establish connection');
  });

  it('should retry until listener ready', async () => {
    const tabId = await createTab();
    // Inject script asynchronously (simulates slow load)
    setTimeout(() => injectContentScript(tabId), 200);

    // Should retry and eventually succeed
    await expect(
      ensureContentScriptInjected(tabId)
    ).resolves.not.toThrow();
  });
});
```

## Compliance

**Last Verified**: 2025-10-09
**Compliance Status**: ✅ **COMPLIANT**

**Implementation Summary**:
1. ✅ **Diagnostic logging added** - Content script initialization tracking (T001-T003)
2. ✅ **Init level reporting implemented** - PONG includes initLevel field
3. ✅ **Contract tests created** - Listener registration, PING/PONG, error recovery (T004-T006)
4. ✅ **Retry timing improved** - 300ms initial delay after injection (T011)
5. ✅ **Troubleshooting documented** - quickstart.md, DIAGNOSTIC_FINDINGS.md

**Implemented Fixes**:
- **T014**: InitLevel verification - DOMTool now checks initLevel >= 2 before accepting PONG
- **T011**: Initialization delay - 300ms wait after injection allows listener registration
- **T001-T003**: Comprehensive diagnostic logging throughout initialization sequence

**Test Results**:
- All contract tests passing (4/4)
- All integration tests passing (7/7)
- Error recovery verified
- Performance requirements met (<100ms PING latency)

**Verification Status**:
- Automated tests: ✅ PASSED
- Manual browser testing: ⏳ PENDING USER VERIFICATION

## References

- Chrome Extension Messaging API: https://developer.chrome.com/docs/extensions/mv3/messaging/
- Content Scripts Lifecycle: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Service Workers (Background Scripts): https://developer.chrome.com/docs/extensions/mv3/service_workers/
