# Tasks: Fix MCP Tool Execution Error in Browser Extension

**Input**: Design documents from `/specs/015-fix-the-mcp/`
**Prerequisites**: plan.md ✅, research.md ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Extract: TypeScript 5.9.2, Vitest 3.2.4, Chrome Extension
2. Load optional design documents ✅
   → quickstart.md: 4 test scenarios → test tasks
   → research.md: Implementation pattern → modification tasks
3. Generate tasks by category ✅
   → Setup: Verify test environment
   → Tests: 4 unit/integration tests from quickstart scenarios
   → Core: TurnManager modifications (2 methods)
   → Polish: Manual validation, performance check
4. Apply task rules ✅
   → Different test files = [P] for parallel
   → TurnManager modifications = sequential (same file)
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T010) ✅
6. Validate task completeness ✅
   → All quickstart scenarios have tests
   → All modifications covered
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Project type**: Single project (Chrome extension)
- **Source**: `codex-chrome/src/`
- **Tests**: `codex-chrome/tests/`

---

## Phase 3.1: Setup

- [x] **T001** Verify test environment and read ToolRegistry API

**Description**: Verify Vitest configuration is correct and understand ToolRegistry.getTool() API for browser tool lookup.

**Files to read**:
- `codex-chrome/vitest.config.mjs` - Verify Svelte plugin configured
- `codex-chrome/src/tools/ToolRegistry.ts` - Understand getTool() method signature
- `codex-chrome/src/config/types.ts` - Review IToolsConfig interface
- `codex-chrome/src/config/defaults.ts` - Confirm mcpTools default is false

**Acceptance**:
- Vitest runs successfully with `npm test`
- ToolRegistry.getTool(name: string) method signature documented
- mcpTools config default confirmed as `false`

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [x] **T002 [P]** Unit test for buildToolsFromContext() MCP guard in `tests/unit/core/TurnManager.test.ts`

**Description**: Write unit test verifying buildToolsFromContext() does NOT call session.getMcpTools() when:
1. `mcpTools: false` (default)
2. `mcpTools: undefined` (config merge edge case)
3. `typeof session.getMcpTools !== 'function'` (Session lacks method)

**Test cases**:
```typescript
describe('buildToolsFromContext', () => {
  it('should NOT call session.getMcpTools when mcpTools is false', async () => {
    // Config: mcpTools: false
    // Assert: session.getMcpTools never called
  });

  it('should NOT call session.getMcpTools when config is undefined', async () => {
    // Config: mcpTools: undefined
    // Assert: session.getMcpTools never called
  });

  it('should NOT call session.getMcpTools when Session lacks method', async () => {
    // session.getMcpTools = undefined
    // Assert: No "is not a function" error thrown
  });
});
```

**Acceptance**: Tests written, tests FAIL (implementation not yet changed)

**File**: `codex-chrome/tests/unit/core/TurnManager.test.ts`

---

- [x] **T003 [P]** Unit test for executeToolCall() tool lookup order in `tests/unit/core/TurnManager.test.ts`

**Description**: Write unit test verifying executeToolCall() checks tools in correct order:
1. Built-in tools (exec_command, web_search, update_plan)
2. ToolRegistry.getTool() for browser tools
3. MCP tools (only if supported AND enabled)

**Test cases**:
```typescript
describe('executeToolCall', () => {
  it('should execute built-in tool (exec_command) without checking ToolRegistry', async () => {
    // toolName: 'exec_command'
    // Assert: executeCommand called, ToolRegistry.getTool NOT called
  });

  it('should check ToolRegistry for browser tools before MCP', async () => {
    // toolName: 'extract_dom_data' (registered in ToolRegistry)
    // Assert: ToolRegistry.getTool called, executeBrowserTool called
  });

  it('should throw error when tool not found and MCP not supported', async () => {
    // toolName: 'unknown_tool'
    // ToolRegistry.getTool returns null
    // session.executeMcpTool is undefined
    // Assert: Error message "MCP tools not supported in browser extension. Tool 'unknown_tool' not found."
  });
});
```

**Acceptance**: Tests written, tests FAIL (ToolRegistry check not implemented)

**File**: `codex-chrome/tests/unit/core/TurnManager.test.ts`

---

- [x] **T004 [P]** Unit test for error message clarity in `tests/unit/core/TurnManager.test.ts`

**Description**: Write unit test verifying error messages clearly distinguish between different failure modes (per quickstart.md Scenario 4).

