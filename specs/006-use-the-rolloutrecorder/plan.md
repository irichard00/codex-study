
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Replace the legacy ConversationStore with the newly implemented RolloutRecorder throughout the codex-chrome extension. This is a **code replacement only** - no data migration is performed. Users will start fresh with RolloutRecorder for new conversations. This aligns the Chrome extension's storage architecture with the original codex-rs implementation, using IndexedDB-based RolloutRecorder for conversation history. The RolloutRecorder provides TTL-based expiration, cursor-based pagination, and aligns data structures with the Rust implementation for future cross-platform features.

## Technical Context
**Language/Version**: TypeScript 5.x (strict mode), Chrome Extension Manifest V3
**Primary Dependencies**: RolloutRecorder (already implemented), IndexedDB, Chrome Storage/Alarms APIs
**Storage**: IndexedDB (RolloutRecorder) replacing CodexConversations DB (ConversationStore)
**Testing**: Vitest, TDD approach with contract/integration/unit tests
**Target Platform**: Chrome Extension (Manifest V3), modern browsers with IndexedDB support
**Project Type**: Single (Chrome extension with service worker background tasks)
**Performance Goals**: <50ms writes, <200ms reads (1000 items), <200ms pagination (already achieved: 1.02ms writes, 8.67ms reads)
**Constraints**: No data migration (fresh start for users), align with codex-rs patterns, maintain API compatibility for Session
**Scale/Scope**: Replace 5 files using ConversationStore, remove legacy code (~500 LOC), users start with empty conversation history

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS (No constitution file defined - proceeding with TDD best practices)
- TDD approach: Tests before implementation ✓
- No migration: Fresh start, no data migration complexity ✓
- Simplicity: Direct code replacement, no new abstractions ✓
- Alignment: Match codex-rs architecture patterns ✓

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->
```
codex-chrome/
├── src/
│   ├── storage/
│   │   ├── rollout/              # NEW: RolloutRecorder implementation (complete)
│   │   ├── ConversationStore.ts  # TO REMOVE: Legacy storage
│   │   └── StorageQuotaManager.ts # TO UPDATE: Switch to RolloutRecorder
│   ├── core/
│   │   ├── Session.ts            # TO UPDATE: Use RolloutRecorder (mimic codex-rs)
│   │   └── session/
│   │       └── state/
│   │           └── SessionServices.ts # TO UPDATE: RolloutRecorder integration
│   └── background/
│       └── service-worker.ts     # TO UPDATE: Cleanup scheduling
│
└── tests/
    ├── storage/
    │   └── rollout/              # Existing: RolloutRecorder tests (79+ passing)
    ├── migration/                # NEW: Migration tests
    └── integration/              # NEW: End-to-end migration tests
```

**Structure Decision**: Single project (Chrome extension). Migration will replace ConversationStore usage in 5 key files with RolloutRecorder, following the same patterns used in codex-rs/core/src/codex.rs. All existing RolloutRecorder infrastructure is already in place with comprehensive tests.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **~~Migration Tasks~~** (REMOVED - No migration needed):
   - ~~Create MigrationService~~ → Not needed (fresh start)
   - ~~Migration validation~~ → Not needed
   - ~~Batch processor~~ → Not needed
   - ~~Rollback mechanism~~ → Not needed

2. **Session Integration Tasks** (from session-api.ts + research.md):
   - Update SessionServices → replace ConversationStore with RolloutRecorder
   - Update Session.initializeSession() → initialize RolloutRecorder (create/resume)
   - Create persistRolloutItems() method → record items (replaces addMessage)
   - Create reconstructHistoryFromRollout() → rebuild from rollout items
   - Add shutdown/flush logic → graceful cleanup

3. **Storage Tasks** (from storage-quota-api.ts):
   - Update StorageQuotaManager → use RolloutRecorder.cleanupExpired()
   - Update getStorageUsage() → query rollouts/rollout_items stores
   - Update getStats() → calculate from RolloutRecorder

4. **Service Worker Tasks** (from cleanup-api.ts):
   - Create CleanupScheduler → schedule chrome.alarms
   - Add alarm listener → trigger RolloutRecorder.cleanupExpired()
   - ~~Add migration trigger~~ → Not needed (no migration)

5. **Cleanup Tasks**:
   - Remove ConversationStore.ts file
   - Remove all ConversationStore imports (5 files)
   - Remove ConversationStore tests
   - ~~Delete CodexConversations database~~ → User responsibility (optional manual cleanup)

6. **Contract Test Tasks** (TDD):
   - ~~Write migration contract tests~~ → Not needed (no migration)
   - Write session contract tests (9 contracts from session-api.ts)
   - Write storage contract tests (5 contracts from storage-quota-api.ts)
   - Write cleanup contract tests (7 contracts from cleanup-api.ts)
   - All tests must FAIL initially (no implementation yet)

7. **Integration Test Tasks** (simplified - no migration):
   - ~~Test: Migration preserves conversation IDs~~ → Not applicable
   - ~~Test: Migration preserves message order~~ → Not applicable
   - Test: Session creates new rollout
   - Test: Session resumes from rollout
   - Test: Cleanup deletes expired rollouts
   - Test: No ConversationStore references remain

**Ordering Strategy**:
1. Contract tests first (TDD) → All fail initially
2. ~~Migration implementation~~ → Removed (no migration)
3. Session integration → Make session tests pass
4. Storage/cleanup updates → Make remaining tests pass
5. ConversationStore removal → Final cleanup
6. Integration tests → End-to-end validation

**Dependencies**:
- ~~Migration before Session~~ → Not applicable
- Session updates can happen immediately (fresh start)
- All tests pass before ConversationStore removal

**Parallel Execution** [P]:
- Contract test files (independent)
- ~~Migration tasks~~ → Removed
- Storage + Cleanup updates (different services)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md (reduced from 35-40)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✓
- [x] Phase 1: Design complete (/plan command) ✓
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✓
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✓
- [x] Post-Design Constitution Check: PASS ✓
- [x] All NEEDS CLARIFICATION resolved (user provided context) ✓
- [x] Complexity deviations documented (none - simplification) ✓

**Deliverables**:
- [x] research.md created ✓ (updated: no migration)
- [x] data-model.md created ✓ (updated: no migration)
- [x] contracts/ directory with **3 API contracts** ✓ (migration-api.ts removed)
- [x] quickstart.md created ✓ (updated: no migration)
- [x] CLAUDE.md updated ✓
- [x] plan.md complete ✓ (updated: no migration)
- [x] PLAN_UPDATE.md created ✓ (documents changes)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
