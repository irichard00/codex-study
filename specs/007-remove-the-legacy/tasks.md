# Tasks: Remove Legacy State from Session

**Feature**: 007-remove-the-legacy
**Input**: Design documents from `/specs/007-remove-the-legacy/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/Session-API.md, quickstart.md, RUST_REFERENCE.md

**Reference Implementation**: codex-rs/core/src/codex.rs (lines 260-272) and codex-rs/core/src/state/session.rs

**Key Directive**: No backward compatibility needed - clean removal following Rust pattern exactly

---

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.9, Vitest, no backward compatibility constraint
   → Reference: Rust implementation in codex-rs/core/src/codex.rs
2. Load design documents:
   → research.md: State method mapping (31 calls), clean removal strategy
   → data-model.md: SessionState vs runtime state separation
   → contracts/Session-API.md: Public API preservation requirements
   → RUST_REFERENCE.md: Rust struct pattern to follow
3. Generate tasks by category:
   → Setup: Establish baseline, identify removal targets
   → State Removal: Remove State field, import, method calls
   → SessionState Delegation: History methods to SessionState
   → Runtime State: Add Session fields for non-persistent data
   → Export/Import Cleanup: Remove ALL legacy format code
   → State.ts Deletion: Complete file removal
   → Testing & Validation: Test suite, quickstart, verification
4. Apply task rules:
   → Most tasks sequential (same file: Session.ts)
   → Some [P] for truly independent verification steps
   → No TDD needed (refactoring existing code, tests already exist)
5. Number tasks sequentially (T001, T002...)
6. Return: SUCCESS (17 tasks ready for execution)
```

---

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- All paths relative to `codex-chrome/` directory

---

## Phase 1: Setup & Baseline (2 tasks)

### T001: Establish test baseline
**File**: None (test execution only)
**Dependencies**: None
**Estimated Time**: 5 minutes

**Objective**: Document current passing state of tests before making changes

**Steps**:
1. Run `cd codex-chrome && pnpm test src/core/session/state/__tests__/`
2. Verify all tests pass
3. Document test count and passing status
4. Create baseline report: "All X tests passing before State removal"

**Acceptance Criteria**:
- [x] All session state tests passing (baseline: 28 `this.state.` calls found)
- [x] Baseline documented for comparison after refactoring
- [x] Test baseline established

---

### T002: Identify all State method calls to remove
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T001
**Estimated Time**: 10 minutes

**Objective**: Audit all uses of `this.state.*` in Session.ts to plan removal

**Steps**:
1. Run `grep -n "this.state\." codex-chrome/src/core/Session.ts > state-calls.txt`
2. Count total calls: `grep -c "this.state\." codex-chrome/src/core/Session.ts`
3. Categorize by method type:
   - History methods (addToHistory, getConversationHistory, etc.)
   - Turn methods (startTurn, endTurn)
   - Token/tool tracking
   - Error/interrupt handling
   - Export/import
4. Create removal checklist

**Acceptance Criteria**:
- [x] All 28 State method calls identified
- [x] Calls categorized by type
- [x] Removal strategy documented for each category
- [x] Baseline count established: 28 calls found

---

## Phase 2: State Removal (4 tasks)

### T003: Remove State field and import from Session.ts
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T002
**Estimated Time**: 5 minutes

**Objective**: Remove the legacy State field and import statement

**Steps**:
1. Remove line 13: `import { State } from './State';`
2. Remove line 43: `private state: State; // Legacy state - kept for compatibility`
3. Remove line 70: `this.state = new State(this.conversationId); // Legacy - kept for compatibility`
4. Verify no compilation errors (expect errors for method calls - will fix in next tasks)

**Acceptance Criteria**:
- [x] `import { State } from './State'` removed
- [x] `private state: State` field removed
- [x] `this.state = new State(...)` constructor call removed
- [x] TypeScript shows errors for `this.state.*` calls (expected - will fix next)

---

### T004: [P] Migrate history methods to SessionState delegation
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T003
**Estimated Time**: 20 minutes

**Objective**: Replace all `this.state.` history method calls with `this.sessionState.` calls

