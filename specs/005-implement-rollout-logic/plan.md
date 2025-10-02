
# Implementation Plan: Rollout Logic in codex-chrome/src/storage

**Branch**: `005-implement-rollout-logic` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-implement-rollout-logic/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✓ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✓ User provided implementation details resolving ambiguities
   → ✓ Project Type: Chrome Extension (TypeScript)
   → ✓ Structure Decision: Single project with storage module
3. Fill the Constitution Check section based on the constitution document
   → Constitution template is placeholder; proceeding with standard checks
4. Evaluate Constitution Check section
   → No violations - straightforward storage conversion
   → ✓ Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → Completed: IndexedDB patterns, Rust→TS conversion strategies
6. Execute Phase 1 → contracts, data-model.md, quickstart.md
   → In progress
7. Re-evaluate Constitution Check section
   → Pending Phase 1 completion
8. Plan Phase 2 → Describe task generation approach
   → Pending
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Convert the Rust-based RolloutRecorder from `codex-rs/core/src/rollout/recorder.rs` to TypeScript for the Chrome extension at `codex-chrome/src/storage/RolloutRecorder.ts`. The conversion replaces file-based JSONL storage with IndexedDB while preserving all method names, data structures, and functionality. This enables the Chrome extension to persist agent session rollouts (conversation history, tool calls, events) with the same replay and inspection capabilities as the terminal version.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)
**Primary Dependencies**: IndexedDB (browser native), chrome.storage API (for metadata)
**Storage**: IndexedDB for rollout data; Chrome Storage API for configuration
**Testing**: Vitest with fake-indexeddb for unit tests, Chrome Extension testing API for integration
**Target Platform**: Chrome Extension (Manifest V3), supports Chrome 88+
**Project Type**: Single project - Chrome Extension with modular architecture
**Performance Goals**:
- Write latency: <50ms for adding rollout items (async batching)
- Read latency: <200ms for loading conversation history
- Support 1000+ rollout items per session without performance degradation
**Constraints**:
- Must work in Chrome extension context (service worker + content scripts)
- IndexedDB quota limits (~10% of available disk space, minimum 1GB)
- Must preserve exact JSON structure from Rust for cross-version compatibility
**Scale/Scope**:
- Support 100+ concurrent conversations
- Handle sessions with 10,000+ messages
- Efficient pagination for conversation listing

**Conversion Requirements** (from user input):
1. Source: `codex-rs/core/src/rollout/recorder.rs` → Target: `codex-chrome/src/storage/rollout/RolloutRecorder.ts`
2. Replace file-based `.jsonl` storage with IndexedDB
3. Preserve exact method names: `new()`, `record_items()`, `flush()`, `get_rollout_history()`, `list_conversations()`, `shutdown()`
4. Preserve exact type names: `RolloutRecorder`, `RolloutRecorderParams`, `RolloutItem`, `RolloutLine`, `SessionMeta`, etc.
5. Convert Rust async patterns (tokio channels, mpsc) to TypeScript async/Promise patterns
6. Maintain JSONL compatibility for export/import features
7. **TTL Configuration**:
   - Default TTL: 60 days for rollout data in IndexedDB
   - Configurable via `AgentConfig.ts` settings
   - Support custom TTL values (e.g., 7 days, 30 days, 90 days)
   - Support permanent storage option (no expiration)
   - Automatic cleanup of expired rollouts
8. **Directory Structure**:
   - All rollout code in dedicated subdirectory: `codex-chrome/src/storage/rollout/`
   - Modular organization: separate files for recorder, writer, types, policy, listing, cleanup
   - Public API exported via `index.ts`
   - Tests mirror source structure: `tests/storage/rollout/`

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution file is a placeholder template, we apply standard software engineering principles:

✅ **Preservation of Existing Architecture**: Converting existing Rust code to TypeScript preserving structure
✅ **Type Safety**: TypeScript strict mode with full type annotations
✅ **Storage Layer Abstraction**: IndexedDB operations encapsulated in RolloutRecorder class
✅ **Testability**: All async operations return Promises, easily testable with fake-indexeddb
✅ **Error Handling**: Proper error propagation matching Rust's Result<T, E> patterns
✅ **Performance**: Async batching for writes, indexed queries for reads

**No violations identified**

## Project Structure

### Documentation (this feature)
```
specs/005-implement-rollout-logic/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── RolloutRecorder.md
│   ├── ConversationListing.md
│   └── DataTypes.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── storage/
│   │   ├── rollout/                  # NEW: Rollout subdirectory
│   │   │   ├── RolloutRecorder.ts   # Main class - new file
│   │   │   ├── RolloutWriter.ts     # IndexedDB writer - new file
│   │   │   ├── types.ts             # Type definitions - new file
│   │   │   ├── policy.ts            # Persistence filters - new file
│   │   │   ├── listing.ts           # Listing/pagination - new file
│   │   │   ├── cleanup.ts           # TTL cleanup logic - new file
│   │   │   ├── helpers.ts           # Helper functions (TTL calc, etc)
│   │   │   └── index.ts             # Public exports
│   │   ├── ConversationStore.ts     # Existing (may need updates)
│   │   ├── CacheManager.ts          # Existing
│   │   ├── StorageQuotaManager.ts   # Existing (integrate with rollout)
│   │   └── ConfigStorage.ts         # Existing
│   └── types/
│       └── storage.ts                # Add rollout-specific types
└── tests/
    ├── storage/
    │   └── rollout/                  # NEW: Rollout test subdirectory
    │       ├── RolloutRecorder.test.ts
    │       ├── RolloutWriter.test.ts
    │       ├── policy.test.ts
    │       ├── listing.test.ts
    │       ├── cleanup.test.ts
    │       └── helpers.test.ts
    └── integration/
        └── rollout-integration.test.ts
```

