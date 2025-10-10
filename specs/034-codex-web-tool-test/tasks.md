# Implementation Tasks: Codex Web Tool Test Extension

**Feature**: 034-codex-web-tool-test
**Branch**: `034-codex-web-tool-test`
**Status**: Ready for Implementation
**Generated**: 2025-10-10

## Overview

This document contains ordered, executable tasks for implementing the Codex Web Tool Test extension. Tasks are numbered and organized by dependency. Tasks marked with **[P]** can be executed in parallel with other [P] tasks in the same section.

**Total Estimated Tasks**: 28
**Estimated Completion Time**: 1-2 days

## Task Execution Guidelines

1. Execute tasks in order (T001, T002, T003, etc.)
2. Tasks marked **[P]** can run in parallel with other **[P]** tasks in the same section
3. Do not skip tasks unless explicitly marked as optional
4. Each task specifies the exact file path to create/modify
5. Verify each task completion before proceeding to the next

## Dependency Graph Summary

```
Setup (T001-T005) → Service Worker (T006-T009) → Utilities (T010-T011) →
  UI Components (T012-T020) → Integration (T021-T023) → Testing (T024-T028)
```

---

## Section 1: Project Setup and Infrastructure

### T001: Create test tool directory structure [P]

**File**: Create directory structure

**Description**: Create the base directory structure for the test extension under `codex-chrome/tests/tools/e2e/`.

**Implementation**:
```bash
mkdir -p codex-chrome/tests/tools/e2e/src/sidepanel
mkdir -p codex-chrome/tests/tools/e2e/src/utils
mkdir -p codex-chrome/tests/tools/e2e/dist
```

**Acceptance Criteria**:
- Directory `codex-chrome/tests/tools/e2e/` exists
- Subdirectories `src/sidepanel/` and `src/utils/` exist
- Directory `dist/` exists (for build output)

**Dependencies**: None

**Estimated Time**: 1 minute

---

### T002: Create manifest.json for test extension [P]

**File**: `codex-chrome/tests/tools/e2e/manifest.json`

**Description**: Create Chrome extension manifest with side panel configuration.

**Implementation**:
```json
{
  "manifest_version": 3,
  "name": "Codex Web Tool Test",
  "version": "1.0.0",
  "description": "Test tool for manually testing Codex browser tools",
  "permissions": [
    "sidePanel",
    "storage",
    "scripting"
  ],
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "action": {
    "default_title": "Open Codex Tool Test"
  },
  "icons": {
    "16": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>🔧</text></svg>",
    "48": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><text y='42' font-size='42'>🔧</text></svg>",
    "128": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><text y='112' font-size='112'>🔧</text></svg>"
  }
}
```

**Acceptance Criteria**:
- manifest.json has valid JSON
- manifest_version is 3
- Side panel configuration points to sidepanel/index.html
- Required permissions included (sidePanel, storage, scripting)

**Dependencies**: T001

**Estimated Time**: 5 minutes

---

### T003: Create tsconfig.json for test tool [P]

**File**: `codex-chrome/tests/tools/e2e/tsconfig.json`

**Description**: Create TypeScript configuration with path aliases to import from parent src/.

