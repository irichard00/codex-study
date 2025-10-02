/**
 * Approval Handling Contracts
 *
 * Defines the interface contracts for command and patch approval workflow:
 * - request_command_approval() - Request approval for shell commands
 * - request_patch_approval() - Request approval for file patches
 * - notify_approval() - Deliver user decision to waiting task
 */

import type { ReviewDecision } from '../../../../codex-chrome/src/protocol/types';
import type { ApprovalCallback, ApplyPatchAction } from '../data-model';

/**
 * COMMAND APPROVAL REQUEST CONTRACT
 *
 * Request user approval for executing a shell command.
 * Returns a Promise that resolves when user makes a decision.
 */
export interface IRequestCommandApproval {
  /**
   * Request approval for command execution
   *
   * @param subId - Submission ID this command belongs to
   * @param callId - Unique call ID for this command
   * @param command - Command array (e.g., ['git', 'commit', '-m', 'msg'])
   * @param cwd - Working directory for command execution
   * @param reason - Optional explanation of why command is needed
   * @returns Promise<ReviewDecision> - Resolves when user decides
   *
   * BEHAVIOR CONTRACT:
   * - MUST create unique executionId for this approval request
   * - MUST register approval callback in ActiveTurn.pendingApprovals
   * - MUST emit ExecApprovalRequest event with command details
   * - MUST return Promise that waits for user decision
   * - MUST include command, cwd, and reason in event
   *
   * PRECONDITIONS:
   * - ActiveTurn exists (session has active turn)
   * - subId and callId are valid identifiers
   * - command is non-empty array
   *
   * POSTCONDITIONS:
   * - Approval callback registered in ActiveTurn
   * - ExecApprovalRequest event emitted to client
   * - Promise pending until notify_approval() called
   *
   * ERROR HANDLING:
   * - Throws Error if no active turn exists
   * - Throws Error if executionId collision occurs
   * - Promise rejects if turn is aborted before decision
   * - Promise rejects on timeout (if configured)
   *
   * PARALLEL EXECUTION:
   * - Multiple approval requests can be pending simultaneously
   * - Each has unique executionId
   * - Approvals can be resolved in any order
   */
  requestCommandApproval(
    subId: string,
    callId: string,
    command: string[],
    cwd: string,
    reason?: string
  ): Promise<ReviewDecision>;
}

/**
 * PATCH APPROVAL REQUEST CONTRACT
 *
 * Request user approval for applying a file patch.
 * Returns a Promise that resolves when user makes a decision.
 */
export interface IRequestPatchApproval {
  /**
   * Request approval for patch application
   *
   * @param subId - Submission ID this patch belongs to
   * @param callId - Unique call ID for this patch
   * @param action - Patch action details (path, patch content, etc.)
   * @param reason - Optional explanation of why patch is needed
   * @param grantRoot - Optional root path for patch validation
   * @returns Promise<ReviewDecision> - Resolves when user decides
   *
   * BEHAVIOR CONTRACT:
   * - MUST create unique executionId for this approval request
   * - MUST register approval callback in ActiveTurn.pendingApprovals
   * - MUST emit ApplyPatchApprovalRequest event with patch details
   * - MUST convert ApplyPatchAction to protocol format
   * - MUST validate patch syntax before requesting approval
   * - MUST return Promise that waits for user decision
   *
   * PRECONDITIONS:
   * - ActiveTurn exists
   * - action.patch is valid unified diff format
   * - action.path is within grantRoot (if specified)
   *
   * POSTCONDITIONS:
   * - Approval callback registered in ActiveTurn
   * - ApplyPatchApprovalRequest event emitted
   * - Promise pending until notify_approval() called
   *
   * ERROR HANDLING:
   * - Throws Error if no active turn exists
   * - Throws Error if patch syntax is invalid
   * - Throws Error if path is outside grantRoot
   * - Promise rejects if turn is aborted before decision
   */
  requestPatchApproval(
    subId: string,
    callId: string,
    action: ApplyPatchAction,
    reason?: string,
    grantRoot?: string
  ): Promise<ReviewDecision>;
}

/**
 * APPROVAL NOTIFICATION CONTRACT
 *
 * Deliver user's approval decision to the waiting task.
 */
export interface INotifyApproval {
  /**
   * Notify waiting task of user's approval decision
   *
   * @param subId - Submission ID of the request
   * @param decision - User's decision (approve/reject/request_change)
   *
   * BEHAVIOR CONTRACT:
   * - MUST find pending approval by subId in ActiveTurn
   * - MUST resolve the approval callback with decision
   * - MUST remove approval from pendingApprovals map
   * - SHOULD log the decision for audit trail
   *
   * PRECONDITIONS:
   * - Pending approval exists for subId
   * - decision is valid ReviewDecision
   *
   * POSTCONDITIONS:
   * - Approval callback resolved
   * - Approval removed from ActiveTurn.pendingApprovals
   * - Waiting task resumes execution
   *
   * ERROR HANDLING:
   * - Throws Error if no approval found for subId
   * - Throws Error if approval already resolved
   * - Logs warning if ActiveTurn is null (stale approval)
   *
   * RACE CONDITIONS:
   * - If turn is aborted, pending approvals should be rejected
   * - If multiple approvals pending, only specified one is resolved
   * - Thread-safe in single-threaded JS (no mutex needed)
   */
  notifyApproval(subId: string, decision: ReviewDecision): Promise<void>;
}

/**
 * Combined Approval Handling Interface
 */
export interface IApprovalHandling
  extends IRequestCommandApproval,
    IRequestPatchApproval,
    INotifyApproval {}

/**
 * APPROVAL CALLBACK STORAGE
 *
 * Internal structure in ActiveTurn for managing pending approvals.
 * Not exposed in Session API, but documented for implementation.
 */
