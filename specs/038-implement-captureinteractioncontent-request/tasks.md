# Tasks: Capture Interaction Content for Browser AI Agent

**Input**: Design documents from `/specs/038-implement-captureinteractioncontent-request/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md
**Branch**: `038-implement-captureinteractioncontent-request`

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Loaded: TypeScript 5.x, Chrome extension, dom-accessibility-api
2. Load optional design documents:
   → ✅ data-model.md: 6 entities (PageModel, InteractiveControl, ControlStates, BoundingBox, SelectorMap, CaptureRequest)
   → ✅ contracts/: 2 schemas (page-model.schema.json, capture-request.schema.json)
   → ✅ research.md: 7 technical decisions
   → ✅ quickstart.md: 10 validation steps
3. Generate tasks by category:
   → Setup: 2 tasks
   → Tests: 7 tasks (2 contract, 5 integration)
   → Core: 15 tasks (types, utilities, core logic)
   → Integration: 3 tasks (DomService, captureDOM wrapper)
   → Polish: 8 tasks (unit tests, performance, validation)
4. Apply task rules:
   → Different files = [P] for parallel
   → Tests before implementation (TDD)
   → Dependencies tracked
5. Number tasks sequentially (T001-T035)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness: ✅ All contracts, entities, scenarios covered
9. Return: SUCCESS (35 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
All paths relative to repository root (`codex-chrome/`):
- Source: `src/tools/dom/`
- Tests: `tests/contract/`, `tests/integration/`, `tests/unit/`

---

## Phase 3.1: Setup

- [ ] **T001** Install dom-accessibility-api dependency
  - **File**: `codex-chrome/package.json`
  - **Action**: Run `pnpm add dom-accessibility-api`
  - **Acceptance**: package.json contains `"dom-accessibility-api": "^5.0.0"` (or latest version)
  - **Dependencies**: None

- [ ] **T002** Create directory structure for new modules
  - **Files**: `codex-chrome/src/tools/dom/`, `codex-chrome/tests/contract/`, `codex-chrome/tests/integration/`, `codex-chrome/tests/unit/`
  - **Action**: Ensure directories exist (may already exist)
  - **Acceptance**: All directories present
  - **Dependencies**: None

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Schema Validation)

- [ ] **T003 [P]** Contract test for PageModel schema in `tests/contract/pageModel.contract.test.ts`
  - **File**: `codex-chrome/tests/contract/pageModel.contract.test.ts`
  - **Action**: Write test validating PageModel output against `contracts/page-model.schema.json`
  - **Test Cases**:
    - Valid PageModel with all required fields
    - PageModel with 400 controls (max limit)
    - PageModel with minimal controls (empty array)
    - Invalid PageModel missing required fields (should fail validation)
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: contracts/page-model.schema.json
  - **Parallel**: Can run with T004

- [ ] **T004 [P]** Contract test for CaptureRequest schema in `tests/contract/captureRequest.contract.test.ts`
  - **File**: `codex-chrome/tests/contract/captureRequest.contract.test.ts`
  - **Action**: Write test validating CaptureRequest input against `contracts/capture-request.schema.json`
  - **Test Cases**:
    - Valid CaptureRequest with default options
    - CaptureRequest with custom maxControls/maxHeadings
    - CaptureRequest with invalid values (negative numbers, should fail)
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: contracts/capture-request.schema.json
  - **Parallel**: Can run with T003

### Integration Tests (Acceptance Scenarios from spec.md)

- [ ] **T005 [P]** Integration test for login page scenario in `tests/integration/loginPage.integration.test.ts`
  - **File**: `codex-chrome/tests/integration/loginPage.integration.test.ts`
  - **Action**: Write test for Acceptance Scenario 1 (login form with email/password/button)
  - **Test Setup**: Create mock HTML with login form
  - **Assertions**:
    - PageModel contains heading "Login"
    - 2 textbox controls with names "Email" and "Password"
    - 1 button control with name "Sign In"
    - Stable IDs generated (te_1, te_2, bu_3)
    - Selector map separate from controls (aimap object)
    - Required states captured
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: None (uses mock HTML)
  - **Parallel**: Can run with T006, T007, T008, T009

- [ ] **T006 [P]** Integration test for e-commerce page scenario in `tests/integration/ecommerce.integration.test.ts`
  - **File**: `codex-chrome/tests/integration/ecommerce.integration.test.ts`
  - **Action**: Write test for Acceptance Scenario 2 (complex page with 200+ elements, filtering)
  - **Test Setup**: Create mock HTML with 500+ elements (200+ interactive)
  - **Assertions**:
    - Only visible elements returned
    - Primary landmarks identified (main, navigation, search)
    - Top-level headings extracted
    - Controls capped at 400 (maxControls limit enforced)
    - Bounding box information included
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: None (uses mock HTML)
  - **Parallel**: Can run with T005, T007, T008, T009

- [ ] **T007 [P]** Integration test for privacy redaction in `tests/integration/privacyRedaction.integration.test.ts`
  - **File**: `codex-chrome/tests/integration/privacyRedaction.integration.test.ts`
  - **Action**: Write test for Acceptance Scenario 3 (password field redaction)
  - **Test Setup**: Create mock HTML with password field containing value "secret123"
  - **Assertions**:
    - Password field identified (role: textbox, type: password)
    - value_len NOT included for password (privacy)
    - Actual value NOT included in output
    - Placeholder text included if present
    - includeValues=true still redacts password (shows "•••")
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: None (uses mock HTML)
  - **Parallel**: Can run with T005, T006, T008, T009

- [ ] **T008 [P]** Integration test for dynamic content in `tests/integration/dynamicContent.integration.test.ts`
  - **File**: `codex-chrome/tests/integration/dynamicContent.integration.test.ts`
  - **Action**: Write test for Acceptance Scenario 4 (checkbox states, expanded/collapsed)
  - **Test Setup**: Create mock HTML with checkboxes, expandable sections (details/summary)
  - **Assertions**:
    - Checkbox checked state captured (true/false)
    - Expandable section expanded state captured (aria-expanded)
    - Disabled state identified
    - Visual indicators included (inViewport, visible)
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: None (uses mock HTML)
  - **Parallel**: Can run with T005, T006, T007, T009

- [ ] **T009 [P]** Integration test for nested regions in `tests/integration/nestedRegions.integration.test.ts`
  - **File**: `codex-chrome/tests/integration/nestedRegions.integration.test.ts`
  - **Action**: Write test for Acceptance Scenario 5 (navigation inside header, region tagging)
  - **Test Setup**: Create mock HTML with nested landmarks (nav inside header, form inside main)
  - **Assertions**:
    - Controls tagged with containing region (region: "main", region: "navigation")
    - Landmark structure clear (regions array)
    - Hierarchical context preserved (nested elements reference innermost landmark)
  - **Acceptance**: Test file exists, all assertions defined, tests FAIL (no implementation yet)
  - **Dependencies**: None (uses mock HTML)
  - **Parallel**: Can run with T005, T006, T007, T008

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Type Definitions

- [ ] **T010 [P]** Define TypeScript types in `src/tools/dom/pageModel.ts`
  - **File**: `codex-chrome/src/tools/dom/pageModel.ts`
  - **Action**: Define all TypeScript interfaces from data-model.md
  - **Types to Define**:
    - `PageModel` (title, url, headings, regions, controls, aimap)
    - `InteractiveControl` (id, role, name, states, selector, region, boundingBox, visible, inViewport)
    - `ControlStates` (disabled, checked, expanded, required, placeholder, value_len, href, extensible)
    - `BoundingBox` (x, y, width, height)
    - `SelectorMap` (Record<string, string>)
    - `CaptureRequest` (baseUrl, maxControls, maxHeadings, includeValues, maxIframeDepth)
  - **Acceptance**: All types defined with JSDoc comments, exported, zero TypeScript errors
  - **Dependencies**: T002 (directory structure)
  - **Parallel**: Can run with T011, T012

### Utility Modules

- [ ] **T011 [P]** Implement HTML sanitization in `src/tools/dom/htmlSanitizer.ts`
  - **File**: `codex-chrome/src/tools/dom/htmlSanitizer.ts`
  - **Action**: Implement `sanitizeHTML(html: string): string` function
  - **Logic**:
    - Strip `<script>` tags and content (regex)
    - Strip `<style>` tags and content (regex)
    - Strip HTML comments (regex)
    - Strip inline event handlers (onclick, onerror, etc.)
  - **Acceptance**: Function defined, exported, strips all noise, preserves semantic HTML
  - **Dependencies**: T010 (types)
  - **Parallel**: Can run with T010, T012, T013

- [ ] **T012 [P]** Implement selector generation in `src/tools/dom/selectorGenerator.ts`
  - **File**: `codex-chrome/src/tools/dom/selectorGenerator.ts`
  - **Action**: Implement `generateSelector(element: Element): string` function
  - **Logic**:
    - Priority 1: Return `#${CSS.escape(id)}` if element has ID
    - Priority 2: Check data-testid, data-test, data-qa, data-cy attributes
    - Priority 3: Build short robust path (max 4 levels)
      - Traverse up to 4 parent levels
      - Collect tag + first 2 classes per level
      - Join with `>` combinator
  - **Acceptance**: Function defined, exported, generates valid CSS selectors
  - **Dependencies**: T010 (types)
  - **Parallel**: Can run with T010, T011, T013

