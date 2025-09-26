# Tasks: DOM Tool Integration for Chrome Extension Agent

**Input**: Design documents from `/specs/001-dom-tool-integration/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- **Chrome Extension**: `src/tools/dom/`, `content/`, `tests/`
- Paths shown below follow the Chrome Extension structure from plan.md

## Phase 3.1: Setup
- [x] T001 Create DOM service directory structure at src/tools/dom/ with subdirectories
- [x] T002 Initialize TypeScript configuration for DOM service module
- [x] T003 [P] Configure Jest/Vitest for unit testing DOM operations
- [x] T004 [P] Set up Chrome Extension test framework for integration testing
- [x] T005 [P] Create base imports and exports in src/tools/dom/index.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests for DOM Operations
- [x] T006 [P] Contract test for QUERY operation in tests/unit/tools/dom/test_query_contract.ts
- [x] T007 [P] Contract test for CLICK operation in tests/unit/tools/dom/test_click_contract.ts
- [x] T008 [P] Contract test for TYPE operation in tests/unit/tools/dom/test_type_contract.ts
- [x] T009 [P] Contract test for GET_ATTRIBUTE operation in tests/unit/tools/dom/test_get_attribute_contract.ts
- [x] T010 [P] Contract test for SET_ATTRIBUTE operation in tests/unit/tools/dom/test_set_attribute_contract.ts
- [x] T011 [P] Contract test for FILL_FORM operation in tests/unit/tools/dom/test_fill_form_contract.ts
- [x] T012 [P] Contract test for CAPTURE_SNAPSHOT operation in tests/unit/tools/dom/test_capture_snapshot_contract.ts
- [x] T013 [P] Contract test for GET_ACCESSIBILITY_TREE operation in tests/unit/tools/dom/test_accessibility_contract.ts
- [x] T014 [P] Contract test for EXECUTE_SEQUENCE operation in tests/unit/tools/dom/test_execute_sequence_contract.ts

### Contract Tests for Message Protocol
- [x] T015 [P] Contract test for DOM_ACTION message handling in tests/unit/tools/dom/test_dom_action_message.ts
- [x] T016 [P] Contract test for content script ping/pong in tests/unit/tools/dom/test_content_script_lifecycle.ts
- [x] T017 [P] Contract test for frame messaging in tests/unit/tools/dom/test_frame_messages.ts

### Integration Tests from Quickstart Scenarios
- [x] T018 [P] Integration test for form automation flow in tests/integration/dom-operations/test_form_automation.ts
- [x] T019 [P] Integration test for element visibility and wait in tests/integration/dom-operations/test_wait_for_element.ts
- [x] T020 [P] Integration test for action sequence execution in tests/integration/dom-operations/test_action_sequence.ts
- [x] T021 [P] Integration test for iframe element access in tests/integration/dom-operations/test_iframe_access.ts
- [x] T022 [P] Integration test for error handling and retry in tests/integration/dom-operations/test_error_retry.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Model Implementation
- [x] T023 [P] DOMElement entity in src/tools/dom/views.ts
- [x] T024 [P] BoundingBox entity in src/tools/dom/views.ts
- [x] T025 [P] DOMTreeNode entity in src/tools/dom/views.ts
- [x] T026 [P] AccessibilityNode entity in src/tools/dom/views.ts
- [x] T027 [P] DOMSnapshot and DocumentSnapshot entities in src/tools/dom/views.ts
- [x] T028 [P] DOMAction and ActionResult entities in src/tools/dom/views.ts
- [x] T029 [P] ErrorDetail and FrameContext entities in src/tools/dom/views.ts

### DOM Service Core Implementation
- [x] T030 DomService class initialization and configuration in src/tools/dom/service.ts
- [x] T031 Query operations (querySelector, querySelectorAll) in src/tools/dom/service.ts
- [x] T032 Click operation with options support in src/tools/dom/service.ts
- [x] T033 Type operation with clear and delay support in src/tools/dom/service.ts
- [x] T034 Attribute operations (get/set) in src/tools/dom/service.ts
- [x] T035 Content operations (getText, getHTML) in src/tools/dom/service.ts
- [x] T036 Form operations (fillForm, submitForm) in src/tools/dom/service.ts
- [x] T037 Wait and visibility check operations in src/tools/dom/service.ts
- [x] T038 Execute sequence operation with batching in src/tools/dom/service.ts

### Chrome-specific Implementation
- [x] T039 [P] Content script DOM operations in content/content-script.js
- [x] T040 [P] DOM capture and serialization in src/tools/dom/chrome/domCapture.ts
- [x] T041 [P] Accessibility tree generation in src/tools/dom/chrome/accessibilityTree.ts
- [x] T042 [P] Frame utilities and cross-origin handling in src/tools/dom/chrome/frameUtils.ts
- [x] T043 [P] Content script injection and lifecycle in src/tools/dom/chrome/contentScript.ts

### Advanced Features Implementation
- [x] T044 [P] Enhanced DOM tree node with computed styles in src/tools/dom/enhancedDOMTreeNode.ts
- [x] T045 [P] Enhanced snapshot with lazy loading in src/tools/dom/enhancedSnapshot.ts
- [x] T046 [P] DOM serializer with string deduplication in src/tools/dom/serializer/serializer.ts
- [x] T047 [P] Clickable elements detection in src/tools/dom/serializer/clickableElements.ts
- [x] T048 [P] Paint order analysis for z-index in src/tools/dom/serializer/paintOrder.ts

### Utility Functions
- [x] T049 [P] DOM utility functions (selector validation, element checks) in src/tools/dom/utils.ts
- [x] T050 [P] Error handling utilities and retry logic in src/tools/dom/utils.ts

## Phase 3.4: Integration

### DOMTool Refactoring
- [x] T051 Update DOMTool interface to use new DomService in src/tools/DOMTool.ts
- [x] T052 Migrate existing DOMTool methods to delegate to DomService
- [x] T053 Add backward compatibility layer for existing consumers
- [x] T054 Update DOMTool error handling to use new error structure

### Message Protocol Implementation
- [ ] T055 Message router implementation for background script
- [ ] T056 Message handlers for each DOM operation type
- [ ] T057 Message validation and serialization
- [ ] T058 Tab and frame management for message routing

### Chrome Extension Integration
- [ ] T059 Update manifest.json permissions for DOM operations
- [ ] T060 Background script setup for message handling
- [ ] T061 Content script auto-injection on tab activation
- [ ] T062 Cross-frame communication setup

## Phase 3.5: Polish

### Performance Optimization
- [ ] T063 [P] Implement caching for computed styles in src/tools/dom/service.ts
- [ ] T064 [P] Add performance timing metrics to all operations
- [ ] T065 [P] Optimize selector parsing and validation
- [ ] T066 [P] Implement incremental DOM updates instead of full recapture

### Unit Tests for Utilities
- [ ] T067 [P] Unit tests for DOM utilities in tests/unit/tools/dom/test_utils.ts
- [ ] T068 [P] Unit tests for error handling in tests/unit/tools/dom/test_error_handling.ts
- [ ] T069 [P] Unit tests for serialization in tests/unit/tools/dom/test_serializer.ts

### Documentation
- [ ] T070 [P] API migration guide from old DOMTool to new service
- [ ] T071 [P] Performance benchmarks documentation
- [ ] T072 [P] Troubleshooting guide for common issues

### Verification
- [ ] T073 Compare Python vs TypeScript feature parity checklist
- [ ] T074 Run all 25 operations end-to-end verification
- [ ] T075 Performance validation (<100ms single op, <500ms batch)
- [ ] T076 Manual testing following quickstart.md scenarios

## Dependencies
- Setup (T001-T005) must complete first
- All tests (T006-T022) before any implementation (T023-T050)
- Data models (T023-T029) before service implementation (T030-T038)
- Core service (T030-T038) before Chrome-specific (T039-T043)
- Chrome-specific (T039-T043) before advanced features (T044-T050)
- All implementation (T023-T050) before integration (T051-T062)
- Integration (T051-T062) before polish (T063-T076)

## Parallel Example
```bash
# Launch contract tests together (T006-T017):
Task: "Contract test for QUERY operation in tests/unit/tools/dom/test_query_contract.ts"
Task: "Contract test for CLICK operation in tests/unit/tools/dom/test_click_contract.ts"
Task: "Contract test for TYPE operation in tests/unit/tools/dom/test_type_contract.ts"
Task: "Contract test for GET_ATTRIBUTE operation in tests/unit/tools/dom/test_get_attribute_contract.ts"

# Launch data model tasks together (T023-T029):
Task: "DOMElement entity in src/tools/dom/views.ts"
Task: "BoundingBox entity in src/tools/dom/views.ts"
Task: "DOMTreeNode entity in src/tools/dom/views.ts"
Task: "AccessibilityNode entity in src/tools/dom/views.ts"

# Launch Chrome-specific implementations together (T039-T043):
Task: "Content script DOM operations in content/content-script.js"
Task: "DOM capture and serialization in src/tools/dom/chrome/domCapture.ts"
Task: "Accessibility tree generation in src/tools/dom/chrome/accessibilityTree.ts"
```

## Notes
- [P] tasks work on different files with no dependencies
- All contract tests must fail initially (TDD approach)
- Commit after completing each task or parallel task group
- Performance targets: <100ms single operation, <500ms for 10 operations
- Cross-origin iframes have limited access per browser security

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T006-T017)
- [x] All entities have model tasks (T023-T029)
- [x] All tests come before implementation
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No parallel task modifies same file as another [P] task
- [x] All 25 DOM operations covered in tasks
- [x] Message protocol contracts have tests
- [x] Quickstart scenarios have integration tests