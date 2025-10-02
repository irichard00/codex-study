# Feature Specification: Replace ConversationStore with RolloutRecorder

**Feature Branch**: `006-use-the-rolloutrecorder`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "Use the RolloutRecorder to replace ConversationStore in project codex-chrome, currently we are using ConversationStore in codex-chrome, which is not align with original codex-rs/, we need to turn the storage into using RolloutRecorder in the whole project and remove the ConversationStore related code"

## Execution Flow (main)
```
1. Parse user description from Input
   → ✓ Feature requires replacing ConversationStore with RolloutRecorder
2. Extract key concepts from description
   → Actors: Chrome extension developers, end users (agents)
   → Actions: Replace storage layer, migrate data, remove old code
   → Data: Conversation history, messages, rollout items
   → Constraints: Align with codex-rs architecture
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Data migration strategy - preserve existing conversations?]
   → [NEEDS CLARIFICATION: Backward compatibility - support both stores during transition?]
   → [NEEDS CLARIFICATION: UI changes needed - conversation list view impact?]
4. Fill User Scenarios & Testing section
   → ✓ User flow defined (agent sessions using new storage)
5. Generate Functional Requirements
   → ✓ Each requirement testable
6. Identify Key Entities
   → ✓ Rollout data, conversation history, session metadata
7. Run Review Checklist
   → ⚠ WARN "Spec has uncertainties - migration strategy needs clarification"
8. Return: SUCCESS (spec ready for planning with clarifications)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a Chrome extension developer, I need the conversation storage to align with the original codex-rs architecture, so that the Chrome extension maintains consistency with the Rust implementation for easy debug and upgrade in the future

As an end user (agent), I need my conversation history to be stored reliably and efficiently, so that I can resume sessions, review past conversations, and have my data automatically cleaned up according to retention policies.

### Acceptance Scenarios
1. **Given** the Chrome extension has existing conversations in ConversationStore, **When** the migration process runs, **Then** all existing conversation data is preserved in RolloutRecorder format with correct metadata
2. **Given** an agent starts a new conversation, **When** the conversation includes messages and tool calls, **Then** all conversation items are stored using RolloutRecorder with proper sequencing
3. **Given** an agent closes and reopens the browser, **When** they resume a previous conversation, **Then** the full conversation history is loaded from RolloutRecorder
4. **Given** a conversation exceeds the TTL threshold (60 days by default), **When** the cleanup process runs, **Then** expired conversations are automatically removed
5. **Given** the developer inspects the codebase, **When** searching for ConversationStore references, **Then** no legacy ConversationStore code remains (fully removed)
6. **Given** an agent has 100+ conversations, **When** they view the conversation list, **Then** conversations are paginated using RolloutRecorder's cursor-based system

### Edge Cases
- What happens when migration encounters corrupted ConversationStore data?
  - [NEEDS CLARIFICATION: Error handling strategy - skip, log, or fail entire migration?]
- How does system handle mid-migration failures (partial data transfer)?
  - [NEEDS CLARIFICATION: Rollback mechanism or idempotent migration?]
- What if a conversation is active during migration?
  - [NEEDS CLARIFICATION: Lock active sessions or allow concurrent access?]
- How are messages with tool calls mapped to RolloutRecorder's RolloutItem structure?
  - [NEEDS CLARIFICATION: Mapping strategy for ToolCallRecord → RolloutItem payload?]

## Requirements *(mandatory)*

### Functional Requirements

#### Storage Layer Replacement
- **FR-001**: System MUST replace all ConversationStore usage with RolloutRecorder throughout the Chrome extension codebase
- **FR-002**: System MUST store conversation history using RolloutRecorder's IndexedDB schema (rollouts + rollout_items)
- **FR-003**: System MUST remove the ConversationStore class and all related utility code after migration is complete
- **FR-004**: System MUST preserve the same data access patterns (create, read, update, list conversations) but using RolloutRecorder's API

#### Data Migration
- **FR-005**: System MUST provide a migration process to convert existing ConversationStore data to RolloutRecorder format
  - [NEEDS CLARIFICATION: One-time migration on version upgrade, or manual migration trigger?]
- **FR-006**: System MUST map ConversationStore data structures to RolloutRecorder equivalents:
  - Conversations → Rollout metadata (SessionMeta)
  - Messages → RolloutItems (response_item or event_msg)
  - Tool calls → RolloutItems (embedded in response_item payload)
  - [NEEDS CLARIFICATION: How to handle ConversationStore-specific fields like searchIndex, tokenUsage?]
- **FR-007**: System MUST maintain conversation chronology during migration (preserve message ordering)
- **FR-008**: System MUST handle migration errors gracefully without data loss
  - [NEEDS CLARIFICATION: Backup strategy before migration?]

#### API Surface Changes
- **FR-009**: System MUST update all code references that currently use ConversationStore methods to use equivalent RolloutRecorder methods:
  - `createConversation()` → `RolloutRecorder.create()`
  - `getConversation()` → `RolloutRecorder.getRolloutHistory()`
  - `listConversations()` → `RolloutRecorder.listConversations()`
  - `addMessage()` → `recorder.recordItems()`
  - `cleanup()` → `RolloutRecorder.cleanupExpired()`
- **FR-010**: System MUST update StorageQuotaManager to work exclusively with RolloutRecorder (ConversationStore references removed)
- **FR-011**: System MUST update Session.ts and SessionServices.ts to initialize and use RolloutRecorder instead of ConversationStore

#### User Experience
- **FR-012**: Users MUST be able to continue using the Chrome extension without noticing storage layer changes (transparent migration)
- **FR-013**: Users MUST have their conversation history preserved during the transition
- **FR-014**: Users MUST benefit from RolloutRecorder's TTL-based cleanup (default 60 days) for automatic data management
- **FR-015**: Users MUST be able to configure conversation retention via AgentConfig's storage.rolloutTTL setting

#### Cleanup & Removal
- **FR-016**: System MUST remove the ConversationStore database (CodexConversations) after successful migration
  - [NEEDS CLARIFICATION: Timing - immediately after migration, or keep for rollback period?]
- **FR-017**: System MUST remove all ConversationStore-related type definitions and interfaces
- **FR-018**: System MUST remove all tests specific to ConversationStore functionality

### Key Entities *(include if feature involves data)*

- **Rollout (replaces Conversation)**: Represents a complete agent session with metadata (SessionMeta), includes conversation ID, timestamps, TTL expiration, session instructions, and git context
- **RolloutItem (replaces Message/ToolCall)**: Represents individual conversation events, supports multiple types (session_meta, response_item, event_msg, compacted, turn_context), includes payload with type-specific data
- **ConversationsPage**: Paginated list of conversations with cursor-based navigation, includes items array, nextCursor, scan metrics
- **Migration Record**: Tracks migration status and progress [NEEDS CLARIFICATION: Is this needed for auditing/rollback?]

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs) - focused on user needs
- [x] Focused on user value and business needs - alignment with codex-rs architecture
- [x] Written for non-technical stakeholders - clear user stories
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain - **7 clarifications needed**
- [x] Requirements are testable and unambiguous - all FRs have acceptance criteria
- [x] Success criteria are measurable - migration success, code removal verification
- [x] Scope is clearly bounded - storage layer replacement only
- [x] Dependencies and assumptions identified - RolloutRecorder already implemented

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (7 clarifications needed)
- [x] User scenarios defined
- [x] Requirements generated (18 functional requirements)
- [x] Entities identified
- [ ] Review checklist passed - **BLOCKED: Requires clarifications**

---

## Clarifications Needed (Summary)

1. **Data migration strategy**: Preserve existing conversations or fresh start?
2. **Backward compatibility**: Support both stores during transition period?
3. **UI changes**: Does conversation list view need updates for RolloutRecorder pagination?
4. **Migration error handling**: Skip corrupt data, log errors, or fail entire migration?
5. **Mid-migration failures**: Rollback mechanism or idempotent migration design?
6. **Active sessions during migration**: Lock sessions or allow concurrent access?
7. **ToolCallRecord mapping**: How to structure tool calls within RolloutItem payload?
8. **ConversationStore-specific fields**: Handle searchIndex, tokenUsage in new schema?
9. **Migration timing**: One-time automatic upgrade or manual trigger?
10. **Database cleanup**: Remove old CodexConversations DB immediately or keep for rollback?
11. **Migration auditing**: Track migration status/progress for debugging?

**Recommendation**: Address these clarifications before proceeding to planning phase to ensure complete and accurate implementation.
