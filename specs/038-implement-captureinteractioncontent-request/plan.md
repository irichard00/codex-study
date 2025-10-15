# Implementation Plan: Capture Interaction Content for Browser AI Agent

**Branch**: `038-implement-captureinteractioncontent-request` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/038-implement-captureinteractioncontent-request/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ Context filled, 1 low-impact clarification deferred
3. Fill the Constitution Check section
   → ✅ Constitution template placeholder (no specific principles defined)
4. Evaluate Constitution Check section
   → ✅ No violations (template constitution)
5. Execute Phase 0 → research.md
   → In progress
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Pending Phase 0
7. Re-evaluate Constitution Check
   → Pending Phase 1
8. Plan Phase 2 → Describe task generation approach
   → Pending Phase 1
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement a compact, LLM-optimized page interaction model for Chrome extension AI agent. The system captures interactive web page elements (buttons, links, inputs) with their states, accessibility names, and actionability hints while maximizing information density per token and ensuring privacy compliance. This replaces the broken captureDOM() serialization logic with a new captureInteractionContent() method that provides the minimal, human-like representation the LLM needs to reason about page interactions.

**Technical Approach**: Build HTML-to-interaction-model pipeline using DOMParser for static HTML or live DOM access, dom-accessibility-api for WCAG-compliant accessible names, visibility/bounding-box computation for actionability filtering, and structured JSON output with separate selector map for token efficiency.

## Technical Context
**Language/Version**: TypeScript 5.x (Chrome extension environment)
**Primary Dependencies**: dom-accessibility-api (accessible name computation), Chrome extension APIs (tabs, webNavigation, scripting)
**Storage**: N/A (stateless capture, output consumed immediately by LLM)
**Testing**: Vitest (unit + integration tests), contract tests for page model schema
**Target Platform**: Chrome extension Manifest V3 (service worker + content script context)
**Project Type**: Browser extension (Chrome-specific, content script + service worker architecture)
**Performance Goals**:
  - 30-second timeout for extremely large pages
  - 5-second target for 90th percentile (typical pages)
  - Maximum information density per token (no strict token budget)
**Constraints**:
  - 400 max interactive controls (configurable)
  - 30 max headings (configurable)
  - Privacy: no actual form field values, password length redacted
  - Same-origin iframes only (1 level deep, extensible)
  - Chrome extension security model (content script sandbox, message passing)
**Scale/Scope**:
  - Support 20+ interactive element types
  - Handle pages with thousands of DOM elements (filtering to top 400)
  - Integration with existing DomService (~850 lines)
  - Backward compatibility wrapper for captureDOM()

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS

**Rationale**: The project constitution template contains only placeholder principles. No specific constitutional violations detected. The implementation follows standard best practices:
- Standalone function (captureInteractionContent) with clear purpose
- Standards-compliant (WCAG accessibility name calculation)
- Privacy-first design (redaction requirements)
- Performance constraints defined (timeouts, element caps)
- Testable requirements (95% accuracy, 100% privacy compliance)

**Note**: If a concrete constitution exists with specific principles (e.g., library-first, test-first), it should be evaluated during Phase 1 design.

## Project Structure

