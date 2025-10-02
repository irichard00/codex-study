# Tasks: Replace ConversationStore with RolloutRecorder

**Feature**: 006-use-the-rolloutrecorder
**Branch**: `006-use-the-rolloutrecorder`
**Input**: Design documents from `/specs/006-use-the-rolloutrecorder/`
**Tech Stack**: TypeScript 5.x, Chrome Extension Manifest V3, Vitest, RolloutRecorder (already implemented)
**Important**: **No data migration** - code replacement only

---

## Execution Flow
```
1. Load plan.md → TypeScript, Chrome Extension, RolloutRecorder integration
2. Load contracts/ → 23 contract tests (session, storage, cleanup)
3. Load quickstart.md → Integration test scenarios
4. Generate tasks:
   → Setup: None needed (RolloutRecorder already exists)
   → Tests: 23 contract tests [P] + 4 integration tests
   → Core: Session integration, Storage updates, Cleanup scheduling
   → Polish: ConversationStore removal, verification
5. Apply TDD: All tests before implementation
6. Number tasks: T001-T030
7. Mark parallel: Different test files = [P]
```

---

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths: `codex-chrome/src/`, `codex-chrome/tests/`

---

## Phase 3.1: Setup
*No setup tasks needed - RolloutRecorder infrastructure already complete (Feature 005)*

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Session Contract Tests (9 tests)
- [ ] **T001** [P] Contract test: Session should initialize RolloutRecorder on create
  File: `codex-chrome/tests/core/session-rollout-init-create.test.ts`
  Contract: `CONTRACT_INIT_CREATE` from `session-api.ts`

- [ ] **T002** [P] Contract test: Session should resume from existing rollout
  File: `codex-chrome/tests/core/session-rollout-init-resume.test.ts`
  Contract: `CONTRACT_INIT_RESUME` from `session-api.ts`

- [ ] **T003** [P] Contract test: Session should persist user messages
  File: `codex-chrome/tests/core/session-rollout-persist-user.test.ts`
  Contract: `CONTRACT_PERSIST_USER_MSG` from `session-api.ts`

- [ ] **T004** [P] Contract test: Session should persist assistant responses
  File: `codex-chrome/tests/core/session-rollout-persist-assistant.test.ts`
  Contract: `CONTRACT_PERSIST_ASSISTANT_MSG` from `session-api.ts`

- [ ] **T005** [P] Contract test: Session should persist tool calls
  File: `codex-chrome/tests/core/session-rollout-persist-tool.test.ts`
  Contract: `CONTRACT_PERSIST_TOOL_CALL` from `session-api.ts`

- [ ] **T006** [P] Contract test: Session should handle persistence errors gracefully
  File: `codex-chrome/tests/core/session-rollout-error-handling.test.ts`
  Contract: `CONTRACT_HANDLE_PERSIST_ERROR` from `session-api.ts`

- [ ] **T007** [P] Contract test: Session should reconstruct history from rollout
  File: `codex-chrome/tests/core/session-rollout-reconstruct.test.ts`
  Contract: `CONTRACT_RECONSTRUCT_HISTORY` from `session-api.ts`

- [ ] **T008** [P] Contract test: Session should flush on shutdown
  File: `codex-chrome/tests/core/session-rollout-shutdown.test.ts`
  Contract: `CONTRACT_SHUTDOWN_FLUSH` from `session-api.ts`

- [ ] **T009** [P] Contract test: Session should continue if RolloutRecorder fails to initialize
  File: `codex-chrome/tests/core/session-rollout-graceful-degradation.test.ts`
  Contract: `CONTRACT_GRACEFUL_DEGRADATION` from `session-api.ts`

### Storage Contract Tests (5 tests)
- [ ] **T010** [P] Contract test: StorageQuotaManager should calculate storage from RolloutRecorder
  File: `codex-chrome/tests/storage/storage-quota-usage.test.ts`
  Contract: `CONTRACT_STORAGE_USAGE` from `storage-quota-api.ts`

- [ ] **T011** [P] Contract test: StorageQuotaManager should use RolloutRecorder cleanup
  File: `codex-chrome/tests/storage/storage-quota-cleanup.test.ts`
  Contract: `CONTRACT_CLEANUP` from `storage-quota-api.ts`

- [ ] **T012** [P] Contract test: StorageQuotaManager should not reference ConversationStore
  File: `codex-chrome/tests/storage/storage-quota-no-legacy.test.ts`
  Contract: `CONTRACT_NO_CONVERSATION_STORE` from `storage-quota-api.ts`

- [ ] **T013** [P] Contract test: StorageQuotaManager should detect quota exceeded
  File: `codex-chrome/tests/storage/storage-quota-exceeded.test.ts`
  Contract: `CONTRACT_QUOTA_EXCEEDED` from `storage-quota-api.ts`

