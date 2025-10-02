/**
 * Task Lifecycle Contracts
 *
 * Defines the interface contracts for task spawning, abortion, and lifecycle management:
 * - spawn_task() - Spawn new task with lifecycle management
 * - abort_all_tasks() - Abort all running tasks
 * - on_task_finished() - Handle task completion
 * - interrupt_task() - Public interrupt interface
 * - Supporting methods for task registration and abort handling
 */

import type { SessionTask, RunningTask, TurnAbortReason } from '../data-model';
import type { TurnContext } from '../../../../codex-chrome/src/core/TurnContext';
import type { InputItem } from '../../../../codex-chrome/src/protocol/types';

/**
 * SPAWN TASK CONTRACT
 *
 * Spawn a new task with full lifecycle management.
 */
export interface ISpawnTask {
  /**
   * Spawn new task with lifecycle management
   *
   * @param turnContext - Turn context for execution
   * @param subId - Submission ID
   * @param input - Input items for the task
   * @param task - Task to execute
   *
   * BEHAVIOR CONTRACT:
   * - MUST abort all existing tasks with TurnAbortReason.Replaced
   * - MUST create new AbortController for task cancellation
   * - MUST register task in ActiveTurn with RunningTask entry
   * - MUST spawn task execution asynchronously (no await)
   * - MUST emit TaskComplete event when task finishes
   * - MUST call onTaskFinished() on completion
   * - SHOULD handle task errors gracefully
   *
   * EXECUTION FLOW:
   * 1. Abort all existing tasks: await abortAllTasks({ type: 'replaced' })
   * 2. Create AbortController: const controller = new AbortController()
   * 3. Register task: registerNewActiveTask(subId, runningTask)
   * 4. Execute task (async, no await):
   *    - try {
   *        await task.execute(session, turnContext, controller.signal)
   *      } catch (error) {
   *        if (error.name !== 'AbortError') handleError(error)
   *      } finally {
   *        await onTaskFinished(subId, lastMessage)
   *      }
   *
   * PRECONDITIONS:
   * - task implements SessionTask interface
   * - turnContext is valid
   * - input is valid array (may be empty)
   *
   * POSTCONDITIONS:
   * - Old tasks aborted
   * - New task registered and running
   * - TaskComplete event will be emitted on finish
   *
   * ERROR HANDLING:
   * - Throws Error if task registration fails
   * - Logs error if task execution fails (non-fatal)
   * - Always calls onTaskFinished() in finally block
   *
   * ABORT HANDLING:
   * - If task is aborted via AbortController, catch AbortError
   * - Call task.abort() if defined
   * - Emit TurnAborted event
   */
  spawnTask(
    turnContext: TurnContext,
    subId: string,
    input: InputItem[],
    task: SessionTask
  ): Promise<void>;
}

/**
 * ABORT ALL TASKS CONTRACT
 *
 * Abort all running tasks in the active turn.
 */
export interface IAbortAllTasks {
  /**
   * Abort all running tasks
   *
   * @param reason - Reason for abortion
   *
   * BEHAVIOR CONTRACT:
   * - MUST retrieve all running tasks from ActiveTurn
   * - MUST call handleTaskAbort() for each task
   * - MUST clear pending input queue
   * - MUST clear pending approvals
   * - MUST emit TurnAborted event for each task
   *
   * EXECUTION FLOW:
   * 1. Get all tasks: const tasks = takeAllRunningTasks()
   * 2. For each task: await handleTaskAbort(subId, task, reason)
   * 3. Clear pending state:
   *    - activeTurn.clearPendingInput()
   *    - activeTurn.clearApprovals(reason)
   *
   * PRECONDITIONS:
   * - ActiveTurn exists (may be empty)
   *
   * POSTCONDITIONS:
   * - All tasks aborted
   * - ActiveTurn.tasks is empty
   * - Pending input cleared
   * - Pending approvals rejected
   *
   * ERROR HANDLING:
   * - Logs error if task abort fails (non-fatal)
   * - Continues aborting other tasks
   * - Never throws (always complete abort)
   *
   * PARALLEL ABORT:
   * - Tasks can be aborted in parallel (Promise.all)
   * - Each task's abort handler is independent
   */
  abortAllTasks(reason: TurnAbortReason): Promise<void>;
}