### Documentation (this feature)
```
specs/038-implement-captureinteractioncontent-request/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── page-model.schema.json
│   └── capture-request.schema.json
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── tools/
│   │   └── dom/
│   │       ├── service.ts                    # Existing DomService (~850 lines)
│   │       ├── interactionCapture.ts         # NEW: captureInteractionContent() implementation
│   │       ├── pageModel.ts                  # NEW: PageModel, InteractiveControl types
│   │       ├── htmlSanitizer.ts              # NEW: HTML sanitization utilities
│   │       ├── selectorGenerator.ts          # NEW: Stable selector generation
│   │       ├── visibilityFilter.ts           # NEW: Visibility + actionability filtering
│   │       ├── views.ts                      # Existing type definitions (extended)
│   │       └── serializer/
│   │           └── serializer.ts             # Existing (broken, not modified)
│   └── content/
│       └── domCapture.ts                     # Content script DOM access
├── tests/
│   ├── contract/
│   │   ├── pageModel.contract.test.ts        # PageModel schema validation
│   │   └── captureRequest.contract.test.ts   # CaptureRequest schema validation
│   ├── integration/
│   │   ├── loginPage.integration.test.ts     # Acceptance scenario 1 (login form)
│   │   ├── ecommerce.integration.test.ts     # Acceptance scenario 2 (complex page)
│   │   ├── privacyRedaction.integration.test.ts # Acceptance scenario 3 (password redaction)
│   │   ├── dynamicContent.integration.test.ts # Acceptance scenario 4 (checkboxes, states)
│   │   └── nestedRegions.integration.test.ts  # Acceptance scenario 5 (landmarks)
│   └── unit/
│       ├── htmlSanitizer.test.ts
│       ├── selectorGenerator.test.ts
│       ├── visibilityFilter.test.ts
│       ├── accessibleNameFallback.test.ts
│       └── iframeHandling.test.ts
└── package.json                               # Add dom-accessibility-api dependency
```

**Structure Decision**: Browser extension architecture with service worker + content script. Implementation goes in `codex-chrome/src/tools/dom/` alongside existing DomService. New files added for modular functionality (page model types, HTML sanitization, selector generation, visibility filtering). Content script integration for live DOM access. Tests follow contract/integration/unit split per constitutional TDD principles.

## Phase 0: Outline & Research
**Status**: ✅ COMPLETE

### Research Tasks Completed

All technical decisions have been clarified through the /clarify session. The following research consolidates those decisions:

#### 1. dom-accessibility-api Library Integration
**Decision**: Use dom-accessibility-api library for accessible name computation
**Rationale**:
- Standards-compliant WCAG accessible name calculation algorithm
- Well-tested, maintained library (~10KB, lightweight)
- No Chrome API alternative (chrome.automation requires special permissions, overkill)
- Works in both service worker and content script contexts
**Alternatives considered**:
- Custom implementation: Too complex, WCAG algorithm has many edge cases
- Chrome automation API: Requires assistive technology permissions, security risk
- Manual ARIA attribute reading: Incomplete, misses computed names from labels/content

**Integration point**: Import in `interactionCapture.ts`, call `computeAccessibleName(element)` for each interactive element.

#### 2. Iframe Content Handling Strategy
**Decision**: Include same-origin iframes only, 1 level deep (default), extensible via maxIframeDepth parameter
**Rationale**:
- Same-origin: Security model allows access, cross-origin blocked by browser
- 1 level deep: Balances completeness vs. token budget for initial release
- Extensible: maxIframeDepth parameter enables future multi-level support
**Alternatives considered**:
- Exclude all iframes: Simple but misses interactive content in common patterns (embedded forms, widgets)
- Include cross-origin: Blocked by browser security, impossible without special permissions
- Unlimited depth: Token explosion risk, diminishing returns on nested iframes

**Implementation**: Recursive iframe traversal with depth counter, check frame.origin === window.origin before descending.

#### 3. Page Model Timeout & Performance Strategy
**Decision**: 30-second timeout (max), 5-second target (90th percentile), no strict token budget
**Rationale**:
- 30 seconds: Handles pathological cases (huge SPAs, slow network, complex iframes)
- 5 seconds: User-perceivable threshold for typical pages
- No token budget: Rely on element caps (400 controls, 30 headings) for size management
- Information density optimization: Minimize redundant data, trim verbose strings
**Alternatives considered**:
- 2-second timeout: Too aggressive, fails on legitimate complex pages
- Strict token budget (50k): Arbitrary, doesn't account for varying page complexity
- Unbounded: Risk of infinite loops, resource exhaustion

**Implementation**: Promise.race() with 30-second AbortController timeout, element caps enforced during traversal.

#### 4. Migration Strategy for captureDOM()
**Decision**: captureInteractionContent() as primary method, captureDOM() as wrapper (not deprecated, planned for future fixes)
**Rationale**:
- captureDOM() currently broken (serialization logic issues)
- captureInteractionContent() provides immediate working alternative
- Wrapper approach maintains backward compatibility during transition
- Independent fix paths: captureDOM() serialization can be fixed later without blocking this feature
**Alternatives considered**:
- Replace captureDOM() entirely: Breaking change, risky migration
- Deprecate captureDOM(): Premature, still has value once fixed
- Merge into single method: Different use cases (full serialization vs. interaction-focused)

