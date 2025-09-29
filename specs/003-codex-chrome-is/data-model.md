# Data Model: Single File Prompt System

## Overview
Minimal data model - one agent_prompt.md file, one loader.

## Components

### 1. Single Prompt File

```
prompts/
└── agent_prompt.md    # Converted from gpt_5_codex_prompt.md
```

**Content**: Direct conversion of codex-rs prompt to web agent
**Size**: ~8-10KB of markdown text
**Format**: Plain markdown matching original structure

### 2. Loader Function

```typescript
async function loadPrompt(): Promise<string> {
  const response = await fetch(chrome.runtime.getURL('prompts/agent_prompt.md'));
  return response.text();
}
```

**3 lines of code.**

## Data Flow

```
1. Agent starts
   ↓
2. Load agent_prompt.md
   ↓
3. Add to system message
   ↓
4. Send to model
```

## No Configuration

- No model detection
- No file selection
- No fallbacks
- No overrides
- No database
- No storage

## Prompt Structure (from codex-rs)

The agent_prompt.md maintains the same section structure:

1. **Identity**: "You are Codex Web Agent, based on GPT-5"
2. **General**: Browser tool usage instead of shell commands
3. **Constraints**: Page interactions instead of file editing
4. **Planning**: When to plan browser automation
5. **Sandboxing**: Browser permissions instead of filesystem
6. **Special Requests**: Page analysis instead of terminal commands
7. **Output Format**: Same style guidelines, browser examples

## Integration

### TurnManager
```typescript
// One-time load
const systemPrompt = await loadPrompt();

// Add to messages
messages = [
  { role: 'system', content: systemPrompt },
  ...otherMessages
];
```

## Conversion Examples

| Original Section | Converted Section |
|-----------------|------------------|
| Shell commands | Browser tool calls |
| File paths | URLs and selectors |
| Git worktree | Page state |
| Filesystem sandbox | Browser security |
| Network approval | CORS policies |

## Testing

Single test case:
- File loads successfully
- Content includes "Web Agent"
- No terminal references remain

## Benefits

- **Zero Complexity**: One file, no logic
- **Direct Mapping**: Clear conversion from original
- **Familiar Structure**: Same as codex-rs prompt
- **Easy Updates**: Edit one markdown file
- **Universal**: Works for all models

## Total Implementation

- 1 markdown file (agent_prompt.md)
- 1 loader function (3 lines)
- 1 integration point (2 lines)
- 1 test (5 lines)

**Total: ~10 lines of code + 1 markdown file**