# Research: DOMTool Content Script Injection Error

**Date**: 2025-10-09
**Feature**: 018-inspect-the-domtool

## Research Objective

Investigate the root cause of content script injection failure: "Could not load file: 'content/content-script.js'"

## Methodology

1. Analyze build configuration (vite.config.mjs)
2. Verify manifest.json content script references
3. Examine DOMTool.ts hardcoded file paths
4. Compare expected vs actual file paths at runtime

## Findings

### Finding 1: Vite Build Output Configuration

**File**: `codex-chrome/vite.config.mjs`

```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/content-script.ts'),  // Line 14
      },
      output: {
        entryFileNames: '[name].js',  // Line 19: Uses input key as filename
      }
    },
    outDir: 'dist',
  }
});
```

**Key Insight**: The `entryFileNames: '[name].js'` pattern uses the input object key (`content`), NOT the source filename (`content-script`). Therefore:
- Input key: `content`
- Output file: `dist/content.js` (NOT `content-script.js`)

**Verification**:
```bash
$ ls -l codex-chrome/dist/content*
-rw-rw-r-- 1 irichard irichard 15328 Oct  9 15:20 dist/content.js
-rw-rw-r-- 1 irichard irichard 48307 Oct  9 15:20 dist/content.js.map
```

✅ Confirmed: Build outputs `content.js`

### Finding 2: Manifest Content Script Reference

**File**: `codex-chrome/manifest.json` (both source and dist)

```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],  // Line 38
    "run_at": "document_idle"
  }]
}
```

✅ Confirmed: Manifest correctly references `content.js`

### Finding 3: DOMTool Hardcoded File Path

**File**: `codex-chrome/src/tools/DOMTool.ts`

```typescript
private async ensureContentScriptInjected(tabId: number): Promise<void> {
  // ...
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['/content/content-script.js'],  // Line 944: INCORRECT PATH
    });
    // ...
  }
}
```

❌ **Problem**: Hardcoded path `/content/content-script.js` does NOT match:
- Vite output: `content.js`
- Manifest reference: `content.js`
- Actual file location: `dist/content.js`

### Finding 4: Chrome Extension File Path Semantics

**Chrome API Documentation**: `chrome.scripting.executeScript({ files: [...] })`

File paths in the `files` array are:
1. Relative to the extension root (where manifest.json is located)
2. Must match exactly the files present in the extension package
3. Do NOT include the `dist/` directory prefix (it's implied)

**Examples**:
- ✅ Correct: `/content.js` (file at extension root)
- ✅ Correct: `/subdir/file.js` (file in subdirectory)
- ❌ Wrong: `/dist/content.js` (dist is build artifact, not in packaged extension)
- ❌ Wrong: `/content/content-script.js` (file doesn't exist)

## Root Cause

**File Path Mismatch Between Code and Build Output**

| Component | Expected Path | Actual Path | Match |
|-----------|--------------|-------------|-------|
| Vite Build | `content.js` | `content.js` | ✅ |
| Manifest | `content.js` | `content.js` | ✅ |
| DOMTool Code | `/content/content-script.js` | `/content.js` | ❌ |
| File System | `dist/content.js` | `dist/content.js` | ✅ |

**Error Chain**:
1. DOMTool calls `chrome.scripting.executeScript({ files: ['/content/content-script.js'] })`
2. Chrome looks for `/content/content-script.js` in extension root
3. File doesn't exist (only `/content.js` exists)
4. Chrome throws: "Could not load file: '/content/content-script.js'"
5. DOMTool wraps error: "Failed to inject content script: ..."

## Decisions

### Decision 1: File Path Fix

**Question**: What file path should DOMTool.ts use?

**Answer**: `/content.js`

**Rationale**:
- Matches Vite build output
- Matches manifest reference
- Simplest fix (one-line change)
- No build configuration changes needed

**Alternatives Rejected**:
1. **Change Vite config to output `content/content-script.js`**
   - Would require directory structure change
   - Would require manifest update
   - More complex, higher risk

2. **Use environment variable for file path**
   - Adds unnecessary complexity
   - Runtime configuration for static file path is overkill
   - Makes code harder to understand

3. **Dynamic path detection**
   - Over-engineered solution
   - File path won't change at runtime
   - Adds maintenance burden

### Decision 2: Verification Strategy

**Question**: How do we prevent this issue from recurring?

**Answer**: Add integration test that verifies file path matches manifest

**Test Approach**:
```typescript
it('should use file path matching manifest content_scripts', async () => {
  const manifest = require('../../manifest.json')
  const expectedPath = manifest.content_scripts[0].js[0]

  // Verify DOMTool uses the same path
  expect(CONTENT_SCRIPT_PATH).toBe('/' + expectedPath)
})
```

### Decision 3: Documentation

**Question**: How do we document this constraint?

**Answer**: Add comments in three locations:
1. vite.config.mjs - explain entryFileNames pattern
2. DOMTool.ts - link file path to manifest
3. manifest.json - note connection to build config

## Best Practices Applied

### Chrome Extension Content Scripts

**Loading Methods**:
1. **Declarative** (manifest.json): Scripts loaded automatically on page load
2. **Programmatic** (chrome.scripting.executeScript): Scripts injected on demand

This extension uses BOTH:
- Manifest declares content.js for automatic loading
- DOMTool injects on-demand as fallback when automatic loading fails

**Best Practice**: File paths MUST be consistent across all references:
- manifest.json content_scripts
- chrome.scripting.executeScript calls
- Build output filenames

### Vite Build Configuration

**Entry Points**:
```javascript
input: {
  content: 'src/content/content-script.ts'
}
```

The object key (`content`) becomes the output filename when using `[name]` placeholder.

**Best Practice**: Use descriptive, short key names that match desired output filenames:
- ✅ `content` → `content.js`
- ✅ `background` → `background.js`
- ❌ `content-script` → `content-script.js` (unnecessarily verbose)

### Error Messages

**Current Error**: "Failed to inject content script: Error: Could not load file: 'content/content-script.js'"

**Improvement Opportunities**:
1. Parse Chrome error to extract file path
2. Suggest checking manifest.json
3. Provide build output location for debugging

**Example**:
```
Error: Failed to inject content script
Attempted path: '/content/content-script.js'
File not found. Check:
1. Does this path match manifest.json content_scripts?
2. Does this file exist in build output (dist/)?
3. Did the build complete successfully?
```

## Risks & Mitigation

### Risk 1: Breaking Other Injection Points

**Risk**: Other code may also hardcode content script paths

**Mitigation**: Search codebase for other references
```bash
grep -r "content-script" codex-chrome/src/
```

**Finding**: Only DOMTool.ts references this path

### Risk 2: Build Output Changes

**Risk**: Future Vite config changes could break file paths again

**Mitigation**:
1. Add integration test checking file path consistency
2. Document the constraint in vite.config.mjs comments
3. Add build-time validation script

### Risk 3: Manifest Updates

**Risk**: Someone updates manifest.json without updating code

**Mitigation**:
1. Extract file path to constant
2. Reference constant from tests
3. Consider reading manifest.json at build time

## Next Steps

1. ✅ Update DOMTool.ts line 944: `/content/content-script.js` → `/content.js`
2. ⏳ Add integration test verifying file path consistency
3. ⏳ Add comments documenting file path constraint
4. ⏳ Run quickstart scenario to verify fix

## References

- [Chrome Extension Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/)
- [Vite Build Configuration](https://vitejs.dev/config/build-options.html)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/manifest/)
