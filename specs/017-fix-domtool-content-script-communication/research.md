# Research: DOMTool Content Script Communication Fix

**Feature**: 017-fix-domtool-content-script-communication
**Date**: 2025-10-09
**Status**: Complete

## Overview

Research to resolve message passing failures between DOMTool (background script) and content-script (page context) causing DOM operations to fail with misleading "host-permission restriction" errors despite correct manifest permissions.

## Research Questions

1. What are the best practices for Chrome extension message passing error handling?
2. How should content script ready-state verification be implemented?
3. How to handle race conditions during content script injection?
4. What patterns work for distinguishing permission errors from communication failures?
5. How should CSP-blocked sites be handled? (Edge case)

---

## Decision 1: Error Classification System

**Decision**: Implement comprehensive error type classification using `chrome.runtime.lastError` message analysis

**Rationale**:
- Different error types require different handling strategies
- Clear error classification enables appropriate retry logic
- Improves LLM agent's ability to diagnose and report issues to users
- Distinguishes recoverable (retry-able) from permanent failures

**Pattern**:
```typescript
enum MessageErrorType {
  CONTENT_SCRIPT_NOT_LOADED,  // Retryable
  PERMISSION_DENIED,          // Permanent
  TAB_CLOSED,                 // Permanent
  NETWORK_TIMEOUT,            // Retryable
  CONTEXT_INVALIDATED,        // Retryable (page navigation)
  UNKNOWN                     // Case-by-case
}
```

**Error Detection Patterns**:
- "Could not establish connection" → CONTENT_SCRIPT_NOT_LOADED (inject and retry)
- "Cannot access contents" → PERMISSION_DENIED (fail with clear message)
- "No tab with id" → TAB_CLOSED (fail gracefully)
- "context invalidated" → CONTEXT_INVALIDATED (wait and retry)