- [ ] **T013 [P]** Implement visibility filtering in `src/tools/dom/visibilityFilter.ts`
  - **File**: `codex-chrome/src/tools/dom/visibilityFilter.ts`
  - **Action**: Implement `isElementActionable(element: Element): boolean` and `isInViewport(element: Element): boolean`
  - **Logic for isElementActionable**:
    - Check `getComputedStyle()`: display !== 'none', visibility !== 'hidden', opacity !== '0'
    - Check `getBoundingClientRect()`: width > 0, height > 0
    - Return true if all checks pass
  - **Logic for isInViewport**:
    - Get `getBoundingClientRect()`
    - Check if rect intersects viewport (top >= 0, left >= 0, bottom <= innerHeight, right <= innerWidth)
  - **Acceptance**: Both functions defined, exported, correctly identify actionable/visible elements
  - **Dependencies**: T010 (types)
  - **Parallel**: Can run with T010, T011, T012

- [ ] **T014 [P]** Implement accessible name fallback in `src/tools/dom/accessibleNameUtil.ts`
  - **File**: `codex-chrome/src/tools/dom/accessibleNameUtil.ts`
  - **Action**: Implement `extractAccessibleName(element: Element): string` wrapper
  - **Logic**:
    - Try `computeAccessibleName(element)` from dom-accessibility-api
    - Catch errors, fallback to:
      - `element.textContent?.trim()`
      - `element.getAttribute('aria-label')`
      - `element.getAttribute('placeholder')`
      - Empty string if all fail
    - Trim whitespace, limit to 160 characters
  - **Acceptance**: Function defined, exported, handles errors gracefully
  - **Dependencies**: T001 (dom-accessibility-api), T010 (types)
  - **Parallel**: Can run with T011, T012, T013

