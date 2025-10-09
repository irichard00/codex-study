# Implementation Plan: DOMTool Content Script Injection Error Fix

**Branch**: `018-inspect-the-domtool` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-inspect-the-domtool/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
   → Loaded successfully
2. Fill Technical Context ✅
   → TypeScript/Chrome Extension project detected
   → Structure: Single project (Chrome Extension)
3. Fill the Constitution Check section ✅
   → Constitution is template - no specific requirements
4. Evaluate Constitution Check section ✅
   → No violations (bug fix, not new architecture)
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md ✅
   → Root cause identified through codebase analysis
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✅
   → Contracts generated for file path configuration
7. Re-evaluate Constitution Check section ✅
   → No new violations
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Task generation approach described ✅
9. STOP - Ready for /tasks command ✅
```

## Summary

**Primary Issue**: Content script injection fails with "Could not load file: 'content/content-script.js'" error because DOMTool.ts:944 hardcodes an incorrect file path that doesn't match the build output.

**Root Cause Analysis**:
- Vite builds `src/content/content-script.ts` → `dist/content.js` (vite.config.mjs:14,19)
- Manifest correctly references: `content.js` ✅
- DOMTool incorrectly references: `/content/content-script.js` ❌

**Technical Approach**: Update the hardcoded file path in DOMTool.ensureContentScriptInjected() from `/content/content-script.js` to `/content.js` to match the actual build output and manifest declaration.

## Technical Context
**Language/Version**: TypeScript 5.9.2, Chrome Extension Manifest V3
**Primary Dependencies**: Vite 5.4.20 (bundler), Svelte 4.2.20 (UI), Chrome APIs
**Storage**: IndexedDB (RolloutRecorder), chrome.storage.local (config)
**Testing**: Vitest 3.2.4, jsdom 27.0.0, fake-indexeddb 6.2.2
**Target Platform**: Chrome Extension (Manifest V3), Chromium-based browsers
**Project Type**: Single (Chrome Extension with background service worker + content scripts)
**Performance Goals**: Content script injection <50ms, PING response <100ms
**Constraints**: Manifest V3 restrictions, Content Security Policy, file path must match build output
**Scale/Scope**: Single extension, 8 tools, ~15k LOC TypeScript codebase

**Build Process**:
- Input: `src/content/content-script.ts`
- Build: Vite with Rollup (vite.config.mjs)
- Output: `dist/content.js` (entryFileNames: '[name].js')
- Manifest: References `content.js` in content_scripts array

**File Path Discrepancy**:
| Location | Current Reference | Status |
|----------|------------------|---------|
| Vite Config (line 14) | `src/content/content-script.ts` → `content.js` | ✅ Correct |
| Manifest (line 38) | `content.js` | ✅ Correct |
| DOMTool.ts (line 944) | `/content/content-script.js` | ❌ Wrong |
| Build Output | `dist/content.js` | ✅ Exists |

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution is a template and contains no specific project requirements, this section evaluates general software engineering principles:

**Simplicity**: ✅ PASS
- Fix is a simple file path correction
- No new abstractions or complexity added
- Direct fix to the root cause

**Testing**: ✅ PASS
- Test will verify content script injection succeeds
- Test will verify PING/PONG message exchange
- Integration test will verify DOM tool operations work end-to-end

**Documentation**: ✅ PASS
- Quickstart will document the file path configuration
- Comments will explain the relationship between vite config, manifest, and code

## Project Structure

### Documentation (this feature)
```
specs/018-inspect-the-domtool/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── file-paths.md    # Contract for content script file path configuration
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── tools/
│   │   └── DOMTool.ts              # Line 944: Update file path
│   ├── content/
│   │   └── content-script.ts       # Source file (correct)
│   └── background/
│       └── service-worker.ts
├── dist/                            # Build output
│   ├── content.js                   # Built content script (correct)
│   └── manifest.json                # References content.js (correct)
├── manifest.json                    # Source manifest
├── vite.config.mjs                  # Builds content-script.ts → content.js
└── tests/
    ├── integration/
    │   └── dom-tool-injection.test.ts  # New test
    └── unit/
        └── tools/
            └── DOMTool.test.ts          # Updated test
