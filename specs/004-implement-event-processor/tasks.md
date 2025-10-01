# Tasks: Event Processor for Side Panel UI

**Input**: Design documents from `/specs/004-implement-event-processor/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md
**Branch**: `004-implement-event-processor`
**Tech Stack**: TypeScript 5.9+, Svelte 4.2, Vite 5.4, Vitest 3.2, Tailwind CSS 4.1

## Execution Summary

This tasks file implements a comprehensive event processor for the Codex Chrome extension's side panel UI. The processor transforms 30+ event types into human-readable displays with 500ms throttling to prevent browser resource overconsumption.

**Key Implementation Points**:
- All event components go in `codex-chrome/src/sidepanel/components/event_display/` subdirectory
- EventCategory renamed to EventDisplayCategory throughout
- 500ms UI rendering throttle (not 50ms)
- TDD approach: Tests first, then implementation

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Paths are absolute from repository root

---

## Phase 3.1: Setup & Project Structure

- [x] **T001** Create event_display directory structure
  - Path: `codex-chrome/src/sidepanel/components/event_display/`
  - Create subdirectory for all event processing components
  - **Acceptance**: Directory exists and is empty ✓

- [x] **T002** Create types file with base type definitions
  - Path: `codex-chrome/src/types/ui.ts`
  - Define: ProcessedEvent, EventDisplayCategory, EventStatus, ColorClass, FontWeight, FontStyle, IconType
  - Import types from protocol/events.ts and protocol/types.ts
  - **Acceptance**: File compiles with no TypeScript errors ✓

- [x] **T003** [P] Define EventStyle interface in ui.ts
  - Path: `codex-chrome/src/types/ui.ts` (add to existing file)
  - Define EventStyle with textColor, textWeight, textStyle, bgColor, borderColor, icon, iconColor
  - Define style presets (task_started, task_complete, agent_message, error, etc.)
  - **Acceptance**: TypeScript compilation passes, presets exported ✓

- [x] **T004** [P] Define EventMetadata interface in ui.ts
  - Path: `codex-chrome/src/types/ui.ts` (add to existing file)
  - Fields: duration, startTime, endTime, tokenUsage, command, exitCode, workingDir, toolName, toolParams, filesChanged, diffSummary, model, turnCount
  - **Acceptance**: Interface compiles, all fields optional ✓

- [x] **T005** [P] Define OperationState and StreamingState interfaces
  - Path: `codex-chrome/src/types/ui.ts` (add to existing file)
  - OperationState: callId, type, startTime, buffer, processedEventId, metadata
  - StreamingState: type, buffer, processedEventId, startTime, lastUpdateTime, headerShown
  - **Acceptance**: Interfaces compile with proper types ✓

- [x] **T006** [P] Define ApprovalRequest and ContentBlock types
  - Path: `codex-chrome/src/types/ui.ts` (add to existing file)
  - ApprovalRequest with id, type, command, explanation, patch, callbacks
  - ContentBlock union type for text, code, diff, list, table
  - **Acceptance**: Types compile, callbacks properly typed ✓

---

## Phase 3.2: Formatter Utilities [P] - All Independent

- [x] **T007** [P] Implement formatDuration utility
  - Path: `codex-chrome/src/utils/formatters.ts` (create new file)
  - Function: formatDuration(ms: number): string
  - Logic: <1000ms → "Xms", <60s → "X.Xs", <60m → "Xm Ys", >=1h → "Xh Ym"
  - **Acceptance**: Unit tests pass for all ranges ✓

- [x] **T008** [P] Implement formatNumber utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatNumber(num: number, locale?: string): string
  - Use toLocaleString() with locale (default 'en-US')
  - **Acceptance**: Handles negatives, zeros, large numbers correctly ✓

- [x] **T009** [P] Implement formatTokens utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatTokens(tokens: number, label?: string): string
  - Calls formatNumber, adds singular/plural label
  - **Acceptance**: "1 token", "2 tokens", "1,234" formatting correct ✓

- [x] **T010** [P] Implement formatTime utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatTime(date: Date, format: 'relative' | 'absolute' | 'timestamp'): string
  - relative: <10s "just now", <60s "Xs ago", <60m "Xm ago", <24h "Xh ago", else date
  - absolute: "HH:MM:SS"
  - timestamp: "[YYYY-MM-DDTHH:MM:SS]"
  - **Acceptance**: All three formats work correctly ✓

- [x] **T011** [P] Implement formatCommand utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatCommand(command: string | string[], maxLength?: number): string
  - Handle array → string with shell escaping
  - Truncate with "..." if exceeds maxLength
  - **Acceptance**: Handles spaces, quotes, special chars, truncation ✓

- [x] **T012** [P] Implement formatExitCode utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatExitCode(exitCode: number): string
  - 0→"success", 127→"command not found (127)", 130→"interrupted (130)", 137→"killed (137)", else→"exited X"
  - **Acceptance**: All special codes return correct messages ✓

- [x] **T013** [P] Implement truncateOutput utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: truncateOutput(text: string, maxLines: number): string
  - Split on \n, if >maxLines return first N + "\n... (X more lines)"
  - **Acceptance**: Preserves trailing newlines, counts correctly ✓

- [x] **T014** [P] Implement formatBytes utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatBytes(bytes: number): string
  - <1024→"X B", <1024²→"X.X KB", <1024³→"X.X MB", >=1024³→"X.X GB"
  - **Acceptance**: All ranges formatted with 1 decimal place ✓

- [x] **T015** [P] Implement formatPercent utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatPercent(value: number, decimals?: number): string
  - Multiply by 100, round to decimals (default 0), add "%"
  - Clamp to 0-100 range
  - **Acceptance**: 0.5→"50%", 0.333→"33.3%" (1 decimal) ✓

- [x] **T016** [P] Implement formatDiffSummary utility
  - Path: `codex-chrome/src/utils/formatters.ts` (add to existing)
  - Function: formatDiffSummary(additions: number, deletions: number): string
  - Format: "+X -Y", omit zeros, "no changes" if both 0
  - **Acceptance**: "+5 -3", "+5", "-3", "no changes" cases work ✓

---

## Phase 3.3: Contract Tests [P] - Must Complete Before Implementation

**CRITICAL**: These tests MUST be written and MUST FAIL before any core implementation tasks (T025+)

- [x] **T017** [P] Write EventProcessor contract tests
  - Path: `codex-chrome/tests/unit/EventProcessor.contract.test.ts`
  - Implement all 6 tests from contracts/EventProcessor.contract.ts:
    - should transform AgentMessage to ProcessedEvent with category message
    - should accumulate AgentMessageDelta events
    - should correlate ExecCommand Begin/End events by call_id
    - should process Error event with error category
    - should clear state on reset
    - should handle unknown event types gracefully
  - **Acceptance**: All tests written ✓

- [x] **T018** [P] Write Formatter contract tests
  - Path: `codex-chrome/tests/unit/formatters.contract.test.ts`
  - Implement all 6 tests from contracts/Formatters.contract.ts:
    - formatDuration should format milliseconds correctly
    - formatNumber should add thousands separators
    - formatExitCode should return semantic status
    - truncateOutput should limit lines
    - formatTime with relative should show relative time
    - formatCommand should handle arrays
  - **Acceptance**: Tests written ✓

- [x] **T019** [P] Write EventDisplay component contract tests
  - Path: `codex-chrome/tests/unit/EventDisplay.contract.test.ts`
  - Implement behavioral tests from contracts/EventDisplay.contract.md:
    - Render simple message event
    - Toggle collapsible event
    - Show streaming indicator
    - Handle approval event
    - Truncate long content
  - Use @testing-library/svelte for component testing
  - **Acceptance**: Contract tests specified ✓

---

## Phase 3.4: Core EventProcessor Implementation

**Prerequisites**: T017 must be complete and failing

- [x] **T020** Implement EventProcessor class skeleton
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts`
  - Implement IEventProcessor interface from contract
  - Methods: processEvent(), reset(), getStreamingState(), getOperationState(), setShowReasoning(), setMaxOutputLines()
  - Initialize state maps: operationMetadata, streamingStates
  - **Acceptance**: Class implemented ✓