### Core Capture Logic

- [ ] **T015** Implement element role detection in `src/tools/dom/roleDetector.ts`
  - **File**: `codex-chrome/src/tools/dom/roleDetector.ts`
  - **Action**: Implement `getElementRole(element: Element): string | null`
  - **Logic**:
    - Check explicit `role` attribute first
    - Fallback to implicit HTML semantics:
      - `<a href>` → "link"
      - `<button>` → "button"
      - `<input type="text|email|etc">` → "textbox"
      - `<input type="checkbox">` → "checkbox"
      - `<input type="radio">` → "radio"
      - `<select>` → "combobox"
      - `<textarea>` → "textbox"
      - `<summary>` → "button"
    - Return null for non-interactive elements
  - **Acceptance**: Function defined, supports 20+ element types
  - **Dependencies**: T010 (types)
  - **Blocks**: T016 (needs role detection)

- [ ] **T016** Implement control state extraction in `src/tools/dom/stateExtractor.ts`
  - **File**: `codex-chrome/src/tools/dom/stateExtractor.ts`
  - **Action**: Implement `extractControlStates(element: Element, includeValues: boolean): ControlStates`
  - **Logic**:
    - Check disabled: `aria-disabled` or `HTMLElement.disabled`
    - Check checked (checkbox/radio): `aria-checked` or `HTMLInputElement.checked`
    - Check expanded: `aria-expanded` attribute
    - Check required: `required` attribute or `aria-required`
    - Extract placeholder: `placeholder` attribute (max 80 chars)
    - Extract value (privacy rules):
      - Password: NEVER include value or value_len
      - Other fields: value_len if includeValues=false, value (max 200 chars) if includeValues=true
    - Extract href (links): Convert to relative path if possible
  - **Acceptance**: Function defined, handles all state types, enforces privacy rules
  - **Dependencies**: T010 (types), T015 (role detection)
  - **Blocks**: T018 (needs state extraction)

