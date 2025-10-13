# Quickstart: Testing DOM Capture Fix

**Feature**: 035-method-handledomcapturerequest-in
**Date**: 2025-10-12

## Overview

This guide walks through testing the DOM capture bug fix and source map configuration. Follow these steps to verify the implementation works correctly.

## Prerequisites

- Node.js 18+ installed
- Chrome 120+ installed
- Repository cloned and dependencies installed

```bash
cd codex-chrome
npm install
```

## Step 1: Run Contract Tests (Should FAIL initially)

Run the contract tests to verify they fail before the fix:

```bash
cd codex-chrome
npm run test -- contracts/dom-capture.contract.ts

# Expected output:
# ❌ FAIL: should return non-empty nodes array
# ❌ FAIL: should attach snapshot to all element nodes
# ❌ FAIL: should attach axNode to all element nodes
# ❌ FAIL: should have elementMap with correct size
```

These failures confirm the bug exists.

## Step 2: Verify Current Behavior

### Test DOM Capture in Browser

1. Build the extension:
   ```bash
   npm run build
   ```

2. Load extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `codex-chrome/dist` folder

3. Open any web page

4. Open DevTools (F12) → Console

5. Test DOM capture:
   ```javascript
   chrome.runtime.sendMessage({
     type: 'DOM_CAPTURE_REQUEST',
     request_id: 'test-001',
     options: {
       include_shadow_dom: true,
       include_iframes: true,
       max_iframe_depth: 3,
       max_iframe_count: 15,
       bbox_filtering: true
     }
   }, (response) => {
     console.log('DOM Capture Response:', response);
   });
   ```

6. Expected (broken) output:
   ```javascript
   {
     success: true,
     snapshot: {
       documents: [{
         documentURL: "https://...",
         baseURL: "https://...",
         frameId: "main",
         nodes: [],  // ❌ EMPTY!
         title: "..."
       }],
       strings: []  // ❌ EMPTY!
     }
   }
   ```

### Test Source Maps in DevTools

1. With extension loaded, open DevTools → Sources panel

2. Look for TypeScript source files in file tree

3. Expected (broken) behavior:
   - Only see `content.js` (minified)
   - No `content-script.ts` or `domCaptureHandler.ts` visible
   - Cannot set breakpoints in TypeScript

## Step 3: Implement Fixes

### Fix 1: Update `traverseDOM()` to return element map

**File**: `codex-chrome/src/tools/dom/chrome/domTraversal.ts`

Add element tracking:

```typescript
export function traverseDOM(
  root: Node = document.documentElement,
  options: TraversalOptions = {}
): TraversalResult {
  const nodes: TraversedNode[] = [];
  const elementMap = new Map<number, Element>();  // NEW
  const stats = { /* ... */ };

  const stack: Array<[Node, number, number | null]> = [[root, 0, null]];

  while (stack.length > 0) {
    const [node, depth, parentIndex] = stack.pop()!;
    const currentIndex = nodes.length;

    // ... existing node processing ...

    // Store element reference immediately
    if (node.nodeType === DOMNodeType.ELEMENT_NODE) {
      elementMap.set(currentIndex, node as Element);  // NEW
    }

    nodes.push(traversedNode);
    // ... rest of loop ...
  }

  return { nodes, elementMap, stats };  // NEW: include elementMap
}
```

### Fix 2: Update `TraversalResult` interface

**File**: `codex-chrome/src/tools/dom/chrome/domTraversal.ts`

```typescript
export interface TraversalResult {
  nodes: TraversedNode[];
  elementMap: Map<number, Element>;  // NEW
  stats: {
    totalNodes: number;
    elementNodes: number;
    textNodes: number;
    maxDepth: number;
  };
}
```

### Fix 3: Use element map in `captureDocument()`

**File**: `codex-chrome/src/content/domCaptureHandler.ts`

Replace broken element lookup:

```typescript
function captureDocument(
  doc: Document,
  frameId: string,
  options: { includeShadowDOM: boolean; skipHiddenElements: boolean },
  stringPool: StringPool
): CapturedDocument {
  // Traverse DOM tree
  const traversalResult = traverseDOM(doc.documentElement, {
    maxDepth: 100,
    includeTextNodes: true,
    includeComments: false,
    skipHiddenElements: options.skipHiddenElements
  });

  // Collect elements from map
  const elements: Element[] = [];
  const elementIndices: number[] = [];

  for (const [index, element] of traversalResult.elementMap.entries()) {
    elements.push(element);
    elementIndices.push(index);
  }

  // Batch capture snapshots and ARIA
  const snapshots = batchCaptureSnapshots(elements);
  const axNodes = batchExtractARIA(elements);

  // Build captured nodes
  const nodes: CapturedNode[] = traversalResult.nodes.map((node, index) => {
    const capturedNode: CapturedNode = {
      nodeType: node.nodeType,
      nodeName: stringPool.internString(node.nodeName),  // Returns number
      nodeValue: node.nodeValue,
      backendNodeId: index + 1,
      parentIndex: node.parentIndex,
      childIndices: node.childIndices,
      attributes: {}
    };

    // Attach snapshot and ARIA data if element
    if (node.nodeType === 1) {
      const elementIndex = elementIndices.indexOf(index);
      if (elementIndex >= 0) {
        const element = elements[elementIndex];
        capturedNode.snapshot = snapshots.get(element);
        capturedNode.axNode = axNodes.get(element);

        // Intern attributes
        if (capturedNode.snapshot) {
          const internedAttrs: Record<number, number> = {};
          for (const [key, value] of Object.entries(capturedNode.snapshot.attributes)) {
            const keyIndex = stringPool.internString(key);
            const valueIndex = stringPool.internString(value);
            internedAttrs[keyIndex] = valueIndex;
          }
          capturedNode.attributes = internedAttrs;
        }
      }
    }

    return capturedNode;
  });

  return {
    documentURL: doc.location?.href || '',
    baseURL: doc.baseURI || '',
    title: doc.title || '',
    frameId,
    nodes
  };
}
```

### Fix 4: Update Vite config for source maps

**File**: `codex-chrome/vite.config.content.mjs`

```typescript
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/content/content-script.ts'),
      name: 'CodexContentScript',
      formats: ['iife'],
      fileName: () => 'content.js'
    },
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true,
        sourcemap: true,  // Ensure Rollup generates source map
        sourcemapExcludeSources: false  // Include sources in map
      }
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: 'external',  // External source map (not inline)
    minify: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
```

## Step 4: Verify Fixes

### Run Contract Tests Again

```bash
npm run test -- contracts/dom-capture.contract.ts

# Expected output:
# ✅ PASS: should return non-empty nodes array
# ✅ PASS: should capture all element nodes in test DOM
# ✅ PASS: should attach snapshot to all element nodes
# ✅ PASS: should attach axNode to all element nodes
# ✅ PASS: should have elementMap with correct size
# All tests passing!
```

### Test DOM Capture in Browser Again

1. Rebuild extension:
   ```bash
   npm run build
   ```

2. Reload extension in Chrome:
   - `chrome://extensions` → Click reload icon

3. Test DOM capture again:
   ```javascript
   chrome.runtime.sendMessage({
     type: 'DOM_CAPTURE_REQUEST',
     request_id: 'test-002',
     options: { include_shadow_dom: true }
   }, (response) => {
     console.log('DOM Capture Response:', response);
     console.log('Nodes count:', response.snapshot.documents[0].nodes.length);
     console.log('Strings count:', response.snapshot.strings.length);
   });
   ```