**Implementation**: captureInteractionContent() standalone, captureDOM() optionally delegates to it in interim.

#### 5. HTML Sanitization & Privacy Strategy
**Decision**: Strip scripts/styles/comments pre-processing, redact all form values by default, never expose password lengths
**Rationale**:
- Script/style removal: Reduces token noise, no semantic value for interaction model
- Value redaction: Privacy-first, prevents sensitive data leakage
- Password special case: Even length can leak info (e.g., "8-char password" hints policy)
- value_len for non-passwords: Useful signal for LLM (empty vs. filled fields) without exposing data
**Alternatives considered**:
- Include form values optionally: Implemented as includeValues flag for debugging, 200-char limit, passwords always redacted
- Hash values: Unnecessary complexity, value_len provides same signal
- Include password length: Privacy risk, rejected

**Implementation**: Regex-based script/style stripping, DOMParser parse, field value inspection with type-based redaction logic.

#### 6. Visibility & Actionability Filtering
**Decision**: Filter via computed styles (display, visibility, opacity), bounding box (width/height > 0), optional viewport intersection
**Rationale**:
- Computed styles: Catches CSS-hidden elements (display:none, visibility:hidden, opacity:0)
- Bounding box: Filters zero-size elements (common for off-screen/collapsed)
- Viewport check: Optional optimization, some use cases need off-screen elements (scrolling plans)
**Alternatives considered**:
- Strict viewport-only: Too aggressive, misses valid scroll targets
- No filtering: Token waste on hidden elements
- IntersectionObserver: Async, complicates capture, overkill for one-shot snapshot

**Implementation**: getComputedStyle() checks, getBoundingClientRect() for dimensions, optional viewport rect comparison.

#### 7. Selector Generation Strategy
**Decision**: Prioritize ID > test IDs (data-testid, data-test, data-qa, data-cy) > short robust path (tag + classes, 4 levels max)
**Rationale**:
- ID: Unique, stable, fast querySelector()
- Test IDs: Developer-assigned stability markers
- Short path: Limits selector fragility vs. full XPath, balances specificity vs. brittleness
- 4-level limit: Prevents overly long selectors, provides reasonable uniqueness
**Alternatives considered**:
- Full XPath: Brittle, breaks on DOM changes
- Tag only: Collisions, non-unique
- nth-child: Very brittle, subtle DOM changes break selectors

**Implementation**: Iterative parent traversal (max 4 levels), collect tag + classes (first 2), join with `>` combinator.

**Output**: All NEEDS CLARIFICATION resolved, technical approach validated, integration points identified.

## Phase 1: Design & Contracts
**Status**: ✅ COMPLETE

### 1. Data Model (data-model.md created)

See `data-model.md` for complete entity definitions.

**Key Entities**:
- **PageModel**: Root output structure (title, url, headings, regions, controls, aimap)
- **InteractiveControl**: Actionable element (id, role, name, states, selector, region, boundingBox, visible, inViewport)
- **CaptureRequest**: Input parameters (baseUrl, maxControls, maxHeadings, includeValues, maxIframeDepth)
- **SelectorMap (aimap)**: ID-to-selector mapping (Record<string, string>)

**Validation Rules**:
- maxControls: >= 1, default 400
- maxHeadings: >= 1, default 30
- maxIframeDepth: >= 0, default 1
- Accessible names: trimmed, max 160 characters
- Selectors: valid CSS selector syntax
- IDs: unique per capture, format `{role[0:2]}_{counter}`

**State Transitions**: N/A (stateless capture, no entity lifecycle)

### 2. API Contracts (contracts/ created)

Generated JSON schema contracts:
- `contracts/page-model.schema.json`: Output PageModel structure
- `contracts/capture-request.schema.json`: Input CaptureRequest parameters
- `contracts/interactive-control.schema.json`: InteractiveControl entity schema

