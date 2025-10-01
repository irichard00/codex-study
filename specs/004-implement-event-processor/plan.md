# Implementation Plan: Event Processor for Side Panel UI

**Branch**: `004-implement-event-processor` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-implement-event-processor/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
This feature implements a comprehensive event processor for the Codex Chrome extension's side panel UI. The processor transforms technical event messages from the agent (30+ event types including task lifecycle, tool calls, streaming content, errors, reasoning, and approvals) into human-readable UI displays. The implementation ports the functionality from codex-rs's `event_processor_with_human_output.rs` (terminal-based) to a browser-based Svelte UI, processing events in real-time as they flow through Chrome's runtime messaging system from CodexAgent to the side panel.

**Key Updates**:
- UI rendering throttling set to 500ms (prevents browser resource overconsumption)
- EventCategory renamed to EventDisplayCategory for clarity
- Event display components organized in `event_display/` subdirectory

## Technical Context
**Language/Version**: TypeScript 5.9+
**Primary Dependencies**: Svelte 4.2, Vite 5.4, Chrome Extension APIs, Tailwind CSS 4.1
**Storage**: N/A (event processing is stateless, messages stored in component state)
**Testing**: Vitest 3.2, Testing Library Svelte 5.2, jsdom 27.0
**Target Platform**: Chrome Extension (Manifest V3), browser-based side panel UI
**Project Type**: Single (Chrome extension with UI components)
**Performance Goals**: <500ms UI update latency for streaming events, 60fps UI rendering, handle 100+ events/second without lag
**Constraints**: Must work within Chrome extension sandbox, no Node.js APIs, must batch rapid streaming updates with 500ms throttle
**Scale/Scope**: 30+ event types to process, real-time streaming support, handles multi-turn conversations with 100s of events

**Event Flow Architecture**:
1. Session.emitEvent() (src/core/Session.ts:331) - Invokes eventEmitter callback
2. CodexAgent.emitEvent() (src/core/CodexAgent.ts:554) - Adds to eventQueue, broadcasts via chrome.runtime.sendMessage
3. MessageRouter (src/core/MessageRouter.ts:121) - Receives and routes MessageType.EVENT messages
4. Side Panel App.svelte (line 36) - Receives events and calls handleEvent() to process

**Reference Implementation**: codex-rs/exec/src/event_processor_with_human_output.rs - Rust terminal-based event processor with human-readable formatting, styling, and state tracking

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution is a template and not yet ratified. For this feature, we'll follow general best practices for Chrome extension development.

### Initial Check (Pre-Research)
- [x] **Component Modularity**: Event processor will be a standalone module that can be independently tested
- [x] **Single Responsibility**: Event processor focuses solely on transforming events to UI-ready format
- [x] **No Over-Engineering**: Using existing Svelte components and patterns from the codebase
- [x] **Type Safety**: Leveraging existing TypeScript event types from protocol/events.ts
- [x] **Performance First**: Batching updates with 500ms throttle as required by spec
- [x] **Testability**: Event processor logic separate from UI rendering for unit testing

### Compliance Status (Initial)
✅ PASS - No constitutional violations. Feature follows modular design, reuses existing types, and maintains separation of concerns between event processing logic and UI components.

### Post-Design Check (After Phase 1)
- [x] **Component Modularity**: EventProcessor class is standalone and independently testable
- [x] **Single Responsibility**: Clear separation: EventProcessor (transformation), EventDisplay (rendering), formatters (utilities)
- [x] **No Over-Engineering**: Reuses existing Svelte components, no new frameworks or libraries added
- [x] **Type Safety**: All interfaces defined in contracts, leverages existing protocol types
- [x] **Performance First**: 500ms batching strategy documented to prevent browser resource issues
- [x] **Testability**: Contract tests written, unit test structure defined, clear testing layers

**New Components Added**:
- EventProcessor.ts (transformation logic)
- EventDisplay.svelte (UI renderer)
- 6 category-specific Svelte components in event_display/ subdirectory
- formatters.ts (utility functions)
- eventHelpers.ts (helper functions)
- ui.ts types (ProcessedEvent, EventDisplayCategory, etc.)

**Design Review**:
- All new components have single, clear responsibilities
- No duplication of existing functionality
- Follows existing codebase patterns, organized in dedicated subdirectory
- No unnecessary abstractions or indirection
- Contracts define clear APIs for testing

### Compliance Status (Post-Design)
✅ PASS - Design maintains constitutional compliance. Architecture is modular, testable, and follows established patterns.

## Project Structure

