/**
 * AgentTask - Lightweight coordinator that delegates to TaskRunner
 *
 * This class acts as a thin coordination layer between CodexAgent and TaskRunner.
 * The majority of task execution logic remains in TaskRunner, while AgentTask
 * provides lifecycle management and cancellation support.
 */

import { TaskRunner } from './TaskRunner';
import type { InputItem, ResponseItem } from '../protocol/types';
import { getResponseItemContent } from '../protocol/types';
import type { Session } from './Session';
import type { TurnContext } from './TurnContext';
import type { TurnManager } from './TurnManager';

/**
 * Task execution status
 */
export type TaskStatus = 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Token budget tracking
 */
export interface TokenBudget {
  used: number;
  max: number;
  compactionThreshold: number;
}

/**
 * AgentTask coordinates task execution by creating and managing its own TaskRunner
 * Implements the critical missing coordinator from codex-rs
 */
export class AgentTask {
  private taskRunner: TaskRunner;
  public submissionId: string;
  private sessionId: string;
  private status: TaskStatus = 'initializing';
  private abortController: AbortController;
  private input: ResponseItem[];

  constructor(
    session: Session,
    turnContext: TurnContext,
    turnManager: TurnManager,
    sessionId: string,
    submissionId: string,
    input: ResponseItem[]
  ) {
    this.sessionId = sessionId;
    this.submissionId = submissionId;
    this.input = input;
    this.abortController = new AbortController();
    
    // Create TaskRunner instance - AgentTask owns its TaskRunner
    this.taskRunner = new TaskRunner(
      session,
      turnContext,
      turnManager,
      submissionId,
      input.map(item => ({
        type: 'text' as const,
        text: getResponseItemContent(item)
      })),
      { autoCompact: true }
    );
  }

  /**
   * Run the task by delegating to TaskRunner
   */
  async run(): Promise<void> {
    try {
      this.status = 'running';

      // Delegate actual task execution to TaskRunner
      // TaskRunner contains the main execution logic
      await this.taskRunner.run_task(
        this.submissionId,
        this.abortController.signal
      );

      this.status = 'completed';
    } catch (error) {
      if (this.abortController.signal.aborted) {
        this.status = 'cancelled';
      } else {
        this.status = 'failed';
      }
      throw error;
    }
  }

  /**
   * Cancel the task execution
   */
  cancel(): void {
    this.abortController.abort();
    this.status = 'cancelled';
  }

  /**
   * Get current task status
   */
  getStatus(): TaskStatus {
    // Delegate to TaskRunner for detailed status
    const runnerStatus = this.taskRunner.getTaskStatus(this.submissionId);

    // Map TaskRunner status to AgentTask status
    if (runnerStatus === 'unknown' && this.status === 'initializing') {
      return 'initializing';
    }

    return runnerStatus as TaskStatus || this.status;
  }


  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get current turn index from TaskRunner
   */
  getCurrentTurnIndex(): number {
    return this.taskRunner.getCurrentTurnIndex(this.submissionId);
  }

  /**
   * Get token usage from TaskRunner
   */
  getTokenUsage(): TokenBudget {
    return this.taskRunner.getTokenUsage(this.submissionId);
  }

  /**
   * Inject user input into the running task
   * This allows for mid-task user interaction
   */
  async injectUserInput(input: ResponseItem[]): Promise<void> {
    // Convert ResponseItem[] to InputItem[] format for TaskRunner
    const inputItems = input.map(item => ({
      type: 'text' as const,
      text: getResponseItemContent(item)
    }));
    
    // For now, we'll need to extend TaskRunner to support input injection
    // This is a placeholder for the actual implementation
    console.log('Injecting user input:', inputItems);
  }
}