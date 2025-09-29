# Tasks: AgentConfig Integration Fix

**Input**: Design documents from `/specs/003-agentconfig-is-the/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Chrome Extension**: `codex-chrome/src/`, `codex-chrome/tests/`
- All paths are relative to repository root

## Phase 3.1: Setup
- [x] T001 Verify existing codex-chrome project structure and dependencies
- [x] T002 Ensure TypeScript 5.x and Chrome Extension dependencies are installed
- [x] T003 [P] Verify linting and formatting configurations are working

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T004 [P] Contract test for Session constructor accepting config in codex-chrome/tests/core/Session.config.test.ts
- [x] T005 [P] Contract test for ToolRegistry constructor accepting config in codex-chrome/tests/tools/ToolRegistry.config.test.ts
- [x] T006 [P] Contract test for ApprovalManager constructor accepting config in codex-chrome/tests/core/ApprovalManager.config.test.ts
- [x] T007 [P] Contract test for ModelClientFactory.initialize method in codex-chrome/tests/models/ModelClientFactory.config.test.ts
- [x] T008 [P] Contract test for ToolRegistry.initialize method in codex-chrome/tests/tools/ToolRegistry.initialize.test.ts
- [x] T009 [P] Integration test for full config propagation flow in codex-chrome/tests/integration/config-flow.test.ts
- [x] T010 [P] Integration test for config change events in codex-chrome/tests/integration/config-events.test.ts
- [x] T011 [P] Backward compatibility test in codex-chrome/tests/integration/backward-compat.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
### Constructor Updates
- [x] T012 [P] Update Session constructor to accept optional AgentConfig parameter in codex-chrome/src/core/Session.ts
- [x] T013 [P] Update ToolRegistry constructor to accept optional AgentConfig parameter in codex-chrome/src/tools/ToolRegistry.ts
- [x] T014 [P] Update ApprovalManager constructor to accept optional AgentConfig parameter in codex-chrome/src/core/ApprovalManager.ts

### Initialize Methods
- [x] T015 [P] Add initialize method to ModelClientFactory in codex-chrome/src/models/ModelClientFactory.ts
- [x] T016 [P] Add initialize method to ToolRegistry in codex-chrome/src/tools/ToolRegistry.ts

### Config Storage
- [x] T017 Add config property to Session class in codex-chrome/src/core/Session.ts
- [x] T018 Add config property to ToolRegistry class in codex-chrome/src/tools/ToolRegistry.ts
- [x] T019 Add config property to ApprovalManager class in codex-chrome/src/core/ApprovalManager.ts
- [x] T020 Add config storage to ModelClientFactory in codex-chrome/src/models/ModelClientFactory.ts

### Config Usage Implementation
- [x] T021 Implement config usage in Session (defaultModel, defaultCwd, storageEnabled) in codex-chrome/src/core/Session.ts
- [x] T022 Implement config usage in ToolRegistry (enabledTools, toolTimeout, sandboxPolicy) in codex-chrome/src/tools/ToolRegistry.ts
- [x] T023 Implement config usage in ApprovalManager (defaultPolicy, autoApproveList, timeout) in codex-chrome/src/core/ApprovalManager.ts
- [x] T024 Implement config usage in ModelClientFactory (selectedModel, apiKeys, baseUrls) in codex-chrome/src/models/ModelClientFactory.ts

## Phase 3.4: Integration
### Config Change Event Handling
- [x] T025 Add config change event subscription to Session in codex-chrome/src/core/Session.ts
- [x] T026 Add config change event subscription to ToolRegistry in codex-chrome/src/tools/ToolRegistry.ts
- [x] T027 Add config change event subscription to ApprovalManager in codex-chrome/src/core/ApprovalManager.ts

### Fix CodexAgent Integration Points
- [x] T028 Update CodexAgent to properly pass config to all components in codex-chrome/src/core/CodexAgent.ts
- [x] T029 Verify initialize methods are called correctly in CodexAgent in codex-chrome/src/core/CodexAgent.ts

## Phase 3.5: Polish
### Update Existing Tests
- [x] T030 [P] Update existing Session tests for new constructor signature in codex-chrome/tests/core/Session.test.ts
- [x] T031 [P] Update existing ToolRegistry tests for new constructor signature in codex-chrome/tests/tools/ToolRegistry.test.ts
- [x] T032 [P] Update existing ApprovalManager tests for new constructor signature in codex-chrome/tests/core/ApprovalManager.test.ts
- [x] T033 [P] Update existing CodexAgent tests for config propagation in codex-chrome/tests/core/CodexAgent.test.ts

### Validation and Documentation
- [x] T034 Run full test suite to ensure all tests pass with pnpm test
- [x] T035 Build the extension to verify no TypeScript errors with pnpm build
- [x] T036 [P] Run quickstart verification steps from quickstart.md
- [x] T037 [P] Update inline documentation for modified constructors and methods
- [x] T038 Manual testing in Chrome browser with extension loaded

## Dependencies
- Setup (T001-T003) before everything
- Tests (T004-T011) before implementation (T012-T024)
- Constructor updates (T012-T014) can be parallel
- Initialize methods (T015-T016) can be parallel
- Config storage (T017-T020) must complete before config usage (T021-T024)
- Config usage (T021-T024) before event handling (T025-T027)
- CodexAgent fixes (T028-T029) after all component updates
- Polish tasks (T030-T038) after all implementation

## Parallel Example
```
# Launch T004-T011 together (all test files):
Task: "Contract test for Session constructor accepting config in codex-chrome/tests/core/Session.config.test.ts"
Task: "Contract test for ToolRegistry constructor accepting config in codex-chrome/tests/tools/ToolRegistry.config.test.ts"
Task: "Contract test for ApprovalManager constructor accepting config in codex-chrome/tests/core/ApprovalManager.config.test.ts"
Task: "Contract test for ModelClientFactory.initialize method in codex-chrome/tests/models/ModelClientFactory.config.test.ts"
Task: "Contract test for ToolRegistry.initialize method in codex-chrome/tests/tools/ToolRegistry.initialize.test.ts"
Task: "Integration test for full config propagation flow in codex-chrome/tests/integration/config-flow.test.ts"
Task: "Integration test for config change events in codex-chrome/tests/integration/config-events.test.ts"
Task: "Backward compatibility test in codex-chrome/tests/integration/backward-compat.test.ts"

# Launch T012-T016 together (different source files):
Task: "Update Session constructor to accept optional AgentConfig parameter in codex-chrome/src/core/Session.ts"
Task: "Update ToolRegistry constructor to accept optional AgentConfig parameter in codex-chrome/src/tools/ToolRegistry.ts"
Task: "Update ApprovalManager constructor to accept optional AgentConfig parameter in codex-chrome/src/core/ApprovalManager.ts"
Task: "Add initialize method to ModelClientFactory in codex-chrome/src/models/ModelClientFactory.ts"
Task: "Add initialize method to ToolRegistry in codex-chrome/src/tools/ToolRegistry.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- T017-T020 and T021-T024 modify same files sequentially (Session.ts, ToolRegistry.ts, etc.)
- Tests must fail before implementing fixes
- Commit after each task for easy rollback
- Maintain backward compatibility throughout

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T004-T008)
- [x] All components have update tasks (T012-T027)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task in same phase