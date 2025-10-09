# Quickstart: DOMTool Content Script Communication Fix

**Feature**: 017-fix-domtool-content-script-communication
**Date**: 2025-10-09
**Estimated Time**: 2-3 hours

## Overview

This quickstart guide validates that the DOMTool content script communication fix is working correctly. It walks through the critical scenario: using the LLM agent to read and summarize content from wsj.com, which was previously failing with misleading "host-permission restriction" errors.

---

## Prerequisites

- [ ] codex-chrome extension built and loaded in Chrome
- [ ] Chrome browser with Developer Mode enabled
- [ ] Access to wsj.com (or alternative test site)
- [ ] OpenAI API key configured for GPT-5
- [ ] Extension has `host_permissions: ["<all_urls>"]` in manifest

---

## Test Environment Setup

### 1. Load Extension

```bash
cd codex-chrome
npm run build
```

Then in Chrome:
1. Navigate to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `codex-chrome/dist` directory
5. Note the extension ID

### 2. Verify Permissions

Check that manifest.json includes:
```json
{
  "host_permissions": ["<all_urls>"],
  "permissions": ["tabs", "activeTab", "scripting", "storage"]
}
```

### 3. Open DevTools

1. Right-click extension icon → "Inspect popup" (for sidepanel DevTools)
2. Open console to monitor messages
3. Open a new tab with DevTools (F12) to monitor content script

---

## Core Test Scenarios

### Scenario 1: Basic PING/PONG Verification

**Purpose**: Verify content script communication channel works

**Steps**:

1. **Open test page**:
   ```javascript
   // In extension background DevTools console
   const tabId = (await chrome.tabs.create({ url: 'https://example.com' })).id;
   ```

2. **Send PING**:
   ```javascript
   const response = await chrome.tabs.sendMessage(tabId, {
     type: 'PING',
     requestId: 'test-ping-1',
     timestamp: Date.now()
   });
   console.log('PONG response:', response);
   ```

3. **Expected Result**:
   ```javascript
   {
     type: 'PONG',
     requestId: 'test-ping-1',
     initLevel: 3 or 4, // DOM_READY or FULLY_READY
     readyState: 'complete',
     version: '1.0.0',
     capabilities: ['dom', 'events', ...]
   }
   ```

**Success Criteria**:
- [ ] PONG received within 100ms
- [ ] `initLevel >= 3` (DOM_READY)
- [ ] No errors in console

---

### Scenario 2: WSJ.com Headline Extraction (Main Fix Validation)

**Purpose**: Validate the original failing scenario now works

**Steps**:

1. **Open WSJ.com via agent**:
   - Open codex-chrome sidepanel
   - Type: "open wsj.com and summarize the top headline"

2. **Observe communication**:
   - Background DevTools: Look for `DOM_ACTION` messages being sent
   - Page DevTools: Look for content script receiving and processing messages

3. **Verify operation**:
   ```javascript
   // Manually trigger the same operation
   const response = await chrome.tabs.sendMessage(tabId, {
     type: 'DOM_ACTION',
     action: 'query',
     selector: 'h1, h2, .headline, [class*="headline"]',
     requestId: 'test-headline-1',
     options: { multiple: true },
     timestamp: Date.now()
   });
   console.log('Headlines found:', response.data.elements);
   ```

4. **Expected Result**:
   ```javascript
   {
     type: 'DOM_RESPONSE',
     success: true,
     data: {
       elements: [
         { tagName: 'h1', className: 'headline', textContent: '...' }
       ],
       count: 1
     },
     requestId: 'test-headline-1'
   }
   ```

**Success Criteria**:
- [ ] No "host-permission restriction" error
- [ ] No "Could not establish connection" error
- [ ] Headlines extracted successfully
- [ ] LLM receives summary of headline
- [ ] Error messages (if any) are clear and accurate

**Common Issues**:
- **ISSUE**: "Could not establish connection"
  - **FIX**: Content script not loaded, check injection logic
- **ISSUE**: No response after 5s
  - **FIX**: Check message type alignment (DOM_ACTION vs TOOL_EXECUTE)
- **ISSUE**: Empty elements array
  - **FIX**: Selector may need adjustment for WSJ's current layout

---

### Scenario 3: All 25 DOM Operations

**Purpose**: Verify complete operation mapping

