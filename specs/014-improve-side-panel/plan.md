# Implementation Plan: Side Panel UI Improvements

**Branch**: `014-improve-side-panel` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-improve-side-panel/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✓ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Project Type: Chrome Extension (Svelte + TypeScript)
   → Structure Decision: Single project with Svelte components
   → Minor theme clarification noted but non-blocking
3. Fill the Constitution Check section based on the content of the constitution document.
   → ✓ Constitution template is placeholder only, no specific rules to check
4. Evaluate Constitution Check section below
   → ✓ No violations, simple UI improvements
   → ✓ Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → ✓ Research terminal styling patterns and Svelte component updates
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✓ Generate component contracts and styling specifications
7. Re-evaluate Constitution Check section
   → ✓ No new violations
   → ✓ Update Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → ✓ Task approach documented
9. STOP - Ready for /tasks command
   → ✓ COMPLETE
```

## Summary
Improve the Codex Chrome extension side panel UI with three focused enhancements:
1. Display user input messages in the chat dialogue with blue text color for visual distinction
2. Add a visible outline/border to the command input field to improve UX affordance
3. Update the branding label from "Codex Terminal v1.0.0" to "Codex For Chrome v1.0.0 (By AI Republic)"

**Technical Approach**: Modify existing Svelte components (App.svelte, TerminalInput.svelte) and CSS styles (styles.css, sidepanel.css) to implement the visual improvements. Add user message tracking to the EventDisplay system to ensure messages persist in the dialogue.

## Technical Context
**Language/Version**: TypeScript 5.9.2, Svelte 4.2.20
**Primary Dependencies**: Tailwind CSS 4.1.13, Vite 5.4.20, @sveltejs/vite-plugin-svelte 3.1.2
**Storage**: In-memory reactive stores (Svelte) for UI state
**Testing**: Vitest 3.2.4, @testing-library/svelte 5.2.8, jsdom 27.0.0
**Target Platform**: Chrome Extension (Manifest V3), Side Panel API
**Project Type**: Single project - Chrome extension with Svelte UI components
**Performance Goals**: <16ms render updates (60 fps), instant visual feedback on input
**Constraints**: Must work with existing terminal-mode styling, preserve EventProcessor integration
**Scale/Scope**: 3 UI components affected (App.svelte, TerminalInput.svelte, TerminalMessage.svelte), 2 stylesheets modified

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file is a template placeholder with no specific project rules defined. The following general best practices apply:

**General Best Practices**:
- ✅ No new libraries required (using existing Svelte + Tailwind)
- ✅ No architectural changes (simple component updates)
- ✅ Testable changes (visual regression + component tests)
- ✅ Simple, focused scope (UI-only improvements)
- ✅ No breaking changes (additive modifications)

**Result**: PASS - No constitutional violations, simple UI enhancement

## Project Structure

### Documentation (this feature)
```
specs/014-improve-side-panel/
├── plan.md              # This file (/plan command output)
├── spec.md              # Feature specification (already exists)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (to be created)
│   ├── App.contract.md
│   ├── TerminalInput.contract.md
│   └── styles.contract.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
codex-chrome/
├── src/
│   ├── sidepanel/
│   │   ├── App.svelte                    # [MODIFY] Add user message display
│   │   ├── sidepanel.css                 # [MODIFY] Update branding label styles
│   │   ├── styles.css                    # [MODIFY] Add blue color, input outline
│   │   ├── main.ts                       # [NO CHANGE]
│   │   └── components/
│   │       ├── TerminalInput.svelte      # [MODIFY] Add outline styling
│   │       ├── TerminalMessage.svelte    # [MODIFY] Support blue user messages
│   │       ├── TerminalContainer.svelte  # [NO CHANGE]
│   │       └── event_display/
│   │           ├── EventDisplay.svelte   # [NO CHANGE]
│   │           └── EventProcessor.ts     # [NO CHANGE]
│   ├── protocol/
│   │   └── types.ts                      # [NO CHANGE]
│   └── core/
│       └── MessageRouter.ts              # [NO CHANGE]
└── tests/
    └── sidepanel/
        ├── App.test.ts                   # [CREATE] Test user message display
        ├── TerminalInput.test.ts         # [CREATE] Test input outline
        └── visual/
            └── sidepanel.visual.test.ts  # [CREATE] Visual regression tests
