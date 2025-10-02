# Phase 1 Design Artifacts: Missing Session Methods

## Overview

This directory contains the complete Phase 1 design documentation for implementing the 33 missing Session methods from codex-rs into the codex-chrome TypeScript implementation.

## Artifact Summary

### 1. Data Model (`data-model.md`)
**Purpose**: Comprehensive data structure definitions for all missing methods

**Contents**:
- Core configuration types (ConfigureSession, InitialHistory)
- Approval & review types (ReviewDecision, ApprovalCallback)
- Command execution types (ExecCommandContext, ExecToolCallOutput, ExecInvokeArgs)
- Token & rate limit types (TokenUsage, RateLimitSnapshot)
- Task lifecycle types (TurnAbortReason, RunningTask, SessionTask)
- Rollout & history types (RolloutItem, CompactedHistory)
- State transition diagrams
- Rust → TypeScript type mapping reference
- Integration points with existing SessionState, ActiveTurn, SessionServices
- Error handling patterns (custom Result type, error classes)

**Key Features**:
- TypeScript type definitions with full JSDoc comments
- Maps Rust patterns (Arc, Mutex, Result, oneshot channels) to TypeScript equivalents
- Type guards for discriminated unions
- Integration specifications for existing code

### 2. Contracts Directory (`contracts/`)
**Purpose**: Interface contracts defining behavior, preconditions, postconditions, and error handling for each method group

#### 2.1 Session Lifecycle (`session-lifecycle.contract.ts`)
- `new()` - Static factory method for session creation
- `initialize()` - Service initialization
- `record_initial_history()` - Initial history recording (new/resumed/forked modes)
- `next_internal_sub_id()` - Internal submission ID generation

#### 2.2 Approval Handling (`approval-handling.contract.ts`)
- `request_command_approval()` - Request approval for shell commands
- `request_patch_approval()` - Request approval for file patches
- `notify_approval()` - Deliver user decision to waiting task
- Promise-based approval pattern (replaces Rust oneshot channels)

#### 2.3 Event Management (`event-management.contract.ts`)
- `send_event()` - Persist and dispatch events
- `on_exec_command_begin()` - Emit command execution start event
- `on_exec_command_end()` - Emit command execution end event
- `run_exec_with_events()` - Execute command with full event lifecycle
- Helper methods: `notify_background_event()`, `notify_stream_error()`, `send_token_count_event()`

#### 2.4 Task Lifecycle (`task-lifecycle.contract.ts`)
- `spawn_task()` - Spawn new task with lifecycle management
- `abort_all_tasks()` - Abort all running tasks
- `on_task_finished()` - Handle task completion
- `interrupt_task()` - Public interrupt interface
- Supporting methods: `register_new_active_task()`, `take_all_running_tasks()`, `handle_task_abort()`

#### 2.5 Rollout Recording (`rollout-recording.contract.ts`)
- `persist_rollout_items()` - Persist items to rollout
- `reconstruct_history_from_rollout()` - Rebuild history from rollout
- `record_conversation_items()` - Record items to history and rollout
- `record_into_history()` - Append to in-memory history only
- `replace_history()` - Replace entire history
- `persist_rollout_response_items()` - Convert ResponseItems to RolloutItems
- `record_input_and_rollout_usermsg()` - Record user input with dual persistence

#### 2.6 Token Tracking (`token-tracking.contract.ts`)
- `update_token_usage_info()` - Update token counts from model response
- `update_rate_limits()` - Update rate limit snapshot
- `send_token_count_event()` - Emit token count event

**Contract Structure** (each contract includes):
- Interface signatures with TypeScript types
- Input/output parameters
- Behavior contracts (MUST/SHOULD/MAY clauses)
- Preconditions and postconditions
- Error handling specifications
- Integration examples with code snippets
- Test scenarios (10+ per contract)
- Implementation patterns (Promise-based approvals, AbortController pattern, etc.)

### 3. Quickstart Guide (`quickstart.md`)
**Purpose**: Step-by-step testing guide for developers

**Contents**:
- Prerequisites and setup
- Testing instructions for each category of methods
- Code examples for every method
- Integration test scenarios:
  - Complete session lifecycle
  - Approval workflow
  - Session resume and fork
- Verification checklist
- Troubleshooting guide
- Debug commands
- Next steps after verification

**Features**:
- Copy-paste ready test code
- Manual testing in Chrome extension
- Unit test patterns
- Integration test patterns
- Common issues and solutions

## File Structure

```
specs/008-implement-the-missing/
├── README.md                                    # This file
├── spec.md                                      # Feature specification
├── research.md                                  # Research findings
├── plan.md                                      # Implementation plan
├── data-model.md                                # Data structures (Phase 1)
├── contracts/                                   # Interface contracts (Phase 1)
│   ├── session-lifecycle.contract.ts
│   ├── approval-handling.contract.ts
│   ├── event-management.contract.ts
│   ├── task-lifecycle.contract.ts
│   ├── rollout-recording.contract.ts
│   └── token-tracking.contract.ts
└── quickstart.md                                # Testing guide (Phase 1)
```

## How to Use These Artifacts

### For Implementers

1. **Start with Data Model**: Review `data-model.md` to understand all type definitions and state management structures

