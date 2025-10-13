# Tasks: Refactor DOMTool to High-Level DOM Reading

**Input**: Design documents from `/specs/020-refactor-dom-tool/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md
**Branch**: `020-refactor-dom-tool`

## Execution Summary

This task list refactors DOMTool from 23+ atomic operations to a single high-level `captureDOM()` operation. The implementation:
- Calls `get_serialized_dom_tree()` from DomService
- Adapts DomService from CDP (Chrome DevTools Protocol) to Chrome Extension APIs
- Implements content script for DOM traversal and snapshot capture
- Returns both `serialized_tree` (for LLM) and `selector_map` (for element details)

**Tech Stack**: TypeScript 5.9+, Chrome Extension APIs, Vitest 3.2, Zod 3.23

---

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths are relative to `codex-chrome/` directory

---

## Phase 3.1: Setup & Validation

- [x] ### T001: Verify existing project structure
**File**: Repository inspection
**Description**: Verify that the following files exist and are in working state:
- `codex-chrome/src/tools/DOMTool.ts`
- `codex-chrome/src/tools/BaseTool.ts`
- `codex-chrome/src/tools/dom/service.ts`
- `codex-chrome/src/tools/dom/serializer/serializer.ts`
- `codex-chrome/src/tools/dom/views.ts`
- `codex-chrome/src/content/content-script.ts`
- `codex-chrome/tests/` directory

**Acceptance**: All files exist and TypeScript compiles without errors

---

- [x] ### T002: Install additional dependencies if needed
**File**: `codex-chrome/package.json`
**Description**: Verify Zod 3.23+ is installed for request validation. If not present, add it to dependencies.

**Command**:
```bash
cd codex-chrome
npm install zod@^3.23.8
```

**Acceptance**: `zod` appears in package.json dependencies

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [x] ### T003 [P]: Contract test for DOMCaptureRequest validation
**File**: `codex-chrome/tests/contract/DOMTool.captureDOM.request.test.ts`
**Description**: Create contract test that validates DOMCaptureRequest interface:
- Test valid request with all optional fields
- Test request with only required fields (empty object)
- Test invalid tab_id (negative number)
- Test invalid max_iframe_depth (> 10)
- Test invalid max_iframe_count (> 50)
- Test invalid timeout_ms (< 100 or > 30000)

Use Zod schema validation from contracts/dom-tool-api.ts

**Expected**: Tests fail (DOMCaptureRequest validation not implemented)

---

- [x] ### T004 [P]: Contract test for DOMCaptureResponse structure
**File**: `codex-chrome/tests/contract/DOMTool.captureDOM.response.test.ts`
**Description**: Create contract test that validates DOMCaptureResponse interface:
- Test successful response contains `dom_state` with `serialized_tree`, `selector_map`, `metadata`
- Test `selector_map` is a valid object with numeric keys
- Test `metadata` contains required fields (capture_timestamp, page_url, etc.)
- Test error response contains `error` with `code` and `message`
- Test warnings array structure when present

Mock DOMTool to return test responses

**Expected**: Tests fail (DOMCaptureResponse structure not implemented)

---

- [x] ### T005 [P]: Contract test for error handling
**File**: `codex-chrome/tests/contract/DOMTool.errors.test.ts`
**Description**: Create contract test for all error codes:
- TIMEOUT - capture exceeds timeout_ms
- TAB_NOT_FOUND - invalid tab_id
- CONTENT_SCRIPT_NOT_LOADED - content script injection failed
- CROSS_ORIGIN_FRAME - cross-origin iframe access denied
- MESSAGE_SIZE_EXCEEDED - response too large
- PERMISSION_DENIED - insufficient permissions

Mock chrome APIs to trigger each error condition

**Expected**: Tests fail (error handling not implemented)

---

- [x] ### T006 [P]: Integration test for basic DOM capture flow
**File**: `codex-chrome/tests/integration/DOMTool.captureDOM.test.ts`
**Description**: Create integration test for basic DOM capture:
- Setup: Create mock tab with simple HTML DOM
- Execute: Call `domTool.captureDOM({})`
- Assert: Response contains serialized_tree with expected elements
- Assert: selector_map contains entries for interactive elements
- Assert: metadata.total_nodes > 0

Use jsdom to mock DOM environment

**Expected**: Tests fail (captureDOM not implemented)

---

- [x] ### T007 [P]: Integration test for cache behavior
**File**: `codex-chrome/tests/integration/DOMTool.cache.test.ts`
**Description**: Create integration test for caching:
- First call: `domTool.captureDOM({ use_cache: true })`
- Assert: Response includes timing
- Second call: Same request with cache enabled
- Assert: Second call is faster (cached)
- Third call: `domTool.captureDOM({ use_cache: false })`
- Assert: Timing similar to first call (cache bypassed)
- Test: `domTool.clearCache()` invalidates cache

**Expected**: Tests fail (caching not implemented)

---

## Phase 3.3: Content Script DOM Capture

- [x] ### T008: Create DOM traversal helper in content script
**File**: `codex-chrome/src/tools/dom/chrome/domTraversal.ts`
**Description**: Implement DOM traversal function that walks the entire DOM tree:
- Traverse from document.documentElement
- Skip DISABLED_ELEMENTS (head, script, style, noscript, #comment)
- Handle text nodes, element nodes
- Respect max depth limit
- Return array of all DOM nodes with basic info (nodeType, nodeName, nodeValue)

**Dependencies**: None
**Acceptance**: Function returns complete node array for test HTML

---

- [x] ### T009: Create snapshot capture helper in content script
**File**: `codex-chrome/src/tools/dom/chrome/snapshotCapture.ts`
**Description**: Implement snapshot capture that collects:
- Bounding box via `getBoundingClientRect()`
- Computed styles via `getComputedStyle()` (display, visibility, opacity, overflow, cursor, pointer-events, position, background-color)
- Attributes as key-value pairs
- Text content (truncated to 1000 chars)
- Input values for form fields
- Current source URL for img/iframe elements

**Dependencies**: T008
**Acceptance**: Returns complete snapshot data for test elements

---

- [x] ### T010: Implement string interning for efficient transfer
**File**: `codex-chrome/src/tools/dom/chrome/stringInterning.ts`
**Description**: Implement string interning to reduce message size:
- Create `StringPool` class with `internString(str: string): number` method
- Maintain Map<string, number> for string → index mapping
- Maintain string[] array for index → string retrieval
- Return index for repeated strings (e.g., "div" appears 100 times, send index once)

**Dependencies**: None
**Acceptance**: Interning reduces payload size by ~60% on test HTML

---

- [x] ### T011: Implement ARIA attribute extraction
**File**: `codex-chrome/src/tools/dom/chrome/ariaExtraction.ts`
**Description**: Implement ARIA attribute extraction for accessibility info:
- Extract all `aria-*` attributes (aria-label, aria-describedby, aria-role, etc.)
- Extract `role` attribute
- Infer role from tag name if not specified (button → "button", a → "link")
- Extract accessible name (aria-label > aria-labelledby > textContent)
- Return EnhancedAXNode structure

**Dependencies**: T008
**Acceptance**: Correctly extracts ARIA info from test elements

---

- [x] ### T012: Implement iframe detection and traversal
**File**: `codex-chrome/src/tools/dom/chrome/iframeTraversal.ts`
**Description**: Implement iframe detection and recursive traversal:
- Detect `<iframe>` elements during DOM traversal
- Check same-origin access via try/catch on `iframe.contentDocument`
- If accessible: Recursively traverse iframe DOM (increment depth)
- If cross-origin: Create placeholder node with CROSS_ORIGIN_IFRAME marker
- Respect max_iframe_depth and max_iframe_count limits
- Track iframe count globally across all frames

**Dependencies**: T008
**Acceptance**: Correctly traverses same-origin iframes, handles cross-origin gracefully

---

- [x] ### T013: Implement shadow DOM detection and traversal
**File**: `codex-chrome/src/tools/dom/chrome/shadowDOMTraversal.ts`
**Description**: Implement shadow DOM traversal:
- Detect elements with shadow roots via `element.shadowRoot`
- Traverse shadow DOM recursively
- Track shadow root type (open, closed, user-agent)
- Include shadow DOM nodes in main tree structure
- Handle nested shadow roots

**Dependencies**: T008
**Acceptance**: Correctly traverses shadow DOM in test Web Components

---

- [x] ### T014: Integrate all content script helpers
**File**: `codex-chrome/src/content/domCaptureHandler.ts`
**Description**: Create main DOM capture handler that integrates all helpers:
- Use domTraversal to walk DOM
- Use snapshotCapture to collect element data
- Use stringInterning to optimize payload
- Use ariaExtraction for accessibility
- Use iframeTraversal for frames
- Use shadowDOMTraversal for shadow DOM
- Return CaptureSnapshotReturns structure (documents, strings)

**Dependencies**: T008-T013
**Acceptance**: Captures complete DOM snapshot matching CDP format

---

## Phase 3.4: DomService Chrome API Adaptation

- [x] ### T015: Adapt _get_targets_for_page to use chrome.webNavigation
**File**: `codex-chrome/src/tools/dom/service.ts`
**Description**: Refactor `_get_targets_for_page()` method:
- Remove CDP `Target.getTargets()` call
- Use `chrome.tabs.get(tab_id)` to get main tab info
- Use `chrome.webNavigation.getAllFrames({ tabId })` to get iframe list
- Convert frame data to TargetInfo format
- Handle errors gracefully (tab not found, permission denied)

**Dependencies**: None (independent of content script)
**Acceptance**: Returns TargetInfo for main tab and iframes

---

- [x] ### T016: Adapt _get_viewport_ratio to query content script
**File**: `codex-chrome/src/tools/dom/service.ts`
**Description**: Refactor `_get_viewport_ratio()` method:
- Remove CDP `Page.getLayoutMetrics()` call
- Send message to content script requesting `window.devicePixelRatio`
- Content script returns { devicePixelRatio, innerWidth, innerHeight }
- Return devicePixelRatio value
- Handle timeout and errors

**Dependencies**: T014 (needs content script messaging)
**Acceptance**: Returns correct devicePixelRatio from tab

---

- [x] ### T017: Adapt _get_all_trees to delegate to content script
**File**: `codex-chrome/src/tools/dom/service.ts`
**Description**: Refactor `_get_all_trees()` method to delegate to content script:
- Remove CDP `DOM.getDocument()`, `DOMSnapshot.captureSnapshot()` calls
- Send message to content script requesting DOM capture (via T014 handler)
- Content script returns CaptureSnapshotReturns structure
- Parse response into GetDocumentReturns, CaptureSnapshotReturns formats
- Keep existing GetFullAXTreeReturns empty for now (handled in T018)
- Return TargetAllTrees structure

**Dependencies**: T014, T016
**Acceptance**: Returns complete tree data from content script

---

- [x] ### T018: Implement _get_ax_tree_for_all_frames with ARIA fallback
**File**: `codex-chrome/src/tools/dom/service.ts`
**Description**: Implement `_get_ax_tree_for_all_frames()` with ARIA fallback:
- Since chrome.accessibility API not available for web content, use ARIA attributes
- Request ARIA data from content script (via T011 ariaExtraction)
- Convert ARIA data to GetFullAXTreeReturns format
- Create EnhancedAXNode for each element with ARIA attributes
- Map backend_node_id to AXNode for integration

**Dependencies**: T011, T017
**Acceptance**: Returns accessibility tree based on ARIA attributes

---

- [x] ### T019: Add Chrome API error handling to DomService
**File**: `codex-chrome/src/tools/dom/service.ts`
**Description**: Add comprehensive error handling:
- Wrap all chrome.* API calls in try/catch
- Map Chrome API errors to DOMErrorCode enum
- Handle `chrome.runtime.lastError` in callbacks
- Add timeout handling for content script messages
- Propagate errors with context (tab_id, operation, details)

**Dependencies**: T015-T018
**Acceptance**: All Chrome API errors properly caught and mapped

---

## Phase 3.5: DOMTool Refactoring

- [x] ### T020: Remove all atomic operation methods
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Remove deprecated atomic operation methods:
- Remove: `query()`, `click()`, `type()`, `getAttribute()`, `setAttribute()`
- Remove: `getProperty()`, `setProperty()`, `getText()`, `getHtml()`
- Remove: `extractLinks()`, `fillForm()`, `submitForm()`, `focus()`, `scroll()`
- Remove: `captureSnapshot()`, `getAccessibilityTree()`, `getPaintOrder()`, `detectClickable()`
- Remove: `waitForElementOperation()`, `checkVisibility()`, `executeSequenceOperation()`
- Remove: All helper methods for atomic operations
- Keep: `ensureContentScriptInjected()`, `setupMessageListener()`, infrastructure methods

**Dependencies**: None (safe to delete)
**Acceptance**: Only infrastructure methods remain, TypeScript compiles

---

- [x] ### T021: Implement captureDOM() method
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Implement `captureDOM()` method that calls DomService:
- Parse and validate DOMCaptureRequest using Zod schema
- Get target tab (request.tab_id or active tab)
- Ensure content script injected in target tab
- Create DomService instance with browser_session config
- Call `domService.get_serialized_dom_tree(previous_cached_state)`
- Map SerializedDOMState to DOMCaptureResponse structure
- Handle errors and convert to DOMCaptureError format
- Return DOMCaptureResponse with success/error

**Dependencies**: T019 (DomService adapted), T020 (cleanup done)
**Acceptance**: captureDOM() successfully calls DomService and returns response

---

- [x] ### T022: Implement clearCache() method
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Implement cache management:
- Add private `cache: Map<string, SerializedDOMState>` property
- Implement `clearCache(tab_id?: number)` method:
  - If tab_id provided: Remove cache entries for that tab
  - If tab_id undefined: Clear entire cache
- Implement cache key generation: `${tab_id}_${url}_${timestamp}`
- Add cache TTL check (30 seconds)
- Add LRU eviction (max 5 entries)

**Dependencies**: T021
**Acceptance**: Cache correctly stores and invalidates DOM states

---

- [x] ### T023: Add request validation using Zod
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Add Zod schema validation for requests:
- Import DOMCaptureRequestSchema from contracts
- Create Zod schema: `z.object({ tab_id: z.number().optional(), ... })`
- Validate request in `captureDOM()` before processing
- Throw validation error with helpful message if invalid
- Include validation error details in DOMCaptureError response

**Dependencies**: T021, T002 (Zod installed)
**Acceptance**: Invalid requests are rejected with clear error messages

---

- [x] ### T024: Update tool definition for BaseTool
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Update `toolDefinition` property for new API:
- Update tool name: keep `browser_dom`
- Update description: "Capture complete DOM state from web pages - high-level DOM reading for AI agents"
- Update input schema to match DOMCaptureRequest interface
- Remove all atomic operation parameters
- Add new parameters: include_shadow_dom, include_iframes, max_iframe_depth, etc.
- Update metadata.capabilities: Remove atomic operations, add "dom_capture", "serialized_tree", "selector_map"

**Dependencies**: T021
**Acceptance**: Tool definition accurately reflects new API

---

## Phase 3.6: Message Passing Protocol

- [x] ### T025: Define message protocol types
**File**: `codex-chrome/src/core/MessageRouter.ts` (or new file `src/types/messages.ts`)
**Description**: Define message types for background ↔ content communication:
- Add `DOM_CAPTURE_REQUEST` message type
- Add `DOM_CAPTURE_RESPONSE` message type
- Define request payload: `{ options: DOMCaptureRequest }`
- Define response payload: `{ snapshot: CaptureSnapshotReturns, viewport: ViewportInfo }`
- Add timeout field to request
- Add request_id for correlation

**Dependencies**: None
**Acceptance**: Message types defined and exported

---

- [x] ### T026: Implement message handler in content script
**File**: `codex-chrome/src/content/content-script.ts`
**Description**: Add message listener for DOM capture requests:
- Listen for `DOM_CAPTURE_REQUEST` messages
- Call domCaptureHandler from T014
- Measure timing (start, traversal_time, total_time)
- Send `DOM_CAPTURE_RESPONSE` with snapshot data
- Handle errors and send error response
- Add request_id to response for correlation

**Dependencies**: T014, T025
**Acceptance**: Content script responds to capture requests correctly

---

- [x] ### T027: Implement message sender in DOMTool
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Update `captureDOM()` to use new message protocol:
- Generate unique request_id
- Send `DOM_CAPTURE_REQUEST` to content script
- Set timeout using options.timeout_ms (default 5000ms)
- Wait for `DOM_CAPTURE_RESPONSE` with matching request_id
- Handle timeout by rejecting with TIMEOUT error
- Handle chrome.runtime.lastError

**Dependencies**: T021, T025, T026
**Acceptance**: Background ↔ content communication works reliably

---

- [x] ### T028: Add timeout handling for long-running captures
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Implement progressive timeout handling:
- For simple pages (<1000 nodes): 1s timeout
- For medium pages (1000-5000 nodes): 3s timeout
- For complex pages (5000-20000 nodes): 10s timeout
- Allow user override via options.timeout_ms
- If timeout exceeded: Return partial results if available
- Add warning to response about timeout

**Dependencies**: T027
**Acceptance**: Timeout handling works for pages of different sizes

---

- [x] ### T029: Implement error propagation from content to background
**File**: `codex-chrome/src/tools/DOMTool.ts` and `codex-chrome/src/content/content-script.ts`
**Description**: Ensure errors propagate correctly:
- Content script catches all errors during capture
- Content script sends error response with error type and message
- Background script receives error and maps to DOMErrorCode
- Background script includes error context (element, details)
- Test all error types: CROSS_ORIGIN_FRAME, MESSAGE_SIZE_EXCEEDED, etc.

**Dependencies**: T026, T027
**Acceptance**: All error types propagate correctly with context

---

## Phase 3.7: Integration Tests

### T030 [P]: Integration test for complete DOM capture flow
**File**: `codex-chrome/tests/integration/DOMTool.fullFlow.test.ts`
**Description**: Test complete flow from background to content and back:
- Setup: Mock Chrome APIs (tabs, scripting, runtime)
- Setup: Create test HTML with various elements (buttons, inputs, links)
- Setup: Mock content script response
- Execute: `domTool.captureDOM({ tab_id: 123 })`
- Assert: serialized_tree contains expected elements
- Assert: selector_map has correct entries
- Assert: metadata fields are populated
- Assert: timing information is present

**Dependencies**: T027
**Acceptance**: Full integration test passes

---

### T031 [P]: Integration test for selector_map element lookup
**File**: `codex-chrome/tests/integration/DOMTool.selectorMap.test.ts`
**Description**: Test selector_map provides complete element details:
- Capture DOM with test HTML
- Get response with selector_map
- Lookup element by index: `selector_map[1]`
- Assert: Element has all properties (node_name, attributes, absolute_position, is_visible)
- Assert: Element has snapshot_node with bounds and styles
- Assert: Element has ax_node with ARIA attributes
- Test multiple elements from selector_map

**Dependencies**: T027
**Acceptance**: selector_map provides complete element details

---

### T032 [P]: Integration test for caching behavior
**File**: `codex-chrome/tests/integration/DOMTool.caching.test.ts`
**Description**: Test cache stores and retrieves states correctly:
- First call: `captureDOM({ use_cache: true })`
- Capture timing from first call
- Second call: Same request (should hit cache)
- Assert: Second call faster than first
- Third call: `captureDOM({ use_cache: false })`
- Assert: Third call timing similar to first (cache bypassed)
- Call: `clearCache(tab_id)`
- Fourth call: Same request (cache cleared)
- Assert: Fourth call timing similar to first

**Dependencies**: T022, T027
**Acceptance**: Caching works as expected

---

### T033 [P]: Integration test for error scenarios
**File**: `codex-chrome/tests/integration/DOMTool.errors.test.ts`
**Description**: Test all error scenarios end-to-end:
- Test TAB_NOT_FOUND: Invalid tab_id returns error
- Test CONTENT_SCRIPT_NOT_LOADED: Script injection fails
- Test TIMEOUT: Capture exceeds timeout_ms
- Test CROSS_ORIGIN_FRAME: Cross-origin iframe in page (warning, not error)
- Test PERMISSION_DENIED: Insufficient permissions
- Assert: Each error has correct code and message
- Assert: Errors include context (tab_id, element, details)

**Dependencies**: T029
**Acceptance**: All error scenarios handled correctly

---

### T034 [P]: Integration test with real HTML fixtures
**File**: `codex-chrome/tests/integration/DOMTool.fixtures.test.ts`
**Description**: Test with real-world HTML fixtures:
- Fixture 1: Simple page (form with inputs, buttons)
- Fixture 2: Complex page (nested divs, 1000+ elements)
- Fixture 3: Page with iframes (same-origin and cross-origin)
- Fixture 4: Page with shadow DOM (web components)
- Fixture 5: Page with hidden elements (display: none, visibility: hidden)
- For each fixture:
  - Assert: DOM captured successfully
  - Assert: Expected element count
  - Assert: Interactive elements indexed correctly
  - Assert: Performance within targets

**Dependencies**: T027
**Acceptance**: All fixtures process correctly

---

## Phase 3.8: Performance Optimization

### T035: Add performance timing instrumentation
**File**: `codex-chrome/src/tools/dom/service.ts` and `codex-chrome/src/tools/dom/serializer/serializer.ts`
**Description**: Add detailed timing to all major operations:
- Time DOM traversal in content script
- Time snapshot capture
- Time string interning
- Time ARIA extraction
- Time iframe traversal
- Time serialization (create_simplified_tree, calculate_paint_order, optimize_tree, bbox_filtering)
- Include timing in SerializedDOMState.timing
- Add timing breakdown in response if include_timing: true

**Dependencies**: T021
**Acceptance**: Timing data available in response

---

### T036: Test and optimize for large pages
**File**: `codex-chrome/tests/performance/DOMTool.largePages.test.ts`
**Description**: Create performance tests for large pages:
- Test page with 1,000 nodes → target <500ms
- Test page with 5,000 nodes → target <1s
- Test page with 10,000 nodes → target <2s
- Test page with 20,000 nodes → target <5s
- Measure: DOM traversal time, serialization time, total time
- Profile bottlenecks using timing instrumentation
- Optimize slowest operations

**Dependencies**: T035
**Acceptance**: Performance targets met for all page sizes

---

### T037: Optimize string interning implementation
**File**: `codex-chrome/src/tools/dom/chrome/stringInterning.ts`
**Description**: Optimize string interning for performance:
- Profile current implementation
- Optimize Map lookup (consider using hash)
- Batch string interning operations
- Preallocate array capacity
- Test: Measure size reduction (target 60-70%)
- Test: Measure interning overhead (target <5% of total time)

**Dependencies**: T010, T036
**Acceptance**: Interning reduces size by 60-70% with minimal overhead

---

### T038: Optimize DOM tree traversal
**File**: `codex-chrome/src/tools/dom/chrome/domTraversal.ts`
**Description**: Optimize tree traversal performance:
- Profile current implementation
- Use iterative traversal instead of recursive (avoid stack overflow)
- Early exit for hidden subtrees (display: none)
- Batch DOM API calls (getBoundingClientRect, getComputedStyle)
- Use TreeWalker API for faster traversal
- Test: Measure traversal time on 10,000 node page

**Dependencies**: T008, T036
**Acceptance**: Traversal time reduced by 30-50%

---

## Phase 3.9: Documentation & Polish

- [x] ### T039 [P]: Add JSDoc comments to all public methods
**File**: `codex-chrome/src/tools/DOMTool.ts`
**Description**: Add comprehensive JSDoc documentation:
- Add JSDoc to `captureDOM()` method with examples
- Add JSDoc to `clearCache()` method
- Document all parameters with @param tags
- Document return types with @returns tags
- Add @example sections showing usage
- Add @throws documentation for errors

**Dependencies**: T021, T022
**Acceptance**: All public methods have complete JSDoc

---

- [x] ### T040 [P]: Update CLAUDE.md with new API
**File**: `CLAUDE.md` (repository root)
**Description**: Update agent context file with new DOMTool API:
- Remove references to atomic operations
- Add captureDOM() API documentation
- Add example usage
- Add note about selector_map for element lookup
- Update recent changes section

**Dependencies**: T021
**Acceptance**: CLAUDE.md accurately documents new API

---

### T041 [P]: Add inline comments to complex logic
**File**: `codex-chrome/src/tools/dom/service.ts`, `codex-chrome/src/tools/dom/serializer/serializer.ts`
**Description**: Add comments explaining complex logic:
- DomService._convert_to_enhanced_tree() recursion
- DOMTreeSerializer.serialize_accessible_elements() algorithm
- Paint order calculation logic
- Bounding box filtering logic
- String interning algorithm

**Dependencies**: None
**Acceptance**: Complex logic is well-documented

---

### T042 [P]: Create migration guide for v1.x users
**File**: `codex-chrome/MIGRATION.md` (or append to existing)
**Description**: Create migration guide from DOMTool v1.x to v2.0:
- Document breaking changes (atomic operations removed)
- Provide before/after code examples
- Show how to migrate from query() → captureDOM()
- Show how to migrate from getAttribute() → selector_map lookup
- Document new capabilities (full page capture, accessibility tree)

**Dependencies**: T021
**Acceptance**: Migration guide is clear and actionable

---

### T043: Run full test suite and fix any issues
**File**: All test files
**Description**: Run complete test suite and address failures:
- Run: `npm test`
- Fix any failing tests
- Ensure all contract tests pass
- Ensure all integration tests pass
- Ensure all performance tests pass
- Achieve >90% code coverage on new code

**Dependencies**: T003-T007, T030-T034, T036
**Acceptance**: All tests pass, coverage >90%

---

### T044: Manual testing with real Chrome extension
**File**: Manual testing
**Description**: Load extension in Chrome and test manually:
- Install extension in Chrome
- Open various web pages (simple, complex, with iframes)
- Call captureDOM() from background script console
- Verify serialized_tree is readable
- Verify selector_map contains element details
- Test caching behavior
- Test error handling (invalid tab, timeout)
- Verify performance on large pages

**Dependencies**: T043
**Acceptance**: Extension works correctly in real Chrome environment

---

## Dependencies Graph

```
Setup (T001-T002)
  ↓
