# Quickstart: Content Script Communication Debugging

**Feature**: 019-debug-and-fix
**Date**: 2025-10-09
**Estimated Time**: 10 minutes

## Objective

Diagnose and verify the fix for "Could not establish connection. Receiving end does not exist" error when DOMTool attempts to communicate with content script.

## Prerequisites

- Chrome browser (or Chromium-based: Edge, Brave)
- Node.js v22+ installed
- codex-chrome repository cloned
- Built extension with diagnostic logging (see build step)

## Quick Diagnostic (5 minutes)

### Step 1: Build Extension with Diagnostics

```bash
cd codex-chrome
npm install
npm run build
```

**Expected Output**:
```
✓ built in 1.80s
dist/content.js          15.33 kB │ gzip: 4.68 kB
dist/background.js      358.39 kB │ gzip: 88.32 kB
```

**Verify**:
```bash
ls -l dist/content.js dist/background.js
```

Both files should exist.

### Step 2: Load Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select `codex-chrome/dist/` directory
6. Extension should load with "Codex Chrome Agent" name

**Verify Extension Loaded**:
- Check for Codex icon in extensions toolbar
- Click extension → should see "Service Worker (Inactive)" or "(Active)"
- No errors on chrome://extensions page

### Step 3: Open Test Page and Consoles

**A. Open Test Page**:
1. Navigate to `https://example.com` in a new tab
2. Keep this tab active

**B. Open Page Console**:
1. Press F12 on example.com tab
2. Click "Console" tab
3. Leave this console open

**C. Open Background Console**:
1. Go back to `chrome://extensions/`
2. Find "Codex Chrome Agent"
3. Click "service worker" link under "Inspect views"
4. Opens DevTools for background script
5. Click "Console" tab

### Step 4: Verify Content Script Loaded

**In Page Console** (example.com F12):

Look for these logs:
```
Codex content script initialized
[MessageRouter] setupMessageListener called, source = content
[MessageRouter] Listener registered successfully
```

**✅ SUCCESS**: All logs appear → Content script loaded and listener registered

**❌ FAILURE**: Missing logs → See Troubleshooting section

### Step 5: Test PING/PONG Health Check

**In Background Console** (service worker DevTools):

Run this command:
```javascript
// Get active tab ID
const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
const tabId = tabs[0].id;

// Send PING
console.log('[Test] Sending PING to tab', tabId);
const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
console.log('[Test] Received PONG:', response);
```

**Expected Output**:
```javascript
[Test] Sending PING to tab 123
[Test] Received PONG: {
  type: 'PONG',
  timestamp: 1696800000000,
  initLevel: 4,
  readyState: 'complete',
  version: '1.0.0',
  capabilities: ['dom', 'events', 'forms', 'accessibility']
}
```

**✅ SUCCESS**: PONG received with initLevel >= 2

**❌ FAILURE**: Error "Could not establish connection" → See Troubleshooting

### Step 6: Test DOM Operation

**In Background Console**:

```javascript
// Test actual DOM operation
const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
const tabId = tabs[0].id;

// Simulate DOMTool PING check
try {
  const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  console.log('✅ Content script ready, initLevel:', response.initLevel);
} catch (error) {
  console.error('❌ Content script not responding:', error.message);
}
```

**Expected**: "✅ Content script ready, initLevel: 4"

## Full Diagnostic Procedure (10 minutes)

### Diagnostic 1: Verify Initialization Sequence

**Page Console** should show logs in this order:

1. `Codex content script initialized`
2. `[MessageRouter] setupMessageListener called, source = content`
3. `[MessageRouter] typeof chrome = object`
4. `[MessageRouter] chrome.runtime exists = true`
5. `[MessageRouter] Registering chrome.runtime.onMessage listener`
6. `[MessageRouter] Listener registered successfully`

**Analysis**:
- Missing log 1 → Script not loading
- Missing logs 2-6 → MessageRouter not created
- Stops at log 4 → chrome.runtime not available (serious issue)
- Stops at log 5 → Listener registration failed

### Diagnostic 2: Verify Message Flow

**A. Send PING** (background console):
```javascript
await chrome.tabs.sendMessage(tabId, { type: 'PING' });
```

**B. Check Page Console** for:
```
[MessageRouter] Message received: PING
```

**C. Check Background Console** for PONG response

**Analysis**:
- No "Message received" log → Listener not registered or not reached
- "Message received" but no PONG → Handler error
- PONG received → ✅ Working!

### Diagnostic 3: Check Init Level Progression

**Run multiple PINGs** with delays:

```javascript
async function checkInitLevel() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0].id;

  for (let i = 0; i < 5; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      console.log(`Attempt ${i + 1}: initLevel = ${response.initLevel}`);
    } catch (error) {
      console.log(`Attempt ${i + 1}: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

await checkInitLevel();
```

**Expected Output**:
```
Attempt 1: initLevel = 4
Attempt 2: initLevel = 4
Attempt 3: initLevel = 4
Attempt 4: initLevel = 4
Attempt 5: initLevel = 4
```

**Analysis**:
- All attempts at level 4 → ✅ Fully initialized
- Progression 2 → 3 → 4 → ✅ Normal initialization
- All attempts fail → Listener not registered
- initLevel stuck at 1 → Router not created
- initLevel stuck at 2 → DOM not ready (acceptable)

### Diagnostic 4: Verify File Paths

**Check dist/ directory**:
```bash
ls -l codex-chrome/dist/content.js
cat codex-chrome/dist/manifest.json | jq '.content_scripts[0].js'
```

**Expected**:
- `content.js` exists (15KB+)
- Manifest references `["content.js"]`

**Analysis**:
- File missing → Build failed
- Manifest wrong → Path mismatch
- File empty → Build error

### Diagnostic 5: Check for JavaScript Errors

**Page Console** - look for red error messages:

Common errors:
- `Uncaught ReferenceError` → Missing import
- `Uncaught TypeError` → Undefined variable
- `Cannot read property of undefined` → Object not initialized

**Fix**: Resolve errors before proceeding

## Troubleshooting

### Issue 1: "Codex content script initialized" Log Missing

**Possible Causes**:
1. Script not injected (file path wrong)
2. Script injected but threw exception before log
3. Wrong tab selected

**Solutions**:
```bash
# 1. Verify file exists
ls codex-chrome/dist/content.js

