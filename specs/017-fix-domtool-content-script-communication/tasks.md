# Implementation Tasks: Fix DOMTool Content Script Communication

**Feature**: 017-fix-domtool-content-script-communication
**Branch**: `017-fix-domtool-content-script-communication`
**Date**: 2025-10-09
**Total Tasks**: 18

## Overview

Fix message communication mismatch between DOMTool (background) and content-script (page context) that causes "host-permission restriction" errors. Core issue: DOMTool sends 'DOM_ACTION' messages while content script expects 'TOOL_EXECUTE'. This fix aligns message types, completes 25 operation mappings, and improves error handling.

**Files to Modify**:
- `codex-chrome/src/tools/DOMTool.ts` (error handling, PING/PONG verification)
- `codex-chrome/src/content/content-script.ts` (message type, operation mapping)

**Critical Path**: T001 → T002 → T003 → T004 (diagnose) → T005 (fix message type) → T006 (complete operations) → T007-T010 (error handling) → T011-T015 (tests) → T016-T018 (validation)

---

## Phase 1: Diagnostic Tasks (T001-T004)

### T001: Trace Message Flow from DOMTool to Content Script

**Priority**: CRITICAL
**Estimated Time**: 30 minutes
**Dependencies**: None
**Files**:
- `codex-chrome/src/tools/DOMTool.ts` (read)
- `codex-chrome/src/content/content-script.ts` (read)

**Objective**: Document the actual message flow to confirm root cause diagnosis

**Steps**:
1. Read `DOMTool.ts` lines 869-916 (sendContentScriptMessage method)
2. Identify the message type sent: Look for `type:` field in message object
3. Read `content-script.ts` lines 56-89 (setupMessageHandlers)
4. Identify the message types content script listens for
5. Document mismatch: DOMTool sends vs content script expects
6. Create a flow diagram showing:
   - DOMTool.execute() → sendContentScriptMessage() → chrome.tabs.sendMessage
   - Message structure: `{ type: ?, action: ?, requestId: ? }`
   - Content script: router.on(?) → executeDOMTool()

**Validation**:
- [ ] Confirmed: DOMTool sends `type: 'DOM_ACTION'` at line 872
- [ ] Confirmed: Content script expects `MessageType.TOOL_EXECUTE` at line 71
- [ ] Documented: Message flow diagram in task notes
- [ ] Root cause validated: Message type mismatch causes silent failures

**Output**: Task notes with message flow diagram and confirmed line numbers

---

### T002: Audit All 25 DOM Operations and Current Mapping

**Priority**: HIGH
**Estimated Time**: 45 minutes
**Dependencies**: None
**Files**:
- `codex-chrome/src/tools/DOMTool.ts` (read lines 172-177, 329-379)
- `codex-chrome/src/content/content-script.ts` (read lines 574-610)
- `codex-chrome/src/tools/dom/chrome/contentScript.ts` (read - helper functions)

**Objective**: Create complete inventory of operations: defined vs implemented vs missing

**Steps**:
1. Extract all 25 operations from DOMTool.ts enum/switch statement (lines 329-379)
2. Extract all implemented operations from content-script.ts executeDOMTool() (lines 574-610)
3. Cross-reference with helper functions in dom/chrome/contentScript.ts
4. Create mapping table:
   ```
   | Operation | DOMTool Defined | Content Script Handler | Helper Function | Status |
   |-----------|----------------|----------------------|-----------------|---------|
   | query | ✓ | dom_query | findElements | MAPPED |
   | click | ✓ | dom_click | clickElement | MAPPED |
   | getAttribute | ✓ | ✗ | ? | MISSING |
   ```
5. Identify 18 missing operations (from research.md)
6. For each missing operation, identify if helper function exists in dom/chrome/contentScript.ts

**Validation**:
- [ ] All 25 operations listed with current status
- [ ] Missing operations count matches research finding (18 operations)
- [ ] Helper functions identified for each missing operation
- [ ] Mapping complexity assessed (simple delegation vs needs new implementation)

**Output**: Markdown table with operation audit saved in task notes

---

### T003: Document Current Error Handling Flow

**Priority**: MEDIUM
**Estimated Time**: 30 minutes
**Dependencies**: None
**Files**:
- `codex-chrome/src/tools/DOMTool.ts` (read lines 996-1041, 889-915)
- `codex-chrome/src/content/content-script.ts` (read lines 611-617)

**Objective**: Understand how errors currently propagate from content script to LLM

**Steps**:
1. Trace error path in content script:
   - executeDOMTool() catch block (line 611-617)
   - How errors are returned to DOMTool
2. Trace error handling in DOMTool:
   - sendContentScriptMessage() error handling (lines 889-915)
   - handleOperationError() method (lines 996-1041)
   - How errors reach OpenAIResponsesClient
3. Identify where "No response from content script" becomes "permission restriction"
4. Document error transformation points
5. Note: Current error classification logic (lines 1003-1020)

**Validation**:
- [ ] Error flow diagram created
- [ ] Identified: Where vague errors are generated
- [ ] Identified: Where error messages are transformed
- [ ] Confirmed: No error type classification currently exists

**Output**: Error flow diagram with transformation points documented

---

### T004: Verify PING/PONG Implementation Status [P]

**Priority**: MEDIUM
**Estimated Time**: 20 minutes
**Dependencies**: None
**Files**:
- `codex-chrome/src/tools/DOMTool.ts` (read lines 923-927)
- `codex-chrome/src/content/content-script.ts` (read lines 59-62)
- `codex-chrome/src/core/MessageRouter.ts` (read MessageType enum)