Tests [P] (T003-T007) ← Must fail before implementation
  ↓
Content Script Implementation (T008-T014) ← Sequential
  ↓
  ├─→ DomService Adaptation (T015-T019) ← Sequential
  │     ↓
  │     └─→ DOMTool Refactoring (T020-T024) ← Sequential
  │           ↓
  └─→ Message Passing (T025-T029) ← Can parallel with T020-T024
        ↓
Integration Tests [P] (T030-T034) ← After implementation
  ↓
Performance (T035-T038) ← Sequential
  ↓
Documentation [P] (T039-T042) ← Can parallel with T035-T038
  ↓
Final Testing (T043-T044) ← Sequential
```

---

## Parallel Execution Examples

### Example 1: Run all contract tests in parallel (T003-T007)
```bash
# After T001-T002 complete, launch T003-T007 together
Task: "Contract test for DOMCaptureRequest validation in codex-chrome/tests/contract/DOMTool.captureDOM.request.test.ts"
Task: "Contract test for DOMCaptureResponse structure in codex-chrome/tests/contract/DOMTool.captureDOM.response.test.ts"
Task: "Contract test for error handling in codex-chrome/tests/contract/DOMTool.errors.test.ts"
Task: "Integration test for basic DOM capture flow in codex-chrome/tests/integration/DOMTool.captureDOM.test.ts"
Task: "Integration test for cache behavior in codex-chrome/tests/integration/DOMTool.cache.test.ts"
```

### Example 2: Run all integration tests in parallel (T030-T034)
```bash
# After T029 complete, launch T030-T034 together
Task: "Integration test for complete DOM capture flow in codex-chrome/tests/integration/DOMTool.fullFlow.test.ts"
Task: "Integration test for selector_map element lookup in codex-chrome/tests/integration/DOMTool.selectorMap.test.ts"
Task: "Integration test for caching behavior in codex-chrome/tests/integration/DOMTool.caching.test.ts"
Task: "Integration test for error scenarios in codex-chrome/tests/integration/DOMTool.errors.test.ts"
Task: "Integration test with real HTML fixtures in codex-chrome/tests/integration/DOMTool.fixtures.test.ts"
```

### Example 3: Run all documentation tasks in parallel (T039-T042)
```bash
# While T035-T038 are running, launch T039-T042 in parallel
Task: "Add JSDoc comments to all public methods in codex-chrome/src/tools/DOMTool.ts"
Task: "Update CLAUDE.md with new API in CLAUDE.md"
Task: "Add inline comments to complex logic in codex-chrome/src/tools/dom/service.ts"
Task: "Create migration guide for v1.x users in codex-chrome/MIGRATION.md"
```

---

## Notes

- **[P] tasks** = different files, can run in parallel
- **Sequential tasks** = same file or dependencies
- Verify tests fail before implementing (TDD)
- Commit after each task
- Run `npm run type-check` after each file modification
- Run `npm test` frequently to catch regressions

---

## Validation Checklist

- [x] All contracts have corresponding tests (T003-T005)
- [x] All core entities implemented (DOMCaptureRequest, DOMCaptureResponse, SerializedDOMState)
- [x] All tests come before implementation (T003-T007 before T008+)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Dependencies properly sequenced (Content Script → DomService → DOMTool)
- [x] TDD workflow maintained (tests fail first, then implement)
- [x] Performance targets defined (T036)
- [x] Documentation tasks included (T039-T042)

---

## Estimated Effort

- **Total tasks**: 44
- **Setup**: 2 tasks (~1 hour)
- **Tests First**: 5 tasks (~4 hours)
- **Content Script**: 7 tasks (~12 hours)
- **DomService**: 5 tasks (~8 hours)
- **DOMTool**: 5 tasks (~6 hours)
- **Message Passing**: 5 tasks (~5 hours)
- **Integration Tests**: 5 tasks (~6 hours)
- **Performance**: 4 tasks (~6 hours)
- **Documentation**: 4 tasks (~3 hours)
- **Final Testing**: 2 tasks (~2 hours)

**Total estimated**: ~53 hours (1.5-2 weeks for single developer)

Many tasks can be parallelized, reducing wall-clock time significantly.
