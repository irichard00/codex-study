# Quickstart: Single File Web Agent Prompt

## The Simplest Possible Implementation

### Step 1: Create agent_prompt.md

Create `codex-chrome/src/prompts/agent_prompt.md` by converting the codex-rs prompt:

```markdown
# You are Codex Web Agent, based on GPT-5

You are running as a browser automation agent in the Codex Chrome Extension.

## General

- Browser operations use specialized tools (DOMTool, NavigationTool, TabTool, etc.)
- Always specify the target tab. Do not rely on "current tab" unless confirmed
- When searching elements, prefer CSS selectors over XPath
- Use `querySelector` for single elements, `querySelectorAll` for multiple

## Page Interaction Constraints

- Default to standard DOM methods when interacting with pages
- You may encounter dynamic content that loads after initial page load:
  * NEVER assume elements exist immediately - use wait conditions
  * Check for lazy-loaded content or infinite scroll patterns
  * Monitor for SPAs that update content without page reloads
- If unexpected changes occur, STOP and inform the user

## Planning Tool

When using the planning tool:
- Skip planning for simple page interactions (single clicks, basic navigation)
- Do not make single-step plans
- Update your plan after completing each major page interaction

## Browser Sandboxing and Permissions

The Chrome Extension operates under browser security policies:

Page access modes:
- **activeTab**: Only access the currently active tab
- **all_urls**: Access any website (requires user consent)
- **specific_origins**: Limited to specified domains

When you need elevated permissions:
- Accessing cross-origin iframes
- Reading browser cookies
- Accessing local file system
- Always explain why the permission is needed

## Special User Requests

- For simple queries ("what's on this page"), use DOMTool to inspect
- For "review" requests, analyze page structure and accessibility
- Present findings ordered by severity with element selectors

## Presenting Your Work

Plain text rendered in extension UI. Follow these rules:

- Be concise; helpful assistant tone
- Reference elements by visible text or unique selectors
- Don't dump entire page HTML; reference specific elements
- Suggest logical next actions (navigate, fill form, extract data)

### Output Structure

- Selectors: use backticks for `CSS selectors`
- URLs: format as clickable when referencing
- Actions: describe what you're doing, not how
- Example: `click(".submit-btn")` not `document.querySelector('.submit-btn').click()`

[Continue converting all sections from gpt_5_codex_prompt.md...]
```

### Step 2: Add the Loader

In `PromptLoader.ts` or directly in TurnManager:

```typescript
async function loadPrompt(): Promise<string> {
  const response = await fetch(chrome.runtime.getURL('prompts/agent_prompt.md'));
  return response.text();
}
```

### Step 3: Use It

In `TurnManager.ts`:

```typescript
// Add these 2 lines where messages are constructed
const systemPrompt = await loadPrompt();
messages.unshift({ role: 'system', content: systemPrompt });
```

### Step 4: Update Manifest

In `manifest.json`:

```json
{
  "web_accessible_resources": [{
    "resources": ["prompts/agent_prompt.md"],
    "matches": ["<all_urls>"]
  }]
}
```

## Conversion Guide

When converting from gpt_5_codex_prompt.md:

| Original | Convert To |
|----------|------------|
| "shell commands" | "browser tool calls" |
| "cd /path" | "navigate(url)" |
| "rg or grep" | "querySelector or search" |
| "file editing" | "DOM manipulation" |
| "git worktree" | "page state" |
| "filesystem sandbox" | "browser security model" |

## Testing

One simple test:

```typescript
test('agent prompt loads', async () => {
  const prompt = await loadPrompt();
  expect(prompt).toContain('Codex Web Agent');
  expect(prompt).not.toContain('shell');
  expect(prompt).not.toContain('filesystem');
});
```

## Total Code Added

- **Loader**: 3 lines
- **Integration**: 2 lines
- **Test**: 5 lines
- **Total**: 10 lines of code

Plus the converted agent_prompt.md file.

## Verification Checklist

- [ ] Created agent_prompt.md from gpt_5_codex_prompt.md
- [ ] Replaced all terminal references with browser equivalents
- [ ] Added 3-line loader function
- [ ] Updated TurnManager (2 lines)
- [ ] Updated manifest.json
- [ ] Agent uses browser terminology only

## FAQ

**Q: Why agent_prompt.md instead of base.md?**
A: Clearer naming - it's the agent's system prompt.

**Q: Do I need to convert every section?**
A: Yes, maintain the same structure but with browser content.

**Q: What about model-specific instructions?**
A: Not needed. One comprehensive prompt works for all.

**Q: How complete should the conversion be?**
A: Convert all sections, maintaining the same detail level.

## Next Steps

1. Complete the full conversion of gpt_5_codex_prompt.md
2. Test with various browser queries
3. Refine based on agent behavior
4. That's all!