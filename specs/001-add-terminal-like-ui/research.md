# Research: Terminal-Style UI for Codex Chrome Extension

## Overview
Research conducted to identify the best approach for implementing a terminal-style UI in the Codex Chrome extension using Tailwind CSS. The goal is to create a simple, concise implementation that provides an authentic terminal appearance with minimal complexity.

## Key Decisions

### 1. Tailwind CSS Approach vs. Package Solution
**Decision**: Use pure Tailwind CSS with custom configuration
**Rationale**:
- Keeps the code concise and simple as requested
- Avoids unnecessary dependencies (crt-terminal requires React hooks)
- Tailwind v4 is already installed in the project
- Direct control over styling without wrapper components
**Alternatives considered**:
- crt-terminal package (too heavy, requires React patterns)
- react-terminal-ui (not suitable for Svelte)
- Custom CSS without Tailwind (loses utility-first benefits)

### 2. Color Scheme Implementation
**Decision**: Use custom Tailwind theme with terminal colors
**Rationale**:
- Phosphor green (#00ff00 or #33ff00) for default text
- Yellow (#ffff00) for warnings/important info
- Red (#ff0000) for errors/critical alerts
- Pure black (#000000) background for authenticity
**Alternatives considered**:
- tailwind-retro-colors package (unnecessary dependency)
- Default Tailwind colors (not authentic terminal appearance)

### 3. Typography Solution
**Decision**: Configure monospace font family directly in Tailwind
**Rationale**:
- Browser's default monospace font stack is sufficient
- No external font dependencies needed
- Fallback chain ensures consistency across platforms
**Alternatives considered**:
- JetBrains Mono (requires external font loading)
- Fira Code (adds complexity with ligatures)

### 4. Terminal Effects
**Decision**: Minimal CSS for basic terminal appearance
**Rationale**:
- Keep implementation simple per requirements
- Focus on color and typography only
- Avoid complex CRT effects (scanlines, glow, etc.)
**Alternatives considered**:
- Full CRT effect with scanlines (too complex)
- Text shadow for glow effect (performance impact)
- Animation effects (unnecessary complexity)

## Technical Specifications

### Tailwind Configuration Requirements
```javascript
// tailwind.config.js additions
theme: {
  extend: {
    colors: {
      'term-bg': '#000000',
      'term-green': '#00ff00',
      'term-yellow': '#ffff00',
      'term-red': '#ff0000',
      'term-dim-green': '#00cc00',
    },
    fontFamily: {
      'mono': ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    }
  }
}
```

### CSS Variable Approach for Theming
- Use CSS custom properties for easy theme switching
- Maintain consistency across all components
- Simple to modify for accessibility needs

## Implementation Constraints

### Chrome Extension Specific
- Must work within side panel constraints
- No external CDN fonts (CSP restrictions)
- Lightweight for performance
- Compatible with Svelte components

### Accessibility Considerations
- Maintain WCAG AA contrast ratios
- Support high contrast mode detection
- Provide fallback for color-blind users
- Ensure text remains readable

## Best Practices Identified

### From Existing Terminal UIs
1. **Consistent spacing**: Use fixed character width grid
2. **Line height**: 1.5 for readability
3. **Padding**: Minimum 1rem around content
4. **Cursor**: Block or underscore for input areas
5. **Text selection**: High contrast selection colors

### Svelte Integration
1. Use Tailwind classes directly in components
2. Avoid dynamic class generation
3. Leverage Svelte's scoped styling when needed
4. Keep terminal styles in dedicated CSS layer

## Resolved Clarifications

### User Input Styling
**Decision**: Use brighter green (#33ff00) or white for user input
**Rationale**: Provides clear distinction from agent responses

### Font Family Specification
**Decision**: System monospace font stack
**Rationale**: Reliable across all platforms, no loading required

### Content Type Handling
**Decision**: Apply consistent monospace styling to all content
**Rationale**: Maintains terminal aesthetic throughout

### Text Wrapping Behavior
**Decision**: Use word-wrap with preserved whitespace
**Rationale**: Mimics terminal behavior while preventing horizontal scroll

## Conclusion
The research indicates that a pure Tailwind CSS approach with custom theme configuration is the optimal solution for implementing terminal-style UI in the Codex Chrome extension. This approach maintains simplicity while providing an authentic terminal appearance that meets all functional requirements.