- [ ] **T017** Implement heading extraction in `src/tools/dom/headingExtractor.ts`
  - **File**: `codex-chrome/src/tools/dom/headingExtractor.ts`
  - **Action**: Implement `extractHeadings(doc: Document, maxHeadings: number): string[]`
  - **Logic**:
    - Query `doc.querySelectorAll('h1, h2, h3')`
    - Map to text content, trim whitespace
    - Filter empty strings
    - Slice to maxHeadings (default 30)
  - **Acceptance**: Function defined, returns max 30 headings
  - **Dependencies**: T010 (types)
  - **Parallel**: Can run with T018, T019
  - **Blocks**: T020 (main capture function)

- [ ] **T018** Implement landmark region detection in `src/tools/dom/regionDetector.ts`
  - **File**: `codex-chrome/src/tools/dom/regionDetector.ts`
  - **Action**: Implement `detectRegions(doc: Document): string[]` and `getElementRegion(element: Element): string | undefined`
  - **Logic for detectRegions**:
    - Query for landmark selectors: `main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="dialog"], [role="search"]`
    - Map to region type (role attribute or tag name)
    - Deduplicate (Set semantics)
  - **Logic for getElementRegion**:
    - Find closest ancestor matching landmark selectors
    - Return role attribute or tag name
    - Return undefined if no landmark ancestor
  - **Acceptance**: Functions defined, correctly identify 7+ landmark types
  - **Dependencies**: T010 (types), T016 (needs state extraction)
  - **Blocks**: T020 (main capture function)

- [ ] **T019** Implement iframe traversal in `src/tools/dom/iframeHandler.ts`
  - **File**: `codex-chrome/src/tools/dom/iframeHandler.ts`
  - **Action**: Implement `processIframes(doc: Document, currentDepth: number, maxDepth: number, options: CaptureRequest): InteractiveControl[]`
  - **Logic**:
    - Return empty array if `currentDepth >= maxDepth`
    - Query `doc.querySelectorAll('iframe')`
    - For each iframe:
      - Try to access `iframe.contentDocument` (will throw SecurityError if cross-origin)
      - If accessible (same-origin), recursively call `captureInteractionContent()` with `currentDepth + 1`
      - Catch SecurityError silently (skip cross-origin iframes)
    - Concatenate controls from all same-origin iframes
  - **Acceptance**: Function defined, handles same-origin only (1 level deep), silently skips cross-origin
  - **Dependencies**: T010 (types)
  - **Parallel**: Can run with T017, T018
  - **Blocks**: T020 (main capture function)

