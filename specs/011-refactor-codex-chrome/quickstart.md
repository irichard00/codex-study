# Quickstart: SessionTask Architecture Alignment

**Feature**: Fix RegularTask to delegate to AgentTask instead of creating TaskRunner
**Date**: 2025-10-03

## Purpose

This document provides quick validation scenarios to verify that RegularTask correctly delegates to AgentTask instead of creating its own TaskRunner instance.

## Prerequisites

- TypeScript build passing
- AgentTask.ts exists and works correctly
- SessionTask interface defined
- Test environment set up with Vitest

## Scenario 1: RegularTask Creates AgentTask

**Goal**: Verify RegularTask creates an AgentTask instance when run() is called

**Setup**:
```typescript
import { RegularTask } from '@/core/tasks/RegularTask';
import { Session } from '@/core/Session';
import { TurnContext } from '@/core/TurnContext';
import type { InputItem } from '@/protocol/types';

const session = createMockSession();
const context = createMockTurnContext();
const subId = 'test-submission-001';
const input: InputItem[] = [{ type: 'text', text: 'Hello' }];
```

**Execute**:
```typescript
const regularTask = new RegularTask();
await regularTask.run(session, context, subId, input);
```

**Verify**:
- ✅ AgentTask constructor called with correct parameters
- ✅ No direct TaskRunner creation in RegularTask
- ✅ agentTask field is non-null after run()
- ✅ Task completes successfully

**Expected Behavior**: RegularTask delegates to AgentTask, which creates TaskRunner internally.

---

## Scenario 2: Input Conversion Works Correctly

**Goal**: Verify InputItem[] → ResponseItem[] conversion preserves data

**Setup**:
```typescript
const input: InputItem[] = [
  { type: 'text', text: 'Test message' },
  { type: 'text', text: 'Another message' }
];
```

**Execute**:
```typescript
const regularTask = new RegularTask();
// Access convertInput via reflection or test helper
const converted = regularTask['convertInput'](input);
```

**Verify**:
- ✅ Output is ResponseItem[] with type: 'message'
- ✅ Each item has role: 'user'
- ✅ Content matches original text
- ✅ All input items converted (no data loss)

**Expected Output**:
```typescript
[
  { type: 'message', role: 'user', content: 'Test message' },
  { type: 'message', role: 'user', content: 'Another message' }
]
```

---

## Scenario 3: Message Extraction from Session History

**Goal**: Verify RegularTask extracts final assistant message correctly

**Setup**:
```typescript
const session = createMockSession();
// Mock conversation history with assistant messages
session.getConversationHistory = () => ({
  items: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' },
    { role: 'assistant', content: 'I am doing well, thanks!' }
  ]
});
```

**Execute**:
```typescript
const regularTask = new RegularTask();
const message = await regularTask.run(session, context, subId, input);
```

**Verify**:
- ✅ Returned message is 'I am doing well, thanks!' (last assistant message)
- ✅ Not 'Hi there!' (earlier assistant message)
- ✅ Not user messages

**Expected Result**: `message === 'I am doing well, thanks!'`

---

## Scenario 4: Task Cancellation via Abort

**Goal**: Verify abort() calls agentTask.cancel()

**Setup**:
```typescript
const regularTask = new RegularTask();
const runPromise = regularTask.run(session, context, subId, input);
```

**Execute**:
```typescript
// Call abort while task is running
await regularTask.abort(session, subId);
```

**Verify**:
- ✅ agentTask.cancel() was called
- ✅ Task execution stops gracefully
- ✅ No errors thrown
- ✅ agentTask field set to null after abort

**Expected Behavior**: Task stops, AgentTask cancels TaskRunner via AbortController.

---

## Scenario 5: Empty History Handling

**Goal**: Verify RegularTask handles empty conversation history

**Setup**:
```typescript
const session = createMockSession();
session.getConversationHistory = () => ({ items: [] });
```

**Execute**:
```typescript
const regularTask = new RegularTask();
const message = await regularTask.run(session, context, subId, input);
```

**Verify**:
- ✅ No error thrown
- ✅ Returned message is null
- ✅ Task completes successfully

**Expected Result**: `message === null`

---

## Scenario 6: Multiple Abort Calls (Idempotency)

**Goal**: Verify abort() is safe to call multiple times

**Setup**:
```typescript
const regularTask = new RegularTask();
const runPromise = regularTask.run(session, context, subId, input);
```

**Execute**:
```typescript
await regularTask.abort(session, subId);
await regularTask.abort(session, subId);  // Second call
await regularTask.abort(session, subId);  // Third call
```

