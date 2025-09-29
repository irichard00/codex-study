# Feature Specification: Web Agent System Prompt Adaptation

**Feature Branch**: `003-codex-chrome-is`
**Created**: 2025-09-27
**Status**: Draft
**Input**: User description: "codex-chrome/ is converted from codex-rs/, it is converted from terminal run coding agent into in broswer web agent that when a user send a query, it will utilize the web pages to finish the query or cmd. Since it is a web page agent, currently, it doesn't have MCP or any file reading tools, all the related tools are web page opreation related, they are currently located in codex-chrome/src/tools. Now codex-rs/core/gpt_5_codex_prompt.md is the system prompt template to guide the agent to work, now we need to turn it into the system prompt for the codex-chrome/ for the web agent. Scan through the code of codex-rs/ and do some research of how the system prompt can be composed and also implement the code to use the system prompt same as original codex-rs/"

## Execution Flow (main)
```
1. Parse user description from Input
   → Extracted: Convert terminal-based coding agent prompt to web agent prompt
2. Extract key concepts from description
   → Actors: Web agent, users submitting queries
   → Actions: Web page operations, query processing
   → Data: System prompts, tool definitions
   → Constraints: No MCP, no file tools, browser-only environment
3. Analyze prompt composition in codex-rs
   → Identify model family handling
   → Identify base/user instructions pattern
   → Map prompt integration points
4. Create web-specific prompt template
   → Replace file operations with DOM operations
   → Replace shell commands with web actions
   → Adapt sandboxing to browser security model
5. Implement prompt loading system
   → Match codex-rs architecture pattern
   → Integrate with ModelClient
   → Support model-specific variations
6. Validate implementation
   → Ensure backward compatibility
   → Test with existing web tools
7. Run Review Checklist
   → All requirements must be testable
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a user of the Codex Chrome Extension, I want the web agent to understand its role and capabilities through a comprehensive system prompt, so that it can effectively navigate web pages, interact with DOM elements, and complete tasks using browser-specific tools rather than terminal commands.

### Acceptance Scenarios
1. **Given** a user query about web page interaction, **When** the agent processes the query, **Then** it uses web-specific instructions and tools (DOM manipulation, navigation, form automation) instead of terminal commands
2. **Given** the web agent is initialized, **When** it loads its system prompt, **Then** it receives browser-specific instructions that guide it to use web tools and understand browser security constraints
3. **Given** different model configurations (GPT-5, Codex variants), **When** the agent loads prompts, **Then** it applies the appropriate base instructions for that model family while maintaining web-specific behavior
4. **Given** a request requiring page interaction, **When** the agent plans its approach, **Then** it references DOM operations, tab management, and browser storage instead of file system operations

### Edge Cases
- What happens when the prompt references unavailable terminal tools?
- How does system handle model families not explicitly configured for web use?
- What occurs if prompt loading fails during agent initialization?
- How does the agent respond to queries requiring file system access it doesn't have?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST convert the terminal-based system prompt (gpt_5_codex_prompt.md) to web-agent specific instructions
- **FR-002**: System MUST replace all file system and shell command references with equivalent web operations (DOM manipulation, navigation, network interception)
- **FR-003**: System MUST maintain the same prompt loading architecture as codex-rs (model family support, base instructions pattern)
- **FR-004**: System MUST integrate the prompt into the agent's message construction pipeline matching codex-rs patterns
- **FR-005**: System MUST support model-specific prompt variations (GPT-5-codex, standard models) as done in codex-rs
- **FR-006**: System MUST provide clear instructions about available web tools (DOMTool, TabTool, NavigationTool, FormAutomationTool, etc.)
- **FR-007**: System MUST adapt sandboxing and approval concepts to browser security context (origin policies, permissions)
- **FR-008**: System MUST preserve the prompt's structure for presenting work and formatting responses
- **FR-009**: System MUST handle prompt loading failures gracefully with fallback to default instructions
- **FR-010**: System MUST support runtime prompt updates without requiring extension reload [NEEDS CLARIFICATION: Is hot-reload of prompts required?]

### Key Entities *(include if feature involves data)*
- **System Prompt Template**: Web-specific version of gpt_5_codex_prompt.md containing browser operation instructions
- **Model Family Configuration**: Mapping of model types to their appropriate base instructions (web-adapted)
- **Prompt Loader**: Component responsible for loading and composing full instructions from base + user instructions
- **Web Tool Descriptions**: Documentation of available browser tools replacing terminal commands

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---
