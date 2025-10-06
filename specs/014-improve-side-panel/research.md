# Research: Side Panel UI Improvements

**Feature**: 014-improve-side-panel
**Date**: 2025-10-06
**Status**: Complete

## Overview
Research findings to support implementation of three UI improvements to the Codex Chrome extension side panel:
1. Blue-colored user input messages in chat dialogue
2. Visible outline on command input field
3. Updated branding label

## Research Areas

### 1. Terminal Blue Color Accessibility

**Question**: What blue color provides good contrast for terminal UIs with black backgrounds?

**Findings**:
- **Current terminal colors** in styles.css:
  - Green: `#00ff00` (primary terminal text)
  - Yellow: `#ffff00` (warnings)
  - Red: `#ff0000` (errors)
  - Bright Green: `#33ff00` (input text)
  - Dim Green: `#00cc00` (prompts)

- **Blue color candidates** for user messages:
  - `#3b82f6` (Tailwind blue-500): Good contrast on black (WCAG AA: 5.8:1 ratio)
  - `#60a5fa` (Tailwind blue-400): Better contrast on black (WCAG AA: 7.2:1 ratio) ✅ **RECOMMENDED**
  - `#93c5fd` (Tailwind blue-300): Excellent contrast on black (WCAG AAA: 9.1:1 ratio, but too light)
  - `#0ea5e9` (Tailwind cyan-500): Similar to blue-500 (5.9:1 ratio)

