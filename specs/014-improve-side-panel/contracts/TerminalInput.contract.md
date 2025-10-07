# Contract: TerminalInput.svelte

**Component**: `codex-chrome/src/sidepanel/components/TerminalInput.svelte`
**Feature**: 014-improve-side-panel
**Date**: 2025-10-06

## Purpose
Text input component for terminal-style command entry. Handles user text input with keyboard events.

## Modifications for This Feature

### 1. Add Visible Outline (FR-003, FR-007)

**Current Behavior**: Input has no visible border (`outline: none`, `border: none` in styles.css).

**New Behavior**: Input has visible outline in all states (empty, focused, filled).

**Component Change**: NO CHANGES to TerminalInput.svelte component code.

**Styling Change**: Update `.terminal-input` class in `styles.css` (see styles.contract.md).

**Template** (remains unchanged):
```svelte
<input
  type="text"
  bind:value
  {placeholder}
  on:keypress={handleKeyPress}
  class="terminal-input"
  aria-label="Terminal input"
/>
```

**Behavioral Contract**:
- Component functionality unchanged (still handles input and Enter key)
- Visual appearance updated via CSS (border always visible)
- Focus state enhanced via CSS (brighter border, optional glow)

## Input Contract (Unchanged)
- **Props**:
  - `value`: string (bound to parent state)
  - `placeholder`: string (default: "")
  - `onSubmit`: (value: string) => void (callback on Enter)
- **User Interactions**:
  - Text input (updates `value` via two-way binding)
  - Enter key (calls `onSubmit(value)`)

## Output Contract (Unchanged)
- **Value Updates**: `value` prop updated on user input (two-way binding)
- **Submit Events**: `onSubmit` called on Enter key press
- **Visual Output**: (MODIFIED) Visible border/outline at all times

## State Contract (Unchanged)
No internal state. All state managed via props.

## Styling Contract (NEW)

### CSS Class: `.terminal-input`

**Location**: `codex-chrome/src/sidepanel/styles.css` (lines 28-35)

**Current Styles**:
```css
.terminal-input {
  background: transparent;
  color: var(--color-term-bright-green);
  outline: none;  /* ← REMOVE */
  border: none;   /* ← REPLACE */
  width: 100%;
  caret-color: var(--color-term-bright-green);
}
```

**New Styles**:
```css
.terminal-input {
  background: transparent;
  color: var(--color-term-bright-green);
  border: 1px solid var(--color-term-dim-green);  /* NEW: Always visible */
  width: 100%;
  caret-color: var(--color-term-bright-green);
  padding: 0.25rem 0.5rem;  /* NEW: Spacing for border */
  border-radius: 2px;       /* NEW: Subtle rounding */
}

.terminal-input:focus {
  outline: none;  /* Remove default browser outline */
  border-color: var(--color-term-bright-green);  /* Brighter on focus */
  box-shadow: 0 0 0 1px var(--color-term-bright-green);  /* Subtle glow */
}
```

**Visual Behavior**:
- **Default State**: 1px solid dim green border
- **Focus State**: Border becomes bright green with subtle glow
- **Filled State**: Same as default (border always visible)

## Dependencies
- **CSS Variables** (defined in styles.css `@theme`):
  - `--color-term-dim-green`: #00cc00 (existing)
  - `--color-term-bright-green`: #33ff00 (existing)
- **Parent Components**:
  - App.svelte (no changes needed, just passes props)

## Error Handling
No error cases. Input is controlled by parent component.

## Testing Contract

### Visual Tests
```typescript
// tests/sidepanel/TerminalInput.test.ts
describe('TerminalInput.svelte - Outline Visibility', () => {
  it('should have visible border in default state', () => {
    // Given: Input rendered
    // When: No interaction
    // Then: Border computed style is "1px solid #00cc00"
  });

  it('should enhance border on focus', () => {
    // Given: Input rendered
    // When: Input focused
    // Then: Border color is #33ff00, box-shadow present
  });

  it('should maintain border when filled', () => {
    // Given: Input with text
    // When: Rendered
    // Then: Border still visible (not hidden by content)
  });

  it('should be keyboard accessible', () => {
    // Given: Input rendered
    // When: Tab pressed
    // Then: Input receives focus, border enhances
  });
});
```

### Component Tests
```typescript
describe('TerminalInput.svelte - Functional Behavior', () => {
  it('should maintain existing Enter key behavior', () => {
    // Given: Input with value "test"
    // When: Enter key pressed
    // Then: onSubmit called with "test"
  });

  it('should maintain two-way binding', () => {
    // Given: Parent updates value prop
    // When: Value changes
    // Then: Input displays new value
  });
});
```

## Accessibility Contract
- **Keyboard Navigation**: ✅ Enhanced (visible focus indicator now present)
- **Screen Readers**: ✅ `aria-label="Terminal input"` (existing)
- **Color Contrast**: ✅ Dim green border meets WCAG AA (4.5:1 on black background)
- **Focus Indicator**: ✅ Bright green border + glow on :focus (exceeds WCAG requirements)

## Performance Contract
- **Render Time**: <1ms (no JavaScript changes, CSS only)
- **Paint Performance**: Negligible (simple border, no complex shadows)

## Breaking Changes
None. This is a visual-only enhancement. All existing functionality preserved.

## Migration Notes
No migration needed. Component API unchanged.

## Browser Compatibility
- Border styles: Supported in all modern browsers
- Box-shadow: Supported in all modern browsers
- No vendor prefixes required
