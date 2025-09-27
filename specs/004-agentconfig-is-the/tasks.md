# Tasks: Simplified Environment-Based AgentConfig

**Input**: Design documents from `/specs/004-agentconfig-is-the/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.x, Vite, dotenv, Chrome Extension
   → Structure: codex-chrome with src/config/, scripts/, tests/
2. Load design documents:
   → data-model.md: EnvironmentConfig, ConfigTransformer, EnvConfigLoader entities
   → contracts/env-config-loader.yaml: load, validate, transform endpoints
   → research.md: Files to remove (migration code), files to simplify
   → quickstart.md: 4 verification tests, no migration
3. Generate tasks by category:
   → Cleanup: Remove migration-related code
   → Simplification: Streamline existing implementation
   → Tests: Update for no-migration behavior
   → Documentation: Remove migration references
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Cleanup tasks first (remove unwanted)
   → Then simplify, then test, then document
5. Number tasks T001-T025
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Base directory: `codex-chrome/`
- Source: `src/config/`, `src/build/`
- Scripts: `scripts/`
- Tests: `tests/config/`, `tests/integration/`

## Phase 1: Cleanup - Remove Migration Code
**CRITICAL: These tasks remove migration functionality per user requirements**

- [x] T001 [P] Remove migration script: Delete codex-chrome/scripts/migrate-config.js
- [x] T002 [P] Remove migration command from package.json: Delete "migrate:config" script entry
- [x] T003 [P] Remove migration test file if exists: Delete tests/config/env-migrator.test.ts
- [x] T004 [P] Remove migration contract test if exists: Delete tests/config/env-migrator.contract.test.ts
- [x] T005 Check and remove migration imports from codex-chrome/scripts/generate-config.js

## Phase 2: Simplification - Streamline Existing Code
**Simplify the implementation by removing complex features**

- [x] T006 Simplify env-loader.ts: Remove migration-related methods and complex environment merging
- [x] T007 [P] Simplify validation in scripts/validate-env.js: Remove complex Zod schemas if present
- [x] T008 [P] Update scripts/generate-config.js: Remove references to migration tool
- [x] T009 [P] Simplify business rules in src/config/business-rules.ts if overly complex
- [x] T010 Update README.md: Remove all migration-related documentation sections

## Phase 3: Core Implementation Updates
**Ensure core .env functionality works correctly without migration**

- [x] T011 [P] Verify src/config/env-loader.ts loads .env files correctly (no changes if already working)
- [x] T012 [P] Verify src/config/env-transformer.ts transforms types correctly
- [x] T013 [P] Verify src/build/vite-plugin-env.ts generates build-config.ts at build time
- [x] T014 [P] Ensure scripts/validate-env.js validates essential business rules
- [x] T015 Update .env.example: Ensure it's comprehensive and has no migration references

## Phase 4: Test Updates
**Update tests to verify simplified implementation**

- [x] T016 [P] Create/update tests/config/env-loader.test.ts for simplified loader
- [x] T017 [P] Create/update tests/config/env-transformer.test.ts for type transformations
- [x] T018 [P] Create/update tests/integration/build-config.test.ts for build-time generation
- [x] T019 [P] Add test to verify migration code is not present: tests/config/no-migration.test.ts
- [x] T020 [P] Update tests/config/business-rules.test.ts for simplified validation

## Phase 5: Contract Tests
**Implement contract tests based on OpenAPI specification**

- [x] T021 [P] Create contract test for /config/load endpoint in tests/contracts/load.test.ts
- [x] T022 [P] Create contract test for /config/validate endpoint in tests/contracts/validate.test.ts
- [x] T023 [P] Create contract test for /config/transform endpoint in tests/contracts/transform.test.ts

## Phase 6: Documentation & Polish
**Final documentation and cleanup**

- [x] T024 Update CLAUDE.md if needed to reflect simplified approach
- [x] T025 [P] Verify all 4 quickstart verification tests pass

## Dependencies
- Cleanup (T001-T005) must complete first
- Simplification (T006-T010) after cleanup
- Core updates (T011-T015) can run with simplification
- Tests (T016-T023) after core updates
- Documentation (T024-T025) can start anytime

## Parallel Execution Examples

### Launch cleanup tasks together:
```bash
# T001-T004 can run in parallel (different files)
Task: "Remove migration script migrate-config.js"
Task: "Remove migrate:config from package.json"
Task: "Remove env-migrator.test.ts"
Task: "Remove env-migrator.contract.test.ts"
```

### Launch simplification tasks:
```bash
# T007, T008, T009 can run in parallel
Task: "Simplify validation in validate-env.js"
Task: "Update generate-config.js remove migration refs"
Task: "Simplify business-rules.ts"
```

### Launch core verification tasks:
```bash
# T011-T014 can run in parallel (different files)
Task: "Verify env-loader.ts loads correctly"
Task: "Verify env-transformer.ts transforms types"
Task: "Verify vite-plugin-env.ts generates config"
Task: "Ensure validate-env.js validates rules"
```

### Launch test creation tasks:
```bash
# T016-T020 can run in parallel (different test files)
Task: "Create env-loader.test.ts"
Task: "Create env-transformer.test.ts"
Task: "Create build-config.test.ts"
Task: "Create no-migration.test.ts"
Task: "Update business-rules.test.ts"
```

### Launch contract tests:
```bash
# T021-T023 can run in parallel (different test files)
Task: "Create contract test for load endpoint"
Task: "Create contract test for validate endpoint"
Task: "Create contract test for transform endpoint"
```

## Notes
- [P] tasks = different files, no shared dependencies
- Focus on removing migration code first
- Simplify but preserve core .env functionality
- Tests verify no migration code remains
- Documentation reflects simplified approach

## Validation Checklist
*GATE: All must pass before execution*

- ✅ All migration files identified for removal
- ✅ Core .env functionality preserved
- ✅ Test tasks cover simplified implementation
- ✅ Contract tests match OpenAPI spec
- ✅ Parallel tasks work on different files
- ✅ Each task specifies exact file path
- ✅ Documentation tasks remove migration references

## Success Criteria
1. All migration code removed (scripts, tests, imports)
2. `.env` file configuration still works at build time
3. Validation simplified but still catches errors
4. Tests pass for simplified implementation
5. No references to migration in documentation