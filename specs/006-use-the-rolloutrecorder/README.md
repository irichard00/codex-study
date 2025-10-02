# Feature 006: Replace ConversationStore with RolloutRecorder

**Branch**: `006-use-the-rolloutrecorder`
**Status**: ✅ Planning Complete - Ready for `/tasks` command
**Date**: 2025-10-01

---

## 📋 Planning Summary

This feature replaces the legacy ConversationStore with the newly implemented RolloutRecorder throughout the codex-chrome extension, aligning the storage architecture with the original codex-rs implementation.

**⚠️ Important**: This is a **code replacement only** - **no data migration** is performed. Users will start fresh with RolloutRecorder.

### Key Objectives
- ✅ ~~Migrate conversation data~~ → Not needed (fresh start)
- ✅ Update Session.ts to use RolloutRecorder (following codex-rs patterns)
- ✅ Update StorageQuotaManager and service worker cleanup
- ✅ Remove all ConversationStore code and references
- ✅ ~~Preserve user data~~ → Users start fresh (no migration)

---

## 📁 Deliverables

### Phase 0: Research ✓
- **`research.md`** - Detailed analysis of codex-rs session/rollout patterns
  - How codex-rs initializes RolloutRecorder in Session
  - Recording patterns (persist_rollout_items)
  - Persistence policy and filtering logic
  - Reconstruction from rollout items
  - Shutdown and cleanup patterns

### Phase 1: Design ✓
- **`data-model.md`** - Data model comparison (no migration)
  - ConversationStore vs RolloutRecorder comparison
  - ~~Migration mapping~~ → Removed (not applicable)
  - Schema version management (RolloutRecorder only)

- **`contracts/`** - API contracts (3 files)
  - ~~`migration-api.ts`~~ → Removed (no migration)
  - `session-api.ts` - Session integration interface
  - `storage-quota-api.ts` - Storage manager interface
  - `cleanup-api.ts` - Service worker cleanup interface

- **`quickstart.md`** - Developer guide
  - Step-by-step code replacement process (no migration)
  - Code examples for all updates
  - Testing and verification checklist
  - Troubleshooting guide

- **`CLAUDE.md`** - Updated with Feature 006 context ✓

### Phase 2: Task Planning (Described) ✓
- **Task generation approach documented in `plan.md`**
  - **20-25 tasks estimated** (reduced from 35-40, no migration tasks)
  - TDD workflow (tests before implementation)
  - Dependency ordering defined
  - Parallel execution markers identified

---

## 🔍 Research Highlights

### Key Patterns from codex-rs

1. **Initialization Pattern**:
   ```rust
   // Two modes: create new OR resume existing
   let rollout_params = match initial_history {
       Empty | Forked => RolloutRecorderParams::new(conversation_id, instructions),
       Resumed => RolloutRecorderParams::resume(rollout_path),
   };
   let rollout = RolloutRecorder::new(&config, rollout_params).await?;
   services.rollout = Mutex::new(Some(rollout));
   ```

2. **Recording Pattern**:
   ```rust
   async fn persist_rollout_items(&self, items: &[RolloutItem]) {
       if let Some(recorder) = self.services.rollout.lock().await.as_ref() {
           recorder.record_items(items).await; // Recorder filters internally
       }
   }
   ```

3. **Graceful Degradation**:
   - Wrapped in `Mutex<Option<>>` for safe cleanup
   - Errors logged but don't crash session
   - Session continues without persistence if recorder fails

### ~~Migration Strategy~~ (No Migration - Fresh Start)

**Decision**: No data migration performed. Users start fresh with RolloutRecorder.

**Rationale**:
- Simplifies implementation (no migration code)
- Reduces risk of data corruption
- Cleaner cutover to new storage system

**Impact**:
- Existing ConversationStore data remains untouched
- Users can manually delete old database if desired
- All new conversations use RolloutRecorder

---

## 🎯 Next Steps

### Run `/tasks` Command
```bash
/tasks
```

This will generate `tasks.md` with **20-25 numbered tasks** (reduced from 35-40):
- Contract tests (TDD - fail initially)
- ~~Migration implementation~~ → Removed
- Session integration
- Storage updates
- ConversationStore removal
- Integration tests

### Expected Task Structure
1. **~~T001-T007~~**: ~~Migration contract tests~~ → Removed
2. **T001-T009**: Session contract tests [P]
3. **T010-T014**: Storage contract tests [P]
4. **T015-T021**: Cleanup contract tests [P]
5. **~~T022-T026~~**: ~~Migration implementation~~ → Removed
6. **T022-T025**: Session integration
7. **T026-T027**: Storage/cleanup updates
8. **T028-T029**: ConversationStore removal
9. **T030-T035**: Integration tests (no migration tests)

---

## 📊 Performance Expectations

Based on RolloutRecorder performance tests (Feature 005):

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Write 10 items | <50ms | 1.02ms | ✅ 50x faster |
| Read 1000 items | <200ms | 8.67ms | ✅ 23x faster |
| List 50 conversations | <200ms | 3.83ms | ✅ 52x faster |
| Cleanup 100 rollouts | <500ms | 22ms | ✅ 23x faster |

~~Migration performance~~ (Not applicable - no migration)

---

## 🔗 Related Features

- **Feature 005**: RolloutRecorder implementation (complete) ✓
- **codex-rs**: Original Rust implementation (reference)

---

## 📝 Documentation

All documentation is in `specs/006-use-the-rolloutrecorder/`:
- `spec.md` - Feature specification (18 functional requirements)
- `research.md` - Technical research (codex-rs patterns, **no migration**)
- `data-model.md` - Data model comparison (**no migration**)
- `contracts/` - API contracts (**3 files** - migration contract removed)
- `quickstart.md` - Developer quickstart guide (code replacement only)
- `plan.md` - Implementation plan (updated for no migration)

---

**Status**: ✅ Planning Complete
**Ready for**: `/tasks` command to generate implementation tasks
**Branch**: `006-use-the-rolloutrecorder`