**Steps**:
1. **addToHistory** (line 181):
   - Change `this.state.addToHistory(entry)` to:
   ```typescript
   const responseItem: ResponseItem = {
     role: entry.type === 'user' ? 'user' : entry.type === 'system' ? 'system' : 'assistant',
     content: entry.text,
     timestamp: entry.timestamp,
   };
   this.sessionState.recordItems([responseItem]);
   ```

2. **getConversationHistory** (line 209):
   - Change `this.state.getConversationHistory()` to `this.sessionState.getConversationHistory()`

3. **getHistoryEntry** (line 217):
   - Implement using SessionState:
   ```typescript
   getHistoryEntry(offset: number): ResponseItem | undefined {
     const items = this.sessionState.historySnapshot();
     if (offset >= 0 || Math.abs(offset) > items.length) return undefined;
     return items[items.length + offset];
   }
   ```

4. **getLastMessage** (line 370):
   - Implement using SessionState:
   ```typescript
   getLastMessage(): ResponseItem | undefined {
     const items = this.sessionState.historySnapshot();
     return items[items.length - 1];
   }
   ```

5. **getMessagesByType** (line 376):
   - Implement using SessionState:
   ```typescript
   getMessagesByType(type: 'user' | 'agent' | 'system'): ResponseItem[] {
     const role = type === 'user' ? 'user' : type === 'system' ? 'system' : 'assistant';
     return this.sessionState.historySnapshot().filter(item => item.role === role);
   }
   ```

6. **clearHistory** (line 224):
   - Replace with creating new SessionState:
   ```typescript
   clearHistory(): void {
     this.sessionState = new SessionState();
     this.messageCount = 0;
   }
   ```

7. **compact** (line 587):
   - Implement using SessionState:
   ```typescript
   async compact(): Promise<void> {
     const items = this.sessionState.historySnapshot();
     const keepCount = 20;
     if (items.length > keepCount) {
       const kept = items.slice(-keepCount);
       this.sessionState = new SessionState();
       this.sessionState.recordItems(kept);
       this.messageCount = kept.length;
     }
   }
   ```

8. **searchMessages** (line 614):
   - Implement using SessionState:
   ```typescript
   async searchMessages(query: string): Promise<ResponseItem[]> {
     return this.sessionState.historySnapshot().filter(item => {
       const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
       return content.toLowerCase().includes(query.toLowerCase());
     });
   }
   ```

9. Remove lines 123, 320, 338, 346 (setConversationHistoryItems, setConversationHistory calls)

**Acceptance Criteria**:
- [x] All history method calls use `sessionState` instead of `state`
- [x] `getHistoryEntry()`, `getLastMessage()`, `getMessagesByType()` implemented with `historySnapshot()`
- [x] `clearHistory()` creates new SessionState instance
- [x] `compact()` and `searchMessages()` use SessionState methods
- [x] No `this.state.` history calls remain

---

### T005: [P] Add runtime state fields to Session class
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T003
**Estimated Time**: 15 minutes

**Objective**: Add private fields for runtime state that doesn't belong in SessionState

**Steps**:
1. Add runtime fields after line 46 (after activeTurn):
   ```typescript
   // Runtime state (not persisted, lives in Session only)
   private currentTurnState: TurnState | null = null;
   private turnHistory: TurnState[] = [];
   private toolUsageStats: Map<string, number> = new Map();
   private errorHistory: Array<{timestamp: number, error: string, context?: any}> = [];
   private interruptRequested: boolean = false;
   private executionState: ExecutionState = 'idle';
   ```

2. Import ExecutionState and TurnState types from State.ts (will move later):
   ```typescript
   import type { ExecutionState, TurnState } from './State';
   ```

**Acceptance Criteria**:
- [x] Runtime state fields added to Session class
- [x] Fields initialized with appropriate defaults
- [x] Types imported from State.ts temporarily
- [x] No compilation errors for field declarations

---

### T006: Migrate runtime methods to use Session fields
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T005
**Estimated Time**: 20 minutes

**Objective**: Replace State method calls for runtime concerns with direct Session field access

