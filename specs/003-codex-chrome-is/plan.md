
# Implementation Plan: Web Agent System Prompt (Single File)

**Branch**: `003-codex-chrome-is` | **Date**: 2025-09-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-codex-chrome-is/spec.md`
**User Guidance**: Single agent_prompt.md file with converted codex-rs prompt

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
Convert the terminal-based gpt_5_codex_prompt.md from codex-rs to a web agent prompt in a single agent_prompt.md file. Analyze the original prompt structure and adapt all terminal/shell references to browser/DOM equivalents while maintaining the same instructional style and formatting guidelines.

## Technical Context
**Language/Version**: TypeScript 5.x (Chrome Extension)
**Primary Dependencies**: Chrome Extensions API only
**Storage**: Single agent_prompt.md file embedded in extension
**Testing**: Vitest framework
**Target Platform**: Chrome browser extension (Manifest V3)
**Project Type**: single - Chrome extension
**Performance Goals**: Instant prompt loading (< 5ms)
**Constraints**: One file approach, direct conversion from codex-rs
**Scale/Scope**: Single prompt file for all models
**Source Material**: codex-rs/core/gpt_5_codex_prompt.md

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Ultimate Simplicity**: Single agent_prompt.md file
- ✅ **YAGNI**: No model-specific logic needed
- ✅ **Maintainability**: One file to edit
- ✅ **Clarity**: Direct mapping from terminal to browser

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
│   ├── prompts/
│   │   └── agent_prompt.md    # Single converted prompt file
│   └── core/
│       └── PromptLoader.ts    # Simple loader (< 15 lines)

tests/
└── prompts/
    └── loader.test.ts         # Test single file loading
```

**Structure Decision**: Minimal structure - one prompt file (agent_prompt.md), one loader, one test. Direct conversion from codex-rs prompt.

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

**Task Generation Strategy (Ultra-Simple)**:
1. Convert gpt_5_codex_prompt.md to agent_prompt.md
2. Add 3-line loader function
3. Update TurnManager (2 lines)
4. Add one test
5. Update manifest.json

**Specific Tasks**:
- Task 1: Create agent_prompt.md with full conversion
- Task 2: Add loadPrompt() function
- Task 3: Integrate in TurnManager
- Task 4: Update manifest.json
- Task 5: Add simple test

**Ordering**: Sequential (each task ~5 minutes)

**Estimated Output**: 5 tasks total

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
- [x] Phase 0: Research complete (/plan command) - Analyzed gpt_5_codex_prompt.md
- [x] Phase 1: Design complete (/plan command) - Created example agent_prompt.md
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (Ultimate simplicity)
- [x] Post-Design Constitution Check: PASS (Single file, direct conversion)
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (None - maximally simple)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