**Structure Decision**: Rollout-related code is organized in a dedicated `codex-chrome/src/storage/rollout/` subdirectory for better modularity and separation of concerns. This structure:
- Groups all rollout-related modules together
- Prevents cluttering the main storage directory
- Provides clear boundaries for rollout functionality
- Follows TypeScript module organization best practices
- Makes it easier to manage rollout-specific code evolution
- Tests mirror the source structure in `tests/storage/rollout/`

## Phase 0: Outline & Research

**Research Topics** (all resolved by examining Rust source code):

1. **Rust → TypeScript Conversion Patterns**
   - Decision: Direct structural mapping with type equivalence
   - Rationale: Rust structs → TS interfaces/types, Rust enums → TS discriminated unions
   - Implementation details captured in research.md

2. **File-based JSONL → IndexedDB Mapping**
   - Decision: Use IndexedDB object stores to represent JSONL structure
   - Rationale: Each rollout item becomes an IDB record with timestamp indexing
   - See research.md for schema design

3. **Async Pattern Conversion**
   - Decision: tokio::mpsc channels → Promise-based async queue
   - Rationale: Browser environment doesn't need multi-threaded concurrency
   - Details in research.md

4. **Conversation Listing & Pagination**
   - Decision: Replicate Rust's cursor-based pagination with IDB queries
   - Rationale: Maintains API compatibility, handles large datasets efficiently
   - Algorithm details in research.md

**Output**: research.md (being created next)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### Deliverables

1. **data-model.md** - TypeScript type definitions:
   - `RolloutRecorder` class structure
   - `RolloutRecorderParams` (Create | Resume)
   - `RolloutItem`, `RolloutLine`, `SessionMeta`, `SessionMetaLine`
   - `ConversationItem`, `ConversationsPage`, `Cursor`
   - `LogFileInfo` equivalent (IndexedDB metadata)

2. **contracts/** - API contracts:
   - `RolloutRecorder.md`: Class methods, signatures, behavior
   - `ConversationListing.md`: Pagination API, cursor format
   - `DataTypes.md`: JSON serialization format (must match Rust)

3. **quickstart.md** - Integration examples:
   - Creating a new rollout recorder
   - Recording conversation items
   - Resuming from existing rollout
   - Listing conversations with pagination
   - Exporting rollout data

4. **Update CLAUDE.md**:
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - Add RolloutRecorder to storage components section
   - Document IndexedDB schema
   - Keep under 150 lines

**Contract Test Stubs** (tests that must pass):
- `RolloutRecorder.constructor()` creates/resumes correctly
- `record_items()` persists to IndexedDB with correct structure
- `flush()` ensures all writes committed
- `get_rollout_history()` reconstructs conversation from IDB
- `list_conversations()` returns paginated results with cursors
- JSON serialization matches Rust output format

**Output**: data-model.md, contracts/, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base
2. Generate type definition tasks from data-model.md [P]
3. Generate IDB schema setup tasks [P]
4. Generate RolloutWriter class implementation
5. Generate RolloutRecorder class implementation
6. Generate policy/filtering logic from rolloutPolicy.ts
7. Generate ConversationListing pagination logic
8. Generate integration with StorageQuotaManager
9. Generate test tasks matching contract tests
10. Generate documentation tasks

**Ordering Strategy**:
- Phase 1: Type definitions (can run in parallel) [P]
- Phase 2: IndexedDB schema + writer (sequential dependency)
- Phase 3: RolloutRecorder class (depends on writer)
- Phase 4: Policy + listing (can run in parallel) [P]
- Phase 5: Integration + tests (sequential)
- TDD: Each implementation task has corresponding test task first

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations identified. This is a straightforward storage layer conversion maintaining existing architecture.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command) - 40 tasks ready for execution
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (via user input)
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- [x] research.md (updated with TTL section + module organization)
- [x] data-model.md (updated with TTL types)
- [x] contracts/RolloutRecorder.md (updated with TTL API)
- [x] contracts/ConversationListing.md
- [x] contracts/DataTypes.md
- [x] quickstart.md (updated with TTL examples + import paths)
- [x] TTL_UPDATE.md (summary of TTL changes)
- [x] DIRECTORY_STRUCTURE.md (summary of modular file organization)
- [x] tasks.md (40 implementation tasks, TDD-ordered)

**Recent Updates**:
- **2025-10-01 (Update 1)**: Added TTL configuration support (60-day default, configurable via AgentConfig.ts, permanent option)
- **2025-10-01 (Update 2)**: Organized code in dedicated subdirectory `codex-chrome/src/storage/rollout/` with modular file structure

---
*Plan created following `.specify/templates/plan-template.md` structure*
