# Quickstart: DOMTool Content Script Injection Fix

**Feature**: 018-inspect-the-domtool
**Date**: 2025-10-09
**Estimated Time**: 10 minutes

## Objective

Verify that the content script injection fix works correctly and DOM operations function end-to-end.

## Prerequisites

- Chrome browser (or Chromium-based browser)
- Node.js v22+ installed
- codex-chrome repository cloned

## Quick Start

### 1. Build the Extension

```bash
cd codex-chrome
npm install
npm run build
```

**Expected Output**:
```
✓ built in 1.23s
dist/background.js       125.45 kB │ gzip: 34.21 kB
dist/content.js          15.33 kB │ gzip: 4.82 kB
dist/sidepanel.js        67.89 kB │ gzip: 18.45 kB
```

**Verify**:
```bash
ls -l dist/content.js
cat dist/manifest.json | jq '.content_scripts[0].js'
```

Should see:
- `dist/content.js` exists (15KB+ size)
- Manifest references `["content.js"]`

### 2. Load Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select `codex-chrome/dist/` directory
6. Extension should load with "Codex Chrome Agent" name

**Verify Extension Loaded**:
- Check for Codex icon in extensions toolbar
- Click extension → should see "Service Worker (Inactive)" or "(Active)"
- No errors in chrome://extensions page

### 3. Test Basic DOM Operation

**Test Scenario**: Extract page title from example.com

1. Navigate to `https://example.com` in a new tab
2. Click Codex extension icon → Opens side panel
3. In the side panel chat input, type:
   ```
   Extract the page title using the DOM tool
   ```
4. Send the message

**Expected Behavior**:

**✅ SUCCESS** - You should see:
1. Extension injects content script (check console for logs)
2. DOM tool executes `getText` operation on title element
3. Agent responds with: "The page title is 'Example Domain'" (or similar)

**❌ FAILURE** (old bug) - You would see:
```
Error: Failed to inject content script: Error: Could not load file: '/content/content-script.js'
```

### 4. Verify Content Script Injection

**Open Background Service Worker Console**:
1. Go to `chrome://extensions/`
2. Find "Codex Chrome Agent"
3. Click "service worker" link (under "Inspect views")
4. Opens DevTools for background script

**Expected Console Logs**:
```
[DOMTool] Content script injected into tab 123
[DOMTool] Content script already loaded in tab 123 (attempt 1)
```

**No errors about file not found**

**Open Page Console**:
1. On example.com tab, press F12
2. Check Console tab

**Expected Console Logs**:
```
Codex content script initialized
```

### 5. Test Error Handling (Optional)

This step intentionally breaks the fix to verify error messages are clear.

**Temporarily Break the Fix**:
```bash
# Edit DOMTool.ts
sed -i "s|files: \['/content.js'\]|files: \['/wrong-path.js'\]|" src/tools/DOMTool.ts

# Rebuild
npm run build

# Reload extension in chrome://extensions (click reload icon)
```

**Test DOM Operation Again**:
- Try same "Extract page title" request
- Should see clear error:
  ```
  Error: Failed to inject content script: Error: Could not load file: '/wrong-path.js'
  Error Code: SCRIPT_INJECTION_FAILED
  ```

**Restore the Fix**:
```bash
git checkout src/tools/DOMTool.ts
npm run build
# Reload extension
```

### 6. Test Advanced DOM Operations

**Test Click Operation**:
```
user: Click the "More information" link on this page
```

**Expected**: Link should be clicked, navigation should occur

**Test Query Operation**:
```
user: Find all links on this page
```

**Expected**: List of links with their text and URLs

**Test Type Operation** (navigate to a page with form first):
```
user: Go to google.com
user: Type "test query" in the search box
```

**Expected**: Text appears in search input

## Success Criteria

### ✅ Pass Conditions

- [ ] Build completes without errors
- [ ] `dist/content.js` exists and has size > 10KB
- [ ] Manifest references `content.js` (not `content-script.js`)
- [ ] Extension loads in Chrome without errors
- [ ] Content script injects successfully on test page
- [ ] PING/PONG message exchange works
- [ ] DOM tool getText operation returns page title
- [ ] No "Could not load file" errors in console
- [ ] Background worker logs show successful injection

