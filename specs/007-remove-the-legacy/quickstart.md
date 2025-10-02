# Quickstart: Remove Legacy State from Session

**Feature**: 007-remove-the-legacy
**Date**: 2025-10-01

## Purpose

This quickstart validates that the State removal refactoring is complete and correct. It verifies:
1. ✅ All State references removed from Session.ts
2. ✅ SessionState is the sole persistent state container
3. ✅ All existing tests pass
4. ✅ No breaking changes to Session public API

---

## Prerequisites

- Node.js v22+
- pnpm 9.0+
- Repository cloned and dependencies installed

---

## Step 1: Verify Current State (Before Refactoring)

```bash
cd codex-chrome

# Check for State usage in Session.ts
grep -n "this.state\." src/core/Session.ts | wc -l
# Expected: ~31 lines (before refactoring)

# Check State import
grep -n "import.*State.*from.*'./State'" src/core/Session.ts
# Expected: 1 match (line 13)

# Run existing tests to establish baseline
pnpm test src/core/session/state/__tests__/
# Expected: All tests pass
```

**Checkpoint**: Baseline established ✅

---

## Step 2: Verify Refactoring Complete (After Implementation)

```bash
# Check for State usage in Session.ts (should be zero)
grep -n "this.state\." src/core/Session.ts | wc -l
# Expected: 0 lines

# Check State import removed
grep -n "import.*State.*from.*'./State'" src/core/Session.ts
# Expected: 0 matches

# Check SessionState is used
grep -n "this.sessionState\." src/core/Session.ts | wc -l
# Expected: Multiple lines (history operations delegated to SessionState)

# Verify private field was removed
grep -n "private state: State" src/core/Session.ts
# Expected: 0 matches
```

**Checkpoint**: State removed ✅

---

## Step 3: Verify SessionState Integration

```bash
# Check history delegation to SessionState
grep -n "this.sessionState.recordItems" src/core/Session.ts
# Expected: At least 2 matches (addToHistory, addResponseItem)

# Check token tracking delegation
grep -n "this.sessionState.addTokenUsage" src/core/Session.ts
# Expected: 1 match (addTokenUsage method)

# Check approved commands delegation
grep -n "this.sessionState.addApprovedCommand" src/core/Session.ts
grep -n "this.sessionState.isCommandApproved" src/core/Session.ts
# Expected: 1 match each
```

**Checkpoint**: SessionState integrated ✅

---

## Step 4: Verify Runtime State Migration

```bash
# Check for new private fields in Session
grep -n "private executionState" src/core/Session.ts
grep -n "private currentTurn" src/core/Session.ts
grep -n "private toolUsageStats" src/core/Session.ts
grep -n "private errorHistory" src/core/Session.ts
grep -n "private interruptRequested" src/core/Session.ts
grep -n "private pendingApprovals" src/core/Session.ts
# Expected: Each field defined once in Session class

# Verify these are NOT in SessionState
grep -n "executionState" codex-chrome/src/core/session/state/SessionState.ts
grep -n "currentTurn" codex-chrome/src/core/session/state/SessionState.ts
# Expected: 0 matches (runtime state not in SessionState)
```

**Checkpoint**: Runtime state correctly placed ✅

---

## Step 5: Run Full Test Suite

```bash
# Run all session state tests
pnpm test src/core/session/state/__tests__/

# Expected output:
# ✓ SessionState.test.ts - All pass
# ✓ Session.integration.test.ts - All pass
# ✓ Persistence.integration.test.ts - All pass
# ✓ FreshSession.integration.test.ts - All pass
# ✓ TurnExecution.integration.test.ts - All pass
# ✓ SessionServices.test.ts - All pass
# ✓ ActiveTurn.test.ts - All pass
# ✓ TurnState.test.ts - All pass
```

**Checkpoint**: All tests pass ✅

---

## Step 6: Verify Export/Import Clean Implementation

```bash
# Run persistence tests specifically
pnpm test src/core/session/state/__tests__/Persistence.integration.test.ts

# Expected behaviors verified:
# 1. Sessions export using SessionState format only
# 2. Import only accepts SessionState format
# 3. No legacy format handling code
# 4. Clean implementation matching Rust (codex-rs/core/src/codex.rs)
```

**Checkpoint**: Clean SessionState-only implementation ✅

---

## Step 7: Manual Integration Test

Create a test script to verify end-to-end behavior:

