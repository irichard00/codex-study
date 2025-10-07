# Quickstart: Fix MCP Tool Execution Error

## Test Scenarios

### Scenario 1: Unknown Tool from LLM (Primary Bug Fix)

**Given**: Chrome extension running with default config (`mcpTools: false`)

**When**: LLM responds with unknown tool call `{"type": "function_call", "name": "unknown_tool", "arguments": "{}"}`

**Then**:
1. TurnManager.executeToolCall() receives `toolName: "unknown_tool"`
2. Checks built-in tools (exec_command, web_search, update_plan) → No match
3. **NEW**: Checks ToolRegistry.getTool("unknown_tool") → No match
4. **NEW**: Checks Session.executeMcpTool capability → function does not exist
5. Returns error: `"MCP tools not supported in browser extension. Tool 'unknown_tool' not found."`
6. NO "is not a function" error thrown

**Verification**:
```bash
cd codex-chrome
npm test -- tests/integration/unknown-tool.test.ts
```

Expected: Test passes, error message is clear and actionable

---

### Scenario 2: Browser Tool Execution (ToolRegistry)

**Given**: ToolRegistry has registered browser tool `"extract_dom_data"`

**When**: LLM calls `{"type": "function_call", "name": "extract_dom_data", "arguments": "{\"selector\": \".main\"}"}`

**Then**:
1. TurnManager.executeToolCall() receives `toolName: "extract_dom_data"`
2. Checks built-in tools → No match
3. **NEW**: Checks ToolRegistry.getTool("extract_dom_data") → Match found
4. **NEW**: Executes browser tool via `executeBrowserTool(browserTool, parameters)`
5. Returns successful function_call_output with DOM data

**Verification**:
```bash
cd codex-chrome
npm test -- tests/unit/core/TurnManager.test.ts -t "browser tool"
```

Expected: Browser tools execute successfully, bypassing MCP path entirely

---

### Scenario 3: MCP Config Check (buildToolsFromContext)

**Given**: Config has `mcpTools: undefined` (config merge edge case)

**When**: TurnManager.buildToolsFromContext() runs

**Then**:
1. Evaluates condition: `enableAllTools || toolsConfig.mcpTools === true`
2. **NEW**: `undefined === true` → `false` (previously was `undefined !== false` → `true`)
3. **NEW**: Additional check: `typeof this.session.getMcpTools === 'function'` → `false`
4. Skips MCP tools, NO "is not a function" error

**Verification**:
```bash
cd codex-chrome
npm test -- tests/unit/core/TurnManager.test.ts -t "buildToolsFromContext"
```

Expected: No MCP tools added when config is undefined or Session lacks methods

---

### Scenario 4: Error Message Clarity

**Given**: Three different failure modes

**When**: Unknown tools are called in different configurations

**Then**: Error messages distinguish between:
1. `"MCP tools not supported in browser extension. Tool 'foo' not found."` (Session.executeMcpTool missing)
2. `"Tool 'foo' not available (mcpTools disabled in config)"` (mcpTools: false)
3. `"Tool 'foo' not found in browser registry"` (optional: when ToolRegistry has no match)

**Verification**:
```bash
cd codex-chrome
npm test -- tests/unit/core/TurnManager.test.ts -t "error messages"
```

Expected: Each error message clearly indicates the root cause

---

## Quick Validation Checklist

After implementing the fix, verify:

- [ ] `npm test` passes (all unit + integration tests)
- [ ] `npm run build` succeeds
- [ ] Load extension in Chrome (`chrome://extensions/`)
- [ ] Open side panel, send query that triggers unknown tool
- [ ] Observe: Clear error message in UI (not "is not a function")
- [ ] Check console: Error event emitted with correct message
- [ ] Try browser tool (e.g., DOM extraction) → works correctly
- [ ] Verify: No TypeScript errors in `npm run type-check`

## Performance Validation

Run performance test:
```bash
cd codex-chrome
npm test -- tests/unit/core/TurnManager.test.ts -t "performance"
```

Expected:
- Tool lookup (ToolRegistry.getTool): <10ms
- Error generation: <1ms
- Total executeToolCall() overhead: <100ms

## Manual Test in Extension

1. Build extension: `cd codex-chrome && npm run build`
2. Load in Chrome: `chrome://extensions/` → Load unpacked → Select `codex-chrome/dist/`
3. Open side panel (click extension icon)
4. Send query: "Use the phantom_tool to analyze this page"
5. Observe: Clear error message (not "is not a function")
6. Check DevTools console: Error event logged correctly

## Rollback Plan

If issues arise:
1. Revert TurnManager.ts to previous version
2. Known limitation: Unknown tools will still cause "is not a function" error
3. No data loss or state corruption (stateless fix)

## Success Criteria

✅ Fix is successful when:
1. Zero "is not a function" errors in production
2. Error messages clearly distinguish between tool not found vs MCP not supported
3. Browser tools execute correctly (ToolRegistry path works)
4. Performance overhead <100ms per tool call
5. All tests pass
