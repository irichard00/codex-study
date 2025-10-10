# Feature Specification: DOMTool Content Script Injection Error Investigation

**Feature Branch**: `018-inspect-the-domtool`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "Inspect the DomTool usage in codex-chrome/, currently llm return error: user: open wsj and summarize for the headline codex-chrome: I opened The Wall Street Journal in a new tab, but I can't read the page content to pull the top headline because the extension couldn't inject its content script on wsj.com (host-permission restriction). As a result, I can't extract or summarize the headline directly from the page. The dom tool function call return following error: \"success\":false,\"error\":\"Error: Failed to inject content script: Failed to inject content script: Error: Could not load file: 'content/content-script.js'.\",\"metadata\":{\"duration\":13,\"toolName\":\"browser_dom\",\"errorType\":\"Error\" It might caused by llm cannot correctly use the dom tool, help me inspect the dom tool and related llm client code using the dom tool and fix potential bug More context: 1. currently codex-chrome/ is converted from codex-rs/, turning the terminal based coding agent into chrome extension based web agent that operate the webs, we provide domTool codex-chrome/src/tools/DOMTool.ts to interact with page, currently seems llm is not working smoothly with the the tool. 2. We are using gpt-5 to as llm to drive the agent, codex-chrome/src/models/OpenAIResponsesClient.ts is the client code talk with llm"

