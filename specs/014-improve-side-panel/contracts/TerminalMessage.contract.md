# Contract: TerminalMessage.svelte

**Component**: `codex-chrome/src/sidepanel/components/TerminalMessage.svelte`
**Feature**: 014-improve-side-panel
**Date**: 2025-10-06

## Purpose
Message display component for terminal-style text output. Applies color coding based on message type.

## Modifications for This Feature

### 1. Support Blue Color for User Messages (FR-002)

**Current Behavior**: Component supports types: `default`, `warning`, `error`, `input`, `system`.

**Investigation Needed**: Check if `type="input"` already exists and maps to blue, or if new type needed.

**Expected Component** (location to be verified):
```svelte
<!-- Assumed structure, to be verified by reading actual file -->
<script lang="ts">
  export let type: 'default' | 'warning' | 'error' | 'input' | 'system';
  export let content: string;

  function getColorClass(type: string): string {
    switch (type) {
      case 'warning': return 'text-term-yellow';
      case 'error': return 'text-term-red';
      case 'system': return 'text-term-dim-green';
      case 'input': return 'text-term-bright-green';  // ← Current mapping?
      default: return 'text-term-green';
    }
  }
</script>

<div class="terminal-message {getColorClass(type)}">
  {content}
</div>
```

**Possible Scenarios**:

#### Scenario A: `type="input"` already exists but maps to green
**Solution**: Update color mapping to use blue for `type="input"`:
```typescript
case 'input': return 'text-term-blue';  // CHANGED from text-term-bright-green
```

#### Scenario B: No `type="input"` exists yet
**Solution**: Add new case to type union and color mapping:
```typescript
export let type: 'default' | 'warning' | 'error' | 'input' | 'system';  // Add 'input'
// ...
case 'input': return 'text-term-blue';  // NEW
```

#### Scenario C: Different component structure (e.g., class-based styling)
**Solution**: Adapt to actual component structure while ensuring:
- User messages (`type="input"`) render in blue
- Other message types unchanged

## Input Contract
- **Props**:
  - `type`: Message type discriminator
    - `'input'`: User input messages (NEW or MODIFIED to use blue)
    - `'default'`: Standard agent messages (green)
    - `'warning'`: Warning messages (yellow)
    - `'error'`: Error messages (red)
    - `'system'`: System messages (dim green)
  - `content`: Text content to display

## Output Contract
- **Visual Output**:
  - `type="input"`: Renders in blue (`var(--color-term-blue)`)
  - Other types: Existing colors unchanged
- **HTML Structure**: Single `<div>` with content (or similar, to be verified)

## State Contract
No internal state. Pure presentational component.

## Styling Contract

### New CSS Utility: `.text-term-blue`

**Location**: `codex-chrome/src/sidepanel/styles.css`

**Current Utilities** (lines 46-64):
```css
.text-term-green { color: var(--color-term-green); }
.text-term-yellow { color: var(--color-term-yellow); }
.text-term-red { color: var(--color-term-red); }
.text-term-bright-green { color: var(--color-term-bright-green); }
.text-term-dim-green { color: var(--color-term-dim-green); }
```

**New Utility** (to be added):
```css
.text-term-blue { color: var(--color-term-blue); }
```

## Dependencies
- **CSS Variables**:
  - `--color-term-blue: #60a5fa` (NEW, defined in `@theme`)
- **Parent Components**:
  - App.svelte (passes `type="input"` for user messages)

## Testing Contract

### Component Tests
```typescript
// tests/sidepanel/TerminalMessage.test.ts
describe('TerminalMessage.svelte - Color Mapping', () => {
  it('should render input type in blue', () => {
    // Given: type="input", content="test"
    // When: Component rendered
    // Then: Element has class "text-term-blue"
  });

  it('should preserve existing color mappings', () => {
    // Given: Various message types
    // When: Each rendered
    // Then: Colors match existing behavior (green, yellow, red, etc.)
  });

  it('should display content correctly', () => {
    // Given: type="input", content="Hello World"
    // When: Component rendered
    // Then: Text content is "Hello World"
  });
});
```

### Visual Regression Tests
```typescript
describe('TerminalMessage.svelte - Visual', () => {
  it('should render blue text for user input', async () => {
    // Given: Message with type="input"
    // When: Rendered
    // Then: Computed color is #60a5fa (blue)
  });
});
```

## Accessibility Contract
- **Color Contrast**: Blue text (#60a5fa) on black background = 7.2:1 ratio (WCAG AA ✅)
- **Semantic HTML**: No ARIA needed (plain text display)
- **Screen Readers**: Content read as plain text (appropriate)

## Performance Contract
- **Render Time**: <1ms per message (no complex logic)
- **Paint Performance**: Negligible (simple text color)

## Breaking Changes
None. Adding `type="input"` is additive (or modifying existing unused value).

## Migration Notes
- If `type="input"` already exists: Simple color change (verify no other usages rely on green)
- If new type: No migration needed (new type for new feature)

## Investigation Required
**Before implementation**, verify:
1. Does TerminalMessage.svelte already exist?
2. What is the current `type` prop type union?
3. Is `type="input"` already used elsewhere?
4. What is the exact component structure (props, template)?

**Action**: Read `codex-chrome/src/sidepanel/components/TerminalMessage.svelte` during implementation phase.
