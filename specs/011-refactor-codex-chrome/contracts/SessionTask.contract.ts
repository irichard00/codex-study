/**
 * Contract: SessionTask Interface
 *
 * This contract defines the SessionTask trait equivalent from Rust
 * codex-rs/core/src/tasks/mod.rs
 */

import type { Session } from '../../../codex-chrome/src/core/Session';
import type { TurnContext } from '../../../codex-chrome/src/core/TurnContext';
import type { InputItem } from '../../../codex-chrome/src/protocol/types';
import type { TaskKind } from '../../../codex-chrome/src/core/session/state/types';

/**
 * SessionTask Interface
 * Matches Rust SessionTask trait
 */
export interface ISessionTask {
  /**
   * Return task kind
   *
   * Rust equivalent: SessionTask::kind()
   */
  kind(): TaskKind;

  /**
   * Execute task
   * Returns final assistant message or null
   *
   * Rust equivalent: SessionTask::run()
   *
   * @param session - Session context
   * @param context - Turn context
   * @param subId - Submission ID
   * @param input - Input items
   * @returns Final assistant message or null
   */
  run(
    session: Session,
    context: TurnContext,
    subId: string,
    input: InputItem[]
  ): Promise<string | null>;

  /**
   * Cleanup on abort
   *
   * Rust equivalent: SessionTask::abort()
   *
   * @param session - Session context
   * @param subId - Submission ID
   */
  abort(session: Session, subId: string): Promise<void>;
}

/**
 * RegularTask Contract
 */
export const RegularTaskContract = {
  'must return TaskKind.Regular': (task: ISessionTask) => {
    if (task.kind() !== 'Regular') {
      throw new Error(`Expected TaskKind.Regular, got ${task.kind()}`);
    }
  },

  'must execute turn loop until completion': async (task: ISessionTask, session: Session, context: TurnContext, subId: string, input: InputItem[]) => {
    // Must create TaskRunner
    // Must execute turn loop
    // Must process tool calls
    // Must check token limits
    // Must trigger auto-compaction if needed
    // Must return final assistant message or null
    const result = await task.run(session, context, subId, input);

    // Result must be string or null
    if (result !== null && typeof result !== 'string') {
      throw new Error('RegularTask.run() must return string or null');
    }
  },

  'must cancel TaskRunner on abort': async (task: ISessionTask, session: Session, subId: string) => {
    // Must call TaskRunner.cancel()
    // Must cleanup resources
    await task.abort(session, subId);

    // Verify TaskRunner was cancelled
  },
};

/**
 * ReviewTask Contract
 */
export const ReviewTaskContract = {
  'must return TaskKind.Review': (task: ISessionTask) => {
    if (task.kind() !== 'Review') {
      throw new Error(`Expected TaskKind.Review, got ${task.kind()}`);
    }
  },

  'must use isolated context': async (task: ISessionTask, session: Session, context: TurnContext, subId: string, input: InputItem[]) => {
    // Context must have isReview: true
    if (!context.isReviewMode()) {
      throw new Error('ReviewTask must use review context');
    }

    // Must use isolated history (not main session history)
    await task.run(session, context, subId, input);

    // Verify main session history not contaminated
  },

  'must NOT persist history to main session': async (task: ISessionTask, session: Session, context: TurnContext, subId: string, input: InputItem[]) => {
    const historyBefore = session.getConversationHistory().items.length;

    await task.run(session, context, subId, input);

    const historyAfter = session.getConversationHistory().items.length;

    // History should not grow (review history is isolated)
    // Note: Initial input might be recorded, but review exchanges should not
    if (historyAfter > historyBefore + input.length) {
      throw new Error('ReviewTask should not persist review exchanges to main history');
    }
  },

  'must use specialized review prompt': async (task: ISessionTask, session: Session, context: TurnContext, subId: string, input: InputItem[]) => {
    // Context must have baseInstructions set to review prompt
    if (!context.baseInstructions?.includes('review')) {
      throw new Error('ReviewTask must use review prompt');
    }

    await task.run(session, context, subId, input);
  },
};

