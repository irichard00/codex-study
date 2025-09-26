# Tasks: AgentConfig Integration

**Input**: Design documents from `/specs/002-codex-chrome-is/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.x, Chrome Extension, Svelte UI
2. Load optional design documents:
   → data-model.md: AgentConfig singleton, config interfaces
   → contracts/: config-api.yaml, messaging-api.yaml
   → research.md: Singleton pattern, messaging strategy
3. Generate tasks by category:
   → Setup: Singleton initialization, getInstance pattern
   → Tests: Config API tests, messaging tests, integration tests
   → Core: Component injection, event system
   → Integration: Cross-context messaging, storage sync
   → Polish: Unit tests, documentation updates
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Chrome Extension structure: `codex-chrome/src/`
- Test files: `codex-chrome/tests/`
- Config directory: `codex-chrome/src/config/`

## Phase 3.1: Setup & Initialization
- [x] T001 Add singleton getInstance() method to codex-chrome/src/config/AgentConfig.ts
- [x] T002 Add lazy initialization logic to AgentConfig constructor in codex-chrome/src/config/AgentConfig.ts
- [x] T003 [P] Create config messaging types in codex-chrome/src/protocol/config-messages.ts
- [x] T004 [P] Add config initialization to background service worker in codex-chrome/src/background/service-worker.ts
- [x] T005 [P] Add Chrome storage permissions to codex-chrome/manifest.json if missing

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T006 [P] Test AgentConfig singleton pattern in codex-chrome/tests/unit/config/AgentConfig.test.ts
- [x] T007 [P] Test config validation in codex-chrome/tests/unit/config/validators.test.ts
- [x] T008 [P] Test config storage persistence in codex-chrome/tests/unit/storage/ConfigStorage.test.ts
- [x] T009 [P] Test config messaging protocol in codex-chrome/tests/unit/protocol/config-messages.test.ts
- [x] T010 [P] Integration test config flow in codex-chrome/tests/integration/config-flow.test.ts
- [x] T011 [P] Test component config injection in codex-chrome/tests/integration/config-injection.test.ts
- [x] T012 [P] Test cross-context sync in codex-chrome/tests/integration/cross-context.test.ts
- [x] T013 [P] Test profile management in codex-chrome/tests/unit/config/profiles.test.ts
- [x] T014 [P] Test event subscriptions in codex-chrome/tests/unit/config/events.test.ts

## Phase 3.3: Core Implementation - Component Injection (ONLY after tests are failing)
- [ ] T015 Update CodexAgent constructor to accept AgentConfig in codex-chrome/src/core/CodexAgent.ts
- [ ] T016 Add config usage in CodexAgent for model and security policies in codex-chrome/src/core/CodexAgent.ts
- [ ] T017 Update ModelClientFactory to accept and use AgentConfig in codex-chrome/src/models/ModelClientFactory.ts
- [ ] T018 [P] Update Session constructor to accept AgentConfig in codex-chrome/src/core/Session.ts
- [ ] T019 [P] Update TaskRunner constructor to accept AgentConfig in codex-chrome/src/core/TaskRunner.ts
- [ ] T020 [P] Update ToolRegistry constructor to accept AgentConfig in codex-chrome/src/tools/ToolRegistry.ts
- [ ] T021 [P] Update ApprovalManager constructor to accept AgentConfig in codex-chrome/src/core/ApprovalManager.ts
- [ ] T022 [P] Add config event subscriptions to CodexAgent in codex-chrome/src/core/CodexAgent.ts
- [ ] T023 [P] Add config event subscriptions to ModelClientFactory in codex-chrome/src/models/ModelClientFactory.ts
- [ ] T024 [P] Add config event subscriptions to ToolRegistry in codex-chrome/src/tools/ToolRegistry.ts

## Phase 3.4: Core Implementation - Config Usage
- [ ] T025 Implement model selection from config in ModelClientFactory in codex-chrome/src/models/ModelClientFactory.ts
- [ ] T026 Implement tool availability checks from config in ToolRegistry in codex-chrome/src/tools/ToolRegistry.ts
- [ ] T027 Implement approval policy from config in ApprovalManager in codex-chrome/src/core/ApprovalManager.ts
- [ ] T028 Implement sandbox policy from config in TaskRunner in codex-chrome/src/core/TaskRunner.ts
- [ ] T029 [P] Implement context window limits from config in Session in codex-chrome/src/core/Session.ts
- [ ] T030 [P] Implement user instructions from config in Session in codex-chrome/src/core/Session.ts
- [ ] T031 [P] Implement per-turn config cloning in TurnManager in codex-chrome/src/core/TurnManager.ts

## Phase 3.5: Integration - Cross-Context Messaging
- [ ] T032 Add config request handler in background service worker in codex-chrome/src/background/service-worker.ts
- [ ] T033 Add config update broadcaster in background service worker in codex-chrome/src/background/service-worker.ts
- [ ] T034 Add config change listener in background service worker in codex-chrome/src/background/service-worker.ts
- [ ] T035 [P] Add config request logic to content script in codex-chrome/src/content/content.ts
- [ ] T036 [P] Add config caching in content script in codex-chrome/src/content/content.ts
- [ ] T037 [P] Add config request to sidepanel initialization in codex-chrome/src/sidepanel/App.svelte
- [ ] T038 [P] Add config UI components in sidepanel in codex-chrome/src/sidepanel/components/ConfigPanel.svelte

## Phase 3.6: Integration - Event System
- [ ] T039 Implement config change broadcasting from AgentConfig in codex-chrome/src/config/AgentConfig.ts
- [ ] T040 Add config reload handler in components when config changes in codex-chrome/src/core/CodexAgent.ts
- [ ] T041 [P] Add tool registry rebuild on tool config changes in codex-chrome/src/tools/ToolRegistry.ts
- [ ] T042 [P] Add model client recreation on provider changes in codex-chrome/src/models/ModelClientFactory.ts

## Phase 3.7: Polish & Documentation
- [ ] T043 [P] Add JSDoc comments to all config-related methods in codex-chrome/src/config/AgentConfig.ts
- [ ] T044 [P] Create config API documentation in codex-chrome/docs/config-api.md
- [ ] T045 [P] Update CLAUDE.md with config usage examples in /home/rich/dev/study/codex-study/CLAUDE.md
- [ ] T046 [P] Add config error handling and recovery in codex-chrome/src/config/AgentConfig.ts
- [ ] T047 [P] Add config migration logic for version updates in codex-chrome/src/config/migrations.ts
- [ ] T048 Run integration test script from quickstart.md in codex-chrome/
- [ ] T049 Verify all components use injected config instead of hardcoded values
- [ ] T050 Performance test config access meets <10ms target

## Dependencies
- Singleton setup (T001-T005) before all other tasks
- Tests (T006-T014) before implementation (T015-T042)
- Component injection (T015-T024) before config usage (T025-T031)
- Config usage before messaging (T032-T038)
- Core implementation before event system (T039-T042)
- All implementation before polish (T043-T050)

## Parallel Execution Examples

### Setup Phase (T003-T005)
```bash
# Can run these 3 tasks in parallel:
Task: "Create config messaging types in codex-chrome/src/protocol/config-messages.ts"
Task: "Add config initialization to background service worker"
Task: "Add Chrome storage permissions to manifest.json"
```

### Test Phase (T006-T014)
```bash
# Launch all 9 test tasks together:
Task: "Test AgentConfig singleton pattern"
Task: "Test config validation"
Task: "Test config storage persistence"
Task: "Test config messaging protocol"
Task: "Integration test config flow"
Task: "Test component config injection"
Task: "Test cross-context sync"
Task: "Test profile management"
Task: "Test event subscriptions"
```

### Component Updates (T018-T021)
```bash
# Update these 4 components in parallel:
Task: "Update Session constructor to accept AgentConfig"
Task: "Update TaskRunner constructor to accept AgentConfig"
Task: "Update ToolRegistry constructor to accept AgentConfig"
Task: "Update ApprovalManager constructor to accept AgentConfig"
```

### Config Usage Implementation (T029-T031)
```bash
# Implement these 3 features in parallel:
Task: "Implement context window limits from config in Session"
Task: "Implement user instructions from config in Session"
Task: "Implement per-turn config cloning in TurnManager"
```

### Content & UI Updates (T035-T038)
```bash
# Update all frontend contexts in parallel:
Task: "Add config request logic to content script"
Task: "Add config caching in content script"
Task: "Add config request to sidepanel initialization"
Task: "Add config UI components in sidepanel"
```

### Documentation (T043-T047)
```bash
# Create all documentation in parallel:
Task: "Add JSDoc comments to all config-related methods"
Task: "Create config API documentation"
Task: "Update CLAUDE.md with config usage examples"
Task: "Add config error handling and recovery"
Task: "Add config migration logic for version updates"
```

## Notes
- [P] tasks = different files, no dependencies
- Singleton must be initialized before any component uses it
- Tests must fail before implementing features
- Cross-context messaging requires background service worker setup first
- Event subscriptions should be added after basic injection works
- Commit after each task or parallel group

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T006-T014 cover config-api and messaging-api)
- [x] All entities have implementation tasks (AgentConfig singleton, all config interfaces)
- [x] All tests come before implementation (Phase 3.2 before 3.3-3.6)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task in same phase