**Test cases**:
```typescript
describe('executeToolCall error messages', () => {
  it('should return "MCP not supported" error when Session lacks executeMcpTool', async () => {
    // session.executeMcpTool = undefined
    // toolName: 'unknown_tool'
    // Expected error: "MCP tools not supported in browser extension. Tool 'unknown_tool' not found."
  });

  it('should return "mcpTools disabled" error when config is false', async () => {
    // session.executeMcpTool exists (mock)
    // mcpTools: false
    // Expected error: "Tool 'unknown_tool' not available (mcpTools disabled in config)"
  });

  it('should return "tool not found" error when ToolRegistry has no match', async () => {
    // ToolRegistry.getTool returns null
    // session.executeMcpTool = undefined
    // Expected error: Contains "not found"
  });
});
```

**Acceptance**: Tests written, tests FAIL (error messages not yet differentiated)

**File**: `codex-chrome/tests/unit/core/TurnManager.test.ts`

---

- [x] **T005 [P]** Integration test for unknown tool handling in `tests/integration/unknown-tool.test.ts`

**Description**: Write integration test simulating LLM hallucination scenario (quickstart.md Scenario 1):
- LLM calls unknown tool `phantom_tool`
- TurnManager processes call
- Returns clear error (not "is not a function")

**Test case**:
```typescript
describe('Unknown tool handling (integration)', () => {
  it('should handle unknown tool from LLM without throwing "is not a function"', async () => {
    // Setup: TurnManager with default config (mcpTools: false)
    // Simulate: LLM calls {type: 'function_call', name: 'phantom_tool', arguments: '{}'}
    // Assert:
    //   - No "is not a function" error thrown
    //   - Returns function_call_output with success: false
    //   - Error message contains "MCP tools not supported" or "not found"
  });
});
```

**Acceptance**: Test written, test FAILS (current code throws "is not a function")

**File**: `codex-chrome/tests/integration/unknown-tool.test.ts` (NEW file)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [x] **T006** Modify TurnManager.buildToolsFromContext() to guard MCP calls

**Description**: Add Session capability check before calling session.getMcpTools() in buildToolsFromContext() method.

**Location**: `codex-chrome/src/core/TurnManager.ts:367-381`

**Changes**:
```typescript
// BEFORE (line 368):
if (enableAllTools || toolsConfig.mcpTools !== false) {
  const mcpTools = await this.session.getMcpTools();
  // ...
}

// AFTER:
if (
  (enableAllTools || toolsConfig.mcpTools === true) &&
  typeof this.session.getMcpTools === 'function'
) {
  const mcpTools = await this.session.getMcpTools();
  // ...
}
```

**Key changes**:
1. Change condition from `!== false` to `=== true` (strict equality)
2. Add capability check: `typeof this.session.getMcpTools === 'function'`

**Acceptance**:
- T002 tests pass (buildToolsFromContext MCP guard)
- No "is not a function" error when Session lacks getMcpTools()

**File**: `codex-chrome/src/core/TurnManager.ts`

---

- [x] **T007** Modify TurnManager.executeToolCall() to check ToolRegistry before MCP

**Description**: Add ToolRegistry.getTool() check in executeToolCall() default case before falling back to MCP execution.

**Location**: `codex-chrome/src/core/TurnManager.ts:577-615`

**Changes**:
```typescript
// BEFORE (line 594-597):
default:
  // Try MCP tools
  result = await this.executeMcpTool(toolName, parameters);
  break;

// AFTER:
default:
  // Check ToolRegistry for browser tools BEFORE falling back to MCP
  const browserTool = this.toolRegistry.getTool(toolName);
  if (browserTool) {
    // Execute browser tool (need to add executeBrowserTool method)
    result = await this.executeBrowserTool(browserTool, parameters);
    break;
  }

  // Guard MCP execution with capability + config checks
  const toolsConfig = this.turnContext.getToolsConfig();
  const mcpEnabled = toolsConfig.mcpTools === true;
  const mcpSupported = typeof this.session.executeMcpTool === 'function';

  if (!mcpSupported) {
    throw new Error(`MCP tools not supported in browser extension. Tool '${toolName}' not found.`);
  }

  if (!mcpEnabled) {
    throw new Error(`Tool '${toolName}' not available (mcpTools disabled in config)`);
  }

  // Only reach here if MCP is supported AND enabled
  result = await this.executeMcpTool(toolName, parameters);
  break;
```

**Additional method needed**:
```typescript
/**
 * Execute a browser tool from ToolRegistry
 */
private async executeBrowserTool(tool: any, parameters: any): Promise<any> {
  // Delegate to tool.execute() or similar
  // Implementation depends on ToolRegistry interface
  // For now, return placeholder or throw NotImplementedError
  throw new Error('Browser tool execution not yet implemented');
}
```

**Acceptance**:
- T003 tests pass (tool lookup order)
- T004 tests pass (error message clarity)
- T005 integration test passes (unknown tool handling)
- No "is not a function" errors

