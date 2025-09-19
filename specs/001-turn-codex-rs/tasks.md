# Tasks: TypeScript Web-Based Implementation of Codex

**Input**: Design documents from `/specs/001-turn-codex-rs/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.x, Fastify, Svelte, Vitest, Playwright
   → Structure: codex-ts/ with backend/, frontend/, shared/
2. Load optional design documents:
   → data-model.md: 9 entities → model tasks
   → contracts/: API + WebSocket specs → test tasks
   → research.md: Tech decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: API tests, WebSocket tests, E2E tests
   → Core: models, services, handlers
   → Integration: WebSocket, file system, MCP
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T058)
6. Tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Convention
Project structure per plan.md:
```
codex-ts/
├── backend/src/
├── frontend/src/
└── shared/types/
```

## Phase 3.1: Setup (Infrastructure)

- [ ] T001 Create project structure: codex-ts/ with backend/, frontend/, shared/ directories
- [ ] T002 Initialize backend with Node.js 20+ and TypeScript 5.x in codex-ts/backend/
- [ ] T003 Initialize frontend with Svelte 4.x and SvelteKit in codex-ts/frontend/
- [ ] T004 [P] Configure TypeScript with strict mode for both backend and frontend
- [ ] T005 [P] Setup shared types directory with base TypeScript config in codex-ts/shared/
- [ ] T006 [P] Install Fastify and core plugins in backend (fastify, @fastify/cors, @fastify/helmet, @fastify/jwt)
- [ ] T007 [P] Configure Vite build system for both frontend and backend
- [ ] T008 [P] Setup ESLint and Prettier with TypeScript/Svelte support
- [ ] T009 [P] Configure Vitest for unit/integration testing in both projects
- [ ] T010 [P] Setup Playwright for E2E testing with browser targets

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### API Contract Tests
- [ ] T011 [P] Create test for POST /api/sessions endpoint in backend/tests/api/sessions.test.ts
- [ ] T012 [P] Create test for GET /api/sessions/{id} endpoint in backend/tests/api/sessions.test.ts
- [ ] T013 [P] Create test for POST /api/sessions/{id}/agents in backend/tests/api/agents.test.ts
- [ ] T014 [P] Create test for GET /api/sessions/{id}/conversations in backend/tests/api/conversations.test.ts
- [ ] T015 [P] Create test for POST /api/sessions/{id}/tasks in backend/tests/api/tasks.test.ts
- [ ] T016 [P] Create test for GET /api/sessions/{id}/files in backend/tests/api/files.test.ts
- [ ] T017 [P] Create test for GET/PUT /api/sessions/{id}/files/content in backend/tests/api/files.test.ts
- [ ] T018 [P] Create test for POST /api/sessions/{id}/files/search in backend/tests/api/search.test.ts
- [ ] T019 [P] Create test for MCP connections endpoints in backend/tests/api/mcp.test.ts
- [ ] T020 [P] Create test for configurations endpoints in backend/tests/api/config.test.ts

### WebSocket Protocol Tests
- [ ] T021 [P] Create WebSocket connection test in backend/tests/websocket/connection.test.ts
- [ ] T022 [P] Create client→server message handler tests in backend/tests/websocket/client-messages.test.ts
- [ ] T023 [P] Create server→client message handler tests in backend/tests/websocket/server-messages.test.ts
- [ ] T024 [P] Create heartbeat mechanism test in backend/tests/websocket/heartbeat.test.ts

### E2E Test Scenarios
- [ ] T025 [P] Create E2E test for Scenario 1: Basic Interaction in frontend/tests/e2e/basic.spec.ts
- [ ] T026 [P] Create E2E test for Scenario 2: File Operations in frontend/tests/e2e/files.spec.ts
- [ ] T027 [P] Create E2E test for Scenario 3: Code Generation in frontend/tests/e2e/codegen.spec.ts
- [ ] T028 [P] Create E2E test for Scenario 4: WebSocket Reconnection in frontend/tests/e2e/reconnect.spec.ts
- [ ] T029 [P] Create E2E test for Scenario 5: Configuration Update in frontend/tests/e2e/config.spec.ts

## Phase 3.3: Core Implementation

### Data Models (9 entities from data-model.md)
- [ ] T030 [P] Create Session model with Zod schema in shared/types/Session.ts
- [ ] T031 [P] Create Configuration model with Zod schema in shared/types/Configuration.ts
- [ ] T032 [P] Create Agent model with Zod schema in shared/types/Agent.ts
- [ ] T033 [P] Create Conversation model with Zod schema in shared/types/Conversation.ts
- [ ] T034 [P] Create Task model with Zod schema in shared/types/Task.ts
- [ ] T035 [P] Create MCPConnection model with Zod schema in shared/types/MCPConnection.ts
- [ ] T036 [P] Create FileOperation model with Zod schema in shared/types/FileOperation.ts
- [ ] T037 [P] Create Notification model with Zod schema in shared/types/Notification.ts
- [ ] T038 [P] Create WebSocketMessage model with Zod schema in shared/types/WebSocketMessage.ts

### Backend Services
- [ ] T039 Create Fastify server setup with plugins in backend/src/server.ts
- [ ] T040 Implement SessionService for session management in backend/src/services/SessionService.ts
- [ ] T041 Implement AgentService for AI operations in backend/src/services/AgentService.ts
- [ ] T042 Implement FileService for file system operations in backend/src/services/FileService.ts
- [ ] T043 Implement ConfigService for configuration management in backend/src/services/ConfigService.ts
- [ ] T044 Implement MCPService for MCP protocol in backend/src/services/MCPService.ts

### API Endpoints Implementation
- [ ] T045 Implement sessions endpoints in backend/src/api/sessions.ts
- [ ] T046 Implement agents endpoints in backend/src/api/agents.ts
- [ ] T047 Implement conversations endpoints in backend/src/api/conversations.ts
- [ ] T048 Implement tasks endpoints in backend/src/api/tasks.ts
- [ ] T049 Implement files endpoints in backend/src/api/files.ts
- [ ] T050 Implement MCP endpoints in backend/src/api/mcp.ts
- [ ] T051 Implement configuration endpoints in backend/src/api/configurations.ts

### WebSocket Implementation
- [ ] T052 Create WebSocket server setup in backend/src/websocket/server.ts
- [ ] T053 Implement WebSocket message handlers in backend/src/websocket/handlers.ts
- [ ] T054 Implement heartbeat mechanism in backend/src/websocket/heartbeat.ts
- [ ] T055 Create WebSocket client manager in backend/src/websocket/clientManager.ts

## Phase 3.4: Frontend Implementation

### Svelte Components
- [ ] T056 Create main App layout component in frontend/src/App.svelte
- [ ] T057 Create ChatInterface component in frontend/src/components/ChatInterface.svelte
- [ ] T058 Create FileBrowser component in frontend/src/components/FileBrowser.svelte
- [ ] T059 Create CodeEditor component in frontend/src/components/CodeEditor.svelte
- [ ] T060 Create SettingsPanel component in frontend/src/components/SettingsPanel.svelte
- [ ] T061 Create NotificationToast component in frontend/src/components/NotificationToast.svelte

### Frontend Services
- [ ] T062 Create WebSocket client service in frontend/src/services/websocket.ts
- [ ] T063 Create API client service in frontend/src/services/api.ts
- [ ] T064 Create state management stores in frontend/src/stores/

## Phase 3.5: Integration & Polish

### Integration Tasks
- [ ] T065 Integrate JWT authentication flow between frontend and backend
- [ ] T066 Setup TOML configuration file parsing in backend
- [ ] T067 Implement file upload/download functionality
- [ ] T068 Connect MCP client to external servers
- [ ] T069 Setup notification system with browser notifications

### Performance & Security
- [ ] T070 [P] Implement rate limiting on API and WebSocket
- [ ] T071 [P] Add request validation middleware with Zod
- [ ] T072 [P] Setup CSP headers and security middleware
- [ ] T073 [P] Implement WebSocket message compression

### Documentation & Deployment
- [ ] T074 [P] Create API documentation from OpenAPI spec
- [ ] T075 [P] Write deployment guide with Docker configuration
- [ ] T076 [P] Create developer documentation in README.md
- [ ] T077 Run full test suite and fix any failures
- [ ] T078 Performance benchmarking per quickstart.md targets

## Dependency Graph

```
Setup (T001-T010)
    ↓
