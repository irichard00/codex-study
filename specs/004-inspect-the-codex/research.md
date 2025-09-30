# Research: TaskRunner Implementation Inspection

**Date**: 2025-09-29
**Context**: Comparing TypeScript TaskRunner.ts (codex-chrome) vs Rust run_task (codex-rs)

## Research Areas

### 1. Rust to TypeScript Porting Patterns

**Decision**: Use structural comparison approach with awareness of language idiom differences

**Rationale**:
- Rust uses `Result<T, E>` for error handling; TypeScript uses try/catch
- Rust uses `Arc<T>` for shared ownership; TypeScript uses direct references with garbage collection
- Rust uses `Vec<T>` and iterators; TypeScript uses arrays and map/filter
- Both support async/await but with different underlying mechanisms

**Alternatives considered**:
- Automated code translation tools (rejected: too rigid, misses semantic differences)
- Line-by-line comparison (rejected: languages too different syntactically)

**Key patterns to verify**:
- Loop structures (Rust `loop` → TypeScript `while`)
- Error propagation (Rust `?` operator → TypeScript exception handling)
- Shared state (Rust `Arc<Mutex<T>>` → TypeScript direct mutation)
- Option types (Rust `Option<T>` → TypeScript `T | undefined`)

---

### 2. SQ/EQ Architecture Preservation

**Decision**: Verify event emission patterns and queue interaction match semantically

**Rationale**:
- SQ/EQ (Submission Queue/Event Queue) is central to codex architecture
- Both implementations must emit same events at same lifecycle points
- Event types: TaskStarted, TaskComplete, TurnAborted, Error, BackgroundEvent

**Alternatives considered**:
- Ignore event ordering (rejected: breaks UI responsiveness)
- Add new event types (rejected: requires protocol changes)

**Key verification points**:
- Event emission timing (start of task, end of task, errors, aborts)
- Event payload structure matches protocol definitions
- Event IDs correctly track submission IDs
- No missing or duplicate events

---

### 3. Review Mode Isolation

**Decision**: Confirm isolated history management prevents session pollution

**Rationale**:
- Review mode requires separate conversation history from main session
- Rust implementation uses `review_thread_history: Vec<ResponseItem>`
- TypeScript implementation uses local array parameter in methods
- Critical for correctness: review turns must not affect parent session

**Alternatives considered**:
- Share history with flag (rejected: error-prone, side effects)
- Deep clone session (rejected: wasteful, complex)

**Key verification points**:
- Review mode history stays separate from session history
- Initial context seeding (environment context like working directory)
- History not persisted after review mode exits
- Input recording only happens in normal mode, not review mode

---

### 4. Token Management & Auto-Compaction

**Decision**: Verify token limit detection and compaction triggers match

**Rationale**:
- Rust uses 90% threshold for token limit detection (line 1850)
- Compaction attempted once before failing (line 1862: `auto_compact_recently_attempted`)
- TypeScript uses 75% threshold constant (line 69: `COMPACTION_THRESHOLD = 0.75`)
- **DISCREPANCY IDENTIFIED**: Different thresholds could cause behavioral differences

**Alternatives considered**:
- Remove auto-compact (rejected: context window overflow)
- Always compact (rejected: unnecessary API calls)

**Key verification points**:
- Token usage tracking accuracy
- Compaction threshold alignment (potential bug: 75% vs 90%)
- Retry logic after compaction
- Error messaging when compaction fails

---

### 5. Turn Loop Termination Conditions

**Decision**: Verify loop exits match between implementations

**Rationale**:
- Rust loop exits when: responses empty (line 1869), error occurs (line 1883), or cancellation
- TypeScript loop exits when: `taskComplete` flag set (line 172), cancelled, or error thrown
- Both implementations must converge on same termination logic

**Alternatives considered**:
- Timeout-based termination (rejected: not in original Rust)
- Max turns limit (accepted: TypeScript adds `MAX_TURNS = 50` constant)

