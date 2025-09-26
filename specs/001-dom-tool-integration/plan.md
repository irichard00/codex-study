
# Implementation Plan: DOM Tool Integration for Chrome Extension Agent

**Branch**: `001-dom-tool-integration` | **Date**: 2025-09-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-dom-tool-integration/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Integrate and refactor a DOM manipulation tool for a Chrome Extension-based browser agent. The tool needs to provide comprehensive DOM interaction capabilities including element querying, clicking, typing, attribute manipulation, and advanced features like accessibility tree generation and paint order handling. The implementation involves verifying the completeness of a Python-to-TypeScript conversion and integrating the new DOM service into the existing DOMTool interface.

## Technical Context
**Language/Version**: TypeScript 5.x (Chrome Extension Manifest V3)
**Primary Dependencies**: Chrome Extension APIs, Chrome DevTools Protocol, Content Script Communication
**Storage**: N/A (stateless DOM operations)
**Testing**: Jest/Vitest for unit tests, Chrome Extension testing framework
**Target Platform**: Chrome Browser (Chromium-based browsers)
**Project Type**: single (Chrome Extension)
**Performance Goals**: Sub-100ms DOM query response time, batch operations support
**Constraints**: Browser security model (cross-origin restrictions), content script injection limits
**Scale/Scope**: ~25 core DOM operations, support for frames/iframes, accessibility tree generation

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution is not yet defined (template only), proceeding with general best practices:
- ✅ Modular design - DOM service separated from tool interface
- ✅ Testable architecture - Clear separation of concerns
- ✅ Error handling - Comprehensive error reporting
- ✅ Performance considerations - Batch operations, efficient querying

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   └── tools/
│       ├── dom/                    # New DOM service library (from Python conversion)
│       │   ├── index.ts            # Main exports
│       │   ├── service.ts          # DomService class
│       │   ├── views.ts            # Type definitions and interfaces
│       │   ├── utils.ts            # Utility functions
│       │   ├── enhancedDOMTreeNode.ts
│       │   ├── enhancedSnapshot.ts
│       │   ├── serializer/
│       │   │   ├── serializer.ts
│       │   │   ├── clickableElements.ts
│       │   │   └── paintOrder.ts
│       │   └── chrome/             # Chrome-specific implementations
│       │       ├── domCapture.ts
│       │       ├── accessibilityTree.ts
│       │       ├── contentScript.ts
│       │       └── frameUtils.ts
│       ├── DOMTool.ts             # Existing tool interface (to be refactored)
│       └── BaseTool.ts            # Base tool class
├── content/
│   └── content-script.js          # Content script for DOM operations
└── tests/
    ├── unit/
    │   └── tools/
    │       └── dom/
    └── integration/
        └── dom-operations/
```

**Structure Decision**: Single Chrome Extension project with modular tool architecture. The DOM service is implemented as a self-contained library within the tools directory, maintaining separation between the service layer (dom/) and the tool interface layer (DOMTool.ts).

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Analysis tasks: Compare Python vs TypeScript implementations
- Test tasks: Create unit and integration tests for each operation
- Implementation tasks: Refactor DOMTool to use new service

**Specific Task Categories**:
1. **Verification Tasks** (5-6 tasks)
   - Compare dom_python vs dom TypeScript feature parity
   - Verify all 25 operations are implemented
   - Check Chrome API usage consistency

2. **Test Creation Tasks** (8-10 tasks) [P]
   - Unit tests for DOM service methods
   - Integration tests for Chrome message passing
   - Contract tests for API compliance
   - End-to-end tests for user scenarios

3. **Refactoring Tasks** (6-8 tasks)
   - Extract common interfaces
   - Migrate DOMTool methods to use DomService
   - Update content script communication
   - Implement error handling improvements

4. **Documentation Tasks** (2-3 tasks) [P]
   - API migration guide
   - Performance benchmarks
   - Troubleshooting guide

**Ordering Strategy**:
- Verification first (understand current state)
- Tests before implementation (TDD)
- Refactor in small increments
- Documentation parallel with implementation

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


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
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