- [x] **T021** Implement event-to-category mapping
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Method: private getCategoryForEvent(msg: EventMsg): EventDisplayCategory
  - Map all 30+ event types to categories (task, message, reasoning, tool, output, error, approval, system)
  - **Acceptance**: All event types mapped ✓

- [x] **T022** Implement processEvent for 'message' category
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle: AgentMessage (complete), AgentMessageDelta (streaming)
  - Accumulate deltas in StreamingState
  - Create ProcessedEvent on completion
  - **Acceptance**: Message events processed ✓

- [x] **T023** Implement processEvent for 'error' category
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle: Error, StreamError, TaskFailed events
  - Apply error styling (red, bold, error icon)
  - **Acceptance**: Error events processed ✓

- [x] **T024** Implement streaming state management
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle delta accumulation for message and reasoning
  - Implement 500ms batching strategy (store deltas, create ProcessedEvent on completion)
  - Track headerShown flag to show header only once
  - **Acceptance**: Streaming state implemented ✓

- [x] **T025** Implement operation state management (call_id tracking)
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle Begin events: create OperationState entry
  - Handle Delta events: append to buffer
  - Handle End events: calculate duration, create ProcessedEvent, remove state
  - **Acceptance**: Operation tracking implemented ✓

- [x] **T026** Implement processEvent for 'task' category
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle: TaskStarted, TaskComplete, TaskFailed
  - Extract metadata: model, cwd, turnCount, tokenUsage
  - Apply appropriate styling (cyan for start, green for complete, red for fail)
  - **Acceptance**: Task events processed ✓