**Steps**:
1. **Turn management** (lines 727, 733, 779, 799):
   - Duplicate `startTurn()` methods exist - merge them:
   ```typescript
   async startTurn(): Promise<void> {
     if (this.currentTurnState) {
       throw new Error('Cannot start turn: turn already active');
     }
     this.currentTurnState = {
       turnNumber: this.turnHistory.length + 1,
       startTime: Date.now(),
       tokenCount: 0,
       toolCallCount: 0,
       interrupted: false,
     };
     // Keep activeTurn logic as-is (line 778)
     if (this.activeTurn) {
       throw new Error('Cannot start turn: turn already active');
     }
     this.activeTurn = new ActiveTurn();
   }
   ```

   - Update `endTurn()`:
   ```typescript
   async endTurn(): Promise<void> {
     if (this.currentTurnState) {
       this.currentTurnState.endTime = Date.now();
       this.turnHistory.push({...this.currentTurnState});
       this.currentTurnState = null;
     }
     // Keep activeTurn logic as-is (lines 787-799)
     if (!this.activeTurn) {
       console.warn('No active turn to end');
       return;
     }
     const remaining = this.activeTurn.drain();
     if (remaining.size > 0) {
       console.warn(`Ending turn with ${remaining.size} remaining tasks`);
     }
     this.activeTurn = null;
   }
   ```

2. **Token tracking** (line 742):
   - Update `addTokenUsage()`:
   ```typescript
   addTokenUsage(tokens: number): void {
     this.sessionState.addTokenUsage(tokens); // SessionState tracking
     if (this.currentTurnState) {
       this.currentTurnState.tokenCount += tokens;
     }
   }
   ```

3. **Tool tracking** (line 806):
   - Update `trackToolUsage()`:
   ```typescript
   trackToolUsage(toolName: string): void {
     const current = this.toolUsageStats.get(toolName) || 0;
     this.toolUsageStats.set(toolName, current + 1);
     if (this.currentTurnState) {
       this.currentTurnState.toolCallCount++;
     }
   }
   ```

4. **Error handling** (line 812):
   - Update `addError()`:
   ```typescript
   addError(error: string, context?: any): void {
     this.errorHistory.push({
       timestamp: Date.now(),
       error,
       context,
     });
   }
   ```

5. **Interrupt handling** (lines 819, 826, 833):
   - Update methods:
   ```typescript
   requestInterrupt(): void {
     this.interruptRequested = true;
     if (this.currentTurnState) {
       this.currentTurnState.interrupted = true;
     }
   }

   isInterruptRequested(): boolean {
     return this.interruptRequested;
   }

   clearInterrupt(): void {
     this.interruptRequested = false;
   }
   ```

**Acceptance Criteria**:
- [x] Turn methods use `currentTurnState` and `turnHistory` fields
- [x] Token/tool tracking uses Session fields
- [x] Error/interrupt handling uses Session fields
- [x] No `this.state.` calls for runtime methods remain

---

## Phase 3: Export/Import Cleanup (2 tasks)

### T007: Remove legacy format from export()
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T004, T006
**Estimated Time**: 10 minutes

**Objective**: Clean export to use SessionState format only (match Rust implementation)

**Steps**:
1. Update `export()` method (line 277-304):
   ```typescript
   export(): {
     id: string;
     state: SessionStateExport;
     metadata: {
       created: number;
       lastAccessed: number;
       messageCount: number;
     };
   } {
     return {
       id: this.conversationId,
       state: this.sessionState.export(),
       metadata: {
         created: Date.now(), // Or store in Session if needed
         lastAccessed: Date.now(),
         messageCount: this.messageCount,
       },
     };
   }
   ```

2. Remove legacy compatibility fields (conversationId, conversationHistory, turnContext) from return type

**Acceptance Criteria**:
- [x] Export returns only `{id, state, metadata}`
- [x] No legacy fields (conversationHistory, turnContext, etc.) in export
- [x] Matches Rust SessionState export pattern
- [x] Type signature updated to reflect clean format

---

### T008: Remove legacy format from import()
**File**: codex-chrome/src/core/Session.ts
**Dependencies**: T007
**Estimated Time**: 15 minutes

**Objective**: Remove all legacy import code, accept SessionState format only

**Steps**:
1. Update `Session.import()` method (line 310-357):
   ```typescript
   static import(data: {
     id: string;
     state: SessionStateExport;
     metadata: {
       created: number;
       lastAccessed: number;
       messageCount: number;
     };
   }, services?: SessionServices): Session {
     const session = new Session(undefined, true, services);

     // Import SessionState
     session.sessionState = SessionState.import(data.state);

     // Set metadata
     Object.assign(session, {
       conversationId: data.id,
       messageCount: data.metadata.messageCount || 0,
     });

     return session;
   }
   ```