### ❌ Fail Conditions

- Build fails or outputs no files
- `dist/content.js` missing
- Manifest references wrong file (`content/content-script.js`)
- Extension shows errors on chrome://extensions
- "Could not load file: '/content/content-script.js'" error
- Content script doesn't respond to PING
- DOM operations fail with injection errors

## Troubleshooting

### Issue: "Could not load file: 'content.js'"

**Possible Causes**:
1. Build didn't complete
2. Wrong directory loaded in Chrome
3. Manifest mismatch

**Solutions**:
```bash
# Check build output
ls -l dist/content.js

# Verify manifest
cat dist/manifest.json | jq '.content_scripts'

# Rebuild from scratch
rm -rf dist/
npm run build

# Reload extension (chrome://extensions → click reload)
```

### Issue: "Content script failed to respond after 5 attempts"

**Possible Causes**:
1. Content script has errors (check page console)
2. CSP blocking injection (some sites)
3. Timeout too short (network latency)

**Solutions**:
```bash
# Check page console for errors
# F12 → Console tab → look for red errors

# Try different test site
# Example.com usually works, some sites block extensions

# Check content script loaded
# In page console, type: window.__codexUtils
# Should return an object if script loaded
```

### Issue: Tool definition errors

**Possible Causes**:
1. Transformation logic incorrect
2. Nested 'function' property in API call
3. Wrong API format for Responses API

**Solutions**:
```bash
# Check background console logs
# Look for: "[OpenAIResponsesClient] Unknown tool type"

# Verify tool definitions
# In background console:
# chrome.storage.local.get('tools', console.log)

# Check network tab for API requests
# Look at payload sent to api.openai.com/v1/responses
# Tool definitions should be flat structure (no 'function' wrapper)
```

### Issue: Extension won't load

**Error**: "Manifest file is invalid"

**Solutions**:
```bash
# Validate manifest.json
cat dist/manifest.json | jq .

# Check for syntax errors
# Common issues:
# - Missing commas
# - Wrong quote types
# - Invalid JSON

# Copy from source if corrupted
cp manifest.json dist/manifest.json
```

## Verification Checklist

Run through this checklist to ensure everything works:

```bash
# 1. Build succeeds
npm run build && echo "✅ Build succeeded" || echo "❌ Build failed"

# 2. Content script exists
test -f dist/content.js && echo "✅ content.js exists" || echo "❌ content.js missing"

# 3. Manifest references correct file
MANIFEST_FILE=$(jq -r '.content_scripts[0].js[0]' dist/manifest.json)
[ "$MANIFEST_FILE" = "content.js" ] && echo "✅ Manifest correct" || echo "❌ Manifest wrong: $MANIFEST_FILE"

# 4. File path in code matches manifest (requires grep)
grep -q "files: \['/content.js'\]" src/tools/DOMTool.ts && echo "✅ Code path correct" || echo "❌ Code path wrong"
```

## Performance Benchmarks

Expected performance after fix:

- **Content Script Injection**: <50ms (first injection)
- **PING Response**: <10ms (script already loaded)
- **DOM Query Operation**: <100ms (simple selector)
- **DOM Click Operation**: <50ms (element exists)

**Measure in DevTools**:
```javascript
// In background console
console.time('injection')
domTool.ensureContentScriptInjected(tabId)
  .then(() => console.timeEnd('injection'))
```

## Next Steps

After verifying the quickstart works:

1. **Run Full Test Suite**:
   ```bash
   npm test
   ```

2. **Test on Real Websites**:
   - News sites (WSJ, NYT)
   - Social media (Twitter, Reddit)
   - Complex SPAs (Gmail, Notion)

3. **Verify Different Browsers**:
   - Chrome (primary)
   - Edge (Chromium-based)
   - Brave (Chromium-based)

4. **Load Testing**:
   - Inject into multiple tabs simultaneously
   - Rapid-fire DOM operations
   - Large pages with many elements

## Cleanup

```bash
# Remove test changes
git checkout src/tools/DOMTool.ts

# Rebuild clean version
npm run build

# Reload extension in Chrome
# chrome://extensions → Click reload icon
```

## References

- [Chrome Extension Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [File Paths Contract](./contracts/file-paths.md)
