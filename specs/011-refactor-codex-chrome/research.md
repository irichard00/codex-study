# Research: SessionTask Architecture Alignment with AgentTask/TaskRunner

**Feature**: Fix SessionTask implementation to align with existing AgentTask/TaskRunner architecture
**Date**: 2025-10-03
**Status**: Architecture Conflict Identified

## Problem Statement

The newly implemented SessionTask interface (RegularTask, CompactTask) creates an **architectural conflict** with the existing AgentTask/TaskRunner coordinator pattern:

### Current Dual Architecture (Conflicting)

```
CodexAgent
    ├── AgentTask (existing coordinator)
    │   └── TaskRunner (execution logic)
    └── SessionTask (new interface)
        └── RegularTask (creates its own TaskRunner - DUPLICATE!)
```

### Conflict Details

1. **AgentTask.ts** (existing):
   - Acts as coordinator between CodexAgent and TaskRunner
   - Creates and owns TaskRunner instance
   - Provides lifecycle management (run, cancel, getStatus)
   - Lines 54-66: `this.taskRunner = new TaskRunner(...)`

2. **RegularTask.ts** (new):
   - Also creates its own TaskRunner instance
   - Duplicates the coordination logic
   - Lines 49-54: `this.taskRunner = new TaskRunner(...)`
   - **CONFLICT**: Two different objects creating TaskRunner for same purpose

3. **Rust Architecture**:
   - Rust has `SessionTask` trait but NO `AgentTask` equivalent
   - TypeScript port added `AgentTask` as browser-specific coordinator
   - New `SessionTask` implementation ignored existing `AgentTask`

## Root Cause Analysis

### Decision Point 1: Why AgentTask Exists

**AgentTask was added** to TypeScript codebase as a browser-specific enhancement:
- Provides cancellation support (AbortController)
- Tracks task status across async operations
- Owns TaskRunner lifecycle
- **Not present in Rust** - this is a TypeScript-specific pattern

**Evidence**:
```typescript
// AgentTask.ts:30-33
/**
 * AgentTask coordinates task execution by creating and managing its own TaskRunner
 * Implements the critical missing coordinator from codex-rs
 */
export class AgentTask {
```

### Decision Point 2: SessionTask Implementation Oversight

**RegularTask was created** following Rust patterns blindly:
- Rust `RegularTask` doesn't have AgentTask layer
- TypeScript port duplicated TaskRunner creation
- **Ignored existing AgentTask coordinator**

**Evidence**:
```typescript
// RegularTask.ts:49-54
this.taskRunner = new TaskRunner(
  session, context, turnManager, subId
);
```

This creates **two competing coordinator patterns**.

## Architectural Options

### Option 1: SessionTask Uses AgentTask (RECOMMENDED)

**Approach**: SessionTask implementations delegate to AgentTask instead of creating TaskRunner directly.

**Architecture**:
```
CodexAgent
    └── SessionTask interface
        ├── RegularTask
        │   └── AgentTask (coordinator)
        │       └── TaskRunner (execution)
        └── CompactTask
            └── Direct session.compact() (no AgentTask needed)
```

**Benefits**:
- ✅ Preserves existing AgentTask coordinator pattern
- ✅ Single source of truth for task lifecycle
- ✅ Consistent cancellation and status tracking
- ✅ Minimal changes to AgentTask (already works)
- ✅ Aligns with browser-specific patterns

**Tradeoffs**:
- SessionTask becomes a higher-level abstraction (delegates to AgentTask)
- Adds one layer of indirection (SessionTask → AgentTask → TaskRunner)

**Implementation**:
```typescript
// RegularTask.ts (refactored)
export class RegularTask implements SessionTask {
  private agentTask: AgentTask | null = null;

  async run(session, context, subId, input): Promise<string | null> {
    // Use AgentTask coordinator instead of creating TaskRunner
    this.agentTask = new AgentTask(session, context, turnManager, sessionId, subId, input);
    await this.agentTask.run();
    return this.agentTask.getLastMessage();
  }

  async abort(session, subId): Promise<void> {
    this.agentTask?.cancel();
  }
}
```

### Option 2: Remove AgentTask, SessionTask Creates TaskRunner (NOT RECOMMENDED)

**Approach**: Delete AgentTask, make SessionTask the only coordinator.

**Architecture**:
```
CodexAgent
    └── SessionTask interface (only coordinator)
        ├── RegularTask
        │   └── TaskRunner (execution)
        └── CompactTask
```

**Benefits**:
- ✅ Closer to Rust architecture (no AgentTask layer)
- ✅ Fewer layers of abstraction

**Tradeoffs**:
- ❌ Breaks existing code that uses AgentTask
- ❌ Loses browser-specific enhancements (AbortController integration)
- ❌ Requires rewriting CodexAgent to use SessionTask directly
- ❌ More disruptive change

**Rejected because**: AgentTask already works and provides valuable browser-specific features.

### Option 3: Merge AgentTask into SessionTask (NOT RECOMMENDED)

**Approach**: Make SessionTask implementations contain AgentTask's logic directly.

**Tradeoffs**:
- ❌ Duplicates AgentTask logic across RegularTask/CompactTask
- ❌ Violates DRY principle
- ❌ Makes testing harder

**Rejected because**: Code duplication and maintenance burden.

## Decision

**SELECTED: Option 1 - SessionTask Uses AgentTask**

