# Research: Codex Web Tool Test Extension

**Feature**: 034-codex-web-tool-test
**Date**: 2025-10-10
**Status**: Complete

## Overview
This document consolidates research findings for building a standalone Chrome extension test tool that allows manual testing of browser tools from the ToolRegistry.

## Research Areas

### 1. TypeScript Module Imports from Parent Directories

**Decision**: Use TypeScript path aliases and Vite's resolve.alias to import from parent src/

**Rationale**:
- Vite and TypeScript both support path resolution configuration
- Allows clean imports like `import { ToolRegistry } from '@/tools/ToolRegistry'`
- Maintains type safety and IDE support
- No code duplication needed

**Implementation**:
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tools': path.resolve(__dirname, '../../src/tools'),
    }
  }
});

// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["../../src/*"],
      "@tools/*": ["../../src/tools/*"]
    }
  }
}
```

**Alternatives Considered**:
- Relative imports (`../../../src/tools`) - Rejected: Fragile, hard to maintain
- Copying code - Rejected: Creates duplication and sync issues
- Monorepo packages - Rejected: Over-engineering for test tool

### 2. Chrome Side Panel API Usage Patterns

**Decision**: Use chrome.sidePanel API with action click trigger and runtime messaging

**Rationale**:
- Side Panel API is stable in Chrome 114+
- `openPanelOnActionClick: true` provides simple UX (click extension icon to open)
- Side panel runs in separate context, communicates via chrome.runtime messaging
- Persistent across tab navigation within same window

**Implementation Pattern**:
```javascript
// manifest.json
{
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "permissions": ["sidePanel", "scripting", "storage"]
}

// service-worker.ts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Side panel communicates via:
chrome.runtime.sendMessage({ type: 'GET_TOOLS' }, (response) => {
  // Handle tools list
});
```

**Alternatives Considered**:
- Popup UI - Rejected: Limited space, closes on blur
- DevTools panel - Rejected: Requires developer mode, less accessible
- New tab page - Rejected: Disrupts workflow

### 3. Vite Build Configuration for Multiple Entry Points

**Decision**: Use Vite with `build.rollupOptions.input` for multiple HTML entry points and service worker

**Rationale**:
- Vite natively supports multiple entry points via Rollup configuration
- Can build service worker and side panel separately with shared dependencies
- Code splitting and tree shaking work correctly
- Fast development with HMR for side panel UI

**Implementation**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'service-worker': path.resolve(__dirname, 'src/service-worker.ts'),
        'sidepanel/index': path.resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    // Don't minify for easier debugging
    minify: false,
  },
  plugins: [
    // Plugin to copy manifest.json to dist
    {
      name: 'copy-manifest',
      writeBundle() {
        fs.copyFileSync('manifest.json', 'dist/manifest.json');
      }
    }
  ]
});
```

**Alternatives Considered**:
- Webpack - Rejected: More complex configuration, slower builds
- Manual build script - Rejected: Reinventing build tool functionality
- Separate Vite configs - Rejected: Harder to manage, duplicate config

### 4. Chrome Extension Message Passing Patterns

**Decision**: Use chrome.runtime.sendMessage for one-time requests with callback responses

**Rationale**:
- Service worker and side panel need request/response pattern
- One-time messages (sendMessage) simpler than long-lived connections
- Async/await wrapper provides clean API
- Error handling built into Chrome APIs

**Implementation**:
```typescript
// messaging.ts utility
export async function sendToBackground<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// service-worker.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Async response
});
```

**Alternatives Considered**:
- Long-lived connections (chrome.runtime.connect) - Rejected: Overkill for request/response
- Storage API for communication - Rejected: Race conditions, not designed for messaging
- External messaging server - Rejected: Requires network, over-engineering

### 5. Minimal CSS Patterns for Chrome Extension UI

**Decision**: Use CSS custom properties (variables) with system fonts and minimal utility classes

**Rationale**:
- No framework needed (no Tailwind, Bootstrap)
- CSS custom properties for theming (matches Chrome UI)
- System font stack for native feel
- Flexbox for layouts (well-supported, simple)
- Total CSS <5KB unminified

**Implementation**:
```css
/* styles.css */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --border-color: #dadce0;
  --accent-color: #1a73e8;
}

body {
  font-family: 'Segoe UI', Tahoma, sans-serif;
  font-size: 13px;
  margin: 0;
  padding: 16px;
}

.tool-list { display: flex; flex-direction: column; gap: 8px; }
.tool-item { padding: 12px; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; }
.btn { padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; }
```