- [ ] **T020** Implement main capture function in `src/tools/dom/interactionCapture.ts`
  - **File**: `codex-chrome/src/tools/dom/interactionCapture.ts`
  - **Action**: Implement `captureInteractionContent(target: Document | string, options: CaptureRequest): Promise<PageModel>`
  - **Logic**:
    - If target is string, sanitize HTML (T011) and parse with DOMParser
    - Extract headings (T017)
    - Detect regions (T018)
    - Query all elements, filter interactive (`<a>, <button>, <input>, <select>, <textarea>, <summary>`)
    - For each element:
      - Check visibility (T013)
      - Get role (T015)
      - Extract accessible name (T014)
      - Extract states (T016)
      - Generate selector (T012)
      - Get region (T018)
      - Get bounding box (getBoundingClientRect)
      - Check inViewport (T013)
      - Create InteractiveControl object with stable ID (format: `{role[0:2]}_{counter}`)
    - Cap controls at maxControls (default 400)
    - Process iframes (T019) if maxIframeDepth > 0
    - Build aimap (ID → selector mapping)
    - Return PageModel
  - **30-second timeout**: Wrap in Promise.race() with AbortController
  - **Acceptance**: Function defined, orchestrates all utilities, returns valid PageModel
  - **Dependencies**: T010-T019 (all utilities)
  - **Blocks**: T021 (DomService integration)

---

## Phase 3.4: Integration

- [ ] **T021** Integrate captureInteractionContent into DomService in `src/tools/dom/service.ts`
  - **File**: `codex-chrome/src/tools/dom/service.ts`
  - **Action**: Add `captureInteractionContent()` method to existing DomService class
  - **Logic**:
    - Import from interactionCapture.ts (T020)
    - Add method: `async captureInteractionContent(request: CaptureRequest): Promise<PageModel>`
    - Delegate to standalone function, passing tab context
    - Handle errors, return DOMServiceError if capture fails
  - **Acceptance**: Method added to DomService, integration complete
  - **Dependencies**: T020 (main capture function)
  - **Blocks**: T022 (captureDOM wrapper)

- [ ] **T022** Create captureDOM() backward compatibility wrapper in `src/tools/dom/service.ts`
  - **File**: `codex-chrome/src/tools/dom/service.ts` (same file as T021)
  - **Action**: Update existing `captureDOM()` method to optionally delegate to captureInteractionContent()
  - **Logic** (optional, non-breaking):
    - Keep existing broken captureDOM() logic as-is (future fix)
    - Add comment: "captureDOM() serialization broken, use captureInteractionContent() as alternative"
    - Optionally add fallback: If serialization fails, call captureInteractionContent() and adapt output
  - **Acceptance**: captureDOM() remains backward compatible, optional delegation documented
  - **Dependencies**: T021 (DomService integration)
  - **Blocks**: None

- [ ] **T023** Add message passing for content script in `src/content/domCapture.ts`
  - **File**: `codex-chrome/src/content/domCapture.ts`
  - **Action**: Add message handler for DOM_CAPTURE_REQUEST that calls captureInteractionContent()
  - **Logic**:
    - Listen for MessageType.DOM_CAPTURE_REQUEST
    - Parse request options (CaptureRequest)
    - Call captureInteractionContent() with live `document`
    - Return PageModel via message response
    - Handle timeouts (30 seconds)
  - **Acceptance**: Content script integration complete, message passing works
  - **Dependencies**: T020 (main capture function)
  - **Blocks**: None

---

## Phase 3.5: Polish

### Unit Tests

- [ ] **T024 [P]** Unit tests for HTML sanitization in `tests/unit/htmlSanitizer.test.ts`
  - **File**: `codex-chrome/tests/unit/htmlSanitizer.test.ts`
  - **Action**: Write unit tests for sanitizeHTML() (T011)
  - **Test Cases**:
    - Strips `<script>` tags
    - Strips `<style>` tags
    - Strips HTML comments
    - Strips inline event handlers (onclick, onerror)
    - Preserves semantic HTML (headings, forms, etc.)
  - **Acceptance**: All test cases pass
  - **Dependencies**: T011 (sanitizer implementation)
  - **Parallel**: Can run with T025, T026, T027, T028