- [x] **T027** Implement processEvent for 'tool' category
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle: McpToolCallBegin/End, ExecCommandBegin/End, WebSearchBegin/End, PatchApplyBegin/End
  - Track operations with call_id
  - Calculate durations, format success/failure
  - **Acceptance**: Tool events processed ✓

- [x] **T028** Implement processEvent for 'reasoning' category
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Handle: AgentReasoning, AgentReasoningDelta, AgentReasoningRawContent, AgentReasoningRawContentDelta, AgentReasoningSectionBreak
  - Respect showReasoning flag
  - Mark as collapsible
  - **Acceptance**: Reasoning events processed correctly, hidden when showReasoning=false

- [ ] **T029** Implement processEvent for 'output', 'approval', 'system' categories
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - output: ExecCommandOutputDelta with stdout/stderr distinction
  - approval: ExecApprovalRequest, ApplyPatchApprovalRequest with callbacks
  - system: TokenCount, PlanUpdate, Notification
  - **Acceptance**: All categories process correctly

- [ ] **T030** Implement reset() and state getters
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - reset(): Clear all maps (operationMetadata, streamingStates)
  - getStreamingState(), getOperationState(): Return copies of state
  - setShowReasoning(), setMaxOutputLines(): Update config
  - **Acceptance**: T017 test "clear state on reset" passes

- [ ] **T031** Handle unknown event types gracefully
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventProcessor.ts` (add to existing)
  - Catch-all for unmapped event types
  - Create generic ProcessedEvent with category='system'
  - Log warning to console
  - **Acceptance**: T017 test "handle unknown event types" passes, all T017 tests pass

---

## Phase 3.5: Svelte UI Components in event_display/

**Prerequisites**: T020-T031 complete, EventProcessor working

- [ ] **T032** Implement EventDisplay.svelte base component
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventDisplay.svelte`
  - Props: event (ProcessedEvent), selected, onClick, onToggleCollapse
  - Render: timestamp, title, icon, collapsible header
  - Dispatch events: 'click', 'toggleCollapse', 'approval'
  - Select child component based on event.category
  - **Acceptance**: Component compiles, renders basic structure

- [ ] **T033** [P] Implement MessageEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/MessageEvent.svelte`
  - Props: event (ProcessedEvent with category='message')
  - Render: Purple italic "codex" header, content with markdown parsing
  - Show streaming cursor if event.streaming=true
  - **Acceptance**: Renders agent messages correctly, T019 "simple message" test passes

- [ ] **T034** [P] Implement ErrorEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/ErrorEvent.svelte`
  - Props: event (ProcessedEvent with category='error')
  - Render: Red bold "ERROR" with icon, error message prominently
  - Apply red border and background styling
  - **Acceptance**: Error events visually distinct, red styling applied

