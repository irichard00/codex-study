/**
 * Event Management Contracts
 *
 * Defines the interface contracts for event emission and command lifecycle events:
 * - send_event() - Persist and dispatch events
 * - on_exec_command_begin() - Emit command execution start event
 * - on_exec_command_end() - Emit command execution end event
 * - run_exec_with_events() - Execute command with full event lifecycle
 * - Helper event methods (notify_background_event, notify_stream_error, send_token_count_event)
 */

import type { Event, EventMsg } from '../../../../codex-chrome/src/protocol/types';
import type { ExecCommandContext, ExecToolCallOutput, ExecInvokeArgs } from '../data-model';
import type { TurnDiffTracker } from './turn-diff-tracker';

/**
 * EVENT SENDING CONTRACT
 *
 * Central event dispatch point - persists to rollout and emits to clients.
 */
export interface ISendEvent {
  /**
   * Send event with rollout persistence
   *
   * @param event - Event to send
   *
   * BEHAVIOR CONTRACT:
   * - MUST persist event to RolloutRecorder as EventMsg rollout item
   * - MUST emit event through event channel/emitter to clients
   * - MUST handle both persistence and emission atomically
   * - SHOULD batch events if possible for performance
   *
   * PRECONDITIONS:
   * - Event has valid structure (id and msg)
   * - RolloutRecorder is initialized (may be null)
   *
   * POSTCONDITIONS:
   * - Event persisted to rollout (if recorder available)
   * - Event emitted to all subscribed clients
   * - Event ordering preserved in rollout
   *
   * ERROR HANDLING:
   * - Logs warning if rollout persistence fails (non-fatal)
   * - Throws Error if event emission fails (fatal)
   * - Never drops events silently
   *
   * INTEGRATION:
   * - Replaces current emitEvent() to add rollout persistence
   * - All events should flow through this method
   */
  sendEvent(event: Event): Promise<void>;
}

/**
 * COMMAND BEGIN EVENT CONTRACT
 *
 * Emit event when command execution begins.
 */
export interface IOnExecCommandBegin {
  /**
   * Emit command execution start event
   *
   * @param turnDiffTracker - Diff tracker for file changes
   * @param execCommandContext - Command context
   *
   * BEHAVIOR CONTRACT:
   * - MUST emit ExecCommandBegin or PatchApplyBegin based on context.isPatchApply
   * - MUST track diff for patch operations (via turnDiffTracker)
   * - MUST parse command for structured representation
   * - MUST include subId, callId, command, cwd in event
   * - SHOULD include reason/explanation if provided
   *
   * EVENT STRUCTURE (ExecCommandBegin):
   * {
   *   type: 'ExecCommandBegin',
   *   data: {
   *     session_id: subId,
   *     command: command.join(' '),
   *     // Chrome-specific:
   *     tab_id?: number,
   *     url?: string
   *   }
   * }
   *
   * EVENT STRUCTURE (PatchApplyBegin):
   * {
   *   type: 'PatchApplyBegin',
   *   data: {
   *     path: action.path,
   *     description: action.description
   *   }
   * }
   *
   * PRECONDITIONS:
   * - execCommandContext is valid
   * - turnDiffTracker is initialized
   *
   * POSTCONDITIONS:
   * - Event emitted via sendEvent()
   * - Diff tracking started if isPatchApply
   * - Command parsed and logged
   *
   * ERROR HANDLING:
   * - Throws Error if command parsing fails
   * - Logs warning if diff tracking fails
   */
  onExecCommandBegin(
    turnDiffTracker: TurnDiffTracker,
    execCommandContext: ExecCommandContext
  ): Promise<void>;
}

/**
 * COMMAND END EVENT CONTRACT
 *
 * Emit event when command execution completes.
 */
export interface IOnExecCommandEnd {
  /**
   * Emit command execution end event
   *
   * @param turnDiffTracker - Diff tracker for file changes
   * @param subId - Submission ID
   * @param callId - Call ID
   * @param output - Execution output
   * @param isPatchApply - Whether this was a patch application
   *
   * BEHAVIOR CONTRACT:
   * - MUST emit ExecCommandEnd or PatchApplyEnd based on isPatchApply
   * - MUST include stdout, stderr, exit_code, duration
   * - MUST emit TurnDiff event if isPatchApply and files changed
   * - MUST format output for display (truncate if needed)
   * - SHOULD include performance metrics
   *
   * EVENT STRUCTURE (ExecCommandEnd):
   * {
   *   type: 'ExecCommandEnd',
   *   data: {
   *     session_id: subId,
   *     exit_code: output.exitCode,
   *     duration_ms: output.durationMs
   *   }
   * }
   *
   * EVENT STRUCTURE (PatchApplyEnd):
   * {
   *   type: 'PatchApplyEnd',
   *   data: {
   *     path: action.path,
   *     success: output.exitCode === 0,
   *     error: output.exitCode !== 0 ? output.stderr : undefined
   *   }
   * }
   *
   * EVENT STRUCTURE (TurnDiff):
   * {
   *   type: 'TurnDiff',
   *   data: {
   *     diff: diffContent,
   *     files_changed: filesCount
   *   }
   * }
   *
   * PRECONDITIONS:
   * - onExecCommandBegin was called for this execution
   * - output is complete
   *
   * POSTCONDITIONS:
   * - End event emitted
   * - Diff event emitted if applicable
   * - Diff tracking stopped
   *
   * ERROR HANDLING:
   * - Never throws (always emit event even on error)
   * - Includes error info in event data
   */
  onExecCommandEnd(
    turnDiffTracker: TurnDiffTracker,
    subId: string,
    callId: string,
    output: ExecToolCallOutput,
    isPatchApply: boolean
  ): Promise<void>;
}