# 2. Check manifest
cat codex-chrome/dist/manifest.json | jq '.content_scripts'

# 3. Reload extension
# chrome://extensions → Click reload icon on Codex extension

# 4. Hard refresh page
# Ctrl+Shift+R (or Cmd+Shift+R on Mac)

# 5. Check Sources tab in page DevTools
# Should see "content.js" in file tree under chrome-extension://...
```

### Issue 2: "MessageRouter" Logs Missing

**Possible Causes**:
1. Exception during MessageRouter construction
2. initialize() not called
3. Diagnostic logging not added yet

**Solutions**:
```bash
# 1. Check for errors in page console (red text)

# 2. Verify initialize() is called
# Search page console for any logs from content-script.ts

# 3. Add breakpoint in content-script.ts
# DevTools → Sources → content.js → Line 1024 (initialize call)
# Reload page and verify breakpoint hits
```

### Issue 3: "Listener registered successfully" But PING Fails

**Possible Causes**:
1. Listener registered on wrong tab
2. Message not reaching content script
3. chrome.tabs.sendMessage targeting wrong tab ID

**Solutions**:
```javascript
// Verify correct tab ID
const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
console.log('Active tab:', tabs[0]);  // Should match example.com

// Check all tabs
const allTabs = await chrome.tabs.query({});
console.log('All tabs:', allTabs.map(t => ({ id: t.id, url: t.url })));

// Try sending to specific URL
const exampleTab = await chrome.tabs.query({ url: 'https://example.com/*' });
if (exampleTab.length > 0) {
  const response = await chrome.tabs.sendMessage(exampleTab[0].id, { type: 'PING' });
  console.log('Response:', response);
}
```

### Issue 4: PONG initLevel = 1 (INJECTED)

**Cause**: Router not created (router = null)

**Solutions**:
1. Check for exception during MessageRouter construction
2. Verify new MessageRouter('content') completes
3. Check router variable is set (add log: `console.log('router =', router)`)

### Issue 5: PONG initLevel = 2 (HANDLERS_READY) Never Progresses

**Cause**: DOM stuck in 'loading' state (rare)

**This is OK**: initLevel 2 is sufficient for message handling. DOM operations may need to wait.

**Verification**:
```javascript
// In page console
console.log('readyState:', document.readyState);
// Should be 'interactive' or 'complete'
```

### Issue 6: Extension Reload Required

**When to Reload**:
- After code changes
- After adding diagnostic logging
- After fixing bugs

**How to Reload**:
1. Go to chrome://extensions
2. Find "Codex Chrome Agent"
3. Click reload icon (circular arrow)
4. Hard refresh all open tabs (Ctrl+Shift+R)

## Success Criteria

**All checks passing** ✅:
- [ ] dist/content.js exists (15KB+)
- [ ] Manifest references "content.js"
- [ ] Extension loads without errors
- [ ] "Codex content script initialized" log appears
- [ ] "Listener registered successfully" log appears
- [ ] PING returns PONG response
- [ ] PONG initLevel >= 2
- [ ] No JavaScript errors in page console
- [ ] No "Could not establish connection" errors

**Pass**: All checks ✅ → Content script communication working

**Fail**: Any check ❌ → See specific troubleshooting above

## Performance Benchmarks

**Expected Performance**:
- Content script initialization: <200ms
- PING response time: <100ms
- initLevel progression to 4: <500ms (depends on page load)

**Measure Performance**:
```javascript
// In background console
async function measurePingLatency(tabId, iterations = 10) {
  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    const latency = performance.now() - start;
    latencies.push(latency);
    console.log(`PING ${i + 1}: ${latency.toFixed(2)}ms`);
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const max = Math.max(...latencies);
  console.log(`Average: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
}

const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
await measurePingLatency(tabs[0].id);
```

**Expected Output**:
```
PING 1: 12.34ms
PING 2: 8.56ms
PING 3: 9.12ms
...
Average: 10.23ms, Max: 15.67ms
```

**Acceptable**: Average <100ms, Max <500ms

**Unacceptable**: Average >500ms → Performance issue

## Next Steps

After quickstart passes:
1. **Run Full Test Suite**: `npm test`
2. **Test on Complex Pages**: Try Gmail, Twitter, Reddit
3. **Test Edge Cases**: Slow loading pages, CSP-protected sites
4. **Stress Test**: Rapid-fire DOM operations, multiple tabs
5. **Cross-Browser**: Test on Edge, Brave (Chromium-based)

## Cleanup

```bash
# Remove verbose diagnostic logs after fix verified
# Keep key checkpoints:
# - "Codex content script initialized"
# - "Listener registered successfully"
# Remove detailed MessageRouter logs
```

## References

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Content Script Lifecycle Contract](./contracts/content-script-lifecycle.md)
- [Chrome Extension Messaging API](https://developer.chrome.com/docs/extensions/mv3/messaging/)