/**
 * TASK FINISHED CONTRACT
 *
 * Handle task completion and cleanup.
 */
export interface IOnTaskFinished {
  /**
   * Handle task completion
   *
   * @param subId - Submission ID
   * @param lastAgentMessage - Last message from agent (optional)
   *
   * BEHAVIOR CONTRACT:
   * - MUST remove task from ActiveTurn.tasks
   * - MUST clear ActiveTurn if no tasks remain
   * - MUST emit TaskComplete event
   * - SHOULD include token usage summary
   * - SHOULD include turn count
   *
   * EVENT STRUCTURE:
   * {
   *   type: 'TaskComplete',
   *   data: {
   *     submission_id: subId,
   *     last_agent_message: lastAgentMessage,
   *     turn_count: turnCount,
   *     token_usage: {
   *       total: { ... },
   *       last_turn: { ... }
   *     },
   *     compaction_performed: boolean,
   *     aborted: false
   *   }
   * }
   *
   * PRECONDITIONS:
   * - Task exists in ActiveTurn
   *
   * POSTCONDITIONS:
   * - Task removed from ActiveTurn
   * - TaskComplete event emitted
   * - ActiveTurn cleared if no tasks remain
   *
   * ERROR HANDLING:
   * - Logs warning if task not found (idempotent)
   * - Never throws
   */
  onTaskFinished(subId: string, lastAgentMessage?: string): Promise<void>;
}

/**
 * INTERRUPT TASK CONTRACT
 *
 * Public API to interrupt the current task.
 */
export interface IInterruptTask {
  /**
   * Interrupt current task
   *
   * BEHAVIOR CONTRACT:
   * - MUST call abortAllTasks with TurnAbortReason.Interrupted
   * - MUST be safe to call multiple times (idempotent)
   * - MUST be callable from any context
   *
   * USE CASES:
   * - User clicks stop button
   * - User sends interrupt signal
   * - Timeout or resource limit reached
   *
   * PRECONDITIONS:
   * - None (safe to call anytime)
   *
   * POSTCONDITIONS:
   * - All tasks aborted with 'interrupted' reason
   * - TurnAborted events emitted
   */
  interruptTask(): Promise<void>;
}

/**
 * REGISTER ACTIVE TASK CONTRACT
 *
 * Register a new task in the active turn (internal).
 */
export interface IRegisterNewActiveTask {
  /**
   * Register new active task
   *
   * @param subId - Submission ID
   * @param task - Running task info
   *
   * BEHAVIOR CONTRACT:
   * - MUST create new ActiveTurn if none exists
   * - MUST add task to ActiveTurn.tasks map
   * - MUST ensure subId is unique
   *
   * PRECONDITIONS:
   * - task has valid RunningTask structure
   *
   * POSTCONDITIONS:
   * - ActiveTurn exists
   * - Task registered in tasks map
   *
   * ERROR HANDLING:
   * - Throws Error if subId already exists (duplicate)
   */
  registerNewActiveTask(subId: string, task: RunningTask): Promise<void>;
}

/**
 * TAKE ALL RUNNING TASKS CONTRACT
 *
 * Extract all running tasks from active turn (internal).
 */