## Execution Flow (main)
```
1. Parse user description from Input
   → Error: "Could not load file: 'content/content-script.js'"
   → Error context: DOMTool execution, content script injection failure
2. Extract key concepts from description
   → Actors: Chrome Extension, LLM (GPT-5), DOMTool, Content Script
   → Actions: Content script injection, DOM manipulation, tool definition parsing
   → Data: Tool definitions sent to LLM, tool call responses from LLM
   → Constraints: Chrome Extension Manifest V3, Content Security Policy, file paths
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Should we verify Chrome extension manifest permissions?]
   → [NEEDS CLARIFICATION: Should we check build output structure?]
   → [NEEDS CLARIFICATION: Is the issue with tool definition format or execution?]
4. Fill User Scenarios & Testing section
   → User flow: User requests DOM operation → LLM calls tool → Extension executes
5. Generate Functional Requirements
   → Each requirement must be testable
6. Identify Key Entities (if data involved)
   → Tool definitions, LLM function calls, content script injection
7. Run Review Checklist
   → Implementation details may exist - focus on WHAT needs to be verified
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
As a user of the codex-chrome extension, when I request the agent to "open wsj and summarize the headline," the system should successfully:
1. Open the Wall Street Journal website in a new tab
2. Inject the content script into the page
3. Read the page content using the DOM tool
4. Extract the headline text
5. Provide a summary to the user

Currently, the system fails at step 2 (content script injection) with error: "Could not load file: 'content/content-script.js'."

### Acceptance Scenarios

1. **Given** the extension is installed and the user requests a DOM operation on a webpage, **When** the DOMTool attempts to inject the content script, **Then** the content script must successfully load from the correct file path without file-not-found errors

2. **Given** the LLM receives tool definitions from the extension, **When** the LLM makes a tool call to `browser_dom`, **Then** the tool call must include all required parameters in the correct format expected by DOMTool

3. **Given** the extension has proper manifest permissions for the target domain, **When** the DOMTool attempts to inject the content script into the page, **Then** the injection must succeed and the content script must respond to PING messages

4. **Given** a content script injection fails, **When** the error is returned to the user, **Then** the error message must clearly distinguish between:
   - File path errors (file not found)
   - Permission errors (host permissions)
   - Script execution errors (CSP violations)

5. **Given** the tool definition is sent to the LLM, **When** the LLM generates a tool call, **Then** the tool call structure must match the expected format (flat structure for Responses API vs nested structure for Chat Completions API)

### Edge Cases
- What happens when the content script file path is incorrect in the manifest or build output?
- How does the system handle domains that require special host permissions (e.g., chrome://, file://)?
- What occurs when the LLM generates a tool call with missing required parameters?
- How does the system respond when the content script is blocked by Content Security Policy?
- What happens when the content script takes too long to initialize (timeout scenarios)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST verify that the content script file path in chrome.scripting.executeScript matches the actual build output location
- **FR-002**: System MUST validate that the Chrome extension manifest declares the correct content script file path
- **FR-003**: System MUST confirm that tool definitions sent to the LLM match the expected format for the Responses API (flat structure, not nested under 'function' key)
- **FR-004**: System MUST verify that the DOMTool.ensureContentScriptInjected() method uses the correct file path when calling chrome.scripting.executeScript
- **FR-005**: System MUST validate that the build process outputs the content script to the location referenced in the code
- **FR-006**: System MUST check if the error "Could not load file: 'content/content-script.js'" is caused by incorrect file path vs missing file vs permission issues
- **FR-007**: System MUST distinguish between content script injection failures due to file errors vs host permission restrictions
- **FR-008**: System MUST verify that the LLM's tool call parameters include all required fields (action, selector, etc.) as defined in the tool definition
- **FR-009**: System MUST confirm that the OpenAIResponsesClient.createToolsJsonForResponsesApi() correctly transforms tool definitions from ToolSpec format to Responses API format
- **FR-010**: System MUST validate that the retry logic in DOMTool.ensureContentScriptInjected() properly handles both injection failures and PING response timeouts
- **FR-011**: System MUST ensure error messages returned to the LLM provide sufficient context for the LLM to understand what went wrong and potentially retry or adjust its approach
- **FR-012**: System MUST verify that the tool definition's parameters schema accurately describes all required and optional parameters for each DOM action

### Key Entities

- **Content Script File**: The JavaScript file (content-script.js or content-script.ts) that must be injected into web pages to enable DOM manipulation
  - Location in source: codex-chrome/src/content/content-script.ts
  - Location in build output: [NEEDS CLARIFICATION: Actual build output path - likely dist/content/ or build/content/]
  - Referenced path in code: '/content/content-script.js' (absolute path from extension root)

- **Tool Definition**: The schema sent to the LLM describing available tools and their parameters
  - Format for Responses API: Flat structure with type, name, description, parameters
  - Format for Chat Completions API: Nested structure with type: 'function', function: {...}
  - Current implementation: DOMTool.toolDefinition (created via createToolDefinition)
  - Transformation: OpenAIResponsesClient.createToolsJsonForResponsesApi()

- **Tool Call**: The LLM's invocation of a tool with specific parameters
  - Structure: { type: 'function_call', function: { name: 'browser_dom', arguments: {...} } }
  - Required parameters: action (enum of 24 actions)
  - Optional parameters: tabId, selector, text, attribute, etc.

- **Content Script Injection Process**: The multi-step process to ensure content script is loaded
  - Step 1: PING check to see if content script already loaded
  - Step 2: chrome.scripting.executeScript if PING fails
  - Step 3: Retry PING with exponential backoff (up to 5 attempts)
  - Error types: Script injection failed, timeout, file not found

- **Error Response**: The structured error returned when tool execution fails
  - success: false
  - error: Error message string
  - metadata: { duration, toolName, errorType }

---

## Review & Acceptance Checklist

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---

## Notes

This specification focuses on diagnosing the root cause of the content script injection failure. The error message "Could not load file: 'content/content-script.js'" suggests a file path mismatch between what the code references and what exists in the build output.

The investigation should verify:
1. **Build Output Structure**: Where does the TypeScript compiler/bundler actually output content-script.js?
2. **File Path References**: What path is used in chrome.scripting.executeScript() calls?
3. **Manifest Declaration**: Does manifest.json correctly reference the content script?
4. **Tool Definition Format**: Are tool definitions correctly formatted for GPT-5's Responses API?
5. **LLM Tool Call Format**: Is the LLM generating tool calls with the expected structure?

The issue is likely NOT related to:
- Host permissions (the error explicitly states "Could not load file", not "Permission denied")
- Content Security Policy (would produce different error)
- LLM understanding (error occurs during tool execution, not tool call generation)

The most probable cause is a mismatch between the hardcoded file path '/content/content-script.js' in DOMTool.ts:944 and the actual build output location.
