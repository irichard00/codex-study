# Feature Specification: Fix DOM Capture Handler and Enable Source Maps

**Feature Branch**: `035-method-handledomcapturerequest-in`
**Created**: 2025-10-12
**Status**: Draft
**Input**: User description: "method handleDOMCaptureRequest in codex-chrome/src/content/domCaptureHandler.ts is not working correctly in runtime, in line 312: console.log('dom capture completed with snapshot', snapshot); It reveals dom capture completed with snapshot {documents: Array(1), strings: Array(0)}documents: Array(1)0: baseURL: "https://secure-us.imrworldwide.com/storageframe.html"documentURL: "https://secure-us.imrworldwide.com/storageframe.html"frameId: "main"nodes: []title: "HTML5 localstorage test"[[Prototype]]: Objectlength: 1[[Prototype]]: Array(0)strings: Array(0)length: 0[[Prototype]]: Array(0)[[Prototype]]: Object which has no meaningful data, but the method execution doesn't reveal error msg. 1. debug and fix the potential issues 2. also enable the source map for the content.js in chrome, so that we can single step debug in chrome dev tool"

## Execution Flow (main)
```
1. Parse user description from Input
   → Bug report: DOM capture returns empty nodes array
   → Bug report: Source maps not enabled for debugging
2. Extract key concepts from description
   → Actors: Developer debugging DOM capture functionality
   → Actions: Capture DOM tree, enable source maps
   → Data: DOM snapshot with nodes array, strings array
   → Constraints: Must work in Chrome extension runtime
3. For each unclear aspect:
   → Implementation is clear from bug description
4. Fill User Scenarios & Testing section
   → User flow: Developer captures DOM, expects populated nodes array
5. Generate Functional Requirements
   → Each requirement must be testable
6. Identify Key Entities (if data involved)
   → DOM snapshot, captured nodes, element snapshots
7. Run Review Checklist
   → Bug fix specification, ready for implementation
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
A developer using the Codex Chrome Extension needs to capture DOM snapshots from web pages to analyze page structure and interactive elements. When the DOM capture is triggered, the system should return a complete representation of the page's DOM tree including all element nodes with their attributes, snapshots, and accessibility information. Currently, the capture returns an empty nodes array despite the page having content.

Additionally, when debugging issues in the content script, the developer needs to be able to set breakpoints and step through the TypeScript source code in Chrome DevTools, but currently only sees minified JavaScript without source maps.

### Acceptance Scenarios

1. **Given** a web page with HTML content (e.g., body, div, text nodes), **When** DOM capture is requested, **Then** the returned snapshot must contain a populated nodes array with all traversed DOM elements

2. **Given** a DOM capture request on a page with multiple elements, **When** the capture completes, **Then** each element node must include its nodeName, nodeType, attributes, snapshot data, and accessibility information

3. **Given** a DOM capture request on a page with text nodes, **When** the capture completes, **Then** text nodes must be included with their nodeValue property populated

4. **Given** a developer debugging the content script in Chrome DevTools, **When** they open the Sources panel, **Then** they must see the original TypeScript source files with correct line numbers

5. **Given** a developer setting a breakpoint in TypeScript source, **When** the code executes, **Then** the debugger must pause at the correct line in the TypeScript file

6. **Given** a DOM capture on a page with many repeated strings (attributes, class names), **When** the capture completes, **Then** the strings array must contain interned strings to reduce payload size

### Edge Cases

- What happens when the page is a cross-origin iframe (e.g., "https://secure-us.imrworldwide.com/storageframe.html")?
- How does the system handle pages with Shadow DOM enabled?
- What happens if element.getBoundingClientRect() throws an error for hidden or detached elements?
- How does the system handle very large DOM trees (10,000+ nodes)?
- What happens if the traversal encounters circular references or infinite loops?

## Requirements

### Functional Requirements

- **FR-001**: System MUST capture all DOM nodes during traversal, including element nodes and text nodes
- **FR-002**: System MUST populate the nodes array in the captured document with all traversed nodes
- **FR-003**: System MUST attach element snapshots (bounds, styles, attributes) to each element node
- **FR-004**: System MUST attach accessibility (ARIA) information to each element node
- **FR-005**: System MUST correctly map traversal indices to actual DOM elements
- **FR-006**: System MUST intern repeated strings (attribute names, values, tag names) into the strings pool
- **FR-007**: System MUST return meaningful error messages when DOM capture fails
- **FR-008**: System MUST export source maps when building the content script
- **FR-009**: System MUST ensure source maps are accessible to Chrome DevTools for debugging
- **FR-010**: System MUST maintain correct line number mappings between TypeScript source and compiled JavaScript
- **FR-011**: System MUST handle cross-origin iframes gracefully without throwing errors
- **FR-012**: System MUST handle Shadow DOM elements if includeShadowDOM option is true
- **FR-013**: System MUST preserve node relationships (parent-child indices) correctly
- **FR-014**: System MUST capture element attributes and intern them in the string pool

### Key Entities

- **CapturedDocument**: Represents a captured document with documentURL, baseURL, title, frameId, and nodes array
- **CapturedNode**: Represents a single DOM node with nodeType, nodeName, nodeValue, backendNodeId, parentIndex, childIndices, attributes, snapshot, and axNode
- **ElementSnapshot**: Contains element bounds, computed styles, and attributes
- **EnhancedAXNode**: Contains accessibility tree information (role, name, description)
- **StringPool**: Manages string interning to reduce payload size
- **TraversalResult**: Contains all traversed nodes and statistics
- **ViewportInfo**: Contains viewport dimensions and scroll position

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
