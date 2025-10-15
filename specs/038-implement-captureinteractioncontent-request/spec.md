# Feature Specification: Capture Interaction Content for Browser AI Agent

**Feature Branch**: `038-implement-captureinteractioncontent-request`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "implement captureInteractionContent(request) in codex-chrome/src/tools/DOMTool.ts which will return the given tab web page's interaction information.

Context:
codex-chrome/ is a in browser extension AI agent app, it help execute user's tasks in web page by simulating human's operation in browser.

currently we have codex-chrome/src/tools/dom/service.ts and captureDOM() method that help to build a serialized content based on the dom and serialization logic. However, the serialization logic currently is not working correctly. We want to have an alternative method captureInteractionContent() to convert the given target tab web page's source html code into a page model that captures just what a human needs:
Structure: headings and landmarks (main/nav/aside/dialog).
Interactive controls: for each actionable element, include:
role (button, link, textbox, checkbox, radio, combobox, menuitem…)
name (computed accessible name)
key states (disabled, checked, expanded, required)
a stable id (for the LLM to reference)
your selector (kept out of the LLM token path, but sent in a small map)
Context text: the main article/section text (reader-view style) in plain text.
Actionability hints: visible? in viewport? bounding box.
Privacy: never include raw field values; use value_len"

## Execution Flow (main)
```
1. Parse user description from Input
   → Extracted: Need for compact page model extraction for LLM consumption
2. Extract key concepts from description
   → Actors: AI agent, LLM, web page users
   → Actions: capture, serialize, filter, extract
   → Data: DOM structure, accessibility info, interaction controls, visual state
   → Constraints: privacy (no field values), token efficiency, human-like perception
3. For each unclear aspect:
   → Performance targets marked below
   → Error recovery behavior marked below
4. Fill User Scenarios & Testing section
   → Primary scenario: AI agent needs to understand page for task execution
5. Generate Functional Requirements
   → All requirements testable via page model validation
6. Identify Key Entities
   → Page model, controls, states, selectors
7. Run Review Checklist
   → Privacy compliance verified
   → Token efficiency addressed
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-14

- Q: How should iframe content be handled in the page model? → A: Include same-origin iframes only (1 level deep), with extensible design for future multi-level support
- Q: What is the acceptable timeout for page model generation? → A: 30 seconds - very patient, suitable for extremely large pages
- Q: What is the target token budget for the resulting page model? → A: No strict limit - rely on element caps, but prioritize maximum interactive information density with minimal token consumption
- Q: Should captureInteractionContent() replace the existing captureDOM() method or run alongside it? → A: New primary method with captureDOM() kept as wrapper for backward compatibility (captureDOM() currently broken, planned for future fixes)
- Q: Should the implementation use the dom-accessibility-api library for accessible name computation? → A: Yes - use dom-accessibility-api library (standards-compliant, well-tested, Chrome APIs don't offer better alternative)

---

## User Scenarios & Testing

### Primary User Story
An AI agent operating within a browser extension needs to understand the current state of a web page to execute user tasks. The agent must receive a compact, token-efficient representation of the page that focuses on:
- Page structure (headings, landmarks) for orientation
- Interactive elements (buttons, links, inputs) with their current states
- Visual actionability (what's visible and clickable)
- Sufficient context to make intelligent decisions about which elements to interact with

The representation must be privacy-preserving (no actual form values exposed) and optimized for LLM token consumption, similar to how a human would describe a page's interactive elements to another person.

### Acceptance Scenarios

1. **Given** a login page with email/password fields and a "Sign In" button, **When** the agent requests page interaction content, **Then** the system returns a compact model containing:
   - Heading "Login" or similar orientation marker
   - Two textbox controls with accessible names "Email" and "Password"
   - Each textbox showing states (required: true, value_len: number, placeholder text)
   - One button control with name "Sign In"
   - Stable IDs for each control (e.g., "te_1", "te_2", "bu_3")
   - Selector map kept separate from LLM-facing content

2. **Given** a complex e-commerce page with 200+ elements, **When** the agent requests page interaction content, **Then** the system returns:
   - Only visible, actionable elements (filters hidden/off-screen items)
   - Primary landmarks (main content, navigation, search)
   - Top-level headings for page structure
   - Interactive controls capped at reasonable limit (e.g., 400 most relevant)
   - Bounding box information to indicate viewport position
   - Total token count suitable for LLM context window

3. **Given** a form with sensitive information (password field with value "secret123"), **When** the agent requests page interaction content, **Then** the system returns:
   - Textbox control for password field
   - State showing value_len: 9 (character count only)
   - NO actual password value included
   - Placeholder text if present
   - Required/disabled/checked states as applicable

4. **Given** a page with dynamic content (checkboxes, expanded/collapsed sections), **When** the agent requests page interaction content, **Then** the system returns:
   - Current state of each checkbox (checked: true/false)
   - Current state of expandable sections (expanded: true/false)
   - Disabled state for any non-interactive controls
   - Visual indicators (in viewport, visible, bounding box dimensions)

5. **Given** a page with nested regions (navigation inside header, form inside main), **When** the agent requests page interaction content, **Then** the system returns:
   - Each control tagged with its containing region (region: "main", region: "navigation")
   - Clear landmark structure (regions: ["main", "navigation", "header"])
   - Hierarchical context preserved for decision-making

### Edge Cases

- **What happens when a page has no interactive elements?**
  System should return minimal model with headings and regions only, controls array empty.

- **What happens when page has iframes with interactive content?**
  System should include same-origin iframe content at 1 level deep only; cross-origin iframes are excluded due to security restrictions; design must support configurable depth for future enhancement.

- **What happens when computed accessible name is empty or ambiguous?**
  System should fall back to element text content, aria-label, or placeholder; include empty string if no name available.

- **What happens when multiple elements have identical selectors?**
  System should generate unique stable IDs regardless of selector quality; selector map may have collision but IDs won't.

- **What happens when page is still loading/rendering?**
  System should capture current DOM state without waiting; if page is actively rendering, capture reflects moment of invocation; 30-second timeout applies to capture operation itself, not page load completion.

- **How does system handle very large pages (thousands of elements)?**
  System should enforce maxControls cap (default 400) and maxHeadings cap (default 30) as specified.

- **What happens when element has multiple ARIA roles or conflicting states?**
  System should use explicit role attribute first, then implicit HTML semantics; prioritize ARIA states over HTML attributes.

## Requirements

### Functional Requirements

- **FR-001**: System MUST extract page structure including headings (h1, h2, h3) and landmark regions (main, nav, header, footer, aside, dialog)
- **FR-002**: System MUST identify all interactive elements: links, buttons, text inputs, checkboxes, radio buttons, comboboxes, select elements, textareas, and elements with explicit ARIA roles
- **FR-003**: System MUST compute accessible name for each interactive element using WCAG-compliant accessibility name calculation (via dom-accessibility-api library)
- **FR-004**: System MUST capture key interaction states: disabled, checked (checkboxes/radios), expanded (accordions/menus), required (form fields), placeholder text
- **FR-005**: System MUST assign stable, unique identifiers to each interactive element for LLM reference
- **FR-006**: System MUST generate CSS selectors for each element for deterministic action execution
- **FR-007**: System MUST separate selector information from LLM-facing content (separate "aimap" structure)
- **FR-008**: System MUST filter hidden elements using aria-hidden, hidden attribute, and computed visibility rules
- **FR-009**: System MUST filter elements with zero dimensions (width/height <= 0)
- **FR-010**: System MUST provide actionability hints: element visibility, viewport intersection, bounding box coordinates
- **FR-011**: System MUST redact actual form field values for privacy, replacing with value_len (character count)
- **FR-012**: System MUST cap total interactive elements at configurable maximum (default 400)
- **FR-013**: System MUST cap total headings at configurable maximum (default 30)
- **FR-014**: System MUST sanitize HTML by stripping scripts, styles, and comments before processing
- **FR-015**: System MUST associate each control with its containing landmark region (if any)
- **FR-016**: System MUST include page title and URL in the model
- **FR-017**: System MUST handle password fields specially (never expose values, even length)
- **FR-018**: System MUST trim and normalize whitespace in accessible names (max 160 characters)
- **FR-019**: System MUST deduplicate landmark regions in the returned list
- **FR-020**: System MUST process element attributes: id, data-testid, data-test, data-qa, data-cy for selector generation
- **FR-021**: System MUST handle link href attributes, converting to relative paths when possible
- **FR-022**: System MUST support configurable options: baseUrl, maxControls, maxHeadings, includeValues, maxIframeDepth
- **FR-031**: System MUST include same-origin iframe content at 1 level deep by default
- **FR-032**: System MUST exclude cross-origin iframe content (security restriction)
- **FR-033**: System MUST provide configurable maxIframeDepth parameter for future extensibility
- **FR-023**: System MUST return structured model containing: title, url, headings array, regions array, controls array, aimap object
- **FR-024**: System MUST handle missing or malformed HTML gracefully
- **FR-025**: System MUST process both live DOM and static HTML string inputs
- **FR-026**: Users MUST be able to request page interaction content via a defined request format
- **FR-027**: System MUST handle elements without role by inferring from HTML tag semantics
- **FR-028**: System MUST filter file input and hidden input types from interactive elements
- **FR-029**: System MUST compute visibility using display, visibility, and opacity CSS properties
- **FR-030**: System MUST prioritize explicit ID attributes, then test IDs, then generated paths for selectors

### Performance Requirements

- **PFR-001**: Page model generation MUST complete within 30 seconds (timeout for extremely large/complex pages)
- **PFR-002**: System MUST optimize for maximum interactive information density per token (no strict token budget, rely on element caps)
- **PFR-003**: System MUST handle pages with [NEEDS CLARIFICATION: maximum page size not specified - 5MB? 10MB? 50MB HTML?]
- **PFR-004**: System SHOULD complete typical page captures in under 5 seconds (90th percentile target)
- **PFR-005**: System MUST minimize redundant or verbose content in the page model output
- **PFR-006**: System MUST prioritize actionable elements over decorative/structural-only elements when approaching element caps

### Security & Privacy Requirements

- **SR-001**: System MUST NOT include actual values of password fields
- **SR-002**: System MUST NOT include actual values of text/textarea inputs by default (unless includeValues option explicitly enabled)
- **SR-003**: System MUST redact password values even when includeValues is enabled (show "•••")
- **SR-004**: System MUST limit includeValues to 200 characters maximum per field
- **SR-005**: System MUST sanitize HTML to remove inline event handlers (onclick, onerror, etc.)

### Integration Requirements

- **IR-001**: System MUST integrate with existing DomService in codex-chrome/src/tools/dom/service.ts
- **IR-002**: System MUST work within Chrome extension content script execution context
- **IR-003**: System MUST support message passing between service worker and content script
- **IR-004**: System MUST implement captureInteractionContent() as the primary capture method
- **IR-005**: System MUST maintain captureDOM() as a wrapper method for backward compatibility
- **IR-006**: System MUST NOT break existing consumers of captureDOM() during transition period
- **IR-007**: captureDOM() implementation can be fixed/enhanced independently in future iterations
- **IR-008**: System MUST use dom-accessibility-api library for accessible name computation
- **IR-009**: System MUST follow WCAG accessible name calculation standards via dom-accessibility-api

### Key Entities

- **PageModel**: Represents the complete interaction model of a web page
  - Contains: title, url, headings, regions, controls, aimap
  - Purpose: Provide LLM-optimized view of page for agent reasoning

- **InteractiveControl**: Represents a single actionable element
  - Attributes: stable ID, role, accessible name, states, selector, containing region
  - States: disabled (boolean), checked (boolean/string), expanded (boolean), required (boolean), placeholder (string), value_len (number), href (string for links)
  - Purpose: Enable LLM to reference specific elements for action planning

- **SelectorMap (aimap)**: Mapping from stable IDs to CSS selectors
  - Kept separate from LLM-facing content to save tokens
  - Used by execution layer to locate elements after LLM decides on actions
  - Format: { "bu_3": "form > button.primary", "te_1": "#email" }

- **Landmark Region**: Semantic page sections
  - Types: main, navigation, header, footer, aside, dialog, search
  - Purpose: Provide structural context and spatial relationships

- **ActionabilityInfo**: Visual and interaction metadata
  - Properties: visible (boolean), inViewport (boolean), boundingBox (dimensions)
  - Purpose: Help LLM determine which elements are currently actionable

- **CaptureRequest**: Input parameters for page capture
  - Options: baseUrl, maxControls, maxHeadings, includeValues, maxIframeDepth
  - Source: tab ID or HTML string
  - Purpose: Configure capture behavior per invocation
  - Default maxIframeDepth: 1 (same-origin iframes only, 1 level deep)

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No critical [NEEDS CLARIFICATION] markers remain (5 of 6 resolved, 1 deferred as low-impact)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (token efficiency, privacy, accuracy)
- [x] Scope is clearly bounded (page interaction model only, not full DOM serialization)
- [x] Dependencies and assumptions identified (dom-accessibility-api library confirmed)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted (compact model, privacy, token efficiency, accessibility)
- [x] Ambiguities marked and resolved (5 of 6 clarified in Session 2025-10-14)
- [x] User scenarios defined (5 acceptance scenarios, 7 edge cases)
- [x] Requirements generated (33 functional, 6 performance, 5 security, 9 integration)
- [x] Entities identified (6 key entities with relationships)
- [x] Review checklist passed (all critical items resolved)

---

## Areas Requiring Clarification

All critical clarifications have been resolved in Session 2025-10-14. Remaining open question:

1. **Maximum Page Size**: What is the maximum HTML size the system should handle? Should there be size-based rejection?
   - **Impact**: Low - Element caps (400 controls, 30 headings) and 30-second timeout provide effective size management
   - **Recommendation**: Defer to implementation phase; graceful degradation via caps is sufficient

---

## Success Metrics

- **Accuracy**: 95%+ of interactive elements correctly identified with proper roles and names
- **Privacy Compliance**: 100% of sensitive field values redacted (zero actual passwords/form values in output)
- **Token Efficiency**: Maximum interactive information density per token - measured by (actionable elements captured) / (total tokens consumed)
- **Coverage**: Support for 20+ interactive element types (button, link, textbox, checkbox, radio, combobox, menuitem, etc.)
- **Reliability**: Graceful degradation on malformed HTML (no crashes, always return valid model)
- **Actionability Accuracy**: 90%+ of returned elements successfully actionable by execution layer using provided selectors