Tests (T011-T029) [Can run in parallel]
    ↓
Models (T030-T038) [Can run in parallel]
    ↓
Backend Services (T039-T044)
    ↓
API Implementation (T045-T051)
    ↓
WebSocket (T052-T055)
    ↓
Frontend (T056-T064)
    ↓
Integration (T065-T069)
    ↓
Polish (T070-T078) [Can run in parallel]
```

## Parallel Execution Examples

### After Setup Phase
```bash
# Run all API contract tests in parallel (T011-T020)
Task "T011: Create test for POST /api/sessions"
Task "T012: Create test for GET /api/sessions/{id}"
Task "T013: Create test for POST /api/sessions/{id}/agents"
# ... continue for T014-T020
```

### Model Creation Phase
```bash
# Create all 9 model files simultaneously (T030-T038)
Task "T030: Create Session model"
Task "T031: Create Configuration model"
Task "T032: Create Agent model"
# ... continue for T033-T038
```

### Final Polish Phase
```bash
# Run documentation and security tasks in parallel (T070-T076)
Task "T070: Implement rate limiting"
Task "T071: Add request validation"
Task "T072: Setup CSP headers"
Task "T074: Create API documentation"
```

## Validation Checklist

- ✅ All 9 entities have model tasks (T030-T038)
- ✅ All 11 API endpoints have test tasks (T011-T020)
- ✅ All 19 WebSocket messages covered (T021-T024, T052-T055)
- ✅ All 5 E2E scenarios have tests (T025-T029)
- ✅ TDD enforced: Tests (Phase 3.2) before Implementation (Phase 3.3)
- ✅ Parallel tasks marked with [P] for different files
- ✅ Total tasks: 78 (comprehensive coverage)

## Notes for Execution

1. **Environment Setup**: Ensure Node.js 20+ and npm 10+ installed
2. **Parallel Tasks**: Tasks marked [P] can be executed simultaneously by multiple agents
3. **Test-First**: Phase 3.2 tests MUST be written before Phase 3.3 implementation
4. **File Paths**: All paths relative to repository root
5. **Dependencies**: Each phase depends on previous phase completion

---
*Tasks generated from design documents. Ready for execution.*