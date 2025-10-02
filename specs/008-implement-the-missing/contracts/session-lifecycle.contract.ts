/**
 * Session Lifecycle Contracts
 *
 * Defines the interface contracts for Session initialization and lifecycle methods:
 * - new() - Static factory for session creation
 * - initialize() - Service initialization
 * - record_initial_history() - Initial history recording
 */

import type { ConfigureSession, InitialHistory } from '../data-model';
import type { Session } from '../../../../codex-chrome/src/core/Session';
import type { TurnContext } from '../../../../codex-chrome/src/core/TurnContext';
import type { SessionServices } from '../../../../codex-chrome/src/core/session/state/SessionServices';
import type { AgentConfig } from '../../../../codex-chrome/src/config/AgentConfig';

/**
 * SESSION CREATION CONTRACT
 *
 * Static factory method for creating new Session instances with full initialization.
 * Replaces direct constructor usage for production code.
 */
export interface ISessionFactory {
  /**
   * Create a new Session with full initialization
   *
   * @param configure - Session configuration
   * @param config - Agent configuration
   * @param initialHistory - History mode (new/resumed/forked)
   * @param services - Optional pre-initialized services
   * @returns Tuple of [Session instance, initial TurnContext]
   *
   * BEHAVIOR CONTRACT:
   * - MUST initialize RolloutRecorder based on initialHistory mode
   * - MUST setup MCP connection manager if configured
   * - MUST discover default shell configuration
   * - MUST load history metadata if resuming
   * - MUST use parallel async operations for optimization (Promise.all)
   * - MUST return TurnContext populated with defaults from config
   *
   * ERROR HANDLING:
   * - Throws Error if RolloutRecorder initialization fails
   * - Throws Error if configuration is invalid
   * - Throws Error if resumed history cannot be loaded
   *
   * POSTCONDITIONS:
   * - Session.services is fully initialized
   * - Session.sessionState reflects initialHistory
   * - TurnContext has valid cwd, model, and policies
   */
  new(
    configure: ConfigureSession,
    config: AgentConfig,
    initialHistory: InitialHistory,
    services?: SessionServices
  ): Promise<{ session: Session; turnContext: TurnContext }>;
}

/**
 * INITIALIZATION CONTRACT
 *
 * Initialize session services and storage.
 */
export interface ISessionInitialize {
  /**
   * Initialize session with services
   *
   * BEHAVIOR CONTRACT:
   * - MUST create SessionServices if not provided in constructor
   * - MUST initialize RolloutRecorder for persistence
   * - MUST setup event emitters
   * - SHOULD initialize MCP connection manager if configured
   * - MAY defer non-critical service initialization
   *
   * PRECONDITIONS:
   * - Session instance exists
   * - Config is valid (if provided)
   *
   * POSTCONDITIONS:
   * - SessionServices is initialized
   * - RolloutRecorder is ready for persistence
   * - Session is ready to process turns
   *
   * ERROR HANDLING:
   * - Gracefully degrades if RolloutRecorder fails (sets to null)
   * - Logs warnings for non-critical service failures
   * - Only throws on critical failures (e.g., storage unavailable)
   */
  initialize(): Promise<void>;
}

/**
 * INITIAL HISTORY RECORDING CONTRACT
 *
 * Record initial conversation history based on session mode.
 */
export interface IRecordInitialHistory {
  /**
   * Record initial history on session start
   *
   * @param turnContext - Current turn context
   * @param conversationHistory - History mode and data
   *
   * BEHAVIOR CONTRACT (by mode):
   *
   * NEW MODE:
   * - MUST call buildInitialContext() to create system messages
   * - MUST record context to SessionState
   * - MUST persist context to RolloutRecorder
   *
   * RESUMED MODE:
   * - MUST call reconstructHistoryFromRollout() with rollout items
   * - MUST restore SessionState from reconstructed items
   * - MUST NOT persist items again (already in rollout)
   *
   * FORKED MODE:
   * - MUST call reconstructHistoryFromRollout() with rollout items
   * - MUST persist all items to new rollout (fork creates new rollout)
   * - MUST include fork metadata (source conversation ID)
   *
   * PRECONDITIONS:
   * - Session is initialized
   * - RolloutRecorder is ready
   * - conversationHistory is valid for its mode
   *
   * POSTCONDITIONS:
   * - SessionState.historySnapshot() reflects initial history
   * - RolloutRecorder contains appropriate items
   * - Session is ready to accept user input
   *
   * ERROR HANDLING:
   * - Throws Error if reconstruction fails
   * - Throws Error if persistence fails in forked mode
   * - Logs warnings for non-critical issues
   */
  recordInitialHistory(
    turnContext: TurnContext,
    conversationHistory: InitialHistory
  ): Promise<void>;
}

