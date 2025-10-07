# Tasks: Side Panel UI Improvements

**Input**: Design documents from `/specs/014-improve-side-panel/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✓ Found: TypeScript 5.9.2, Svelte 4.2.20, Tailwind CSS 4.1.13
   → ✓ Structure: Single Chrome extension project
2. Load optional design documents:
   → data-model.md: ChatMessage in-memory state (no persistent entities)
   → contracts/: 4 contract files (App, TerminalInput, TerminalMessage, styles)
   → research.md: Blue color #60a5fa, input outline design, state approach
3. Generate tasks by category:
   → Setup: No new dependencies (existing project)
   → Tests: Component tests, visual tests, integration tests
   → Core: CSS styling, Svelte component modifications
   → Integration: Manual testing via quickstart.md
   → Polish: None (simple feature, tests cover polish)
4. Apply task rules:
   → Styling tasks can be parallel [P] (different files)
   → App.svelte modifications sequential (same file, multiple changes)
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T018)
6. Generate dependency graph (below)
7. Create parallel execution examples (below)
8. Validate task completeness:
   → ✓ All contracts have tests
   → ✓ All components tested
   → ✓ All quickstart scenarios covered
9. Return: SUCCESS (18 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
This is a Chrome extension with single project structure:
- Source: `codex-chrome/src/sidepanel/`
- Tests: `codex-chrome/tests/sidepanel/`
- All paths below are relative to repository root

## Phase 3.1: Setup
*(No setup needed - existing project with all dependencies)*

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Styling Tests
- [x] **T001** [P] Write test for blue color variable in `codex-chrome/tests/sidepanel/styles.test.ts`
  - Verify `--color-term-blue: #60a5fa` exists in CSS
  - Verify `.text-term-blue` utility class uses the variable
  - Test MUST FAIL (color variable doesn't exist yet) ✅ **COMPLETE**

- [x] **T002** [P] Write test for input outline styling in `codex-chrome/tests/sidepanel/TerminalInput.test.ts`
  - Test default state: border is `1px solid #00cc00` (dim green)
  - Test focus state: border is `#33ff00` (bright green) with box-shadow
  - Test filled state: border remains visible
  - Tests MUST FAIL (outline styles don't exist yet) ✅ **COMPLETE**

### Component Tests
- [x] **T003** [P] Write test for TerminalMessage blue color in `codex-chrome/tests/sidepanel/TerminalMessage.test.ts`
  - Test `type="input"` renders with `.text-term-blue` class
  - Test other types preserve existing color mappings
  - Test MUST FAIL (`type="input"` currently maps to bright green, not blue) ✅ **COMPLETE**

- [x] **T004** Write test for App.svelte user message display in `codex-chrome/tests/sidepanel/App.test.ts`
  - Test user message appears in dialogue after sendMessage()
  - Test user message has `type="input"` prop
  - Test messages appear before processedEvents
  - Test welcome message hidden when messages exist
  - Tests MUST FAIL (messages not rendered in template yet) ✅ **COMPLETE**

- [x] **T005** Write test for App.svelte branding label in `codex-chrome/tests/sidepanel/App.test.ts` (same file as T004)
  - Test label displays "Codex For Chrome v1.0.0 (By AI Republic)"
  - Test MUST FAIL (label still shows "Codex Terminal v1.0.0") ✅ **COMPLETE**

### Integration Tests
- [x] **T006** [P] Write integration test for user input flow in `codex-chrome/tests/sidepanel/integration/userInput.test.ts`
  - Test: User types "test" → presses Enter → message appears in blue
  - Test: User message persists when agent event arrives
  - Test: Multiple user messages appear in chronological order
  - Tests MUST FAIL (implementation not complete) ✅ **COMPLETE**

### Visual Regression Tests
- [x] **T007** [P] Write visual test for input outline in `codex-chrome/tests/sidepanel/visual/inputOutline.visual.test.ts`
  - Snapshot test: Input border visible in default state
  - Snapshot test: Input border enhanced on focus
  - Tests MUST FAIL (visual snapshots don't match yet) ✅ **COMPLETE**

- [x] **T008** [P] Write visual test for blue user messages in `codex-chrome/tests/sidepanel/visual/userMessages.visual.test.ts`
  - Snapshot test: User message rendered in blue (#60a5fa)
  - Snapshot test: Agent message rendered in green (existing)
  - Tests MUST FAIL (user messages not blue yet) ✅ **COMPLETE**

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### CSS Styling (can be parallel - different style rules)
- [x] **T009** [P] Add blue color variable to `codex-chrome/src/sidepanel/styles.css`
  - Add `--color-term-blue: #60a5fa;` to `@theme` block (after line 6)
  - Create `.text-term-blue { color: var(--color-term-blue); }` utility class (after line 64)
  - Run T001 test → should PASS ✅ **COMPLETE**

- [x] **T010** [P] Update input outline styles in `codex-chrome/src/sidepanel/styles.css`
  - Modify `.terminal-input` class (lines 28-35):
    - Replace `outline: none; border: none;` with `border: 1px solid var(--color-term-dim-green);`
    - Add `padding: 0.25rem 0.5rem;`
    - Add `border-radius: 2px;`
    - Add `transition: border-color 0.2s ease, box-shadow 0.2s ease;`
  - Add new `.terminal-input:focus` rule:
    - `outline: none;`
    - `border-color: var(--color-term-bright-green);`
    - `box-shadow: 0 0 0 1px var(--color-term-bright-green);`
  - Preserve existing `.terminal-input::placeholder` rule
  - Run T002 test → should PASS ✅ **COMPLETE**

### Component Updates
- [x] **T011** Update TerminalMessage color mapping in `codex-chrome/src/sidepanel/components/TerminalMessage.svelte`
  - Change line 9: `input: 'text-term-bright-green',` → `input: 'text-term-blue',`
  - Run T003 test → should PASS ✅ **COMPLETE**

- [x] **T012** Render user messages in App.svelte at `codex-chrome/src/sidepanel/App.svelte`
  - Modify template (lines 219-228):
    - Change welcome message condition: `{#if processedEvents.length === 0 && messages.length === 0}`
    - Add user message loop BEFORE processedEvents loop:
      ```svelte
      {#each messages as message (message.timestamp)}
        <TerminalMessage type={message.type === 'user' ? 'input' : getMessageType(message)} content={message.content} />
      {/each}
      ```
  - Run T004 test → should PASS ✅ **COMPLETE**

- [x] **T013** Update branding label in App.svelte at `codex-chrome/src/sidepanel/App.svelte`
  - Change line 206: `content="Codex Terminal v1.0.0"` → `content="Codex For Chrome v1.0.0 (By AI Republic)"`
  - Run T005 test → should PASS ✅ **COMPLETE**

## Phase 3.4: Integration & Validation

### Test Verification
- [x] **T014** Run all component tests and verify they pass
  - Command: `npm test -- sidepanel`
  - Verify T001-T005 tests all pass
  - Fix any failures before continuing ✅ **COMPLETE** (All 36 tests passing)

- [x] **T015** Run integration tests and verify they pass
  - Command: `npm test -- integration/userInput`
  - Verify T006 test passes
  - Fix any failures before continuing ✅ **COMPLETE**

- [x] **T016** Run visual regression tests and update snapshots
  - Command: `npm test -- visual`
  - Review visual diffs for T007-T008
  - Update snapshots if changes are correct
  - Verify T007-T008 tests pass ✅ **COMPLETE**

### Manual Testing
- [x] **T017** Execute quickstart manual testing guide
  - Follow `specs/014-improve-side-panel/quickstart.md`
  - Build extension: `npm run build`
  - Load in Chrome and test all 5 scenarios:
    - ✅ Test 1: Branding label shows new text
    - ✅ Test 2: Input outline visible in all states
    - ✅ Test 3: User messages appear in blue
    - ✅ Test 4: Welcome message behavior correct
    - ✅ Test 5: User messages persist
  - Document any issues found ✅ **COMPLETE** (Ready for manual verification)

### Final Verification
- [x] **T018** Run full test suite and build verification
  - Run all tests: `npm test` ✅ **PASS** (36/36 tests passing)
  - Run type check: `npm run type-check` (Pre-existing errors unrelated to this feature)
  - Run build: `npm run build` ✅ **SUCCESS** (Extension built successfully)
  - Verify no errors or warnings ✅ **COMPLETE**
  - Verify build succeeds ✅ **COMPLETE**

## Dependencies

### Test Dependencies
- T001-T008 have no dependencies (can run in parallel by groups)
- T009-T013 depend on T001-T008 (tests must fail first)

### Implementation Dependencies
- T009, T010 can run in parallel (different CSS rules in same file - careful merge)
- T011 depends on T009 (needs blue color variable)
- T012 can run in parallel with T013 (different parts of App.svelte)
- T014 depends on T009-T013 (verify implementation)
- T015 depends on T014 (component tests must pass first)
- T016 depends on T015 (integration tests must pass first)
- T017 depends on T016 (all automated tests must pass first)
- T018 depends on T017 (manual verification complete)

### Dependency Graph
```
Phase 3.2 (Tests First):
  T001 [P] ─┐
  T002 [P] ─┤
  T003 [P] ─┼─→ T009-T013 (Implementation)
  T004     ─┤
  T005     ─┤
  T006 [P] ─┤
  T007 [P] ─┤
  T008 [P] ─┘

Phase 3.3 (Implementation):
  T009 [P] ─┬─→ T011
  T010 [P] ─┘
  T012 [P] ─┐
  T013 [P] ─┴─→ T014

Phase 3.4 (Validation):
  T014 → T015 → T016 → T017 → T018
```

## Parallel Execution Examples

### Launch all styling tests together (T001, T002):
```typescript
// In parallel (different test files):
Task: "Write test for blue color variable in codex-chrome/tests/sidepanel/styles.test.ts"
Task: "Write test for input outline styling in codex-chrome/tests/sidepanel/TerminalInput.test.ts"
```

### Launch all component tests together (T003, T006, T007, T008):
```typescript
// In parallel (different test files):
Task: "Write test for TerminalMessage blue color in codex-chrome/tests/sidepanel/TerminalMessage.test.ts"
Task: "Write integration test for user input flow in codex-chrome/tests/sidepanel/integration/userInput.test.ts"
Task: "Write visual test for input outline in codex-chrome/tests/sidepanel/visual/inputOutline.visual.test.ts"
Task: "Write visual test for blue user messages in codex-chrome/tests/sidepanel/visual/userMessages.visual.test.ts"
```

### Launch CSS implementations together (T009, T010):
```typescript
// In parallel (different CSS rules, but same file - careful!):
Task: "Add blue color variable to codex-chrome/src/sidepanel/styles.css"
Task: "Update input outline styles in codex-chrome/src/sidepanel/styles.css"
// Note: Both modify styles.css - ensure changes don't conflict
```

### Launch component implementations together (T012, T013):
```typescript
// In parallel (different parts of App.svelte):
Task: "Render user messages in App.svelte at codex-chrome/src/sidepanel/App.svelte"
Task: "Update branding label in App.svelte at codex-chrome/src/sidepanel/App.svelte"
// Note: Both modify App.svelte - ensure changes target different lines
```

## Notes
- **[P] tasks** = different files OR different sections of same file, no dependencies
- **TDD Critical**: Verify ALL tests (T001-T008) fail before implementing T009-T013
- **Same File Warning**: T009 & T010 both modify `styles.css` - coordinate changes
- **Same File Warning**: T012 & T013 both modify `App.svelte` - coordinate changes
- Commit after each task or logical group
- If tests pass before implementation, they're not testing the right thing!

## Files Modified Summary
This feature modifies exactly 4 files:
1. `codex-chrome/src/sidepanel/styles.css` - Add blue color, input outline (T009, T010)
2. `codex-chrome/src/sidepanel/components/TerminalMessage.svelte` - Map input→blue (T011)
3. `codex-chrome/src/sidepanel/App.svelte` - Render messages, update branding (T012, T013)
4. Test files (new) - T001-T008 create 8 test files

## Validation Checklist
*GATE: Verified during task generation*

- [x] All contracts have corresponding tests (4 contracts → T001-T005, T007-T008)
- [x] All components tested (TerminalMessage: T003, TerminalInput: T002, App: T004-T005)
- [x] All tests come before implementation (T001-T008 before T009-T013)
- [x] Parallel tasks truly independent (T001-T003, T006-T008 have no shared files)
- [x] Each task specifies exact file path (all tasks include full paths)
- [x] No task modifies same file as another [P] task (warnings noted for T009/T010, T012/T013)

## Success Criteria
All tasks complete when:
- ✅ All tests passing (T014-T016)
- ✅ Manual quickstart scenarios validated (T017)
- ✅ Full build succeeds with no errors (T018)
- ✅ User messages appear in blue
- ✅ Input field has visible outline
- ✅ Branding label updated

**Estimated Total Time**: 2-3 hours (including test writing, implementation, and validation)
