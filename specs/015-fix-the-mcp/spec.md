# Feature Specification: Fix MCP Tool Execution Error in Browser Extension

**Feature Branch**: `015-fix-the-mcp`
**Created**: 2025-10-06
**Status**: Draft
**Input**: User description: "Fix the mcp tool error: currently when the codex-chrome agent run as extension, when it uses the registered tool to finish command, somehow it gets error 'this.session.executeMcpTool is not a function', however, the codex-chrome is a browser based agent which currently is not supporting MCP. Help debug why LLM response interpret our tool into MCP and trigger the related mcp tool execution code, and fix the problem"

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
When a user interacts with the Codex Chrome extension and the agent tries to use browser tools (tab, DOM, storage operations), the extension should execute those tools successfully without attempting to call MCP (Model Context Protocol) tools, which are not supported in browser environments.

### Acceptance Scenarios

1. **Given** the Chrome extension is running with default tool configuration, **When** the LLM responds with a tool call that doesn't match built-in tools (exec_command, web_search, update_plan), **Then** the system should return a clear error message stating the tool is not available, not attempt to call executeMcpTool

2. **Given** the user has mcpTools disabled in configuration (default: false), **When** the agent processes a turn and builds the tools list, **Then** MCP tools should not be included in the tools sent to the LLM

3. **Given** the agent receives a tool call from the LLM for an unknown tool, **When** executeToolCall processes the tool, **Then** it should check the ToolRegistry for browser tools before falling back to MCP execution

4. **Given** the Session class doesn't implement MCP methods, **When** TurnManager tries to call session.executeMcpTool() or session.getMcpTools(), **Then** the system should either skip MCP execution gracefully or throw a meaningful error

### Edge Cases
- What happens when LLM hallucinates a tool name that doesn't exist in browser registry?
- How does system handle when mcpTools config is true but Session lacks MCP implementation?
- What if a browser tool registration fails - should it fall back to MCP attempt?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST NOT attempt to execute MCP tools when running in browser extension context
- **FR-002**: System MUST return clear error messages when unknown tools are called, indicating the tool is not available in browser context
- **FR-003**: System MUST NOT include MCP tools in the tools list sent to LLM when mcpTools config is false (default)
- **FR-004**: System MUST check ToolRegistry for browser tools before attempting MCP execution in the default case of executeToolCall
- **FR-005**: System MUST handle missing Session.executeMcpTool() and Session.getMcpTools() methods gracefully without throwing "is not a function" errors
- **FR-006**: System MUST log warnings when MCP-related code paths are reached in browser context
- **FR-007**: Error messages MUST distinguish between "tool not found" vs "MCP not supported in browser"

### Key Entities *(include if feature involves data)*

- **TurnManager**: Orchestrates turn execution, builds tools list, executes tool calls - currently calls session.getMcpTools() and session.executeMcpTool()
- **Session**: Manages conversation state - currently missing executeMcpTool() and getMcpTools() methods
- **ToolRegistry**: Contains registered browser tools (tab, DOM, storage operations)
- **IToolsConfig**: Configuration object with mcpTools boolean flag (default: false in browser extension)
- **Tool Call**: LLM response requesting tool execution with tool name and parameters

---

## Review & Acceptance Checklist

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

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---

## Root Cause Analysis

**Issue**: Runtime error "this.session.executeMcpTool is not a function" when unknown tools are called

**Findings**:

1. **TurnManager.ts line 369**: Calls `await this.session.getMcpTools()` when building tools list
2. **TurnManager.ts line 596**: Calls `await this.executeMcpTool(toolName, parameters)` in default case for unknown tools
3. **TurnManager.ts line 728**: Calls `await this.session.executeMcpTool(toolName, parameters)` inside executeMcpTool method
4. **Session.ts**: Does not implement getMcpTools() or executeMcpTool() methods
5. **defaults.ts line 71**: Default config has `mcpTools: false` - MCP is disabled by default
6. **TurnManager.ts line 368**: Condition `toolsConfig.mcpTools !== false` is correct for explicit false, but could be true if mcpTools is undefined

**Configuration Evidence**:
```typescript
// defaults.ts line 71
mcpTools: false,  // MCP disabled by default

// TurnManager.ts line 368
if (enableAllTools || toolsConfig.mcpTools !== false) {
  // When mcpTools: false → false !== false → false (won't execute) ✓
  // When mcpTools: true → true !== false → true (will execute) ✓
  // When mcpTools: undefined → undefined !== false → true (will execute) ✗
}
```

**Code Path Analysis**:

**Scenario A: mcpTools config is undefined** (possible if config merge fails):
1. User sends query → TurnManager.runTurn() → buildToolsFromContext()
2. Line 368: `undefined !== false` → true → calls session.getMcpTools()
3. Session doesn't have getMcpTools() → TypeError or returns undefined
4. If error handling continues, LLM may still respond with unknown tool call
5. executeToolCall() default case → calls this.executeMcpTool()
6. **Error**: "this.session.executeMcpTool is not a function"

**Scenario B: mcpTools is false but LLM hallucinates a tool** (more likely):
1. buildToolsFromContext() correctly skips MCP (false !== false → false)
2. LLM receives only browser tools but hallucinates/suggests a non-existent tool name
3. executeToolCall() receives unknown tool → default case (line 594-597)
4. Assumes unknown tool is MCP → calls executeMcpTool()
5. **Error**: "this.session.executeMcpTool is not a function"

**Why LLM triggers MCP path**:
- The default case in executeToolCall (line 594-597) assumes ANY unknown tool is an MCP tool
- There's no check for whether the tool exists in ToolRegistry before falling back to MCP
- There's no check for whether MCP is actually supported (i.e., Session has executeMcpTool method)
- There's no check for whether mcpTools config is enabled