/**
 * INTERNAL SUBMISSION ID CONTRACT
 *
 * Generate unique IDs for internal submissions (e.g., auto-compact).
 */
export interface INextInternalSubId {
  /**
   * Generate next internal submission ID
   *
   * @returns Unique submission ID string
   *
   * BEHAVIOR CONTRACT:
   * - MUST generate unique IDs
   * - MUST use deterministic counter or UUID
   * - MUST prefix with "internal-" or similar identifier
   * - SHOULD be thread-safe (atomic counter in Rust, not needed in JS)
   *
   * EXAMPLE OUTPUT:
   * - "internal-1"
   * - "internal-2"
   * - "internal-abc123" (if using UUID)
   *
   * POSTCONDITIONS:
   * - Each call returns a different ID
   * - IDs are valid submission identifiers
   */
  nextInternalSubId(): string;
}

/**
 * Combined Session Lifecycle Interface
 */
export interface ISessionLifecycle
  extends ISessionFactory,
    ISessionInitialize,
    IRecordInitialHistory,
    INextInternalSubId {}

/**
 * INTEGRATION EXAMPLE
 *
 * ```typescript
 * // Create new session
 * const { session, turnContext } = await Session.new(
 *   {
 *     conversationId: 'conv_123',
 *     instructions: 'You are a helpful assistant',
 *     cwd: '/workspace',
 *     model: 'gpt-4',
 *   },
 *   agentConfig,
 *   { mode: 'new' }
 * );
 *
 * // Resume existing session
 * const rolloutItems = await loadRolloutItems('conv_456');
 * const { session: resumed, turnContext: ctx } = await Session.new(
 *   {
 *     conversationId: 'conv_456',
 *     cwd: '/workspace',
 *   },
 *   agentConfig,
 *   { mode: 'resumed', rolloutItems }
 * );
 *
 * // Fork session
 * const sourceRollout = await loadRolloutItems('conv_789');
 * const { session: forked, turnContext: forkCtx } = await Session.new(
 *   {
 *     conversationId: 'conv_999',
 *     cwd: '/workspace',
 *   },
 *   agentConfig,
 *   {
 *     mode: 'forked',
 *     rolloutItems: sourceRollout,
 *     sourceConversationId: 'conv_789'
 *   }
 * );
 * ```
 */

/**
 * TEST SCENARIOS
 *
 * 1. New Session Creation
 *    - Given: ConfigureSession with new mode
 *    - When: Session.new() is called
 *    - Then: Empty history, system message with cwd, services initialized
 *
 * 2. Resumed Session Creation
 *    - Given: ConfigureSession with resumed mode and rollout items
 *    - When: Session.new() is called
 *    - Then: History reconstructed from rollout, no new persistence
 *
 * 3. Forked Session Creation
 *    - Given: ConfigureSession with forked mode and source rollout
 *    - When: Session.new() is called
 *    - Then: History copied from source, persisted to new rollout
 *
 * 4. Parallel Initialization
 *    - Given: Session.new() with complex config
 *    - When: Multiple async services need initialization
 *    - Then: Services initialize in parallel (Promise.all), not sequential
 *
 * 5. Rollout Persistence Failure
 *    - Given: RolloutRecorder.create() fails
 *    - When: Session.new() attempts initialization
 *    - Then: Error thrown, session not created
 *
 * 6. Internal Submission IDs
 *    - Given: Session needs to generate internal submission
 *    - When: nextInternalSubId() called multiple times
 *    - Then: Each call returns unique ID with "internal-" prefix
 */
