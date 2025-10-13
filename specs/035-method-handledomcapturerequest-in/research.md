# Research: Fix DOM Capture Handler and Enable Source Maps

**Feature**: 035-method-handledomcapturerequest-in
**Date**: 2025-10-12

## Problem Analysis

### Root Cause #1: Empty Nodes Array

**Issue**: `captureDocument()` in `domCaptureHandler.ts` (lines 155-240) returns empty `nodes` array despite successful DOM traversal.

**Root Cause Analysis**:
1. Line 162: `traverseDOM()` successfully collects nodes in `traversalResult.nodes`
2. Lines 169-183: Element collection loop iterates through traversal results
3. Line 177: `getElementByPath()` is called to map index → actual DOM element
4. **BUG**: Lines 252-266: `getElementByPath()` is a stub that always returns `root` element
5. Line 205: Element lookup uses broken index arithmetic: `elementIndices.size - elements.length + Array.from(elementIndices.values()).indexOf(index)`
6. Result: `element` is always null or incorrect, so snapshots/ARIA data never attach
7. Lines 192-224: `CapturedNode` objects are created but with missing data

**Decision**: Replace stub `getElementByPath()` with proper element tracking during traversal

**Rationale**:
- The traversal already walks the DOM tree, so we can maintain a parallel map of index → element
- Chrome extension content scripts have full DOM access, so element references are safe
- Alternative approaches (re-traversing, XPath lookups) would be slower

**Alternatives Considered**:
- Re-traverse DOM for each element lookup (O(n²) complexity, rejected)
- Use CDP DOM snapshot API directly (requires background script, more complex message passing)
- Store element references during traversal (chosen - O(n) complexity, simple)

### Root Cause #2: Source Maps Not Working

**Issue**: Chrome DevTools cannot map minified content.js back to TypeScript sources

**Root Cause Analysis**:
1. `vite.config.content.mjs` line 26: `sourcemap: true` is set
2. Vite generates `content.js.map` file during build
3. **BUG**: IIFE format bundle doesn't include source map reference comment
4. Chrome can't auto-discover the source map file
5. Alternative: Inline source maps increase bundle size significantly (not suitable for content scripts)

**Decision**: Ensure Vite includes `//# sourceMappingURL=content.js.map` comment in generated IIFE bundle

**Rationale**:
- External source maps keep bundle size minimal (critical for content script injection speed)
- Chrome DevTools automatically loads external maps via the sourceMappingURL comment
- Inline maps would add 50-100% to bundle size

**Alternatives Considered**:
- Inline source maps (rejected - increases bundle size by 50-100%)
- No source maps (rejected - debugging is critical for development)
- External source maps with URL comment (chosen - best balance)

## Technical Research

### DOM Element Tracking Pattern

**Best Practice**: Maintain element map during traversal

```typescript
// Pattern: Build element map during traversal
const elementMap = new Map<number, Element>();

function traverseWithMapping(root: Node): TraversalResult {
  const nodes: TraversedNode[] = [];
  const stack: Array<[Node, number, number | null]> = [[root, 0, null]];

  while (stack.length > 0) {
    const [node, depth, parentIndex] = stack.pop()!;
    const currentIndex = nodes.length;

    // Store element reference immediately
    if (node.nodeType === Node.ELEMENT_NODE) {
      elementMap.set(currentIndex, node as Element);
    }

    nodes.push(/* traversed node data */);
    // ... add children to stack
  }

  return { nodes, elementMap };
}
```

**Source**: Chrome DevTools Protocol DOM domain pattern, used by Playwright and Puppeteer

### Vite Source Map Configuration for IIFE

**Best Practice**: Verify Rollup output configuration

```typescript
// vite.config.content.mjs
export default defineConfig({
  build: {
    sourcemap: true,  // or 'external' explicitly
    rollupOptions: {
      output: {
        sourcemap: true,  // Ensure Rollup also generates maps
        sourcemapExcludeSources: false  // Include sources in map
      }
    }
  }
});
```

**Source**: Vite documentation on library mode source maps, Rollup source map options

### String Interning Bug Check

**Research Finding**: `StringPool.internString()` returns `number` (index), not `string`

**Issue**: Lines 195, 214-216 in `domCaptureHandler.ts` cast interned indices to strings:
```typescript
nodeName: stringPool.internString(node.nodeName) as any  // WRONG: returns number, cast to string
```

**Correct Pattern**: Store indices in nodes, resolve strings on deserialization:
```typescript
// Store indices
nodeName: stringPool.internString(node.nodeName),  // number

// Deserialize later
const actualName = snapshot.strings[node.nodeName];  // lookup by index
```

**Decision**: Fix string interning to store indices correctly, update serialization to resolve strings

## Integration Points

### Content Script Message Protocol

**Constraint**: `DOMCaptureResponse` must match protocol in `src/types/domMessages.ts`