- [ ] **T025 [P]** Unit tests for selector generation in `tests/unit/selectorGenerator.test.ts`
  - **File**: `codex-chrome/tests/unit/selectorGenerator.test.ts`
  - **Action**: Write unit tests for generateSelector() (T012)
  - **Test Cases**:
    - ID priority: Returns `#id` for element with ID
    - Test ID priority: Returns `[data-testid="foo"]` if no ID
    - Short path: Builds `tag.class1.class2 > tag > tag` for elements without ID/test IDs
    - 4-level max: Stops at 4 parent levels
  - **Acceptance**: All test cases pass
  - **Dependencies**: T012 (selector generation implementation)
  - **Parallel**: Can run with T024, T026, T027, T028

- [ ] **T026 [P]** Unit tests for visibility filtering in `tests/unit/visibilityFilter.test.ts`
  - **File**: `codex-chrome/tests/unit/visibilityFilter.test.ts`
  - **Action**: Write unit tests for isElementActionable() and isInViewport() (T013)
  - **Test Cases**:
    - display:none → not actionable
    - visibility:hidden → not actionable
    - opacity:0 → not actionable
    - width:0 or height:0 → not actionable
    - Visible element → actionable
    - inViewport checks viewport bounds correctly
  - **Acceptance**: All test cases pass
  - **Dependencies**: T013 (visibility filter implementation)
  - **Parallel**: Can run with T024, T025, T027, T028

- [ ] **T027 [P]** Unit tests for accessible name fallback in `tests/unit/accessibleNameFallback.test.ts`
  - **File**: `codex-chrome/tests/unit/accessibleNameFallback.test.ts`
  - **Action**: Write unit tests for extractAccessibleName() (T014)
  - **Test Cases**:
    - dom-accessibility-api succeeds → returns computed name
    - dom-accessibility-api throws error → falls back to textContent
    - No textContent → falls back to aria-label
    - No aria-label → falls back to placeholder
    - All fail → returns empty string
    - Long names → trimmed to 160 characters
  - **Acceptance**: All test cases pass, error handling works
  - **Dependencies**: T014 (accessible name util implementation)
  - **Parallel**: Can run with T024, T025, T026, T028

- [ ] **T028 [P]** Unit tests for iframe handling in `tests/unit/iframeHandling.test.ts`
  - **File**: `codex-chrome/tests/unit/iframeHandling.test.ts`
  - **Action**: Write unit tests for processIframes() (T019)
  - **Test Cases**:
    - Same-origin iframe → content captured
    - Cross-origin iframe → silently skipped (SecurityError caught)
    - Depth limit → stops at maxIframeDepth
    - Multiple iframes → all same-origin iframes processed
  - **Acceptance**: All test cases pass
  - **Dependencies**: T019 (iframe handler implementation)
  - **Parallel**: Can run with T024, T025, T026, T027

### Performance & Validation

- [ ] **T029** Performance testing: Measure 90th percentile < 5 seconds
  - **File**: `tests/performance/capturePerformance.test.ts` (new file)
  - **Action**: Create performance test suite measuring capture time
  - **Test Cases**:
    - Simple page (10 controls) → < 500ms
    - Medium page (100 controls) → < 2s
    - Large page (400+ controls) → < 5s
    - Extreme page (10k+ elements, capped at 400) → < 30s (timeout)
  - **Calculate 90th percentile**: Should be < 5s
  - **Acceptance**: 90th percentile meets target
  - **Dependencies**: T020 (main capture function)
  - **Blocks**: None