```

**Structure Decision**: Single project structure (Chrome Extension). The extension consists of:
- Background service worker (`dist/background.js`)
- Content scripts (`dist/content.js`)
- Side panel UI (`dist/sidepanel.html`)
- Tools layer (DOMTool, NavigationTool, etc.)
- Model client layer (OpenAIResponsesClient)

All TypeScript sources live under `src/`, compiled to `dist/` by Vite.

## Phase 0: Outline & Research

### Research Findings

**Decision 1: File Path Resolution**
- **Decision**: Use `/content.js` as the file path for content script injection
- **Rationale**:
  - Vite config outputs `content.js` (not `content-script.js`)
  - Manifest already references `content.js`
  - Chrome's `chrome.scripting.executeScript()` expects paths relative to extension root
- **Alternatives considered**:
  - Change Vite config to output `content/content-script.js` ❌ (would require manifest change)
  - Use environment variable for path ❌ (adds unnecessary complexity)
  - Keep hardcoded but correct path ✅ (simplest, follows existing pattern)

**Decision 2: Error Handling Strategy**
- **Decision**: Improve error messages to distinguish file errors from permission errors
- **Rationale**:
  - Current error "Failed to inject content script" is ambiguous
  - User needs to know if issue is file path vs permissions vs CSP
  - Helps with debugging future issues
- **Alternatives considered**:
  - Keep generic error ❌ (poor debugging experience)
  - Log to console only ❌ (errors should be visible to LLM)
  - Structured error codes ✅ (already exists via ErrorCode enum)

**Decision 3: Tool Definition Format**
- **Decision**: Verify tool definitions are correctly formatted for Responses API
- **Rationale**:
  - Responses API expects flat structure (type, name, description, parameters)
  - OpenAIResponsesClient.createToolsJsonForResponsesApi() handles transformation
  - Need to verify transformation is correct
- **Alternatives considered**:
  - Skip verification ❌ (may have related bugs)
  - Add runtime validation ✅ (ensures correctness)
  - Use TypeScript types ✅ (compile-time safety, already in place)

**Decision 4: Testing Strategy**
- **Decision**: Create integration test that verifies full content script injection flow
- **Rationale**:
  - Unit tests alone won't catch file path mismatches
  - Need to test chrome.scripting.executeScript with actual file path
  - PING/PONG flow needs end-to-end verification
- **Alternatives considered**:
  - Unit tests only ❌ (insufficient coverage)
  - Manual testing ❌ (not repeatable)
  - Integration test with mocked chrome APIs ✅ (best balance)

### Technology Best Practices

**Chrome Extension Content Script Injection**:
- Use `chrome.scripting.executeScript()` with `files` parameter
- File paths are relative to extension root (where manifest.json is)
- Wait for script to initialize before sending messages (PING/PONG pattern)
- Handle injection errors with exponential backoff (already implemented)

**Vite Build Configuration**:
- `entryFileNames: '[name].js'` outputs based on input key name
- Input key `content` → output `content.js` (not `content-script.js`)
- File extension is always `.js` regardless of source `.ts`
- Source maps are separate files (`content.js.map`)

**Tool Definition Format for OpenAI Responses API**:
```javascript
// CORRECT (flat structure)
{
  type: 'function',
  name: 'browser_dom',
  description: '...',
  parameters: { type: 'object', properties: {...} }
}

// WRONG (nested structure - for Chat Completions API)
{
  type: 'function',
  function: {
    name: 'browser_dom',
    description: '...',
    parameters: {...}
  }
}
```

### Open Questions Resolved
1. ✅ **Where does Vite output the content script?** → `dist/content.js` (confirmed)
2. ✅ **What path should chrome.scripting.executeScript use?** → `/content.js` (relative to extension root)
3. ✅ **Is the manifest correct?** → Yes, it references `content.js` correctly
4. ✅ **Are tool definitions formatted correctly?** → Need to verify in implementation

## Phase 1: Design & Contracts

### Data Model

**No persistent data model changes required** - this is a bug fix for file path configuration.

### API Contracts

#### Contract 1: Content Script File Path Configuration

**File**: `contracts/file-paths.md`

**Content Script Build Contract**:
```typescript
// Vite Configuration Contract
interface ViteBuildContract {
  input: {
    content: 'src/content/content-script.ts'
  }
  output: {
    entryFileNames: '[name].js'  // 'content' → 'content.js'
  }
  outDir: 'dist'
}

// Manifest Contract
interface ManifestContract {
  content_scripts: [{
    js: ['content.js']  // Must match Vite output
  }]
}

