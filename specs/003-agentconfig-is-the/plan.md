
# Implementation Plan: AgentConfig Integration Fix

**Branch**: `003-agentconfig-is-the` | **Date**: 2025-01-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-agentconfig-is-the/spec.md`

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
Fix AgentConfig integration issues in the codex-chrome extension where components are being initialized with config parameters that their constructors don't accept. The primary issue is that CodexAgent attempts to pass AgentConfig to Session, ToolRegistry, and ApprovalManager constructors, but these classes don't have the corresponding constructor parameters or initialization methods to accept and use the configuration.

## Technical Context
**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Chrome Extension APIs, uuid
**Storage**: Chrome storage API, IndexedDB (ConversationStore)
**Testing**: Vitest for unit tests
**Target Platform**: Chrome/Chromium browsers (Extension Manifest V3)
**Project Type**: single (Chrome extension)
**Performance Goals**: Instant configuration propagation to all components
**Constraints**: Must maintain backward compatibility with existing components
**Scale/Scope**: Fix configuration propagation for 6 core components (Session, ToolRegistry, ApprovalManager, ModelClientFactory, TurnContext, AgentTask)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution file is currently a template without specific principles defined, we'll proceed with general best practices:
- ✅ Maintain backward compatibility
- ✅ Keep changes minimal and focused
- ✅ Preserve existing functionality
- ✅ Test each component change independently

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
│   ├── core/
│   │   ├── CodexAgent.ts         # Main agent class (needs fixes)
│   │   ├── Session.ts            # Session manager (needs config param)
│   │   ├── ApprovalManager.ts    # Approval manager (needs config param)
│   │   ├── TurnContext.ts        # Turn context (already accepts config)
│   │   └── AgentTask.ts          # Agent task runner
│   ├── tools/
│   │   └── ToolRegistry.ts       # Tool registry (needs config param)
│   ├── models/
│   │   └── ModelClientFactory.ts # Model factory (needs initialize method)
│   └── config/
│       └── AgentConfig.ts        # Config singleton (already exists)
└── tests/
    ├── core/
    │   └── CodexAgent.test.ts
    └── config/
        └── AgentConfig.test.ts
```

**Structure Decision**: Single project structure for Chrome extension. The fix will modify existing TypeScript files in the codex-chrome directory to properly accept and propagate AgentConfig throughout the component hierarchy.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - No NEEDS CLARIFICATION items (clear bug fix requirements)
   - Research existing code structure and dependencies
   - Identify all affected components

2. **Research completed**:
   - Analyzed current constructor signatures
   - Identified missing initialize methods
   - Documented backward compatibility approach

3. **Consolidated findings** in `research.md`:
   - Decision: Add optional config parameters to constructors
   - Rationale: Maintains backward compatibility
   - Alternatives considered: Setter methods, dependency injection

**Output**: ✅ research.md completed with implementation approach defined

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extracted entities from feature spec** → `data-model.md`:
   - AgentConfig structure and usage patterns
   - Component config requirements
   - State transitions for config initialization

2. **Generated contracts** from functional requirements:
   - Component constructor signatures
   - Initialize method interfaces
   - Test scenarios for validation
   - Output to `/contracts/component-initialization.ts`

3. **Defined contract tests**:
   - Constructor acceptance tests
   - Initialize method existence tests
   - Config usage validation tests
   - Backward compatibility tests

4. **Created quickstart guide** from user stories:
   - Build and test instructions
   - Verification steps for each fix
   - Manual testing procedures

5. **Updated agent file** (CLAUDE.md):
   - Ran `.specify/scripts/bash/update-agent-context.sh claude`
   - Added TypeScript 5.x, Chrome Extension APIs
   - Added Chrome storage API, IndexedDB references

**Output**: ✅ data-model.md, ✅ /contracts/*, ✅ quickstart.md, ✅ CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each component fix → update constructor task [P]
- Each missing method → add method task [P]
- Each config usage → implement usage task
- Contract tests for each component

**Specific Tasks to Generate**:
1. Update Session constructor to accept AgentConfig [P]
2. Update ToolRegistry constructor to accept AgentConfig [P]
3. Update ApprovalManager constructor to accept AgentConfig [P]
4. Add initialize method to ModelClientFactory [P]
5. Add initialize method to ToolRegistry [P]
6. Implement config usage in Session
7. Implement config usage in ToolRegistry
8. Implement config usage in ApprovalManager
9. Implement config usage in ModelClientFactory
10. Add config change event handlers
11. Write unit tests for each component
12. Write integration tests for config flow
13. Update existing tests for compatibility

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Constructor fixes → Initialize methods → Config usage → Event handlers
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md focused on fixing the specific config propagation issues

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
