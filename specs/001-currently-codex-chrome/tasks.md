# Tasks: Config Refactoring for Chrome Extension

**Input**: Design documents from `/specs/001-currently-codex-chrome/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.x, Chrome Extension APIs, Vitest
2. Load optional design documents:
   → data-model.md: 9 entities identified for config system
   → contracts/: config-api.yaml and config-interface.ts
   → research.md: Storage decisions and migration strategy
3. Generate tasks by category:
   → Setup: TypeScript config, Chrome extension setup
   → Tests: Contract tests for all API endpoints
   → Core: Config entities and storage implementation
   → Integration: Chrome storage integration, migration
   → Polish: Performance tests, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T040)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Project root: `codex-chrome/`
- Source: `codex-chrome/src/`
- Tests: `codex-chrome/tests/`

## Phase 3.1: Setup
- [x] T001 Create config module directories: `codex-chrome/src/config/` and `codex-chrome/src/storage/`
- [x] T002 Create test directories: `codex-chrome/tests/unit/config/` and `codex-chrome/tests/integration/config/`
- [x] T003 [P] Install Chrome extension testing dependencies: @types/chrome, chrome-mock
- [x] T004 [P] Configure Vitest for Chrome extension environment in `vitest.config.ts`
- [x] T005 [P] Create mock Chrome storage helper in `tests/helpers/chrome-storage-mock.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (from contracts/config-api.yaml)
- [x] T006 [P] Contract test GET /config in `tests/contract/config/test_get_config.ts`
- [x] T007 [P] Contract test PUT /config in `tests/contract/config/test_update_config.ts`
- [x] T008 [P] Contract test GET /config/model in `tests/contract/config/test_get_model_config.ts`
- [x] T009 [P] Contract test PATCH /config/model in `tests/contract/config/test_update_model_config.ts`
- [ ] T010 [P] Contract test GET /config/providers in `tests/contract/config/test_get_providers.ts`
- [ ] T011 [P] Contract test POST /config/providers in `tests/contract/config/test_add_provider.ts`
- [ ] T012 [P] Contract test GET /config/profiles in `tests/contract/config/test_get_profiles.ts`
- [ ] T013 [P] Contract test POST /config/profiles in `tests/contract/config/test_create_profile.ts`
- [ ] T014 [P] Contract test POST /config/profiles/{name}/activate in `tests/contract/config/test_activate_profile.ts`
- [ ] T015 [P] Contract test POST /config/migrate in `tests/contract/config/test_migrate_config.ts`
- [ ] T016 [P] Contract test POST /config/reset in `tests/contract/config/test_reset_config.ts`
- [ ] T017 [P] Contract test GET /config/export in `tests/contract/config/test_export_config.ts`
- [ ] T018 [P] Contract test POST /config/import in `tests/contract/config/test_import_config.ts`

