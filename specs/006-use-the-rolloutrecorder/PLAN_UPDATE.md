# Plan Update: No Data Migration

**Date**: 2025-10-01
**Updated By**: User clarification - "no need to do data migration, only implement the code replacement"

---

## 🔄 Key Changes

### Before (Original Plan)
- ✅ Comprehensive data migration from ConversationStore to RolloutRecorder
- ✅ Migration validation, rollback, batch processing
- ✅ 35-40 tasks including migration implementation
- ✅ 4 API contract files (including migration-api.ts)

### After (Updated Plan)
- ✅ **Code replacement only** - no data migration
- ✅ Users start fresh with RolloutRecorder
- ✅ **20-25 tasks** (simplified, no migration tasks)
- ✅ **3 API contract files** (migration-api.ts removed)

---

## 📝 Updated Documents

### 1. **plan.md** ✓
- Summary updated: "code replacement only, no migration"
- Technical Context: No migration constraint
- Constitution Check: Fresh start, no migration complexity
- Task generation: Removed all migration tasks (20-25 tasks vs 35-40)

### 2. **research.md** ✓
- Section 2.3: Migration removed (fresh start decision)
- Decision 3 & 4: Migration decisions removed
- Alternative 3: Fresh start ACCEPTED
- Open questions: Migration questions marked N/A
- Implementation checklist: Migration tasks removed

### 3. **data-model.md** ✓
- Title: "Replacement" instead of "Migration"
- Section 3: Migration mapping removed (comparison only)
- Section 4-6: Migration entities, validation, rollback removed
- Summary: Code replacement overview (no migration)

### 4. **contracts/** ✓
- **Removed**: `migration-api.ts` (not needed)
- **Kept**: `session-api.ts`, `storage-quota-api.ts`, `cleanup-api.ts`

### 5. **quickstart.md** ✓
- Prerequisites: Added warning about no migration
- Step 1: Migration steps removed
- Steps renumbered (1-7 instead of 1-8)
- Testing checklist: Migration tests removed
- Troubleshooting: Migration issues removed
- Added: User communication about lost history

### 6. **README.md** ✓
- Planning summary: Fresh start clarified
- Deliverables: Migration docs removed
- Task count: 20-25 tasks (reduced from 35-40)
- Migration strategy: Replaced with "No Migration - Fresh Start"
- Expected tasks: Migration tasks removed

---

## 🎯 Simplified Scope

### What's Removed
- ❌ MigrationService class
- ❌ Migration validation (pre/post checks)
- ❌ Batch migration processor
- ❌ Rollback mechanism
- ❌ Migration status tracking
- ❌ Data preservation logic
- ❌ ConversationStore → RolloutRecorder mapping code

### What Remains
- ✅ Session.ts integration with RolloutRecorder
- ✅ SessionServices update (replace ConversationStore field)
- ✅ StorageQuotaManager update (use RolloutRecorder)
- ✅ Service worker cleanup scheduling
- ✅ ConversationStore code removal
- ✅ Contract tests (session, storage, cleanup)
- ✅ Integration tests (no migration tests)

---

## 📊 Impact Summary

| Aspect | Before | After | Change |
|--------|--------|-------|--------|
| **Estimated Tasks** | 35-40 | 20-25 | -15 tasks |
| **API Contracts** | 4 files | 3 files | -1 file |
| **Migration Code** | ~500 LOC | 0 LOC | -500 LOC |
| **Complexity** | High (migration risk) | Low (direct replacement) | Simplified |
| **User Impact** | Data preserved | Fresh start | Data loss (acceptable per user) |
| **Implementation Time** | 2-3 hours | 1-2 hours | -1 hour |

---

## ✅ Verification

All planning documents updated to reflect **no migration**:
- [x] plan.md - Task strategy updated
- [x] research.md - Migration sections removed
- [x] data-model.md - Comparison only (no mapping)
- [x] contracts/migration-api.ts - File deleted
- [x] quickstart.md - Migration steps removed
- [x] README.md - Summary updated

---

## 🚀 Ready for /tasks

The plan is now simplified and ready for task generation:

```bash
/tasks
```

Expected output: **20-25 tasks** for code replacement (no migration).

---

**Plan Update Complete** ✅