- [ ] **T035** [P] Implement TaskEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/TaskEvent.svelte`
  - Props: event (ProcessedEvent with category='task')
  - Render: Task status with icon (info/success/error)
  - Show metadata: model, turnCount, tokenUsage if available
  - **Acceptance**: TaskStarted shows cyan, TaskComplete shows green with stats

- [ ] **T036** [P] Implement ToolCallEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/ToolCallEvent.svelte`
  - Props: event (ProcessedEvent with category='tool')
  - Render: Tool name, command, duration, success/failure status
  - Collapsible output section
  - Color-code: green for success, red for failure
  - **Acceptance**: Tool calls show with proper formatting and collapsing

- [ ] **T037** [P] Implement ReasoningEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/ReasoningEvent.svelte`
  - Props: event (ProcessedEvent with category='reasoning')
  - Render: Purple italic "thinking" header, reasoning content
  - Collapsible by default
  - **Acceptance**: Reasoning displays correctly, can be collapsed

- [ ] **T038** [P] Implement OutputEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/OutputEvent.svelte`
  - Props: event (ProcessedEvent with category='output')
  - Render: Terminal-style output with monospace font
  - Distinguish stdout (normal) vs stderr (red)
  - Truncate to maxLines (20 default) with "show more" option
  - **Acceptance**: Command output displayed correctly, truncation works

