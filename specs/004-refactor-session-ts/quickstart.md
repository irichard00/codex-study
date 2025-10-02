# Quickstart: Session Refactoring Validation

**Feature**: Refactor Session.ts to Match Rust Implementation Updates
**Purpose**: Step-by-step validation guide for the refactored Session architecture
**Date**: 2025-10-01

## Overview

This quickstart guide provides concrete steps to validate that the refactored Session implementation maintains feature parity with the original while improving organization and maintainability.

---

## Prerequisites

```bash
# Navigate to codex-chrome directory
cd codex-chrome

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to establish baseline
npm test
```

**Expected Output**:
- All existing tests should pass
- No build errors
- TypeScript compilation successful

---

## Phase 1: Validate New State Classes

### Step 1: Test SessionState

```bash
# Run SessionState unit tests
npm test -- SessionState.test.ts
```

**Success Criteria**:
- ✅ History recording works correctly
- ✅ Token tracking accumulates properly
- ✅ Approved commands are stored and retrieved
- ✅ Export/import round-trip preserves state
- ✅ Deep copy prevents mutation

**Manual Validation**:
```typescript
import { SessionState } from './core/state/SessionState';
import { ResponseItem } from './protocol/types';

// Create state
const state = new SessionState();

// Record items
const items: ResponseItem[] = [
  { role: 'user', content: 'Hello', timestamp: Date.now() },
  { role: 'assistant', content: 'Hi there!', timestamp: Date.now() }
];
state.recordItems(items);

// Verify history
const snapshot = state.historySnapshot();
console.assert(snapshot.length === 2, 'History should have 2 items');

// Verify immutability
snapshot[0].content = 'Modified';
const snapshot2 = state.historySnapshot();
console.assert(snapshot2[0].content === 'Hello', 'Original should be unchanged');

console.log('✅ SessionState validation passed');
```

### Step 2: Test ActiveTurn

```bash
# Run ActiveTurn unit tests
npm test -- ActiveTurn.test.ts
```

**Success Criteria**:
- ✅ Task registration and removal works
- ✅ Pending input queueing functions correctly
- ✅ Approval tracking works
- ✅ Abort cancels all tasks
- ✅ No tasks after drain

**Manual Validation**:
```typescript
import { ActiveTurn, TaskKind } from './core/state/ActiveTurn';

// Create turn
const turn = new ActiveTurn();

// Add task
const abortController = new AbortController();
turn.addTask('task-1', {
  handle: abortController,
  kind: TaskKind.Regular,
  startTime: Date.now(),
  subId: 'task-1'
});

// Verify task registered
console.assert(turn.hasTask('task-1'), 'Task should be registered');

// Remove task
const isEmpty = turn.removeTask('task-1');
console.assert(isEmpty, 'Turn should be empty after removing only task');

console.log('✅ ActiveTurn validation passed');
```

### Step 3: Test TurnState

```bash
# Run TurnState unit tests
npm test -- TurnState.test.ts
```

**Success Criteria**:
- ✅ Pending approvals can be added and removed
- ✅ Pending input queues correctly
- ✅ Clear operations work
- ✅ Take operations consume and clear

**Manual Validation**:
```typescript
import { TurnState } from './core/state/TurnState';
import { ReviewDecision } from './protocol/types';

// Create turn state
const turnState = new TurnState();

// Add pending approval
let approvalCalled = false;
turnState.insertPendingApproval('exec-1', (decision) => {
  approvalCalled = true;
  console.assert(decision === ReviewDecision.Approve);
});

// Resolve approval
const resolver = turnState.removePendingApproval('exec-1');
resolver?.(ReviewDecision.Approve);
console.assert(approvalCalled, 'Approval should have been called');

// Add pending input
turnState.pushPendingInput({
  role: 'user',
  content: [{ type: 'text', text: 'Interrupt!' }]
});

// Take input
const input = turnState.takePendingInput();
console.assert(input.length === 1, 'Should have 1 pending input');

// Verify cleared
const input2 = turnState.takePendingInput();
console.assert(input2.length === 0, 'Input should be cleared after take');

console.log('✅ TurnState validation passed');
```