**Objective**: Confirm PING/PONG exists but may not be used correctly

**Steps**:
1. Verify PING handler exists in content-script.ts (should be at lines 59-62)
2. Verify PING sender exists in DOMTool.ts (should be at lines 923-927)
3. Check if ensureContentScriptInjected() uses PING before operations
4. Verify PONG response format includes:
   - `type: MessageType.PONG`
   - `initLevel` field
   - `capabilities` array
5. Check if DOMTool waits for PONG before sending DOM operations

**Validation**:
- [ ] PING/PONG handlers exist and are registered
- [ ] PONG response format documented
- [ ] Identified: Whether PING is actually used before operations
- [ ] Identified: Whether exponential backoff exists for retry

**Output**: PING/PONG status report with current usage patterns

---

## Phase 2: Core Fix Tasks (T005-T010)

### T005: Align Message Type in Content Script to DOM_ACTION

**Priority**: CRITICAL
**Estimated Time**: 15 minutes
**Dependencies**: T001 (confirms root cause)
**Files**:
- `codex-chrome/src/content/content-script.ts` (edit lines 71-74)

**Objective**: Fix the root cause by aligning message type handler

**Steps**:
1. Locate message handler registration in setupMessageHandlers() (line 71)
2. Change from:
   ```typescript
   router.on(MessageType.TOOL_EXECUTE, async (message) => {
   ```
   To:
   ```typescript
   router.on(MessageType.DOM_ACTION, async (message) => {
   ```
3. Verify MessageType enum import includes DOM_ACTION
4. Update any references to TOOL_EXECUTE in the same method
5. Add comment explaining the fix:
   ```typescript
   // Handle DOM operations from DOMTool (background script)
   // Message type aligned to match DOMTool.sendContentScriptMessage()
   ```

**Validation**:
- [ ] Message type changed to MessageType.DOM_ACTION
- [ ] No compilation errors
- [ ] MessageType import includes DOM_ACTION
- [ ] Comment added explaining alignment

**Testing**:
```bash
cd codex-chrome
npm run build
# Should compile without errors
```

**Output**: `content-script.ts` with aligned message type

---

### T006: Implement Missing 18 DOM Operations in Content Script

**Priority**: CRITICAL
**Estimated Time**: 2 hours
**Dependencies**: T002 (operation audit), T005 (message type fix)
**Files**:
- `codex-chrome/src/content/content-script.ts` (edit lines 574-610, expand switch statement)
- `codex-chrome/src/tools/dom/chrome/contentScript.ts` (reference for helper functions)

**Objective**: Complete operation mapping so all 25 operations work

**Steps**:

1. **Expand executeDOMTool() switch statement** (lines 574-610):

2. **Add missing attribute operations**:
   ```typescript
   case 'getAttribute':
     const attrElement = document.querySelector(args.selector);
     if (!attrElement) throw new Error(`Element not found: ${args.selector}`);
     return attrElement.getAttribute(args.attribute);

   case 'setAttribute':
     const setAttrElement = document.querySelector(args.selector);
     if (!setAttrElement) throw new Error(`Element not found: ${args.selector}`);
     setAttrElement.setAttribute(args.attribute, args.value);
     return { success: true };
   ```

3. **Add property operations**:
   ```typescript
   case 'getProperty':
     const getPropElement = document.querySelector(args.selector) as any;
     if (!getPropElement) throw new Error(`Element not found: ${args.selector}`);
     return getPropElement[args.property];

   case 'setProperty':
     const setPropElement = document.querySelector(args.selector) as any;
     if (!setPropElement) throw new Error(`Element not found: ${args.selector}`);
     setPropElement[args.property] = args.value;
     return { success: true };
   ```

4. **Add content extraction operations** (delegate to existing helpers):
   ```typescript
   case 'getText':
     return getElementText(args.selector);

   case 'getHtml':
     const htmlElement = document.querySelector(args.selector);
     if (!htmlElement) throw new Error(`Element not found: ${args.selector}`);
     return { innerHTML: htmlElement.innerHTML };

   case 'extractLinks':
     const links = document.querySelectorAll('a[href]');
     return Array.from(links).map(a => ({
       text: a.textContent?.trim(),
       href: (a as HTMLAnchorElement).href,
       title: a.getAttribute('title')
     }));
   ```

5. **Add interaction operations** (delegate to helpers):
   ```typescript
   case 'focus':
     const focusElement = document.querySelector(args.selector) as HTMLElement;
     if (!focusElement) throw new Error(`Element not found: ${args.selector}`);
     focusElement.focus();
     return { success: true };

   case 'hover':
     const hoverElement = document.querySelector(args.selector) as HTMLElement;
     if (!hoverElement) throw new Error(`Element not found: ${args.selector}`);
     const hoverEvent = new MouseEvent('mouseover', { bubbles: true });
     hoverElement.dispatchEvent(hoverEvent);
     return { success: true };

   case 'submit':
   case 'submitForm':
     const form = document.querySelector(args.selector) as HTMLFormElement;
     if (!form) throw new Error(`Form not found: ${args.selector}`);
     form.submit();
     return { success: true };
   ```

6. **Add XPath operation** (delegate to helper):
   ```typescript
   case 'findByXPath':
     return evaluateXPath(args.xpath);
   ```