- [ ] **T039** [P] Implement ApprovalEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/ApprovalEvent.svelte`
  - Props: event (ProcessedEvent with category='approval')
  - Render: Approval request with command/patch preview
  - Buttons: Approve, Reject, Request Change (if available)
  - Call event.requiresApproval callbacks on button click
  - **Acceptance**: T019 "handle approval event" test passes, buttons functional

- [ ] **T040** [P] Implement SystemEvent.svelte
  - Path: `codex-chrome/src/sidepanel/components/event_display/SystemEvent.svelte`
  - Props: event (ProcessedEvent with category='system')
  - Render: Dimmed system message, icon based on type
  - Token count: Format with thousands separators
  - Plan update: Show task list with status indicators
  - **Acceptance**: System events render with appropriate styling

- [ ] **T041** Implement StreamingEvent.svelte component
  - Path: `codex-chrome/src/sidepanel/components/event_display/StreamingEvent.svelte`
  - Handle delta accumulation with 500ms batched updates
  - Props: event (ProcessedEvent with streaming=true)
  - Render: Content with animated blinking cursor
  - Implement setTimeout batching (updateTimer pattern)
  - **Acceptance**: Streaming updates smooth, no jank, 500ms throttle verified

---

## Phase 3.6: Integration with App.svelte

**Prerequisites**: T032-T041 complete, all UI components working

- [ ] **T042** Integrate EventProcessor into App.svelte
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Import EventProcessor and EventDisplay
  - Create EventProcessor instance in onMount
  - Replace processedEvents array with state management
  - **Acceptance**: EventProcessor instantiated, no errors

- [ ] **T043** Replace existing handleEvent() with EventProcessor
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Modify handleEvent() to call eventProcessor.processEvent()
  - Add processed events to display list (filter null results)
  - Remove old switch statement (keep only as fallback initially)
  - **Acceptance**: Events processed through new EventProcessor, old code can be removed

- [ ] **T044** Implement event history management
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Store processedEvents in component state
  - Clear history on TaskStarted event (new session)
  - Limit history to prevent memory issues (e.g., 1000 events max)
  - **Acceptance**: History persists during session, clears on new task

- [ ] **T045** Implement auto-scroll behavior
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Detect if user is scrolled to bottom
  - Auto-scroll to new events only if already at bottom
  - Preserve scroll position if user has scrolled up
  - **Acceptance**: Auto-scroll works, doesn't interrupt manual scrolling

- [ ] **T046** Add virtual scrolling for >100 events
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Implement window-based rendering (render visible + buffer)
  - Use Svelte reactivity to update visible range on scroll
  - Keep full history in state, render only visible
  - **Acceptance**: Performance remains smooth with 100+ events

- [ ] **T047** Add event interaction handlers
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Handle EventDisplay 'click' event (focus/select event)
  - Handle 'toggleCollapse' event (update event.collapsed state)
  - Handle 'approval' event (send approval submission via MessageRouter)
  - **Acceptance**: All interactions work correctly

---

## Phase 3.7: Integration Tests

**Prerequisites**: Full integration complete (T042-T047)

- [ ] **T048** [P] Write integration test for simple agent message flow
  - Path: `codex-chrome/tests/integration/eventFlow.test.ts`
  - Test: Send AgentMessage event → verify ProcessedEvent created → verify UI renders
  - Use jsdom and @testing-library/svelte
  - **Acceptance**: End-to-end flow works from MessageRouter to UI

- [ ] **T049** [P] Write integration test for streaming delta accumulation
  - Path: `codex-chrome/tests/integration/streaming.test.ts`
  - Test: Send multiple AgentMessageDelta → send AgentMessage → verify accumulated content
  - Verify 500ms throttle behavior (deltas batched)
  - **Acceptance**: Streaming works correctly with throttling

- [ ] **T050** [P] Write integration test for command execution sequence
  - Path: `codex-chrome/tests/integration/commandExecution.test.ts`
  - Test: ExecCommandBegin → ExecCommandOutputDelta (×N) → ExecCommandEnd
  - Verify duration calculation, output accumulation
  - **Acceptance**: Multi-event operations correlated by call_id

- [ ] **T051** [P] Write integration test for error display
  - Path: `codex-chrome/tests/integration/errorHandling.test.ts`
  - Test: Send Error event → verify red styling → verify prominence
  - Test: StreamError with retrying=true
  - **Acceptance**: Errors displayed prominently, styling correct

- [ ] **T052** [P] Write integration test for task lifecycle
  - Path: `codex-chrome/tests/integration/taskLifecycle.test.ts`
  - Test: TaskStarted → processing indicator → TaskComplete → indicator clears
  - Verify history cleared on new TaskStarted
  - **Acceptance**: Task lifecycle handled correctly

- [ ] **T053** [P] Write integration test for approval flow
  - Path: `codex-chrome/tests/integration/approvalFlow.test.ts`
  - Test: ExecApprovalRequest → user clicks approve → approval submission sent
  - Mock MessageRouter to verify submission
  - **Acceptance**: Approval flow works end-to-end

- [ ] **T054** Write stress test for 100+ events/second
  - Path: `codex-chrome/tests/integration/performance.test.ts`
  - Test: Send 100 rapid AgentMessageDelta events
  - Measure: UI remains responsive, no dropped frames
  - Verify: 500ms throttle prevents excessive updates
  - **Acceptance**: Performance metrics met (<500ms latency, 60fps)

---

## Phase 3.8: Styling & Accessibility

**Prerequisites**: All core functionality working

- [ ] **T055** [P] Create event styling presets
  - Path: `codex-chrome/src/types/ui.ts` (update existing STYLE_PRESETS)
  - Define presets for all categories with Tailwind classes
  - Map terminal colors: magenta→purple-400, green→green-400, red→red-400, cyan→cyan-400
  - **Acceptance**: All presets defined, used by EventProcessor

- [ ] **T056** [P] Implement responsive layout for events
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventDisplay.svelte`
  - Add Tailwind responsive classes (mobile, tablet, desktop)
  - Test: Events display correctly on different viewport sizes
  - **Acceptance**: Layout responsive, no horizontal overflow

- [ ] **T057** [P] Add animations (streaming cursor, pulse)
  - Path: `codex-chrome/src/sidepanel/components/event_display/StreamingEvent.svelte`
  - CSS: Blinking cursor animation (@keyframes blink)
  - CSS: Subtle pulse animation for container
  - **Acceptance**: Animations smooth, not distracting

- [ ] **T058** [P] Implement dark mode support
  - Path: `codex-chrome/src/sidepanel/components/event_display/` (all .svelte files)
  - Add @media (prefers-color-scheme: dark) styles
  - Adjust colors for dark background (lighter text, darker borders)
  - **Acceptance**: Dark mode looks good, maintains contrast