/**
 * EXECUTE WITH EVENTS CONTRACT
 *
 * Wrapper that executes command with full event lifecycle.
 */
export interface IRunExecWithEvents {
  /**
   * Execute command with begin/end events
   *
   * @param turnDiffTracker - Diff tracker
   * @param beginCtx - Command context
   * @param execArgs - Execution arguments
   * @returns Execution output
   *
   * BEHAVIOR CONTRACT:
   * - MUST call onExecCommandBegin before execution
   * - MUST execute command via processExecToolCall or equivalent
   * - MUST call onExecCommandEnd after execution (even on error)
   * - MUST handle errors gracefully
   * - MUST emit events even if execution fails
   *
   * EXECUTION FLOW:
   * 1. Call onExecCommandBegin(turnDiffTracker, beginCtx)
   * 2. Execute command: output = await processExecToolCall(execArgs)
   * 3. Call onExecCommandEnd(turnDiffTracker, ..., output, beginCtx.isPatchApply)
   * 4. Return output
   *
   * ERROR FLOW:
   * 1. Call onExecCommandBegin(turnDiffTracker, beginCtx)
   * 2. Execute command: throws error
   * 3. Catch error, create error output
   * 4. Call onExecCommandEnd with error output
   * 5. Rethrow or return error output
   *
   * PRECONDITIONS:
   * - beginCtx is valid
   * - execArgs is valid
   *
   * POSTCONDITIONS:
   * - Begin event emitted
   * - Command executed
   * - End event emitted
   * - Output returned or error thrown
   *
   * BROWSER ADAPTATION:
   * - Chrome extension cannot execute shell commands directly
   * - May delegate to content script or background script
   * - May use Chrome APIs for browser-specific operations
   * - Should handle sandbox restrictions gracefully
   */
  runExecWithEvents(
    turnDiffTracker: TurnDiffTracker,
    beginCtx: ExecCommandContext,
    execArgs: ExecInvokeArgs
  ): Promise<ExecToolCallOutput>;
}

/**
 * BACKGROUND EVENT NOTIFICATION CONTRACT
 *
 * Emit background notification events for diagnostics.
 */
export interface INotifyBackgroundEvent {
  /**
   * Emit background event
   *
   * @param subId - Submission ID
   * @param message - Message content
   *
   * BEHAVIOR CONTRACT:
   * - MUST emit BackgroundEvent with message
   * - SHOULD include timestamp
   * - MAY include severity level (info/warning/error)
   *
   * USE CASES:
   * - Long-running operation updates
   * - Progress notifications
   * - Diagnostic messages
   */
  notifyBackgroundEvent(subId: string, message: string): Promise<void>;
}

/**
 * STREAM ERROR NOTIFICATION CONTRACT
 *
 * Emit streaming error events.
 */
export interface INotifyStreamError {
  /**
   * Emit stream error event
   *
   * @param subId - Submission ID
   * @param message - Error message
   *
   * BEHAVIOR CONTRACT:
   * - MUST emit StreamError event
   * - SHOULD include retry information
   * - MAY include attempt number
   *
   * USE CASES:
   * - Model streaming errors
   * - Network failures during streaming
   * - Retry notifications
   */
  notifyStreamError(subId: string, message: string): Promise<void>;
}

/**
 * TOKEN COUNT EVENT CONTRACT
 *
 * Send token usage update event.
 */