2. **Study Contracts**: Read the relevant contract file for the category you're implementing:
   - Understand preconditions and postconditions
   - Note error handling requirements
   - Study the integration examples

3. **Implement with TDD**: Use the test scenarios in contracts and quickstart guide to write tests first

4. **Verify Integration**: Check integration points with SessionState, ActiveTurn, and SessionServices

### For Reviewers

1. **Check Type Safety**: Verify implementations match data model types
2. **Verify Contracts**: Ensure behavior contracts are fulfilled
3. **Test Coverage**: Confirm all test scenarios from contracts are covered
4. **Error Handling**: Validate error cases are handled per specifications

### For Documentation Writers

1. **API Reference**: Use contract interfaces for API documentation
2. **Examples**: Leverage integration examples from contracts
3. **Troubleshooting**: Expand on issues listed in quickstart guide

## Implementation Checklist

### Phase 1: Core State Management (Foundation) ✅
- [x] Data model document created
- [x] Contract files created (6 categories)
- [x] Quickstart guide created
- [ ] Review and approval

### Phase 2: Implementation (Next Steps)
Based on research.md priority order:

1. **Foundation** (Week 1-2)
   - [ ] TurnAbortReason, ReviewDecision enums
   - [ ] update_rate_limits(), send_token_count_event()
   - [ ] record_into_history(), replace_history()
   - [ ] persist_rollout_response_items()

2. **Event Infrastructure** (Week 2-3)
   - [ ] send_event() - Fix to persist to rollout
   - [ ] notify_background_event(), notify_stream_error()
   - [ ] send_token_count_event()

3. **Approval System** (Week 3-4)
   - [ ] request_command_approval()
   - [ ] request_patch_approval()
   - [ ] notify_approval()

4. **Task Lifecycle** (Week 4-6)
   - [ ] RunningTask type
   - [ ] register_new_active_task()
   - [ ] take_all_running_tasks()
   - [ ] handle_task_abort()
   - [ ] abort_all_tasks()
   - [ ] spawn_task()
   - [ ] on_task_finished()
   - [ ] interrupt_task()

5. **Command Execution Events** (Week 6-7)
   - [ ] ExecCommandContext, ExecToolCallOutput types
   - [ ] on_exec_command_begin(), on_exec_command_end()
   - [ ] run_exec_with_events()

6. **Advanced Features** (Week 7-8)
   - [ ] TurnDiffTracker service
   - [ ] inject_input()
   - [ ] call_tool() (MCP integration)
   - [ ] next_internal_sub_id()
   - [ ] record_input_and_rollout_usermsg()
   - [ ] update_token_usage_info()

7. **Initialization & History** (Week 8)
   - [ ] new() factory method
   - [ ] record_initial_history()
   - [ ] reconstruct_history_from_rollout() (enhance)
   - [ ] turn_input_with_history() (align signature)

8. **Polish** (Week 9)
   - [ ] Cleanup methods
   - [ ] Error handling improvements
   - [ ] Documentation
   - [ ] Performance optimization

## Key Design Decisions

### 1. TypeScript Adaptations
- **Rust Arc/Mutex** → Plain references (single-threaded JS)
- **Rust Result<T, E>** → Optional custom Result type or try/catch
- **Rust oneshot channels** → Promise with external resolver
- **Rust tokio::spawn** → Async function (no separate spawn)
- **Rust AbortHandle** → AbortController (Web API)

### 2. Promise-Based Approval Pattern
Instead of Rust's oneshot channels, we use:
```typescript
const { promise, resolve, reject } = createApprovalPromise();
// Store resolver in ActiveTurn
// Return promise to caller
// Resolve when user decides
```

### 3. Graceful Degradation
- Rollout persistence failures are logged but non-fatal
- Session continues without persistence if RolloutRecorder unavailable
- Event emission failures for non-critical events are logged

### 4. Browser Adaptations
- No native process execution (Chrome APIs or content scripts)
- IndexedDB or Chrome Storage API for persistence
- MCP integration may need browser-compatible bridge
- Service worker for background Session management

## References

- **Rust Implementation**: `codex-rs/core/src/codex.rs` (lines 334-1080)
- **Current TypeScript**: `codex-chrome/src/core/Session.ts`
- **Protocol Types**: `codex-chrome/src/protocol/types.ts`
- **Event Types**: `codex-chrome/src/protocol/events.ts`
- **SessionState**: `codex-chrome/src/core/session/state/SessionState.ts`
- **ActiveTurn**: `codex-chrome/src/core/session/state/ActiveTurn.ts`

## Questions & Clarifications

If you have questions about:
- **Type definitions** → See `data-model.md`
- **Method behavior** → See relevant contract file in `contracts/`
- **Testing** → See `quickstart.md`
- **Implementation priority** → See `research.md` (Phase 1-8)
- **Overall strategy** → See `plan.md`

## Next Phase

After Phase 1 design review and approval:
1. Begin implementation following priority order
2. Write unit tests based on contract test scenarios
3. Implement integration tests from quickstart guide
4. Update API documentation
5. Create migration guide for existing code

---

**Status**: Phase 1 Design Complete ✅
**Last Updated**: 2025-10-01
**Total Methods**: 33 missing methods mapped and documented
**Total Contract Files**: 6 categories
**Total Test Scenarios**: 60+ across all contracts
**Estimated Implementation**: 8-9 weeks
