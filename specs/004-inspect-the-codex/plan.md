
# Implementation Plan: TaskRunner Implementation Inspection & Improvement

**Branch**: `004-inspect-the-codex` | **Date**: 2025-09-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/irichard/dev/study/codex-study/s1/codex-study/specs/004-inspect-the-codex/spec.md`

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
This feature performs a comprehensive code inspection comparing the TypeScript TaskRunner.ts implementation (codex-chrome) against the original Rust run_task function (codex-rs). The goal is to identify architectural differences, porting errors, code duplication, and missing features, then provide actionable improvement suggestions with specific line numbers and fix approaches. The analysis must distinguish between legitimate browser adaptations and actual bugs while ensuring the SQ/EQ architecture is preserved correctly.

## Technical Context
**Language/Version**: TypeScript 5.x (codex-chrome) vs Rust Edition 2024 (codex-rs)
**Primary Dependencies**: uuid for ID generation; protocol types from ../protocol/types
**Storage**: N/A (code analysis task, no persistent storage)
**Testing**: Vitest for TypeScript tests
**Target Platform**: Chrome Extension (Manifest V3) for TypeScript; Terminal CLI for Rust
**Project Type**: Single (code inspection/analysis tool)
**Performance Goals**: Complete analysis in <5 minutes; identify all critical differences
**Constraints**: Must preserve exact architectural patterns from Rust; must account for Rust→TypeScript idiom differences
**Scale/Scope**: Analyzing ~613 lines of TypeScript vs ~286 lines of Rust; ~15 functional requirements to validate

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The constitution file is a template and not yet filled out. For this code inspection task:
- ✅ **No new libraries**: This is analysis/inspection only, no new code libraries
- ✅ **Test-First**: Analysis will generate test validation criteria before conclusions
- ✅ **Simplicity**: Direct comparison approach, no unnecessary tooling
- ✅ **Scope bounded**: Clear boundaries (TaskRunner.ts vs run_task only)

**Status**: PASS - This is a non-invasive analysis task with no architectural changes

## Project Structure

### Documentation (this feature)
```
specs/004-inspect-the-codex/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command) - Analysis data structures
├── quickstart.md        # Phase 1 output (/plan command) - How to run analysis
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
└── src/
    └── core/
        └── TaskRunner.ts    # Target of inspection (613 lines)

codex-rs/
└── core/
    └── src/
        └── codex.rs         # Reference implementation (run_task at lines 1635-1920)
```

**Structure Decision**: This is an analysis/inspection task, not a feature implementation. No new source code will be created. The analysis will examine existing code in both codex-chrome and codex-rs directories. Documentation outputs (research.md, data-model.md, quickstart.md) will be generated in specs/004-inspect-the-codex/.

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
- Generate analysis tasks based on quickstart.md steps
- Generate investigation tasks for each aspect from research.md
- Generate documentation tasks for findings
- Create validation tasks to verify each functional requirement

**Analysis Task Categories**:
1. **Structural Comparison Tasks** [P]:
   - Compare task initialization (Rust lines 1641-1665 vs TS lines 113-137)
   - Compare main turn loop (Rust lines 1673-1896 vs TS lines 143-188)
   - Compare turn result processing (Rust lines 1726-1843 vs TS lines 306-359)
   - Compare error handling (Rust lines 1883-1895 vs TS lines 181-187, 378-393)
   - Compare task completion (Rust lines 1914-1919 vs TS lines 190-201)

2. **Behavioral Verification Tasks** [P]:
   - Verify event emission patterns match (FR-004)
   - Verify review mode isolation (FR-005)
   - Verify token management logic (FR-006)
   - Verify cancellation mechanisms (FR-009)
   - Verify turn loop termination conditions (FR-010)
   - Verify conversation history recording (FR-011)

3. **Gap Analysis Tasks** [P]:
   - Identify missing response item handlers (FR-015)
   - Identify missing error handling paths (FR-007)
   - Check for dead code or unused features (FR-014)

4. **Code Quality Tasks**:
   - Analyze dual execution paths for duplication (FR-008)
   - Evaluate code organization and maintainability
   - Document architectural preservation (FR-003)

5. **Documentation Tasks**:
   - Generate ImprovementSuggestion objects for each finding (FR-012)
   - Categorize all differences (FR-002)
   - Distinguish bugs from intentional adaptations (FR-013)
   - Create ComparisonResult summary (FR-001)

**Ordering Strategy**:
- Structural comparison first (establishes baseline understanding)
- Behavioral verification second (validates runtime behavior)
- Gap analysis third (identifies missing features)
- Code quality analysis fourth (evaluates implementation quality)
- Documentation last (synthesizes all findings)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**Success Criteria**:
- All 15 functional requirements mapped to tasks
- Each task produces concrete, measurable output
- Tasks follow quickstart.md verification steps
- Final task generates complete ComparisonResult JSON

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
- [x] Phase 0: Research complete (/plan command) - research.md generated
- [x] Phase 1: Design complete (/plan command) - data-model.md and quickstart.md generated
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (non-invasive analysis task)
- [x] Post-Design Constitution Check: PASS (no architectural changes)
- [x] All NEEDS CLARIFICATION resolved (Technical Context complete)
- [x] Complexity deviations documented (none - analysis task only)

**Artifacts Generated**:
- ✅ `/specs/004-inspect-the-codex/plan.md` (this file)
- ✅ `/specs/004-inspect-the-codex/research.md` (9 research areas)
- ✅ `/specs/004-inspect-the-codex/data-model.md` (5 entity definitions)
- ✅ `/specs/004-inspect-the-codex/quickstart.md` (8-step verification guide)
- ⏳ `/specs/004-inspect-the-codex/tasks.md` (pending /tasks command)

---
*Based on Constitution template - See `.specify/memory/constitution.md`*