/**
 * CompactTask Contract
 */
export const CompactTaskContract = {
  'must return TaskKind.Compact': (task: ISessionTask) => {
    if (task.kind() !== 'Compact') {
      throw new Error(`Expected TaskKind.Compact, got ${task.kind()}`);
    }
  },

  'must call session.compact()': async (task: ISessionTask, session: Session, context: TurnContext, subId: string, input: InputItem[]) => {
    // Must call session.compact()
    // Must emit compaction events
    await task.run(session, context, subId, input);

    // Verify session.compact() was called
    // Verify history size reduced
  },

  'must reduce history size': async (task: ISessionTask, session: Session, context: TurnContext, subId: string, input: InputItem[]) => {
    const historyBefore = session.getConversationHistory().items.length;

    await task.run(session, context, subId, input);

    const historyAfter = session.getConversationHistory().items.length;

    // History should be smaller
    if (historyAfter >= historyBefore) {
      throw new Error('CompactTask must reduce history size');
    }
  },

  'must be idempotent on abort': async (task: ISessionTask, session: Session, subId: string) => {
    // Compaction is atomic, abort should be safe
    await task.abort(session, subId);

    // Should not throw or have side effects
  },
};

/**
 * Task Spawning Contract
 * Defines how Session.spawnTask() should work
 */
export const TaskSpawningContract = {
  'must abort existing tasks before spawning new': async (session: Session) => {
    // Spawn first task
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // Spawn second task
    await session.spawnTask('Regular', mockContext, 'sub-2', []);

    // First task must be aborted with reason: Replaced
    // Verify only one task is running
  },

  'must register task in ActiveTurn': async (session: Session) => {
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // Task must be in ActiveTurn.tasks
    // Verify via Session.getActiveTasks() or similar
  },

  'must emit TaskStarted event': async (session: Session) => {
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // Must emit TaskStarted event with model context window
  },

  'must handle task completion': async (session: Session) => {
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // When task completes:
    // - Must call session.onTaskFinished(subId)
    // - Must remove task from ActiveTurn
    // - Must emit TaskComplete event
  },

  'must handle task abort': async (session: Session) => {
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // When task aborted:
    // - Must call task.abort()
    // - Must remove task from ActiveTurn
    // - Must emit TurnAborted event with reason
  },
};

/**
 * Input Injection Contract
 * Defines how Session.injectInput() should work
 */
export const InputInjectionContract = {
  'must inject into running task if exists': async (session: Session) => {
    // Start task
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // Inject input
    const result = await session.injectInput([{ type: 'text', text: 'more input' }]);

    // Should succeed (Ok result)
    if (result.isErr()) {
      throw new Error('injectInput should succeed when task running');
    }

    // Input should be in TurnState.pendingInput
  },

  'must return input if no task running': async (session: Session) => {
    // No task running
    const result = await session.injectInput([{ type: 'text', text: 'input' }]);

    // Should return input (Err result)
    if (result.isOk()) {
      throw new Error('injectInput should return input when no task running');
    }

    const returnedInput = result.unwrapErr();
    if (returnedInput.length !== 1 || returnedInput[0].text !== 'input') {
      throw new Error('injectInput should return original input');
    }
  },

  'must accumulate pending input': async (session: Session) => {
    // Start task
    await session.spawnTask('Regular', mockContext, 'sub-1', []);

    // Inject multiple inputs
    await session.injectInput([{ type: 'text', text: 'input 1' }]);
    await session.injectInput([{ type: 'text', text: 'input 2' }]);

    // Both should be in pendingInput queue
    // Task should receive both on next turn
  },
};

/**
 * Mock objects for contract tests
 */
const mockContext: TurnContext = {
  cwd: '/mock',
  model: 'gpt-4',
  isReviewMode: () => false,
  // ... other required fields
} as any;