export interface ITakeAllRunningTasks {
  /**
   * Take all running tasks
   *
   * @returns Array of [subId, RunningTask] tuples
   *
   * BEHAVIOR CONTRACT:
   * - MUST take ownership of ActiveTurn (if exists)
   * - MUST clear pending input queue
   * - MUST clear pending approvals
   * - MUST drain tasks from ActiveTurn.tasks map
   * - MUST return empty array if no ActiveTurn
   *
   * PRECONDITIONS:
   * - None
   *
   * POSTCONDITIONS:
   * - ActiveTurn.tasks is empty
   * - Pending state cleared
   * - Returned tasks ready for abort
   *
   * ERROR HANDLING:
   * - Never throws
   * - Returns empty array if no tasks
   */
  takeAllRunningTasks(): Promise<Array<[string, RunningTask]>>;
}

/**
 * HANDLE TASK ABORT CONTRACT
 *
 * Handle individual task abortion (internal).
 */
export interface IHandleTaskAbort {
  /**
   * Handle individual task abort
   *
   * @param subId - Submission ID
   * @param task - Running task
   * @param reason - Abort reason
   *
   * BEHAVIOR CONTRACT:
   * - MUST check if task already finished (race condition)
   * - MUST abort task via AbortController.abort()
   * - MUST call task.abort() if defined
   * - MUST emit TurnAborted event
   * - SHOULD include abort reason in event
   *
   * EVENT STRUCTURE:
   * {
   *   type: 'TurnAborted',
   *   data: {
   *     reason: 'user_interrupt' | 'automatic_abort' | 'error',
   *     submission_id: subId,
   *     turn_count: number,
   *     message: string
   *   }
   * }
   *
   * PRECONDITIONS:
   * - task is valid RunningTask
   *
   * POSTCONDITIONS:
   * - Task aborted
   * - Task-specific cleanup performed
   * - TurnAborted event emitted
   *
   * ERROR HANDLING:
   * - Logs error if abort handler fails
   * - Always aborts task (even if handler fails)
   * - Always emits event
   */
  handleTaskAbort(
    subId: string,
    task: RunningTask,
    reason: TurnAbortReason
  ): Promise<void>;
}

/**
 * Combined Task Lifecycle Interface
 */
export interface ITaskLifecycle
  extends ISpawnTask,
    IAbortAllTasks,
    IOnTaskFinished,
    IInterruptTask,
    IRegisterNewActiveTask,
    ITakeAllRunningTasks,
    IHandleTaskAbort {}

/**
 * INTEGRATION EXAMPLE
 *
 * ```typescript
 * // Define a task
 * class MyTask implements SessionTask {
 *   kind = TaskKind.Regular;
 *
 *   async execute(
 *     session: Session,
 *     turnContext: TurnContext,
 *     signal: AbortSignal
 *   ): Promise<void> {
 *     // Check abort signal periodically
 *     if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
 *
 *     // Do work
 *     await doSomething();
 *
 *     // Check again
 *     if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
 *
 *     await doMoreWork();
 *   }
 *
 *   async abort(reason: TurnAbortReason): Promise<void> {
 *     // Task-specific cleanup
 *     console.log('Task aborted:', reason);
 *     await cleanup();
 *   }
 * }
 *
 * // Spawn the task
 * const task = new MyTask();
 * await session.spawnTask(
 *   turnContext,
 *   'sub_123',
 *   inputItems,
 *   task
 * );
 *
 * // Later: interrupt
 * await session.interruptTask();
 * ```
 */