- [ ] **T014** [P] Contract test: StorageQuotaManager should provide accurate stats
  File: `codex-chrome/tests/storage/storage-quota-stats.test.ts`
  Contract: `CONTRACT_STATS` from `storage-quota-api.ts`

### Cleanup Contract Tests (7 tests)
- [ ] **T015** [P] Contract test: Service worker should schedule cleanup on start
  File: `codex-chrome/tests/background/cleanup-schedule-on-start.test.ts`
  Contract: `CONTRACT_SCHEDULE_ON_START` from `cleanup-api.ts`

- [ ] **T016** [P] Contract test: Service worker should run cleanup on alarm
  File: `codex-chrome/tests/background/cleanup-run-on-alarm.test.ts`
  Contract: `CONTRACT_RUN_ON_ALARM` from `cleanup-api.ts`

- [ ] **T017** [P] Contract test: Cleanup should delete expired rollouts
  File: `codex-chrome/tests/background/cleanup-delete-expired.test.ts`
  Contract: `CONTRACT_DELETE_EXPIRED` from `cleanup-api.ts`

- [ ] **T018** [P] Contract test: Cleanup should handle errors gracefully
  File: `codex-chrome/tests/background/cleanup-handle-errors.test.ts`
  Contract: `CONTRACT_HANDLE_ERRORS` from `cleanup-api.ts`

- [ ] **T019** [P] Contract test: Cleanup should cascade delete items
  File: `codex-chrome/tests/background/cleanup-cascade-delete.test.ts`
  Contract: `CONTRACT_CASCADE_DELETE` from `cleanup-api.ts`

- [ ] **T020** [P] Contract test: Cleanup should batch large cleanups
  File: `codex-chrome/tests/background/cleanup-batch.test.ts`
  Contract: `CONTRACT_BATCH_CLEANUP` from `cleanup-api.ts`

- [ ] **T021** [P] Contract test: Cleanup should report bytes freed
  File: `codex-chrome/tests/background/cleanup-report-bytes.test.ts`
  Contract: `CONTRACT_REPORT_BYTES` from `cleanup-api.ts`

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Session Integration (4 tasks)
- [x] **T022** Update SessionServices to use RolloutRecorder
  File: `codex-chrome/src/core/session/state/SessionServices.ts`
  - Replace `conversationStore: ConversationStore` with `rollout: RolloutRecorder | null`
  - Update imports

- [x] **T023** Implement Session.initializeSession() with RolloutRecorder
  File: `codex-chrome/src/core/Session.ts`
  - Add `initializeSession(mode, conversationId, config)` method
  - Initialize RolloutRecorder (create or resume)
  - Call `reconstructHistoryFromRollout()` if resuming
  - Handle errors gracefully (set `rollout` to null on failure)

- [x] **T024** Implement Session.persistRolloutItems()
  File: `codex-chrome/src/core/Session.ts`
  - Replace `ConversationStore.addMessage()` calls with `persistRolloutItems()`
  - Record user messages as `type: 'event_msg'`
  - Record assistant responses as `type: 'response_item'`
  - Record tool calls embedded in `response_item` payload

- [x] **T025** Implement Session.reconstructHistoryFromRollout() and shutdown()
  File: `codex-chrome/src/core/Session.ts`
  - Add `reconstructHistoryFromRollout(items: RolloutItem[])`
  - Loop through items, add ResponseItem and Compacted to history
  - Skip event_msg, session_meta, turn_context (metadata only)
  - Add `shutdown()` method to call `rollout.flush()`

### Storage Updates (2 tasks)
- [x] **T026** Update StorageQuotaManager to use RolloutRecorder
  File: `codex-chrome/src/storage/StorageQuotaManager.ts`
  - Replace `ConversationStore.cleanup()` with `RolloutRecorder.cleanupExpired()`
  - Update `getStorageUsage()` to query rollouts/rollout_items stores
  - Update `getStats()` to calculate from RolloutRecorder
  - Remove all ConversationStore imports

- [x] **T027** Update service worker cleanup scheduling
  File: `codex-chrome/src/background/service-worker.ts`
  - Add `chrome.alarms.create('rollout-cleanup', { periodInMinutes: 60 })`
  - Add `chrome.alarms.onAlarm` listener
  - Call `RolloutRecorder.cleanupExpired()` on alarm
  - Log cleanup results

---

## Phase 3.4: Cleanup & Removal

- [x] **T028** Remove ConversationStore files
  Files to delete:
  - `codex-chrome/src/storage/ConversationStore.ts`
  - `codex-chrome/tests/storage/ConversationStore.test.ts` (if exists)
  - Any ConversationStore type definitions

- [x] **T029** Remove all ConversationStore imports
  Files to update:
  - `codex-chrome/src/core/Session.ts`
  - `codex-chrome/src/core/session/state/SessionServices.ts`
  - `codex-chrome/src/storage/StorageQuotaManager.ts`
  - `codex-chrome/src/background/service-worker.ts`
  - Search codebase: `grep -r "ConversationStore" codex-chrome/src/`