**Implementation**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["chrome"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["../../src/*"],
      "@tools/*": ["../../src/tools/*"],
      "@config/*": ["../../src/config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Acceptance Criteria**:
- TypeScript can resolve imports from parent src/ directory
- Path aliases @/, @tools/, @config/ work correctly
- Chrome types included

**Dependencies**: T001

**Estimated Time**: 5 minutes

---

### T004: Create vite.config.ts for test tool build [P]

**File**: `codex-chrome/tests/tools/e2e/vite.config.ts`

**Description**: Create Vite build configuration with multiple entry points (service worker + side panel) and path aliases.

**Implementation**:
```typescript
import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': path.resolve(__dirname, 'src/service-worker.ts'),
        'sidepanel/index': path.resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    minify: false, // Easier debugging
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tools': path.resolve(__dirname, '../../src/tools'),
      '@config': path.resolve(__dirname, '../../src/config'),
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      writeBundle() {
        const manifestPath = path.resolve(__dirname, 'manifest.json');
        const distPath = path.resolve(__dirname, 'dist/manifest.json');
        fs.copyFileSync(manifestPath, distPath);
      },
    },
  ],
});
```

**Acceptance Criteria**:
- Vite config builds service worker and side panel separately
- Path aliases match tsconfig.json
- Manifest.json copied to dist/ on build
- Build output goes to dist/ directory

**Dependencies**: T001

**Estimated Time**: 10 minutes

---

### T005: Add build:testtool script to package.json

**File**: `codex-chrome/package.json`

**Description**: Add npm script to build the test tool using the Vite config.

**Implementation**:
Add to the "scripts" section:
```json
"build:testtool": "vite build --config tests/tools/e2e/vite.config.ts"
```

**Acceptance Criteria**:
- Running `pnpm run build:testtool` builds the test extension
- Build output appears in `tests/tools/e2e/dist/`
- No errors during build

**Dependencies**: T004

**Estimated Time**: 2 minutes

---

## Section 2: Service Worker Implementation

### T006: Create service worker with tool registration

**File**: `codex-chrome/tests/tools/e2e/src/service-worker.ts`

**Description**: Create service worker that initializes ToolRegistry and registers all browser tools using the same logic as the main extension.

**Implementation**:
```typescript
/**
 * Service worker for Codex Web Tool Test extension
 * Registers browser tools and handles messages from side panel
 */

import { ToolRegistry } from '@tools/ToolRegistry';
import { registerTools } from '@tools/index';
import { AgentConfig } from '@config/AgentConfig';
import type { ToolDefinition, ToolExecutionRequest, ToolExecutionResponse } from '@tools/BaseTool';

// Global instances
let toolRegistry: ToolRegistry | null = null;
let agentConfig: AgentConfig | null = null;
let isInitialized = false;

/**
 * Initialize tool registry
 */
async function initializeTools(): Promise<void> {
  if (isInitialized) {
    console.log('[Test Tool] Already initialized');
    return;
  }

  console.log('[Test Tool] Initializing...');

  try {
    // Initialize AgentConfig singleton
    agentConfig = AgentConfig.getInstance();
    await agentConfig.initialize();

    // Create ToolRegistry instance
    toolRegistry = new ToolRegistry();

    // Register all tools using main app logic
    await registerTools(toolRegistry, agentConfig.getToolsConfig());

    const toolCount = toolRegistry.listTools().length;
    console.log(`[Test Tool] Initialized with ${toolCount} tools`);

    isInitialized = true;
  } catch (error) {
    console.error('[Test Tool] Initialization failed:', error);
    throw error;
  }
}

/**
 * Handle GET_TOOLS message
 */
async function handleGetTools(): Promise<{ tools: ToolDefinition[] }> {
  if (!toolRegistry) {
    throw new Error('ToolRegistry not initialized');
  }

  const tools = toolRegistry.listTools();
  return { tools };
}

/**
 * Handle EXECUTE_TOOL message
 */
async function handleExecuteTool(request: ToolExecutionRequest): Promise<{ result: ToolExecutionResponse }> {
  if (!toolRegistry) {
    throw new Error('ToolRegistry not initialized');
  }

  const result = await toolRegistry.execute(request);
  return { result };
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_TOOLS':
          return await handleGetTools();

        case 'EXECUTE_TOOL':
          return await handleExecuteTool(message.request);

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error: any) {
      return { error: error.message };
    }
  })().then(sendResponse);

  return true; // Indicates async response
});

/**
 * Set up side panel behavior
 */
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

/**
 * Initialize on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Test Tool] Extension installed');
  await initializeTools();
});

/**
 * Initialize on startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Test Tool] Extension started');
  await initializeTools();
});

// Initialize immediately
initializeTools();
```

**Acceptance Criteria**:
- Service worker initializes ToolRegistry
- Registers all browser tools from main codebase
- Handles GET_TOOLS and EXECUTE_TOOL messages
- Logs tool count on initialization
- Side panel opens on extension icon click

**Dependencies**: T001-T005

**Estimated Time**: 20 minutes

---

## Section 3: Utility Modules

### T007: Create messaging utility [P]

**File**: `codex-chrome/tests/tools/e2e/src/utils/messaging.ts`

**Description**: Create utility for Chrome runtime messaging with proper error handling.

**Implementation**:
```typescript
/**
 * Chrome messaging utilities for side panel
 */

/**
 * Send message to service worker and wait for response
 */
export async function sendToBackground<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Get list of all registered tools
 */
export async function getTools(): Promise<any[]> {
  const response = await sendToBackground<{ tools: any[] }>({ type: 'GET_TOOLS' });
  return response.tools;
}

/**
 * Execute a tool with given parameters
 */
export async function executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
  const request = {
    toolName,
    parameters,
    sessionId: 'test-session',
    turnId: `test-turn-${Date.now()}`,
  };

  const response = await sendToBackground<{ result: any }>({
    type: 'EXECUTE_TOOL',
    request,
  });

  return response.result;
}
```

**Acceptance Criteria**:
- sendToBackground handles Chrome runtime errors
- getTools returns tool list
- executeTool composes valid ToolExecutionRequest
- Proper TypeScript types

**Dependencies**: T001

**Estimated Time**: 10 minutes

---

### T008: Create formatting utility [P]

**File**: `codex-chrome/tests/tools/e2e/src/utils/formatting.ts`

**Description**: Create utility for formatting JSON with syntax highlighting.

**Implementation**:
```typescript
/**
 * Formatting utilities for displaying results
 */

/**
 * Syntax highlight JSON string
 */
export function syntaxHighlight(json: string): string {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}

/**
 * Format tool execution result for display
 */
export function formatResult(result: any): string {
  if (!result) {
    return '<div class="no-result">No result</div>';
  }

  if (result.success) {
    const dataJson = JSON.stringify(result.data, null, 2);
    return `
      <div class="result-success">
        <div class="result-header">
          <span class="success-badge">✓ Success</span>
          <span class="duration">${result.duration}ms</span>
        </div>
        <pre class="json-display">${syntaxHighlight(dataJson)}</pre>
      </div>
    `;
  } else {
    const error = result.error;
    const detailsJson = error.details ? JSON.stringify(error.details, null, 2) : '';

    return `
      <div class="result-error">
        <div class="result-header">
          <span class="error-badge">✗ Error</span>
          <span class="duration">${result.duration}ms</span>
        </div>
        <div class="error-code">${error.code}</div>
        <div class="error-message">${error.message}</div>
        ${detailsJson ? `<pre class="json-display">${syntaxHighlight(detailsJson)}</pre>` : ''}
      </div>
    `;
  }
}

/**
 * Format tool parameter schema for display
 */
export function formatParameterSchema(schema: any): string {
  if (!schema || !schema.properties) {
    return '<div class="no-params">No parameters</div>';
  }

  const properties = schema.properties;
  const required = schema.required || [];

  let html = '<div class="param-list">';

  for (const [name, prop] of Object.entries(properties)) {
    const propSchema = prop as any;
    const isRequired = required.includes(name);
    const type = propSchema.type || 'any';

    html += `
      <div class="param-item">
        <div class="param-name">
          ${name}
          ${isRequired ? '<span class="required">*</span>' : ''}
        </div>
        <div class="param-type">${type}</div>
        ${propSchema.description ? `<div class="param-desc">${propSchema.description}</div>` : ''}
      </div>
    `;
  }

  html += '</div>';
  return html;
}
```

**Acceptance Criteria**:
- syntaxHighlight adds color classes to JSON
- formatResult displays success and error states
- formatParameterSchema shows parameter requirements
- HTML output is safe (no XSS)

**Dependencies**: T001

**Estimated Time**: 15 minutes

---

## Section 4: Side Panel UI

### T009: Create index.html for side panel [P]

**File**: `codex-chrome/tests/tools/e2e/src/sidepanel/index.html`

**Description**: Create HTML structure for side panel interface.

**Implementation**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codex Tool Test</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <!-- Tool List View -->
    <div id="tool-list-view" class="view">
      <div class="header">
        <h1>Codex Browser Tools</h1>
        <div class="tool-count">Loading...</div>
      </div>
      <div id="tool-list" class="tool-list">
        <!-- Tools will be inserted here -->
      </div>
    </div>

    <!-- Tool Detail View -->
    <div id="tool-detail-view" class="view hidden">
      <div class="header">
        <button id="back-btn" class="back-btn">← Back to Tools</button>
        <h2 id="tool-name">Tool Name</h2>
      </div>

      <div class="tool-detail-content">
        <div class="section">
          <h3>Description</h3>
          <p id="tool-description"></p>
        </div>

        <div class="section">
          <h3>Parameters</h3>
          <div id="tool-parameters"></div>
        </div>

        <div class="section">
          <h3>Example Request</h3>
          <pre id="example-request" class="json-display"></pre>
        </div>

        <div class="section">
          <h3>Execute Tool</h3>
          <form id="execute-form">
            <div id="param-inputs"></div>
            <button type="submit" id="execute-btn" class="btn-primary">Execute</button>
          </form>
        </div>

        <div class="section" id="result-section" style="display: none;">
          <h3>Result</h3>
          <div id="execution-result"></div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div id="loading" class="loading hidden">
      <div class="spinner"></div>
      <div>Executing...</div>
    </div>

    <!-- Error Display -->
    <div id="error-display" class="error-display hidden">
      <div class="error-content"></div>
      <button class="close-btn">Close</button>
    </div>
  </div>

  <script type="module" src="main.js"></script>
</body>
</html>
```

**Acceptance Criteria**:
- HTML structure for tool list view
- HTML structure for tool detail view
- Form for parameter input
- Result display area
- Loading and error states

**Dependencies**: T001

**Estimated Time**: 10 minutes

---

### T010: Create styles.css with minimal styling [P]

**File**: `codex-chrome/tests/tools/e2e/src/sidepanel/styles.css`

**Description**: Create minimal CSS styling for the side panel UI (target <5KB).

**Implementation**:
```css
/* Codex Tool Test - Minimal Styles */

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-hover: #e8e8e8;
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --border-color: #dadce0;
  --accent-color: #1a73e8;
  --success-color: #0f9d58;
  --error-color: #d93025;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-primary);
  line-height: 1.5;
}

.hidden {
  display: none !important;
}

/* Header */
.header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.header h1 {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 4px;
}

.header h2 {
  font-size: 16px;
  font-weight: 500;
}

.tool-count {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Tool List */
.tool-list {
  padding: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 80px);
}

.tool-item {
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.tool-item:hover {
  background: var(--bg-hover);
}

.tool-item-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.tool-item-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.tool-item-type {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  margin-top: 4px;
}

/* Tool Detail */
.tool-detail-content {
  padding: 16px;
  overflow-y: auto;
  max-height: calc(100vh - 80px);
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

/* Back Button */
.back-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  margin-bottom: 8px;
}

.back-btn:hover {
  text-decoration: underline;
}

/* Parameters */
.param-list {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 12px;
}

.param-item {
  margin-bottom: 12px;
}

.param-item:last-child {
  margin-bottom: 0;
}

.param-name {
  font-weight: 500;
}

.param-name .required {
  color: var(--error-color);
  margin-left: 2px;
}

.param-type {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.param-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.no-params {
  color: var(--text-secondary);
  font-style: italic;
}

/* Form */
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-weight: 500;
  font-size: 12px;
}

input[type="text"],
input[type="number"],
textarea,
select {
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
}

textarea {
  font-family: monospace;
  resize: vertical;
  min-height: 60px;
}

/* Buttons */
.btn-primary {
  padding: 8px 16px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* JSON Display */
.json-display {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.json-key { color: #881391; }
.json-string { color: #1A1AA6; }
.json-number { color: #164; }
.json-boolean { color: #00f; }
.json-null { color: #808080; }

/* Results */
.result-success {
  border: 2px solid var(--success-color);
  border-radius: 4px;
  padding: 12px;
}

.result-error {
  border: 2px solid var(--error-color);
  border-radius: 4px;
  padding: 12px;
  background: #fff5f5;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.success-badge {
  color: var(--success-color);
  font-weight: 500;
}

.error-badge {
  color: var(--error-color);
  font-weight: 500;
}

.duration {
  font-size: 11px;
  color: var(--text-secondary);
}

.error-code {
  font-family: monospace;
  font-weight: 500;
  color: var(--error-color);
  margin-bottom: 4px;
}

.error-message {
  margin-bottom: 8px;
}

/* Loading */
.loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.spinner {
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error Display */
.error-display {
  position: fixed;
  top: 16px;
  left: 16px;
  right: 16px;
  background: var(--error-color);
  color: white;
  padding: 12px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}

.error-display .close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-weight: bold;
}
```

**Acceptance Criteria**:
- CSS file size <5KB
- Styles match Chrome extension UI patterns
- Responsive layout
- Syntax highlighting colors for JSON

**Dependencies**: T001

**Estimated Time**: 20 minutes

---

### T011: Create main.ts application controller

**File**: `codex-chrome/tests/tools/e2e/src/sidepanel/main.ts`

**Description**: Create main application controller that manages view state and routing.

**Implementation**:
```typescript
/**
 * Main application controller for Codex Tool Test side panel
 */

import { getTools, executeTool } from '../utils/messaging';
import { formatResult, formatParameterSchema, syntaxHighlight } from '../utils/formatting';

// View state
let currentView: 'list' | 'detail' = 'list';
let selectedTool: any = null;
let allTools: any[] = [];

// DOM elements
const toolListView = document.getElementById('tool-list-view')!;
const toolDetailView = document.getElementById('tool-detail-view')!;
const toolList = document.getElementById('tool-list')!;
const loading = document.getElementById('loading')!;
const errorDisplay = document.getElementById('error-display')!;
const backBtn = document.getElementById('back-btn')!;
const executeForm = document.getElementById('execute-form') as HTMLFormElement;

/**
 * Initialize application
 */
async function init() {
  try {
    showLoading(true);

    // Load tools
    allTools = await getTools();

    // Sort tools alphabetically
    allTools.sort((a, b) => {
      const nameA = getToolName(a);
      const nameB = getToolName(b);
      return nameA.localeCompare(nameB);
    });

    // Render tool list
    renderToolList();

    // Setup event listeners
    setupEventListeners();

    showLoading(false);
  } catch (error: any) {
    showError(error.message);
    showLoading(false);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  backBtn.addEventListener('click', () => showToolList());

  executeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleExecute();
  });

  const errorCloseBtn = errorDisplay.querySelector('.close-btn')!;
  errorCloseBtn.addEventListener('click', () => hideError());
}

/**
 * Render tool list
 */
function renderToolList() {
  const toolCountEl = document.querySelector('.tool-count')!;
  toolCountEl.textContent = `${allTools.length} tools available`;

  toolList.innerHTML = '';

  if (allTools.length === 0) {
    toolList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-secondary);">No tools available</div>';
    return;
  }

  for (const tool of allTools) {
    const toolItem = createToolItem(tool);
    toolList.appendChild(toolItem);
  }
}

/**
 * Create tool list item element
 */
function createToolItem(tool: any): HTMLElement {
  const name = getToolName(tool);
  const description = getToolDescription(tool);
  const type = tool.type;

  const item = document.createElement('div');
  item.className = 'tool-item';
  item.innerHTML = `
    <div class="tool-item-name">${name}</div>
    <div class="tool-item-desc">${description}</div>
    <div class="tool-item-type">${type}</div>
  `;

  item.addEventListener('click', () => showToolDetail(tool));

  return item;
}

/**
 * Show tool detail view
 */
function showToolDetail(tool: any) {
  selectedTool = tool;
  currentView = 'detail';

  const name = getToolName(tool);
  const description = getToolDescription(tool);
  const parameters = getToolParameters(tool);

  // Update UI
  document.getElementById('tool-name')!.textContent = name;
  document.getElementById('tool-description')!.textContent = description;
  document.getElementById('tool-parameters')!.innerHTML = formatParameterSchema(parameters);

  // Generate example request
  const exampleRequest = {
    toolName: name,
    parameters: generateExampleParameters(parameters),
    sessionId: 'test-session',
    turnId: 'test-turn-1',
  };

  document.getElementById('example-request')!.innerHTML = syntaxHighlight(JSON.stringify(exampleRequest, null, 2));

  // Generate parameter input form
  renderParameterInputs(parameters);

  // Hide result section
  const resultSection = document.getElementById('result-section')!;
  resultSection.style.display = 'none';

  // Show detail view
  toolListView.classList.add('hidden');
  toolDetailView.classList.remove('hidden');
}

/**
 * Show tool list view
 */
function showToolList() {
  currentView = 'list';
  selectedTool = null;

  toolDetailView.classList.add('hidden');
  toolListView.classList.remove('hidden');
}

/**
 * Render parameter input form
 */
function renderParameterInputs(schema: any) {
  const container = document.getElementById('param-inputs')!;
  container.innerHTML = '';

  if (!schema || !schema.properties) {
    container.innerHTML = '<div style="color: var(--text-secondary); font-style: italic;">No parameters required</div>';
    return;
  }

  const properties = schema.properties;
  const required = schema.required || [];

  for (const [name, prop] of Object.entries(properties)) {
    const propSchema = prop as any;
    const isRequired = required.includes(name);
    const type = propSchema.type || 'string';

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = name;
    if (isRequired) {
      label.innerHTML += ' <span style="color: var(--error-color);">*</span>';
    }

    const input = createInputForType(name, type, propSchema);

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    container.appendChild(formGroup);
  }
}

/**
 * Create input element based on parameter type
 */
function createInputForType(name: string, type: string, schema: any): HTMLElement {
  let input: HTMLElement;

  switch (type) {
    case 'boolean':
      input = document.createElement('select');
      input.setAttribute('name', name);
      input.innerHTML = `
        <option value="true">true</option>
        <option value="false">false</option>
      `;
      break;

    case 'number':
    case 'integer':
      input = document.createElement('input');
      input.setAttribute('type', 'number');
      input.setAttribute('name', name);
      if (schema.description) {
        input.setAttribute('placeholder', schema.description);
      }
      break;

    case 'object':
    case 'array':
      input = document.createElement('textarea');
      input.setAttribute('name', name);
      input.setAttribute('placeholder', 'Enter JSON');
      break;

    default:
      input = document.createElement('input');
      input.setAttribute('type', 'text');
      input.setAttribute('name', name);
      if (schema.description) {
        input.setAttribute('placeholder', schema.description);
      }
  }

  return input;
}

/**
 * Handle tool execution
 */
async function handleExecute() {
  if (!selectedTool) return;

  try {
    showLoading(true);

    // Collect parameters from form
    const formData = new FormData(executeForm);
    const parameters: Record<string, any> = {};

    const schema = getToolParameters(selectedTool);

    for (const [name, value] of formData.entries()) {
      const propSchema = schema.properties?.[name];
      const type = propSchema?.type || 'string';

      // Convert value based on type
      if (type === 'boolean') {
        parameters[name] = value === 'true';
      } else if (type === 'number' || type === 'integer') {
        parameters[name] = Number(value);
      } else if (type === 'object' || type === 'array') {
        try {
          parameters[name] = JSON.parse(value as string);
        } catch {
          throw new Error(`Invalid JSON for parameter: ${name}`);
        }
      } else {
        parameters[name] = value;
      }
    }

    // Execute tool
    const toolName = getToolName(selectedTool);
    const result = await executeTool(toolName, parameters);

    // Display result
    displayResult(result);

    showLoading(false);
  } catch (error: any) {
    showError(error.message);
    showLoading(false);
  }
}

/**
 * Display execution result
 */
function displayResult(result: any) {
  const resultSection = document.getElementById('result-section')!;
  const resultEl = document.getElementById('execution-result')!;

  resultEl.innerHTML = formatResult(result);
  resultSection.style.display = 'block';

  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Helper: Get tool name
 */
function getToolName(tool: any): string {
  if (tool.type === 'function') return tool.function.name;
  if (tool.type === 'custom') return tool.custom.name;
  return tool.type;
}

/**
 * Helper: Get tool description
 */
function getToolDescription(tool: any): string {
  if (tool.type === 'function') return tool.function.description;
  if (tool.type === 'custom') return tool.custom.description;
  return `${tool.type} tool`;
}

/**
 * Helper: Get tool parameters
 */
function getToolParameters(tool: any): any {
  if (tool.type === 'function') return tool.function.parameters;
  return { type: 'object', properties: {} };
}

/**
 * Helper: Generate example parameters
 */
function generateExampleParameters(schema: any): Record<string, any> {
  if (!schema || !schema.properties) return {};

  const params: Record<string, any> = {};

  for (const [name, prop] of Object.entries(schema.properties)) {
    const propSchema = prop as any;
    const type = propSchema.type || 'string';

    switch (type) {
      case 'string':
        params[name] = 'example';
        break;
      case 'number':
      case 'integer':
        params[name] = 42;
        break;
      case 'boolean':
        params[name] = true;
        break;
      case 'array':
        params[name] = [];
        break;
      case 'object':
        params[name] = {};
        break;
    }
  }

  return params;
}

/**
 * Show/hide loading overlay
 */
function showLoading(show: boolean) {
  if (show) {
    loading.classList.remove('hidden');
  } else {
    loading.classList.add('hidden');
  }
}

/**
 * Show error message
 */
function showError(message: string) {
  const errorContent = errorDisplay.querySelector('.error-content')!;
  errorContent.textContent = message;
  errorDisplay.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
  errorDisplay.classList.add('hidden');
}

// Initialize on load
init();
```

**Acceptance Criteria**:
- Loads and displays tool list on init
- Navigates between list and detail views
- Generates parameter input forms dynamically
- Handles tool execution
- Displays results with formatting
- Error handling for all operations

**Dependencies**: T007, T008, T009, T010

**Estimated Time**: 40 minutes

---

## Section 5: Build and Testing

### T012: Test build process

**Description**: Run the build command and verify output.

**Implementation**:
```bash
cd codex-chrome
pnpm run build:testtool
```

**Acceptance Criteria**:
- Build completes without errors
- `dist/` directory created with:
  - manifest.json
  - service-worker.js
  - sidepanel/index.html
  - sidepanel/main.js
  - sidepanel/styles.css
- Total dist size <100KB

**Dependencies**: T001-T011

**Estimated Time**: 5 minutes

---

### T013: Manual Test - Load extension in Chrome

**Description**: Load the unpacked extension in Chrome and verify it appears correctly.

**Implementation**:
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `codex-chrome/tests/tools/e2e/dist/` directory

**Acceptance Criteria**:
- Extension loads without errors
- Name shows as "Codex Web Tool Test"
- No warnings in extension card
- Extension icon appears in toolbar

**Dependencies**: T012

**Estimated Time**: 5 minutes

---

### T014: Manual Test - Tool list loads

**Description**: Open side panel and verify tool list loads correctly.

**From quickstart.md**: Test Scenario 1

**Implementation**:
1. Click extension icon to open side panel
2. Verify tool list appears
3. Check tool count is correct

**Acceptance Criteria**:
- ✅ Side panel opens without errors
- ✅ Tool list displays all registered tools (8-10 tools)
- ✅ Each tool shows name, description, type
- ✅ Tools sorted alphabetically
- ✅ FR-001, FR-002 satisfied

**Dependencies**: T013

**Estimated Time**: 5 minutes

---

### T015: Manual Test - Tool detail view

**Description**: Click on a tool and verify detail view loads correctly.

**From quickstart.md**: Test Scenario 2

**Implementation**:
1. Click on "navigate" tool from list
2. Verify detail view shows tool information
3. Check parameter schema displayed
4. Verify example request shown

**Acceptance Criteria**:
- ✅ View changes to detail page
- ✅ Tool name and description shown
- ✅ Parameter requirements displayed
- ✅ Example request JSON shown
- ✅ Input form generated
- ✅ Back button present
- ✅ FR-003, FR-004, FR-005, FR-011 satisfied

**Dependencies**: T014

**Estimated Time**: 5 minutes

---

### T016: Manual Test - Successful tool execution

**Description**: Execute a tool with valid parameters and verify result display.

**From quickstart.md**: Test Scenario 3

**Implementation**:
1. On "navigate" tool detail page
2. Enter `https://example.com` in url parameter
3. Click "Execute" button
4. Verify result displays

**Acceptance Criteria**:
- ✅ Execute button shows loading state
- ✅ Result appears within 1-3 seconds
- ✅ Success indicator shown
- ✅ Duration displayed
- ✅ Result data shown as formatted JSON
- ✅ Syntax highlighting applied
- ✅ FR-006, FR-007, FR-008, FR-009 satisfied

**Dependencies**: T015

**Estimated Time**: 5 minutes

---

### T017: Manual Test - Error handling

**Description**: Test tool execution with invalid parameters.

**From quickstart.md**: Test Scenario 4

**Implementation**:
1. On "navigate" tool detail page
2. Leave url parameter empty
3. Click "Execute"
4. Verify error displayed

**Acceptance Criteria**:
- ✅ Error message displayed
- ✅ Error code: "VALIDATION_ERROR"
- ✅ Error message and details shown
- ✅ No crash or blank screen
- ✅ Form editable for retry
- ✅ FR-010 satisfied

**Dependencies**: T016

**Estimated Time**: 5 minutes

---

### T018: Manual Test - Navigation flow

**Description**: Test navigation between list and detail views.

**From quickstart.md**: Test Scenario 6

**Implementation**:
1. Start on tool list
2. Click tool → verify detail loads
3. Click back → verify returns to list
4. Select different tool → verify new detail
5. Click back → verify returns to list

**Acceptance Criteria**:
- ✅ Navigation smooth, no flashing
- ✅ Results cleared when selecting new tool
- ✅ Tool list state preserved
- ✅ FR-011 satisfied

**Dependencies**: T017

**Estimated Time**: 5 minutes

---

### T019: Manual Test - Complex parameters

**Description**: Test tool with complex nested parameters.

**From quickstart.md**: Test Scenario 5

**Implementation**:
1. Navigate to "dom_snapshot" or similar tool with complex params
2. Observe parameter input form
3. Test JSON textarea for complex parameters

**Acceptance Criteria**:
- ✅ Simple params show individual inputs
- ✅ Complex params show JSON textarea
- ✅ Can input valid JSON
- ✅ Invalid JSON shows error

**Dependencies**: T018

**Estimated Time**: 5 minutes

---

### T020: Manual Test - Large result display

**Description**: Test handling of large data payloads.

**From quickstart.md**: Test Scenario 7

**Implementation**:
1. Select tool that returns large result (web_scraping, dom_snapshot)
2. Execute with parameters for full page
3. Observe result display

**Acceptance Criteria**:
- ✅ Large JSON displays without crash
- ✅ Result pane scrollable
- ✅ Syntax highlighting works
- ✅ UI remains responsive

**Dependencies**: T019

**Estimated Time**: 5 minutes

---

### T021: Verify build isolation

**Description**: Ensure test tool build doesn't affect main extension.

**From quickstart.md**: Build Verification

**Implementation**:
```bash
# Verify test tool dist
ls -la codex-chrome/tests/tools/e2e/dist/

# Verify main extension unaffected
ls -la codex-chrome/dist/  # Should not exist or be unchanged
```

**Acceptance Criteria**:
- ✅ Test tool dist at `tests/tools/e2e/dist/`
- ✅ Main extension dist not affected
- ✅ Test tool size <100KB
- ✅ FR-012, FR-014 satisfied

**Dependencies**: T020

**Estimated Time**: 2 minutes

---

### T022: Verify CSS file size

**Description**: Check CSS file meets size constraint.

**From quickstart.md**: Build Verification

**Implementation**:
```bash
ls -lh codex-chrome/tests/tools/e2e/dist/sidepanel/styles.css
```

**Acceptance Criteria**:
- ✅ CSS file <5KB
- ✅ No external CSS dependencies
- ✅ FR-015 satisfied

**Dependencies**: T021

**Estimated Time**: 1 minute

---

### T023: Verify npm script

**Description**: Confirm build:testtool script works correctly.

**From quickstart.md**: Build Script Verification

**Implementation**:
```bash
cd codex-chrome
pnpm run build:testtool
```

**Acceptance Criteria**:
- ✅ Command executes without errors
- ✅ Output directory created/updated
- ✅ All files bundled correctly
- ✅ FR-014 satisfied

**Dependencies**: T022

**Estimated Time**: 2 minutes

---

### T024: Performance validation - Tool listing

**Description**: Measure tool list load performance.

**From quickstart.md**: Performance Validation

**Implementation**:
1. Open DevTools → Performance tab
2. Start recording
3. Click extension icon
4. Stop when list appears

**Acceptance Criteria**:
- ✅ Tool list appears within 100ms
- ✅ No blocking operations >50ms

**Dependencies**: T023

**Estimated Time**: 5 minutes

---

### T025: Performance validation - Tool execution

**Description**: Measure tool execution responsiveness.

**From quickstart.md**: Performance Validation

**Implementation**:
1. Execute fast tool (navigate)
2. Observe response time

**Acceptance Criteria**:
- ✅ Simple tools complete within 500ms
- ✅ UI shows loading immediately
- ✅ Result displays within 50ms of response

**Dependencies**: T024

**Estimated Time**: 5 minutes

---

### T026: Update CLAUDE.md or AGENTS.md

**File**: `/home/irichard/dev/study/codex-study/s2/codex-study/AGENTS.md` or `CLAUDE.md`

**Description**: Add test tool feature entry to agent context file.

**Implementation**:
Add to the "Active Technologies" section:
```
- TypeScript 5.x (Chrome Extension Manifest V3) + Chrome Side Panel API, Vite build system (034-codex-web-tool-test)
```

Add to the "Recent Changes" section:
```
- 034-codex-web-tool-test: Added TypeScript 5.x + Chrome Side Panel API, Vite build configuration for test tool
```

**Acceptance Criteria**:
- Technology entry added
- Recent change noted
- File under 150 lines (or follows existing pattern)

**Dependencies**: T025

**Estimated Time**: 3 minutes

---

### T027: Create .gitignore entry for test tool dist

**File**: `codex-chrome/tests/tools/e2e/.gitignore`

**Description**: Ensure dist/ directory is not committed to git.

**Implementation**:
```
dist/
node_modules/
*.log
```

**Acceptance Criteria**:
- .gitignore file created
- dist/ directory excluded from git

**Dependencies**: T026

**Estimated Time**: 1 minute

---

### T028: Final validation - All requirements

**Description**: Verify all functional requirements from spec are met.

**From spec.md**: All FR-001 through FR-015

**Implementation**:
Run through all quickstart test scenarios and check:

- FR-001: Tool list displays on load ✓
- FR-002: Tool names and descriptions shown ✓
- FR-003: Tool selection navigates to detail ✓
- FR-004: Parameter schema displayed ✓
- FR-005: Example request shown ✓
- FR-006: Parameter input functional ✓
- FR-007: Execute button triggers execution ✓
- FR-008: Valid ToolExecutionRequest composed ✓
- FR-009: Results displayed ✓
- FR-010: Errors displayed ✓
- FR-011: Back navigation works ✓
- FR-012: Code isolated ✓
- FR-013: Tool registration reused ✓
- FR-014: Separate build process ✓
- FR-015: Minimal CSS ✓

**Acceptance Criteria**:
- All 15 functional requirements verified
- All 8 quickstart test scenarios pass
- No regressions or bugs found

**Dependencies**: T027

**Estimated Time**: 15 minutes

---

## Parallel Execution Opportunities

Tasks marked **[P]** can be executed in parallel within their sections:

**Section 1 (Setup)**: T001-T004 can all run in parallel
**Section 3 (Utilities)**: T007-T008 can run in parallel
**Section 4 (UI)**: T009-T010 can run in parallel

**Example parallel execution**:
```bash
# Execute setup tasks in parallel
Task T001 & Task T002 & Task T003 & Task T004
wait

# Then execute sequential tasks
Task T005
Task T006
...
```

## Summary

**Total Tasks**: 28
**Setup & Infrastructure**: 5 tasks
**Service Worker**: 1 task
**Utilities**: 2 tasks
**UI Components**: 4 tasks
**Manual Testing**: 14 tasks
**Documentation**: 2 tasks

**Critical Path**: T001 → T005 → T006 → T007,T008 → T009,T010 → T011 → T012 → T013-T028

**Success Criteria**: All 28 tasks completed, all 15 functional requirements validated, quickstart test scenarios pass.