**Alternatives Considered**:
- Tailwind CSS - Rejected: Large bundle size, build complexity
- Material Design components - Rejected: Heavy dependencies
- Inline styles - Rejected: Hard to maintain, no reusability

### 6. ToolRegistry Integration and Tool Registration

**Decision**: Import initializeBrowserTools and ToolRegistry from parent src, call in service worker onInstalled

**Rationale**:
- Reuses exact same tool registration logic as main extension
- Ensures test tool tests actual production tools
- Service worker lifecycle manages tool registration
- Tools available immediately when side panel opens

**Implementation**:
```typescript
// service-worker.ts
import { ToolRegistry } from '@tools/ToolRegistry';
import { registerTools } from '@tools/index';
import { AgentConfig } from '@/config/AgentConfig';

const toolRegistry = new ToolRegistry();

chrome.runtime.onInstalled.addListener(async () => {
  // Initialize tools (reuse main app logic)
  const agentConfig = AgentConfig.getInstance();
  await agentConfig.initialize();
  await registerTools(toolRegistry, agentConfig.getToolsConfig());

  console.log('Test tool: tools registered', toolRegistry.listTools().length);
});
```

**Alternatives Considered**:
- Manually register each tool - Rejected: Duplication, easy to get out of sync
- Copy tool registration code - Rejected: Creates maintenance burden
- Mock tools - Rejected: Defeats purpose of testing real tools

### 7. Parameter Input Form Generation

**Decision**: Generate forms dynamically from tool parameter JSON schema with fallback to raw JSON textarea

**Rationale**:
- Tools define parameters as JSON schema (JsonSchema type)
- Can generate input fields for simple types (string, number, boolean)
- Complex nested objects fall back to JSON textarea
- Provides both ease of use and flexibility

**Implementation**:
```typescript
function generateInputs(schema: JsonSchema): HTMLElement {
  if (schema.type === 'object' && schema.properties) {
    const form = document.createElement('div');
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const input = createInputForType(key, propSchema);
      form.appendChild(input);
    }
    return form;
  }
  // Fallback: JSON textarea
  return createJsonTextarea();
}
```

**Alternatives Considered**:
- JSON textarea only - Rejected: Poor UX for simple parameters
- Full JSON schema form builder library - Rejected: Large dependency for test tool
- Hardcode forms per tool - Rejected: Not maintainable

### 8. Result Display and Formatting

**Decision**: Use JSON.stringify with syntax highlighting for success data, structured error display for failures

**Rationale**:
- Tool results can be complex objects
- JSON formatting with indentation is readable
- Simple syntax highlighting (color-code types) enhances readability
- Error display shows code, message, and details separately

**Implementation**:
```typescript
function formatResult(result: ToolExecutionResponse): string {
  if (result.success) {
    return `<div class="success">
      <div class="duration">Completed in ${result.duration}ms</div>
      <pre class="json">${syntaxHighlight(JSON.stringify(result.data, null, 2))}</pre>
    </div>`;
  } else {
    return `<div class="error">
      <div class="error-code">${result.error.code}</div>
      <div class="error-message">${result.error.message}</div>
      ${result.error.details ? `<pre>${JSON.stringify(result.error.details, null, 2)}</pre>` : ''}
    </div>`;
  }
}
```

**Alternatives Considered**:
- Plain text output - Rejected: Hard to read complex objects
- Full JSON viewer library - Rejected: Overkill, large dependency
- Table view - Rejected: Doesn't work for all result types

## Technical Dependencies Summary

**Build Time**:
- Vite 5.x (bundler)
- TypeScript 5.x (language)
- @types/chrome (type definitions)

**Runtime**:
- Chrome Extension APIs: sidePanel, runtime, storage
- ToolRegistry from codex-chrome/src/tools
- Tool implementations from codex-chrome/src/tools

**No External Libraries**: Vanilla TypeScript/CSS to minimize bundle size

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Import path issues | Use tested Vite alias configuration, verify in tsconfig |
| Service worker lifecycle | Initialize tools in onInstalled, handle restart cases |
| Side panel messaging failures | Wrap all messaging in try/catch, show user-friendly errors |
| Tool execution errors | Display full error details to help debugging |
| Build output conflicts | Use dedicated dist/ folder under tests/tools/e2e |

## Open Questions

None - all technical unknowns resolved.

## Conclusion

All research areas have been resolved with clear decisions. The implementation path is:
1. Set up Vite build with path aliases
2. Create manifest.json with side panel configuration
3. Implement service worker with tool registration
4. Build side panel UI with tool list and detail views
5. Implement messaging between service worker and side panel
6. Add parameter input generation and result formatting

No external libraries needed. Total bundle size estimated <50KB.