7. **Add advanced operations** (placeholder for complex implementations):
   ```typescript
   case 'captureSnapshot':
     return getDocumentTree(); // From contentScript.ts helper

   case 'getAccessibilityTree':
     throw new Error('Accessibility tree not yet implemented');

   case 'getPaintOrder':
     throw new Error('Paint order not yet implemented');

   case 'detectClickable':
     const clickable = document.querySelectorAll('a, button, [onclick], [role="button"]');
     return Array.from(clickable).map(el => ({
       tagName: el.tagName,
       selector: getElementSelector(el)
     }));

   case 'waitForElement':
     return waitForElement(args.selector, args.options?.timeout);

   case 'checkVisibility':
     return isElementInViewport(args.selector);

   case 'executeSequence':
     const results = [];
     for (const op of args.sequence) {
       results.push(await executeDOMTool(op.action, op));
     }
     return { sequence: results };
   ```

8. **Import missing helper functions** from dom/chrome/contentScript.ts

**Validation**:
- [ ] All 25 operations have case handlers
- [ ] Each operation delegates to appropriate helper function
- [ ] Error messages include operation and selector for debugging
- [ ] No compilation errors
- [ ] Advanced operations have placeholders with clear error messages

**Testing**:
```bash
npm run build
# Should compile successfully
```

**Output**: `content-script.ts` with complete 25 operation mapping

---

### T007: Add Error Classification to DOMTool

**Priority**: HIGH
**Estimated Time**: 45 minutes
**Dependencies**: T003 (error flow documented)
**Files**:
- `codex-chrome/src/tools/DOMTool.ts` (edit, add new method after line 1075)

**Objective**: Classify errors to distinguish permission vs communication vs element issues

**Steps**:

1. **Add error classification method** (after line 1075):
   ```typescript
   /**
    * Classify chrome.runtime.lastError for appropriate handling
    */
   private classifyMessageError(error: chrome.runtime.LastError): {
     type: ErrorCode;
     isRetryable: boolean;
     suggestedAction?: string;
   } {
     const message = error.message || '';

     // Permission denied patterns
     if (message.includes('Cannot access contents') ||
         message.includes('must request permission')) {
       return {
         type: ErrorCode.PERMISSION_DENIED,
         isRetryable: false,
         suggestedAction: 'Check manifest.json host_permissions or use activeTab'
       };
     }

     // Content script not loaded patterns
     if (message.includes('Could not establish connection') ||
         message.includes('Receiving end does not exist')) {
       return {
         type: ErrorCode.CONTENT_SCRIPT_NOT_LOADED,
         isRetryable: true,
         suggestedAction: 'Content script will be injected automatically'
       };
     }

     // Tab closed/removed
     if (message.includes('No tab with id') ||
         message.includes('tab was closed')) {
       return {
         type: ErrorCode.TAB_CLOSED,
         isRetryable: false
       };
     }

     // Context invalidated (page navigation/reload)
     if (message.includes('context invalidated') ||
         message.includes('document was detached')) {
       return {
         type: ErrorCode.CONTEXT_INVALIDATED,
         isRetryable: true,
         suggestedAction: 'Wait for page load and retry'
       };
     }

     return {
       type: ErrorCode.UNKNOWN,
       isRetryable: false
     };
   }
   ```

2. **Update sendContentScriptMessage** to use classification (lines 889-915):
   - After line 893 (chrome.runtime.lastError check), classify the error
   - Include error type and suggested action in rejection

3. **Update handleOperationError** (lines 996-1041):
   - Use classifyMessageError instead of string matching
   - Include error type in error object
   - Use suggestedAction in error message

**Validation**:
- [ ] classifyMessageError method added with 5 error patterns
- [ ] sendContentScriptMessage uses classification
- [ ] handleOperationError updated to use classification
- [ ] Error messages include suggestedAction

**Testing**:
```bash
npm run build
# Should compile successfully
```

**Output**: DOMTool.ts with error classification

---

### T008: Improve PING/PONG Verification with Exponential Backoff

**Priority**: HIGH
**Estimated Time**: 1 hour
**Dependencies**: T004 (PING/PONG status), T005 (message type fix)
**Files**:
- `codex-chrome/src/tools/DOMTool.ts` (edit lines 920-950, ensureContentScriptInjected)

**Objective**: Ensure content script is ready before sending operations

**Steps**:

1. **Update ensureContentScriptInjected method** (lines 920-950):
   ```typescript
   private async ensureContentScriptInjected(tabId: number): Promise<void> {
     // Step 1: Check if already ready via PING
     if (await this.pingContentScript(tabId, 500)) {
       return; // Already ready
     }

     // Step 2: Inject content script
     try {
       await chrome.scripting.executeScript({
         target: { tabId },
         files: ['/content/content-script.js'],
       });
     } catch (error: any) {
       const message = error.message || String(error);
       if (message.includes('Cannot access')) {
         throw this.createDOMError(
           ErrorCode.PERMISSION_DENIED,
           'Missing host permissions for this page',
           undefined,
           { tabId, error: message }
         );
       }
       throw this.createDOMError(
         ErrorCode.SCRIPT_INJECTION_FAILED,
         `Content script injection failed: ${message}`,
         undefined,
         { tabId }
       );
     }

     // Step 3: Wait for initialization with exponential backoff
     const delays = [100, 200, 400, 800, 1600]; // Total: 3.1 seconds
     for (const delay of delays) {
       await new Promise(resolve => setTimeout(resolve, delay));
       if (await this.pingContentScript(tabId, 1000)) {
         this.log('info', `Content script ready after ${delay}ms`);
         return;
       }
     }

     throw this.createDOMError(
       ErrorCode.SCRIPT_INJECTION_FAILED,
       'Content script failed to initialize after injection',
       undefined,
       { tabId }
     );
   }

   /**
    * Ping content script to check if ready
    */
   private async pingContentScript(tabId: number, timeout: number): Promise<boolean> {
     try {
       const response = await chrome.tabs.sendMessage(tabId, {
         type: MessageType.PING,
         requestId: this.generateRequestId(),
         timestamp: Date.now()
       });
       return response?.type === MessageType.PONG;
     } catch {
       return false;
     }
   }
   ```