```typescript
// test-session-refactoring.ts
import { Session } from './src/core/Session';

async function testSessionRefactoring() {
  console.log('Testing Session without State...');

  // Test 1: Create new session
  const session = new Session();
  await session.initialize();
  console.log('✓ Session created');

  // Test 2: Add history
  await session.addToHistory({
    timestamp: Date.now(),
    text: 'Hello, agent!',
    type: 'user'
  });
  console.log('✓ History added');

  // Test 3: Verify history retrieval
  const history = session.getConversationHistory();
  if (history.items.length !== 1) throw new Error('History not saved');
  console.log('✓ History retrieved');

  // Test 4: Token tracking
  session.addTokenUsage(100);
  const exported = session.export();
  if (!exported.state.tokenInfo || exported.state.tokenInfo.total_tokens !== 100) {
    throw new Error('Token tracking failed');
  }
  console.log('✓ Token tracking works');

  // Test 5: Export/Import (SessionState format only)
  const exported2 = session.export();

  // Verify no legacy fields
  if (exported2.conversationHistory) {
    throw new Error('Legacy field found in export');
  }
  if (!exported2.state) {
    throw new Error('SessionState missing from export');
  }

  const imported = Session.import(exported2);
  const importedHistory = imported.getConversationHistory();
  if (importedHistory.items.length !== 1) {
    throw new Error('Import failed');
  }
  console.log('✓ Export/Import works (clean SessionState format)');

  // Test 6: Turn management
  await session.startTurn();
  if (!session.isActiveTurn()) throw new Error('Turn not active');
  await session.endTurn();
  if (session.isActiveTurn()) throw new Error('Turn still active');
  console.log('✓ Turn management works');

  console.log('\n✅ All manual tests passed!');
}

testSessionRefactoring().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
```

Run the test:
```bash
npx tsx test-session-refactoring.ts
# Expected: All tests pass
```

**Checkpoint**: Manual integration test passes ✅

---

## Step 8: Verify State.ts Can Be Removed

```bash
# Search for any remaining imports of State
grep -r "from.*['\"].*State['\"]" codex-chrome/src --exclude-dir=node_modules | grep -v SessionState | grep -v TurnState
# Expected: No matches (only SessionState and TurnState should remain)

# Check if State.ts is imported anywhere
grep -r "import.*State.*from.*'.*State'" codex-chrome/src --exclude-dir=node_modules
# Expected: Only SessionState, TurnState, ActiveTurn (no legacy State)
```

**Checkpoint**: State.ts can be safely removed ✅

---

## Step 9: Performance Validation

```bash
# Run performance-sensitive tests
pnpm test src/core/session/state/__tests__/Session.integration.test.ts -t "performance"

# Expected:
# - History operations complete in <10ms
# - Export/import complete in <50ms
# - No memory leaks (check with --detectLeaks flag)
```

**Checkpoint**: Performance acceptable ✅

---

## Step 10: Final Verification

```bash
# Type check
pnpm typecheck
# Expected: No errors

# Lint check
pnpm lint codex-chrome/src/core/Session.ts
# Expected: No errors

# Full test suite
pnpm test
# Expected: All tests pass (not just session tests)

# Build check
pnpm build
# Expected: Successful build
```

**Checkpoint**: Code quality verified ✅

---

## Success Criteria

All of the following MUST be true:

- ✅ `Session.ts` has zero references to `this.state`
- ✅ `Session.ts` does not import `State` from `./State`
- ✅ All test files in `src/core/session/state/__tests__/` pass
- ✅ Export format uses only SessionState (clean Rust-style implementation)
- ✅ Import only accepts SessionState format (no legacy support)
- ✅ Runtime state (executionState, currentTurn, etc.) exists as Session private fields
- ✅ No breaking changes to Session public API
- ✅ Performance targets met (<10ms for state operations)
- ✅ Type checking passes
- ✅ Build succeeds

---

## Rollback Plan

If any success criteria fail:

1. **Revert changes**: `git checkout codex-chrome/src/core/Session.ts`
2. **Verify tests pass**: `pnpm test`
3. **Investigate failure**: Review failing test output
4. **Fix and retry**: Address specific issue, re-run quickstart

---

## Next Steps

After successful completion:

1. **Remove State.ts**: Delete `codex-chrome/src/core/State.ts` (no longer needed)
2. **Update documentation**: Update CLAUDE.md if it references State class
3. **Create PR**: Submit pull request with changes
4. **Update changelog**: Document the refactoring

---

## Troubleshooting

### Issue: Tests fail with "Cannot read property 'getConversationHistory' of undefined"

**Cause**: SessionState not initialized properly

**Fix**: Verify `this.sessionState = new SessionState()` in Session constructor

---

### Issue: Import fails for legacy session data

**Cause**: Legacy import logic not handling old format

**Fix**: Check `Session.import()` handles `data.conversationHistory` fallback

---

### Issue: Runtime state lost after export/import

**Cause**: Runtime state incorrectly added to export

**Fix**: Ensure `export()` only exports SessionState, not runtime fields

---

### Issue: Performance regression

**Cause**: Excessive SessionState copying

**Fix**: Use `historySnapshot()` sparingly, cache results when possible

---

## Timeline

**Expected Duration**: 30 minutes

- Step 1-2: 5 minutes (verification)
- Step 3-4: 5 minutes (delegation checks)
- Step 5-6: 10 minutes (automated tests)
- Step 7: 5 minutes (manual testing)
- Step 8-10: 5 minutes (final checks)