// Code Reference Contract
interface CodeReferenceContract {
  // DOMTool.ensureContentScriptInjected()
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['/content.js']  // Must match manifest
  })
}
```

**Invariants**:
1. Vite output filename MUST match manifest content_scripts.js reference
2. chrome.scripting.executeScript files parameter MUST match manifest reference
3. File paths are relative to extension root (where manifest.json is)
4. File extension is always `.js` (even for `.ts` sources)

#### Contract 2: Tool Definition Transformation

**File**: `contracts/tool-definitions.md`

**Tool Definition Contract**:
```typescript
// Internal Tool Definition (BaseTool.createToolDefinition)
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: JsonSchema
  }
}

// Responses API Format (OpenAIResponsesClient.createToolsJsonForResponsesApi)
interface ResponsesApiTool {
  type: 'function'
  name: string              // Flattened from function.name
  description: string       // Flattened from function.description
  parameters: JsonSchema    // Flattened from function.parameters
}
```

**Transformation Rules**:
1. Extract `function.name` → `name`
2. Extract `function.description` → `description`
3. Extract `function.parameters` → `parameters`
4. Preserve `type: 'function'`
5. Discard nested `function` wrapper

### Integration Tests

#### Test 1: Content Script Injection Success
```typescript
// tests/integration/dom-tool-injection.test.ts
describe('DOMTool Content Script Injection', () => {
  it('should successfully inject content script into active tab', async () => {
    // Given: Extension is loaded with correct file paths
    const domTool = new DOMTool()
    const mockTab = { id: 123, url: 'https://example.com' }

    // When: DOMTool attempts to inject content script
    await domTool.ensureContentScriptInjected(mockTab.id)

    // Then: chrome.scripting.executeScript called with correct file path
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 123 },
      files: ['/content.js']  // Not '/content/content-script.js'
    })

    // And: Content script responds to PING
    const response = await chrome.tabs.sendMessage(mockTab.id, { type: 'PING' })
    expect(response.type).toBe('PONG')
  })
})
```

#### Test 2: Error Message Clarity
```typescript
describe('DOMTool Error Handling', () => {
  it('should distinguish file not found from permission errors', async () => {
    // Given: chrome.scripting.executeScript fails with file not found
    chrome.scripting.executeScript.mockRejectedValue(
      new Error('Could not load file: \'/wrong-path.js\'')
    )

    // When: DOMTool attempts injection
    const error = await domTool.ensureContentScriptInjected(123).catch(e => e)

    // Then: Error message indicates file path issue
    expect(error.message).toContain('Failed to inject content script')
    expect(error.domError.code).toBe(ErrorCode.SCRIPT_INJECTION_FAILED)
  })
})
```

#### Test 3: Tool Definition Transformation
```typescript
describe('OpenAIResponsesClient Tool Definitions', () => {
  it('should transform tool definitions to flat Responses API format', () => {
    // Given: Internal tool definition with nested structure
    const toolDef = {
      type: 'function',
      function: {
        name: 'browser_dom',
        description: 'Interact with DOM elements',
        parameters: { type: 'object', properties: { action: {} } }
      }
    }

    // When: createToolsJsonForResponsesApi transforms definition
    const client = new OpenAIResponsesClient(config)
    const result = client.createToolsJsonForResponsesApi([toolDef])

    // Then: Output is flat structure
    expect(result[0]).toEqual({
      type: 'function',
      name: 'browser_dom',
      description: 'Interact with DOM elements',
      parameters: { type: 'object', properties: { action: {} } }
    })
    expect(result[0]).not.toHaveProperty('function')
  })
})
```

### Quickstart Scenario

**File**: `quickstart.md`

**Scenario**: Verify content script injection works for DOM operations

```markdown
# Quickstart: DOMTool Content Script Injection Fix

## Objective
Verify that content scripts inject correctly and DOM operations work end-to-end.