---

## Phase 2: Validate Refactored Session

### Step 4: Test Session Initialization

```bash
# Run Session unit tests
npm test -- Session.test.ts
```

**Success Criteria**:
- ✅ Session initializes with default services
- ✅ Session initializes with provided services
- ✅ SessionState is created
- ✅ No active turn initially

**Manual Validation**:
```typescript
import { Session } from './core/Session';
import { AgentConfig } from './config/AgentConfig';

// Create session with defaults
const session = new Session();
await session.initialize();

console.assert(session.getId().startsWith('conv_'), 'Should have conversation ID');
console.assert(!session.isActiveTurn(), 'Should not have active turn');
console.assert(session.getConversationHistory().items.length === 0, 'History should be empty');

console.log('✅ Session initialization validation passed');
```

### Step 5: Test Turn Lifecycle

**Success Criteria**:
- ✅ Can start turn when idle
- ✅ Cannot start turn when already active
- ✅ Can end turn when active
- ✅ Cannot end turn when not active

**Manual Validation**:
```typescript
import { Session } from './core/Session';

const session = new Session();
await session.initialize();

// Start turn
await session.startTurn();
console.assert(session.isActiveTurn(), 'Turn should be active');

// Try to start again (should throw or no-op)
try {
  await session.startTurn();
  console.error('❌ Should not allow starting turn twice');
} catch (e) {
  console.log('✅ Correctly prevented duplicate turn start');
}

// End turn
await session.endTurn();
console.assert(!session.isActiveTurn(), 'Turn should be inactive');

// Try to end again (should throw or no-op)
try {
  await session.endTurn();
  console.error('❌ Should not allow ending turn when not active');
} catch (e) {
  console.log('✅ Correctly prevented ending inactive turn');
}

console.log('✅ Turn lifecycle validation passed');
```

### Step 6: Test State Delegation

**Success Criteria**:
- ✅ Recording input updates SessionState
- ✅ Token tracking updates SessionState
- ✅ History retrieval works
- ✅ Approved commands work

**Manual Validation**:
```typescript
import { Session } from './core/Session';
import { InputItem } from './protocol/types';

const session = new Session();
await session.initialize();

// Record input
const items: InputItem[] = [
  { type: 'text', text: 'Test message' }
];
await session.recordInput(items);

// Verify history
const history = session.getConversationHistory();
console.assert(history.items.length > 0, 'History should have items');

// Add token usage
session.addTokenUsage(100);

// Export and verify
const exported = session.export();
console.assert(exported.state.tokenInfo?.total_tokens === 100, 'Token count should be tracked');

console.log('✅ State delegation validation passed');
```

---

## Phase 3: Integration Tests

### Step 7: Full Turn Execution

**Scenario**: Execute a complete turn with tool calls and approvals

```typescript
import { Session } from './core/Session';
import { CodexAgent } from './core/CodexAgent';
import { InputItem } from './protocol/types';

async function testFullTurnExecution() {
  // Create session
  const session = new Session();
  await session.initialize();

  // Start turn
  await session.startTurn();

  // Simulate user input
  const items: InputItem[] = [
    { type: 'text', text: 'Search for React documentation' }
  ];
  await session.recordInput(items);

  // Simulate tool execution (would be done by TurnManager)
  // ... tool execution logic ...

  // Add token usage
  session.addTokenUsage(250);

  // End turn
  await session.endTurn();

  // Verify state
  const history = session.getConversationHistory();
  console.assert(history.items.length > 0, 'History should have messages');

  const stats = session.getMetadata();
  console.assert(stats.messageCount > 0, 'Message count should be tracked');

  console.log('✅ Full turn execution validation passed');
}

await testFullTurnExecution();
```

**Success Criteria**:
- ✅ Turn starts successfully
- ✅ Input is recorded
- ✅ Tool execution proceeds (if applicable)
- ✅ Token usage tracked
- ✅ Turn ends successfully
- ✅ History is preserved

### Step 8: Persistence Round-Trip

**Scenario**: Export session, create new session, import state