**Verify**:
- ✅ No errors thrown
- ✅ agentTask.cancel() called only once (or handles multiple calls gracefully)
- ✅ No memory leaks or hanging promises

**Expected Behavior**: Abort is idempotent, safe to call repeatedly.

---

## Scenario 7: AgentTask Integration (Full Stack)

**Goal**: Verify full execution path: RegularTask → AgentTask → TaskRunner

**Setup**:
```typescript
const session = createRealSession();  // Not mocked
const context = createRealTurnContext();
const input: InputItem[] = [{ type: 'text', text: 'Test input' }];
```

**Execute**:
```typescript
const regularTask = new RegularTask();
const message = await regularTask.run(session, context, subId, input);
```

**Verify**:
- ✅ AgentTask created with correct parameters
- ✅ AgentTask creates TaskRunner internally
- ✅ TaskRunner executes turn loop
- ✅ Final message extracted and returned
- ✅ No duplicate TaskRunner instances

**Expected Behavior**: Full delegation chain works end-to-end.

---

## Scenario 8: CompactTask Still Works (Regression Check)

**Goal**: Verify CompactTask unchanged and still functional

**Setup**:
```typescript
import { CompactTask } from '@/core/tasks/CompactTask';
const compactTask = new CompactTask();
```

**Execute**:
```typescript
const result = await compactTask.run(session, context, subId, input);
```

**Verify**:
- ✅ session.compact() called
- ✅ No AgentTask created (CompactTask doesn't need it)
- ✅ Returns null
- ✅ No errors

**Expected Result**: `result === null`, session history compacted.

---

## Integration Test Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegularTask } from '@/core/tasks/RegularTask';
import { AgentTask } from '@/core/AgentTask';

describe('RegularTask + AgentTask Integration', () => {
  let session, context, subId, input;

  beforeEach(() => {
    session = createMockSession();
    context = createMockTurnContext();
    subId = 'test-001';
    input = [{ type: 'text', text: 'Hello' }];
  });

  it('should create AgentTask and delegate execution', async () => {
    const regularTask = new RegularTask();
    const spy = vi.spyOn(AgentTask.prototype, 'run');

    await regularTask.run(session, context, subId, input);

    expect(spy).toHaveBeenCalled();
  });

  it('should convert InputItem[] to ResponseItem[]', async () => {
    const regularTask = new RegularTask();
    const converted = regularTask['convertInput'](input);

    expect(converted[0]).toMatchObject({
      type: 'message',
      role: 'user',
      content: 'Hello'
    });
  });

  it('should extract final assistant message', async () => {
    session.getConversationHistory = () => ({
      items: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' }
      ]
    });

    const regularTask = new RegularTask();
    const message = await regularTask.run(session, context, subId, input);

    expect(message).toBe('Hello!');
  });

  it('should call agentTask.cancel() on abort', async () => {
    const regularTask = new RegularTask();
    const runPromise = regularTask.run(session, context, subId, input);

    const spy = vi.spyOn(AgentTask.prototype, 'cancel');
    await regularTask.abort(session, subId);

    expect(spy).toHaveBeenCalled();
  });
});
```

---

## Validation Checklist

Before marking this feature complete, verify:

- [ ] **Scenario 1**: RegularTask creates AgentTask ✅
- [ ] **Scenario 2**: Input conversion works correctly ✅
- [ ] **Scenario 3**: Message extraction works ✅
- [ ] **Scenario 4**: Abort calls agentTask.cancel() ✅
- [ ] **Scenario 5**: Empty history handled gracefully ✅
- [ ] **Scenario 6**: Multiple aborts are safe ✅
- [ ] **Scenario 7**: Full stack integration works ✅
- [ ] **Scenario 8**: CompactTask unchanged ✅

## Success Criteria

✅ **All scenarios pass**
✅ **TypeScript build succeeds with no errors**
✅ **No direct TaskRunner creation in RegularTask**
✅ **AgentTask coordinator pattern preserved**
✅ **Backward compatibility maintained**

## Troubleshooting

### Issue: "Cannot create AgentTask"

**Cause**: Missing or incorrect constructor parameters
**Fix**: Ensure session.getSessionId() exists and returns valid ID

### Issue: "Message extraction returns null"

**Cause**: No assistant messages in conversation history
**Fix**: Verify AgentTask execution completed and added assistant response

### Issue: "Abort doesn't stop task"

**Cause**: agentTask is null when abort() called
**Fix**: Ensure run() has started before calling abort()

---

## Next Steps

After validating all scenarios:
1. Run full test suite: `npm test`
2. Build production: `npm run build`
3. Update CLAUDE.md with architectural changes
4. Mark task as complete in tasks.md
