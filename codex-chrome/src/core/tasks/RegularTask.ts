/**
 * RegularTask - Standard conversation task
 *
 * Implements normal conversation execution by delegating to AgentTask coordinator.
 * This is the default task type for user interactions.
 */

import type { SessionTask } from './SessionTask';
import type { Session } from '../Session';
import type { TurnContext } from '../TurnContext';
import type { InputItem, ResponseItem } from '../../protocol/types';
import type { TaskKind } from '../session/state/types';
import { AgentTask } from '../AgentTask';
import { TurnManager } from '../TurnManager';

/**
 * RegularTask implementation
 * Handles normal conversation turns with tool execution by delegating to AgentTask
 */
export class RegularTask implements SessionTask {
  private agentTask: AgentTask | null = null;

  /**
   * Return task kind
   */
  kind(): TaskKind {
    return 'Regular';
  }

  /**
   * Execute regular conversation task
   *
   * Delegates to AgentTask coordinator which manages TaskRunner and execution
   */
  async run(
    session: Session,
    context: TurnContext,
    subId: string,
    input: InputItem[]
  ): Promise<string | null> {
    // Create TurnManager for this task
    const turnManager = new TurnManager(
      session,
      context,
      session.getToolRegistry?.() || null // Optional: get tool registry if available
    );

    // Convert InputItem[] to ResponseItem[] for AgentTask
    const responseItems = this.convertInput(input);

    // Delegate to AgentTask coordinator (browser-specific layer)
    this.agentTask = new AgentTask(
      session,
      context,
      turnManager,
      session.getSessionId(),
      subId,
      responseItems
    );

    try {
      // Run task via AgentTask (which creates and manages TaskRunner)
      await this.agentTask.run();

      // Extract final assistant message from session history
      const conversationHistory = session.getConversationHistory();
      const lastAgentMessage = conversationHistory.items
        .filter(item => item.role === 'assistant')
        .map(item => typeof item.content === 'string' ? item.content : JSON.stringify(item.content))
        .pop();

      return lastAgentMessage || null;
    } catch (error) {
      console.error('RegularTask execution error:', error);
      throw error;
    }
  }

  /**
   * Convert InputItem[] to ResponseItem[] for AgentTask
   *
   * AgentTask expects ResponseItem[], but SessionTask.run() provides InputItem[]
   */
  private convertInput(input: InputItem[]): ResponseItem[] {
    return input.map(item => ({
      type: 'message' as const,
      role: 'user' as const,
      content: item.text || JSON.stringify(item)
    }));
  }

  /**
   * Abort task execution
   * Delegates to AgentTask.cancel() which stops TaskRunner
   */
  async abort(session: Session, subId: string): Promise<void> {
    if (this.agentTask) {
      this.agentTask.cancel();
      this.agentTask = null;
    }
  }
}