```typescript
import { Session } from './core/Session';
import { createSessionServices } from './core/state/SessionServices';

async function testPersistence() {
  // Create and populate session
  const session1 = new Session();
  await session1.initialize();

  await session1.recordInput([
    { type: 'text', text: 'Hello, world!' }
  ]);
  session1.addTokenUsage(50);
  session1.addApprovedCommand('npm install');

  // Export
  const exported = session1.export();

  // Create new session and import
  const services = await createSessionServices({}, true);
  const session2 = Session.import(exported, services);

  // Verify state preserved
  const history1 = session1.getConversationHistory();
  const history2 = session2.getConversationHistory();
  console.assert(
    history1.items.length === history2.items.length,
    'History length should match'
  );

  const meta1 = session1.getMetadata();
  const meta2 = session2.getMetadata();
  console.assert(
    meta1.messageCount === meta2.messageCount,
    'Message count should match'
  );

  console.log('✅ Persistence round-trip validation passed');
}

await testPersistence();
```

**Success Criteria**:
- ✅ Export succeeds
- ✅ Import succeeds
- ✅ History preserved
- ✅ Token info preserved
- ✅ Approved commands preserved
- ✅ Metadata preserved

### Step 9: Fresh Session Creation

**Scenario**: Verify clean session initialization with new architecture

```typescript
import { Session } from './core/Session';
import { createSessionServices } from './core/state/SessionServices';

async function testFreshSession() {
  // Create services
  const services = await createSessionServices({}, true);

  // Create new session
  const session = new Session(undefined, services);
  await session.initialize();

  // Verify clean state
  const history = session.getConversationHistory();
  console.assert(history.items.length === 0, 'Should have empty history');
  console.assert(!session.isActiveTurn(), 'Should have no active turn');

  // Add some data
  await session.recordInput([
    { type: 'text', text: 'Test message' }
  ]);

  // Export and verify
  const exported = session.export();
  console.assert(exported.state, 'Should have state in export');
  console.assert(exported.metadata, 'Should have metadata in export');

  console.log('✅ Fresh session creation validation passed');
}

await testFreshSession();
```

**Success Criteria**:
- ✅ New session creates cleanly
- ✅ Export format is correct
- ✅ State is properly structured
- ✅ No legacy code interfering

**Note**: Existing sessions will be lost when upgrading. Users should be warned to backup any important conversation history before upgrading.

---

## Phase 4: End-to-End Validation

### Step 10: Chrome Extension Integration

**Scenario**: Load extension, execute turn, verify state

```bash
# Build extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select codex-chrome/dist/

# Open extension popup and test
```

**Manual Test Steps**:

1. **Initial State**:
   - [ ] Extension loads without errors
   - [ ] Session is created with default state
   - [ ] No active turn initially

2. **Start Conversation**:
   - [ ] Type "Hello" in chat input
   - [ ] Click send
   - [ ] Turn starts successfully
   - [ ] Message appears in history

3. **Tool Execution** (if applicable):
   - [ ] Request web search: "Search for TypeScript docs"
   - [ ] Tool call is executed
   - [ ] Results are displayed
   - [ ] Turn completes

4. **Approval Flow** (if applicable):
   - [ ] Request action requiring approval: "Install package"
   - [ ] Approval dialog appears
   - [ ] Approve or reject
   - [ ] Action proceeds or is cancelled
   - [ ] Turn completes

5. **State Persistence**:
   - [ ] Close extension popup
   - [ ] Reopen extension popup
   - [ ] Conversation history is preserved
   - [ ] Can continue conversation

6. **Turn Interruption**:
   - [ ] Start long-running turn
   - [ ] Send new message to interrupt
   - [ ] Current turn aborts gracefully
   - [ ] New turn starts
   - [ ] Pending input is handled

**Success Criteria**:
- ✅ All manual test steps pass
- ✅ No console errors
- ✅ State is preserved across popup closes
- ✅ Turn lifecycle works correctly
- ✅ UI remains responsive

---

## Automated Test Suite

### Run All Tests

```bash
# Unit tests
npm test -- --testPathPattern="state/"

# Integration tests
npm test -- --testPathPattern="integration/"

# Coverage report
npm test -- --coverage
```