2. **Ensure PONG handler in content script** includes initLevel:
   - Verify content-script.ts PONG handler returns initLevel
   - If missing, add it (should be in T001 findings)

**Validation**:
- [ ] ensureContentScriptInjected uses PING before operations
- [ ] Exponential backoff implemented (100, 200, 400, 800, 1600ms)
- [ ] Clear error messages for injection failures
- [ ] pingContentScript helper method added
- [ ] Logs added for debugging timing issues

**Testing**:
```bash
npm run build
```

**Output**: DOMTool.ts with robust content script injection

---

### T009: Add Structured Error Responses in Content Script

**Priority**: HIGH
**Estimated Time**: 30 minutes
**Dependencies**: T006 (operations implemented)
**Files**:
- `codex-chrome/src/content/content-script.ts` (edit lines 571-618, executeDOMTool wrapper)

**Objective**: Return structured errors with context for LLM to understand

**Steps**:

1. **Update executeDOMTool wrapper** (line 572-618):
   ```typescript
   async function executeDOMTool(toolName: string, args: any): Promise<any> {
     try {
       // Execute operation
       const result = await executeOperation(toolName, args);

       // Return structured success response
       return {
         success: true,
         data: result,
         requestId: args.requestId,
         timestamp: Date.now()
       };

     } catch (error: any) {
       // Classify error
       const errorType = classifyDOMError(error, toolName, args);

       // Return structured error response
       return {
         success: false,
         error: {
           type: errorType.code,
           message: errorType.message,
           operation: toolName,
           context: {
             selector: args.selector || args.xpath,
             pageURL: window.location.href
           },
           suggestedAction: errorType.suggestedAction
         },
         requestId: args.requestId,
         timestamp: Date.now()
       };
     }
   }

   /**
    * Classify DOM operation errors
    */
   function classifyDOMError(error: Error, operation: string, args: any): {
     code: string;
     message: string;
     suggestedAction: string;
   } {
     const message = error.message;

     // Element not found
     if (message.includes('Element not found') || message.includes('not found')) {
       return {
         code: 'ELEMENT_NOT_FOUND',
         message: `No element matching "${args.selector || args.xpath}" found on page`,
         suggestedAction: 'Verify selector is correct or wait for dynamic content to load'
       };
     }

     // Element not visible
     if (message.includes('not visible') || message.includes('hidden')) {
       return {
         code: 'ELEMENT_NOT_VISIBLE',
         message: `Element "${args.selector}" is not visible on page`,
         suggestedAction: 'Scroll element into view or wait for overlays to close'
       };
     }

     // Timeout
     if (message.includes('timeout') || message.includes('timed out')) {
       return {
         code: 'TIMEOUT',
         message: `Operation "${operation}" timed out after ${args.options?.timeout || 5000}ms`,
         suggestedAction: 'Page may be slow to respond or element may not exist'
       };
     }

     // Invalid selector
     if (message.includes('invalid') || message.includes('selector')) {
       return {
         code: 'INVALID_SELECTOR',
         message: `Invalid selector: "${args.selector || args.xpath}"`,
         suggestedAction: 'Check selector syntax (CSS or XPath)'
       };
     }

     // Generic error
     return {
       code: 'UNKNOWN',
       message: error.message || 'Unknown error during DOM operation',
       suggestedAction: 'Check browser console for details'
     };
   }
   ```

2. **Update operation implementations** to throw clear errors:
   - Each operation should throw descriptive errors (already done in T006)
   - Ensure element-not-found errors include selector

**Validation**:
- [ ] executeDOMTool returns structured response (success + data OR error + context)
- [ ] classifyDOMError added with 5 error patterns
- [ ] All error responses include: type, message, operation, context, suggestedAction
- [ ] requestId preserved in error responses

**Testing**:
```bash
npm run build
```

**Output**: content-script.ts with structured error responses

---

### T010: Add initLevel Tracking to Content Script [P]

**Priority**: MEDIUM
**Estimated Time**: 45 minutes
**Dependencies**: T004 (PING/PONG verification)
**Files**:
- `codex-chrome/src/content/content-script.ts` (edit, add initialization tracking)

**Objective**: Track initialization level for better error messages

**Steps**:

1. **Add initLevel tracking** (top of file, after imports):
   ```typescript
   enum InitializationLevel {
     NOT_INJECTED = 0,
     INJECTED = 1,
     HANDLERS_READY = 2,
     DOM_READY = 3,
     FULLY_READY = 4
   }

   let currentInitLevel: InitializationLevel = InitializationLevel.INJECTED;
   ```

2. **Update initialization sequence**:
   ```typescript
   function initialize(): void {
     console.log('Codex content script initialized');
     currentInitLevel = InitializationLevel.INJECTED;

     // Create message router
     router = new MessageRouter('content');
     setupMessageHandlers();
     currentInitLevel = InitializationLevel.HANDLERS_READY;

     // Check DOM ready state
     if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', () => {
         currentInitLevel = InitializationLevel.DOM_READY;
         setupDOMObservers();
       });
     } else {
       currentInitLevel = InitializationLevel.DOM_READY;
       setupDOMObservers();
     }

     // Setup async components
     Promise.all([
       setupInteractionHandlers(),
       announcePresence()
     ]).then(() => {
       currentInitLevel = InitializationLevel.FULLY_READY;
       console.log('Codex content script fully ready');
     });
   }
   ```

