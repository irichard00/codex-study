/**
 * Ultra-Simplified Prompt System Contract
 * Single agent_prompt.md file, single function
 */

/**
 * Load the agent prompt file
 * @returns The prompt content
 */
export async function loadPrompt(): Promise<string> {
  const response = await fetch(chrome.runtime.getURL('prompts/agent_prompt.md'));
  return response.text();
}

/**
 * Integration with TurnManager
 * Add these ~2 lines to existing code
 */
export interface MessageWithPrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Example integration in TurnManager
 */
export async function addSystemPrompt(messages: MessageWithPrompt[]): Promise<void> {
  const prompt = await loadPrompt();
  messages.unshift({ role: 'system', content: prompt });
}

/**
 * That's the entire contract.
 * One file: agent_prompt.md
 * One function: loadPrompt()
 * Direct conversion from codex-rs/core/gpt_5_codex_prompt.md
 */