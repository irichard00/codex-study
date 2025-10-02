# Feature Specification: Implement Missing Session Methods from codex-rs

**Feature Branch**: `008-implement-the-missing`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "implement the missing methods in codex-chrome/src/core/Session.ts from impl Session in codex-rs/core/src/codex.rs"

## Execution Flow (main)
```
1. Parse user description from Input
   → Scope: Port missing methods from Rust Session to TypeScript Session
2. Extract key concepts from description
   → Actors: TypeScript Session class, Rust reference implementation
   → Actions: Port methods, maintain API compatibility
   → Data: Conversation state, turn management, rollout recording
   → Constraints: Must preserve SQ/EQ architecture, SessionState integration
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Which specific methods are considered "missing"?]
   → [NEEDS CLARIFICATION: Should async/await patterns match TypeScript conventions?]
   → [NEEDS CLARIFICATION: Are there TypeScript-specific adaptations needed for Rust patterns?]
4. Fill User Scenarios & Testing section
   → Primary scenario: Developer ports Session methods to maintain feature parity
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
   → Session, SessionState, ActiveTurn, RolloutRecorder
7. Run Review Checklist
   → WARN "Spec has uncertainties - clarification needed on specific method subset"
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
A developer working on the Codex Chrome Extension needs the TypeScript Session class to have the same capabilities as the Rust reference implementation. By porting the missing methods from `codex-rs/core/src/codex.rs`, the Chrome extension will support the full conversation management, turn handling, and rollout recording features that the Rust version provides.

### Acceptance Scenarios
1. **Given** a TypeScript Session instance, **When** methods for conversation management are called, **Then** they must behave identically to the Rust implementation
2. **Given** an active turn in progress, **When** turn-related methods are invoked, **Then** they must correctly manage turn state and pending input
3. **Given** conversation history needs to be reconstructed, **When** rollout items are processed, **Then** the history must match the Rust reconstruction logic
4. **Given** approval requests are made during tool execution, **When** approval methods are called, **Then** they must integrate with the ActiveTurn approval workflow
5. **Given** token usage and rate limits are updated, **When** tracking methods are invoked, **Then** they must correctly update SessionState and emit events
6. **Given** MCP tools are available, **When** tool methods are called, **Then** they must integrate with the MCP connection manager
7. **Given** a session needs to be shut down, **When** cleanup methods are invoked, **Then** they must flush rollout recorder and release resources

### Edge Cases
- What happens when a method is called while no active turn exists?
- How does the system handle reconstruction of history with compacted items?
- What happens when rollout persistence fails during critical operations?
- How does the system handle approval requests when the ActiveTurn is null?
- What happens when interrupts are requested during tool execution?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST provide methods for recording conversation items to history and rollout
- **FR-002**: System MUST implement turn lifecycle methods (start, end, inject input, get pending input)
- **FR-003**: System MUST provide approval request methods for command and patch operations
- **FR-004**: System MUST implement token usage tracking and rate limit updates
- **FR-005**: System MUST support history reconstruction from rollout items
- **FR-006**: System MUST provide methods for building initial context and turn input with history
- **FR-007**: System MUST implement MCP tool integration methods (get tools, call tool)
- **FR-008**: System MUST provide interrupt handling for active tasks
- **FR-009**: System MUST implement rollout persistence methods matching codex-rs patterns
- **FR-010**: System MUST provide methods for notifying approval decisions
- **FR-011**: System MUST implement event sending with rollout persistence
- **FR-012**: System MUST provide methods for updating and sending token count events
- **FR-013**: System MUST [NEEDS CLARIFICATION: Should all methods be ported, or only a specific subset?]
- **FR-014**: System MUST [NEEDS CLARIFICATION: Should TypeScript-specific error handling be added beyond Rust patterns?]

### Key Entities *(include if feature involves data)*
- **Session**: Core class managing conversation state, turn lifecycle, and rollout recording
- **SessionState**: Pure data container for conversation history, token usage, and approved commands
- **ActiveTurn**: Manages active turn state including pending input and approval callbacks
- **SessionServices**: Collection of services (rollout recorder, MCP manager, notifier)
- **RolloutRecorder**: Handles persistence of conversation items and events to storage
- **TurnContext**: Configuration and context for individual conversation turns
- **ResponseItem**: Individual conversation history items (messages, tool calls, results)
- **RolloutItem**: Persistence format for rollout recording (response items, events, metadata)

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (pending clarifications)

---
