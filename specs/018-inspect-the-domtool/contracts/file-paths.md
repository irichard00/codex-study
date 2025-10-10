# Contract: Content Script File Path Configuration

**Feature**: 018-inspect-the-domtool
**Date**: 2025-10-09
**Status**: Active

## Overview

This contract defines the invariants that MUST be maintained for content script file path configuration across the Chrome extension build process, manifest, and code.

## Participants

1. **Vite Build System** (vite.config.mjs)
2. **Chrome Extension Manifest** (manifest.json)
3. **DOMTool Implementation** (src/tools/DOMTool.ts)
4. **Chrome Extension Runtime** (chrome.scripting API)

## Contract Specification

### Build Output Contract

**Vite Configuration**:
```typescript
interface ViteBuildContract {
  input: {
    content: string  // Path to source file
  }
  output: {
    entryFileNames: string  // Pattern: '[name].js'
  }
  outDir: string  // Output directory: 'dist'
}
```

**Invariant**:
```
Input key "content" + Pattern "[name].js" → Output file "content.js"
```

**Example**:
```javascript
// vite.config.mjs
{
  input: {
    content: resolve(__dirname, 'src/content/content-script.ts')
  },
  output: {
    entryFileNames: '[name].js'
  }
}
// Results in: dist/content.js
```

### Manifest Contract

**Manifest Content Scripts Declaration**:
```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["${OUTPUT_FILENAME}"],
    "run_at": "document_idle"
  }]
}
```

**Invariant**:
```
manifest.content_scripts[0].js[0] MUST equal Vite output filename
```

**Example**:
```json
{
  "content_scripts": [{
    "js": ["content.js"]  // Must match Vite output
  }]
}
```

### Code Reference Contract

**DOMTool Content Script Injection**:
```typescript
chrome.scripting.executeScript({
  target: { tabId: number },
  files: ["/${MANIFEST_CONTENT_SCRIPT}"]
})
```

**Invariant**:
```
files[0] MUST equal '/' + manifest.content_scripts[0].js[0]
```

**Example**:
```typescript
// DOMTool.ts
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['/content.js']  // Must match manifest
})
```

## Contract Invariants

### CI-1: Output Filename Consistency

**Rule**: The Vite build output filename MUST match the manifest content_scripts filename.

**Verification**:
```typescript
const manifest = require('../manifest.json')
const viteConfig = require('../vite.config.mjs')

const manifestFilename = manifest.content_scripts[0].js[0]
const viteInputKey = Object.keys(viteConfig.build.rollupOptions.input)[0]
const expectedOutput = `${viteInputKey}.js`

assert(manifestFilename === expectedOutput,
  `Manifest references ${manifestFilename} but Vite outputs ${expectedOutput}`)
```

### CI-2: Code Reference Path Match

**Rule**: All chrome.scripting.executeScript calls MUST use file paths matching the manifest.

**Verification**:
```typescript
const CONTENT_SCRIPT_PATH = '/content.js'
const manifest = require('../../manifest.json')
const expectedPath = '/' + manifest.content_scripts[0].js[0]

assert(CONTENT_SCRIPT_PATH === expectedPath,
  `Code uses ${CONTENT_SCRIPT_PATH} but manifest declares ${expectedPath}`)
```

### CI-3: File Path Format

**Rule**: File paths in chrome.scripting.executeScript MUST:
1. Start with `/` (relative to extension root)
2. NOT include `dist/` prefix (implied by build)
3. Match a file that exists in the build output

**Verification**:
```typescript
const fs = require('fs')
const path = '/content.js'

assert(path.startsWith('/'), 'Path must start with /')
assert(!path.includes('/dist/'), 'Path must not include dist/')
assert(fs.existsSync(`./dist${path}`), `File must exist at dist${path}`)
```

### CI-4: Extension Name Pattern

**Rule**: The file extension MUST be `.js` (even for TypeScript sources).

**Verification**:
```typescript
const filename = 'content.js'
assert(filename.endsWith('.js'), 'Output must be .js file')
```

## Error Conditions

### EC-1: File Not Found

**Condition**: chrome.scripting.executeScript receives path to non-existent file

**Error Message**:
```
Could not load file: '/content/content-script.js'
```

**Root Cause**: File path in code doesn't match build output

**Resolution**: Update file path to match manifest and build output

### EC-2: Permission Denied

**Condition**: Extension lacks permission to inject script on target domain

**Error Message**:
```
Cannot access contents of url "chrome://...". Extension manifest must request permission to access this host.
```

**Root Cause**: host_permissions doesn't include target URL

**Resolution**: Different error, not related to file path

### EC-3: Content Security Policy Violation

**Condition**: Target page CSP blocks script injection

**Error Message**:
```
Refused to execute inline script because it violates the following Content Security Policy directive: ...
```

**Root Cause**: Website CSP, not file path issue

**Resolution**: Different error, not related to file path

## Testing Requirements

### TR-1: Build Output Verification

**Test**: Verify Vite outputs file matching manifest reference

```bash
npm run build
FILE=$(jq -r '.content_scripts[0].js[0]' dist/manifest.json)
test -f "dist/$FILE" || exit 1
```

### TR-2: Path Consistency Integration Test

**Test**: Verify DOMTool uses correct file path

```typescript
describe('DOMTool File Path Contract', () => {
  it('should use file path matching manifest', () => {
    const manifest = require('../../manifest.json')
    const expectedPath = '/' + manifest.content_scripts[0].js[0]

    const domTool = new DOMTool()
    const actualPath = domTool.getContentScriptPath()

    expect(actualPath).toBe(expectedPath)
  })
})
```

### TR-3: End-to-End Injection Test

**Test**: Verify content script actually injects

```typescript
describe('Content Script Injection E2E', () => {
  it('should inject content script successfully', async () => {
    const tabId = await createTestTab('https://example.com')
    const domTool = new DOMTool()

    await domTool.ensureContentScriptInjected(tabId)

    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    expect(response.type).toBe('PONG')
  })
})
```

## Change Management

### When to Update This Contract

1. **Vite config changes**: Updating entryFileNames pattern
2. **Build output changes**: Moving to different bundler
3. **Manifest changes**: Renaming content script file
4. **Code refactoring**: Moving DOMTool injection logic

### Update Checklist

When modifying content script file paths:

- [ ] Update vite.config.mjs input key name
- [ ] Update manifest.json content_scripts.js array
- [ ] Update DOMTool.ts file path constant
- [ ] Run build: `npm run build`
- [ ] Verify dist/manifest.json matches source manifest.json
- [ ] Run integration tests: `npm test`
- [ ] Update this contract if invariants change

## Compliance

**Last Verified**: 2025-10-09
**Compliance Status**: ✅ **COMPLIANT** (Fixed 2025-10-09)

**Resolution**:
- CI-2 violation resolved: DOMTool.ts now uses correct path `/content.js`
- Fix implemented via CONTENT_SCRIPT_PATH constant (line 43)
- All contract tests passing (23/23)
- Build verification complete

**Implementation**:
```typescript
// codex-chrome/src/tools/DOMTool.ts:40-43
// Content script file path - MUST match manifest.json content_scripts.js reference
// Vite builds src/content/content-script.ts → dist/content.js (uses input key name)
// See specs/018-inspect-the-domtool/contracts/file-paths.md for contract details
const CONTENT_SCRIPT_PATH = '/content.js';

// codex-chrome/src/tools/DOMTool.ts:950-952
await chrome.scripting.executeScript({
  target: { tabId },
  files: [CONTENT_SCRIPT_PATH],
});
```

**Compliance Date**: 2025-10-09 (Feature 018 implementation complete)
