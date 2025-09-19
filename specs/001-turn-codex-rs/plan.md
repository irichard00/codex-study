
# Implementation Plan: TypeScript Web-Based Implementation of Codex

**Branch**: `001-turn-codex-rs` | **Date**: 2025-09-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-turn-codex-rs/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
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
Convert the existing Rust-based Codex CLI application to a TypeScript web-based implementation with a Svelte frontend interface. The system will maintain core functionality including MCP protocol support, configuration management, file operations, and sandboxing capabilities while transitioning from a terminal interface to a modern web UI with real-time WebSocket communication.

## Technical Context
**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: Svelte 4.x (frontend), Express/Fastify (backend), Socket.io (WebSockets)
**Storage**: Local file system, config.toml files
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web browsers (Chrome 100+, Firefox 100+, Safari 15+, Edge 100+)
**Project Type**: web - frontend + backend architecture
**Performance Goals**: <100ms UI response time, real-time WebSocket updates, handle 100+ concurrent sessions
**Constraints**: Browser sandboxing limitations, cross-origin restrictions, maintain security policies
**Scale/Scope**: Single-user local deployment initially, potential for multi-user cloud deployment

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: Constitution file is a template - using general software engineering principles:
- [ ] Modular architecture with clear separation of concerns
- [ ] Test-driven development approach
- [ ] Security-first design for web environment
- [ ] Progressive enhancement and graceful degradation
- [ ] Accessibility standards compliance

## Project Structure

### Documentation (this feature)
```
specs/001-turn-codex-rs/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (SELECTED)
codex-ts/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── services/
│   │   ├── api/
│   │   ├── mcp/
│   │   └── websocket/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/
│   │   └── services/
│   └── tests/
└── shared/
    ├── types/
    └── protocols/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Separate frontend and backend directories

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
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract endpoint → API test task [P]
- Each entity → model creation task [P]
- Each WebSocket message type → handler task
- Each user story → integration test task
- Implementation tasks to make tests pass

**Specific Task Categories**:

1. **Infrastructure Setup** (5 tasks)
   - Project initialization with TypeScript/Node.js
   - Fastify server setup
   - Svelte/SvelteKit frontend setup
   - WebSocket infrastructure
   - Development environment configuration

2. **Data Layer** (9 tasks - from data-model.md)
   - Create Zod schemas for each entity [P]
   - Implement model classes
   - State management setup

3. **API Implementation** (15 tasks - from api.openapi.yaml)
   - Each REST endpoint implementation
   - Request/response validation
   - Error handling middleware

4. **WebSocket Handlers** (11 tasks - from websocket-protocol.md)
   - Message type handlers
   - Connection management
   - Heartbeat mechanism

5. **Frontend Components** (10 tasks)
   - Chat interface
   - File browser
   - Code editor
   - Settings panel
   - Notification system

6. **Integration & Testing** (8 tasks)
   - API contract tests
   - WebSocket protocol tests
   - E2E test scenarios from quickstart.md
   - Performance benchmarks

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Infrastructure → Models → Services → API → UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 55-60 numbered, ordered tasks in tasks.md

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
| None | N/A | N/A |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
