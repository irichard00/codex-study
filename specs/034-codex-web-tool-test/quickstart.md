# Quickstart Guide: Codex Web Tool Test Extension

**Feature**: 034-codex-web-tool-test
**Date**: 2025-10-10
**Prerequisites**: Chrome browser (v114+), Node.js 18+, pnpm

## Overview
This guide walks through building, installing, and using the Codex Web Tool Test extension to manually test browser tools.

## Build the Test Extension

### 1. Navigate to the codex-chrome directory
```bash
cd codex-chrome
```

### 2. Build the test tool
```bash
pnpm run build:testtool
```

**Expected output**:
```
> codex-chrome@1.0.0 build:testtool
> vite build --config tests/tools/e2e/vite.config.ts

vite v5.4.20 building for production...
✓ Built in 1.23s
✓ Service worker built successfully
✓ Side panel built successfully

Output: codex-chrome/tests/tools/e2e/dist/
  - manifest.json
  - service-worker.js
  - sidepanel/index.html
  - sidepanel/main.js
  - sidepanel/styles.css
```

### 3. Verify build output
```bash
ls -la tests/tools/e2e/dist/
```

**Expected files**:
- `manifest.json` - Extension manifest
- `service-worker.js` - Background service worker
- `sidepanel/` directory with HTML, JS, CSS

## Install the Extension

### 1. Open Chrome Extensions page
Navigate to `chrome://extensions` or click the puzzle icon → "Manage Extensions"

### 2. Enable Developer Mode
Toggle "Developer mode" switch in the top-right corner

### 3. Load unpacked extension
1. Click "Load unpacked" button
2. Navigate to `codex-chrome/tests/tools/e2e/dist/`
3. Click "Select Folder"

**Expected result**:
- Extension appears in extensions list
- Name: "Codex Web Tool Test"
- No errors in the card

### 4. Pin the extension (optional)
Click the puzzle icon → Pin "Codex Web Tool Test" for easy access

## Test Scenario 1: View Available Tools

**Goal**: Verify tool listing loads correctly

### Steps:
1. Click the "Codex Web Tool Test" extension icon in the toolbar
2. Side panel opens showing the test interface
3. Observe the tool list

**Expected Results**:
- ✅ Side panel opens without errors
- ✅ Tool list displays all registered tools (8-10 tools)
- ✅ Each tool shows:
  - Tool name (e.g., "dom_snapshot", "navigate", "web_scraping")
  - Description text
  - Tool type indicator
- ✅ Tools are sorted alphabetically by name
- ✅ List is scrollable if more than ~10 tools

**Acceptance Criteria** (from spec):
- FR-001: System displays list of all registered tools on initial load ✓
- FR-002: Shows tool name and description for each tool ✓

**Troubleshooting**:
- If "No tools available" appears → Check service worker console for registration errors
- If side panel blank → Check for JavaScript errors in DevTools

## Test Scenario 2: View Tool Details

**Goal**: Verify tool detail view shows correct information

### Steps:
1. From the tool list, click on "navigate" tool
2. Observe the tool detail page

**Expected Results**:
- ✅ View changes to tool detail page
- ✅ Tool name displayed as heading
- ✅ Tool description shown
- ✅ Parameter requirements section shows:
  - Parameter name: "url"
  - Parameter type: "string"
  - Required: Yes
- ✅ Example request section shows JSON example:
  ```json
  {
    "toolName": "navigate",
    "parameters": {
      "url": "https://example.com"
    },
    "sessionId": "test-session",
    "turnId": "test-turn-1"
  }
  ```
- ✅ Input form displays with text field for "url" parameter
- ✅ "Execute" button present
- ✅ "← Back to Tools" link/button present

**Acceptance Criteria** (from spec):
- FR-003: Users can select a tool to view details ✓
- FR-004: Displays tool parameter schema/requirements ✓
- FR-005: Provides example ToolExecutionRequest ✓
- FR-011: Navigation back to tool list available ✓

