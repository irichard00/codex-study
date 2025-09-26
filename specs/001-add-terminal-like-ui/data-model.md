# Data Model: Terminal-Style UI

## Overview
This feature is a pure presentation layer enhancement with no persistent data storage requirements. The data model consists of styling configuration and theme definitions.

## Theme Configuration Model

### TerminalTheme
Represents the terminal color scheme and typography settings.

**Properties:**
- `backgroundColor`: string (hex) - Terminal background color (#000000)
- `defaultTextColor`: string (hex) - Standard text color (#00ff00)
- `warningTextColor`: string (hex) - Warning/important text (#ffff00)
- `errorTextColor`: string (hex) - Error/critical text (#ff0000)
- `userInputColor`: string (hex) - User input distinction (#33ff00)
- `fontFamily`: string - Monospace font stack
- `fontSize`: string - Base font size (14px)
- `lineHeight`: number - Line height multiplier (1.5)

### MessageType Enum
Categorizes content for appropriate color coding.

**Values:**
- `DEFAULT` - Standard agent responses (green)
- `USER_INPUT` - User typed content (bright green)
- `WARNING` - Important information (yellow)
- `ERROR` - Critical alerts (red)
- `SYSTEM` - System messages (dim green)

## CSS Custom Properties Model

### Terminal Design Tokens
CSS variables for consistent theming across components.

```css
--term-bg: #000000;
--term-text-default: #00ff00;
--term-text-warning: #ffff00;
--term-text-error: #ff0000;
--term-text-input: #33ff00;
--term-text-dim: #00cc00;
--term-font-mono: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
--term-font-size: 14px;
--term-line-height: 1.5;
--term-padding: 1rem;
```

## Component Style Model

### TerminalContainer
Root container for terminal-style interface.

**Attributes:**
- `background`: Solid black background
- `padding`: Consistent internal spacing
- `overflow`: Auto-scroll with preserved formatting
- `font`: Monospace family application

### TerminalMessage
Individual message display component.

**Attributes:**
- `color`: Determined by MessageType
- `whiteSpace`: Pre-wrap for formatting preservation
- `wordBreak`: Break-word for long content
- `margin`: Bottom spacing between messages

### TerminalInput
User input area styling.

**Attributes:**
- `background`: Transparent over terminal background
- `color`: Distinct user input color
- `border`: None (terminal aesthetic)
- `outline`: None with custom focus indicator
- `caret`: Block or underscore style

## Tailwind Utility Mappings

### Base Classes
- `.term-container`: `bg-black p-4 font-mono text-sm overflow-auto`
- `.term-text-default`: `text-term-green`
- `.term-text-warning`: `text-term-yellow`
- `.term-text-error`: `text-term-red`
- `.term-text-input`: `text-term-bright-green`

### Responsive Modifiers
- Small screens: Reduced padding and font size
- Large screens: Increased line height for readability

## State Management
No persistent state required. All styling is declarative based on:
- Message type classification
- Component hierarchy
- CSS cascade and inheritance

## Accessibility Data
- `role="log"`: For message container
- `aria-live="polite"`: For new message announcements
- `aria-label`: Descriptive labels for screen readers
- High contrast mode detection via media query

## Integration Points
- Svelte component props for MessageType
- Tailwind config extension for custom colors
- CSS layer for terminal-specific styles
- PostCSS for processing custom properties

## Validation Rules
- Colors must maintain WCAG AA contrast ratios
- Font size minimum 12px for readability
- Line height between 1.4 and 1.6
- Padding minimum 0.5rem on mobile

## Future Extensibility
- Theme switching capability via CSS property updates
- Additional message types for new content categories
- Font size adjustment for accessibility
- Color blind friendly alternative themes