- [ ] **T030** Privacy audit: Verify zero sensitive data leakage
  - **File**: `tests/privacy/privacyAudit.test.ts` (new file)
  - **Action**: Create privacy audit test suite
  - **Test Cases**:
    - Password value never exposed (includeValues=false)
    - Password value never exposed (includeValues=true, shows "•••")
    - Password length never exposed (no value_len)
    - Form values redacted by default (only value_len)
    - includeValues flag exposes values (non-password, max 200 chars)
  - **Acceptance**: 100% privacy compliance, zero leaks
  - **Dependencies**: T020 (main capture function)
  - **Blocks**: None

- [ ] **T031** Token efficiency measurement
  - **File**: `tests/performance/tokenEfficiency.test.ts` (new file)
  - **Action**: Create token efficiency measurement test
  - **Logic**:
    - Capture sample pages
    - Estimate tokens: `JSON.stringify(model).length / 4`
    - Calculate density: `(controls.length + headings.length) / tokens`
  - **Acceptance**: Density > 0.008 (baseline: 1 element per 125 tokens)
  - **Dependencies**: T020 (main capture function)
  - **Blocks**: None

### Validation & Documentation

- [ ] **T032** Execute quickstart validation (Steps 1-10)
  - **File**: Follow `specs/038-implement-captureinteractioncontent-request/quickstart.md`
  - **Action**: Execute all 10 quickstart steps end-to-end
  - **Steps**:
    1. Verify project structure
    2. Run contract tests (should now PASS)
    3. Run integration tests (should now PASS)
    4. Verify implementation complete
    5. Contract tests pass
    6. Integration tests pass
    7. Manual validation on real page
    8. Performance tests pass
    9. Privacy audit passes
    10. Token efficiency acceptable
  - **Acceptance**: All 10 steps complete successfully
  - **Dependencies**: T003-T031 (all previous tasks)
  - **Blocks**: None

- [ ] **T033** Run full test suite and verify all tests pass
  - **Command**: `pnpm test`
  - **Acceptance**:
    - 2 contract tests pass
    - 5 integration tests pass
    - 5 unit tests pass
    - Zero test failures
  - **Dependencies**: T003-T031 (all tests implemented)
  - **Blocks**: None

- [ ] **T034** Update CLAUDE.md with implementation notes
  - **File**: `CLAUDE.md` (repository root) or `.specify/templates/CLAUDE.md`
  - **Action**: Run `.specify/scripts/bash/update-agent-context.sh claude` to update agent context
  - **Content to Add**:
    - New captureInteractionContent() API
    - dom-accessibility-api dependency
    - PageModel type structure
    - Privacy rules (no password values/lengths)
    - Performance targets (30s timeout, 5s 90th percentile)
  - **Acceptance**: CLAUDE.md updated with new implementation details
  - **Dependencies**: T032 (quickstart complete)
  - **Blocks**: None

- [ ] **T035** Final validation: Success metrics check
  - **Action**: Verify all success criteria from spec.md
  - **Checklist**:
    - ✅ 95%+ interactive element accuracy (manual inspection of test results)
    - ✅ 100% privacy compliance (T030 privacy audit passed)
    - ✅ Token efficiency metric measured (T031)
    - ✅ 20+ interactive element types supported (T015 role detection)
    - ✅ Graceful degradation on malformed HTML (T020 error handling)
    - ✅ 90%+ actionability accuracy (T033 all tests pass, selectors work)
  - **Acceptance**: All 6 success criteria met
  - **Dependencies**: T032-T034 (all validation complete)
  - **Blocks**: None

---

## Dependencies

### Setup Phase
- T001, T002 → Foundation for all other tasks

### Test Phase (TDD)
- T003-T009 → Must complete before implementation (T010-T023)
- T003 ⊥ T004 (parallel, different files)
- T005 ⊥ T006 ⊥ T007 ⊥ T008 ⊥ T009 (parallel, different files, mock HTML)

