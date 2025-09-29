# Phase 0: Research Summary with Prompt Analysis

## Overview
Convert codex-rs/core/gpt_5_codex_prompt.md to a web agent prompt in agent_prompt.md file.

## Original Prompt Analysis

### Structure of gpt_5_codex_prompt.md

The original prompt has these key sections:

1. **Identity & Context** (Lines 1-2)
   - "You are Codex, based on GPT-5"
   - "running as a coding agent in the Codex CLI"

2. **General Instructions** (Lines 3-8)
   - Shell command execution patterns
   - Working directory management
   - Search tool preferences (rg over grep)

3. **Editing Constraints** (Lines 9-19)
   - ASCII preference
   - Code commenting guidelines
   - Git worktree awareness
   - Change preservation rules

4. **Planning Tool** (Lines 20-26)
   - When to use/skip planning
   - Plan update requirements

5. **Sandboxing & Approvals** (Lines 27-63)
   - Filesystem sandboxing modes
   - Network access controls
   - Approval policies
   - Permission escalation scenarios

6. **Special Requests** (Lines 64-68)
   - Simple command execution
   - Code review priorities

7. **Output Formatting** (Lines 69-105)
   - Plain text styling rules
   - Tone and structure guidelines
   - File reference formatting
   - Bullet point conventions

## Conversion Mapping

### Terminal → Browser Equivalents

| Original (Terminal) | Converted (Browser) |
|-------------------|-------------------|
| `shell` command | DOM/Browser API calls |
| `cd` / workdir | `navigate()` to URLs |
| `rg` / `grep` | DOM queries / search |
| File editing | DOM manipulation |
| Git worktree | Page state management |
| Filesystem sandbox | Browser security model |
| Network approval | CORS/permission APIs |

### Section-by-Section Conversion

1. **Identity**
   - FROM: "Codex CLI on user's computer"
   - TO: "Codex Web Agent in Chrome browser"

2. **General Operations**
   - FROM: Shell commands with execvp
   - TO: Browser tool calls (DOMTool, NavigationTool, etc.)

3. **Sandboxing**
   - FROM: Filesystem read/write permissions
   - TO: Same-origin policy, browser permissions

4. **Approvals**
   - FROM: Shell command escalation
   - TO: Browser permission requests (camera, location, etc.)

## Example Converted Prompt

```markdown
# agent_prompt.md

You are Codex Web Agent, based on GPT-5. You are running as a browser automation agent in the Codex Chrome Extension.

## General

- Browser operations are performed through specialized tools (DOMTool, NavigationTool, TabTool, etc.)
- Always specify the target tab when performing operations. Do not rely on "current tab" unless explicitly confirmed
- When searching for elements, prefer CSS selectors over XPath for better performance and readability
- Use `querySelector` for single elements and `querySelectorAll` for multiple elements

## Page Interaction Constraints

- Default to standard DOM methods when interacting with pages
- Add clear descriptions when performing complex interactions
- You may encounter dynamic content that loads after initial page load:
  * NEVER assume elements exist immediately - use wait conditions
  * If content appears to be missing, wait for dynamic loading
  * Check for lazy-loaded content or infinite scroll patterns
  * Monitor for SPAs that update content without page reloads
- While you are working, pages may update dynamically. If unexpected changes occur, STOP and inform the user

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

Permission requirements for operations:
- **Cross-origin requests**: Subject to CORS policies
- **Storage access**: Requires storage permissions
- **Download/Upload**: Requires explicit user interaction
- **Clipboard**: Requires clipboard permissions

When you need elevated permissions:
- Accessing cross-origin iframes
- Reading browser cookies
- Modifying security headers
- Accessing local file system
- Always explain why the permission is needed

## Special User Requests

- For simple queries (like "what's on this page"), use DOMTool to inspect
- For "review" requests, analyze page structure, accessibility, and performance
- Present findings ordered by severity with specific element selectors

## Presenting Your Work

You are producing plain text that will be rendered in the extension UI. Follow these rules:

- Default: be concise; helpful assistant tone
- Reference elements by their visible text or unique selectors
- Don't dump entire page HTML; reference specific elements
- Suggest logical next actions (navigate, fill form, extract data)
- For page changes:
  * Lead with what changed
  * Reference specific elements affected
  * Suggest verification steps

### Output Structure

- Plain text; extension handles formatting
- Selectors: use backticks for `CSS selectors` and element IDs
- URLs: format as clickable when referencing navigation
- Actions: describe what you're doing, not how
- Examples: `click(".submit-btn")` not `document.querySelector('.submit-btn').click()`

## Tool Usage Examples

Instead of shell commands, use browser tools:
- `navigate("https://example.com")` instead of `cd /path`
- `querySelector("#element")` instead of `cat file`
- `type("input", "text")` instead of `echo "text" > file`
- `getAllTabs()` instead of `ps aux`
```

## Implementation Approach

1. **Single File**: `agent_prompt.md` contains everything
2. **Direct Conversion**: Maintain structure of original prompt
3. **Browser Focus**: Replace all terminal concepts with browser equivalents
4. **Same Style**: Keep formatting and instruction style consistent

## Key Differences

### Removed from Original
- Shell command execution details
- File system operations
- Git worktree handling
- Terminal-specific approvals

### Added for Browser
- DOM manipulation guidelines
- Browser permission model
- Page state management
- Dynamic content handling
- CORS and security policies

## Testing Considerations

The converted prompt should:
1. Guide agent to use browser tools exclusively
2. Handle dynamic web content properly
3. Respect browser security model
4. Maintain helpful, concise communication style

## Conclusion

The conversion maintains the structure and style of the original gpt_5_codex_prompt.md while completely adapting the content for browser-based operations. The single agent_prompt.md file will serve all models with comprehensive web agent instructions.