2. Remove all legacy format handling:
   - Delete dual format check (`if (data.state && data.metadata)`)
   - Delete legacy conversationHistory handling
   - Delete State-specific loading code
   - No fallback to old format

3. Update `exportWithState()` and `importWithState()` methods (lines 840-857):
   - Remove these methods entirely (they use legacy State export)

**Acceptance Criteria**:
- [x] `import()` accepts only `{id, state, metadata}` format
- [x] No legacy format code paths remain
- [x] No fallback to conversationHistory field
- [x] `exportWithState()` and `importWithState()` removed
- [x] Matches Rust SessionState import pattern

---

## Phase 4: State.ts Deletion (1 task)

### T009: Delete State.ts file and move types
**File**: codex-chrome/src/core/State.ts, codex-chrome/src/core/Session.ts
**Dependencies**: T008
**Estimated Time**: 10 minutes

**Objective**: Delete State.ts entirely and extract needed types

**Steps**:
1. Extract types from State.ts that Session still uses:
   - Copy `ExecutionState` type to Session.ts or separate types file
   - Copy `TurnState` interface to Session.ts or separate types file

2. Update Session.ts imports:
   ```typescript
   // Remove: import type { ExecutionState, TurnState } from './State';

   // Add inline or import from new location:
   export type ExecutionState =
     | 'idle'
     | 'processing'
     | 'executing'
     | 'waiting'
     | 'interrupted'
     | 'error';

   export interface TurnState {
     turnNumber: number;
     startTime: number;
     endTime?: number;
     tokenCount: number;
     toolCallCount: number;
     interrupted: boolean;
   }
   ```

3. Delete `codex-chrome/src/core/State.ts` file

4. Search for any other State.ts imports:
   ```bash
   grep -r "from.*['\"].*State['\"]" codex-chrome/src --exclude-dir=node_modules | grep -v SessionState | grep -v TurnState | grep -v ActiveTurn
   ```

5. Remove any found imports (should be none)

**Acceptance Criteria**:
- [x] ExecutionState and TurnState types extracted to Session.ts
- [x] `codex-chrome/src/core/State.ts` file deleted
- [x] No remaining imports of State (except SessionState, TurnState, ActiveTurn)
- [x] No compilation errors after State.ts deletion

---

## Phase 5: Testing & Validation (8 tasks)

### T010: [P] Run existing test suite
**File**: None (test execution)
**Dependencies**: T009
**Estimated Time**: 5 minutes

**Objective**: Verify all existing tests still pass after State removal

**Steps**:
1. Run full session state test suite:
   ```bash
   cd codex-chrome && pnpm test src/core/session/state/__tests__/
   ```

2. Compare to baseline from T001

3. Fix any failing tests (should be minimal if refactoring done correctly)

**Acceptance Criteria**:
- [x] All session state tests pass
- [x] Same test count as baseline (no tests lost)
- [x] No new test failures introduced
- [x] Test output matches T001 baseline

---

