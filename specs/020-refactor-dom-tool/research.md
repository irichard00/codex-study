# Research: DOMTool Refactoring to High-Level DOM Reading

**Date**: 2025-10-11
**Feature**: 020-refactor-dom-tool
**Status**: Complete

## Executive Summary

This research establishes the technical approach for refactoring DOMTool from 23+ atomic operations to 1 high-level DOM reading operation: `captureDOM()`. The key challenge is adapting the existing DomService (originally designed for Chrome DevTools Protocol / CDP) to work with Chrome Extension APIs while maintaining the comprehensive DOM capture capabilities.

**Simplified Scope**: Only `captureDOM()` will be implemented. Element details are accessed directly from the `selector_map` in the response, eliminating the need for a separate `getElement()` method.

---

## 1. Chrome Extension DOM Access Patterns

### Decision: Use Content Script + chrome.tabs.sendMessage Pattern
**Rationale**:
- Chrome extensions cannot use CDP (Chrome DevTools Protocol) directly like the original Python browser_use implementation
- Content scripts have direct DOM access and run in the page context
- Background service worker communicates with content scripts via message passing
- This pattern is already partially implemented in the existing codebase

**Implementation Approach**:
```typescript
// Background (DOMTool) → Content Script (DOM access) → Background (response)
1. DOMTool.execute() sends message to content script
2. Content script traverses DOM, captures snapshot
3. Content script sends serialized DOM back to background
```

**Alternatives Considered**:
- ❌ **chrome.debugger API**: Provides CDP access but requires debugger permission (invasive, affects dev tools)
- ❌ **chrome.scripting.executeScript**: Limited by function serialization, cannot easily return complex DOM structures
- ✅ **Content script message passing**: Standard pattern, non-invasive, full DOM access

**References**:
- Chrome Extension Manifest V3 content scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Message passing: https://developer.chrome.com/docs/extensions/mv3/messaging/

---

## 2. DomService Adaptation Strategy

### Decision: Create Chrome-Specific Implementation Layer
**Rationale**:
The existing DomService has multiple CDP-dependent methods that need Chrome API equivalents:

| CDP Method | Chrome Extension Equivalent | Status |
|------------|----------------------------|--------|
| `DOM.getDocument()` | Content script: `document` traversal | ✅ Implement |
| `Accessibility.getFullAXTree()` | Content script: ARIA attributes + computed roles | ⚠️ Limited (no full AX tree API) |
| `DOMSnapshot.captureSnapshot()` | Content script: Manual snapshot via `getComputedStyle()` + `getBoundingClientRect()` | ✅ Implement |
| `Page.getLayoutMetrics()` | Content script: `window.devicePixelRatio`, `window.innerWidth/Height` | ✅ Trivial |
| `Target.getTargets()` | `chrome.webNavigation.getAllFrames()` + `chrome.tabs.query()` | ✅ Implement |

**Implementation Approach**:
1. Keep DomService class structure intact
2. Replace CDP calls with Chrome API calls in key methods:
   - `_get_targets_for_page()` → use chrome.webNavigation
   - `_get_all_trees()` → delegate to content script
   - `_get_viewport_ratio()` → query from content script
3. Create content script helpers for DOM traversal

**Alternatives Considered**:
- ❌ **Rewrite DomService from scratch**: Loses tested serialization logic
- ❌ **Use chrome.debugger for CDP**: Too invasive, poor UX
- ✅ **Adapt in place**: Preserves architecture, minimizes changes

---

## 3. Accessibility Tree Handling

### Decision: Fallback to ARIA Attributes + Heuristics
**Rationale**:
- Chrome extensions cannot access the full Accessibility API (no `chrome.accessibility` for web content)
- CDP `Accessibility.getFullAXTree()` not available
- Most critical accessibility info available via:
  - ARIA attributes (`role`, `aria-label`, `aria-describedby`, etc.)
  - Semantic HTML roles (detected via tag name)
  - Computed accessibility roles (partially inferrable)

**Implementation Approach**:
```typescript
// In content script
function buildAccessibilityNode(element: Element): AccessibilityInfo {
  return {
    role: element.getAttribute('role') || inferRoleFromTag(element.tagName),
    name: element.getAttribute('aria-label') || element.textContent?.slice(0, 100),
    description: element.getAttribute('aria-describedby'),
    properties: extractAriaProperties(element)
  };
}
```

**Limitations**:
- No backend DOM node IDs mapping (CDP feature)
- No computed accessibility tree structure
- Missing some advanced AX properties

