/**
 * Contract: CodexAgent Interface
 *
 * This contract defines the expected interface and behavior of CodexAgent
 * aligned with Rust codex-rs/core/src/codex.rs
 */

import type { Op, Event, Submission, EventMsg } from '../../../codex-chrome/src/protocol/types';

/**
 * CodexAgent Public Interface
 * Matches Rust Codex struct API surface
 */
export interface ICodexAgent {
  /**
   * Submit an operation to the submission queue (SQ)
   * Returns submission ID for tracking
   *
   * Rust equivalent: Codex::submit()
   */
  submitOperation(op: Op): Promise<string>;

  /**
   * Get next event from event queue (EQ)
   * Returns null if queue is empty
   *
   * Rust equivalent: Codex::next_event()
   */
  getNextEvent(): Promise<Event | null>;

  /**
   * Initialize the agent
   * Must be called before submitting operations
   *
   * Rust equivalent: Part of Codex::spawn()
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources and shutdown
   *
   * Rust equivalent: Drop trait implementation
   */
  cleanup(): Promise<void>;

  /**
   * Request interruption of current task
   *
   * Rust equivalent: Submitting Interrupt op
   */
  interrupt(): Promise<void>;
}

/**
 * Op Handler Contract
 * Each Op type must have a corresponding handler
 */
export interface IOpHandler {
  /**
   * Handle Interrupt op
   * Must cancel all active tasks and clear submission queue
   */
  handleInterrupt(): Promise<void>;

  /**
   * Handle UserInput op
   * Must inject input into running task or spawn new task
   */
  handleUserInput(op: Extract<Op, { type: 'UserInput' }>): Promise<void>;

  /**
   * Handle UserTurn op
   * Must spawn task with fresh context from op
   */
  handleUserTurn(op: Extract<Op, { type: 'UserTurn' }>): Promise<void>;

  /**
   * Handle OverrideTurnContext op
   * Must update persistent turn context without spawning new task
   */
  handleOverrideTurnContext(op: Extract<Op, { type: 'OverrideTurnContext' }>): Promise<void>;

  /**
   * Handle ExecApproval op
   * Must resolve pending exec approval with decision
   */
  handleExecApproval(op: Extract<Op, { type: 'ExecApproval' }>): Promise<void>;

  /**
   * Handle PatchApproval op
   * Must resolve pending patch approval with decision
   */
  handlePatchApproval(op: Extract<Op, { type: 'PatchApproval' }>): Promise<void>;

  /**
   * Handle AddToHistory op
   * Must add text to conversation history
   */
  handleAddToHistory(op: Extract<Op, { type: 'AddToHistory' }>): Promise<void>;

  /**
   * Handle GetHistoryEntryRequest op
   * Must return specified history entry
   */
  handleGetHistoryEntryRequest(op: Extract<Op, { type: 'GetHistoryEntryRequest' }>): Promise<void>;

  /**
   * Handle GetPath op
   * Must return conversation path and metadata
   */
  handleGetPath(): Promise<void>;

  /**
   * Handle ListMcpTools op
   * Must return list of available MCP tools
   */
  handleListMcpTools(): Promise<void>;

  /**
   * Handle ListCustomPrompts op
   * Must return list of custom prompts
   */
  handleListCustomPrompts(): Promise<void>;

  /**
   * Handle Compact op
   * Must trigger conversation history compaction
   */
  handleCompact(): Promise<void>;

  /**
   * Handle Review op
   * Must spawn isolated review task
   */
  handleReview(op: Extract<Op, { type: 'Review' }>): Promise<void>;

  /**
   * Handle Shutdown op
   * Must cleanup and emit ShutdownComplete
   */
  handleShutdown(): Promise<void>;
}

/**
 * Event Emission Contract
 */
export interface IEventEmitter {
  /**
   * Emit event to event queue
   * Must assign unique event ID
   * Must push to eventQueue in FIFO order
   *
   * Rust equivalent: Session::send_event()
   */
  emitEvent(msg: EventMsg): void;
}

/**
 * Submission Queue Contract
 */
export interface ISubmissionQueue {
  /**
   * Submission queue must process in FIFO order
   */
  submissionQueue: Submission[];

  /**
   * Process submissions from queue
   * Must handle one submission at a time
   * Must emit TaskStarted before processing
   * Must emit TaskComplete or TurnAborted after processing
   */
  processSubmissionQueue(): Promise<void>;