## Test Scenario 3: Execute Tool Successfully

**Goal**: Verify tool execution with valid parameters

### Steps:
1. On the "navigate" tool detail page
2. In the "url" parameter field, enter: `https://example.com`
3. Click the "Execute" button
4. Wait for execution to complete

**Expected Results**:
- ✅ "Execute" button shows loading state (e.g., "Executing...")
- ✅ Within 1-3 seconds, result appears
- ✅ Success indicator shown (green background or checkmark)
- ✅ Execution duration displayed (e.g., "Completed in 234ms")
- ✅ Result data shown as formatted JSON:
  ```json
  {
    "url": "https://example.com",
    "title": "Example Domain",
    "loaded": true
  }
  ```
- ✅ JSON is syntax-highlighted (strings in green, keys in blue, etc.)

**Acceptance Criteria** (from spec):
- FR-006: Users can input values for tool parameters ✓
- FR-007: "Execute" button triggers tool execution ✓
- FR-008: Composes valid ToolExecutionRequest ✓
- FR-009: Displays execution results with success status ✓

## Test Scenario 4: Handle Tool Execution Errors

**Goal**: Verify error handling and display

### Steps:
1. On the "navigate" tool detail page
2. Clear the "url" parameter field (leave it empty)
3. Click "Execute"
4. Observe error handling

**Expected Results**:
- ✅ Error message displayed (red background)
- ✅ Error code shown: "VALIDATION_ERROR"
- ✅ Error message shown: "Parameter validation failed"
- ✅ Error details shown:
  ```json
  [
    {
      "parameter": "url",
      "message": "Required parameter missing",
      "code": "REQUIRED"
    }
  ]
  ```
- ✅ No crash or blank screen
- ✅ Form remains editable for retry

**Acceptance Criteria** (from spec):
- FR-010: Displays error information when execution fails ✓
- Edge case: Handle validation errors ✓

## Test Scenario 5: Test Complex Parameters

**Goal**: Verify complex parameter input handling

### Steps:
1. Navigate back to tool list (click "← Back to Tools")
2. Select "dom_snapshot" tool (or another tool with complex parameters)
3. Observe parameter input form

**Expected Results**:
- ✅ For simple parameters (boolean, number, string): Individual input fields shown
- ✅ For complex nested parameters: JSON textarea shown with placeholder
- ✅ Placeholder shows example JSON structure
- ✅ Can input valid JSON manually
- ✅ Invalid JSON shows validation error before execution

**Acceptance Criteria** (from spec):
- Edge case: Complex nested parameters use JSON textarea ✓

## Test Scenario 6: Navigation Flow

**Goal**: Verify navigation between views works correctly

### Steps:
1. Start on tool list view
2. Click a tool → verify detail view loads
3. Click "← Back to Tools" → verify returns to list
4. Select a different tool → verify new detail view loads
5. Click "← Back to Tools" → verify returns to list again

**Expected Results**:
- ✅ Navigation is smooth, no flashing or reloading
- ✅ Previous execution results are cleared when selecting new tool
- ✅ Tool list state preserved when navigating back
- ✅ No "back button" browser history navigation needed

**Acceptance Criteria** (from spec):
- FR-011: Navigation back to tool list works ✓

## Test Scenario 7: Large Result Display

**Goal**: Verify large data payloads are handled properly

### Steps:
1. Select "web_scraping" or "dom_snapshot" tool
2. Execute with parameters that will return large result (e.g., full page DOM)
3. Observe result display

**Expected Results**:
- ✅ Large JSON result displays without crashing
- ✅ Scrollable result pane
- ✅ Syntax highlighting still works
- ✅ UI remains responsive
- ✅ Optional: Expand/collapse sections for nested objects

**Acceptance Criteria** (from spec):
- Edge case: Large data payloads displayed properly ✓

