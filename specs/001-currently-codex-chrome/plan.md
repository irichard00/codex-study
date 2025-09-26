
# Implementation Plan: Terminal-Style UI for Codex Chrome Extension

**Branch**: `001-currently-codex-chrome` | **Date**: 2025-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-currently-codex-chrome/spec.md`

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
Implement a terminal-style UI for the Codex Chrome extension's Svelte-based side panel, transforming the interface to have a black background with green default text, yellow for warnings, and red for errors. The implementation uses pure Tailwind CSS configuration for simplicity and maintainability, avoiding unnecessary dependencies while providing an authentic terminal appearance.

## Technical Context
**Language/Version**: TypeScript 5.x / Svelte 4.x
**Primary Dependencies**: Tailwind CSS v4, PostCSS, Svelte
**Storage**: N/A (presentation layer only)
**Testing**: Vitest
**Target Platform**: Chrome Extension (Manifest V3)
**Project Type**: Chrome Extension (frontend-only)
**Performance Goals**: < 100ms initial render, 60fps scrolling
**Constraints**: Keep code concise and simple, CSP-compliant, < 10KB CSS bundle impact
**Scale/Scope**: UI styling for single extension side panel

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Simplicity**: Pure CSS solution, no complex dependencies
- [x] **Maintainability**: Using existing Tailwind framework
- [x] **Performance**: Minimal CSS additions, leveraging utility classes
- [x] **Accessibility**: Maintaining WCAG contrast ratios
- [x] **No unnecessary complexity**: Avoiding CRT effects and animations per requirements

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
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->
```
codex-chrome/
├── src/
│   ├── sidepanel/
│   │   ├── components/
│   │   │   ├── TerminalContainer.svelte
│   │   │   ├── TerminalMessage.svelte
│   │   │   └── TerminalInput.svelte
│   │   ├── App.svelte
│   │   ├── styles.css (terminal styles)
│   │   └── main.ts
│   └── tests/
│       └── terminal-ui.test.ts
├── tailwind.config.js (theme configuration)
└── postcss.config.js
```

**Structure Decision**: Chrome extension frontend structure with Svelte components for terminal UI elements

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

**Output**: ✅ research.md completed with all clarifications resolved
- Decision to use pure Tailwind CSS approach
- Terminal color scheme defined
- Monospace font configuration determined
- Accessibility considerations addressed

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

**Output**:
✅ data-model.md - Theme configuration and CSS properties model
✅ /contracts/terminal-theme.contract.md - Component styling contracts
✅ quickstart.md - Implementation guide and verification steps
✅ CLAUDE.md - Updated via script (partial update due to template placeholders)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md
- Tailwind configuration tasks
- Component creation tasks
- Style implementation tasks
- Testing and verification tasks

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
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
