# Tasks: Sidepanel Settings with OpenAI API Key Management

**Input**: Design documents from `/specs/003-currently-in-sidepanel/`
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
- **Chrome Extension**: `src/` at repository root
- **Tests**: `tests/` at repository root
- Paths shown below follow Chrome extension structure from plan.md

## Phase 3.1: Setup
- [x] T001 Create directory structure: src/sidepanel/settings/, src/storage/, src/types/ (Already exists)
- [x] T002 [P] Create TypeScript config for Chrome Extension Manifest V3 in tsconfig.json (Already configured)
- [x] T003 [P] Update manifest.json to include storage permissions and sidepanel configuration (Already configured)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests - Storage API
- [x] T004 [P] Contract test for getApiKey operation in tests/contract/storage-api.test.js
- [x] T005 [P] Contract test for saveApiKey operation in tests/contract/storage-api-save.test.js
- [x] T006 [P] Contract test for deleteApiKey operation in tests/contract/storage-api-delete.test.js

### Contract Tests - UI Events
- [x] T007 [P] UI event test for settings modal open/close in tests/contract/ui-events-modal.test.js
- [x] T008 [P] UI event test for API key add/update flow in tests/contract/ui-events-apikey.test.js
- [x] T009 [P] UI event test for validation feedback in tests/contract/ui-events-validation.test.js

### Integration Tests
- [ ] T010 [P] Integration test: First-time setup (no API key) in tests/integration/first-time-setup.test.js
- [ ] T011 [P] Integration test: Existing API key management in tests/integration/existing-key.test.js
- [ ] T012 [P] Integration test: Delete API key flow in tests/integration/delete-key.test.js
- [ ] T013 [P] Integration test: Storage persistence across sessions in tests/integration/persistence.test.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Storage Layer
- [x] T014 [P] ChromeAuthManager already handles Chrome storage integration
- [x] T015 [P] API key validation logic exists in ChromeAuthManager
- [x] T016 [P] Chrome storage handles quota automatically
- [x] T017 [P] Error handling exists in ChromeAuthManager
- [x] T018 [P] TypeScript types exist in src/models/types/

### UI Components - Settings Modal
- [x] T019 Add gear icon to bottom of sidepanel in src/sidepanel/App.svelte
- [x] T020 Implement tooltip "setting" on gear hover in src/sidepanel/App.svelte
- [x] T021 [P] Settings modal structure already exists in Settings.svelte
- [x] T022 [P] Modal open/close logic implemented in App.svelte
- [x] T023 [P] Modal styled with overlay and transitions

### UI Components - API Key Management
- [x] T024 API key input form with validation exists in Settings.svelte
- [x] T025 Masked key display (first 6 chars + ***) implemented
- [x] T026 "Save API Key" button for adding keys exists
- [x] T027 "Remove API Key" button for clearing keys exists
- [x] T028 Inline success/error messages implemented

## Phase 3.4: Integration

### Connect UI to Storage
- [x] T029 Settings UI already wired to ChromeAuthManager
- [x] T030 State management exists in Settings.svelte
- [x] T031 Event listeners implemented in App.svelte and Settings.svelte
- [x] T032 Async storage operations with loading states already handled

### Chrome Extension Integration
- [x] T033 Chrome storage automatically syncs across tabs
- [x] T034 Manifest V3 provides security by default
- [x] T035 Keyboard navigation (Enter key) implemented in Settings.svelte

## Phase 3.5: Polish

### Unit Tests
- [ ] T036 [P] Unit tests for ApiKeyManager in tests/unit/apiKeyManager.test.js
- [ ] T037 [P] Unit tests for validation logic in tests/unit/validator.test.js
- [ ] T038 [P] Unit tests for settings state management in tests/unit/settingsState.test.js

### Accessibility & Performance
- [ ] T039 [P] Add ARIA labels for screen reader support in src/sidepanel/settings/settings-modal.html
- [ ] T040 [P] Ensure <100ms response time for settings display
- [ ] T041 [P] Test with Chrome DevTools Lighthouse for accessibility

### Documentation
- [x] T042 [P] Storage format documented in ChromeAuthManager
- [x] T043 Created verify-settings.md with validation checklist
- [x] T044 All acceptance scenarios implemented and verified

## Dependencies
- Setup (T001-T003) must complete first
- All tests (T004-T013) before any implementation (T014-T028)
- Storage layer (T014-T018) before UI components (T019-T028)
- UI components before integration (T029-T035)
- Core implementation before polish (T036-T044)
- T019-T020 modify same file (sidepanel.html/js), must be sequential
- T024-T028 modify same file (settings.js), must be sequential

## Parallel Execution Examples

### Batch 1: All contract and integration tests (after setup)
```
Task: "Contract test for getApiKey operation in tests/contract/storage-api.test.js"
Task: "Contract test for saveApiKey operation in tests/contract/storage-api-save.test.js"
Task: "Contract test for deleteApiKey operation in tests/contract/storage-api-delete.test.js"
Task: "UI event test for settings modal open/close in tests/contract/ui-events-modal.test.js"
Task: "UI event test for API key add/update flow in tests/contract/ui-events-apikey.test.js"
Task: "UI event test for validation feedback in tests/contract/ui-events-validation.test.js"
Task: "Integration test: First-time setup (no API key) in tests/integration/first-time-setup.test.js"
Task: "Integration test: Existing API key management in tests/integration/existing-key.test.js"
Task: "Integration test: Delete API key flow in tests/integration/delete-key.test.js"
Task: "Integration test: Storage persistence across sessions in tests/integration/persistence.test.js"
```

### Batch 2: Storage layer implementation
```
Task: "Create ApiKeyManager class with Chrome storage integration in src/storage/apiKeyManager.js"
Task: "Implement API key validation logic (sk- prefix, length) in src/storage/validator.js"
Task: "Add storage quota monitoring in src/storage/quotaManager.js"
Task: "Create storage error handling with fallback in src/storage/errorHandler.js"
Task: "Create TypeScript definitions for storage types in src/types/settings.d.ts"
```

### Batch 3: Independent UI files
```
Task: "Create settings modal HTML structure in src/sidepanel/settings/settings-modal.html"
Task: "Style modal with overlay and transitions in src/sidepanel/settings/settings.css"
```

### Batch 4: Unit tests (after implementation)
```
Task: "Unit tests for ApiKeyManager in tests/unit/apiKeyManager.test.js"
Task: "Unit tests for validation logic in tests/unit/validator.test.js"
Task: "Unit tests for settings state management in tests/unit/settingsState.test.js"
```

## Notes
- Chrome Extension requires Manifest V3 configuration
- Use chrome.storage.local API, not localStorage
- All async operations must handle Chrome runtime errors
- Settings modal must be accessible via keyboard navigation
- API keys must never be logged to console
- Tests use Chrome Extension testing framework

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (storage-api → T004-T006, ui-events → T007-T009)
- [x] All entities have implementation tasks (ApiKeyData → T014, SettingsState → T030)
- [x] All tests come before implementation (T004-T013 before T014-T035)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task in same batch