**Steps**:

Use the test script:

```javascript
// Test all 25 operations
const operations = [
  { action: 'query', selector: 'body' },
  { action: 'findByXPath', xpath: '//body' },
  { action: 'click', selector: 'body' },
  { action: 'hover', selector: 'body' },
  { action: 'type', selector: 'input', text: 'test' },
  { action: 'focus', selector: 'body' },
  { action: 'scroll', selector: 'body' },
  { action: 'getAttribute', selector: 'body', attribute: 'class' },
  { action: 'setAttribute', selector: 'body', attribute: 'data-test', value: 'test' },
  { action: 'getProperty', selector: 'body', property: 'scrollHeight' },
  { action: 'setProperty', selector: 'body', property: 'dataset.test', value: 'test' },
  { action: 'getText', selector: 'body' },
  { action: 'getHtml', selector: 'body' },
  { action: 'extractLinks', selector: 'a[href]' },
  { action: 'fillForm', formSelector: 'form', formData: {} },
  { action: 'submit', selector: 'form' },
  { action: 'submitForm', selector: 'form' },
  { action: 'captureSnapshot' },
  { action: 'getAccessibilityTree' },
  { action: 'getPaintOrder' },
  { action: 'detectClickable' },
  { action: 'waitForElement', selector: 'body', options: { timeout: 1000 } },
  { action: 'checkVisibility', selector: 'body' },
  { action: 'executeSequence', sequence: [{ action: 'query', selector: 'body' }] }
];

for (const op of operations) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'DOM_ACTION',
      requestId: `test-${op.action}`,
      timestamp: Date.now(),
      ...op
    });
    console.log(`✓ ${op.action}:`, response.success ? 'PASS' : 'FAIL');
  } catch (error) {
    console.log(`✗ ${op.action}: ERROR -`, error.message);
  }
}
```

**Success Criteria**:
- [ ] All 25 operations return a response (success or structured error)
- [ ] No "unknown action" errors
- [ ] No silent failures (operations ignored)

---

### Scenario 4: Error Handling Validation

**Purpose**: Verify error messages are clear and actionable

**Test Cases**:

1. **Element Not Found**:
   ```javascript
   const response = await chrome.tabs.sendMessage(tabId, {
     type: 'DOM_ACTION',
     action: 'query',
     selector: '.nonexistent-class-12345',
     requestId: 'test-error-1',
     timestamp: Date.now()
   });
   ```
   **Expected**: Clear error with selector in message