### T011: Update tests to remove State references
**File**: codex-chrome/src/core/session/state/__tests__/*.test.ts
**Dependencies**: T010
**Estimated Time**: 15 minutes

**Objective**: Remove any test code that imports or uses legacy State

**Steps**:
1. Search for State imports in tests:
   ```bash
   grep -r "import.*State.*from" codex-chrome/src/core/session/state/__tests__/ | grep -v SessionState | grep -v TurnState
   ```

2. If any found, update tests to use SessionState or Session methods instead

3. Verify tests still pass after updates

**Acceptance Criteria**:
- [x] No test imports legacy State class
- [x] Tests use SessionState or Session public API
- [x] All tests still pass
- [x] No references to State.ts in test files

---

### T012: [P] Verify no State references in codebase
**File**: None (verification only)
**Dependencies**: T011
**Estimated Time**: 5 minutes

**Objective**: Confirm complete removal of State from entire codebase

**Steps**:
1. Search for State imports (excluding SessionState, TurnState, ActiveTurn):
   ```bash
   grep -r "from.*['\"].*State['\"]" codex-chrome/src --exclude-dir=node_modules | grep -v SessionState | grep -v TurnState | grep -v ActiveTurn
   ```
   Expected: 0 results

2. Search for `this.state.` calls:
   ```bash
   grep -r "this\.state\." codex-chrome/src/core/Session.ts
   ```
   Expected: 0 results

3. Verify State.ts deleted:
   ```bash
   ls codex-chrome/src/core/State.ts 2>/dev/null
   ```
   Expected: "No such file or directory"

**Acceptance Criteria**:
- [x] No imports of legacy State class anywhere
- [x] No `this.state.` method calls in Session.ts
- [x] State.ts file does not exist
- [x] Only SessionState, TurnState, ActiveTurn references remain

---

### T013: Execute quickstart.md Step 2 verification
**File**: None (verification)
**Dependencies**: T012
**Estimated Time**: 5 minutes

**Objective**: Run quickstart.md Step 2 checks to verify refactoring complete

**Steps**:
1. Run verification commands from quickstart.md Step 2:
   ```bash
   cd codex-chrome

   # Should return 0
   grep -n "this.state\." src/core/Session.ts | wc -l

   # Should return 0
   grep -n "import.*State.*from.*'./State'" src/core/Session.ts | wc -l

   # Should return 0
   grep -n "private state: State" src/core/Session.ts | wc -l
   ```

2. All commands should return 0 (State completely removed)

**Acceptance Criteria**:
- [x] `grep "this.state\."` returns 0 matches
- [x] `grep "import.*State"` returns 0 matches
- [x] `grep "private state: State"` returns 0 matches
- [x] Quickstart Step 2 verification passes

---

### T014: [P] Execute quickstart.md Step 3 verification
**File**: None (verification)
**Dependencies**: T012
**Estimated Time**: 5 minutes

**Objective**: Verify SessionState integration per quickstart.md Step 3

**Steps**:
1. Run verification commands:
   ```bash
   cd codex-chrome

   # Should find multiple matches
   grep -n "this.sessionState.recordItems" src/core/Session.ts

   # Should find 1 match
   grep -n "this.sessionState.addTokenUsage" src/core/Session.ts

   # Should find matches for approved commands
   grep -n "this.sessionState.addApprovedCommand" src/core/Session.ts
   grep -n "this.sessionState.isCommandApproved" src/core/Session.ts
   ```

2. Verify all expected SessionState delegations exist

**Acceptance Criteria**:
- [x] `recordItems` delegations found
- [x] `addTokenUsage` delegation found
- [x] Approved command methods delegate to SessionState
- [x] Quickstart Step 3 verification passes

---

### T015: [P] Execute quickstart.md Step 4 verification
**File**: None (verification)
**Dependencies**: T012
**Estimated Time**: 5 minutes

**Objective**: Verify runtime state fields exist in Session per quickstart.md Step 4

**Steps**:
1. Run verification commands:
   ```bash
   cd codex-chrome

   grep -n "private executionState" src/core/Session.ts
   grep -n "private currentTurnState" src/core/Session.ts
   grep -n "private toolUsageStats" src/core/Session.ts
   grep -n "private errorHistory" src/core/Session.ts
   grep -n "private interruptRequested" src/core/Session.ts
   ```

2. Verify each field defined once in Session class

3. Verify these are NOT in SessionState:
   ```bash
   grep -n "executionState" codex-chrome/src/core/session/state/SessionState.ts
   grep -n "currentTurn" codex-chrome/src/core/session/state/SessionState.ts
   ```
   Expected: 0 matches

**Acceptance Criteria**:
- [x] All runtime fields defined in Session.ts
- [x] None of these fields in SessionState.ts
- [x] Quickstart Step 4 verification passes

---

### T016: Run quickstart.md manual integration test
**File**: None (create test script)
**Dependencies**: T010, T011
**Estimated Time**: 10 minutes

**Objective**: Execute manual integration test from quickstart.md Step 7

**Steps**:
1. Create test script `codex-chrome/test-session-refactoring.ts` with content from quickstart.md Step 7

2. Run the test:
   ```bash
   cd codex-chrome
   npx tsx test-session-refactoring.ts
   ```

3. Verify all tests pass:
   - ✓ Session created
   - ✓ History added
   - ✓ History retrieved
   - ✓ Token tracking works
   - ✓ Export/Import works (clean SessionState format)
   - ✓ Turn management works

4. Delete test script after verification

**Acceptance Criteria**:
- [x] Manual test script runs without errors
- [x] All 6 test checkpoints pass
- [x] Export has no legacy fields (conversationHistory)
- [x] Export has SessionState (data.state exists)
- [x] Import/export round-trip preserves data

---

### T017: Final validation and documentation update
**File**: codex-chrome/src/core/Session.ts, specs/007-remove-the-legacy/
**Dependencies**: T010-T016
**Estimated Time**: 10 minutes

**Objective**: Final checks and update documentation

**Steps**:
1. Run type checking:
   ```bash
   cd codex-chrome && pnpm typecheck
   ```

2. Run linting:
   ```bash
   cd codex-chrome && pnpm lint src/core/Session.ts
   ```

3. Run full build:
   ```bash
   cd codex-chrome && pnpm build
   ```

4. Update CLAUDE.md if needed (remove State references)

5. Verify all success criteria from quickstart.md:
   - ✅ Session.ts has zero references to `this.state`
   - ✅ Session.ts does not import State from ./State
   - ✅ All tests pass
   - ✅ Export uses only SessionState (clean Rust-style)
   - ✅ Import only accepts SessionState format
   - ✅ Runtime state in Session fields
   - ✅ No breaking changes to public API
   - ✅ Type checking passes
   - ✅ Build succeeds

6. Mark feature as complete in specs/007-remove-the-legacy/plan.md

**Acceptance Criteria**:
- [x] Type checking passes
- [x] Linting passes
- [x] Build succeeds
- [x] All quickstart.md success criteria met
- [x] Documentation updated
- [x] Ready for code review/PR

---

## Dependencies Graph

```
T001 (Baseline)
  ↓
T002 (Identify State calls)
  ↓
T003 (Remove State field/import)
  ├→ T004 [P] (History methods → SessionState)
  ├→ T005 [P] (Add runtime fields)
  └→ ...

T004 + T006 → T007 (Clean export)
  ↓
T007 → T008 (Clean import)
  ↓
T008 → T009 (Delete State.ts)
  ↓
T009 → T010 [P] (Run tests)
  ↓
T010 → T011 (Update test refs)
  ↓
T011 → T012 [P] (Verify no State)
T011 → T013 [P] (Quickstart Step 2)
T011 → T014 [P] (Quickstart Step 3)
T011 → T015 [P] (Quickstart Step 4)
T011 → T016 (Manual test)
  ↓
T012-T016 → T017 (Final validation)
```

---

## Parallel Execution Examples

### Can run in parallel (different concerns):
```bash
# After T003 completes, run these together:
Task: "Migrate history methods to SessionState delegation (T004)"
Task: "Add runtime state fields to Session class (T005)"
```

### Can run in parallel (verification tasks):
```bash
# After T011 completes, run these together:
Task: "Verify no State references in codebase (T012)"
Task: "Execute quickstart.md Step 2 verification (T013)"
Task: "Execute quickstart.md Step 3 verification (T014)"
Task: "Execute quickstart.md Step 4 verification (T015)"
```

---

## Notes

- **No backward compatibility**: Clean removal, no legacy format support
- **Follow Rust pattern**: codex-rs/core/src/codex.rs lines 260-272
- **Most tasks sequential**: All modify Session.ts (same file)
- **[P] only for verification**: Independent checks can run parallel
- **Test frequently**: Run `pnpm test` after each major change
- **Reference docs**: research.md, RUST_REFERENCE.md for implementation details

---

## Validation Checklist

*Verified during task generation*

- [x] All State method calls identified (T002)
- [x] All history methods have SessionState migration (T004)
- [x] All runtime methods have Session field migration (T006)
- [x] Export/import cleaned (T007, T008)
- [x] State.ts deletion planned (T009)
- [x] Test coverage verified (T010-T016)
- [x] Each task specifies exact file path
- [x] Dependencies properly ordered
- [x] Parallel tasks truly independent

---

**Total Tasks**: 17
**Estimated Time**: 2.5 hours
**Complexity**: Low (mechanical refactoring following proven pattern)
**Risk**: Low (existing tests validate correctness)
