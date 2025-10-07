# Quickstart: Side Panel UI Improvements

**Feature**: 014-improve-side-panel
**Date**: 2025-10-06
**Estimated Time**: 5 minutes

## Purpose
Manual testing guide to validate the three UI improvements to the Codex Chrome extension side panel.

## Prerequisites
- Chrome browser (v100+)
- Codex Chrome extension built and loaded
- Side panel feature enabled

## Build and Load Extension

### 1. Build the Extension
```bash
cd codex-chrome
npm run build
```

**Expected Output**:
```
✓ Built in XXXms
dist/ directory created with extension files
```

### 2. Load Extension in Chrome
1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select `codex-chrome/dist` directory
6. Verify "Codex Chrome" appears in extensions list

### 3. Open Side Panel
1. Click Codex Chrome extension icon in toolbar
2. Select "Open Side Panel" (or side panel opens automatically)
3. Side panel appears on right side of browser window

**Expected**: Side panel displays with terminal-style black background and green text.

## Test Scenarios

### Test 1: Branding Label (FR-004)

**Objective**: Verify branding updated to "Codex For Chrome v1.0.0 (By AI Republic)".

**Steps**:
1. Open side panel (as above)
2. Look at top-left corner of panel

**Expected Result**:
- ✅ Label reads: "Codex For Chrome v1.0.0 (By AI Republic)"
- ✅ NOT: "Codex Terminal v1.0.0"

**Visual Reference**:
```
┌─────────────────────────────────────────────┐
│ Codex For Chrome v1.0.0 (By AI Republic)    │  ← Should show this
│ [CONNECTED] [PROCESSING]                    │
├─────────────────────────────────────────────┤
│ ...                                         │
```

### Test 2: Input Field Outline (FR-003, FR-007)

**Objective**: Verify command input field has visible outline in all states.

**Steps**:
1. Open side panel
2. Observe input field at bottom (next to `>` prompt)
3. **State A: Empty, unfocused**
   - Look at input field border
   - Expected: Dim green outline visible
4. **State B: Focused**
   - Click inside input field
   - Expected: Bright green outline visible, possibly with glow
