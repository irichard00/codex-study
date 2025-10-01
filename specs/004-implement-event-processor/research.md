# Phase 0: Research & Technical Decisions

**Feature**: Event Processor for Side Panel UI
**Date**: 2025-09-30

## Overview
Research findings for implementing a real-time event processor that transforms 30+ technical event types into human-readable UI displays in a Chrome extension side panel.

## Key Technical Decisions

### 1. Event Processing Architecture

**Decision**: Separate EventProcessor class with pure transformation logic + Svelte components for rendering

**Rationale**:
- Mirrors the Rust implementation structure (EventProcessorWithHumanOutput)
- Enables unit testing of event transformation logic independently of UI
- Allows different UI components to consume processed events
- Maintains single responsibility principle

**Alternatives Considered**:
- **Inline processing in App.svelte**: Rejected - would create a monolithic component that's hard to test and maintain
- **Redux/Vuex-style store**: Rejected - adds unnecessary complexity for this use case, event processing is primarily a transformation pipeline

**Reference**: codex-rs/exec/src/event_processor_with_human_output.rs uses EventProcessor trait with separate state management

---

### 2. Streaming Event Handling

**Decision**: Implement delta accumulation with batched UI updates (500ms throttle)

**Rationale**:
- Rust implementation flushes stdout after each delta to ensure real-time display
- Browser UI needs throttling to prevent excessive resource consumption
- 500ms provides good balance between responsiveness and browser resource usage
- Prevents rapid DOM updates that can cause performance issues in browser environment
- Existing MessageDisplay.svelte uses batching pattern as reference

**Alternatives Considered**:
- **requestAnimationFrame**: Rejected - too frequent for text updates, wastes cycles
- **No throttling**: Rejected - would cause performance issues with rapid deltas
- **Shorter throttle (50-100ms)**: Rejected - too fast refresh can cause browser resource consuming
- **Longer throttle (1000ms+)**: Rejected - feels too sluggish to users

**Implementation Pattern**:
```typescript
// Accumulate deltas in buffer
streamBuffer += delta;

// Batch updates with setTimeout
if (!updateTimer) {
  updateTimer = setTimeout(() => {
    content = streamBuffer;
    updateTimer = null;
  }, 500);
}
```

---

### 3. Event Type Categorization

**Decision**: Group 30+ events into 8 display categories with type-specific renderers

**Rationale**:
- Reduces UI complexity by treating similar events uniformly
- Matches user mental model (they care about "what happened" not event type names)
- Enables consistent styling within categories

**Categories**:
1. **Task Lifecycle** (TaskStarted, TaskComplete, TaskFailed) - Status indicators
2. **Agent Messages** (AgentMessage, AgentMessageDelta) - Primary content with streaming
3. **Agent Reasoning** (AgentReasoning*, 4 types) - Collapsible thought process display
4. **Tool Calls** (McpToolCallBegin/End, ExecCommandBegin/End, WebSearch, PatchApply) - Operation cards with duration
5. **Command Output** (ExecCommandOutputDelta) - Terminal-style incremental output
6. **Errors** (Error, StreamError, TaskFailed) - Prominent error display
7. **Approvals** (ExecApprovalRequest, ApplyPatchApprovalRequest) - Interactive approval UI
8. **System Events** (TokenCount, PlanUpdate, Notification, etc.) - Info panels

**Alternatives Considered**:
- **One component per event type**: Rejected - creates 30+ components with lots of duplication
- **Single universal renderer**: Rejected - would be complex and hard to maintain

---

### 4. State Management for Multi-Event Operations

**Decision**: Track operation state using call_id maps (matches Rust implementation)

**Rationale**:
- Many operations span multiple events (Begin → Delta → End)
- Need to correlate events and calculate durations
- Rust uses HashMap<call_id, metadata> pattern successfully
- Enables showing accumulated output and final status together

**Pattern from Rust**:
```rust
call_id_to_command: HashMap<String, ExecCommandBegin>
call_id_to_patch: HashMap<String, PatchApplyBegin>
```

**TypeScript Equivalent**:
```typescript
private operationMetadata = new Map<string, OperationState>();

interface OperationState {
  type: 'exec' | 'tool' | 'patch';
  startTime: number;
  buffer?: string; // For incremental output
  metadata: any;
}
```

---

### 5. Formatting Utilities

**Decision**: Create formatters.ts module with helpers ported from Rust codebase

**Required Formatters** (from Rust analysis):
- `formatDuration(ms: number): string` - "2.3s", "45ms", etc.
- `formatTokens(tokens: number): string` - "1,234" with separators
- `formatTimestamp(date: Date): string` - "[2025-09-30T14:23:45]"
- `formatCommand(cmd: string[]): string` - Properly escapes shell commands
- `formatExitCode(code: number): string` - Color-coded success/failure
- `truncateOutput(text: string, maxLines: number): string` - Limits long outputs

**Rationale**:
- Rust implementation has extensive formatting that makes output readable
- Consistent formatting across all event types improves UX
- Centralized utilities are testable and reusable

**Reference**: Rust uses `codex_common::elapsed`, `num_format::format_with_separators`, and `shlex::try_join`

---

### 6. Visual Styling Strategy

**Decision**: Use Tailwind CSS utility classes with semantic color palette