4. Expected (fixed) output:
   ```javascript
   {
     success: true,
     snapshot: {
       documents: [{
         documentURL: "https://...",
         baseURL: "https://...",
         frameId: "main",
         nodes: [
           {
             nodeType: 1,
             nodeName: 5,  // index into strings
             backendNodeId: 1,
             snapshot: { /* ... */ },  // ✅ PRESENT
             axNode: { /* ... */ }     // ✅ PRESENT
           },
           // ... more nodes
         ],
         title: "..."
       }],
       strings: ["HTML", "HEAD", "BODY", ...]  // ✅ POPULATED
     }
   }
   ```

### Test Source Maps in DevTools

1. With fixed extension loaded, open DevTools → Sources panel

2. Expected (fixed) behavior:
   - See TypeScript source files in tree (e.g., `content-script.ts`)
   - Can navigate to `domCaptureHandler.ts`
   - Can set breakpoints in TypeScript
   - Debugger pauses at correct lines

3. Test breakpoint:
   - Open `domCaptureHandler.ts` in Sources
   - Set breakpoint on line with `console.log('dom capture completed')`
   - Trigger DOM capture from console
   - Debugger should pause at TypeScript line (not minified JS)

## Step 5: Performance Validation

### Test Large DOM

Create test page with large DOM:

```html
<!DOCTYPE html>
<html>
<body>
  <div id="container"></div>
  <script>
    const container = document.getElementById('container');
    for (let i = 0; i < 10000; i++) {
      const div = document.createElement('div');
      div.className = `item-${i}`;
      div.textContent = `Item ${i}`;
      container.appendChild(div);
    }
    console.log('Created 10,000 elements');
  </script>
</body>
</html>
```

Load page and test capture:

```javascript
console.time('DOM Capture');
chrome.runtime.sendMessage({
  type: 'DOM_CAPTURE_REQUEST',
  request_id: 'perf-test',
  options: {}
}, (response) => {
  console.timeEnd('DOM Capture');
  console.log('Nodes captured:', response.snapshot.documents[0].nodes.length);
  console.log('Strings interned:', response.snapshot.strings.length);
});

// Expected: < 5000ms for 10k nodes
```

## Step 6: Run Full Test Suite

```bash
npm run test

# All tests should pass
npm run type-check

# No TypeScript errors
npm run build

# Build should succeed, source maps generated
ls -lh dist/content.js*

# Should see:
# content.js      (minified bundle)
# content.js.map  (source map file)
```

## Success Criteria

✅ Contract tests pass (all 20+ assertions)
✅ DOM capture returns populated `nodes` array
✅ All element nodes have `snapshot` and `axNode` attached
✅ String interning works (attributes use indices)
✅ Source maps generated during build
✅ Chrome DevTools shows TypeScript sources
✅ Breakpoints work in TypeScript files
✅ Performance: 10k nodes captured in < 5s

## Troubleshooting

### Issue: Contract tests still fail

**Check**: Did you update `TraversalResult` interface?
**Fix**: Ensure `elementMap` is included in return type

### Issue: Elements still null

**Check**: Is `elementMap` populated during traversal?
**Fix**: Ensure `elementMap.set(currentIndex, element)` is called in loop

### Issue: Source map not found in DevTools

**Check**: Does `content.js` have `//# sourceMappingURL` comment?
**Fix**: Verify `vite.config.content.mjs` has `sourcemap: 'external'`

### Issue: Attributes show `[object Object]`

**Check**: Are attribute keys/values numbers (indices)?
**Fix**: Ensure string interning returns numbers, not casted strings

### Issue: Performance too slow

**Check**: Is `skipHiddenElements` enabled?
**Fix**: Use `skipHiddenElements: true` to filter invisible nodes

## Next Steps

After quickstart validation passes:
1. Run full integration tests
2. Test on real-world complex pages (e.g., Gmail, GitHub)
3. Verify no memory leaks with large DOMs
4. Document new debugging workflow with source maps
5. Update CLAUDE.md with bug fix details

---

**Status**: Quickstart complete, ready for task generation