export interface ISendTokenCountEvent {
  /**
   * Send token count event
   *
   * @param subId - Submission ID
   *
   * BEHAVIOR CONTRACT:
   * - MUST retrieve current token info from SessionState
   * - MUST retrieve current rate limits from SessionState
   * - MUST emit TokenCount event with both
   * - SHOULD calculate usage percentages
   *
   * EVENT STRUCTURE:
   * {
   *   type: 'TokenCount',
   *   data: {
   *     info: {
   *       total_token_usage: { ... },
   *       last_token_usage: { ... },
   *       model_context_window: number
   *     },
   *     rate_limits: {
   *       primary_used_percent: number,
   *       secondary_used_percent: number,
   *       ...
   *     }
   *   }
   * }
   *
   * PRECONDITIONS:
   * - SessionState has token info
   *
   * POSTCONDITIONS:
   * - TokenCount event emitted
   */
  sendTokenCountEvent(subId: string): Promise<void>;
}

/**
 * Combined Event Management Interface
 */
export interface IEventManagement
  extends ISendEvent,
    IOnExecCommandBegin,
    IOnExecCommandEnd,
    IRunExecWithEvents,
    INotifyBackgroundEvent,
    INotifyStreamError,
    ISendTokenCountEvent {}

/**
 * TURN DIFF TRACKER INTERFACE
 *
 * Tracks file changes during a turn for diff events.
 * Separate contract file: turn-diff-tracker.contract.ts
 */
export interface TurnDiffTracker {
  /**
   * Start tracking diff for a file
   */
  startTracking(path: string): Promise<void>;

  /**
   * Stop tracking and generate diff
   */
  stopTracking(path: string): Promise<string | null>;

  /**
   * Get current diff for a file
   */
  getDiff(path: string): Promise<string | null>;

  /**
   * Clear all tracked diffs
   */
  clear(): void;
}

/**
 * INTEGRATION EXAMPLE
 *
 * ```typescript
 * // Execute command with events
 * async function executeCommand(
 *   session: Session,
 *   command: string[],
 *   cwd: string
 * ) {
 *   const turnDiffTracker = new TurnDiffTracker();
 *   const subId = 'sub_123';
 *   const callId = 'call_456';
 *
 *   const beginCtx: ExecCommandContext = {
 *     subId,
 *     callId,
 *     command,
 *     cwd,
 *     reason: 'Execute tests',
 *     isPatchApply: false
 *   };
 *
 *   const execArgs: ExecInvokeArgs = {
 *     command,
 *     cwd,
 *     timeoutMs: 30000
 *   };
 *
 *   try {
 *     const output = await session.runExecWithEvents(
 *       turnDiffTracker,
 *       beginCtx,
 *       execArgs
 *     );
 *
 *     console.log('Command completed:', output.exitCode);
 *     return output;
 *   } catch (error) {
 *     console.error('Command failed:', error);
 *     throw error;
 *   }
 * }
 *
 * // Send custom events
 * await session.notifyBackgroundEvent('sub_123', 'Starting long operation...');
 * await doLongOperation();
 * await session.notifyBackgroundEvent('sub_123', 'Operation complete');
 *
 * // Send token count updates
 * await session.sendTokenCountEvent('sub_123');
 * ```
 */

/**
 * TEST SCENARIOS
 *
 * 1. Event Persistence
 *    - Given: sendEvent() called
 *    - When: RolloutRecorder is available
 *    - Then: Event persisted to rollout and emitted
 *
 * 2. Command Execution Lifecycle
 *    - Given: runExecWithEvents() called
 *    - When: Command executes successfully
 *    - Then: Begin event, execution, end event (exit_code: 0)
 *
 * 3. Command Execution Error
 *    - Given: runExecWithEvents() called
 *    - When: Command execution fails
 *    - Then: Begin event, error, end event (exit_code: non-zero)
 *
 * 4. Patch Apply with Diff
 *    - Given: runExecWithEvents() for patch
 *    - When: isPatchApply = true and files change
 *    - Then: PatchApplyBegin, execution, PatchApplyEnd, TurnDiff events
 *
 * 5. Rollout Persistence Failure
 *    - Given: sendEvent() called
 *    - When: RolloutRecorder.record() fails
 *    - Then: Logs warning, still emits event (non-fatal)
 *
 * 6. Background Event
 *    - Given: notifyBackgroundEvent() called
 *    - When: Long operation in progress
 *    - Then: BackgroundEvent emitted with message
 *
 * 7. Stream Error with Retry
 *    - Given: notifyStreamError() called
 *    - When: Streaming fails, retry planned
 *    - Then: StreamError event with retrying: true
 *
 * 8. Token Count Event
 *    - Given: sendTokenCountEvent() called
 *    - When: SessionState has token usage
 *    - Then: TokenCount event with usage and rate limits
 *
 * 9. Event Ordering
 *    - Given: Multiple events sent rapidly
 *    - When: Events persisted to rollout
 *    - Then: Rollout preserves event order
 *
 * 10. Diff Tracking for Patch
 *     - Given: onExecCommandBegin for patch
 *     - When: Files are modified
 *     - Then: TurnDiffTracker captures changes
 */
