
# Implementation Plan: Sidepanel Settings with OpenAI API Key Management

**Branch**: `003-currently-in-sidepanel` | **Date**: 2025-09-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-currently-in-sidepanel/spec.md`

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
Implement a settings interface in the Chrome extension sidepanel to manage OpenAI API keys. Users will access settings via a gear icon at the bottom of the sidepanel, view masked API keys (showing only first 6 characters), and add new keys when none exist. Keys will be stored securely in Chrome's local storage.

## Technical Context
**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Chrome Extension Manifest V3 APIs, Chrome Storage API
**Storage**: chrome.storage.local API for persistent key storage
**Testing**: npm test (as per CLAUDE.md)
**Target Platform**: Chrome browser extension (Manifest V3)
**Project Type**: single (Chrome extension)
**Performance Goals**: Instant UI response (<100ms for settings display)
**Constraints**: Chrome storage quota limits, secure key handling
**Scale/Scope**: Single user per extension instance

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Simplicity**: Feature is a straightforward UI addition with clear user value
- ✅ **Security**: API keys will be masked in display and stored securely
- ✅ **Testing**: Will implement with testable components and storage interactions
- ✅ **User Focus**: Direct response to user need for API key management
- ⚠️ **Clarifications**: Several aspects need resolution before implementation

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
src/
├── sidepanel/
│   ├── sidepanel.html        # Existing sidepanel HTML
│   ├── sidepanel.js          # Main sidepanel logic (will be modified)
│   └── settings/             # New settings feature
│       ├── settings.js       # Settings UI logic
│       └── settings.css      # Settings styles
├── storage/
│   └── apiKeyManager.js      # API key storage management
└── types/
    └── settings.d.ts         # TypeScript definitions

tests/
├── unit/
│   ├── apiKeyManager.test.js # Storage tests
│   └── settings.test.js      # Settings UI tests
└── integration/
    └── sidepanel.test.js     # Full sidepanel flow tests
```

**Structure Decision**: Single project structure for Chrome extension. The settings feature will be integrated into the existing sidepanel with a dedicated settings module for UI components and a storage manager for Chrome storage API interactions.

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
Based on the design artifacts created in Phase 1, the /tasks command will generate:

1. **Storage Layer Tasks** (5 tasks)
   - Create ApiKeyManager class with Chrome storage integration
   - Implement validation logic for API key format
   - Add storage quota monitoring
   - Create storage error handling
   - Write unit tests for storage operations

2. **UI Component Tasks** (8 tasks)
   - Add gear icon to sidepanel bottom
   - Implement tooltip on hover
   - Create settings modal HTML structure
   - Add modal open/close logic
   - Implement API key input form
   - Add masked key display
   - Create update/delete buttons
   - Style settings components

3. **Integration Tasks** (4 tasks)
   - Connect UI to storage manager
   - Implement state management
   - Add event listeners
   - Handle async operations

4. **Testing Tasks** (5 tasks)
   - Contract tests for storage API
   - UI event tests
   - Integration tests for full flow
   - Accessibility tests
   - Performance tests

**Ordering Strategy**:
- Storage layer first (foundation)
- UI components second (presentation)
- Integration third (connection)
- Tests throughout (TDD approach)
- Parallel tasks marked [P] for independent work

**Estimated Output**: 22 numbered, ordered tasks in tasks.md

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