**Rationale**:
1. **Preserve Working Code**: AgentTask is battle-tested and provides browser-specific value
2. **Minimal Disruption**: Only need to refactor SessionTask implementations
3. **Clear Separation**: SessionTask = high-level task type, AgentTask = execution coordinator, TaskRunner = turn loop
4. **Browser-First**: Keeps browser-specific patterns (AbortController, async lifecycle)

## Implementation Strategy

### Phase 1: Update RegularTask to Use AgentTask

**Changes Required**:
1. **RegularTask.ts**: Replace TaskRunner creation with AgentTask creation
2. **RegularTask.run()**: Delegate to `agentTask.run()`
3. **RegularTask.abort()**: Delegate to `agentTask.cancel()`
4. **Extract message**: Use `agentTask` methods instead of direct history access

**Affected Files**:
- `codex-chrome/src/core/tasks/RegularTask.ts` (~30 lines changed)

### Phase 2: Verify CompactTask Doesn't Need AgentTask

**Analysis**: CompactTask just calls `session.compact()` - doesn't need AgentTask coordinator.

**Status**: No changes needed for CompactTask.

### Phase 3: Update AgentTask Constructor (if needed)

**Analysis**: AgentTask constructor expects `ResponseItem[]` input but SessionTask.run() provides `InputItem[]`.

**Potential Issue**: Type mismatch between:
- AgentTask constructor: `input: ResponseItem[]`
- SessionTask.run(): `input: InputItem[]`

**Resolution Options**:
1. Add input conversion in RegularTask
2. Update AgentTask to accept InputItem[]
3. Keep dual signatures

**Decision**: Add conversion helper in RegularTask to maintain backward compatibility.

## Type Compatibility Analysis

### Input Type Mismatch

**AgentTask expects**:
```typescript
constructor(..., input: ResponseItem[])
```

**SessionTask.run provides**:
```typescript
run(..., input: InputItem[]): Promise<string | null>
```

**Conversion needed**:
```typescript
// InputItem → ResponseItem conversion
const responseItems: ResponseItem[] = input.map(item => ({
  type: 'message',
  role: 'user',
  content: item.text || JSON.stringify(item)
}));
```

### TurnManager Dependency

**AgentTask creates TurnManager** internally (line 44-45 in AgentTask.ts):
```typescript
// AgentTask already has TurnManager access
constructor(session, turnContext, turnManager, ...)
```

**RegularTask creates TurnManager** in run() method:
```typescript
// RegularTask.ts:42-46
const turnManager = new TurnManager(session, context, toolRegistry);
```

**Resolution**: Pass TurnManager to AgentTask constructor (already supported).

## Updated Architecture Diagram

```
┌─────────────┐
│ CodexAgent  │
└──────┬──────┘
       │
       │ creates & manages
       ▼
┌──────────────────┐
│  SessionTask     │ (interface)
│  - kind()        │
│  - run()         │
│  - abort()       │
└──────┬───────────┘
       │
       │ implements
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ RegularTask  │   │ CompactTask  │
└──────┬───────┘   └──────┬───────┘
       │                  │
       │ delegates to     │ calls directly
       ▼                  ▼
┌──────────────┐   ┌──────────────────┐
│  AgentTask   │   │ session.compact()│
└──────┬───────┘   └──────────────────┘
       │
       │ owns & coordinates
       ▼
┌──────────────┐
│  TaskRunner  │
└──────┬───────┘
       │
       │ uses
       ├────────────┐
       ▼            ▼
┌────────────┐  ┌─────────────┐
│ TurnManager│  │   Session   │
└────────────┘  └─────────────┘
```

## Testing Strategy

### Contract Tests

1. **RegularTask + AgentTask Integration**:
   - Test RegularTask creates AgentTask correctly
   - Test run() delegates to agentTask.run()
   - Test abort() delegates to agentTask.cancel()

2. **Input Conversion**:
   - Test InputItem[] → ResponseItem[] conversion
   - Test edge cases (empty input, complex content)

3. **Message Extraction**:
   - Test RegularTask returns final assistant message
   - Test null return when no message

### Integration Tests

1. **Full Task Lifecycle**:
   - CodexAgent → RegularTask → AgentTask → TaskRunner
   - Verify task completes successfully
   - Verify message returned correctly

2. **Cancellation Flow**:
   - Start RegularTask
   - Call abort() mid-execution
   - Verify AgentTask.cancel() called
   - Verify TaskRunner stops

## Migration Path

### Backward Compatibility

**Existing Code Using AgentTask Directly**: No changes needed - AgentTask API unchanged.

**New Code Using SessionTask**: Uses AgentTask internally - transparent.

### Rollout Plan

1. **Phase 1**: Update RegularTask implementation
2. **Phase 2**: Add integration tests
3. **Phase 3**: Verify build passes
4. **Phase 4**: Update documentation

## References

**Existing Files**:
- `codex-chrome/src/core/AgentTask.ts` - Coordinator pattern (153 lines)
- `codex-chrome/src/core/TaskRunner.ts` - Execution logic (~500 lines)
- `codex-chrome/src/core/tasks/RegularTask.ts` - Current implementation (88 lines)

**Rust Reference**:
- `codex-rs/core/src/codex.rs` - Original Codex struct (no AgentTask equivalent)

## Conclusion

**Problem**: Duplicate TaskRunner creation in RegularTask vs AgentTask

**Solution**: Make RegularTask delegate to AgentTask instead of creating TaskRunner directly

**Impact**: ~30 lines changed in RegularTask.ts, architectural clarity restored

**Risk**: Low - AgentTask already works, just connecting the layers properly