**Alternatives Considered**:
- ❌ **chrome.automation API**: Only for ChromeOS/accessibility extensions, requires special permission
- ❌ **Skip accessibility data**: Reduces agent capability
- ✅ **ARIA + heuristics**: Captures 80% of useful accessibility info

---

## 4. DOM Snapshot Capture Strategy

### Decision: Content Script with Comprehensive Traversal
**Rationale**:
- CDP's `DOMSnapshot.captureSnapshot()` returns strings array + document structure optimized for network transfer
- We need similar efficiency for chrome.tabs.sendMessage (4MB limit per message)
- Capture computed styles, bounding boxes, and visibility in one pass

**Implementation Approach**:
```typescript
// In content script
function captureSnapshot(): CaptureSnapshotReturns {
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();

  function internString(str: string): number {
    if (!stringIndex.has(str)) {
      stringIndex.set(str, strings.length);
      strings.push(str);
    }
    return stringIndex.get(str)!;
  }

  function traverseNode(node: Node): SnapshotNode {
    // Capture computed styles, bounds, attributes using internString()
    const computedStyle = window.getComputedStyle(node as Element);
    const bounds = (node as Element).getBoundingClientRect();

    return {
      nodeType: node.nodeType,
      nodeName: internString(node.nodeName),
      // ... capture all required data
    };
  }

  return {
    documents: [traverseNode(document)],
    strings
  };
}
```

**Performance Considerations**:
- String interning reduces payload size by ~60-70%
- Skip hidden elements early (display: none, visibility: hidden)
- Limit max depth (3 levels of iframes) and max count (15 iframes)

**Alternatives Considered**:
- ❌ **Return full DOM objects**: Exceeds message size limits
- ❌ **Use screenshots**: Loses semantic information
- ✅ **CDP-style snapshot**: Proven efficient format

---

## 5. Iframe and Shadow DOM Handling

### Decision: Recursive Traversal with Depth/Count Limits
**Rationale**:
- Web pages can have deeply nested iframes (security risk, performance issue)
- Shadow DOM is increasingly common (web components)
- Need to respect same-origin policy (cross-origin iframes are inaccessible)

**Implementation Approach**:
```typescript
// In DomService
async get_dom_tree(target_id: string, iframe_depth: number = 0): Promise<EnhancedDOMTreeNode> {
  if (iframe_depth > this.max_iframe_depth) {
    return createPlaceholderNode('IFRAME_DEPTH_LIMIT');
  }

  // Check iframe count limit
  if (this._get_iframe_count(currentTree) >= this.max_iframes) {
    return createPlaceholderNode('IFRAME_COUNT_LIMIT');
  }

  // Traverse iframes recursively
  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) {
        // Same-origin iframe - can access
        traverseNode(iframeDoc, iframe_depth + 1);
      }
    } catch {
      // Cross-origin iframe - create placeholder
      createPlaceholderNode('CROSS_ORIGIN_IFRAME');
    }
  }
}
```

**Limits**:
- Max iframe depth: 3 levels
- Max total iframes: 15
- Configurable via DomService constructor

**Alternatives Considered**:
- ❌ **Unlimited traversal**: Performance nightmare
- ❌ **Skip all iframes**: Misses important content
- ✅ **Configurable limits**: Balances coverage and performance

---

## 6. Serialization Format for LLM Consumption

### Decision: Keep Existing DOMTreeSerializer Logic
**Rationale**:
- The existing serializer in `serializer/serializer.ts` already produces LLM-friendly output
- Uses element indexing (e.g., `[1]`, `[2]`) for clickable elements
- Applies paint order filtering to remove occluded elements
- Produces compact string representation

**Format Example**:
```
[1] <button class="primary">Submit</button>
[2] <input type="text" placeholder="Enter name" />
[3] <a href="/home">Home</a>
<div>
  [4] <button>Cancel</button>
</div>
```

**No Changes Required**:
- Serializer is DOM-agnostic (works with EnhancedDOMTreeNode)
- Only input is the tree structure, not how it was captured
- All optimizations (paint order, bbox filtering) preserved

---

## 7. Performance Optimization Strategy

### Decision: Progressive Capture with Caching
**Rationale**:
- Large pages (20,000+ nodes) take time to traverse
- Agent may request DOM multiple times during task
- Can cache parts of the tree that haven't changed

