# Data Model: SessionTask Architecture Alignment

**Feature**: Fix RegularTask to delegate to AgentTask instead of creating TaskRunner
**Date**: 2025-10-03

## Overview

This document defines the updated data model for RegularTask to align with the existing AgentTask/TaskRunner coordinator pattern. The key change is replacing direct TaskRunner creation with delegation to AgentTask.

## Entities

### 1. SessionTask (Interface) - NO CHANGES

**Purpose**: Interface defining task lifecycle for different task types

**Fields**: None (interface)

**Methods**:
- `kind(): TaskKind` - Returns task type identifier
- `run(session: Session, context: TurnContext, subId: string, input: InputItem[]): Promise<string | null>` - Execute task
- `abort(session: Session, subId: string): Promise<void>` - Cancel task execution

**Validation Rules**:
- Must return non-null TaskKind from kind()
- run() must handle async execution properly
- abort() must be idempotent (safe to call multiple times)

**State Transitions**: N/A (interface)

**Relationships**:
- Implemented by RegularTask, CompactTask

**Code Estimate**: 0 lines (no changes)

---

### 2. RegularTask - UPDATE REQUIRED

**Purpose**: Implements normal conversation task execution by delegating to AgentTask coordinator

**Fields**:
```typescript
private agentTask: AgentTask | null = null;
```

**Previous Implementation** (INCORRECT):
```typescript
private taskRunner: TaskRunner | null = null;  // ❌ REMOVE - duplicates AgentTask's role
```

**Methods**:

#### `kind(): TaskKind`
**Returns**: `'Regular'`
**Changes**: None

#### `run(session, context, subId, input): Promise<string | null>` - MAJOR UPDATE
**Current Implementation** (INCORRECT):
```typescript
// Creates TaskRunner directly - duplicates AgentTask
const turnManager = new TurnManager(...);
this.taskRunner = new TaskRunner(...);  // ❌ WRONG
await this.taskRunner.executeWithCoordination(...);
```

**New Implementation** (CORRECT):
```typescript
async run(session, context, subId, input): Promise<string | null> {
  // Create TurnManager (needed by AgentTask)
  const turnManager = new TurnManager(
    session,
    context,
    session.getToolRegistry?.() || null
  );

  // Convert InputItem[] to ResponseItem[]
  const responseItems = this.convertInput(input);

  // Delegate to AgentTask coordinator (correct pattern)
  this.agentTask = new AgentTask(
    session,
    context,
    turnManager,
    session.getSessionId(),
    subId,
    responseItems
  );

  // Run task via AgentTask
  await this.agentTask.run();

  // Extract final message from session history
  const conversationHistory = session.getConversationHistory();
  const lastAgentMessage = conversationHistory.items
    .filter(item => item.role === 'assistant')
    .map(item => typeof item.content === 'string' ? item.content : JSON.stringify(item.content))
    .pop();

  return lastAgentMessage || null;
}
```

#### `abort(session, subId): Promise<void>` - MINOR UPDATE
**Current Implementation**:
```typescript
if (this.taskRunner) {
  this.taskRunner.cancel();  // ❌ Direct TaskRunner access
}
```

**New Implementation**:
```typescript
async abort(session, subId): Promise<void> {
  if (this.agentTask) {
    this.agentTask.cancel();  // ✅ Delegate to AgentTask
    this.agentTask = null;
  }
}
```

#### `convertInput(input: InputItem[]): ResponseItem[]` - NEW HELPER
**Purpose**: Convert SessionTask's InputItem[] to AgentTask's ResponseItem[]

**Implementation**:
```typescript
private convertInput(input: InputItem[]): ResponseItem[] {
  return input.map(item => ({
    type: 'message' as const,
    role: 'user' as const,
    content: item.text || JSON.stringify(item)
  }));
}
```

**Validation**: Must handle all InputItem types (text, image, tool_result)

**Validation Rules**:
- agentTask must be created before run() completes
- Input conversion must preserve all necessary data
- Message extraction must handle empty history
- Abort must be safe to call multiple times

**State Transitions**:
1. **Initial**: `agentTask = null`
2. **Running**: `run()` called → creates AgentTask → `agentTask.run()`
3. **Completed**: AgentTask finishes → extract message → return
4. **Aborted**: `abort()` called → `agentTask.cancel()` → `agentTask = null`

