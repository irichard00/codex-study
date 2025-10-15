# Research: Capture Interaction Content

**Feature**: 038-implement-captureinteractioncontent-request
**Date**: 2025-10-14
**Status**: Complete

## Overview
This document consolidates research decisions for implementing captureInteractionContent(), a compact page model generator for LLM consumption in the codex-chrome browser extension AI agent.

## Research Findings

### 1. Accessible Name Computation Library

**Question**: How to compute WCAG-compliant accessible names for interactive elements?

**Decision**: Use `dom-accessibility-api` library

**Rationale**:
- **Standards compliance**: Implements full WCAG accessible name calculation algorithm per spec
- **Battle-tested**: Widely used library (~600k weekly downloads), well-maintained
- **Lightweight**: ~10KB minified, minimal bundle impact
- **No alternatives**: Chrome APIs don't provide accessible name computation
  - `chrome.automation` requires assistive technology permissions (too invasive)
  - Manual ARIA attribute reading misses computed names from labels, content, implicit roles
- **Cross-context**: Works in both service worker and content script environments

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Custom implementation | Full control, no dependency | Complex algorithm (20+ rules), edge cases, testing burden | ❌ Rejected |
| Chrome automation API | Native Chrome support | Requires special permissions, security risk, overkill | ❌ Rejected |
| Manual ARIA reading | Simple, no dependency | Incomplete (misses computed names), violates standards | ❌ Rejected |
| dom-accessibility-api | Standards-compliant, tested | External dependency (~10KB) | ✅ **Selected** |

**Integration**:
```typescript
import { computeAccessibleName } from 'dom-accessibility-api';

function extractControlName(element: Element): string {
  try {
    return computeAccessibleName(element as HTMLElement) || '';
  } catch {
    // Fallback to text content, aria-label, or empty
    return element.textContent?.trim() ||
           element.getAttribute('aria-label') ||
           '';
  }
}
```

**References**:
- npm: https://www.npmjs.com/package/dom-accessibility-api
- WCAG spec: https://www.w3.org/TR/accname-1.1/

---

### 2. Iframe Content Handling

**Question**: Should iframe content be included? At what depth? How to handle cross-origin?

**Decision**: Same-origin iframes only, 1 level deep (default), extensible via `maxIframeDepth` parameter

**Rationale**:
- **Same-origin restriction**: Browser security model prevents cross-origin DOM access
  - `SecurityError` thrown when accessing `iframe.contentDocument` from different origin
  - No workaround without special permissions (violates Chrome extension security)
- **1-level default**: Balances completeness vs. token budget
  - Common patterns: embedded login forms, payment widgets, chat boxes (1 level)
  - Rare patterns: deeply nested iframes (2+ levels) are uncommon, diminishing returns
- **Extensibility**: `maxIframeDepth` parameter enables future multi-level support without breaking changes
- **Performance**: Recursive traversal with depth counter, early exit prevents infinite loops

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Exclude all iframes | Simple, no recursion | Misses interactive content (forms, widgets) | ❌ Rejected |
| Include cross-origin | Complete coverage | Impossible (SecurityError), violates browser security | ❌ Rejected |
| Unlimited depth | Maximum completeness | Token explosion, infinite loop risk, rare use case | ❌ Rejected |
| 1-level + extensible | Practical default, future-proof | Slightly more complex | ✅ **Selected** |

**Implementation**:
```typescript
function processIframes(
  doc: Document,
  currentDepth: number,
  maxDepth: number
): InteractiveControl[] {
  if (currentDepth >= maxDepth) return [];

  const iframes = Array.from(doc.querySelectorAll('iframe'));
  const controls: InteractiveControl[] = [];

  for (const iframe of iframes) {
    try {
      // Check same-origin (will throw SecurityError if cross-origin)
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) continue;

      // Recursive capture with incremented depth
      controls.push(...captureInteractionContent(iframeDoc, {
        ...options,
        _depth: currentDepth + 1
      }).controls);
    } catch (e) {
      // Cross-origin iframe, skip silently
      continue;
    }
  }

  return controls;
}
```

**Edge Cases**:
- Sandboxed iframes with `allow-same-origin`: Accessible if same-origin
- `srcdoc` iframes: Same-origin by default, accessible
- Dynamically created iframes: Captured if present at capture time

---

### 3. Performance & Timeout Strategy

**Question**: What timeout is acceptable for page model generation? What token budget?

**Decision**: 30-second max timeout, 5-second 90th percentile target, no strict token budget (rely on element caps)

**Rationale**:
- **30-second max**: Handles pathological cases
  - Huge SPAs (10k+ elements)
  - Slow network (late iframe loads)
  - Complex visibility calculations
  - User can abort manually if needed