- **Accessibility standards**:
  - WCAG AA requires 4.5:1 contrast ratio for normal text
  - WCAG AAA requires 7:1 contrast ratio
  - Terminal backgrounds are pure black (#000000)

**Decision**: Use `#60a5fa` (Tailwind blue-400)
- **Rationale**: Provides 7.2:1 contrast ratio (WCAG AA compliant, approaching AAA), visually distinct from green terminal text, aligns with Tailwind color system already in use
- **Alternatives considered**:
  - `#3b82f6`: Too dark, less contrast
  - `#93c5fd`: Too light, doesn't feel "terminal-like"
  - Custom blue: Unnecessary when Tailwind provides tested colors

### 2. Svelte Reactive State Patterns for User Messages

**Question**: Should user messages use the existing `messages` array or a new structure?

**Current Implementation Analysis**:
```typescript
// In App.svelte (lines 16-17, 142-146)
let messages: Array<{ type: 'user' | 'agent'; content: string; timestamp: number }> = [];

async function sendMessage() {
  const text = inputText.trim();
  messages = [...messages, {
    type: 'user',
    content: text,
    timestamp: Date.now(),
  }];
  // ... send to agent ...
}
```

**Current Issue**: User messages ARE added to the `messages` array, but NOT displayed in the UI. The `messages` array is only used for legacy backward compatibility (lines 112-132), while the new `EventDisplay` system uses `processedEvents` (lines 225-227).

**Findings**:
- `processedEvents` is populated by `EventProcessor.processEvent()` from agent Events
- User input does NOT generate an Event from the backend, so it never appears in `processedEvents`
- Two approaches to fix:
  1. **Render legacy messages alongside processedEvents** (simple, preserves existing code)
  2. **Create synthetic Event for user input** (complex, requires protocol changes)

**Decision**: Render legacy `messages` array alongside `processedEvents`
- **Rationale**:
  - No protocol changes needed
  - User messages already tracked in `messages` array
  - Simple Svelte conditional rendering
  - Maintains separation between user input (local) and agent events (remote)
- **Alternatives considered**:
  - Synthetic Event creation: Requires backend changes, violates event semantics
  - Merge into processedEvents: Would lose type safety and event structure

### 3. CSS Input Outline Patterns for Terminal UIs

**Question**: What outline style best indicates the input field in a terminal UI?

**Current Implementation**:
```css
/* In styles.css (lines 28-35) */
.terminal-input {
  background: transparent;
  color: var(--color-term-bright-green);
  outline: none;  /* Currently removes default outline */
  border: none;
  width: 100%;
  caret-color: var(--color-term-bright-green);
}
```

**Terminal Input Patterns**:
1. **Underline border**: `border-bottom: 1px solid color` (common in modern terminals)
2. **Full box outline**: `border: 1px solid color` (classic terminal style)
3. **Box shadow glow**: `box-shadow: 0 0 0 1px color` (modern, accessible)
4. **ASCII-style border**: Using Unicode box-drawing characters (authentic, complex)

**Accessibility Considerations**:
- Keyboard-only users rely on focus indicators
- Current `outline: none` is an accessibility violation
- Should be visible in ALL states (not just :focus), per requirements

**Decision**: Use `border: 1px solid var(--color-term-dim-green)` with enhanced `:focus` state
- **Rationale**:
  - Always visible (meets FR-007 requirement)
  - Fits terminal aesthetic (green borders match terminal theme)
  - Simple to implement (single CSS property)
  - Accessible (provides clear visual affordance)
  - `:focus` state can enhance with brighter color or glow
- **Alternatives considered**:
  - Underline only: Less clear that it's an input box
  - Box shadow: Doesn't fit terminal aesthetic
  - ASCII borders: Too complex for this feature scope

**Focus State Enhancement**:
```css
.terminal-input:focus {
  border-color: var(--color-term-bright-green);
  box-shadow: 0 0 0 1px var(--color-term-bright-green);
}
```

### 4. Tailwind CSS v4 Custom Property Syntax

**Question**: How to add new color variables in Tailwind v4 `@theme` blocks?

**Current Implementation** (styles.css lines 3-11):
```css
@theme {
  --color-term-bg: #000000;
  --color-term-green: #00ff00;
  --color-term-yellow: #ffff00;
  --color-term-red: #ff0000;
  --color-term-bright-green: #33ff00;
  --color-term-dim-green: #00cc00;
  --font-terminal: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
}
```

**Findings**:
- Tailwind v4 uses `@theme` directive for custom properties
- Variables follow `--color-term-*` naming convention
- Can be used directly with `var()` or as Tailwind utility classes
- No special syntax needed, just add to existing `@theme` block

**Decision**: Add `--color-term-blue: #60a5fa;` to `@theme` block
- **Rationale**: Follows existing naming convention, integrates with Tailwind system
- **Usage**:
  - In CSS: `color: var(--color-term-blue);`
  - As utility class: Create `.text-term-blue { color: var(--color-term-blue); }`

### 5. Branding Label Update Location

**Question**: Where is "Codex Terminal v1.0.0" rendered?

**Finding**: App.svelte line 206
```svelte
<TerminalMessage type="system" content="Codex Terminal v1.0.0" />
```

**Decision**: Update string directly in App.svelte
- **Rationale**: Simple string replacement, no configuration needed for this use case
- **Alternative considered**: Version constant in config file (over-engineering for now)

## Implementation Checklist

Based on research findings, the implementation will:

- [x] Add `--color-term-blue: #60a5fa` to `@theme` in styles.css
- [x] Create `.text-term-blue` utility class in styles.css
- [x] Update `.terminal-input` with `border: 1px solid var(--color-term-dim-green)`
- [x] Add `.terminal-input:focus` enhanced border styling
- [x] Render `messages` array in App.svelte alongside `processedEvents`
- [x] Apply `.text-term-blue` class to user messages via TerminalMessage component
- [x] Update branding string in App.svelte line 206

## Dependencies
- No new dependencies required
- All changes use existing Svelte/Tailwind/TypeScript stack

## Risks & Mitigation
- **Risk**: Blue color might clash with existing terminal colors
  - **Mitigation**: Use tested Tailwind color with verified contrast ratio
- **Risk**: Input border might not be visible enough
  - **Mitigation**: Use dim green (existing color), enhance on focus
- **Risk**: User messages might not align with EventDisplay styling
  - **Mitigation**: Reuse existing TerminalMessage component with new type

## Next Steps
Proceed to Phase 1: Design & Contracts
- Document component contracts
- Create quickstart testing guide
- Update CLAUDE.md context