3. **Update PONG handler** to include initLevel (lines 59-62):
   ```typescript
   router.on(MessageType.PING, () => {
     return {
       type: MessageType.PONG,
       timestamp: Date.now(),
       initLevel: currentInitLevel,
       readyState: document.readyState,
       capabilities: getAvailableCapabilities(),
       version: '1.0.0'
     };
   });

   function getAvailableCapabilities(): string[] {
     const caps = ['dom'];
     if (currentInitLevel >= InitializationLevel.DOM_READY) {
       caps.push('events', 'forms');
     }
     if (currentInitLevel >= InitializationLevel.FULLY_READY) {
       caps.push('observers', 'storage');
     }
     return caps;
   }
   ```

**Validation**:
- [ ] InitializationLevel enum added
- [ ] currentInitLevel tracks progression through levels
- [ ] PONG response includes initLevel
- [ ] getAvailableCapabilities() returns level-appropriate capabilities

**Testing**:
```bash
npm run build
```

**Output**: content-script.ts with initialization level tracking

---

## Phase 3: Test Tasks (T011-T015) [P]

*Note: Tests can be implemented in parallel after core fixes are done*

### T011: Add Unit Tests for Message Type Alignment [P]

**Priority**: HIGH
**Estimated Time**: 45 minutes
**Dependencies**: T005 (message type fix)
**Files**:
- `codex-chrome/tests/unit/tools/DOMTool.test.ts` (create new)

**Objective**: Verify DOMTool and content script use matching message types

**Steps**:

1. **Create test file** if it doesn't exist
2. **Add message type compatibility test**:
   ```typescript
   describe('DOMTool Message Type Compatibility', () => {
     it('should send DOM_ACTION messages', () => {
       const tool = new DOMTool();
       const message = tool.createMessage('query', { selector: 'body' });
       expect(message.type).toBe(MessageType.DOM_ACTION);
     });

     it('should include required message fields', () => {
       const tool = new DOMTool();
       const message = tool.createMessage('click', { selector: '.button' });
       expect(message).toHaveProperty('type');
       expect(message).toHaveProperty('action');
       expect(message).toHaveProperty('requestId');
       expect(message).toHaveProperty('timestamp');
     });
   });
   ```

3. **Add content script handler test**:
   ```typescript
   describe('Content Script Message Handler', () => {
     it('should handle DOM_ACTION messages', async () => {
       const handler = getMessageHandler(MessageType.DOM_ACTION);
       expect(handler).toBeDefined();
     });

     it('should reject TOOL_EXECUTE messages', async () => {
       const handler = getMessageHandler(MessageType.TOOL_EXECUTE);
       expect(handler).toBeUndefined(); // Old type should not be handled
     });
   });
   ```

**Validation**:
- [ ] Tests verify message type is DOM_ACTION
- [ ] Tests verify required fields present
- [ ] Tests confirm old message type (TOOL_EXECUTE) is not handled
- [ ] All tests pass

**Testing**:
```bash
npm test -- DOMTool.test.ts
```

**Output**: Unit tests for message type alignment

---

### T012: Add Unit Tests for All 25 Operations [P]

**Priority**: HIGH
**Estimated Time**: 1.5 hours
**Dependencies**: T006 (operations implemented)
**Files**:
- `codex-chrome/tests/unit/content/content-script.test.ts` (create new)

**Objective**: Verify each operation is handled correctly

**Steps**:

1. **Create test file** with mock DOM setup
2. **Add test for each operation category**:

   ```typescript
   describe('Content Script DOM Operations', () => {
     describe('Query Operations', () => {
       it('should handle query operation', async () => {
         const result = await executeDOMTool('query', { selector: 'body' });
         expect(result.success).toBe(true);
         expect(result.data.elements).toBeDefined();
       });

       it('should handle findByXPath operation', async () => {
         const result = await executeDOMTool('findByXPath', { xpath: '//body' });
         expect(result.success).toBe(true);
       });
     });

     describe('Interaction Operations', () => {
       it('should handle click operation', async () => {
         document.body.innerHTML = '<button id="test">Click</button>';
         const result = await executeDOMTool('click', { selector: '#test' });
         expect(result.success).toBe(true);
       });

       it('should handle hover operation', async () => {
         document.body.innerHTML = '<div id="test">Hover</div>';
         const result = await executeDOMTool('hover', { selector: '#test' });
         expect(result.success).toBe(true);
       });

       it('should handle type operation', async () => {
         document.body.innerHTML = '<input id="test" />';
         const result = await executeDOMTool('type', { selector: '#test', text: 'hello' });
         expect(result.success).toBe(true);
         expect((document.getElementById('test') as HTMLInputElement).value).toBe('hello');
       });
     });

     describe('Attribute Operations', () => {
       it('should handle getAttribute', async () => {
         document.body.innerHTML = '<div id="test" data-value="123"></div>';
         const result = await executeDOMTool('getAttribute', {
           selector: '#test',
           attribute: 'data-value'
         });
         expect(result.success).toBe(true);
         expect(result.data).toBe('123');
       });

       it('should handle setAttribute', async () => {
         document.body.innerHTML = '<div id="test"></div>';
         const result = await executeDOMTool('setAttribute', {
           selector: '#test',
           attribute: 'data-foo',
           value: 'bar'
         });
         expect(result.success).toBe(true);
         expect(document.getElementById('test')?.getAttribute('data-foo')).toBe('bar');
       });
     });

     // Similar blocks for:
     // - Property Operations (getProperty, setProperty)
     // - Content Operations (getText, getHtml, extractLinks)
     // - Form Operations (fillForm, submit)
     // - Advanced Operations (checkVisibility, waitForElement, executeSequence)
   });
   ```

