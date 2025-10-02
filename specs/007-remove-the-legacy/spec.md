# Feature Specification: Remove Legacy State from Session

**Feature Branch**: `007-remove-the-legacy`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "remove the legacy state from Session in codex-chrome/src/core/Session.ts. currently codex-chrome/ is converted from codex-rs/, turning the terminal based coding agent into chrome extension based web agent that operate the webs. We follow the session implementation of codex-rs/core/src/codex.rs to implement SessionState, which makes the legacy State object not useful anymore, this task is to remove the legacy State object and migrate session logic to use SessionState only in codex-chrome/src/core/Session.ts"

## Execution Flow (main)
```
1. Parse user description from Input
   → Extract: remove State class, migrate to SessionState
2. Extract key concepts from description
   → Actors: Session class, State class, SessionState class
   → Actions: remove, migrate, refactor
   → Data: conversation history, turn state, token usage, approved commands
   → Constraints: maintain backward compatibility, preserve functionality
3. Mark unclear aspects: None - clear refactoring task
4. Fill User Scenarios & Testing section
   → Verify all State methods have SessionState equivalents
5. Generate Functional Requirements
   → All requirements are testable
6. No key entities (code refactoring, not data modeling)
7. Run Review Checklist
   → No implementation details needed for spec
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a developer working on the codex-chrome extension, I need the Session class to use only SessionState for state management, removing the legacy State class, so that the codebase follows the architecture from codex-rs and avoids duplicate state management logic.

### Acceptance Scenarios
1. **Given** a Session instance with conversation history, **When** methods are called to access history, **Then** data is retrieved from SessionState instead of legacy State
2. **Given** a Session with token usage tracking, **When** tokens are added, **Then** only SessionState tracks the usage (not both State and SessionState)
3. **Given** a Session managing approved commands, **When** commands are approved or checked, **Then** SessionState handles all command approval logic
4. **Given** an existing Session export/import workflow, **When** sessions are exported and imported, **Then** data persistence works using SessionState format only
5. **Given** Session methods that delegated to legacy State, **When** those methods are called, **Then** they delegate to SessionState or implement logic directly

### Edge Cases
- What happens when importing old session exports that still use legacy State format?
  - System MUST support backward compatibility for legacy exports during import
- How does system handle conversations with large history during migration?
  - System MUST preserve all conversation items without data loss
- What happens if SessionState is missing functionality that State had?
  - System MUST verify feature parity before removing State

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST remove all references to the legacy State class from Session.ts
- **FR-002**: System MUST migrate all state management logic to use SessionState exclusively
- **FR-003**: Session MUST delegate conversation history operations to SessionState
- **FR-004**: Session MUST delegate token usage tracking to SessionState
- **FR-005**: Session MUST delegate approved command management to SessionState
- **FR-006**: Session MUST support importing legacy session exports (backward compatibility during import only)
- **FR-007**: Session MUST export using SessionState format only (no legacy format in new exports)
- **FR-008**: System MUST preserve all existing functionality during refactoring
- **FR-009**: Session MUST remove duplicate state tracking (currently tracking in both State and SessionState)
- **FR-010**: System MUST maintain all existing Session public API methods (no breaking changes to interface)

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
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
- [x] Review checklist passed

---
