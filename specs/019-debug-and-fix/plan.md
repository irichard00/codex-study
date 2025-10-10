# Implementation Plan: Content Script Communication Fix

**Branch**: `019-debug-and-fix` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-debug-and-fix/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
   → Loaded: Content Script Communication Fix
   → Error: "Could not establish connection. Receiving end does not exist"
2. Fill Technical Context ✅
   → Project Type: Chrome Extension (single project)
   → No NEEDS CLARIFICATION (concrete bug fix with clear error)
3. Fill Constitution Check section ✅
   → Constitution is template-only, using standard engineering principles
4. Evaluate Constitution Check section ✅
   → No violations (bug fix, not new architecture)
5. Execute Phase 0 → research.md ✅
6. Execute Phase 1 → contracts, data-model.md, quickstart.md ✅
7. Re-evaluate Constitution Check ✅
   → No new violations
8. Plan Phase 2 → Describe task generation approach ✅
9. STOP - Ready for /tasks command ✅
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

**Primary Requirement**: Fix the "Could not establish connection. Receiving end does not exist" error that occurs when DOMTool attempts to communicate with the content script via chrome.tabs.sendMessage.

**Technical Approach**:
1. Diagnose why content script message listener is not responding (injection failure, initialization error, timing issue, or context mismatch)
2. Ensure MessageRouter properly registers chrome.runtime.onMessage listener in content script context
3. Add diagnostic logging and error recovery mechanisms
4. Verify content script initialization completes before PING/PONG health checks
5. Test reliability across different page load states and timing scenarios

