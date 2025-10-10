# Troubleshooting Guide: Content Script Communication

**Feature**: 019-debug-and-fix
**Date**: 2025-10-09
**Version**: 1.0.0

## Overview

This guide helps diagnose and resolve communication issues between the background script and content scripts in the Codex Chrome extension.

## Common Issues

### Issue 1: "Could not establish connection. Receiving end does not exist"

**Symptom**: DOMTool operations fail with this error when attempting to communicate with content script.

**Root Cause**: Content script message listener not registered or not ready when background script sends message.

**Diagnosis Steps**:

1. **Check if content script loaded**:
   - Open page console (F12 on target webpage)
   - Look for: `[Codex] Content script initializing...`
   - If missing → Content script not loaded (see Solution A)
   - If present → Continue to step 2

2. **Check if listener registered**:
   - In page console, look for: `[MessageRouter] Listener registered successfully`
   - If missing → Listener registration failed (see Solution B)
   - If present → Timing issue (see Solution C)

3. **Test PING/PONG manually**:
   - Open background console (chrome://extensions → service worker)
   - Run:
     ```javascript
     const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
     const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' });
     console.log('PONG:', response);
     ```
   - If succeeds → Transient issue, retry operation
   - If fails → Apply solutions below

**Solution A: Content Script Not Loading**

1. Verify file exists:
   ```bash
   ls codex-chrome/dist/content.js
   ```

2. Check manifest.json references correct file:
   ```bash
   cat codex-chrome/dist/manifest.json | grep -A5 content_scripts
   ```
   Should show: `"js": ["content.js"]`

3. Reload extension:
   - Go to chrome://extensions
   - Click reload icon on Codex extension
   - Hard refresh target page (Ctrl+Shift+R)

4. Check for CSP restrictions:
   - Some pages block script injection (chrome:// pages, some corporate sites)
   - Try on https://example.com first to verify extension works

**Solution B: Listener Registration Failed**

1. Check for JavaScript errors:
   - Page console should show any errors
   - Common issues: Missing imports, undefined variables

2. Verify chrome.runtime available:
   - In page console: `console.log(typeof chrome, chrome?.runtime)`
   - Should show: `object` and a runtime object
   - If undefined → Browser compatibility issue

3. Check MessageRouter initialization:
   - Look for: `[MessageRouter] setupMessageListener called, source = content`
   - If missing → MessageRouter constructor not called
   - If present but no "Listener registered successfully" → Check for error logs

**Solution C: Timing Issue**

Already fixed in this implementation (T011 + T014), but if issue persists:

1. Increase initialization delay:
   - Edit `src/tools/DOMTool.ts`
   - Change line after injection: `setTimeout(resolve, 300)` → `setTimeout(resolve, 500)`

2. Check initLevel in PONG:
   - Background console shows: `Content script ready (initLevel: X)`
   - If initLevel < 2 → Script still initializing
   - Should succeed on retry automatically

### Issue 2: Content Script Works on Some Pages, Fails on Others

**Symptom**: Extension works on example.com but fails on specific websites.

**Root Cause**: Different pages have different loading characteristics, CSP policies, or script execution order.

**Diagnosis**:

1. **Check page type**:
   - chrome:// pages → Extensions cannot inject scripts
   - file:// URLs → Requires "Allow access to file URLs" permission
   - HTTPS pages → Should work (if issue persists, see below)

2. **Test on standard page first**:
   - Navigate to https://example.com
   - If works there but fails elsewhere → CSP or page-specific issue

3. **Check for CSP violations**:
   - Page console may show: "Refused to execute inline script..."
   - Some sites have strict Content Security Policies

**Solution**:

1. For CSP-blocked pages:
   - Codex cannot inject scripts on these pages by design
   - This is a Chrome security limitation, not a bug

2. For slow-loading pages:
   - Implemented fix (300ms delay) should handle most cases
   - If still failing, verify initLevel check is working:
     ```javascript
     // Background console
     const tabs = await chrome.tabs.query({ active: true });
     const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' });
     console.log('Init level:', response.data?.initLevel);
     // Should be >= 2
     ```

### Issue 3: PONG Response Has Low initLevel

**Symptom**: PING succeeds but initLevel is 1 or undefined.

**Root Cause**: Content script loaded but MessageRouter not created yet.

**Diagnosis**:

1. Check page console for initialization sequence:
   ```
   [Codex] Content script initializing...
   [Codex] Creating MessageRouter with source: content
   [Codex] MessageRouter created, router = ...
   [Codex] Setting up message handlers...
   [Codex] Initialization complete
   ```

2. If sequence is incomplete → Exception during initialization

**Solution**:

1. Find the error:
   - Look for red error messages in page console
   - Common issues: Import failures, undefined variables

2. Fix identified error and rebuild:
   ```bash
   cd codex-chrome && npm run build
   ```

3. Reload extension and test again

### Issue 4: Multiple PONG Responses

**Symptom**: Single PING receives multiple PONG responses.

**Root Cause**: Duplicate message listeners registered (violates INV-4).

**Diagnosis**:

1. Check how many times MessageRouter is created:
   - Page console should show ONE "[MessageRouter] setupMessageListener called"
   - If multiple → Duplicate routers

**Solution**:

1. Verify singleton pattern in content-script.ts:
   ```typescript
   let router: MessageRouter | null = null;

   function initialize(): void {
     if (router) {
       console.warn('Router already initialized');
       return;
     }
     router = new MessageRouter('content');
     // ...
   }
   ```

2. Ensure initialize() called only once at module level

### Issue 5: Extension Permissions Denied

**Symptom**: Extension fails to inject script with permissions error.

**Root Cause**: Missing required permissions or user denied permissions.

**Diagnosis**:

1. Check extension permissions:
   - chrome://extensions → Click "Details" on Codex extension
   - Should see: "Access to read and change all data on websites you visit"

2. Check manifest.json:
   ```json
   "permissions": ["activeTab", "scripting", "storage"],
   "host_permissions": ["<all_urls>"]
   ```

**Solution**:

1. Grant permissions:
   - Reload extension
   - Accept permission prompts
   - Restart browser if needed

2. Verify permissions granted:
   ```javascript
   // Background console
   const perms = await chrome.permissions.getAll();
   console.log(perms);
   ```

## Diagnostic Commands

### Background Console Commands

Open service worker console (chrome://extensions → service worker link):

```javascript
// Get active tab and test PING
const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
const tabId = tabs[0].id;
const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
console.log('PONG:', response);

// Measure latency
async function measureLatency(iterations = 10) {
  const latencies = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    latencies.push(performance.now() - start);
  }
  const avg = latencies.reduce((a, b) => a + b) / latencies.length;
  console.log(`Average: ${avg.toFixed(2)}ms`);
  return avg;
}
await measureLatency();

// Check init level
async function checkInitLevel() {
  const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  const pongData = response?.success ? response.data : response;
  console.log('InitLevel:', pongData.initLevel);
  console.log('ReadyState:', pongData.readyState);
  console.log('Capabilities:', pongData.capabilities);
}
await checkInitLevel();
```

### Page Console Commands

Open page DevTools (F12 on target webpage):

```javascript
// Check if router exists
console.log('Router:', window.router || 'not found');

// Check if enhancement scripts loaded
console.log('Codex utils:', typeof window.__codexUtils);

// Manually get init level
function getInitLevel() {
  if (!window.router) return 1;
  if (document.readyState === 'loading') return 2;
  if (document.readyState === 'interactive') return 3;
  return 4;
}
console.log('Current init level:', getInitLevel());
```

## Performance Benchmarks

### Expected Performance

| Metric | Target | Maximum | Unacceptable |
|--------|--------|---------|--------------|
| PING latency (avg) | <50ms | <100ms | >500ms |
| PING latency (max) | <100ms | <500ms | >1000ms |
| Content script init | <100ms | <300ms | >1000ms |
| InitLevel 2 reached | <200ms | <500ms | >1000ms |

### Measuring Performance

Use the diagnostic commands above (`measureLatency()`).

## Known Limitations

### 1. Privileged Pages

**Cannot inject on**:
- chrome:// pages (chrome://extensions, chrome://settings, etc.)
- chrome-extension:// pages (other extensions)
- Browser internal pages

**Reason**: Chrome security restrictions prevent extensions from accessing these pages.

### 2. CSP-Protected Pages

**May fail on**:
- Corporate sites with strict CSP
- Some banking/financial sites
- Government websites

**Reason**: Content Security Policy blocks script injection.

**Workaround**: None available - this is by design for security.

### 3. Very Slow Pages

**May require extra time**:
- Pages with 10+ seconds load time
- Pages with heavy JavaScript frameworks
- Pages with slow network

**Solution**: Current implementation (300ms delay + exponential backoff) handles most cases. If issue persists, increase delay.

## Debug Mode

To enable verbose logging:

1. **Temporary (current session)**:
   - Diagnostic logs already added in this implementation
   - All key checkpoints logged with [Codex] or [MessageRouter] prefixes

2. **Reduce logging after verification**:
   - See T022 in tasks.md
   - Keep essential logs, remove verbose diagnostics

## Getting Help

If issues persist after following this guide:

1. **Collect diagnostic information**:
   - Extension version
   - Chrome version
   - URL where issue occurs
   - Page console logs
   - Background console logs
   - PING test results

2. **Report issue**:
   - Create issue in repository
   - Include collected information
   - Describe expected vs actual behavior

## Related Documentation

- [Quickstart Guide](./quickstart.md) - Step-by-step diagnostic procedure
- [Diagnostic Findings](./DIAGNOSTIC_FINDINGS.md) - Automated diagnosis results
- [Content Script Lifecycle Contract](./contracts/content-script-lifecycle.md) - Technical specification
- [Research Document](./research.md) - Root cause analysis

## Changelog

**v1.0.0 (2025-10-09)**:
- Initial troubleshooting guide
- Covers 5 common issues
- Includes diagnostic commands
- Documents performance benchmarks
- Lists known limitations
