# Feature Specification: Fix DOMTool Content Script Communication

**Feature Branch**: `017-fix-domtool-content-script-communication`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "inspect the DomTool usage in codex-chrome/, currently llm return error: user: open wsj and summarize for the headline. codex-chrome: I opened The Wall Street Journal in a new tab, but I can't read the page content to pull the top headline because the extension couldn't inject its content script on wsj.com (host-permission restriction). However, we've already granted all the permission to the extension app in manifest file, it might caused by llm cannot correctly use the dom tool, help me inspect the dom tool and fix potential bug"

## Execution Flow (main)
```
1. Parse user description from Input
   → Identify: DOMTool message communication mismatch
2. Extract key concepts from description
   → Actors: DOMTool (background), content-script (page context), LLM agent
   → Actions: DOM operations, content script injection, message passing
   → Issue: Content script expects different message format than DOMTool sends
3. Diagnose root cause
   → DOMTool sends 'DOM_ACTION' messages at line 872-877
   → Content script handles 'TOOL_EXECUTE' messages at line 71-74
   → Message format mismatch causes tool execution failure
4. Define solution requirements
   → Align message types between DOMTool and content script
   → Ensure content script correctly handles all 25 DOM operations
   → Verify proper error handling and response format
5. Generate acceptance criteria
   → All DOM operations work correctly across different websites
   → Content script properly responds to DOMTool requests
   → Error messages are clear and actionable
6. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As an LLM agent controlling a browser through the codex-chrome extension, I need to read and interact with web page content on any website (including wsj.com) so that I can complete user-requested tasks like summarizing headlines, extracting information, and automating workflows without encountering "permission restriction" errors when permissions are already granted.

### Acceptance Scenarios
1. **Given** a user asks the agent to "open wsj.com and summarize the headline", **When** the agent opens the page and attempts to read the DOM, **Then** the system successfully extracts the headline text without permission errors
2. **Given** the DOMTool sends a DOM operation request to a content script, **When** the content script receives the message, **Then** it correctly interprets and executes the requested operation
3. **Given** permissions are granted in manifest.json for all URLs, **When** the agent attempts to interact with any website, **Then** the content script injection succeeds and DOM operations work
4. **Given** the agent performs a 'query' operation to find elements, **When** the content script processes the request, **Then** it returns the correct element information in the expected format
5. **Given** a DOM operation fails (e.g., element not found), **When** the error is returned to the agent, **Then** the LLM receives a clear, actionable error message explaining what went wrong
6. **Given** the agent uses any of the 25 supported DOM operations, **When** the request reaches the content script, **Then** each operation executes correctly with proper parameter mapping
7. **Given** multiple DOM operations are requested in sequence, **When** the content script processes them, **Then** all operations complete successfully and return consistent response formats

### Edge Cases
- What happens when the content script hasn't fully initialized before a DOM operation is requested?
- How does the system handle websites with strict Content Security Policies?
- What occurs if the message format changes between DOMTool and content script?
- How does the system respond when a DOM operation times out?
- What happens if the content script is repeatedly injected (e.g., page navigation)?
- How are errors differentiated between "permission denied" vs "content script communication failure"?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST correctly route DOM operation requests from DOMTool to content script using consistent message types
- **FR-002**: Content script MUST handle all 25 DOM operations defined in DOMTool (query, click, type, getAttribute, setAttribute, getText, getHtml, submit, focus, scroll, findByXPath, hover, getProperty, setProperty, extractLinks, fillForm, submitForm, captureSnapshot, getAccessibilityTree, getPaintOrder, detectClickable, waitForElement, checkVisibility, executeSequence)
- **FR-003**: System MUST provide clear error messages distinguishing between permission issues, content script injection failures, and operation execution errors
- **FR-004**: Content script MUST respond to DOMTool requests with consistent data structure matching expected response format
- **FR-005**: System MUST verify content script is loaded before sending DOM operations
- **FR-006**: Content script MUST handle DOM operation requests even when injected via programmatic injection (not just manifest-declared)
- **FR-007**: System MUST properly map operation parameters from DOMTool request format to content script execution format
- **FR-008**: Content script MUST return operation results within the configured timeout period
- **FR-009**: System MUST handle content script injection on all websites where host permissions are granted
- **FR-010**: Error responses MUST include operation name, error type, and actionable guidance for resolution
- **FR-011**: System MUST maintain consistent request ID tracking between DOMTool and content script responses
- **FR-012**: Content script MUST support both MessageRouter-based communication and direct chrome.runtime.sendMessage communication patterns
- **FR-013**: System MUST handle race conditions when content script is being injected while operations are pending
- **FR-014**: DOMTool MUST correctly interpret "script injection failed" errors separately from "element not found" errors
- **FR-015**: Content script MUST expose a health check mechanism (PING/PONG) for DOMTool to verify availability
- **FR-016**: System MUST properly serialize and deserialize DOM element data including attributes, bounds, and visibility state
- **FR-017**: Content script MUST handle cross-origin iframe restrictions gracefully with clear error messages
- **FR-018**: System MUST support retry logic for transient communication failures
- **FR-019**: Content script MUST clean up resources and event listeners when page unloads
- **FR-020**: System MUST log detailed diagnostic information for debugging communication failures

### Key Entities *(include if feature involves data)*
- **DOM Operation Request**: Message sent from DOMTool to content script containing action type, selector/parameters, options, and request ID
- **DOM Operation Response**: Message returned from content script to DOMTool containing success status, result data, and error information if applicable
- **Content Script State**: Information about whether content script is loaded, initialized, and ready to receive operations
- **Message Route**: Communication channel between background script (DOMTool) and page context (content script)
- **Operation Error**: Structured error information including error code, message, affected operation, and context details
- **Element Data**: Information extracted from DOM including tag name, attributes, text content, bounding box, and visibility
- **Request Context**: Metadata about the operation including tab ID, frame ID, timeout, and retry count

---

## Dependencies & Assumptions *(optional)*

### Dependencies
- Chrome Extension Manifest V3 permissions system (activeTab, scripting, tabs)
- Chrome runtime messaging API (chrome.tabs.sendMessage, chrome.runtime.onMessage)
- Content script injection capability (chrome.scripting.executeScript)
- MessageRouter implementation in codex-chrome for message coordination

### Assumptions
- Manifest.json already contains correct host_permissions: ["<all_urls>"]
- Content script file exists at correct path (/content/content-script.js or /content.js)
- DOMTool and content script run in different execution contexts (background vs page)
- Chrome extension APIs are available and functional
- Websites do not block extension content script injection through CSP or other mechanisms [NEEDS CLARIFICATION: how to handle CSP-blocked sites?]

---

## Success Metrics *(optional)*

- 100% of 25 DOM operations execute successfully when content script is properly loaded
- Zero "host-permission restriction" errors when manifest permissions are correctly configured
- Content script communication success rate > 99% for supported operations
- Error message clarity score: all errors include actionable next steps
- Time to diagnose communication failures reduced from unknown to < 1 minute via diagnostic logs

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Root cause diagnosed
- [x] Solution requirements defined
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Dependencies documented
- [ ] Clarifications resolved
- [ ] Review checklist passed

---

## Diagnosed Root Cause

### Issue Analysis
The LLM agent reports "host-permission restriction" errors when attempting to read page content, despite manifest.json correctly granting host_permissions: ["<all_urls>"]. Investigation reveals:

1. **Message Type Mismatch**:
   - DOMTool.ts sends messages with type: 'DOM_ACTION' (line 872-877)
   - content-script.ts expects messages with MessageType.TOOL_EXECUTE (line 71-74)
   - This mismatch causes content script to ignore DOM operation requests

2. **Operation Mapping Gap**:
   - DOMTool defines 25 operations but content script only implements a subset
   - executeDOMTool() in content script doesn't map all operation names correctly
   - Missing operations fail silently or return unclear errors

3. **Error Message Confusion**:
   - Actual error: "No response from content script" (communication failure)
   - LLM interprets as: "host-permission restriction" (permission issue)
   - Error handling doesn't distinguish between these failure modes

4. **Content Script Injection Verification**:
   - DOMTool attempts to verify content script via PING/PONG at line 923-927
   - If verification fails, injection occurs at line 932-937
   - Race condition possible: operation sent before content script fully initializes

### User Impact
Users experience inability to perform basic DOM operations on websites even when all permissions are granted, leading to:
- Failed task execution ("can't read page content")
- Confusing error messages that suggest permission problems instead of code issues
- Loss of trust in the agent's capabilities
- Manual workarounds required (copy-paste content, use alternative sources)

---
