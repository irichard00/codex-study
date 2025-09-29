# Task List: Web Agent System Prompt (Single File)

**Feature**: Convert codex-rs terminal prompt to browser web agent prompt
**Branch**: `003-codex-chrome-is`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary
Convert the terminal-based gpt_5_codex_prompt.md from codex-rs to a web agent prompt in a single agent_prompt.md file. Total implementation: ~10 lines of code + 1 markdown file.

## Task Execution Order

### T001: Setup project structure for agent prompt
**Type**: Setup
**Priority**: P0
**Effort**: XS (2 min)
**Dependencies**: None
**Description**: Create the prompts directory structure in codex-chrome/src/

**Implementation**:
```bash
mkdir -p codex-chrome/src/prompts
```

**Validation**:
- [x] Directory codex-chrome/src/prompts exists

---

### T002: Create agent_prompt.md with full conversion from codex-rs
**Type**: Implementation
**Priority**: P0
**Effort**: M (20 min)
**Dependencies**: T001
**Description**: Convert the complete gpt_5_codex_prompt.md from codex-rs to browser context, maintaining all sections but replacing terminal/file operations with browser/DOM operations.

**Implementation**:
1. Copy structure from codex-rs/core/gpt_5_codex_prompt.md
2. Convert each section systematically:
   - Identity: "You are Codex Web Agent, based on GPT-5"
   - General: Browser tools instead of shell commands
   - Constraints: Page interactions instead of file editing
   - Planning: Browser automation instead of code generation
   - Sandboxing: Browser permissions instead of filesystem
   - Output formatting: Same style, browser examples
3. Key conversions:
   - Shell commands → Browser tool calls
   - File paths → URLs and CSS selectors
   - Git operations → Page state management
   - File editing → DOM manipulation
   - Network approval → CORS policies
4. Save as codex-chrome/src/prompts/agent_prompt.md

**File**: `codex-chrome/src/prompts/agent_prompt.md`

**Validation**:
- [x] File contains "Codex Web Agent" identity
- [x] No shell/terminal references remain
- [x] All browser tools are documented
- [x] CSS selector examples included
- [x] Browser security model explained

---

### T003: Add loadPrompt() function
**Type**: Implementation
**Priority**: P0
**Effort**: XS (2 min)
**Dependencies**: T002
**Description**: Create the 3-line loader function to fetch agent_prompt.md

**Implementation**:
```typescript
// In codex-chrome/src/core/PromptLoader.ts
export async function loadPrompt(): Promise<string> {
  const response = await fetch(chrome.runtime.getURL('prompts/agent_prompt.md'));
  return response.text();
}
```

**File**: `codex-chrome/src/core/PromptLoader.ts`

**Validation**:
- [x] Function exports correctly
- [x] Uses chrome.runtime.getURL
- [x] Returns Promise<string>

---

### T004: Integrate prompt loading in TurnManager
**Type**: Integration
**Priority**: P0
**Effort**: XS (2 min)
**Dependencies**: T003
**Description**: Add 2 lines to TurnManager to load and use the system prompt

**Implementation**:
1. Import the loadPrompt function
2. In message construction:
```typescript
import { loadPrompt } from './PromptLoader';

// Where messages are built (likely in a method that constructs the API call)
const systemPrompt = await loadPrompt();
messages.unshift({ role: 'system', content: systemPrompt });
```

**File**: `codex-chrome/src/core/TurnManager.ts`

**Validation**:
- [x] Import statement added
- [x] System prompt loaded
- [x] Added as first message

---

### T005: Update manifest.json and add test
**Type**: Configuration & Testing
**Priority**: P0
**Effort**: XS (5 min)
**Dependencies**: T004
**Description**: Make agent_prompt.md accessible and add simple test

**Implementation**:
1. Update manifest.json:
```json
{
  "web_accessible_resources": [{
    "resources": ["prompts/agent_prompt.md"],
    "matches": ["<all_urls>"]
  }]
}
```

2. Create test file:
```typescript
// In codex-chrome/tests/prompts/loader.test.ts
import { describe, it, expect } from 'vitest';
import { loadPrompt } from '../../src/core/PromptLoader';

describe('Agent Prompt Loader', () => {
  it('loads agent prompt successfully', async () => {
    const prompt = await loadPrompt();
    expect(prompt).toContain('Codex Web Agent');
    expect(prompt).not.toContain('shell');
    expect(prompt).not.toContain('filesystem');
    expect(prompt).toContain('querySelector');
  });
});
```

**Files**:
- `codex-chrome/manifest.json`
- `codex-chrome/tests/prompts/loader.test.ts`

**Validation**:
- [x] Manifest includes web_accessible_resources
- [x] Test passes
- [x] No terminal references in loaded prompt

---

## Task Summary

| ID | Description | Effort | Dependencies |
|----|------------|--------|--------------|
| T001 | Setup project structure | XS | None |
| T002 | Create agent_prompt.md | M | T001 |
| T003 | Add loadPrompt() | XS | T002 |
| T004 | Integrate in TurnManager | XS | T003 |
| T005 | Update manifest & test | XS | T004 |

**Total Effort**: ~30 minutes
**Total Code Added**: ~10 lines + 1 markdown file

## Post-Implementation Checklist

- [x] agent_prompt.md created with full conversion
- [x] All terminal references replaced with browser equivalents
- [x] Loader function working
- [x] System prompt integrated in TurnManager
- [x] Manifest updated for resource access
- [x] Test verifies conversion success
- [x] No model-specific logic added (single file for all)

## Notes

- This is the simplest possible implementation
- Direct 1:1 conversion from codex-rs prompt
- No configuration, no model detection, no fallbacks
- Single markdown file serves all models
- Maintains exact structure from original prompt