- **5-second target**: User-perceivable threshold
  - Nielsen usability: 1s instant, 10s limit of attention
  - 5s balances responsiveness vs. completeness
  - 90th percentile metric ensures typical pages are fast
- **No strict token budget**: Variable page complexity
  - Simple page: 2k tokens (login form)
  - Complex page: 50k tokens (e-commerce catalog)
  - Element caps (400 controls, 30 headings) provide effective size management
  - Information density optimization more valuable than arbitrary token limit

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| 2-second timeout | Very fast | Fails on legitimate complex pages | ❌ Rejected |
| 10-second timeout | Reasonable | Too slow for typical pages | ❌ Rejected |
| No timeout | Never fails | Risk of hangs, resource exhaustion | ❌ Rejected |
| Strict token budget (50k) | Predictable size | Arbitrary, doesn't match page complexity | ❌ Rejected |
| 30s + element caps | Handles edge cases, practical limits | Slightly more complex | ✅ **Selected** |

**Implementation**:
```typescript
async function captureInteractionContent(
  target: Document | string,
  options: CaptureRequest
): Promise<PageModel> {
  const timeout = 30000; // 30 seconds
  const controller = new AbortController();

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await Promise.race([
      _captureImpl(target, options, controller.signal),
      new Promise((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new Error('Capture timeout after 30s'))
        )
      )
    ]);
    return result as PageModel;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Performance Optimization**:
- Early termination: Stop at 400 controls, 30 headings
- Lazy visibility checks: Only compute for actionable elements
- Selector caching: Avoid redundant CSS.escape() calls
- Parallelizable: Process iframes concurrently (if multiple)

---

### 4. Migration Strategy (captureDOM Integration)

**Question**: Should captureInteractionContent replace captureDOM or run alongside?

**Decision**: New primary method, captureDOM() maintained as wrapper (not deprecated, planned for future fixes)

**Rationale**:
- **captureDOM() status**: Currently broken (serialization logic issues)
- **Immediate value**: captureInteractionContent() provides working alternative now
- **Backward compatibility**: Wrapper approach prevents breaking changes
  - Existing consumers continue to work
  - Gradual migration possible
- **Independent evolution**: captureDOM() serialization can be fixed independently
  - Different use cases: full DOM serialization vs. interaction-focused model
  - No coupling between fixes

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Replace captureDOM entirely | Clean, no duplication | Breaking change, risky migration | ❌ Rejected |
| Deprecate captureDOM | Signals intent | Premature, still has value once fixed | ❌ Rejected |
| Merge into single method | One API | Different use cases, increased complexity | ❌ Rejected |
| Standalone + wrapper | Non-breaking, flexible | Temporary duplication | ✅ **Selected** |

**Implementation**:
```typescript
// DomService.ts (existing file)
class DomService {
  // NEW: Primary interaction-focused capture
  async captureInteractionContent(
    request: CaptureRequest
  ): Promise<PageModel> {
    // Full implementation in interactionCapture.ts
    return interactionCapture(this.tab_id, request);
  }

  // EXISTING: Keep for backward compatibility
  async captureDOM(): Promise<SerializedDOMState> {
    // Broken serialization logic (unchanged for now)
    // Can optionally delegate to captureInteractionContent()
    // or be fixed independently in future
    return this.get_serialized_dom_tree();
  }
}
```

---

### 5. HTML Sanitization & Privacy

**Question**: How to sanitize HTML and ensure privacy?

**Decision**: Strip scripts/styles/comments pre-processing, redact all form values by default, never expose password lengths

**Rationale**:
- **Script/style removal**: Zero semantic value for interaction model
  - LLM doesn't need JavaScript code or CSS rules
  - Reduces token noise significantly (often 50%+ of HTML size)
- **Comment removal**: Security risk (may contain credentials, API keys)
- **Value redaction**: Privacy-first principle
  - Default: No actual values (use `value_len`)
  - Optional: `includeValues` flag for debugging (200-char limit, passwords always redacted)
- **Password special case**: Even length can leak information
  - Example: 8-char password → hints password policy
  - Always redact as `"•••"` when `includeValues` enabled
  - Never include `value_len` for password fields

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Include scripts/styles | Complete HTML | Massive token waste, zero value | ❌ Rejected |
| Hash form values | Privacy + signal | Unnecessary complexity | ❌ Rejected |
| Always include values | Simpler | Privacy risk, violates requirements | ❌ Rejected |
| Include password length | Consistency | Information leakage | ❌ Rejected |
| Redact by default + opt-in | Privacy-first, flexible | Slightly more complex | ✅ **Selected** |

**Implementation**:
```typescript
function sanitizeHTML(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')               // Comments
    .replace(/<script[\s\S]*?<\/script>/gi, '')    // Scripts
    .replace(/<style[\s\S]*?<\/style>/gi, '');     // Styles
}