2. **Permission Denied** (navigate to chrome:// URL):
   ```javascript
   await chrome.tabs.update(tabId, { url: 'chrome://extensions' });
   // Try to inject content script
   ```
   **Expected**: Error distinguishes permission denial from other failures

3. **Timeout** (simulate with long-running operation):
   ```javascript
   const response = await chrome.tabs.sendMessage(tabId, {
     type: 'DOM_ACTION',
     action: 'waitForElement',
     selector: '.never-exists',
     options: { timeout: 1000 },
     requestId: 'test-timeout-1',
     timestamp: Date.now()
   });
   ```
   **Expected**: Timeout error with clear message

**Success Criteria**:
- [ ] Errors include error type (ErrorCode)
- [ ] Errors include operation name
- [ ] Errors include suggested action
- [ ] Errors do NOT misreport "permission restriction" when it's actually a communication failure

---

### Scenario 5: Content Script Injection Timing

**Purpose**: Verify race condition handling

**Steps**:

1. **Open new tab and immediately send operation** (before content script loads):
   ```javascript
   const tab = await chrome.tabs.create({ url: 'https://example.com' });
   // Don't wait for load
   const response = await chrome.tabs.sendMessage(tab.id, {
     type: 'DOM_ACTION',
     action: 'query',
     selector: 'body',
     requestId: 'test-race-1',
     timestamp: Date.now()
   });
   ```

2. **Expected Behavior**:
   - DOMTool detects content script not loaded
   - Injects content script programmatically
   - Waits for initialization with exponential backoff
   - Retries operation
   - Returns result or clear error

**Success Criteria**:
- [ ] Operation eventually succeeds (within 3s)
- [ ] No "Could not establish connection" error
- [ ] Retry logic handles timing correctly

---

## Integration Test with LLM

**Purpose**: End-to-end validation with actual LLM agent

**Scenario**: Multi-step workflow

1. **Start conversation**:
   ```
   User: "Go to wikipedia.org, search for 'Chrome extensions', and tell me the first paragraph"
   ```

2. **Expected Agent Behavior**:
   - Open wikipedia.org
   - Wait for page load
   - Inject content script if needed
   - Find search input with DOM query
   - Type "Chrome extensions"
   - Click search button
   - Wait for results
   - Extract first paragraph text
   - Respond with summary

3. **Monitor DevTools**:
   - Background: DOM_ACTION messages for each step
   - Content: Successful operation responses
   - No error messages in console

**Success Criteria**:
- [ ] Agent completes full workflow without errors
- [ ] No misleading error messages shown to user
- [ ] All DOM operations succeed
- [ ] LLM receives accurate information for response

---

## Performance Benchmarks

**Metrics to Collect**:

1. **PING/PONG Latency**:
   - Expected: < 50ms (p50), < 100ms (p99)

2. **Content Script Injection Time**:
   - Expected: < 500ms from injection to PONG response

3. **Simple DOM Operation (query)**:
   - Expected: < 100ms

4. **Complex Operation (captureSnapshot)**:
   - Expected: < 2000ms

**Measurement Script**:
```javascript
async function benchmark(tabId, iterations = 100) {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await chrome.tabs.sendMessage(tabId, {
      type: 'PING',
      requestId: `bench-${i}`,
      timestamp: Date.now()
    });
    const end = performance.now();
    results.push(end - start);
  }

  results.sort((a, b) => a - b);
  console.log('PING/PONG Latency:');
  console.log('  p50:', results[Math.floor(results.length * 0.5)].toFixed(2), 'ms');
  console.log('  p95:', results[Math.floor(results.length * 0.95)].toFixed(2), 'ms');
  console.log('  p99:', results[Math.floor(results.length * 0.99)].toFixed(2), 'ms');
}
```

---

## Troubleshooting

### Issue: PONG not received

**Symptoms**: PING times out, no PONG response

**Checks**:
1. Is content script registered in manifest or injected programmatically?
2. Check content script console for errors
3. Verify message type: MessageType.PING (not string 'PING')
4. Check if PONG handler is registered before sending PING

**Fix**: Ensure content script initialization is synchronous

---

### Issue: DOM operations fail with "unknown action"

**Symptoms**: Operations return error about unsupported action

**Checks**:
1. Verify action name matches DOMActionType
2. Check content script `executeDOMTool()` switch statement
3. Ensure all 25 operations are mapped

**Fix**: Add missing operation handlers to content script

---

### Issue: Still getting "permission restriction" errors

**Symptoms**: Error message mentions permissions despite manifest correct

**Checks**:
1. Verify manifest host_permissions includes target URL
2. Check Chrome permissions UI (chrome://extensions)
3. Try navigating to chrome:// URL to distinguish actual permission denial

**Fix**:
- If on chrome:// URL: This is expected, provide clear error
- If on normal URL: Check error classification logic

---

## Success Checklist

**Core Functionality**:
- [ ] PING/PONG works reliably
- [ ] All 25 DOM operations are supported
- [ ] WSJ.com headline extraction succeeds
- [ ] Content script injection handles race conditions
- [ ] Message types are aligned (DOM_ACTION)

**Error Handling**:
- [ ] Errors are classified correctly
- [ ] Error messages are actionable
- [ ] No misleading "permission" errors for communication failures
- [ ] LLM receives clear error context

**Performance**:
- [ ] PING/PONG < 100ms (p99)
- [ ] Content script injection < 500ms
- [ ] Simple operations < 100ms
- [ ] No memory leaks after 100+ operations

**User Experience**:
- [ ] Agent successfully completes multi-step workflows
- [ ] Error messages help user understand next steps
- [ ] No confusing technical jargon in user-facing errors

---

## Next Steps

After successful quickstart validation:

1. **Run full test suite**: `npm test`
2. **Test on multiple sites**: github.com, twitter.com, news sites
3. **Stress test**: 1000+ operations to check for memory leaks
4. **Cross-browser**: Test on Edge, Brave (Chromium-based)
5. **Update documentation**: Add troubleshooting guide for common issues

---

**Quickstart Complete**: Fix validated and ready for production use