**Implementation Approach**:
```typescript
// In DomService
async get_serialized_dom_tree(
  previous_cached_state?: SerializedDOMState
): Promise<SerializedDOMState> {
  // Check if cached state is still valid (compare document hash)
  if (previous_cached_state && !hasDocumentChanged()) {
    return previous_cached_state;
  }

  // Incremental update for small changes
  if (previous_cached_state && hasOnlyMinorChanges()) {
    return updateCachedState(previous_cached_state);
  }

  // Full capture for major changes
  return await fullDOMCapture();
}
```

**Performance Targets**:
- <500ms for typical pages (<5000 nodes)
- <2s for complex pages (<20000 nodes)
- <50ms for cached hits

**Alternatives Considered**:
- ❌ **Always full capture**: Slow for repeated requests
- ❌ **DOM mutation observers**: Complex, memory overhead
- ✅ **Simple caching with invalidation**: Easy to implement, effective

---

## 8. Error Handling and Graceful Degradation

### Decision: Return Partial Results with Error Markers
**Rationale**:
- Some parts of the page may be inaccessible (cross-origin, permissions)
- Agent should still get usable information from accessible parts
- Errors should be informative for debugging

**Implementation Approach**:
```typescript
interface DOMCaptureResult {
  success: boolean;
  dom_tree: SerializedDOMState;
  errors?: Array<{
    type: 'CROSS_ORIGIN_IFRAME' | 'TIMEOUT' | 'PERMISSION_DENIED';
    message: string;
    element?: string;
  }>;
  warnings?: Array<{
    type: 'DEPTH_LIMIT' | 'COUNT_LIMIT' | 'SIZE_LIMIT';
    message: string;
  }>;
}
```

**Error Types**:
- Cross-origin iframe access denied → continue with placeholder
- Content script timeout → return partial results
- Message size exceeded → apply more aggressive filtering

---

## 9. Testing Strategy

### Decision: Multi-Layer Testing Approach
**Rationale**:
- Unit tests for individual components (serializer, utils)
- Integration tests for content script ↔ background communication
- Contract tests for DOMTool interface
- E2E tests with real pages

**Test Structure**:
```
tests/
├── unit/
│   ├── dom/serializer.test.ts     # Serializer logic
│   ├── dom/enhancedSnapshot.test.ts
│   └── dom/utils.test.ts
├── integration/
│   ├── domService.test.ts         # DomService with mocked Chrome APIs
│   └── contentScript.test.ts      # Content script DOM capture
└── contract/
    └── DOMTool.test.ts             # Public API contracts
```

**Test Data**:
- Mock DOM trees with various structures (iframes, shadow DOM, deep nesting)
- Real HTML fixtures from common sites
- Edge cases (empty page, huge page, cross-origin content)

---

## 10. Migration Path

### Decision: Complete Refactor (Remove All Atomic Operations)
**Rationale**:
- Clean break from v1.x to v2.0
- Simpler implementation - only one method: `captureDOM()`
- Element details available in `selector_map` - no separate `getElement()` needed
- Atomic operations are fundamentally incompatible with high-level DOM reading approach

**Implementation Approach**:
1. **Phase 1**: Remove all atomic operations (query, click, type, etc.)
2. **Phase 2**: Implement `captureDOM()` that calls `get_serialized_dom_tree()` from DomService
3. **Phase 3**: Return both `serialized_tree` and `selector_map` in response
4. **Phase 4**: Update agents to use new API

**Simple API**:
```typescript
class DOMTool extends BaseTool {
  // Single high-level operation
  async captureDOM(request: DOMCaptureRequest): Promise<DOMCaptureResponse> {
    // Calls DomService.get_serialized_dom_tree()
    // Returns { serialized_tree, selector_map, metadata, timing }
  }

  // Cache management
  clearCache(tab_id?: number): void { ... }
}

// Usage: Element lookup via selector_map
const response = await domTool.captureDOM({});
const button = response.dom_state.selector_map[1]; // Direct access
```

---

## Research Summary

**All technical unknowns resolved:**
- ✅ Chrome extension DOM access pattern established (content scripts + message passing)
- ✅ DomService adaptation strategy defined (replace CDP with Chrome APIs)
- ✅ Accessibility tree fallback approach (ARIA + heuristics)
- ✅ DOM snapshot capture implementation (content script traversal + string interning)
- ✅ Iframe/shadow DOM handling (recursive with limits)
- ✅ Serialization format finalized (reuse existing serializer)
- ✅ Performance optimization strategy (caching + progressive capture)
- ✅ Error handling approach (partial results + error markers)
- ✅ Testing strategy defined (multi-layer)
- ✅ Migration path established (gradual with feature flag)

**Ready to proceed to Phase 1: Design & Contracts**