### Documentation (this feature)
```
specs/004-implement-event-processor/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── core/
│   │   ├── CodexAgent.ts           # Emits events via chrome.runtime.sendMessage
│   │   ├── Session.ts               # Event emission source
│   │   └── MessageRouter.ts         # Routes events to handlers
│   ├── protocol/
│   │   ├── types.ts                 # Event and Submission types
│   │   └── events.ts                # 30+ EventMsg type definitions
│   ├── sidepanel/
│   │   ├── App.svelte              # Main UI, receives events (line 36)
│   │   └── components/
│   │       └── event_display/       # NEW: Event display subdirectory
│   │           ├── EventProcessor.ts      # NEW: Event-to-UI transformation logic
│   │           ├── EventDisplay.svelte    # NEW: Renders processed events
│   │           ├── StreamingEvent.svelte  # NEW: Handles delta streaming
│   │           ├── MessageEvent.svelte    # NEW: Agent messages
│   │           ├── ErrorEvent.svelte      # NEW: Error display
│   │           ├── TaskEvent.svelte       # NEW: Task lifecycle
│   │           ├── ToolCallEvent.svelte   # NEW: Tool execution display
│   │           ├── ReasoningEvent.svelte  # NEW: Agent reasoning
│   │           ├── OutputEvent.svelte     # NEW: Command output
│   │           ├── ApprovalEvent.svelte   # NEW: Approval UI
│   │           └── SystemEvent.svelte     # NEW: System notifications
│   ├── types/
│   │   ├── terminal.ts             # Terminal message types
│   │   └── ui.ts                    # NEW: UI event types (EventDisplayCategory, etc.)
│   └── utils/
│       ├── formatters.ts            # NEW: Format helpers (duration, tokens, etc.)
│       └── eventHelpers.ts          # NEW: Event processing utilities
└── tests/
    ├── unit/
    │   ├── EventProcessor.test.ts   # NEW: Unit tests for event processing
    │   └── formatters.test.ts       # NEW: Formatter tests
    └── integration/
        └── eventFlow.test.ts        # NEW: End-to-end event flow tests
```

**Structure Decision**: Single project structure for Chrome extension. Event processor and all display components will be added in new `event_display/` subdirectory under `src/sidepanel/components/` with supporting utilities in `src/utils/`. This maintains consistency with existing codebase organization where UI components live in `sidepanel/` and core protocol types are in `protocol/`.

## Phase 0: Outline & Research

**Status**: ✅ Complete

**Output**: `research.md` with 8 technical decisions and 3 resolved clarifications

**Key Decisions**:
1. Event Processing Architecture - Separate EventProcessor class + Svelte components
2. Streaming Event Handling - 500ms throttle batching (updated from 50ms)
3. Event Type Categorization - 8 display categories for 30+ event types
4. State Management - call_id maps for multi-event operations
5. Formatting Utilities - Dedicated formatters module
6. Visual Styling - Tailwind CSS with terminal color mapping
7. Performance Optimization - Virtual scrolling for >100 events
8. Testing Strategy - Three-layer approach (unit, component, integration)

**Clarifications Resolved**:
- FR-017: Relative time by default, absolute on hover
- FR-019: <500ms UI update latency (changed from <50ms)
- FR-020: Maintain full history within session, clear on new TaskStarted

## Phase 1: Design & Contracts

**Status**: ✅ Complete

**Outputs**:
- `data-model.md` - 8 core entities with validation rules
- `contracts/EventProcessor.contract.ts` - API contract with 6 tests
- `contracts/Formatters.contract.ts` - 10 formatter function contracts
- `contracts/EventDisplay.contract.md` - Component contract with behavioral tests
- `quickstart.md` - 14 validation steps with troubleshooting
- `CLAUDE.md` - Updated agent context

**Core Entities**:
1. ProcessedEvent - Unified UI-ready event representation
2. EventDisplayCategory - 8 display categories (renamed from EventCategory)
3. EventStyle - Visual styling theme
4. EventMetadata - Event-specific additional information
5. OperationState - Multi-event operation tracking
6. StreamingState - Streaming content state
7. ApprovalRequest - Interactive approval data
8. ContentBlock - Structured content blocks

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

The /tasks command will generate an ordered task list following TDD principles:

**Source Documents**:
1. data-model.md → Type definitions and interfaces
2. contracts/ → Contract tests and API specifications
3. quickstart.md → Integration test scenarios
4. research.md → Implementation patterns and decisions

**Task Categories**:

1. **Type Definition Tasks** [P] (Parallel - independent):
   - Task: Define ProcessedEvent interface in src/types/ui.ts
   - Task: Define EventDisplayCategory type in src/types/ui.ts (renamed)
   - Task: Define EventStyle, EventMetadata interfaces
   - Task: Define OperationState, StreamingState interfaces
   - Task: Define ApprovalRequest, ContentBlock types

2. **Directory Setup**:
   - Task: Create event_display/ subdirectory under src/sidepanel/components/