**Coverage Goals**:
- SessionState: >90%
- SessionServices: >80%
- ActiveTurn: >90%
- TurnState: >90%
- Session (refactored): >85%

### Continuous Integration

```bash
# Add to CI pipeline
npm run lint
npm run format:check
npm test
npm run build
```

**CI Success Criteria**:
- ✅ All tests pass
- ✅ No linting errors
- ✅ No formatting issues
- ✅ Build succeeds
- ✅ Coverage thresholds met

---

## Performance Validation

### Benchmark State Operations

```typescript
import { SessionState } from './core/state/SessionState';

function benchmarkStateOperations() {
  const state = new SessionState();

  // Benchmark recording 1000 items
  const startRecord = performance.now();
  for (let i = 0; i < 1000; i++) {
    state.recordItems([
      { role: 'user', content: `Message ${i}`, timestamp: Date.now() }
    ]);
  }
  const endRecord = performance.now();
  console.log(`Record 1000 items: ${endRecord - startRecord}ms`);

  // Benchmark snapshot
  const startSnapshot = performance.now();
  const snapshot = state.historySnapshot();
  const endSnapshot = performance.now();
  console.log(`Snapshot 1000 items: ${endSnapshot - startSnapshot}ms`);

  // Benchmark export
  const startExport = performance.now();
  const exported = state.export();
  const endExport = performance.now();
  console.log(`Export: ${endExport - startExport}ms`);

  // Benchmark import
  const startImport = performance.now();
  SessionState.import(exported);
  const endImport = performance.now();
  console.log(`Import: ${endImport - startImport}ms`);
}

benchmarkStateOperations();
```

**Performance Goals**:
- Record 1000 items: <100ms
- Snapshot 1000 items: <50ms
- Export: <50ms
- Import: <50ms

---

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
```bash
# Solution: Rebuild and ensure imports are correct
npm run build
# Check import paths in test files
```

**Issue**: State not persisting in extension
```bash
# Solution: Check storage permissions in manifest.json
# Verify ConversationStore is initialized
```

**Issue**: Turn doesn't start
```bash
# Solution: Check for uncaught exceptions
# Verify ActiveTurn is created correctly
# Check event emitter is set
```

**Issue**: Users complain about lost sessions
```bash
# Solution: Add migration warning in release notes
# Document that this is a breaking change
# Suggest backing up important conversations before upgrade
```

---

## Success Checklist

### Phase 1 ✅
- [ ] SessionState tests pass
- [ ] ActiveTurn tests pass
- [ ] TurnState tests pass
- [ ] Manual validations complete

### Phase 2 ✅
- [ ] Session initialization works
- [ ] Turn lifecycle works
- [ ] State delegation works
- [ ] All Session tests pass

### Phase 3 ✅
- [ ] Full turn execution works
- [ ] Persistence round-trip works
- [ ] Fresh session creation works
- [ ] Integration tests pass

### Phase 4 ✅
- [ ] Extension loads successfully
- [ ] All manual tests pass
- [ ] No console errors
- [ ] Performance benchmarks met

### Final Validation ✅
- [ ] All automated tests pass
- [ ] Coverage goals met
- [ ] CI pipeline passes
- [ ] Documentation updated
- [ ] Ready for production

---

## Next Steps

After all validation steps pass:

1. **Merge to main branch**
   ```bash
   git add .
   git commit -m "Refactor Session to match Rust state architecture"
   git push origin 004-refactor-session-ts
   # Create pull request
   ```

2. **Update documentation**
   - Update CLAUDE.md with new structure
   - Update architecture diagrams
   - Update API documentation

3. **Monitor production**
   - Watch for errors in Sentry/logging
   - Monitor performance metrics
   - Collect user feedback

4. **Future improvements**
   - Add MCP integration
   - Optimize state serialization
   - Add more granular state exports

---

## References

- **Feature Spec**: `specs/004-refactor-session-ts/spec.md`
- **Research**: `specs/004-refactor-session-ts/research.md`
- **Data Model**: `specs/004-refactor-session-ts/data-model.md`
- **Rust Implementation**: `codex-rs/core/src/state/`
