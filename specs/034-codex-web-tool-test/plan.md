
# Implementation Plan: Codex Web Tool Test Extension

**Branch**: `034-codex-web-tool-test` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/irichard/dev/study/codex-study/s2/codex-study/specs/034-codex-web-tool-test/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, AGENTS.md
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Create a standalone Chrome extension testing tool that allows developers to manually test individual browser tools from the ToolRegistry without running the full AI agent system. The test extension provides a side panel interface for browsing tools, inputting parameters, executing tools, and viewing results. This enables rapid development and debugging of browser tools in isolation.

## Technical Context
**Language/Version**: TypeScript 5.x (Chrome Extension Manifest V3)
**Primary Dependencies**: Chrome Extension APIs (side panel, scripting, storage), existing ToolRegistry from codex-chrome
**Storage**: Chrome storage.local for test state persistence
**Testing**: Manual E2E testing via the extension itself
**Target Platform**: Chrome browser (v114+) with Side Panel API support
**Project Type**: single - Standalone Chrome extension test tool
**Performance Goals**: Tool listing <100ms, execution response display <50ms
**Constraints**: Must not interfere with main codex-chrome extension, isolated build output
**Scale/Scope**: Development tool for ~8-10 registered browser tools
**Build System**: Separate Vite build configuration, output to codex-chrome/tests/tools/e2e/dist

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Simplicity**: Single-purpose test tool with minimal UI, reuses existing ToolRegistry
- [x] **Single Responsibility**: Only purpose is to test browser tools in isolation
- [x] **No Over-Engineering**: Simple HTML/CSS UI, direct tool execution without layers
- [x] **Clear Interfaces**: Uses existing ToolRegistry.execute() interface
- [x] **Testability**: Self-testing tool (developer can verify tool behavior directly)

## Project Structure

### Documentation (this feature)
```
specs/034-codex-web-tool-test/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/tests/tools/e2e/
├── manifest.json                # Chrome extension manifest for test tool
├── src/
│   ├── service-worker.ts        # Background service worker (tool registration)
│   ├── sidepanel/
│   │   ├── index.html           # Side panel HTML entry point
│   │   ├── main.ts              # Side panel application logic
│   │   ├── ToolList.ts          # Tool listing component
│   │   ├── ToolDetail.ts        # Tool detail/execution component
│   │   └── styles.css           # Minimal CSS styles
│   └── utils/
│       ├── messaging.ts         # Chrome messaging utilities
│       └── formatting.ts        # Result formatting utilities
├── vite.config.ts               # Vite build configuration for test tool
├── tsconfig.json                # TypeScript configuration
└── dist/                        # Build output (gitignored)
    ├── manifest.json
    ├── service-worker.js
    └── sidepanel/
        ├── index.html
        ├── main.js
        └── styles.css
```

**Structure Decision**: Single project structure for test extension. All test tool code lives under `codex-chrome/tests/tools/e2e/` to isolate it from the main extension. The test tool imports and reuses `ToolRegistry` and tool implementations from the main codebase via TypeScript imports.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - How to import ToolRegistry and tools from parent src/ in test tool
   - Side Panel API usage patterns and lifecycle
   - Vite build configuration for Chrome extension with separate output
   - Chrome extension manifest requirements for side panel
   - Message passing between service worker and side panel

2. **Generate and dispatch research agents**:
   ```
   Task: "Research TypeScript module imports from parent directories in Vite builds"
   Task: "Find best practices for Chrome Side Panel API implementation"
   Task: "Research Vite build configuration for multiple entry points (service worker + side panel)"
   Task: "Find patterns for Chrome extension message passing between service worker and side panel"
   Task: "Research minimal CSS patterns for Chrome extension UI"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - ToolListItem (name, description, type)
   - ToolDetailView (definition, parameters, example request)
   - ExecutionRequest (toolName, parameters, sessionId, turnId)
   - ExecutionResult (success, data/error, duration)
   - ViewState (currentView, selectedTool)

2. **Generate API contracts** from functional requirements:
   - Message contracts between side panel and service worker
   - Service worker messages: GET_TOOLS, EXECUTE_TOOL
   - Side panel messages: TOOLS_RESPONSE, EXECUTION_RESPONSE
   - Output message schemas to `/contracts/messages.md`

3. **Extract test scenarios** from user stories:
   - Manual testing scenarios in quickstart.md
   - Each acceptance scenario → test steps
   - Quickstart validates all core functionality

4. **Update agent file incrementally** (O(1) operation):
   - Update AGENTS.md with test tool context
   - Add technologies: Chrome Side Panel API, Manual E2E Testing
   - Keep existing entries, add new feature entry
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/messages.md, quickstart.md, AGENTS.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (data model, contracts, quickstart)
- Infrastructure tasks:
  - Create test tool directory structure [P]
  - Create manifest.json with side panel configuration [P]
  - Create vite.config.ts for test tool build [P]
  - Create tsconfig.json for test tool [P]
  - Add npm script "build:testtool" to package.json
- Service worker tasks:
  - Create service-worker.ts with tool registration
  - Import and initialize ToolRegistry
  - Implement message handlers for GET_TOOLS and EXECUTE_TOOL
- Side panel UI tasks:
  - Create index.html structure [P]
  - Create minimal styles.css [P]
  - Create main.ts application controller
  - Create ToolList component for tool browsing
  - Create ToolDetail component for tool execution
  - Implement view routing/navigation
  - Implement parameter input form generation
  - Implement result formatting and display
- Utility tasks:
  - Create messaging utilities for Chrome runtime messaging [P]
  - Create formatting utilities for JSON display [P]
- Testing and validation tasks:
  - Create quickstart.md test scenarios
  - Manual testing of tool listing
  - Manual testing of tool execution
  - Manual testing of error handling
  - Build verification (separate dist output)

**Ordering Strategy**:
- Infrastructure first (manifest, configs, build setup)
- Service worker next (tool registration, message handling)
- UI components in dependency order:
  1. Basic HTML structure and styles [P]
  2. Utilities (messaging, formatting) [P]
  3. Main application controller
  4. ToolList component
  5. ToolDetail component
  6. View navigation logic
- Testing last (manual validation via quickstart)
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md
- ~5 tasks for infrastructure and build setup
- ~4 tasks for service worker implementation
- ~12 tasks for side panel UI and components
- ~3 tasks for utilities
- ~5 tasks for testing and validation

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (manual testing via quickstart.md scenarios)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

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
- [x] All NEEDS CLARIFICATION resolved (none in spec)
- [x] Complexity deviations documented (none needed)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