5. **State C: Filled**
   - Type "test" (don't submit)
   - Expected: Outline still visible (not hidden by text)

**Expected Results**:
- ✅ **Empty**: Dim green border visible (approximately #00cc00)
- ✅ **Focused**: Brighter green border (approximately #33ff00), may have subtle glow
- ✅ **Filled**: Border remains visible

**Visual Reference**:
```
Empty/Unfocused:
> ┌──────────────────────────┐
  │ Enter command...         │  ← Dim green border
  └──────────────────────────┘

Focused:
> ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓
  ┃ Enter command...         ┃  ← Bright green border + glow
  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Filled:
> ┌──────────────────────────┐
  │ test█                    │  ← Border still visible
  └──────────────────────────┘
```

**Failure Criteria**:
- ❌ No border visible in any state
- ❌ Border only visible on focus (should be always visible)
- ❌ Border disappears when text entered

### Test 3: User Message Display (FR-001, FR-002, FR-005, FR-006)

**Objective**: Verify user input appears in chat dialogue in blue color.

**Steps**:
1. Open side panel
2. Verify side panel is connected ([CONNECTED] status in top-right)
3. Type "hello" in input field
4. Press Enter
5. Observe chat dialogue area above input

**Expected Results**:
- ✅ "hello" appears in chat dialogue (above input field)
- ✅ Text color is blue (approximately #60a5fa, distinctly different from green)
- ✅ Message appears BEFORE any agent responses
- ✅ Message persists (doesn't disappear when agent responds)

**Visual Reference**:
```
┌─────────────────────────────────────────────┐
│ Codex For Chrome v1.0.0 (By AI Republic)    │
│ [CONNECTED]                                 │
├─────────────────────────────────────────────┤
│                                             │
│ hello                                       │  ← Blue color (#60a5fa)
│                                             │
│ [Agent response in green...]                │  ← Green color (existing)
│                                             │
├─────────────────────────────────────────────┤
│ > ┌──────────────────────────┐             │
│   │ Enter command...         │             │
│   └──────────────────────────┘             │
└─────────────────────────────────────────────┘
```

**Additional Checks**:
- Type and submit multiple messages ("test 1", "test 2", "test 3")
- Verify:
  - ✅ All user messages appear in chronological order
  - ✅ All user messages are blue
  - ✅ User messages appear before agent responses

**Failure Criteria**:
- ❌ User message doesn't appear in dialogue
- ❌ User message appears in green (not blue)
- ❌ User message appears after agent response (wrong order)
- ❌ User message disappears when agent responds

### Test 4: Welcome Message Behavior

**Objective**: Verify welcome message hides correctly.

**Steps**:
1. Open side panel (fresh session)
2. Observe initial state
3. Type "test" and submit
4. Observe welcome message

**Expected Results**:
- ✅ **Before submission**: "Welcome to Codex Terminal" visible
- ✅ **After submission**: Welcome message hidden, user message visible

### Test 5: Message Persistence

**Objective**: Verify user messages persist when agent events arrive.

**Steps**:
1. Open side panel
2. Submit user message: "analyze this page"
3. Wait for agent to process and respond
4. Observe chat dialogue

**Expected Results**:
- ✅ User message "analyze this page" remains visible in blue
- ✅ Agent events/responses appear below user message
- ✅ User message is NOT replaced or hidden

## Color Verification (Optional, for precise testing)

### Using Browser DevTools
1. Open side panel
2. Submit a user message
3. Right-click on user message → "Inspect"
4. In DevTools Styles pane, verify:
   - Color: `rgb(96, 165, 250)` or `#60a5fa`
   - Class: `text-term-blue` (or similar)

### Input Border Verification
1. Inspect input field
2. In DevTools Computed pane, verify:
   - Border: `1px solid rgb(0, 204, 0)` (unfocused)
   - Border: `1px solid rgb(51, 255, 0)` (focused)

## Accessibility Testing

### Keyboard Navigation
1. Press Tab repeatedly to navigate through side panel
2. When input field receives focus:
   - ✅ Border becomes bright green (visible focus indicator)
   - ✅ Able to type immediately
3. Press Enter to submit:
   - ✅ Message appears in blue

### Screen Reader Testing (Optional)
1. Enable screen reader (e.g., NVDA, ChromeVox)
2. Navigate to input field
3. Type and submit message
4. Verify:
   - ✅ Input field announced correctly
   - ✅ User message content read aloud

## Troubleshooting

### User message doesn't appear
- **Check**: Is side panel connected? ([CONNECTED] in top-right)
- **Check**: Did you press Enter to submit?
- **Action**: Refresh side panel and try again

### User message is green, not blue
- **Check**: Is message appearing in `processedEvents` instead of `messages` array?
- **Action**: Verify App.svelte rendering logic (messages before processedEvents)

### Input outline not visible
- **Check**: CSS build successful?
- **Action**: Rebuild extension (`npm run build`)
- **Action**: Hard refresh side panel (Ctrl+Shift+R)

### Branding label not updated
- **Check**: Extension fully reloaded in chrome://extensions/?
- **Action**: Remove and re-add extension

## Success Criteria
All tests pass:
- ✅ Branding shows "Codex For Chrome v1.0.0 (By AI Republic)"
- ✅ Input field has visible outline (dim green → bright green on focus)
- ✅ User messages appear in blue in chat dialogue
- ✅ User messages persist and appear in chronological order
- ✅ Keyboard navigation works with visible focus indicators

## Next Steps
After quickstart validation:
1. Run automated tests: `npm test`
2. Run visual regression tests (if configured)
3. Test in different Chrome versions (if needed)
4. Prepare for production deployment