## Test Scenario 8: No Tools Available

**Goal**: Verify graceful handling when no tools registered

### Steps:
1. Modify service worker to comment out tool registration (for testing only)
2. Reload extension
3. Open side panel

**Expected Results**:
- ✅ Message displayed: "No tools available"
- ✅ No error thrown
- ✅ UI remains functional

**Acceptance Criteria** (from spec):
- Edge case: No tools registered handled gracefully ✓

**Note**: Revert service worker changes after test

## Build Verification

### Verify isolated build output:
```bash
# Build output should ONLY be in test tool directory
ls -la codex-chrome/tests/tools/e2e/dist/

# Should NOT affect main extension build
ls -la codex-chrome/dist/  # Should not exist or be unchanged
```

**Expected**:
- ✅ Test tool dist exists at `tests/tools/e2e/dist/`
- ✅ Main extension dist not affected
- ✅ Test tool size <100KB total

**Acceptance Criteria** (from spec):
- FR-012: Test extension code isolated from main app ✓
- FR-014: Separate build process with dedicated output ✓

### Verify minimal CSS:
```bash
# Check CSS file size
ls -lh codex-chrome/tests/tools/e2e/dist/sidepanel/styles.css
```

**Expected**:
- ✅ CSS file size <5KB
- ✅ No external CSS dependencies loaded

**Acceptance Criteria** (from spec):
- FR-015: Minimal CSS styling ✓

## Build Script Verification

### Verify npm script exists:
```bash
cd codex-chrome
pnpm run build:testtool
```

**Expected**:
- ✅ Command executes without errors
- ✅ Output directory created/updated
- ✅ All files bundled correctly

**Acceptance Criteria** (from spec):
- FR-014: npm run command "build:testtool" available ✓

## Performance Validation

### Tool listing performance:
1. Open DevTools → Performance tab
2. Start recording
3. Click extension icon to open side panel
4. Stop recording when list appears

**Expected**:
- ✅ Tool list appears within 100ms
- ✅ No blocking operations >50ms

### Tool execution responsiveness:
1. Execute a fast tool (e.g., navigate)
2. Observe response time

**Expected**:
- ✅ Simple tools complete within 500ms
- ✅ UI shows loading state immediately
- ✅ Result displays within 50ms of receiving response

## Troubleshooting Guide

### Extension won't load
- Check Chrome version (need v114+ for Side Panel API)
- Check dist/ folder exists and contains all files
- Check manifest.json is valid JSON

### Side panel is blank
- Open DevTools for side panel: Right-click in side panel → "Inspect"
- Check console for JavaScript errors
- Verify service-worker.js loaded: chrome://extensions → "Service worker" link

### No tools appear in list
- Check service worker console: chrome://extensions → "Service worker" → "Inspect"
- Verify ToolRegistry initialization messages
- Check for import errors (path alias issues)

### Tool execution fails
- Check service worker console for errors
- Verify tool is registered: Check service worker logs
- Verify parameters match schema exactly

### Build fails
- Run `pnpm install` to ensure dependencies installed
- Check vite.config.ts for syntax errors
- Verify TypeScript compilation: `pnpm run type-check`

## Success Criteria Summary

All functional requirements validated:
- ✅ FR-001 through FR-015 tested
- ✅ All acceptance scenarios pass
- ✅ All edge cases handled
- ✅ Build process works independently
- ✅ Performance meets targets

## Next Steps

After validation:
1. Use test tool during browser tool development
2. Test new tools before integrating with main agent
3. Debug tool parameter schemas
4. Verify tool error handling

## Development Workflow

**Typical usage**:
```bash
# Develop new browser tool in codex-chrome/src/tools/
# Test it immediately:
cd codex-chrome
pnpm run build:testtool
# Reload extension in chrome://extensions
# Open side panel and test the new tool
```

This enables rapid iteration without running the full AI agent system.
