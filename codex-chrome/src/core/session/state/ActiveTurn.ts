/**
 * ActiveTurn - manages an active turn's running tasks and state
 * Port of Rust ActiveTurn struct (commit 250b244ab)
 */

import { TurnState } from './TurnState';
import type { RunningTask, ApprovalResolver } from './types';
import type { InputItem } from '../../../protocol/types';

/**
 * Manages the lifecycle and state of an active turn
 * Tracks running tasks and delegates approval/input management to TurnState
 */
export class ActiveTurn {
  /** Map of task IDs to running task info */
  private tasks: Map<string, RunningTask>;

  /** Turn-specific state for approvals and input */
  private turnState: TurnState;

  constructor() {
    this.tasks = new Map();
    this.turnState = new TurnState();
  }

  /**
   * Add a task to this turn
   * @param taskId Unique task identifier
   * @param task Task information
   */
  addTask(taskId: string, task: RunningTask): void {
    this.tasks.set(taskId, task);
  }

  /**
   * Remove a task from this turn
   * @param taskId Task to remove
   * @returns True if turn has no more tasks (is empty)
   */
  removeTask(taskId: string): boolean {
    this.tasks.delete(taskId);
    return this.tasks.size === 0;
  }

  /**
   * Check if a task exists
   * @param taskId Task to check
   * @returns True if task exists
   */
  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Abort all running tasks and clear state
   */
  abort(): void {
    // Abort all tasks
    for (const [_, task] of this.tasks) {
      task.handle.abort();
    }

    // Clear tasks
    this.tasks.clear();

    // Clear turn state
    this.turnState.clearPendingApprovals();
    this.turnState.clearPendingInput();
  }

  /**
   * Drain all tasks from this turn
   * @returns Map of all tasks (turn is left empty)
   */
  drain(): Map<string, RunningTask> {
    const drained = new Map(this.tasks);
    this.tasks.clear();
    return drained;
  }

  // ===== TurnState Delegation =====

  /**
   * Insert a pending approval
   * Delegates to TurnState
   */
  insertPendingApproval(executionId: string, resolver: ApprovalResolver): void {
    this.turnState.insertPendingApproval(executionId, resolver);
  }

  /**
   * Remove a pending approval
   * Delegates to TurnState
   */
  removePendingApproval(executionId: string): ApprovalResolver | undefined {
    return this.turnState.removePendingApproval(executionId);
  }

  /**
   * Push pending input
   * Delegates to TurnState
   */
  pushPendingInput(input: InputItem): void {
    this.turnState.pushPendingInput(input);
  }

  /**
   * Take all pending input
   * Delegates to TurnState
   */
  takePendingInput(): InputItem[] {
    return this.turnState.takePendingInput();
  }
}