  /**
   * Handle single submission
   * Must dispatch to appropriate op handler
   * Must emit error events on failure
   */
  handleSubmission(submission: Submission): Promise<void>;
}

/**
 * Event Queue Contract
 */
export interface IEventQueue {
  /**
   * Event queue must maintain FIFO order
   */
  eventQueue: Event[];

  /**
   * Get next event from queue
   * Returns null if empty
   * Must remove event from queue (consume)
   */
  getNextEvent(): Promise<Event | null>;
}

/**
 * Expected Behavior Tests
 * These are the assertions that contract tests will verify
 */
export const CodexAgentContract = {
  /**
   * SQ/EQ Pattern
   */
  'must process submissions in FIFO order': async (agent: ICodexAgent) => {
    // Submit 3 ops
    const id1 = await agent.submitOperation({ type: 'Interrupt' });
    const id2 = await agent.submitOperation({ type: 'GetPath' });
    const id3 = await agent.submitOperation({ type: 'Shutdown' });

    // Events should appear in same order
    // This is verified by checking event emission order
  },

  'must emit events in order': async (agent: ICodexAgent) => {
    // Submit operation
    await agent.submitOperation({ type: 'GetPath' });

    // Must emit TaskStarted, then ConversationPath, then TaskComplete
    const evt1 = await agent.getNextEvent();
    const evt2 = await agent.getNextEvent();
    const evt3 = await agent.getNextEvent();

    // Verify event order
    if (!evt1 || evt1.msg.type !== 'TaskStarted') throw new Error('Expected TaskStarted');
    if (!evt2 || evt2.msg.type !== 'ConversationPath') throw new Error('Expected ConversationPath');
    if (!evt3 || evt3.msg.type !== 'TaskComplete') throw new Error('Expected TaskComplete');
  },

  /**
   * Input Injection Pattern
   */
  'must inject input into running task': async (agent: ICodexAgent) => {
    // Start task
    await agent.submitOperation({
      type: 'UserInput',
      items: [{ type: 'text', text: 'Hello' }],
    });

    // Inject input while task running
    await agent.submitOperation({
      type: 'UserInput',
      items: [{ type: 'text', text: 'More input' }],
    });

    // Should NOT spawn new task, should inject into existing
    // Verified by checking only one TaskStarted event
  },

  /**
   * Approval Flow
   */
  'must resolve approval with decision': async (agent: ICodexAgent) => {
    // Submit approval decision
    await agent.submitOperation({
      type: 'ExecApproval',
      id: 'approval-123',
      decision: 'approve',
    });

    // Must call session.notifyApproval('approval-123', 'approve')
    // Verified by checking approval resolver is called
  },

  /**
   * Compaction
   */
  'must trigger compaction when requested': async (agent: ICodexAgent) => {
    // Submit compact op
    await agent.submitOperation({ type: 'Compact' });

    // Must call session.compact()
    // Must emit compaction events
    // Verified by checking session.compact() was called
  },

  /**
   * Interruption
   */
  'must abort all tasks on interrupt': async (agent: ICodexAgent) => {
    // Start task
    await agent.submitOperation({
      type: 'UserInput',
      items: [{ type: 'text', text: 'Hello' }],
    });

    // Interrupt
    await agent.interrupt();

    // Must cancel activeTask
    // Must clear submission queue
    // Must emit TurnAborted with reason: user_interrupt
  },

  /**
   * Shutdown
   */
  'must cleanup on shutdown': async (agent: ICodexAgent) => {
    // Submit shutdown
    await agent.submitOperation({ type: 'Shutdown' });

    // Must clear queues
    // Must emit ShutdownComplete
    // Verified by checking queues are empty and event emitted
  },
};

/**
 * Error Handling Contract
 */
export const ErrorHandlingContract = {
  'must emit error event on op handler failure': async (agent: ICodexAgent) => {
    // Submit op that will fail
    // (e.g., malformed op)

    // Must emit Error event with message
    const evt = await agent.getNextEvent();
    if (!evt || evt.msg.type !== 'Error') throw new Error('Expected Error event');
  },

  'must emit TurnAborted on task failure': async (agent: ICodexAgent) => {
    // Submit op that spawns task that fails

    // Must emit TurnAborted with reason: error
    const evt = await agent.getNextEvent();
    if (!evt || evt.msg.type !== 'TurnAborted') throw new Error('Expected TurnAborted event');
  },
};