3. **Formatter Tasks** [P] (Parallel - pure functions):
   - Task: Implement formatDuration() with tests
   - Task: Implement formatNumber() with tests
   - Task: Implement formatTime() with tests
   - Task: Implement formatCommand() with tests
   - Task: Implement formatExitCode() with tests
   - Task: Implement truncateOutput() with tests
   - Task: Implement formatBytes() with tests
   - Task: Implement formatPercent() with tests
   - Task: Implement formatDiffSummary() with tests

4. **Contract Test Tasks** (Sequential - defines API):
   - Task: Write EventProcessor contract tests
   - Task: Write Formatter contract tests

5. **Core Implementation Tasks** (Sequential - depends on contracts):
   - Task: Implement EventProcessor class in event_display/EventProcessor.ts
   - Task: Implement processEvent() for 'message' category
   - Task: Implement processEvent() for 'error' category
   - Task: Implement streaming state management (500ms throttle)
   - Task: Implement operation state management (call_id tracking)
   - Task: Implement processEvent() for all remaining categories
   - Task: Implement reset() and state getters

6. **UI Component Tasks in event_display/** [P after EventProcessor]:
   - Task: Implement EventDisplay.svelte base component
   - Task: Implement MessageEvent.svelte
   - Task: Implement ErrorEvent.svelte
   - Task: Implement TaskEvent.svelte
   - Task: Implement ToolCallEvent.svelte
   - Task: Implement ReasoningEvent.svelte
   - Task: Implement OutputEvent.svelte
   - Task: Implement ApprovalEvent.svelte
   - Task: Implement SystemEvent.svelte
   - Task: Implement StreamingEvent.svelte (500ms batching)

7. **Integration Tasks** (Sequential):
   - Task: Integrate EventProcessor into App.svelte
   - Task: Replace existing handleEvent() with EventProcessor
   - Task: Add event history management with virtual scrolling
   - Task: Implement auto-scroll behavior
   - Task: Add interaction handlers

8. **Performance & Polish**:
   - Task: Implement 500ms delta batching
   - Task: Add virtual scrolling for >100 events
   - Task: Implement styling and animations
   - Task: Add accessibility features

### Ordering Strategy

**Phase A: Foundation**
```
1-5:   Type definitions [P]
6:     Create event_display/ directory
7-15:  Formatter implementations [P]
16-17: Contract tests
```

**Phase B: Core Logic**
```
18:    EventProcessor skeleton
19-27: ProcessEvent implementations
28:    State management (500ms throttle)
```

**Phase C: UI Components in event_display/**
```
29:    EventDisplay base
30-38: Category-specific components [P]
39:    StreamingEvent with 500ms batching
```

**Phase D: Integration & Polish**
```
40-44: Integration
45-48: Performance optimization (500ms throttle)
49-53: Styling and accessibility
```

### Estimated Output
- **Total Tasks**: 60-70 numbered tasks
- **Parallel Tasks**: ~25 (types, formatters, UI components)
- **Sequential Tasks**: ~40 (core logic, integration, tests)
- **Estimated Time**: 40-60 hours (1-2 weeks for one developer)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - section left empty*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created with 500ms throttle
- [x] Phase 1: Design complete (/plan command) - data-model.md with EventDisplayCategory, contracts/, quickstart.md
- [x] Phase 2: Task planning complete (/plan command - approach documented with event_display/ subdirectory)
- [x] Phase 3: Tasks generated (/tasks command) - tasks.md created with 70 tasks
- [ ] Phase 4: Implementation in progress
- [ ] Phase 5: Validation pending

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (research.md: FR-017, FR-019 updated to 500ms, FR-020)
- [x] Complexity deviations documented (None - no violations)

**Artifacts Generated**:
- ✅ plan.md (this file - UPDATED with 500ms throttle, EventDisplayCategory, event_display/ structure)
- ✅ research.md (8 technical decisions, 500ms throttle decision updated)
- ✅ data-model.md (8 core entities, EventDisplayCategory renamed)
- ✅ contracts/EventProcessor.contract.ts (API contract with 6 contract tests)
- ✅ contracts/Formatters.contract.ts (10 formatter functions with contracts)
- ✅ contracts/EventDisplay.contract.md (Component contract)
- ✅ quickstart.md (14 validation steps, 500ms metrics updated)
- ✅ CLAUDE.md updated (agent context with new tech stack)
- ✅ tasks.md (70 numbered tasks, organized in 9 phases, 27 parallelizable)

**Updates Applied**:
1. ✅ UI rendering throttling changed from 50ms to 500ms throughout all documents
2. ✅ EventCategory renamed to EventDisplayCategory in data-model.md and contracts
3. ✅ Project structure updated to use event_display/ subdirectory for all event components

**Next Steps**: Begin implementation following tasks.md (T001-T070)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