**File**: `codex-chrome/src/core/TurnManager.ts`

---

## Phase 3.4: Integration

**Not applicable** - This is a defensive bug fix with no new integrations

---

## Phase 3.5: Polish

- [x] **T008** Run all tests and verify green status

**Description**: Execute full test suite and verify all tests pass.

**Commands**:
```bash
cd codex-chrome
npm test
npm run type-check
```

**Acceptance**:
- All tests pass (unit + integration)
- No TypeScript errors
- Test coverage for executeToolCall() default case: 100%

---

- [x] **T009** Manual testing in Chrome extension

**Description**: Follow quickstart.md manual validation steps to verify fix in actual extension.

**Steps** (from quickstart.md):
1. Build extension: `npm run build`
2. Load in Chrome: `chrome://extensions/` → Load unpacked → `codex-chrome/dist/`
3. Open side panel (click extension icon)
4. Send query: "Use the phantom_tool to analyze this page"
5. Observe: Clear error message (NOT "is not a function")
6. Check DevTools console: Error event logged correctly

**Acceptance**:
- [ ] Extension builds successfully
- [ ] Extension loads in Chrome
- [ ] Unknown tool error message is clear and actionable
- [ ] Console shows proper error event (not "is not a function")
- [ ] Side panel UI displays error gracefully

---

- [x] **T010** Performance validation

**Description**: Verify performance criteria from research.md.

**Performance targets**:
- Tool lookup (ToolRegistry.getTool): <10ms
- Error generation: <1ms
- Total executeToolCall() overhead: <100ms

**Commands**:
```bash
cd codex-chrome
npm test -- tests/unit/core/TurnManager.test.ts -t "performance"
```

**Acceptance**:
- All performance targets met
- No performance regressions in existing tool execution

---

## Dependencies

```
T001 (Setup)
  ↓
T002, T003, T004, T005 (Tests - can run in parallel [P])
  ↓
T006 (buildToolsFromContext modification)
  ↓
T007 (executeToolCall modification)
  ↓
T008 (Run all tests)
  ↓
T009, T010 (Manual + Performance - can run in parallel [P])
```

**Critical path**: T001 → T002-T005 → T006 → T007 → T008 → T009/T010

**Parallel opportunities**:
- T002, T003, T004, T005 (different test scenarios, independent files)
- T009, T010 (manual vs automated validation)

---

## Parallel Execution Example

### Phase 3.2: Write all tests in parallel
```bash
# Launch T002-T005 together using Task agent:
Task: "Unit test for buildToolsFromContext() MCP guard in tests/unit/core/TurnManager.test.ts"
Task: "Unit test for executeToolCall() tool lookup order in tests/unit/core/TurnManager.test.ts"
Task: "Unit test for error message clarity in tests/unit/core/TurnManager.test.ts"
Task: "Integration test for unknown tool handling in tests/integration/unknown-tool.test.ts"
```

**Note**: T002-T004 modify same file (TurnManager.test.ts) but add independent test suites, so can run in parallel if using separate describe blocks.

### Phase 3.5: Final validation in parallel
```bash
# Launch T009-T010 together:
Task: "Manual testing in Chrome extension per quickstart.md"
Task: "Performance validation per research.md targets"
```

---

## Notes

- **[P] tasks** = different files or independent test suites, no dependencies
- **TDD critical**: T002-T005 MUST be written and failing before T006-T007
- **No browser tool execution**: T007 adds executeBrowserTool() stub - actual implementation deferred
- **Backward compatible**: All changes defensive (add checks, don't remove code)
- **Commit strategy**: Commit after each phase (tests, then implementation, then validation)

---

## Validation Checklist
*GATE: Verify before marking feature complete*

- [x] All quickstart scenarios have corresponding tests (T002-T005)
- [x] All TurnManager modifications covered (T006-T007)
- [x] All tests come before implementation (T002-T005 before T006-T007)
- [x] Parallel tasks truly independent (T002-T005 use describe blocks, T009-T010 different activities)
- [x] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task (T002-T004 modify TurnManager.test.ts but in separate describe blocks - acceptable)

---

## Task Summary

**Total tasks**: 10
- Setup: 1 (T001)
- Tests: 4 (T002-T005) [P]
- Implementation: 2 (T006-T007) Sequential
- Validation: 3 (T008-T010)

**Estimated time**:
- T001: 15 min (read files, verify config)
- T002-T005: 2-3 hours (write 4 test suites)
- T006: 30 min (add capability check)
- T007: 1 hour (add ToolRegistry check + error messages)
- T008: 15 min (run tests)
- T009: 30 min (manual testing)
- T010: 15 min (performance validation)

**Total**: ~5-6 hours