## Prerequisites
- Chrome browser (or Chromium-based)
- Extension built and loaded (`npm run build`, load `dist/` in chrome://extensions)

## Steps

### 1. Build the extension
\`\`\`bash
cd codex-chrome
npm run build
\`\`\`

**Expected Output**:
- `dist/content.js` exists
- `dist/manifest.json` references `content.js` in content_scripts

### 2. Load extension in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `codex-chrome/dist/` directory
5. Note the extension ID

### 3. Open test page
1. Navigate to `https://example.com`
2. Open extension side panel

### 4. Test DOM operation
In the side panel, send message:
```
user: Extract the page title using the DOM tool
```

**Expected Behavior**:
1. Extension injects `content.js` into example.com ✅
2. Content script responds to PING message ✅
3. DOM tool executes getText action successfully ✅
4. Agent responds with "Example Domain" (or similar) ✅

**Success Criteria**:
- No "Could not load file" errors
- No "Failed to inject content script" errors
- DOM tool returns page title

### 5. Verify in DevTools Console
Open background service worker console:
1. Go to chrome://extensions/
2. Click "service worker" under Codex extension
3. Check for successful injection logs:
   ```
   [DOMTool] Content script injected into tab 123
   [DOMTool] Content script already loaded in tab 123 (attempt 1)
   ```

### 6. Test error handling
Modify `DOMTool.ts` line 944 to use wrong path temporarily:
```typescript
files: ['/wrong-path.js']  // Intentional error
```

Rebuild and reload extension. Try DOM operation again.

**Expected Error**:
```
Error: Failed to inject content script: Error: Could not load file: '/wrong-path.js'
Error Code: SCRIPT_INJECTION_FAILED
```

Revert change, rebuild, verify it works again.

## Cleanup
```bash
# Remove test changes
git checkout codex-chrome/src/tools/DOMTool.ts
npm run build
```

## Troubleshooting

**Issue**: "Could not load file: 'content.js'"
- Check: Does `dist/content.js` exist?
- Check: Does `dist/manifest.json` reference `content.js`?
- Solution: Run `npm run build` again

**Issue**: "Content script failed to respond"
- Check: Is the tab URL allowed? (must match <all_urls> permission)
- Check: Did content script throw an error? (Check page console)
- Solution: Check browser console for CSP violations

**Issue**: Tool definition errors
- Check: OpenAIResponsesClient.createToolsJsonForResponsesApi() output format
- Check: Tool definitions don't have nested `function` property
- Solution: Verify transformation logic matches Responses API spec
```

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base
2. Generate tasks from identified root cause and contracts:
   - **Research tasks** (P0): Verify build output structure, manifest references
   - **Fix tasks** (P1): Update DOMTool.ts file path, verify tool definitions
   - **Test tasks** (P2): Create integration tests, update unit tests
   - **Validation tasks** (P3): Run quickstart scenario, verify error handling

**Ordering Strategy**:
- **Phase 0** (Research/Verification): Tasks 1-3
  - Verify current state (build output, manifest, error reproduction)
  - Can run in parallel [P]
- **Phase 1** (Fix Implementation): Tasks 4-6
  - Update file path in DOMTool.ts
  - Verify tool definition transformation
  - Sequential dependencies
- **Phase 2** (Testing): Tasks 7-10
  - Create integration tests (can run parallel [P] with different test files)
  - Update unit tests
  - Tests fail initially (TDD)
- **Phase 3** (Validation): Tasks 11-13
  - Run tests (verify they pass)
  - Execute quickstart scenario
  - Validate error messages

**Estimated Output**: 13-15 numbered tasks in tasks.md

**Task Structure Example**:
```
1. [P] Verify vite.config.mjs build output mapping
   - Check: entryFileNames pattern
   - Check: content input → output mapping
   - Expected: content → content.js

2. [P] Verify manifest.json content script reference
   - Check: content_scripts.js array
   - Expected: ['content.js']

3. [P] Reproduce injection error with current code
   - Run: Extension with current DOMTool.ts
   - Expected: "Could not load file: '/content/content-script.js'"

4. Update DOMTool.ts content script file path
   - File: codex-chrome/src/tools/DOMTool.ts:944
   - Change: '/content/content-script.js' → '/content.js'
   - Depends on: Tasks 1-3

5. [P] Verify tool definition transformation
   - Review: OpenAIResponsesClient.createToolsJsonForResponsesApi()
   - Expected: Flat structure (no nested 'function' key)

...
```

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD)
**Phase 5**: Validation (run tests, execute quickstart.md, verify DOM operations work)

## Complexity Tracking
*No constitutional violations - this is a straightforward bug fix*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

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
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (N/A - no deviations)

---
*Based on Constitution v2.1.1 (template) - See `.specify/memory/constitution.md`*