/**
 * TEST SCENARIOS
 *
 * 1. Spawn Single Task
 *    - Given: No active tasks
 *    - When: spawnTask() called
 *    - Then: Task registered and executing
 *
 * 2. Spawn Replaces Previous
 *    - Given: Task already running
 *    - When: spawnTask() called with new task
 *    - Then: Old task aborted, new task starts
 *
 * 3. Task Completes Successfully
 *    - Given: Task executing
 *    - When: Task finishes without error
 *    - Then: onTaskFinished() called, TaskComplete emitted
 *
 * 4. Task Aborted During Execution
 *    - Given: Task executing
 *    - When: interruptTask() called
 *    - Then: AbortController.abort(), task throws AbortError, TurnAborted emitted
 *
 * 5. Abort All with Multiple Tasks
 *    - Given: Multiple tasks running
 *    - When: abortAllTasks() called
 *    - Then: All tasks aborted, all emit TurnAborted
 *
 * 6. Task Error Handling
 *    - Given: Task executing
 *    - When: Task throws error (not AbortError)
 *    - Then: Error logged, TaskComplete with error info
 *
 * 7. Pending Approvals on Abort
 *    - Given: Task waiting for approval
 *    - When: abortAllTasks() called
 *    - Then: Approval promise rejects, task aborts
 *
 * 8. Task Finished After Abort
 *    - Given: Task is being aborted
 *    - When: Task finishes before abort completes (race)
 *    - Then: handleTaskAbort checks finish state, skips abort
 *
 * 9. Double Interrupt
 *    - Given: Task already aborted
 *    - When: interruptTask() called again
 *    - Then: Idempotent, no error
 *
 * 10. Task with Custom Abort Handler
 *     - Given: Task has abort() method
 *     - When: Task is aborted
 *     - Then: abort() called for cleanup, then TurnAborted emitted
 */

/**
 * ABORT CONTROLLER PATTERN
 *
 * Implementation strategy for task cancellation:
 *
 * ```typescript
 * // In spawnTask:
 * async spawnTask(
 *   turnContext: TurnContext,
 *   subId: string,
 *   input: InputItem[],
 *   task: SessionTask
 * ): Promise<void> {
 *   // Abort existing tasks
 *   await this.abortAllTasks({ type: 'replaced' });
 *
 *   // Create abort controller
 *   const controller = new AbortController();
 *
 *   // Create running task
 *   const runningTask: RunningTask = {
 *     handle: controller,
 *     kind: task.kind,
 *     startTime: Date.now(),
 *     subId,
 *     abortHandler: task.abort?.bind(task)
 *   };
 *
 *   // Register task
 *   await this.registerNewActiveTask(subId, runningTask);
 *
 *   // Execute task (async, no await)
 *   (async () => {
 *     let lastMessage: string | undefined;
 *
 *     try {
 *       await task.execute(this, turnContext, controller.signal);
 *       lastMessage = 'Task completed successfully';
 *     } catch (error) {
 *       if (error.name === 'AbortError') {
 *         // Task was aborted, this is expected
 *         return;
 *       }
 *       console.error('Task execution error:', error);
 *       lastMessage = `Error: ${error.message}`;
 *     } finally {
 *       await this.onTaskFinished(subId, lastMessage);
 *     }
 *   })();
 * }
 *
 * // In abortAllTasks:
 * async abortAllTasks(reason: TurnAbortReason): Promise<void> {
 *   const tasks = await this.takeAllRunningTasks();
 *
 *   await Promise.all(
 *     tasks.map(([subId, task]) => this.handleTaskAbort(subId, task, reason))
 *   );
 * }
 *
 * // In handleTaskAbort:
 * async handleTaskAbort(
 *   subId: string,
 *   task: RunningTask,
 *   reason: TurnAbortReason
 * ): Promise<void> {
 *   // Check if already finished
 *   if (task.handle.signal.aborted) {
 *     return; // Already aborted
 *   }
 *
 *   // Abort the task
 *   task.handle.abort();
 *
 *   // Call task-specific abort handler
 *   if (task.abortHandler) {
 *     try {
 *       await task.abortHandler(reason);
 *     } catch (error) {
 *       console.error('Abort handler error:', error);
 *     }
 *   }
 *
 *   // Emit event
 *   await this.sendEvent({
 *     id: generateEventId(),
 *     msg: {
 *       type: 'TurnAborted',
 *       data: {
 *         reason: mapTurnAbortReason(reason),
 *         submission_id: subId,
 *         turn_count: this.turnHistory.length,
 *         message: formatAbortMessage(reason)
 *       }
 *     }
 *   });
 * }
 * ```
 */