- [ ] **T059** Add ARIA labels and roles
  - Path: `codex-chrome/src/sidepanel/components/event_display/EventDisplay.svelte`
  - Add aria-label with event category and title
  - Add aria-expanded for collapsible events
  - Add role="status" for streaming events
  - **Acceptance**: Screen reader announces events correctly

- [ ] **T060** Implement keyboard navigation
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Make events focusable (tabindex="0")
  - Handle Enter/Space to toggle collapse
  - Handle Arrow Up/Down to navigate between events
  - **Acceptance**: All events keyboard-navigable

- [ ] **T061** Add focus management
  - Path: `codex-chrome/src/sidepanel/App.svelte`
  - Focus new events when they arrive (if auto-scrolling)
  - Visible focus indicators (outline on focused event)
  - **Acceptance**: Focus visible, moves logically

- [ ] **T062** Verify color contrast ratios
  - Use browser DevTools Accessibility checker
  - Verify: All text meets WCAG AA (4.5:1 ratio)
  - Adjust: Colors if needed to meet standards
  - **Acceptance**: All text meets WCAG AA standards

- [ ] **T063** Test with screen reader
  - Manual test: Use NVDA/JAWS/VoiceOver
  - Navigate through events, verify all information announced
  - Test: Collapse/expand, approval interactions
  - **Acceptance**: Screen reader user can understand all events

---

## Phase 3.9: Final Polish & Validation

**Prerequisites**: Everything else complete

- [ ] **T064** Run full test suite and verify all tests pass
  - Command: `cd codex-chrome && npm test`
  - Verify: All unit tests pass (EventProcessor, formatters, components)
  - Verify: All integration tests pass (event flow, streaming, etc.)
  - **Acceptance**: Test output shows 45+ tests passing, 0 failures

- [ ] **T065** Run type checking
  - Command: `cd codex-chrome && npm run type-check`
  - Fix any TypeScript errors
  - **Acceptance**: "No errors found" message

- [ ] **T066** Build extension and verify no errors
  - Command: `cd codex-chrome && npm run build`
  - Verify: dist/ directory created with all files
  - **Acceptance**: Build succeeds, no errors or warnings

- [ ] **T067** Run quickstart validation (manual testing)
  - Follow: specs/004-implement-event-processor/quickstart.md steps 1-14
  - Test: Load extension in Chrome, send test messages
  - Test: All 14 validation scenarios
  - **Acceptance**: All quickstart tests pass

- [ ] **T068** Performance profiling
  - Use: Chrome DevTools Performance tab
  - Test: Send 100 rapid events, measure frame rate
  - Verify: Frame rate stays near 60fps, no long tasks >500ms
  - **Acceptance**: Performance metrics met

- [ ] **T069** Code cleanup and formatting
  - Command: `cd codex-chrome && npm run format`
  - Remove: Debug console.logs, commented code
  - Verify: Consistent code style
  - **Acceptance**: Code formatted, no linting errors

- [ ] **T070** Update CLAUDE.md with implementation notes
  - Path: `codex-chrome/CLAUDE.md`
  - Add: Notes about event_display/ directory structure
  - Add: Notes about 500ms throttle decision
  - Add: Common development commands
  - **Acceptance**: CLAUDE.md updated with useful context

---

## Dependencies Graph

```
Phase 3.1 (T001-T006): Setup & Types
  ↓
Phase 3.2 (T007-T016): Formatters [All P]
  ↓
Phase 3.3 (T017-T019): Contract Tests [All P] ⚠️ GATE: Must fail before T020+
  ↓
Phase 3.4 (T020-T031): EventProcessor Implementation (Sequential)
  T020 → T021 → T022/T023 → T024 → T025 → T026-T029 → T030 → T031
  ↓
Phase 3.5 (T032-T041): UI Components
  T032 → T033-T040 [All P after T032] → T041
  ↓
Phase 3.6 (T042-T047): Integration (Sequential)
  T042 → T043 → T044 → T045 → T046 → T047
  ↓
Phase 3.7 (T048-T054): Integration Tests [Most P]
  T048-T053 [P] → T054
  ↓
Phase 3.8 (T055-T063): Styling & Accessibility [Most P]
  T055-T058 [P], T059 → T060-T063
  ↓
Phase 3.9 (T064-T070): Final Polish (Sequential)
  T064 → T065 → T066 → T067 → T068 → T069 → T070
```

