# Quickstart: Terminal-Style UI Implementation

## Prerequisites
- Codex Chrome extension development environment set up
- Node.js and pnpm installed
- Chrome browser for testing

## Quick Setup (5 minutes)

### 1. Update Tailwind Configuration
```bash
# Navigate to chrome extension directory
cd codex-chrome/

# Verify Tailwind is installed (should already be v4.x)
pnpm list tailwindcss
```

### 2. Configure Terminal Theme
Add to `tailwind.config.js`:
```javascript
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
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

### 3. Create Terminal Styles
Add to `src/sidepanel/styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .terminal-container {
    @apply bg-term-bg text-term-green font-terminal p-4 min-h-screen overflow-auto;
  }

  .terminal-message {
    @apply whitespace-pre-wrap break-words mb-2;
  }

  .terminal-input {
    @apply bg-transparent text-term-bright-green outline-none border-none w-full;
  }
}
```

### 4. Create Terminal Components
Create `src/sidepanel/components/TerminalMessage.svelte`:
```svelte
<script lang="ts">
  export let type: 'default' | 'warning' | 'error' | 'input' | 'system' = 'default';
  export let content: string;

  const colorClasses = {
    default: 'text-term-green',
    warning: 'text-term-yellow',
    error: 'text-term-red',
    input: 'text-term-bright-green',
    system: 'text-term-dim-green'
  };
</script>

<div class="terminal-message {colorClasses[type]}">
  {content}
</div>
```

### 5. Update Main App Component
Modify `src/sidepanel/App.svelte`:
```svelte
<script lang="ts">
  import TerminalMessage from './components/TerminalMessage.svelte';
  // ... existing imports
</script>

<div class="terminal-container">
  <!-- Replace existing content wrapper -->
  <TerminalMessage type="system" content="Codex Agent v1.0.0" />
  <TerminalMessage type="default" content="Ready for commands..." />
  <!-- ... rest of app content with terminal styling -->
</div>
```

## Verification Steps

### 1. Build and Load Extension
```bash
# Build the extension
pnpm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select codex-chrome/dist directory
```

### 2. Visual Verification Checklist
- [ ] Background is pure black (#000000)
- [ ] Default text appears in green
- [ ] Font is monospace throughout
- [ ] Padding exists around content
- [ ] Text is readable and properly spaced

### 3. Test Different Message Types
```javascript
// Add test messages to verify colors
const testMessages = [
  { type: 'default', content: 'Processing request...' },
  { type: 'warning', content: 'Warning: Rate limit approaching' },
  { type: 'error', content: 'Error: Connection failed' },
  { type: 'input', content: '> user command here' },
  { type: 'system', content: 'System: Configuration loaded' }
];
```

### 4. Accessibility Check
- Open DevTools > Lighthouse
- Run accessibility audit
- Verify contrast ratios pass
- Check for any color-related issues

## Common Issues & Solutions

### Issue: Tailwind classes not applying
**Solution**: Ensure PostCSS is configured and `content` paths are correct in tailwind.config.js

### Issue: Fonts not monospace
**Solution**: Verify font-terminal class is applied to container, check font stack fallbacks

### Issue: Colors look different than expected
**Solution**: Check for CSS specificity conflicts, ensure no other styles override terminal classes

## Next Steps

### Enhance Terminal Features
1. Add blinking cursor for input field
2. Implement command history with up/down arrows
3. Add subtle glow effect for active elements

### Add Terminal Sound Effects (Optional)
```javascript
// Add subtle keystroke sounds
const keystrokeSound = new Audio('sounds/keystroke.mp3');
keystrokeSound.volume = 0.1;
```

### Create Terminal Animations
```css
/* Add to styles.css for typing effect */
@keyframes blink {
  50% { opacity: 0; }
}

.terminal-cursor {
  animation: blink 1s step-end infinite;
}
```

## Testing Commands

### Manual Testing
```bash
# Run development server
pnpm run dev

# Watch for changes
pnpm run build:watch
```

### Automated Testing
```bash
# Run component tests
pnpm test

# Type checking
pnpm run type-check

# Linting
pnpm run lint
```

## Performance Validation

### Expected Metrics
- Page load: < 200ms
- Style application: < 50ms
- Smooth scrolling at 60fps
- Bundle size impact: < 10KB

### Measurement Tools
1. Chrome DevTools Performance tab
2. Lighthouse performance audit
3. CSS coverage report
4. Bundle analyzer

## Deployment Checklist

- [ ] All tests passing
- [ ] Visual QA completed
- [ ] Accessibility audit passed
- [ ] Performance metrics met
- [ ] Code review completed
- [ ] Documentation updated

## Support & Resources

### Documentation
- [Tailwind CSS v4 Docs](https://tailwindcss.com)
- [Svelte Component Guide](https://svelte.dev)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions)

### Troubleshooting
- Check browser console for errors
- Verify extension permissions
- Ensure all dependencies installed
- Review build output for warnings

---

**Time Estimate**: 30 minutes for basic implementation, 1 hour with testing and refinements

**Success Criteria**: Terminal UI displays with correct colors, monospace font, and proper message type styling