### Integration Tests (from quickstart.md scenarios)
- [ ] T019 [P] Integration test first-time setup in `tests/integration/config/test_first_setup.ts`
- [x] T020 [P] Integration test migration from old system in `tests/integration/config/test_legacy_migration.ts`
- [ ] T021 [P] Integration test profile management in `tests/integration/config/test_profile_switching.ts`
- [ ] T022 [P] Integration test storage limits & sync in `tests/integration/config/test_storage_constraints.ts`
- [ ] T023 [P] Integration test multiple provider configuration in `tests/integration/config/test_multi_provider.ts`
- [ ] T024 [P] Integration test import/export functionality in `tests/integration/config/test_import_export.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Type Definitions (from data-model.md entities)
- [x] T025 [P] Create IChromeConfig interface in `src/config/types.ts`
- [x] T026 [P] Create IModelConfig interface in `src/config/types.ts`
- [x] T027 [P] Create IProviderConfig interface in `src/config/types.ts`
- [x] T028 [P] Create IProfileConfig interface in `src/config/types.ts`
- [x] T029 [P] Create remaining interfaces (UserPreferences, CacheSettings, ExtensionSettings, RetryConfig, PermissionSettings) in `src/config/types.ts`

### Storage Layer
- [x] T030 [P] Create ConfigStorage class implementing IConfigStorage in `src/storage/ConfigStorage.ts`
- [x] T031 [P] Implement Chrome storage.sync wrapper with quota management in `src/storage/ConfigStorage.ts`
- [x] T032 [P] Implement storage.local fallback for large data in `src/storage/ConfigStorage.ts`

### Config Service Implementation
- [x] T033 Create ChromeConfig main class in `src/config/ChromeConfig.ts`
- [x] T034 Implement config CRUD operations (getConfig, updateConfig, resetConfig) in `src/config/ChromeConfig.ts`
- [x] T035 Implement provider management (addProvider, updateProvider, deleteProvider) in `src/config/ChromeConfig.ts`
- [x] T036 Implement profile management (createProfile, activateProfile, deleteProfile) in `src/config/ChromeConfig.ts`
- [x] T037 [P] Create default config values in `src/config/defaults.ts`
- [x] T038 [P] Create config validation functions in `src/config/validators.ts`

### Migration Module
- [x] T039 Create migration from ModelClientFactory storage in `src/config/migration.ts`
- [x] T040 Implement version-based migration system in `src/config/migration.ts`
- [x] T041 Add cleanup of old storage keys after migration in `src/config/migration.ts`

## Phase 3.4: Integration

### Chrome Extension Integration
- [ ] T042 Create config factory for dependency injection in `src/config/ConfigFactory.ts`
- [ ] T043 Add config change event emitter in `src/config/ChromeConfig.ts`
- [ ] T044 Integrate ChromeConfig with CodexAgent in `src/core/CodexAgent.ts`
- [ ] T045 Remove old config code from ModelClientFactory in `src/models/ModelClientFactory.ts`
- [ ] T046 Update all imports to use new config system

### Storage Optimization
- [ ] T047 Implement data compression for large profiles in `src/storage/compression.ts`
- [ ] T048 Add storage quota monitoring and warnings in `src/storage/ConfigStorage.ts`
- [ ] T049 Implement caching layer for frequent config reads in `src/config/ChromeConfig.ts`

## Phase 3.5: Polish

### Additional Tests
- [ ] T050 [P] Unit tests for config validators in `tests/unit/config/test_validators.ts`
- [ ] T051 [P] Unit tests for default values in `tests/unit/config/test_defaults.ts`
- [ ] T052 [P] Unit tests for compression in `tests/unit/storage/test_compression.ts`
- [ ] T053 Performance test: config load < 50ms in `tests/performance/test_config_perf.ts`
- [ ] T054 Performance test: config save < 100ms in `tests/performance/test_config_perf.ts`
- [ ] T055 Performance test: profile switch < 150ms in `tests/performance/test_config_perf.ts`

### Documentation & Cleanup
- [ ] T056 [P] Update README.md with new config system documentation
- [ ] T057 [P] Create config migration guide in `docs/migration-guide.md`
- [ ] T058 Remove deprecated config-related code from codebase
- [ ] T059 Add JSDoc comments to all public config APIs
- [ ] T060 Run quickstart.md validation scenarios

## Dependencies
- Setup (T001-T005) must complete first
- Tests (T006-T024) before implementation (T025-T041)
- Core implementation (T025-T041) before integration (T042-T049)
- Integration (T042-T049) before polish (T050-T060)
- T033-T036 depend on T025-T029 (types must exist first)
- T039-T041 depend on T030-T032 (storage must exist first)
- T044-T046 are sequential (refactoring existing code)

## Parallel Execution Examples

### Group 1: All contract tests can run in parallel
```bash
# Run all contract tests simultaneously (T006-T018)
Task agent="test-contracts" tasks="T006,T007,T008,T009,T010,T011,T012,T013,T014,T015,T016,T017,T018"
```

### Group 2: All integration tests can run in parallel
```bash
# Run all integration tests simultaneously (T019-T024)
Task agent="test-integration" tasks="T019,T020,T021,T022,T023,T024"
```

### Group 3: All type definitions can be created in parallel
```bash
# Create all interfaces simultaneously (T025-T029)
Task agent="create-types" tasks="T025,T026,T027,T028,T029"
```

### Group 4: Unit tests can run in parallel
```bash
# Run all unit tests simultaneously (T050-T052)
Task agent="test-units" tasks="T050,T051,T052"
```

### Sequential Groups (cannot parallelize)
- T033-T036: ChromeConfig methods (same file)
- T039-T041: Migration module (interdependent)
- T044-T046: Refactoring existing code (affects same files)
- T053-T055: Performance tests (same test file)

## Success Criteria
✅ All 60 tasks completed
✅ All tests passing (contract, integration, unit, performance)
✅ Migration from old system works without data loss
✅ Config operations meet performance targets (<50ms load, <100ms save)
✅ Chrome storage constraints handled (100KB sync limit, 8KB item limit)
✅ No references to old config system remain in codebase
✅ Quickstart validation scenarios all pass

## Notes
- Each task references specific files to enable parallel execution
- Tests are written first (TDD) and must fail before implementation
- The [P] marker indicates tasks that can run in parallel
- Tasks without [P] must run sequentially or have dependencies
- Performance targets from plan.md: <50ms load, <200ms sync operations