export interface ApprovalStorage {
  /**
   * Map of executionId -> ApprovalCallback
   * Stored in ActiveTurn.turnState.pendingApprovals
   */
  pendingApprovals: Map<string, ApprovalCallback>;

  /**
   * Register a new approval callback
   */
  registerApproval(executionId: string, callback: ApprovalCallback): void;

  /**
   * Resolve an approval by executionId
   * Returns true if found and resolved, false otherwise
   */
  resolveApproval(executionId: string, decision: ReviewDecision): boolean;

  /**
   * Clear all pending approvals (on turn abort)
   * Rejects all promises with abort error
   */
  clearApprovals(reason: string): void;
}

/**
 * INTEGRATION EXAMPLE
 *
 * ```typescript
 * // In a task execution:
 * async function executeCommandWithApproval(
 *   session: Session,
 *   command: string[],
 *   cwd: string
 * ) {
 *   const subId = 'sub_123';
 *   const callId = 'call_456';
 *
 *   try {
 *     // Request approval
 *     const decision = await session.requestCommandApproval(
 *       subId,
 *       callId,
 *       command,
 *       cwd,
 *       'Need to run tests'
 *     );
 *
 *     if (decision === 'approve') {
 *       // Execute command
 *       const output = await executeCommand(command, cwd);
 *       return output;
 *     } else if (decision === 'reject') {
 *       throw new Error('User rejected command execution');
 *     } else {
 *       // request_change - ask agent to modify
 *       return null;
 *     }
 *   } catch (error) {
 *     if (error.code === 'TASK_ABORTED') {
 *       // Turn was aborted while waiting
 *       console.log('Approval cancelled due to abort');
 *     }
 *     throw error;
 *   }
 * }
 *
 * // In client code (handling user input):
 * async function handleUserApproval(subId: string, approved: boolean) {
 *   const decision = approved ? 'approve' : 'reject';
 *   await session.notifyApproval(subId, decision);
 * }
 * ```
 */

/**
 * TEST SCENARIOS
 *
 * 1. Command Approval - Approve
 *    - Given: Task requests command approval
 *    - When: User approves via notifyApproval()
 *    - Then: Promise resolves with 'approve', task continues
 *
 * 2. Command Approval - Reject
 *    - Given: Task requests command approval
 *    - When: User rejects via notifyApproval()
 *    - Then: Promise resolves with 'reject', task handles rejection
 *
 * 3. Patch Approval - Request Change
 *    - Given: Task requests patch approval
 *    - When: User requests change via notifyApproval()
 *    - Then: Promise resolves with 'request_change', agent modifies
 *
 * 4. Multiple Pending Approvals
 *    - Given: Two approval requests pending
 *    - When: User approves first, then second
 *    - Then: Each resolves independently, correct order
 *
 * 5. Approval During Turn Abort
 *    - Given: Approval request pending
 *    - When: Turn is aborted before user decides
 *    - Then: Approval promise rejects with abort error
 *
 * 6. Approval After Turn End
 *    - Given: Turn ends naturally
 *    - When: User tries to approve after turn end
 *    - Then: notifyApproval throws error (no active turn)
 *
 * 7. Invalid Patch Syntax
 *    - Given: requestPatchApproval with malformed patch
 *    - When: Method is called
 *    - Then: Throws error before emitting event
 *
 * 8. Path Outside Grant Root
 *    - Given: requestPatchApproval with path outside grantRoot
 *    - When: Method is called
 *    - Then: Throws error (security violation)
 *
 * 9. Duplicate Approval Notification
 *    - Given: Approval already resolved
 *    - When: notifyApproval called again with same subId
 *    - Then: Throws error (approval not found)
 *
 * 10. Approval Event Emission
 *     - Given: requestCommandApproval called
 *     - When: Event is emitted
 *     - Then: Event contains command, cwd, reason, executionId
 */

/**
 * PROMISE-BASED APPROVAL PATTERN
 *
 * Implementation strategy for replacing Rust oneshot channels:
 *
 * ```typescript
 * // Create Promise with external resolver
 * function createApprovalPromise(): {
 *   promise: Promise<ReviewDecision>,
 *   resolve: (decision: ReviewDecision) => void,
 *   reject: (error: Error) => void
 * } {
 *   let resolve!: (decision: ReviewDecision) => void;
 *   let reject!: (error: Error) => void;
 *
 *   const promise = new Promise<ReviewDecision>((res, rej) => {
 *     resolve = res;
 *     reject = rej;
 *   });
 *
 *   return { promise, resolve, reject };
 * }
 *
 * // In requestCommandApproval:
 * async requestCommandApproval(...): Promise<ReviewDecision> {
 *   const executionId = generateExecutionId();
 *   const { promise, resolve, reject } = createApprovalPromise();
 *
 *   // Store callback
 *   this.activeTurn.registerApproval(executionId, {
 *     executionId,
 *     resolve,
 *     reject,
 *     requestedAt: Date.now(),
 *     context: { type: 'exec_command', command, cwd, reason }
 *   });
 *
 *   // Emit event
 *   await this.emitEvent({
 *     id: generateEventId(),
 *     msg: {
 *       type: 'ExecApprovalRequest',
 *       data: { id: executionId, command: command.join(' '), explanation: reason }
 *     }
 *   });
 *
 *   return promise;
 * }
 *
 * // In notifyApproval:
 * async notifyApproval(subId: string, decision: ReviewDecision) {
 *   const success = this.activeTurn?.resolveApproval(subId, decision);
 *   if (!success) {
 *     throw new Error(`No pending approval found for ${subId}`);
 *   }
 * }
 * ```
 */
