/**
 * AgentTask - Lightweight coordinator that delegates to TaskRunner
 *
 * This class acts as a thin coordination layer between CodexAgent and TaskRunner.
 * The majority of task execution logic remains in TaskRunner, while AgentTask
 * provides lifecycle management and cancellation support.
 */

import type { TaskRunner } from './TaskRunner';
import type { InputItem, ResponseItem } from '../protocol/types';
import type { Session } from './Session';
import type { TurnContext } from './TurnContext';

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
 * AgentTask coordinates task execution by delegating to TaskRunner
 * Implements the critical missing coordinator from codex-rs
 */
export class AgentTask {
  private taskRunner: TaskRunner;
  private submissionId: string;
  private sessionId: string;
  private status: TaskStatus = 'initializing';
  private abortController: AbortController;
  private input: ResponseItem[];
  private isReviewMode: boolean;

  constructor(
    taskRunner: TaskRunner,
    sessionId: string,
    submissionId: string,
    input: ResponseItem[],
    isReviewMode: boolean = false
  ) {
    this.taskRunner = taskRunner;
    this.sessionId = sessionId;
    this.submissionId = submissionId;
    this.input = input;
    this.isReviewMode = isReviewMode;
    this.abortController = new AbortController();
  }

  /**
   * Run the task by delegating to TaskRunner
   */
  async run(): Promise<void> {
    try {
      this.status = 'running';

      // Delegate actual task execution to TaskRunner
      // TaskRunner contains the main execution logic
      await this.taskRunner.executeWithCoordination(
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
   * Get submission ID
   */
  getSubmissionId(): string {
    return this.submissionId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if task is in review mode
   */
  isInReviewMode(): boolean {
    return this.isReviewMode;
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
}