function extractFieldState(
  element: HTMLInputElement | HTMLTextAreaElement,
  includeValues: boolean
): Record<string, any> {
  const states: Record<string, any> = {};

  // Password: Always redact
  if (element.type === 'password') {
    if (includeValues) {
      states.value = '•••';
    }
    // Never include value_len for passwords
    return states;
  }

  // Other fields: Redact by default
  if (element.value) {
    if (includeValues) {
      states.value = element.value.slice(0, 200); // Limit
    } else {
      states.value_len = element.value.length;
    }
  }

  return states;
}
```

---

### 6. Visibility & Actionability Filtering

**Question**: How to determine if an element is actionable?

**Decision**: Filter via computed styles (display, visibility, opacity), bounding box (width/height > 0), optional viewport intersection

**Rationale**:
- **Computed styles**: Catches CSS-hidden elements reliably
  - `display: none` → not rendered
  - `visibility: hidden` → rendered but invisible
  - `opacity: 0` → rendered but transparent
- **Bounding box**: Filters zero-size elements (collapsed, off-screen)
  - `getBoundingClientRect()` provides layout dimensions
  - Common for hidden elements, spinners, loaders
- **Viewport check**: Optional optimization
  - Some use cases need off-screen elements (scroll planning)
  - Included as `inViewport` boolean, not filtering criterion

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Viewport-only filtering | Minimal output | Misses valid scroll targets | ❌ Rejected |
| No filtering | Complete | Token waste on hidden elements | ❌ Rejected |
| IntersectionObserver | Async, precise | Complicates capture, overkill | ❌ Rejected |
| Styles + bbox + viewport flag | Practical, flexible | Slightly more complex | ✅ **Selected** |

**Implementation**:
```typescript
function isElementActionable(element: Element): boolean {
  // 1. Check computed styles
  const styles = window.getComputedStyle(element);
  if (styles.display === 'none') return false;
  if (styles.visibility === 'hidden' || styles.visibility === 'collapse') return false;
  if (parseFloat(styles.opacity) === 0) return false;

  // 2. Check bounding box
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  return true;
}

function isInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}
```

---

### 7. Selector Generation

**Question**: How to generate stable, unique selectors for element identification?

**Decision**: Prioritize ID > test IDs (data-testid, data-test, data-qa, data-cy) > short robust path (tag + classes, 4 levels max)

**Rationale**:
- **ID priority**: Fastest, most stable
  - querySelector('#foo') is O(1)
  - Developer-assigned IDs tend to be stable
- **Test ID fallback**: Explicit stability markers
  - Common in modern apps (React Testing Library, Cypress, Playwright)
  - Designed for stable element identification
- **Short robust path**: Balance specificity vs. brittleness
  - 4-level max prevents overly long selectors
  - Tag + classes provides reasonable uniqueness
  - More stable than nth-child (breaks on reordering)

**Alternatives Considered**:
| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Full XPath | Specific | Very brittle, breaks on DOM changes | ❌ Rejected |
| Tag only | Simple | Collisions, non-unique | ❌ Rejected |
| nth-child | Specific | Extremely brittle | ❌ Rejected |
| ID > test IDs > short path | Practical, stable | Slightly more complex logic | ✅ **Selected** |

**Implementation**:
```typescript
function generateSelector(element: Element): string {
  // 1. Prefer ID
  const id = (element as HTMLElement).id;
  if (id) return `#${CSS.escape(id)}`;

  // 2. Prefer test IDs
  for (const attr of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
    const value = element.getAttribute(attr);
    if (value) return `[${attr}="${CSS.escape(value)}"]`;
  }

  // 3. Build short robust path (4 levels max)
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && depth++ < 4) {
    const tag = current.tagName.toLowerCase();
    const classes = Array.from((current as HTMLElement).classList || [])
      .slice(0, 2)
      .map(c => `.${CSS.escape(c)}`)
      .join('');

    parts.unshift(`${tag}${classes}`);

    // Stop if we hit an ID
    if ((current as HTMLElement).id) {
      parts[0] = `#${CSS.escape((current as HTMLElement).id)}`;
      break;
    }

    current = current.parentElement;
  }

  return parts.join(' > ');
}
```

---

## Summary

All research questions resolved. Key decisions:

1. **dom-accessibility-api**: Standards-compliant accessible names
2. **Same-origin iframes (1 level)**: Balanced, extensible
3. **30s timeout + element caps**: Practical performance bounds
4. **Standalone + wrapper**: Non-breaking migration
5. **Privacy-first redaction**: Never expose sensitive data
6. **Style + bbox filtering**: Reliable actionability detection
7. **ID > test IDs > short path**: Stable selector generation

**Next Phase**: Design & Contracts (data-model.md, contracts/, quickstart.md)

---

**Status**: ✅ **COMPLETE** - All technical decisions finalized, ready for Phase 1 design.