3. **Add error handling tests**:
   ```typescript
   describe('Error Handling', () => {
     it('should return structured error for element not found', async () => {
       const result = await executeDOMTool('click', { selector: '.nonexistent' });
       expect(result.success).toBe(false);
       expect(result.error.type).toBe('ELEMENT_NOT_FOUND');
       expect(result.error.suggestedAction).toBeDefined();
     });

     it('should return structured error for invalid selector', async () => {
       const result = await executeDOMTool('query', { selector: '!!!invalid' });
       expect(result.success).toBe(false);
       expect(result.error.type).toBe('INVALID_SELECTOR');
     });
   });
   ```

**Validation**:
- [ ] All 25 operations have tests
- [ ] Each test verifies success response structure
- [ ] Error cases tested (element not found, invalid selector)
- [ ] Structured error responses verified
- [ ] All tests pass

**Testing**:
```bash
npm test -- content-script.test.ts
```

**Output**: Comprehensive unit tests for all operations

---

### T013: Add Integration Test for WSJ Headline Extraction [P]

**Priority**: HIGH
**Estimated Time**: 1 hour
**Dependencies**: T005, T006, T008 (core fixes)
**Files**:
- `codex-chrome/tests/integration/dom-communication.test.ts` (create new)

**Objective**: Validate the original failing scenario now works

**Steps**:

1. **Create integration test file**
2. **Add WSJ headline extraction test**:
   ```typescript
   describe('DOM Communication Integration', () => {
     let tabId: number;

     beforeAll(async () => {
       // Create test tab
       const tab = await chrome.tabs.create({ url: 'https://example.com' });
       tabId = tab.id!;
       await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for load
     });

     afterAll(async () => {
       await chrome.tabs.remove(tabId);
     });

     it('should extract headline from webpage', async () => {
       // Arrange
       const tool = new DOMTool();

       // Act
       const result = await tool.execute({
         action: 'query',
         selector: 'h1, h2, .headline, [class*="headline"]',
         options: { multiple: true },
         tabId
       });

       // Assert
       expect(result.elements).toBeDefined();
       expect(result.elements.length).toBeGreaterThan(0);
       expect(result.elements[0].textContent).toBeDefined();
     });

     it('should not return permission restriction error', async () => {
       const tool = new DOMTool();

       try {
         await tool.execute({
           action: 'query',
           selector: 'body',
           tabId
         });
       } catch (error) {
         expect(error.message).not.toContain('host-permission restriction');
         expect(error.message).not.toContain('permission denied');
       }
     });

     it('should handle content script injection automatically', async () => {
       // Create new tab (no content script yet)
       const newTab = await chrome.tabs.create({ url: 'https://example.com' });

       const tool = new DOMTool();
       const result = await tool.execute({
         action: 'query',
         selector: 'body',
         tabId: newTab.id!
       });

       expect(result.elements).toBeDefined();
       await chrome.tabs.remove(newTab.id!);
     });
   });
   ```

3. **Add error classification test**:
   ```typescript
   describe('Error Classification', () => {
     it('should distinguish element not found from permission errors', async () => {
       const tool = new DOMTool();

       try {
         await tool.execute({
           action: 'click',
           selector: '.nonexistent-element-12345',
           tabId
         });
         fail('Should have thrown error');
       } catch (error) {
         expect(error.domError?.type).toBe('ELEMENT_NOT_FOUND');
         expect(error.domError?.type).not.toBe('PERMISSION_DENIED');
         expect(error.domError.suggestedAction).toContain('selector');
       }
     });

     it('should detect permission denied on chrome:// URLs', async () => {
       const chromeTab = await chrome.tabs.create({ url: 'chrome://extensions' });
       const tool = new DOMTool();

       try {
         await tool.execute({
           action: 'query',
           selector: 'body',
           tabId: chromeTab.id!
         });
         fail('Should have thrown error');
       } catch (error) {
         expect(error.domError?.type).toBe('PERMISSION_DENIED');
         expect(error.message).toContain('permission');
       } finally {
         await chrome.tabs.remove(chromeTab.id!);
       }
     });
   });
   ```

**Validation**:
- [ ] Test extracts headlines from example.com successfully
- [ ] Test verifies no "permission restriction" errors
- [ ] Test confirms content script auto-injection works
- [ ] Error classification tests pass
- [ ] Integration tests pass

**Testing**:
```bash
npm test -- dom-communication.test.ts
```

**Output**: Integration tests for end-to-end communication

---

### T014: Add Performance Benchmark Tests [P]

**Priority**: MEDIUM
**Estimated Time**: 45 minutes
**Dependencies**: T008 (PING/PONG with backoff)
**Files**:
- `codex-chrome/tests/performance/message-latency.test.ts` (create new)

**Objective**: Verify performance targets are met

**Steps**:

1. **Create performance test file**
2. **Add PING/PONG latency benchmark**:
   ```typescript
   describe('Message Passing Performance', () => {
     it('should complete PING/PONG in <100ms (p99)', async () => {
       const iterations = 100;
       const latencies: number[] = [];

       for (let i = 0; i < iterations; i++) {
         const start = performance.now();
         await chrome.tabs.sendMessage(tabId, {
           type: MessageType.PING,
           requestId: `perf-${i}`,
           timestamp: Date.now()
         });
         const end = performance.now();
         latencies.push(end - start);
       }

       latencies.sort((a, b) => a - b);
       const p50 = latencies[Math.floor(latencies.length * 0.5)];
       const p99 = latencies[Math.floor(latencies.length * 0.99)];

       console.log(`PING/PONG Latency - p50: ${p50.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`);

       expect(p99).toBeLessThan(100);
     });

     it('should inject content script in <500ms', async () => {
       const tab = await chrome.tabs.create({ url: 'https://example.com' });
       const start = performance.now();

       const tool = new DOMTool();
       await tool['ensureContentScriptInjected'](tab.id!);

       const end = performance.now();
       const injectionTime = end - start;

       console.log(`Content script injection time: ${injectionTime.toFixed(2)}ms`);

       expect(injectionTime).toBeLessThan(500);
       await chrome.tabs.remove(tab.id!);
     });

     it('should execute simple query in <100ms', async () => {
       const tool = new DOMTool();
       const start = performance.now();

       await tool.execute({
         action: 'query',
         selector: 'body',
         tabId
       });

       const end = performance.now();
       expect(end - start).toBeLessThan(100);
     });
   });
   ```

**Validation**:
- [ ] PING/PONG p99 latency < 100ms
- [ ] Content script injection < 500ms
- [ ] Simple query < 100ms
- [ ] Performance benchmarks logged for monitoring

**Testing**:
```bash
npm test -- message-latency.test.ts
```

**Output**: Performance benchmark tests

---

### T015: Add Contract Validation Tests [P]

**Priority**: MEDIUM
**Estimated Time**: 30 minutes
**Dependencies**: None (validates contracts from Phase 1)
**Files**:
- `codex-chrome/tests/unit/contracts/message-types.test.ts` (create new)

**Objective**: Verify message contracts are followed

**Steps**:

1. **Create contract test file**
2. **Add message format validation tests**:
   ```typescript
   import * as contracts from '../../../specs/017-fix-domtool-content-script-communication/contracts/message-types';

   describe('Message Type Contracts', () => {
     it('should validate DOMOperationRequest structure', () => {
       const request: contracts.DOMOperationRequest = {
         type: contracts.MessageType.DOM_ACTION,
         action: 'query',
         selector: 'body',
         requestId: 'test-123',
         timestamp: Date.now(),
         source: { context: 'background', tabId: 1 }
       };

       expect(contracts.isDOMOperationRequest(request)).toBe(true);
     });

     it('should validate DOMOperationResponse structure', () => {
       const response: contracts.DOMOperationResponse = {
         type: contracts.MessageType.DOM_RESPONSE,
         success: true,
         data: { elements: [] },
         requestId: 'test-123',
         timestamp: Date.now(),
         source: { context: 'content', tabId: 1, frameId: 0 }
       };

       expect(contracts.isDOMOperationResponse(response)).toBe(true);
     });

     it('should validate all 25 operations are in DOMActionType', () => {
       const expectedOperations = [
         'query', 'click', 'type', 'getAttribute', 'setAttribute',
         'getText', 'getHtml', 'submit', 'focus', 'scroll',
         'findByXPath', 'hover', 'getProperty', 'setProperty',
         'extractLinks', 'fillForm', 'submitForm',
         'captureSnapshot', 'getAccessibilityTree', 'getPaintOrder',
         'detectClickable', 'waitForElement', 'checkVisibility',
         'executeSequence'
       ];

       // Verify contracts include all operations
       for (const op of expectedOperations) {
         expect(contracts.OPERATION_REQUIREMENTS[op as contracts.DOMActionType])
           .toBeDefined();
       }
     });
   });
   ```

**Validation**:
- [ ] Message type contracts validated
- [ ] All 25 operations included in contract
- [ ] Type guards work correctly
- [ ] Tests pass

**Testing**:
```bash
npm test -- message-types.test.ts
```

**Output**: Contract validation tests

---

## Phase 4: Validation Tasks (T016-T018)

### T016: Manual Validation with WSJ.com

**Priority**: CRITICAL
**Estimated Time**: 30 minutes
**Dependencies**: T005, T006, T008 (all core fixes)
**Files**: None (manual testing)

**Objective**: Verify the original failing scenario works end-to-end

**Steps** (follow quickstart.md):

1. **Load extension in Chrome**:
   ```bash
   cd codex-chrome
   npm run build
   # Load unpacked extension from dist/
   ```

2. **Open codex-chrome sidepanel**

3. **Execute command**: "open wsj.com and summarize the top headline"

4. **Observe**:
   - Extension opens WSJ in new tab
   - Content script injected automatically
   - DOM operations execute successfully
   - Headline text extracted
   - LLM generates summary
   - NO "host-permission restriction" errors
   - NO "Could not establish connection" errors

5. **Check DevTools**:
   - Background console: Look for DOM_ACTION messages sent
   - Page console: Look for content script receiving messages
   - No errors in either console

6. **Test error scenario**: "click button .nonexistent-button-xyz"
   - Should get clear error: "Element not found"
   - Error message should include selector
   - Error message should suggest action
   - Should NOT say "permission denied"

**Validation Checklist**:
- [ ] WSJ.com opens successfully
- [ ] Headline extracted without errors
- [ ] LLM receives headline text and generates summary
- [ ] No permission errors when permissions are granted
- [ ] Error messages are clear and actionable
- [ ] Content script auto-injection works

**Output**: Manual validation report with screenshots

---

### T017: Cross-Site Compatibility Testing

**Priority**: HIGH
**Estimated Time**: 45 minutes
**Dependencies**: T016 (WSJ validated)
**Files**: None (manual testing)

**Objective**: Verify fix works across different websites

**Test Sites**:
1. **example.com** (simple static HTML)
2. **github.com** (SPA with React)
3. **wikipedia.org** (server-rendered, forms)
4. **twitter.com/x.com** (complex SPA, dynamic content)
5. **google.com** (search, dynamic results)

**For Each Site**:
1. Open site via agent command
2. Execute basic operations:
   - Query for headings: `h1, h2, h3`
   - Extract text from main content
   - Find and click a link (if applicable)
3. Verify:
   - Content script injects successfully
   - Operations execute without errors
   - Results returned correctly
   - No permission errors

**Special Cases**:
- **chrome://extensions**: Should fail with clear "permission denied" error
- **about:blank**: Should handle gracefully
- **Sites with CSP**: Document behavior (may fail, should have clear error)

**Validation Checklist**:
- [ ] All test sites work without errors
- [ ] Static and dynamic sites both work
- [ ] SPAs handle client-side navigation correctly
- [ ] Protected URLs fail with correct error message
- [ ] CSP-blocked sites (if any) have clear error messages

**Output**: Compatibility matrix with pass/fail for each site

---

### T018: Performance and Stress Testing

**Priority**: MEDIUM
**Estimated Time**: 30 minutes
**Dependencies**: T016 (manual validation)
**Files**: None (manual testing)

**Objective**: Verify system handles high load and edge cases

**Test Scenarios**:

1. **Rapid Operations**:
   - Send 100 sequential DOM operations to same tab
   - Verify: No memory leaks, all operations complete
   - Check: Response times remain consistent

2. **Multiple Tabs**:
   - Open 10 tabs simultaneously
   - Execute operations on each tab in parallel
   - Verify: All tabs work correctly, no cross-contamination

3. **Page Navigation During Operation**:
   - Start DOM operation
   - Navigate page mid-operation
   - Verify: Graceful error handling (CONTEXT_INVALIDATED)

4. **Tab Closure During Operation**:
   - Start DOM operation
   - Close tab mid-operation
   - Verify: Graceful error handling (TAB_CLOSED)

5. **Content Script Re-injection**:
   - Inject content script
   - Navigate to new URL (same domain)
   - Re-inject content script
   - Verify: No duplicate handlers, works correctly

**Validation Checklist**:
- [ ] 100 operations complete without memory leak
- [ ] Multiple tabs work in parallel
- [ ] Page navigation handled gracefully
- [ ] Tab closure handled gracefully
- [ ] Re-injection doesn't create duplicate handlers
- [ ] Performance remains stable under load

**Output**: Performance test report with metrics

---

## Parallel Execution Guide

### Phase 1: Can Run in Parallel After Diagnostics
```bash
# After T001-T004 complete, these can run in parallel:

# Terminal 1: Core message fix
/tasks T005

# Terminal 2: Operation mapping (depends on T002 audit)
/tasks T006

# Terminal 3: Error classification
/tasks T007

# Terminal 4: PING/PONG improvement
/tasks T008
```

### Phase 2: Tests Can Run in Parallel
```bash
# After T005-T010 complete, run all tests in parallel:

# Terminal 1
/tasks T011  # Message type tests

# Terminal 2
/tasks T012  # Operation tests

# Terminal 3
/tasks T013  # Integration tests

# Terminal 4
/tasks T014  # Performance tests

# Terminal 5
/tasks T015  # Contract tests
```

### Sequential Dependencies

**Must be sequential** (same file):
- T005 (message type) → T006 (operations) → T009 (error responses)
  - All modify `content-script.ts`
- T007 (error classification) → T008 (PING/PONG)
  - Both modify `DOMTool.ts`

**Can be parallel** (different files):
- T010 (initLevel tracking in content-script) || T007-T008 (DOMTool changes)
- All test tasks T011-T015 (different test files)

---

## Success Criteria

**Core Functionality**:
- [ ] All 25 DOM operations work on WSJ.com and other sites
- [ ] Message type aligned: DOMTool sends DOM_ACTION, content script handles DOM_ACTION
- [ ] Content script auto-injection with exponential backoff works reliably
- [ ] PING/PONG verification prevents race conditions

**Error Handling**:
- [ ] Errors classified correctly (permission vs communication vs element)
- [ ] Error messages are actionable and LLM-friendly
- [ ] No misleading "permission restriction" errors for communication failures
- [ ] Structured error responses include: type, message, operation, context, suggestedAction

**Performance**:
- [ ] PING/PONG latency < 100ms (p99)
- [ ] Content script injection < 500ms
- [ ] Simple DOM query < 100ms
- [ ] No memory leaks after 100+ operations

**Testing**:
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Contract validation tests pass
- [ ] Manual validation on WSJ.com succeeds
- [ ] Cross-site compatibility verified

---

## Estimated Total Time

- **Phase 1 (Diagnostic)**: 2 hours
- **Phase 2 (Core Fix)**: 5 hours
- **Phase 3 (Tests)**: 4.5 hours
- **Phase 4 (Validation)**: 1.75 hours
- **Total**: ~13.25 hours

**Critical Path** (cannot be parallelized): ~8 hours
**Parallelizable Work**: ~5.25 hours

**With parallel execution**: ~10 hours total

---

**Tasks Ready for Execution** - Use `/implement` or execute manually task by task