### 3. Contract Tests (generated, failing)

Created contract test files in `tests/contract/`:
- `pageModel.contract.test.ts`: Validates PageModel schema compliance
- `captureRequest.contract.test.ts`: Validates CaptureRequest schema compliance

**Status**: ✅ Tests generated and currently failing (no implementation yet)

### 4. Integration Tests (generated from user stories)

Created integration test files in `tests/integration/`:
- `loginPage.integration.test.ts`: Acceptance scenario 1 (login form with email/password/button)
- `ecommerce.integration.test.ts`: Acceptance scenario 2 (complex page with 200+ elements, filtering)
- `privacyRedaction.integration.test.ts`: Acceptance scenario 3 (password field redaction)
- `dynamicContent.integration.test.ts`: Acceptance scenario 4 (checkbox states, expanded/collapsed)
- `nestedRegions.integration.test.ts`: Acceptance scenario 5 (navigation inside header, region tagging)

**Status**: ✅ Tests generated and currently failing (no implementation yet)

### 5. Quickstart (quickstart.md created)

See `quickstart.md` for step-by-step validation guide.

**Quickstart Flow**:
1. Install dependencies (`npm install dom-accessibility-api`)
2. Run contract tests (should fail initially)
3. Run integration tests (should fail initially)
4. Implement captureInteractionContent()
5. Run tests again (should pass)
6. Manual validation: Capture test page, inspect output PageModel
7. Performance test: Measure 90th percentile < 5 seconds

### 6. Agent Context Update

Agent-specific file updated: `.specify/templates/CLAUDE.md` (or `CLAUDE.md` in repo root if exists)

**Status**: Will be updated via script after artifacts are generated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Load base template**: `.specify/templates/tasks-template.md`
2. **Generate from Phase 1 artifacts**:
   - Each contract schema → contract test task [P]
   - Each entity in data-model.md → type definition task [P]
   - Each user story in quickstart.md → integration test task
   - Each functional requirement → implementation task
3. **Dependency-ordered tasks**:
   - Types first (pageModel.ts)
   - Utilities next (htmlSanitizer, selectorGenerator, visibilityFilter) [P]
   - Core logic (interactionCapture.ts)
   - Integration (DomService.captureInteractionContent())
   - Wrapper (captureDOM() backward compatibility)
4. **Test-first ordering**:
   - Contract tests before type definitions
   - Integration tests before core implementation
   - Unit tests before utility implementations

**Ordering Strategy**:
- **TDD order**: Tests written → approved → fail → implement
- **Dependency order**: Types → Utils → Core → Integration
- **Parallel markers [P]**: Independent files (utilities, tests) marked for concurrent execution

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**Task Categories**:
- Setup (1-2 tasks): Dependencies, project structure
- Contract tests (2-3 tasks): Schema validation tests
- Type definitions (2-3 tasks): PageModel, InteractiveControl, CaptureRequest
- Utilities (5-7 tasks): HTML sanitization, selector generation, visibility filtering, accessible name fallback
- Core implementation (8-10 tasks): captureInteractionContent() main logic, iframe handling, element processing
- Integration tests (5 tasks): One per acceptance scenario
- Service integration (2-3 tasks): DomService method, captureDOM() wrapper
- Unit tests (5-8 tasks): Coverage for utilities and edge cases
- Validation (2-3 tasks): Quickstart execution, performance measurement

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation, privacy audit)

**Success Criteria** (from spec.md):
- ✅ 95%+ interactive element accuracy (correct roles/names)
- ✅ 100% privacy compliance (zero password/form values in output)
- ✅ Token efficiency metric: (actionable elements captured) / (total tokens consumed)
- ✅ 20+ interactive element types supported
- ✅ Graceful degradation on malformed HTML
- ✅ 90%+ actionability accuracy (selectors work for execution layer)

## Complexity Tracking
*No constitutional violations - table left empty*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | N/A | N/A |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (1 deferred as low-impact)
- [x] Complexity deviations documented (none)

---
*Based on Constitution template - See `.specify/memory/constitution.md`*
