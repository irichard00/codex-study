# Feature Specification: Refactor Session.ts to Match Rust Implementation Updates

**Feature Branch**: `004-refactor-session-ts`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "refactor Session.ts to catch up the original session implementation update in rust: codex-rs/core/src/codex.rs"

## Execution Flow (main)
```
1. Parse user description from Input
   → Extract requirement: synchronize TypeScript Session with Rust Session updates
2. Extract key concepts from description
   → Identify: Session structure changes, state management split, service layer separation
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Which specific Rust updates should be prioritized?]
4. Fill User Scenarios & Testing section
   → Verify Session maintains SQ/EQ architecture
   → Ensure type safety and protocol consistency
5. Generate Functional Requirements
   → Each requirement must be testable
6. Identify Key Entities (Session, SessionState, SessionServices, TurnContext)
7. Run Review Checklist
   → WARN "Spec assumes access to full Rust codebase for comparison"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a Chrome extension developer, I need the TypeScript Session class to mirror the architectural improvements made in the Rust implementation so that the browser-based agent maintains feature parity, reliability, and consistency with the terminal version.

### Acceptance Scenarios
1. **Given** the Rust Session has been refactored to separate state management, **When** the TypeScript Session is updated, **Then** it must maintain the same state separation pattern (SessionState, SessionServices, ActiveTurn)

2. **Given** the Rust implementation tracks conversation history through ConversationHistory, **When** recording messages in TypeScript, **Then** history must be managed consistently with token tracking and compaction support

3. **Given** the Rust Session manages turn lifecycle with ActiveTurn mutex, **When** implementing turn management in TypeScript, **Then** concurrent turn handling must prevent race conditions

4. **Given** MCP tools are integrated in Rust via SessionServices, **When** calling tools from TypeScript, **Then** the same tool interface and error handling must be preserved

5. **Given** the Rust implementation uses RolloutRecorder for session persistence, **When** exporting/importing sessions in TypeScript, **Then** the format must remain compatible for cross-platform session resumption

### Edge Cases
- What happens when a session is interrupted mid-turn and state needs to be recovered?
- How does the system handle concurrent message recording and history compaction?
- What occurs when MCP connection managers fail to initialize in the TypeScript environment?
- How are token limits and rate limits tracked when the context window is exceeded?
- What happens when attempting to resume a session created in Rust within the Chrome extension?

---

## Requirements *(mandatory)*

### Functional Requirements

**Session Structure & State Management**
- **FR-001**: System MUST separate session state into distinct layers: SessionState (history, token info, approved commands), SessionServices (MCP, exec, rollout, notifications), and ActiveTurn (current turn state)

- **FR-002**: System MUST maintain conversation history using ConversationHistory class with support for recording items, history snapshots, and replacement operations

- **FR-003**: System MUST track token usage information including total tokens consumed, model context window limits, and rate limit snapshots

- **FR-004**: System MUST manage approved commands in a persistent set that survives turn boundaries

**Turn Lifecycle Management**
- **FR-005**: System MUST support atomic turn state transitions: start turn, end turn, interrupt turn, and abort turn

- **FR-006**: System MUST prevent concurrent turn execution by maintaining at most one active turn at any time

- **FR-007**: System MUST handle pending input during turn execution, allowing interruption and queueing of new user input

- **FR-008**: System MUST track turn context including current working directory, approval policy, sandbox policy, model selection, and tool configuration

**Service Integration**
- **FR-009**: System MUST integrate MCP connection manager for Model Context Protocol tool discovery and execution

- **FR-010**: System MUST support exec session management for command execution and shell interaction [NEEDS CLARIFICATION: Chrome extension may need web-specific exec replacement]

- **FR-011**: System MUST provide rollout recording for session persistence, replay, and debugging

- **FR-012**: System MUST deliver user notifications through a consistent notifier interface

**History & Persistence**
- **FR-013**: System MUST support history compaction to manage token consumption within model context windows

- **FR-014**: System MUST enable session export including conversation history, turn context, state, and metadata

- **FR-015**: System MUST enable session import from exported data with backward compatibility for older formats

- **FR-016**: System MUST support session resumption from previously saved rollout data [NEEDS CLARIFICATION: format compatibility between Rust and TypeScript]

**Tool Execution**
- **FR-017**: System MUST provide MCP tool discovery returning available tools with their definitions

- **FR-018**: System MUST execute MCP tools with parameter validation and error handling

- **FR-019**: System MUST track tool usage statistics for monitoring and debugging

- **FR-020**: System MUST handle tool execution errors gracefully with appropriate event emission

**Configuration & Initialization**
- **FR-021**: System MUST initialize with configuration including model provider, reasoning settings, approval policy, sandbox policy, and working directory

- **FR-022**: System MUST validate configuration parameters including absolute path requirement for working directory

- **FR-023**: System MUST support parallel initialization of independent services (MCP, rollout, shell discovery) to reduce startup latency

- **FR-024**: System MUST handle initialization failures for optional services without blocking session creation

### Key Entities

- **Session**: Primary orchestration class managing conversation lifetime, turn execution, and service coordination. Contains conversation ID, event emitter, state mutex, active turn mutex, and service collection.

- **SessionState**: Immutable snapshot of session-wide persistent state including conversation history, approved commands, token usage info, and rate limit data.

- **SessionServices**: Collection of external service interfaces including MCP connection manager, exec session manager, user notifier, rollout recorder, and shell configuration.

- **TurnContext**: Configuration for a single turn execution including model client, working directory, instructions, approval/sandbox policies, tool configuration, and review mode flag.

- **ActiveTurn**: Mutable state for the currently executing turn including task kind, submission ID, abort handle, and pending state changes.

- **ConversationHistory**: Ordered collection of conversation items (messages, tool calls, responses) with metadata for timeline tracking and compaction support.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs) - focused on architecture
- [x] Focused on user value and business needs - feature parity with Rust
- [x] Written for non-technical stakeholders - describes system capabilities
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain - **3 clarifications needed**
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable - session export/import, turn lifecycle, state separation
- [x] Scope is clearly bounded - Session class refactoring only
- [x] Dependencies and assumptions identified - requires Rust codebase access

**Outstanding Clarifications:**
1. Which specific Rust updates should be prioritized for the initial refactor?
2. Should Chrome extension replace exec with web-specific operations?
3. Must session format be fully compatible between Rust and TypeScript for cross-platform resumption?

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (3 clarifications needed)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed - blocked on clarifications