---

## Phase 3.5: Integration & Verification

- [ ] **T030** [P] Integration test: Session creates new rollout
  File: `codex-chrome/tests/integration/session-create-rollout.test.ts`
  - Create new session with mode='create'
  - Verify RolloutRecorder.create() called with correct params
  - Verify rollout exists in IndexedDB

- [ ] **T031** [P] Integration test: Session resumes from rollout
  File: `codex-chrome/tests/integration/session-resume-rollout.test.ts`
  - Create rollout with test data
  - Resume session from rollout
  - Verify history reconstructed correctly

- [ ] **T032** [P] Integration test: Cleanup deletes expired rollouts
  File: `codex-chrome/tests/integration/cleanup-expired.test.ts`
  - Create rollouts with expired TTL
  - Trigger cleanup
  - Verify expired rollouts deleted

- [ ] **T033** [P] Integration test: No ConversationStore references remain
  File: `codex-chrome/tests/integration/no-legacy-code.test.ts`
  - Run static analysis: `grep -r "ConversationStore" codex-chrome/src/`
  - Assert no matches found
  - Verify ConversationStore.ts file deleted

---

## Dependencies

**Phase Order**:
1. Phase 3.2 (Tests) → Must complete and FAIL before Phase 3.3
2. Phase 3.3 (Implementation) → Make tests pass
3. Phase 3.4 (Cleanup) → Only after all tests pass
4. Phase 3.5 (Integration) → Final verification

**Task Dependencies**:
- T001-T021 (Tests) → Must all be written and failing before T022
- T022 (SessionServices) blocks T023-T025 (Session methods need updated services)
- T023-T025 (Session) must complete before T028-T029 (cleanup)
- T026-T027 (Storage/Cleanup) can run in parallel with Session tasks
- T028-T029 (Removal) only after all implementation and tests pass
- T030-T033 (Integration) can run in parallel after all implementation complete

---

## Parallel Execution Examples

### Launch all contract tests together (T001-T021):
```bash
# Session tests [P]
Task: "Contract test: Session initialize on create" (T001)
Task: "Contract test: Session resume from rollout" (T002)
Task: "Contract test: Session persist user messages" (T003)
Task: "Contract test: Session persist assistant responses" (T004)
Task: "Contract test: Session persist tool calls" (T005)
Task: "Contract test: Session handle persistence errors" (T006)
Task: "Contract test: Session reconstruct history" (T007)
Task: "Contract test: Session flush on shutdown" (T008)
Task: "Contract test: Session graceful degradation" (T009)

# Storage tests [P]
Task: "Contract test: Storage calculate usage" (T010)
Task: "Contract test: Storage use RolloutRecorder cleanup" (T011)
Task: "Contract test: Storage no ConversationStore" (T012)
Task: "Contract test: Storage quota exceeded" (T013)
Task: "Contract test: Storage accurate stats" (T014)

# Cleanup tests [P]
Task: "Contract test: Cleanup schedule on start" (T015)
Task: "Contract test: Cleanup run on alarm" (T016)
Task: "Contract test: Cleanup delete expired" (T017)
Task: "Contract test: Cleanup handle errors" (T018)
Task: "Contract test: Cleanup cascade delete" (T019)
Task: "Contract test: Cleanup batch" (T020)
Task: "Contract test: Cleanup report bytes" (T021)
```

### Storage & Service Worker in parallel (T026-T027):
```bash
Task: "Update StorageQuotaManager to use RolloutRecorder" (T026)
Task: "Update service worker cleanup scheduling" (T027)
```

### Integration tests in parallel (T030-T033):
```bash
Task: "Integration test: Session creates new rollout" (T030)
Task: "Integration test: Session resumes from rollout" (T031)
Task: "Integration test: Cleanup deletes expired rollouts" (T032)
Task: "Integration test: No ConversationStore references remain" (T033)
```

---

## Notes

- **[P] tasks** = different test files, no dependencies, can run in parallel
- **TDD critical**: All tests (T001-T021) must FAIL before implementation (T022-T027)
- **No migration**: Users start fresh with RolloutRecorder (existing data not migrated)
- **Verification**: T033 ensures no ConversationStore code remains
- **Total tasks**: 33 (21 contract tests + 4 implementation + 2 cleanup + 4 integration + 2 removal)
- **Estimated time**: 1-2 hours total (no migration complexity)

---

## Validation Checklist
*GATE: Verify before marking tasks complete*

- [x] All 23 contracts have corresponding tests (T001-T021)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Session integration follows codex-rs patterns (research.md)
- [x] ConversationStore removal tasks included (T028-T029)
- [x] Integration tests verify end-to-end flow (T030-T033)

---

**Tasks Ready for Execution** ✅
**Next Step**: Implement T001-T021 (contract tests) and verify they FAIL, then proceed to T022