**Color Mapping** (from Rust owo_colors styles):
- **Magenta** → `text-purple-400` - Tool names, operation headers
- **Green** → `text-green-400` - Success states, additions
- **Red** → `text-red-400` - Errors, deletions, failures
- **Cyan** → `text-cyan-400` - User input, links
- **Dimmed** → `text-gray-500` - Timestamps, secondary info
- **Bold** → `font-bold` - Emphasis on key information

**Rationale**:
- Tailwind already used in codebase (package.json)
- Terminal-style colors map naturally to web color palette
- Maintains visual consistency with Rust terminal output
- Accessible color contrast ratios

---

### 7. Performance Optimization

**Decision**: Implement virtualized scrolling for long event histories (>100 events)

**Rationale**:
- Single session can generate 100s-1000s of events
- Rendering all DOM nodes causes performance degradation
- FR-019 requires UI responsiveness during heavy processing

**Approach**:
- Use Svelte's `{#each}` with window-based rendering
- Keep only visible events + buffer in DOM
- Store full history in component state for scrollback

**Alternatives Considered**:
- **Render all events**: Rejected - degrades performance over time
- **Limit history to N events**: Rejected - loses debugging information
- **External library (react-window)**: Rejected - adds dependency, Svelte makes custom implementation simple

---

### 8. Testing Strategy

**Decision**: Three-layer testing approach

**Layer 1: Unit Tests** (EventProcessor.test.ts)
- Test each event type transformation independently
- Verify formatting functions with edge cases
- Mock time-dependent operations

**Layer 2: Component Tests** (EventDisplay.test.ts)
- Test Svelte components with @testing-library/svelte
- Verify correct rendering for each event category
- Test streaming behavior with simulated deltas

**Layer 3: Integration Tests** (eventFlow.test.ts)
- Test full pipeline: CodexAgent → MessageRouter → App.svelte → EventProcessor
- Verify multi-event operations (Begin → Delta → End sequences)
- Test performance with rapid event streams

**Rationale**:
- Matches testing pyramid (many unit, fewer integration)
- Unit tests enable TDD for event transformation logic
- Integration tests verify Chrome messaging doesn't break flow
- Component tests ensure UI renders correctly

---

## Resolved Clarifications

### From FR-017: Timestamp Display Format
**Decision**: Show relative time by default with absolute time on hover

**Rationale**:
- Relative time ("2 seconds ago") is more useful during active sessions
- Absolute time needed for reviewing logs/debugging
- Hover pattern is familiar and doesn't clutter UI

**Implementation**: Use `formatRelativeTime()` for display, store absolute timestamp in data attributes

---

### From FR-019: UI Latency Threshold
**Decision**: <50ms for event processing, <16ms for render updates (60fps)

**Rationale**:
- 50ms is below human perception threshold for "instant" feedback
- 16ms maintains 60fps for smooth animations
- Batching strategy ensures these targets are met

**Monitoring**: Add performance.mark() calls to measure in development

---

### From FR-020: Event History Management
**Decision**: Maintain full history within session, clear on new TaskStarted

**Rationale**:
- Users need to see full context for current task
- Clearing between tasks prevents UI clutter
- Each TaskStarted represents a new user request/turn
- History can be persisted elsewhere if needed for debugging

**Implementation**: Reset event list in App.svelte when TaskStarted event received

---

## Best Practices & Patterns

### From Rust EventProcessor Analysis

1. **State Tracking**: Track answer_started, reasoning_started flags to add headers only once
2. **Buffering**: Accumulate deltas before final event arrives (enables editing/correction)
3. **Truncation**: Limit command output to prevent overwhelming UI (MAX_OUTPUT_LINES = 20)
4. **Conditional Display**: Support hiding reasoning events (show_agent_reasoning flag)
5. **Graceful Degradation**: Handle missing call_ids and unknown event types

### Svelte-Specific Patterns

1. **Reactive Statements**: Use `$: processed = processEvent(event)` for automatic updates
2. **Stores**: Consider writable store for global event history if needed across components
3. **Actions**: Use Svelte actions for auto-scrolling to latest event
4. **Transitions**: Add subtle fade-in transitions for new events (improves perceived performance)

---

## Dependencies & Tools

### Required (Already in package.json)
- Svelte 4.2 - Component framework
- TypeScript 5.9 - Type safety
- Tailwind CSS 4.1 - Styling
- Vitest 3.2 - Testing framework
- @testing-library/svelte 5.2 - Component testing

### No New Dependencies Required
All functionality can be implemented with existing dependencies. Formatting utilities will be custom implementations matching Rust behavior.

---

## Risk Assessment

### Low Risk
- ✅ Event types already defined in protocol/events.ts
- ✅ Message routing infrastructure exists (MessageRouter)
- ✅ Reference implementation in Rust provides clear specification
- ✅ Testing tools in place

### Medium Risk
- ⚠️ Performance with 100+ events/second - Mitigated by batching strategy
- ⚠️ Complex multi-event operations - Mitigated by call_id tracking pattern from Rust

### Mitigations
- Implement performance monitoring early
- Start with simple event types, add complex ones incrementally
- Use Rust implementation as specification for edge cases

---

## Next Steps (Phase 1)

1. Define data model for processed events (ProcessedEvent interface)
2. Create EventProcessor class API contract
3. Design component interfaces (props, events)
4. Write contract tests for EventProcessor
5. Generate quickstart.md with integration test scenarios

---

**Status**: ✅ Research Complete - Ready for Phase 1 Design
