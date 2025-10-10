
# Implementation Plan: Fix DOMTreeSerializer Instantiation in DomService

**Branch**: `020-domtreeserializer-is-not` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-domtreeserializer-is-not/spec.md`

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
Fix the incorrect instantiation of DOMTreeSerializer in DomService. Currently, the serializer is created without required constructor parameters in the DomService constructor, causing failures when serialize_accessible_elements() is called. The fix involves: (1) removing the serializer field from DomService, (2) creating new serializer instances per-operation in get_serialized_dom_tree(), and (3) passing required parameters (root_node, previous_cached_state, filtering config) to the constructor.

## Technical Context
**Language/Version**: TypeScript 5.9, ES2020 target
**Primary Dependencies**: Chrome Extension Manifest V3, Vite 5.4, Vitest 3.2, Zod 3.23
**Storage**: N/A (pure refactoring, no storage changes)
**Testing**: Vitest with jsdom for unit tests
**Target Platform**: Chrome Extension (browser environment)
**Project Type**: Single project (Chrome extension with Svelte UI)
**Performance Goals**: Maintain existing serialization performance (<50ms for typical DOM trees)
**Constraints**: Must preserve existing API surface for DomService.get_serialized_dom_tree(), no breaking changes to downstream consumers
**Scale/Scope**: 2 files modified (service.ts, serializer.ts), minimal scope refactoring

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS (constitution template is empty, no principles to validate against)

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
│       └── dom/
│           ├── service.ts           # DomService - needs modification
│           ├── serializer/
│           │   └── serializer.ts    # DOMTreeSerializer - needs modification
│           ├── views.ts             # Type definitions
│           └── enhancedSnapshot.ts  # Snapshot utilities
└── tests/
    └── unit/
        └── tools/
            └── dom/
                └── service.test.ts  # Unit tests for DomService
```

**Structure Decision**: Single project (Chrome extension). This is a focused refactoring limited to the DOM tools module. Changes affect only the instantiation pattern in service.ts and verify the constructor signature in serializer.ts remains unchanged.

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
1. **Contract Test Tasks** (from contracts/)
   - Task: Write failing test for DomService.get_serialized_dom_tree() contract
   - Task: Write failing test for DOMTreeSerializer constructor validation
   - Both can run in [P]arallel as they test independent contracts

2. **Implementation Tasks** (from quickstart.md steps)
   - Task: Remove serializer field from DomService class
   - Task: Remove serializer initialization from DomService constructor
   - Task: Update get_serialized_dom_tree() to create serializer per-operation
   - Sequential dependency: field removal → constructor update → method update

3. **Verification Tasks**
   - Task: Run type checker and verify no compilation errors
   - Task: Run unit tests and verify all pass
   - Task: Run quickstart manual test script
   - Sequential: type check → unit tests → manual verification

**Ordering Strategy**:
1. Contract tests first (TDD - tests must fail initially)
2. Implementation tasks in dependency order
3. Verification tasks last
4. Mark independent test tasks as [P]arallel

**Estimated Output**: 8-10 numbered, ordered tasks in tasks.md

**Task Categories**:
- Testing: 2 tasks (contract tests)
- Implementation: 3 tasks (refactoring)
- Verification: 3 tasks (type check, unit test, manual test)

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
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - contracts/, data-model.md, quickstart.md created
- [x] Phase 2: Task planning complete (/plan command - approach described above)
- [x] Phase 3: Tasks generated (/tasks command) - tasks.md created with 10 tasks
- [ ] Phase 4: Implementation complete - ready to execute tasks
- [ ] Phase 5: Validation passed - validation pending

**Gate Status**:
- [x] Initial Constitution Check: PASS (empty constitution)
- [x] Post-Design Constitution Check: PASS (no violations)
- [x] All NEEDS CLARIFICATION resolved (none present)
- [x] Complexity deviations documented (none - simple refactoring)

**Artifacts Generated**:
- [x] research.md - Problem analysis and design decisions
- [x] data-model.md - Entity lifecycle changes
- [x] contracts/DomService.contract.md - Method contract
- [x] contracts/DOMTreeSerializer.contract.md - Constructor contract
- [x] quickstart.md - Step-by-step implementation guide
- [x] CLAUDE.md updated - Agent context refreshed
- [x] tasks.md - 10 ordered tasks with TDD approach

**Ready for**: Implementation (execute tasks T001-T010)

---
*Based on Constitution v2.1.1 - See `.specify/memory/constitution.md`*