**Alternatives Considered**:
- Simple string matching (less maintainable, chosen alternative is structured)
- Using error codes (Chrome doesn't provide them)
- Always retrying (wastes resources, poor UX)

**Implementation Impact**:
- Modify `DOMTool.handleOperationError()` to classify errors
- Add structured error responses to content script
- Update error messages shown to LLM with actionable guidance

---

## Decision 2: PING/PONG Ready-State Verification

**Decision**: Implement synchronous PING/PONG protocol with timeout-based verification before DOM operations

**Rationale**:
- Provides deterministic verification that content script is loaded AND responsive
- Distinguishes "not injected" from "injected but frozen/crashed"
- Enables early failure detection before attempting operations
- Low overhead (~5-10ms per check)

**Pattern**:
```typescript
// Background: Check before operation
const response = await chrome.tabs.sendMessage(tabId, {
  type: MessageType.PING,
  requestId: generateId()
});

if (response?.type === MessageType.PONG) {
  // Ready for operations
}

// Content Script: Respond immediately
router.on(MessageType.PING, (message) => ({
  type: MessageType.PONG,
  requestId: message.requestId,
  initLevel: getCurrentInitLevel(),
  capabilities: ['dom', 'events']
}));
```

**Alternatives Considered**:
- Announcement-based (content script announces ready) - Rejected: Race condition if announcement missed
- Polling with backoff - Rejected: Higher latency and complexity
- Shared state via chrome.storage - Rejected: Async API, doesn't verify message channel health

**Implementation Impact**:
- DOMTool already has PING/PONG at lines 923-927 (verify it's working correctly)
- Content script already has handler at lines 59-62 (verify response format)
- Add initialization level reporting to PONG response

---

## Decision 3: Inject-Then-Verify with Exponential Backoff

**Decision**: Use `chrome.scripting.executeScript` with default `document_idle` timing, followed by exponential backoff verification

**Rationale**:
- `executeScript` resolves when script is injected, NOT when initialized
- Content script needs time to register message handlers (50-200ms typical)
- Exponential backoff (100ms, 200ms, 400ms, 800ms, 1600ms) balances latency vs reliability
- `document_idle` timing ensures DOM is available for manipulation

**Pattern**:
```typescript
async function ensureContentScriptReady(tabId: number): Promise<void> {
  // 1. Check if already ready
  if (await ping(tabId)) return;

  // 2. Inject content script
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['/content/content-script.js']
    // Default: document_idle, world: ISOLATED
  });

  // 3. Wait for initialization with backoff
  const delays = [100, 200, 400, 800, 1600];
  for (const delay of delays) {
    await sleep(delay);
    if (await ping(tabId)) return;
  }

  throw new Error('Content script failed to initialize');
}
```

**Timing Options Analysis**:
| Timing | When Runs | DOM State | Use Case |
|--------|-----------|-----------|----------|
| document_start | Before DOM | loading, body=null | Global script injection |
| document_end | DOM complete | interactive | Most operations |
| **document_idle** (default) | **After resources** | **complete/interactive** | **DOM manipulation (recommended)** |
| injectImmediately | ASAP | unpredictable | Debugging only |

**Alternatives Considered**:
- Always inject on tab activation - Rejected: Wasteful, creates duplicate contexts
- Wait for specific DOM events - Rejected: Events may have fired before injection
- Use `document_start` timing - Rejected: Too early, DOM not ready

**Implementation Impact**:
- Modify `DOMTool.ensureContentScriptInjected()` to wait for PONG after injection
- Add retry logic with exponential backoff
- Track injection state per tab to prevent duplicate injections

---

## Decision 4: Multi-Level Initialization Tracking

**Decision**: Track content script initialization as progression through levels: INJECTED → HANDLERS_READY → DOM_READY → FULLY_READY

**Rationale**:
- Different DOM operations require different readiness levels
- Basic operations (query, click) only need DOM_READY
- Advanced operations (captureSnapshot, observers) need FULLY_READY
- Clear leveling enables specific error messages ("script not ready for X")

**Initialization Levels**:
```typescript
enum InitializationLevel {
  NOT_INJECTED = 0,   // Script not present
  INJECTED = 1,       // Script code executing
  HANDLERS_READY = 2, // Message handlers registered
  DOM_READY = 3,      // document.readyState interactive/complete
  FULLY_READY = 4     // Async setup complete
}

// Operation requirements
const requirements = {
  'query': DOM_READY,
  'click': DOM_READY,
  'captureSnapshot': FULLY_READY,
  'observeElement': FULLY_READY
};
```

**Content Script Initialization Order**:
1. Execute script (INJECTED)
2. Set up MessageRouter and handlers synchronously (HANDLERS_READY)
3. Wait for DOM if needed (DOM_READY)
4. Complete async setup: storage, observers, config (FULLY_READY)

**Alternatives Considered**:
- Single "ready" boolean - Rejected: No granularity for debugging
- Capability-based only - Rejected: Doesn't capture sequence
- Event-based verification - Rejected: Unreliable for programmatic injection

**Implementation Impact**:
- Add `initLevel` tracking to content script
- Include `initLevel` in PONG response
- Check level before dispatching operations in DOMTool

---

## Decision 5: Message Type Alignment

**Decision**: Align message types between DOMTool and content script to use consistent `MessageType.DOM_ACTION`

**Rationale**:
- **Root cause of bug**: DOMTool sends 'DOM_ACTION', content script expects 'TOOL_EXECUTE'
- Mismatched types cause silent failures (content script ignores messages)
- Consistent types enable easier debugging and monitoring

**Current State**:
- DOMTool.ts line 872: `type: 'DOM_ACTION'`
- content-script.ts line 71: expects `MessageType.TOOL_EXECUTE`

**Fix Options**:
1. Change DOMTool to send `MessageType.TOOL_EXECUTE` → Requires updating all callsites
2. **Change content script to handle `MessageType.DOM_ACTION` (CHOSEN)** → Single file change
3. Support both types → Unnecessary complexity

**Decision**: Update content script to listen for `MessageType.DOM_ACTION` instead of `TOOL_EXECUTE`

**Implementation Impact**:
- Modify content-script.ts line 71: Change message type matcher
- Update router.on() to handle both types during transition (optional graceful migration)
- Add test verifying DOMTool and content script message compatibility

---

## Decision 6: Operation Mapping Completeness

**Decision**: Ensure content script `executeDOMTool()` maps all 25 DOM operations defined in DOMTool

**Rationale**:
- DOMTool defines 25 operations, content script implements subset
- Missing operations fail silently or return unclear errors
- Complete mapping required for feature parity

**Current Gap Analysis**:
DOMTool defines (lines 172-177):
- query, click, type, getAttribute, setAttribute, getText, getHtml, submit, focus, scroll
- findByXPath, hover, getProperty, setProperty, extractLinks, fillForm, submitForm
- captureSnapshot, getAccessibilityTree, getPaintOrder, detectClickable
- waitForElement, checkVisibility, executeSequence

Content script implements (lines 574-610):
- dom_query, dom_click, dom_type, dom_extract, dom_highlight, dom_scroll
- dom_form_fill, dom_form_data, dom_screenshot, dom_observe, dom_context

**Missing Implementations**:
- getAttribute, setAttribute, getProperty, setProperty
- getText, getHtml, submit, focus, hover, findByXPath
- extractLinks, captureSnapshot, getAccessibilityTree, getPaintOrder
- detectClickable, waitForElement, checkVisibility, executeSequence

**Decision**: Add message handlers for all 25 operations, delegating to existing DOM manipulation functions

**Implementation Impact**:
- Expand content-script.ts `executeDOMTool()` switch statement
- Map operations to existing helper functions in dom/chrome/contentScript.ts
- Add tests for each operation

---

## Decision 7: Structured Error Responses

**Decision**: Content script returns structured error responses with error type, operation context, and actionable guidance

**Rationale**:
- Current errors: "No response from content script" (vague)
- LLM needs clear, actionable errors to report to users
- Structured errors enable automatic retry/fallback logic

**Response Format**:
```typescript
interface DOMOperationResponse {
  success: boolean;
  data?: any;
  error?: {
    type: MessageErrorType;
    message: string;
    operation: string;
    selector?: string;
    suggestedAction?: string;
  };
  requestId: string;
  timestamp: number;
}
```

**Example Error Messages**:
- Element not found: "No element matching selector '.headline' found on page. Try a different selector or wait for dynamic content to load."
- Timeout: "Operation timed out after 5000ms. Page may be slow to respond or element may not exist."
- Not interactable: "Element is not visible or is obscured. Scroll element into view or wait for overlays to close."

**Implementation Impact**:
- Update content script response format
- Add error context (operation, selector, element state)
- Update DOMTool to parse and forward structured errors to LLM

---

## Decision 8: CSP-Blocked Sites Handling (Edge Case)

**Decision**: Detect CSP blocks and provide clear error message; graceful degradation not implemented in this phase

**Rationale**:
- Content Security Policy can block extension content scripts on some sites
- CSP blocks are rare but need clear error messages when they occur
- Full workaround (declarativeNetRequest) is complex and out-of-scope for this bug fix

**Detection Pattern**:
```typescript
try {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['/content/content-script.js']
  });
} catch (error) {
  if (error.message.includes('Content Security Policy')) {
    throw new Error(
      'This page blocks extension content scripts via CSP. ' +
      'DOM operations are not available on this site.'
    );
  }
}
```

**Alternatives Considered**:
- declarativeNetRequest to modify CSP headers - Rejected: Complex, requires additional permissions, security concerns
- Inject via world: 'MAIN' - Rejected: Breaks isolation, security risk
- Pre-check CSP headers - Rejected: Adds latency, headers may not reflect actual enforcement

**Implementation Impact**:
- Add CSP error detection to `ensureContentScriptReady()`
- Update error classification to include CSP_BLOCKED type
- Document limitation in error messages

---

## Summary: Key Decisions

| Decision | Impact | Priority |
|----------|--------|----------|
| Error classification system | Improves debugging, enables retry logic | HIGH |
| PING/PONG verification | Prevents race conditions | HIGH |
| Inject-then-verify pattern | Handles timing reliably | HIGH |
| Message type alignment | **FIXES ROOT CAUSE** | CRITICAL |
| Complete operation mapping | Enables all 25 operations | HIGH |
| Multi-level initialization | Better error messages | MEDIUM |
| Structured error responses | LLM can provide better feedback | HIGH |
| CSP detection | Edge case handling | LOW |

## Implementation Order

1. **Phase 1A: Fix Core Communication** (Critical path)
   - Align message types (DOM_ACTION)
   - Complete operation mapping (25 operations)
   - Structured error responses

2. **Phase 1B: Improve Reliability** (Reduces failures)
   - Inject-then-verify with backoff
   - Error classification
   - PING/PONG verification

3. **Phase 1C: Polish** (Better UX)
   - Multi-level initialization
   - CSP detection
   - Enhanced error messages

## Validation Criteria

- [ ] All 25 DOM operations work on wsj.com
- [ ] PING/PONG verification completes in <100ms
- [ ] Content script initializes within 3 seconds of injection
- [ ] Error messages distinguish permission vs communication failures
- [ ] Zero "host-permission restriction" errors when permissions are granted
- [ ] LLM receives actionable error messages for all failure modes

---

**Research Complete**: All unknowns resolved, ready for Phase 1 (Design & Contracts)
