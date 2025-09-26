# Tasks: Terminal-Style UI for Codex Chrome Extension

**Input**: Design documents from `/specs/001-currently-codex-chrome/`
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
- **Chrome Extension**: `codex-chrome/src/` at repository root
- Components in `codex-chrome/src/sidepanel/components/`
- Styles in `codex-chrome/src/sidepanel/`
- Configuration at `codex-chrome/` root

## Phase 3.1: Setup & Configuration
- [x] T001 Update Tailwind configuration with terminal theme colors in codex-chrome/tailwind.config.js
- [x] T002 Configure PostCSS to process Tailwind directives in codex-chrome/postcss.config.js
- [x] T003 [P] Create terminal-specific CSS layer in codex-chrome/src/sidepanel/styles.css

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T004 [P] Visual test for terminal container styling in codex-chrome/src/tests/terminal-container.test.ts
- [x] T005 [P] Component test for TerminalMessage color mapping in codex-chrome/src/tests/terminal-message.test.ts
- [x] T006 [P] Component test for TerminalInput behavior in codex-chrome/src/tests/terminal-input.test.ts
- [x] T007 [P] Integration test for theme application in codex-chrome/src/tests/theme-integration.test.ts
- [x] T008 [P] Accessibility test for contrast ratios in codex-chrome/src/tests/accessibility.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [x] T009 [P] Create TerminalMessage.svelte component in codex-chrome/src/sidepanel/components/TerminalMessage.svelte
- [x] T010 [P] Create TerminalInput.svelte component in codex-chrome/src/sidepanel/components/TerminalInput.svelte
- [x] T011 [P] Create TerminalContainer.svelte wrapper in codex-chrome/src/sidepanel/components/TerminalContainer.svelte
- [x] T012 [P] Define MessageType TypeScript enum in codex-chrome/src/types/terminal.ts
- [x] T013 Update App.svelte to use terminal components in codex-chrome/src/sidepanel/App.svelte
- [x] T014 Apply terminal styles to existing sidepanel.css in codex-chrome/src/sidepanel/sidepanel.css

## Phase 3.4: Integration & Refinement
- [x] T015 Integrate terminal container with existing message flow
- [x] T016 Map existing message types to terminal color scheme
- [x] T017 Update input field to use terminal styling
- [x] T018 Ensure scroll behavior maintains terminal aesthetic
- [x] T019 Add ARIA attributes for screen reader support

## Phase 3.5: Polish & Verification
- [x] T020 [P] Verify Tailwind purge/content configuration in codex-chrome/tailwind.config.js
- [ ] T021 [P] Run Lighthouse accessibility audit and fix issues (requires runtime)
- [ ] T022 [P] Performance test: verify < 100ms initial render (requires runtime)
- [ ] T023 [P] Visual QA: verify colors match specification (#00ff00, #ffff00, #ff0000) (requires runtime)
- [ ] T024 Browser compatibility test in Chrome/Edge/Brave (requires runtime)
- [ ] T025 Create visual regression test baseline (requires runtime)

## Dependencies
- Setup (T001-T003) must complete first
- Tests (T004-T008) before implementation (T009-T014)
- T009-T011 (components) can run in parallel
- T013 depends on T009-T011 completion
- T014 can run independently
- Integration tasks (T015-T019) after core implementation
- Polish tasks (T020-T025) can mostly run in parallel

## Parallel Example
```bash
# Launch component tests together (Phase 3.2):
Task: "Visual test for terminal container styling in codex-chrome/src/tests/terminal-container.test.ts"
Task: "Component test for TerminalMessage color mapping in codex-chrome/src/tests/terminal-message.test.ts"
Task: "Component test for TerminalInput behavior in codex-chrome/src/tests/terminal-input.test.ts"
Task: "Integration test for theme application in codex-chrome/src/tests/theme-integration.test.ts"
Task: "Accessibility test for contrast ratios in codex-chrome/src/tests/accessibility.test.ts"

# Launch component creation together (Phase 3.3):
Task: "Create TerminalMessage.svelte component in codex-chrome/src/sidepanel/components/TerminalMessage.svelte"
Task: "Create TerminalInput.svelte component in codex-chrome/src/sidepanel/components/TerminalInput.svelte"
Task: "Create TerminalContainer.svelte wrapper in codex-chrome/src/sidepanel/components/TerminalContainer.svelte"
Task: "Define MessageType TypeScript enum in codex-chrome/src/types/terminal.ts"
```

## Notes
- This is a UI-only feature with no backend or data persistence
- Focus on visual consistency and accessibility
- Keep implementation simple per requirements ("keep the code concise and simple")
- No complex CRT effects or animations
- Use system monospace fonts, no external font loading
- All colors must maintain WCAG AA contrast ratios
- Tests verify visual appearance and component behavior
- Leverage existing Tailwind v4 installation

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - terminal-theme.contract.md → T004-T008 (visual/component tests)
   - Component contracts → T009-T011 (implementation)

2. **From Data Model**:
   - TerminalTheme configuration → T001 (Tailwind config)
   - MessageType enum → T012 (TypeScript types)
   - CSS Custom Properties → T003 (styles.css)

3. **From Quickstart**:
   - Setup steps → T001-T003 (configuration)
   - Component creation → T009-T011 (implementation)
   - Verification checklist → T021-T025 (polish)

4. **Ordering**:
   - Setup → Tests → Components → Integration → Polish
   - Parallel execution for independent files

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T004-T008)
- [x] All entities have implementation tasks (theme config, components)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task in same phase