## Technical Context
**Language/Version**: TypeScript 5.9.2
**Primary Dependencies**: Chrome Extension Manifest V3 APIs (chrome.runtime, chrome.tabs, chrome.scripting)
**Storage**: N/A (communication debugging, no persistent data)
**Testing**: Vitest 3.2.4 for contract/integration tests, manual browser testing
**Target Platform**: Chrome/Chromium browsers (Manifest V3 extensions)
**Project Type**: single (Chrome Extension - codex-chrome/)
**Performance Goals**: <100ms PING/PONG response, <500ms content script initialization
**Constraints**: Must work across all page lifecycle states (loading, interactive, complete), no privileged pages (chrome://)
**Scale/Scope**: Single extension with background script + content script communication

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: Template-only constitution file found. Applying standard engineering principles:
- ✅ **Simplicity**: Bug fix maintains existing architecture, no new complexity
- ✅ **Testability**: Adding diagnostic tests and verification mechanisms
- ✅ **Observability**: Enhanced logging for debugging initialization failures
- ✅ **Minimal Changes**: Focused fix for specific error, not rewriting communication layer

**Gate Result**: ✅ PASS - No constitutional violations, proceeding with diagnostic approach

## Project Structure

### Documentation (this feature)
```
specs/019-debug-and-fix/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✅
├── data-model.md        # Phase 1 output (/plan command) - N/A for bug fix
├── quickstart.md        # Phase 1 output (/plan command) ✅
├── contracts/           # Phase 1 output (/plan command) ✅
│   └── content-script-lifecycle.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── content/
│   │   └── content-script.ts        # Content script with MessageRouter initialization
│   ├── core/
│   │   └── MessageRouter.ts          # Message routing infrastructure
│   ├── tools/
│   │   └── DOMTool.ts                # Background script initiating PING/PONG
│   └── background/
│       └── service-worker.ts         # Background service worker
├── tests/
│   ├── contract/
│   │   └── content-script-initialization.test.ts
│   ├── integration/
│   │   └── message-communication.test.ts
│   └── diagnostics/
│       └── listener-verification.test.ts
├── dist/                             # Build output
│   ├── content.js
│   └── background.js
└── manifest.json                     # Extension manifest
```

**Structure Decision**: Single project structure (Chrome Extension). The `codex-chrome/` directory contains all extension code including content scripts, background scripts, and supporting infrastructure. This is the standard structure for Manifest V3 Chrome extensions.

## Phase 0: Outline & Research

### Research Tasks

**No NEEDS CLARIFICATION** in Technical Context - concrete bug fix with clear error message and known components.

### Research Questions

1. **Chrome Extension Message Listener Registration**
   - **Question**: What are the requirements for chrome.runtime.onMessage to work in content scripts?
   - **Finding**: Must be registered synchronously during script load, before any async operations
   - **Decision**: Verify MessageRouter.setupMessageListener() is called synchronously in initialize()
   - **Reference**: Chrome Extension docs, Manifest V3 messaging API

2. **Content Script Injection Timing**
   - **Question**: When is programmatic injection (chrome.scripting.executeScript) fully complete?
   - **Finding**: executeScript resolves when script executes, but listener registration may be asynchronous
   - **Decision**: Add delay after injection before first PING attempt, verify listener readiness
   - **Alternatives**: Use declarative manifest injection (already exists), polling with timeout

3. **Message Router Context Detection**
   - **Question**: How does MessageRouter determine it's running in content script vs background?
   - **Finding**: Uses window object presence and chrome API availability in createRouter()
   - **Decision**: Verify context detection works correctly, log detected source
   - **Alternatives**: Explicit context parameter passed to MessageRouter constructor

4. **Error "Receiving end does not exist"**
   - **Question**: What specific conditions cause this Chrome error?
   - **Finding**: Thrown when chrome.tabs.sendMessage finds no onMessage listener on target tab
   - **Decision**: Diagnostic logging before PING, verification listener is registered
   - **Reference**: Chrome extension error messages, debugging guides

### Research Output

See `research.md` for full analysis including:
- Content script lifecycle investigation
- MessageRouter initialization flow analysis
- Timing analysis of injection vs listener registration
- Root cause hypotheses (5 potential failure modes)
- Diagnostic approach and instrumentation plan

## Phase 1: Design & Contracts

### Data Model

**N/A** - This is a bug fix for communication infrastructure, not a data model feature. No entities or persistent data involved.

### Contracts

**Contract 1**: Content Script Initialization Lifecycle

Location: `contracts/content-script-lifecycle.md`

**Purpose**: Define the required initialization sequence and verification points for content script message listener registration.

**States**:
1. NOT_INJECTED (0) - Script file not loaded
2. INJECTED (1) - Script loaded, initialize() not called
3. HANDLERS_READY (2) - Message handlers registered
4. DOM_READY (3) - DOM is ready for manipulation
5. FULLY_READY (4) - All features initialized

**Transitions**:
- Script load → initialize() → MessageRouter created → setupMessageListener() → handlers registered → HANDLERS_READY
- HANDLERS_READY + DOM interactive/complete → DOM_READY → FULLY_READY

**Invariants**:
- MessageRouter.setupMessageListener() MUST complete before any chrome.tabs.sendMessage to the tab
- PING handler MUST be registered before ensureContentScriptInjected() considers injection complete
- getInitLevel() MUST return accurate state (used in PONG response)

**Verification**:
- Health check: Send PING, expect PONG with initLevel >= 2
- Diagnostic: Query window.__codexUtils to verify enhancement scripts loaded
- Error recovery: If PING fails 5 times, assume initialization failed

### Quickstart

Location: `quickstart.md`

**Diagnostic Quickstart** (5-minute verification):

1. **Build Extension**: `cd codex-chrome && npm run build`
2. **Load in Chrome**: chrome://extensions → Load unpacked → select `dist/`
3. **Open Test Page**: Navigate to https://example.com
4. **Open DevTools Consoles**:
   - Page console (F12 on example.com tab)
   - Background console (chrome://extensions → service worker link)
5. **Verify Logs**:
   - Page console: Look for "Codex content script initialized"
   - Page console: Check for MessageRouter creation logs
   - Page console: Verify window.__codexUtils exists
6. **Test PING/PONG**:
   - Background console: Run diagnostic command
   - Should see PONG response with initLevel: 4
7. **Reproduce Error** (if issue persists):
   - Background console: Attempt DOM operation
   - Should see "Could not establish connection" or successful response

**Expected Outcomes**:
- ✅ Content script logs appear in page console
- ✅ PING receives PONG within 100ms
- ✅ initLevel is 2+ (HANDLERS_READY or higher)
- ❌ "Receiving end does not exist" error = listener not registered

**Debugging Steps** (if quickstart fails):
1. Check dist/content.js exists and matches manifest reference
2. Verify content.js loaded (check Sources tab in page DevTools)
3. Add breakpoint in content-script.ts initialize() to verify it runs
4. Check for JavaScript errors during initialization
5. Verify MessageRouter constructor completes successfully

### Contract Tests

**Test 1**: Content Script Listener Registration

```typescript
// tests/contract/content-script-initialization.test.ts
describe('Content Script Listener Registration', () => {
  it('should register chrome.runtime.onMessage listener synchronously', () => {
    // Simulate content script load
    const router = new MessageRouter('content');

    // Verify listener registered
    expect(chrome.runtime.onMessage.hasListeners()).toBe(true);
  });

  it('should register PING handler before async operations', () => {
    const router = new MessageRouter('content');

    // Verify PING handler exists
    const handlers = router.getHandlers(MessageType.PING);
    expect(handlers.size).toBeGreaterThan(0);
  });
});
```

**Test 2**: PING/PONG Health Check

```typescript
// tests/integration/message-communication.test.ts
describe('PING/PONG Health Check', () => {
  it('should respond to PING within 100ms', async () => {
    const tabId = await createTestTab();
    const start = Date.now();

    const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
    const duration = Date.now() - start;

    expect(response.type).toBe(MessageType.PONG);
    expect(duration).toBeLessThan(100);
  });

  it('should include initLevel in PONG response', async () => {
    const tabId = await createTestTab();

    const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });

    expect(response.initLevel).toBeGreaterThanOrEqual(2); // HANDLERS_READY
  });
});
```

**Test 3**: Error Recovery

```typescript
// tests/integration/error-recovery.test.ts
describe('Error Recovery', () => {
  it('should detect listener not registered', async () => {
    const tabId = await createTabWithoutContentScript();

    await expect(
      chrome.tabs.sendMessage(tabId, { type: MessageType.PING })
    ).rejects.toThrow('Could not establish connection');
  });

  it('should differentiate injection failure from listener failure', async () => {
    // Test with CSP-blocked page
    const cspTab = await createTabWithCSP();

    const error = await ensureContentScriptInjected(cspTab.id).catch(e => e);

    expect(error.code).toBe('SCRIPT_INJECTION_FAILED');
    expect(error.message).toContain('Content Security Policy');
  });
});
```

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **Diagnostic Phase** (Parallel):
   - Add initialization logging to content-script.ts
   - Add listener verification to MessageRouter.ts
   - Add diagnostic command to background console
   - Create manual test page for reproduction

2. **Fix Phase** (Sequential, depends on diagnosis):
   - Fix root cause based on diagnostic findings
   - Add error recovery mechanisms
   - Enhance timing/retry logic if needed
   - Update ensureContentScriptInjected() with better checks

3. **Verification Phase** (Parallel after fix):
   - Contract tests (listener registration, PING/PONG)
   - Integration tests (error recovery, timing)
   - Manual quickstart verification
   - Cross-browser testing (Chrome, Edge, Brave)

4. **Documentation Phase** (Parallel):
   - Update content-script lifecycle contract
   - Document diagnostic procedures
   - Add troubleshooting guide

**Ordering Strategy**:
- **TDD**: Diagnostic tests first (should pass for working state, fail for broken state)
- **Dependency**: Logging before diagnosis, diagnosis before fix
- **Parallelization**: Mark [P] for independent diagnostic additions

**Estimated Output**: 15-20 tasks organized into diagnostic → fix → verify → document phases

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (run tests, execute quickstart.md, verify fix on multiple pages)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - This is a focused bug fix maintaining existing architecture.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (none existed - clear bug fix)
- [x] Complexity deviations documented (none - simple fix)

---
*Based on standard engineering principles - Constitution template found at `/memory/constitution.md`*
