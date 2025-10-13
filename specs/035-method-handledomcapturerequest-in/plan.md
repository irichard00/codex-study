
# Implementation Plan: Fix DOM Capture Handler and Enable Source Maps

**Branch**: `035-method-handledomcapturerequest-in` | **Date**: 2025-10-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-method-handledomcapturerequest-in/spec.md`

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
This is a bug fix for the DOM capture functionality in the Codex Chrome Extension. The `handleDOMCaptureRequest` function returns an empty `nodes` array despite successful DOM traversal, breaking the core DOM snapshot capability. Additionally, source maps need to be properly configured to enable TypeScript debugging in Chrome DevTools. The fix requires correcting the element mapping logic in `captureDocument()` and ensuring Vite generates accessible source maps for the content script.

## Technical Context
**Language/Version**: TypeScript 5.9.2, ES2020+ target
**Primary Dependencies**: Vite 5.4.20, Svelte 4.2.20, @types/chrome 0.1.12, Vitest 3.2.4
**Storage**: Chrome Extension APIs (chrome.storage), IndexedDB for session persistence
**Testing**: Vitest with jsdom, chrome-mock for extension APIs, @testing-library/svelte
**Target Platform**: Chrome Extension Manifest V3, Chrome 120+
**Project Type**: Chrome Extension (single codebase, background + content + sidepanel)
**Performance Goals**: DOM capture <5s for 10k nodes, <200ms for simple pages (100-1000 nodes)
**Constraints**: Content script must be IIFE bundle (no dynamic imports), Chrome extension CSP, source maps must be inline or external with proper paths
**Scale/Scope**: Handle pages with 20k+ DOM nodes, support Shadow DOM and iframes up to depth 10

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS (Bug fix - no new architecture)

This is a bug fix for existing functionality, not a new feature. No constitutional violations:
- No new libraries or services
- Existing test infrastructure (Vitest) will be used
- Changes are isolated to `domCaptureHandler.ts` and `vite.config.content.mjs`
- TDD approach: write failing tests first, then fix implementation

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
```
codex-chrome/
├── src/
│   ├── content/
│   │   ├── content-script.ts      # Main content script entry
│   │   └── domCaptureHandler.ts   # DOM capture implementation (BUG HERE)
│   ├── tools/
│   │   └── dom/
│   │       ├── chrome/
│   │       │   ├── domTraversal.ts        # DOM tree traversal
│   │       │   ├── snapshotCapture.ts     # Element snapshot capture
│   │       │   ├── ariaExtraction.ts      # Accessibility tree extraction
│   │       │   ├── stringInterning.ts     # String pool for compression
│   │       │   ├── iframeTraversal.ts     # Iframe handling
│   │       │   └── shadowDOMTraversal.ts  # Shadow DOM handling
│   │       ├── service.ts          # DOM service coordination
│   │       └── views.ts            # DOM view serialization
│   ├── background/
│   │   └── service-worker.ts
│   └── sidepanel/
│       └── [svelte components]
├── vite.config.mjs                 # Main build config
├── vite.config.content.mjs         # Content script build (SOURCE MAP FIX HERE)
├── scripts/
│   └── build.js                    # Custom build orchestration
└── tests/
    └── __tests__/
        └── [existing vitest tests]
```

**Structure Decision**: Chrome Extension with single TypeScript codebase. Content scripts built separately with IIFE format due to Chrome extension requirements. Bug is in `domCaptureHandler.ts` lines 155-224 where element mapping fails. Source map configuration is in `vite.config.content.mjs`.

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
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Contract tests are already written in `contracts/` - create test execution tasks
- Focus on implementation tasks to fix identified bugs
- Create validation tasks to verify fixes

**Bug Fix Task Breakdown**:

1. **DOM Traversal Fix** (domTraversal.ts):
   - Update `TraversalResult` interface to include `elementMap`
   - Modify `traverseDOM()` to build element map during traversal
   - Add element tracking in iteration loop

2. **DOM Capture Fix** (domCaptureHandler.ts):
   - Update `captureDocument()` to use element map
   - Remove stub `getElementByPath()` function
   - Fix element-to-snapshot attachment logic
   - Fix string interning type casts (number vs string)
   - Fix attribute interning to use indices

3. **Source Map Fix** (vite.config.content.mjs):
   - Update build configuration to generate external source maps
   - Ensure sourceMappingURL comment is included
   - Verify Rollup output options for source map

4. **Testing Tasks**:
   - Run contract tests for DOM capture (should fail initially)
   - Run contract tests for source maps (should fail initially)
   - Verify fixes with contract tests (should pass after fixes)
   - Manual testing in Chrome extension environment

**Ordering Strategy**:
1. Update interfaces first (TraversalResult)
2. Fix traversal to build element map
3. Fix DOM capture to use element map
4. Fix string interning
5. Fix Vite config for source maps
6. Run contract tests to verify
7. Run quickstart validation

**Dependencies**:
- Traversal fix must complete before capture fix (depends on elementMap)
- String interning fix can run in parallel with source map fix [P]
- All contract tests depend on implementation fixes

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

**Test Files to Create**:
- Contract tests already exist in `contracts/dom-capture.contract.ts`
- Contract tests already exist in `contracts/source-maps.contract.ts`
- Integration tests for complete capture flow
- Performance tests for large DOMs

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
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (bug fix, no new architecture)
- [x] Post-Design Constitution Check: PASS (no constitutional violations)
- [x] All NEEDS CLARIFICATION resolved (no unknowns in technical context)
- [x] Complexity deviations documented (none - bug fix only)

**Artifacts Generated**:
- [x] research.md - Root cause analysis and technical research
- [x] data-model.md - Entity definitions and validation rules
- [x] contracts/dom-capture.contract.ts - DOM capture contract tests (20+ assertions)
- [x] contracts/source-maps.contract.ts - Source map contract tests
- [x] quickstart.md - Step-by-step validation guide
- [x] CLAUDE.md - Updated with feature context
- [x] tasks.md - 17 ordered implementation tasks with dependencies

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