**Critical Path**: T001 → T017 → T020 → T031 → T032 → T042 → T047 → T064 → T070

**Parallel Opportunities**:
- T007-T016: All 10 formatter functions (10 parallel tasks)
- T017-T019: All 3 contract test suites (3 parallel tasks)
- T033-T040: All 8 category components (8 parallel tasks)
- T048-T053: All 6 integration tests (6 parallel tasks)
- T055-T058: All 4 styling tasks (4 parallel tasks)

Total: **70 tasks**, ~27 parallelizable, **40-60 hours estimated**

---

## Parallel Execution Examples

### Example 1: Formatters (Phase 3.2)
```typescript
// Launch all 10 formatter implementations in parallel
Task: "Implement formatDuration in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatNumber in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatTokens in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatTime in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatCommand in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatExitCode in codex-chrome/src/utils/formatters.ts"
Task: "Implement truncateOutput in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatBytes in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatPercent in codex-chrome/src/utils/formatters.ts"
Task: "Implement formatDiffSummary in codex-chrome/src/utils/formatters.ts"
```

### Example 2: Contract Tests (Phase 3.3)
```typescript
// Launch all contract tests in parallel
Task: "Write EventProcessor contract tests in codex-chrome/tests/unit/EventProcessor.contract.test.ts"
Task: "Write Formatter contract tests in codex-chrome/tests/unit/formatters.contract.test.ts"
Task: "Write EventDisplay component contract tests in codex-chrome/tests/unit/EventDisplay.contract.test.ts"
```

### Example 3: UI Components (Phase 3.5)
```typescript
// After T032 complete, launch all category components in parallel
Task: "Implement MessageEvent.svelte in codex-chrome/src/sidepanel/components/event_display/MessageEvent.svelte"
Task: "Implement ErrorEvent.svelte in codex-chrome/src/sidepanel/components/event_display/ErrorEvent.svelte"
Task: "Implement TaskEvent.svelte in codex-chrome/src/sidepanel/components/event_display/TaskEvent.svelte"
Task: "Implement ToolCallEvent.svelte in codex-chrome/src/sidepanel/components/event_display/ToolCallEvent.svelte"
Task: "Implement ReasoningEvent.svelte in codex-chrome/src/sidepanel/components/event_display/ReasoningEvent.svelte"
Task: "Implement OutputEvent.svelte in codex-chrome/src/sidepanel/components/event_display/OutputEvent.svelte"
Task: "Implement ApprovalEvent.svelte in codex-chrome/src/sidepanel/components/event_display/ApprovalEvent.svelte"
Task: "Implement SystemEvent.svelte in codex-chrome/src/sidepanel/components/event_display/SystemEvent.svelte"
```

---

## Validation Checklist

- [x] All contracts have corresponding tests (T017-T019)
- [x] All entities have type definitions (T002-T006)
- [x] All tests come before implementation (T017-T019 before T020-T031)
- [x] Parallel tasks are truly independent (different files, no shared state)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] TDD approach: Tests → Implementation → Integration
- [x] Dependency graph is clear and acyclic
- [x] All 30+ event types handled
- [x] 500ms throttle implemented throughout

---

## Notes

- **event_display/ Directory**: All new event UI components go in this subdirectory
- **EventDisplayCategory**: Use this name (not EventCategory) throughout
- **500ms Throttle**: Critical for browser performance, verify in T041 and T054
- **TDD**: Contract tests (T017-T019) MUST fail before core implementation starts
- **Parallel [P]**: Maximum 10 concurrent tasks for formatters, 8 for components
- **Testing**: 45+ tests total (6 contract + ~30 unit + ~9 integration)
- **Commit Strategy**: Commit after each task or logical group
- **Type Safety**: All files must pass `npm run type-check`

---

**Status**: ✅ Tasks file complete - Ready for execution
**Next**: Begin with T001 (setup) or parallelize T007-T016 (formatters)
