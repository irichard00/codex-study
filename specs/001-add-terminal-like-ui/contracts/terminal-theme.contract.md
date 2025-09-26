# Terminal Theme Contract

## Overview
Contract defining the styling interface for terminal-themed UI components in the Codex Chrome extension.

## Tailwind Configuration Contract

### Required Theme Extensions
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'term': {
          'bg': '#000000',
          'green': '#00ff00',
          'yellow': '#ffff00',
          'red': '#ff0000',
          'bright-green': '#33ff00',
          'dim-green': '#00cc00'
        }
      },
      fontFamily: {
        'terminal': ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      }
    }
  }
}
```

## Component Styling Contract

### TerminalContainer Component
**Purpose**: Root container for terminal interface

**Required Props**:
- None (styling only)

**CSS Classes**:
```
bg-term-bg
font-terminal
text-term-green
p-4
overflow-auto
min-h-full
```

**Expected Rendering**:
- Black background filling entire container
- Monospace font applied to all children
- Default green text color
- Consistent padding on all sides

### TerminalMessage Component
**Purpose**: Display individual messages with appropriate styling

**Required Props**:
```typescript
interface TerminalMessageProps {
  type: 'default' | 'warning' | 'error' | 'input' | 'system';
  content: string;
}
```

**CSS Class Mapping**:
```typescript
const typeToClass: Record<string, string> = {
  'default': 'text-term-green',
  'warning': 'text-term-yellow',
  'error': 'text-term-red',
  'input': 'text-term-bright-green',
  'system': 'text-term-dim-green'
};
```

**Expected Rendering**:
- Color based on message type
- Preserved whitespace and formatting
- Word wrapping for long lines
- Bottom margin for message separation

### TerminalInput Component
**Purpose**: User input field with terminal styling

**Required Props**:
```typescript
interface TerminalInputProps {
  value: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
}
```

**CSS Classes**:
```
bg-transparent
text-term-bright-green
font-terminal
outline-none
border-none
w-full
caret-term-bright-green
placeholder:text-term-dim-green
```

**Expected Behavior**:
- Transparent background
- Bright green text for user input
- Block or underscore caret
- No visible borders or outlines
- Full width of container

## Global Styles Contract

### Base Terminal Styles
```css
/* Required in global CSS */
.terminal-wrapper {
  @apply bg-term-bg min-h-screen;
}

.terminal-content {
  @apply font-terminal text-sm leading-relaxed;
}

.terminal-prompt::before {
  content: '> ';
  @apply text-term-dim-green;
}
```

## Accessibility Contract

### Required ARIA Attributes
```html
<!-- Container -->
<div role="log" aria-label="Terminal output">

<!-- Messages -->
<div aria-live="polite" aria-atomic="true">

<!-- Input -->
<input aria-label="Terminal input" />
```

### Color Contrast Requirements
- Green on black: >= 5.95:1 ratio
- Yellow on black: >= 10.8:1 ratio
- Red on black: >= 5.25:1 ratio
- All ratios must meet WCAG AA standard

## Responsive Design Contract

### Breakpoint Adjustments
```css
/* Mobile (< 640px) */
@media (max-width: 639px) {
  .terminal-content {
    @apply text-xs p-2;
  }
}

/* Tablet (640px - 1024px) */
@media (min-width: 640px) and (max-width: 1023px) {
  .terminal-content {
    @apply text-sm p-3;
  }
}

/* Desktop (>= 1024px) */
@media (min-width: 1024px) {
  .terminal-content {
    @apply text-base p-4;
  }
}
```

## Testing Contract

### Visual Regression Tests
1. Terminal container renders with black background
2. Default text appears in green
3. Warning messages appear in yellow
4. Error messages appear in red
5. User input appears in bright green
6. Monospace font applied throughout
7. Proper padding and spacing maintained

### Accessibility Tests
1. Contrast ratios meet WCAG AA
2. ARIA attributes present and correct
3. Keyboard navigation functional
4. Screen reader announcements work

### Component Tests
1. Message type prop changes text color
2. Input field accepts and displays text
3. Container maintains scroll position
4. Responsive classes apply correctly

## Integration Contract

### Required Files
1. `tailwind.config.js` - Theme configuration
2. `src/sidepanel/styles.css` - Global terminal styles
3. `src/sidepanel/components/Terminal*.svelte` - Component implementations

### Import Requirements
```javascript
// In main.ts or App.svelte
import './styles.css';
import 'tailwindcss/tailwind.css';
```

## Performance Contract

### Metrics
- Initial render: < 100ms
- Style recalculation: < 16ms
- No layout thrashing
- CSS bundle size: < 10KB for terminal styles

### Optimization Requirements
- Use Tailwind's purge/content configuration
- Avoid dynamic class generation
- Leverage CSS containment where appropriate
- Minimize custom CSS outside Tailwind

## Maintenance Contract

### Documentation
- All custom colors documented in config
- Component props clearly typed
- Usage examples provided
- Accessibility notes included

### Version Compatibility
- Tailwind CSS v4.x compatible
- Svelte 4.x compatible
- Chrome Extensions Manifest V3 compatible
- PostCSS 8.x compatible