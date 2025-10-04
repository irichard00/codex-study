# Feature Specification: Refactor CodexAgent to Align with Rust Codex Architecture

**Feature Branch**: `011-refactor-codex-chrome`
**Created**: 2025-10-03
**Status**: Draft
**Input**: User description: "refactor codex-chrome/src/core/CodexAgent.ts to be align with struct Codex in codex-rs/core/src/codex.rs, currently codex-chrome/ is converted from codex-rs/, turning the terminal based coding agent into chrome extension based web agent that operate the webs. Current struct Codex has several update that makes the current CodexAgent implementation is no longer consistent with struct Codex for implementation. do research to see the code inconsistency of running a Session and Session Task and give out refactor suggestions."

## Execution Flow (main)
```
1. Parse user description from Input
   → Identified: Align TypeScript CodexAgent with Rust Codex architecture
2. Extract key concepts from description
   → Actors: CodexAgent (TS), Codex struct (Rust), Session, SessionTask
   → Actions: Refactor, align, implement missing patterns
   → Data: Submission queue, event queue, turn context, task lifecycle
   → Constraints: Preserve SQ/EQ architecture, maintain browser compatibility
3. For each unclear aspect:
   → No critical clarifications needed - architecture well-defined in Rust implementation
4. Fill User Scenarios & Testing section
   → User flow: Developer refactors CodexAgent to match Rust patterns
5. Generate Functional Requirements
   → All requirements are testable against Rust implementation
6. Identify Key Entities
   → CodexAgent, Session, SessionTask interface, TurnContext, ActiveTurn
7. Run Review Checklist
   → No implementation details in requirements
   → Focus on architectural alignment, not specific technologies
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT needs to be aligned and WHY
- ❌ Avoid HOW to implement (specific code changes come in plan phase)
- 👥 Written for developers understanding both codebases

---

## User Scenarios & Testing

### Primary User Story
A developer working on the Chrome extension notices that CodexAgent's session and task management has diverged from the proven Rust Codex implementation. They need to refactor CodexAgent to restore architectural consistency while preserving browser-specific adaptations.

### Acceptance Scenarios

1. **Given** a CodexAgent instance with the refactored architecture, **When** a user submits multiple operations (UserInput, OverrideTurnContext, UserTurn), **Then** the submission loop processes them in order with proper persistent context evolution

2. **Given** a running task processing tool calls, **When** the user injects additional input mid-execution, **Then** the running task receives the injected input without spawning a new task

3. **Given** a CodexAgent with a running task, **When** the user submits an Interrupt operation, **Then** all active tasks are aborted with proper cleanup and pending state is drained

4. **Given** a conversation approaching token limits, **When** the task execution detects the limit, **Then** the system automatically triggers compaction and continues execution

5. **Given** a tool requiring approval, **When** the task requests approval and waits, **Then** the approval flows through the coordinated system and the task receives the decision

6. **Given** a user requesting code review, **When** a review task is spawned, **Then** it runs with isolated context and history separate from the main conversation

### Edge Cases

- What happens when a task is aborted while waiting for approval?
  - The approval should be cancelled and removed from pending state
  - The task abort handler should be called before termination

- How does the system handle context overrides during an active task?
  - If a task is running, context overrides should not spawn a new task
  - The persistent context should be updated for the next task

- What happens when auto-compaction still exceeds token limits?
  - The system should detect repeated compaction attempts
  - An error should be emitted indicating the context cannot be sufficiently reduced

- How does the system manage multiple concurrent tasks (future feature)?
  - ActiveTurn should track tasks by submission ID in a map structure
  - Each task should have independent abort handles and lifecycle

---

## Requirements

### Functional Requirements

**Architecture Alignment**

- **FR-001**: CodexAgent MUST implement a dedicated submission loop that processes the queue asynchronously, matching the Rust `submission_loop` pattern
- **FR-002**: CodexAgent MUST maintain a persistent turn context that evolves across operations, rather than creating fresh context on each turn
- **FR-003**: CodexAgent MUST distinguish between persistent context (updated by OverrideTurnContext), per-turn context (UserTurn), and review context (isolated)

**Session and Task Lifecycle**

- **FR-004**: System MUST implement a SessionTask interface/abstraction matching the Rust SessionTask trait with `kind()`, `run()`, and `abort()` methods
- **FR-005**: System MUST support multiple task types: RegularTask (normal execution), ReviewTask (isolated review mode), CompactTask (context compaction)
- **FR-006**: Session MUST track active tasks in a map structure (indexed by submission ID) to support multiple concurrent tasks
- **FR-007**: Session MUST implement proper task spawning logic: check for running tasks, attempt injection first, spawn new only if needed

**Input Injection Pattern**

- **FR-008**: Session MUST implement `inject_input()` method that attempts to deliver input to a running task
- **FR-009**: When a running task exists, user input MUST be injected into the task's pending input queue rather than spawning a new task
- **FR-010**: When no running task exists, `inject_input()` MUST return the input items to the caller for new task spawning

**Task Abort and Cleanup**

- **FR-011**: System MUST implement comprehensive task abort with reason tracking (Replaced, UserInterrupt, Error, etc.)
- **FR-012**: Task abort MUST call task-specific abort handlers before terminating execution
- **FR-013**: Task abort MUST drain pending state (approvals, input) and emit TurnAborted events
- **FR-014**: Session MUST support `abort_all_tasks()` method that aborts every active task with a given reason

**Approval Coordination**

- **FR-015**: System MUST coordinate approval requests through turn state using async channels (Promise-based in TypeScript)
- **FR-016**: Tool execution requiring approval MUST wait on the approval channel until a decision is received
- **FR-017**: Approval decisions (ExecApproval, PatchApproval) MUST resolve the corresponding pending approval channel
- **FR-018**: Aborted tasks MUST cancel any pending approval requests

**Auto-Compaction**

- **FR-019**: Task execution loop MUST check token limits after each turn using the model's `getAutoCompactTokenLimit()` threshold
- **FR-020**: When token limit is exceeded, system MUST trigger inline auto-compaction task with summarization prompt
- **FR-021**: System MUST track compaction attempts to prevent infinite compaction loops (error if limit still exceeded after compaction)
- **FR-022**: Auto-compaction MUST reduce conversation history while preserving critical context

**Review Mode**

- **FR-023**: System MUST support spawning isolated review tasks with dedicated context and history
- **FR-024**: Review tasks MUST NOT persist their history to the main conversation session
- **FR-025**: Review tasks MUST use specialized review prompts and instructions
- **FR-026**: Review task results MUST be presented to the user without contaminating main session state

**Event and Rollout Synchronization**

- **FR-027**: Events MUST be recorded to rollout storage BEFORE being emitted to the event queue
- **FR-028**: Event emission MUST be atomic: record rollout item, then send event to queue
- **FR-029**: System MUST maintain event ordering consistency between rollout and event queue

**Context Override Mechanism**

- **FR-030**: OverrideTurnContext operation MUST update the persistent turn context without spawning a new task
- **FR-031**: Context overrides MUST persist for all subsequent operations until explicitly changed again
- **FR-032**: Context overrides affecting environment (cwd, sandbox policy) MUST be recorded to conversation history

**Task Execution Flow**

- **FR-033**: Task execution loop MUST continuously process tool responses until no more responses are returned
- **FR-034**: Task execution MUST handle pending input injection by retrieving accumulated input at the start of each turn
- **FR-035**: Task completion MUST record final assistant messages to conversation history
- **FR-036**: Task execution MUST respect interrupt signals and abort cleanly at turn boundaries

### Key Entities

- **CodexAgent**: Main orchestrator managing submission queue, event queue, and submission loop lifecycle. Responsible for spawning the submission loop and providing public API for operation submission.

- **Session**: State manager holding conversation history, active turn tracking, services (model client, tool registry), and turn context. Implements task spawning, input injection, and abort coordination.

- **SessionTask Interface**: Abstraction defining task contract with methods for kind identification, execution (run), and cleanup (abort). Implemented by RegularTask, ReviewTask, and CompactTask.

- **TurnContext**: Configuration snapshot for a task execution including model selection, approval policy, sandbox policy, working directory, reasoning effort, and base instructions. Evolves across conversation or created fresh per turn.

- **ActiveTurn**: State container tracking running tasks (indexed by submission ID), turn state (pending approvals, pending input), and coordination mechanisms. Supports multiple concurrent tasks and cleanup operations.

- **RunningTask**: Wrapper around a task execution including abort handle, task kind, and task instance reference. Enables task lifecycle management and cancellation.

- **TurnState**: Coordination state for approvals and input during task execution. Manages pending approval channels and accumulated pending input items. Provides insert/remove operations for approval coordination.

- **TaskKind**: Enumeration distinguishing task types (Regular, Review, Compact) for tracking and specialized handling.

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on architectural alignment and missing patterns
- [x] Written for developers familiar with both Rust and TypeScript implementations
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable against Rust implementation
- [x] Success criteria are measurable (architectural consistency)
- [x] Scope is clearly bounded (CodexAgent refactor, not full Chrome extension)
- [x] Dependencies identified (Session, TaskRunner, TurnManager, AgentTask)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted (submission loop, task system, context management)
- [x] Ambiguities marked (none - architecture defined by Rust implementation)
- [x] User scenarios defined (developer refactoring scenarios)
- [x] Requirements generated (36 functional requirements)
- [x] Entities identified (7 key entities)
- [x] Review checklist passed