**Key verification points**:
- Empty response detection (`responses.is_empty()` vs `processResult.taskComplete`)
- Error handling triggers exit
- Cancellation signal respected
- Max turns enforcement (TypeScript addition - verify if needed)

---

### 6. Response Item Type Handling

**Decision**: Map all Rust ResponseItem variants to TypeScript equivalents

**Rationale**:
- Rust handles: Message, FunctionCall, CustomToolCall, LocalShellCall, Reasoning (lines 1746-1823)
- TypeScript currently handles: Message with assistant role, tool calls with responses
- **GAP IDENTIFIED**: TypeScript missing explicit handlers for CustomToolCall, LocalShellCall, Reasoning

**Alternatives considered**:
- Generic handler (rejected: loses type safety)
- Skip unsupported types (rejected: breaks feature parity)

**Key verification points**:
- All response item variants from protocol are handled
- Call ID tracking for function/tool calls
- Output recording for all item types
- Reasoning item handling (new in Rust, may not be in TypeScript yet)

---

### 7. Dual Execution Paths (run() vs executeWithCoordination())

**Decision**: Identify purpose and recommend consolidation or clear separation

**Rationale**:
- TypeScript has two execution methods: `run()` (line 113) and `executeWithCoordination()` (line 471)
- Both implement turn loops with similar logic
- **DUPLICATION IDENTIFIED**: ~80% code overlap, maintenance burden
- Rust has single `run_task()` function

**Alternatives considered**:
- Keep both methods (needs justification)
- Extract shared logic to helper method
- Remove one method entirely

**Key verification points**:
- Understand AgentTask coordination requirements
- Determine if both paths are actually used
- Identify behavioral differences between paths
- Recommend consolidation strategy

---

### 8. Error Handling Completeness

**Decision**: Map Rust error paths to TypeScript equivalents

**Rationale**:
- Rust returns `Result<TurnRunResult, Error>` from `run_turn()` (line 1717)
- TypeScript uses try/catch with `TurnError` types
- Both should handle: network errors, API errors, cancellation, timeout

**Alternatives considered**:
- Throw all errors up (rejected: loses granularity)
- Catch and suppress errors (rejected: hides problems)

**Key verification points**:
- Retryable vs non-retryable error classification
- Error event emission
- TurnAborted event with correct reason
- Task cleanup on error

---

### 9. Cancellation Mechanisms

**Decision**: Compare Rust task removal vs TypeScript AbortSignal

**Rationale**:
- Rust: `sess.remove_task(&sub_id)` (line 1914) before completion
- TypeScript: `AbortSignal` pattern with event listeners (line 486)
- Both must cleanly stop execution and emit abort events

**Alternatives considered**:
- Polling cancellation flag (acceptable, used in TypeScript `cancelled` field)
- Promise rejection (rejected: not graceful)

**Key verification points**:
- Cancellation propagates to TurnManager
- In-flight API calls are aborted
- Proper cleanup occurs
- TurnAborted event emitted with 'user_interrupt' reason

---

## Summary of Findings

### Known Differences (Investigate if intentional or bugs)
1. **Token compaction threshold**: Rust 90% vs TypeScript 75%
2. **Max turns limit**: TypeScript adds explicit 50-turn limit, Rust has implicit limit
3. **Dual execution paths**: TypeScript has two methods, Rust has one
4. **Response item handling**: TypeScript appears to have gaps in handling all item types

### Research Validated
- ✅ Language idiom differences are expected and acceptable
- ✅ SQ/EQ architecture pattern is preserved in structure
- ✅ Review mode concept is present in both
- ✅ Event emission points exist in both

### Next Steps
Phase 1 will generate:
- **data-model.md**: Structure for categorizing findings (bug/architecture/duplication/feature-gap)
- **quickstart.md**: How to run the comparison and validate findings