```typescript
export interface DOMCaptureResponseMessage {
  type: 'DOM_CAPTURE_RESPONSE';
  request_id: string;
  success: boolean;
  snapshot?: CaptureSnapshotReturns;
  viewport?: ViewportInfo;
  timing?: { startTime: number; traversalTime: number; totalTime: number };
  error?: { code: string; message: string; details?: any };
}
```

**Requirement**: Response format must not change (protocol contract with background script)

### Testing Strategy

**Constraint**: Tests must run in jsdom environment (no real Chrome extension APIs)

**Pattern**: Use `chrome-mock` for extension APIs, create test fixtures for DOM structures

```typescript
// Test fixture pattern
describe('DOM Capture', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="test">
        <span class="child">Text</span>
      </div>
    `;
  });

  it('captures all nodes', () => {
    const result = captureDOMSnapshot({});
    expect(result.documents[0].nodes.length).toBeGreaterThan(0);
    expect(result.documents[0].nodes).toContainEqual(
      expect.objectContaining({ nodeName: 'DIV' })
    );
  });
});
```

## Performance Considerations

### DOM Traversal Optimization

**Current**: Iterative stack-based traversal (lines 96-174 in `domTraversal.ts`)
- Time Complexity: O(n) where n = DOM nodes
- Space Complexity: O(d) where d = max depth (stack size)

**Impact of Fix**: Adding element map increases space by O(e) where e = element count
- Typical page: 1000-5000 elements = 8-40 KB additional memory
- Large page: 20000 elements = ~160 KB additional memory
- **Acceptable**: Chrome extension content scripts have no strict memory limits

### Snapshot Capture Batching

**Current**: `batchCaptureSnapshots()` (line 186 in `domCaptureHandler.ts`)
- Captures all elements in single pass
- Uses `getBoundingClientRect()` and `getComputedStyle()` per element

**Risk**: These are synchronous DOM APIs that trigger layout/style recalculation
**Mitigation**: Already batched to minimize reflow/repaint cycles

### Source Map Size Impact

**Measurement**:
- Typical content.js: 200-300 KB minified
- External source map: 150-250 KB (separate file)
- Inline source map: +150-250 KB to bundle (50-80% increase)

**Decision**: External source maps are correct choice (no runtime cost)

## Security Considerations

### Cross-Origin Iframe Handling

**Risk**: Cannot access cross-origin iframe content (SecurityError)

**Current Mitigation**: `getAccessibleIframeDocuments()` catches SecurityError
**Additional Requirement**: Ensure no uncaught exceptions leak to console

### Element Reference Lifetime

**Risk**: Holding element references in map could prevent garbage collection

**Mitigation**: Element map is scoped to `captureDocument()` function and released after use
**Validation**: Map is not stored globally or returned in response

## Validation Criteria

### DOM Capture Fix Validation

1. **Unit Test**: Create test DOM, capture snapshot, verify `nodes.length > 0`
2. **Integration Test**: Verify each element has `snapshot` and `axNode` attached
3. **Edge Case**: Test empty page (e.g., `about:blank`) - should return minimal nodes
4. **Cross-Origin**: Test iframe handling - should skip cross-origin, no errors
5. **Performance**: Capture 10k node page in <5s

### Source Map Fix Validation

1. **Build Output**: Verify `dist/content.js.map` exists after build
2. **Source Reference**: Verify `dist/content.js` ends with `//# sourceMappingURL=content.js.map`
3. **Map Content**: Verify map file contains `sources` array with TypeScript paths
4. **Chrome DevTools**: Load extension, open DevTools Sources panel, verify `.ts` files appear
5. **Breakpoint Test**: Set breakpoint in TypeScript source, trigger capture, verify pause

## Dependencies

### No New Dependencies Required

All fixes use existing dependencies:
- TypeScript 5.9.2 (language)
- Vite 5.4.20 (build tool with source map support)
- Vitest 3.2.4 (testing framework)
- jsdom 27.0.0 (DOM emulation for tests)
- chrome-mock 0.0.9 (extension API mocking)

### Build Process Integration

**Current**: `npm run build` → `node scripts/build.js` → runs Vite twice
1. Main build: `vite build` (background, sidepanel)
2. Content build: `vite build --config vite.config.content.mjs`

**Impact**: No changes to build orchestration needed, only to content config

## Summary of Findings

### Critical Issues Identified

1. **`getElementByPath()` stub**: Must be replaced with actual element lookup
2. **Element map missing**: Must create map during traversal, not after
3. **String interning type error**: Casting `number` to `string` breaks serialization
4. **Source map reference**: IIFE bundle needs explicit sourceMappingURL comment

### Recommended Implementation Order

1. Fix `traverseDOM()` to return element map alongside nodes
2. Update `captureDocument()` to use element map for snapshot attachment
3. Fix string interning to store indices correctly
4. Update Vite config to ensure source map URL reference
5. Add tests for all scenarios

### Risk Assessment

**Low Risk**: Changes are isolated to DOM capture module
**Medium Impact**: Core functionality currently broken, fix is critical
**High Confidence**: Root causes identified through code analysis and runtime evidence

---

**Status**: Research complete, ready for Phase 1 design