**Relationships**:
- **Uses**: AgentTask (creates and delegates to)
- **Uses**: TurnManager (creates and passes to AgentTask)
- **Implements**: SessionTask interface
- **Does NOT use**: TaskRunner (this is now AgentTask's responsibility)

**Code Estimate**: ~85 lines total (~30 lines changed from current implementation)

---

### 3. AgentTask - MINOR ADDITIONS (OPTIONAL)

**Purpose**: Coordinator between CodexAgent and TaskRunner (existing class, mostly unchanged)

**Current Fields** (no changes):
```typescript
private taskRunner: TaskRunner;
private submissionId: string;
private sessionId: string;
private status: TaskStatus;
private abortController: AbortController;
private input: ResponseItem[];
```

**Current Methods** (no changes needed):
- `run(): Promise<void>` - Execute task via TaskRunner
- `cancel(): void` - Abort task execution
- `getStatus(): TaskStatus` - Get current status
- `getSessionId(): string` - Get session ID
- `getCurrentTurnIndex(): number` - Delegate to TaskRunner
- `getTokenUsage(): TokenBudget` - Delegate to TaskRunner
- `injectUserInput(input: ResponseItem[]): Promise<void>` - Mid-task input injection

**Potential New Method** (if extracting message becomes complex):
```typescript
getLastMessage(): string | null {
  // Extract from task state or session history
  // This might not be needed if RegularTask can extract directly from session
}
```

**Decision**: Start WITHOUT adding getLastMessage(). RegularTask can access session.getConversationHistory() directly. Only add if needed.

**Validation Rules** (existing):
- Constructor must initialize all fields
- run() must be idempotent (safe to call after cancel)
- cancel() must be safe to call multiple times

**State Transitions** (existing, no changes):
1. **Initializing**: Constructor → status = 'initializing'
2. **Running**: run() called → status = 'running'
3. **Completed**: TaskRunner finishes → status = 'completed'
4. **Failed**: Error thrown → status = 'failed'
5. **Cancelled**: cancel() called → status = 'cancelled'

**Relationships**:
- **Owns**: TaskRunner (creates and manages)
- **Used by**: RegularTask (delegates to)
- **Uses**: Session, TurnContext, TurnManager

**Code Estimate**: 0-10 lines (0 if no getLastMessage, ~10 if added)

---

### 4. CompactTask - NO CHANGES

**Purpose**: Implements history compaction task (already correct, doesn't need AgentTask)

**Current Implementation**:
```typescript
async run(session, context, subId, input): Promise<string | null> {
  await session.compact();  // ✅ Correct - no AgentTask needed for simple operations
  return null;
}
```

**Validation Rules**: None changed

**Code Estimate**: 0 lines (no changes)

---

## Type Definitions

### InputItem (from protocol/types.ts)

```typescript
interface InputItem {
  type: 'text' | 'image' | 'tool_result';
  text?: string;
  // Other fields for image, tool_result types
}
```

### ResponseItem (from protocol/types.ts)

```typescript
interface ResponseItem {
  type: 'message';
  role: 'user' | 'assistant';
  content: string | object;
}
```

### TaskKind (from session/state/types.ts)

```typescript
type TaskKind = 'Regular' | 'Compact' | 'Review';
// Note: Review not implemented per user requirements
```

## Architectural Layers

```
┌─────────────────────┐
│   CodexAgent        │
│   (creates tasks)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   SessionTask       │  (interface)
│   - Regular         │
│   - Compact         │
└──────────┬──────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
┌──────────────────┐   ┌────────────────────┐
│   RegularTask    │   │   CompactTask      │
│   (delegates)    │   │   (direct call)    │
└─────────┬────────┘   └─────────┬──────────┘
          │                      │
          ▼                      ▼
┌──────────────────┐   ┌────────────────────┐
│   AgentTask      │   │ session.compact()  │
│   (coordinator)  │   └────────────────────┘
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│   TaskRunner     │
│   (execution)    │
└─────────┬────────┘
          │
          ├──────────────────┐
          ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ TurnManager  │   │   Session    │
└──────────────┘   └──────────────┘
```

## Summary Statistics

| Entity | Status | LOC Changed | Complexity |
|--------|--------|------------|-----------|
| SessionTask | No changes | 0 | Low |
| RegularTask | Update | ~30 | Medium |
| AgentTask | Optional add | 0-10 | Low |
| CompactTask | No changes | 0 | Low |
| **Total** | | **~30-40** | **Low-Medium** |

## Validation Requirements

### Type Safety
- ✅ InputItem → ResponseItem conversion must be type-safe
- ✅ All async methods must have proper Promise types
- ✅ Null handling for agentTask field

### Functional Correctness
- ✅ RegularTask creates AgentTask on run()
- ✅ RegularTask delegates execution to agentTask.run()
- ✅ Message extraction returns correct final assistant message
- ✅ Abort calls agentTask.cancel()
- ✅ Multiple abort calls don't cause errors

### Performance
- ✅ No unnecessary object creation
- ✅ Single AgentTask per RegularTask execution
- ✅ Proper cleanup on abort

## Migration Notes

**Backward Compatibility**:
- SessionTask interface unchanged → no breaking changes for callers
- AgentTask API unchanged → existing direct usage unaffected
- CompactTask unchanged → no impact

**Breaking Changes**:
- None for external API
- Internal: RegularTask no longer exposes taskRunner field (was private anyway)

**Testing Strategy**:
1. Contract tests for RegularTask + AgentTask integration
2. Integration tests for full task lifecycle
3. Verify existing AgentTask tests still pass
4. Verify build with strict TypeScript mode

## References

**Files**:
- `codex-chrome/src/core/tasks/SessionTask.ts` - Interface definition
- `codex-chrome/src/core/tasks/RegularTask.ts` - Implementation to update
- `codex-chrome/src/core/AgentTask.ts` - Coordinator (mostly unchanged)
- `codex-chrome/src/core/TaskRunner.ts` - Execution logic (no changes)
- `codex-chrome/src/protocol/types.ts` - Type definitions

**Related Documents**:
- `research.md` - Architectural analysis and decision rationale
- `plan.md` - Implementation plan