### Core Implementation
- T010 → Blocks T011, T012, T013, T014, T015, T016, T017, T018, T019 (types needed)
- T015 → Blocks T016 (role detection needed for state extraction)
- T016 → Blocks T018 (state extraction needed for region detection)
- T017, T018, T019 → Block T020 (main capture orchestrates all utilities)
- T020 → Blocks T021, T023 (integration needs core function)
- T021 → Blocks T022 (DomService integration before wrapper)

### Integration
- T021 → Blocks T022 (sequential, same file)
- T023 can run parallel with T022 (different file)

### Polish
- T024 ⊥ T025 ⊥ T026 ⊥ T027 ⊥ T028 (parallel, different files)
- T029, T030, T031 depend on T020 (core function complete)
- T032 depends on T003-T031 (full validation)
- T033 depends on T032 (final test run)
- T034, T035 depend on T033 (documentation after tests pass)

---

## Parallel Execution Examples

### Phase 3.2: Launch all contract + integration tests together
```bash
# T003-T009 (7 tests, all independent)
pnpm test tests/contract/pageModel.contract.test.ts &
pnpm test tests/contract/captureRequest.contract.test.ts &
pnpm test tests/integration/loginPage.integration.test.ts &
pnpm test tests/integration/ecommerce.integration.test.ts &
pnpm test tests/integration/privacyRedaction.integration.test.ts &
pnpm test tests/integration/dynamicContent.integration.test.ts &
pnpm test tests/integration/nestedRegions.integration.test.ts &
wait
```

### Phase 3.3: Launch utility implementations in parallel
```bash
# T011-T014 (4 utilities, all independent after T010 types)
# Implement htmlSanitizer.ts, selectorGenerator.ts, visibilityFilter.ts, accessibleNameUtil.ts in parallel
```

### Phase 3.5: Launch all unit tests together
```bash
# T024-T028 (5 unit tests, all independent)
pnpm test tests/unit/htmlSanitizer.test.ts &
pnpm test tests/unit/selectorGenerator.test.ts &
pnpm test tests/unit/visibilityFilter.test.ts &
pnpm test tests/unit/accessibleNameFallback.test.ts &
pnpm test tests/unit/iframeHandling.test.ts &
wait
```

---

## Notes

- **[P] tasks** = Different files, no dependencies, can run in parallel
- **Sequential tasks** = Same file or strong dependencies, must run in order
- **TDD critical**: T003-T009 MUST fail before T010-T023 implementation begins
- **Commit strategy**: Commit after each task (or logical group of [P] tasks)
- **Error handling**: All functions should handle errors gracefully (try/catch, fallbacks)
- **Privacy first**: Double-check T007, T016, T030 for password/value redaction

---

## Task Generation Rules Applied

1. **From Contracts**: T003 (page-model.schema.json) [P], T004 (capture-request.schema.json) [P]
2. **From Data Model**: T010 (all 6 entities in pageModel.ts)
3. **From User Stories**: T005-T009 (5 acceptance scenarios) [P]
4. **Utilities**: T011-T014 (4 independent modules) [P]
5. **Core Logic**: T015-T020 (sequential, dependencies tracked)
6. **Integration**: T021-T023 (DomService + content script)
7. **Unit Tests**: T024-T028 (5 modules) [P]
8. **Performance**: T029-T031 (3 validation tasks)
9. **Documentation**: T032-T035 (final validation)

---

## Validation Checklist

✅ **GATE: Checked before task execution**

- [x] All contracts have corresponding tests (T003-T004)
- [x] All entities have type definitions (T010)
- [x] All tests come before implementation (T003-T009 before T010-T023)
- [x] Parallel tasks truly independent (verified via file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (T021-T022 sequential, same file)

---

**Total Tasks**: 35
**Estimated Completion Time**: 2-3 days (with testing and validation)
**Critical Path**: T001 → T010 → T015 → T016 → T020 → T021 → T032 → T035

**Status**: ✅ **READY FOR EXECUTION** - All 35 tasks defined, dependencies tracked, parallel opportunities identified