```

**Structure Decision**: Single project structure (Chrome extension). Changes are isolated to the `codex-chrome/src/sidepanel/` directory, specifically UI components and stylesheets. No backend, API, or protocol changes required.

## Phase 0: Outline & Research

**Research Tasks**:
1. **Terminal color schemes**: Investigate best practices for blue text in terminal UIs
   - Research accessible blue colors for terminal themes
   - Ensure contrast ratios meet WCAG AA standards
   - Consider both light/dark terminal backgrounds

2. **Svelte reactive state patterns**: Confirm approach for tracking user messages
   - Review existing message state management in App.svelte
   - Determine if user messages should use existing `messages` array or new structure
   - Investigate EventProcessor integration for user message persistence

3. **CSS input outline patterns**: Research best UX patterns for command input affordance
   - Terminal-style input field borders (ASCII-art style vs modern outline)
   - Focus state handling (outline on focus vs always visible)
   - Accessibility considerations for keyboard navigation

4. **Tailwind CSS v4 custom properties**: Verify syntax for new color variables
   - Review Tailwind v4 `@theme` syntax in styles.css
   - Confirm custom property naming conventions
   - Test color variable usage in Svelte components

**Deliverable**: `research.md` with:
- **Blue Color Choice**: Specific hex/RGB values for user message text
- **Message State Approach**: Whether to extend existing `messages` array or create separate state
- **Input Outline Style**: CSS properties for visible outline (border, box-shadow, or outline)
- **Branding Update**: Confirm string replacement location in App.svelte

## Phase 1: Design & Contracts

**Design Artifacts**:

### 1. Data Model (`data-model.md`)
Since this is a UI-only feature, there are no persistent data entities. Document the in-memory state shape:

```typescript
// Extended message type (if needed)
interface ChatMessage {
  type: 'user' | 'agent';
  content: string;
  timestamp: number;
  // New fields if needed for EventProcessor integration
}
```

### 2. Component Contracts (`contracts/`)

**App.contract.md**: App.svelte modifications
- **Input**: User submission events from TerminalInput
- **Output**: User messages displayed in chat dialogue (blue text)
- **State**: `messages` array includes user inputs with `type: 'user'`
- **Behavior**: On sendMessage(), add user message to `messages` before sending to agent

**TerminalInput.contract.md**: TerminalInput.svelte modifications
- **Input**: `value` (string), `placeholder` (string), `onSubmit` callback
- **Output**: Visual outline on input field
- **Styling**: `.terminal-input` class includes visible border/outline
- **Behavior**: No functional changes, only visual enhancement

**TerminalMessage.contract.md**: TerminalMessage.svelte modifications (if needed)
- **Input**: `type` ('user' | 'agent' | ...), `content` (string)
- **Output**: Blue text for `type: 'user'`, existing colors for other types
- **Styling**: Conditional class based on message type

**styles.contract.md**: CSS modifications
- **New color variable**: `--color-term-blue: #3b82f6` (or research result)
- **Input outline**: `.terminal-input` border or box-shadow
- **User message color**: `.text-term-blue` utility class

### 3. Quickstart Guide (`quickstart.md`)
Manual testing steps:
1. Build and load extension in Chrome
2. Open side panel
3. Verify branding shows "Codex For Chrome v1.0.0 (By AI Republic)"
4. Type a command and submit
5. Verify user message appears in blue above input
6. Verify input field has visible outline
7. Submit multiple messages, verify chronological order

### 4. Update CLAUDE.md
Run the update script to add this feature to the context:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

Expected additions:
- Add "Side Panel UI Improvements (Feature 014)" to recent changes
- Document new blue color variable in terminal theme
- Note user message display pattern for future UI work

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Research tasks** (from Phase 0 unknowns):
   - Research terminal blue color accessibility
   - Research Svelte message state patterns
   - Research input outline UX patterns

2. **Design tasks** (from Phase 1 contracts):
   - Define blue color variable in styles.css
   - Design user message display in App.svelte
   - Design input outline styling

3. **Test creation tasks** (TDD approach):
   - Write App.svelte test for user message display
   - Write TerminalInput.svelte test for outline visibility
   - Write TerminalMessage.svelte test for blue color
   - Write visual regression test for branding label

4. **Implementation tasks** (make tests pass):
   - Update styles.css: Add `--color-term-blue` variable
   - Update styles.css: Add `.terminal-input` outline styling
   - Update App.svelte: Modify sendMessage to add user message to dialogue
   - Update App.svelte: Update branding label text
   - Update TerminalMessage.svelte: Add blue color for user messages (if needed)

5. **Integration tasks**:
   - Test full user flow (type → submit → see blue message)
   - Verify outline visible in all states (empty, focused, filled)
   - Verify branding label updated in side panel
   - Run visual regression tests

**Ordering Strategy**:
- Phase 0 research first (resolve unknowns)
- Phase 1 design (document approach)
- Test creation before implementation (TDD)
- Styling changes before component logic
- Component tests before integration tests
- Mark independent tasks with [P] for parallel execution

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (run tests, execute quickstart.md, visual verification)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. This is a straightforward UI enhancement with:
- No new dependencies
- No architectural changes
- No breaking changes
- Simple, testable modifications

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - ✅ research.md created
- [x] Phase 1: Design complete (/plan command) - ✅ data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - ✅ Task strategy documented
- [x] Phase 3: Tasks generated (/tasks command) - ✅ tasks.md created with 18 tasks
- [x] Phase 4: Implementation complete (execute tasks T001-T018) - ✅ All 18 tasks completed
- [x] Phase 5: Validation passed - ✅ All tests passing (36/36), build successful

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (theme question is non-blocking)
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- ✅ `/specs/014-improve-side-panel/research.md` - Blue color, state patterns, input outline research
- ✅ `/specs/014-improve-side-panel/data-model.md` - ChatMessage in-memory state structure
- ✅ `/specs/014-improve-side-panel/contracts/App.contract.md` - User message display contract
- ✅ `/specs/014-improve-side-panel/contracts/TerminalInput.contract.md` - Input outline contract
- ✅ `/specs/014-improve-side-panel/contracts/TerminalMessage.contract.md` - Blue color support contract
- ✅ `/specs/014-improve-side-panel/contracts/styles.contract.md` - CSS variable and styling contract
- ✅ `/specs/014-improve-side-panel/quickstart.md` - Manual testing guide (5 test scenarios)
- ✅ `/specs/014-improve-side-panel/tasks.md` - 18 implementation tasks (TDD approach)
- ✅ `CLAUDE.md` - Updated with feature context

**Ready for Implementation**: Execute tasks T001-T018 from tasks.md

---
*Based on Constitution template - See `.specify/memory/constitution.md`*
