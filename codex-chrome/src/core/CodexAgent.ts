/**
 * Main Codex agent class - port of codex.rs Codex struct
 * Preserves the SQ/EQ (Submission Queue/Event Queue) architecture
 */

import type { Submission, Op, Event, InputItem, AskForApproval, SandboxPolicy, ReasoningEffortConfig, ReasoningSummaryConfig, ReviewDecision } from '../protocol/types';
import type { EventMsg } from '../protocol/events';
import type { IConfigChangeEvent } from '../config/types';
import { AgentConfig } from '../config/AgentConfig';
import { Session } from './Session';
import { TurnContext } from './TurnContext';
import { ApprovalManager } from './ApprovalManager';
import { DiffTracker } from './DiffTracker';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ModelClientFactory } from '../models/ModelClientFactory';
import { UserNotifier } from './UserNotifier';
import { v4 as uuidv4 } from 'uuid';
import { loadPrompt, loadUserInstructions } from './PromptLoader';
import { RegularTask } from './tasks/RegularTask';

/**
 * Main agent class managing the submission and event queues
 * Enhanced with AgentTask integration for coordinated task execution
 */
export class CodexAgent {
  private nextId: number = 1;
  private submissionQueue: Submission[] = [];
  private eventQueue: Event[] = [];
  private session: Session;
  private isProcessing: boolean = false;
  private config: AgentConfig;
  private approvalManager: ApprovalManager;
  private diffTracker: DiffTracker;
  private toolRegistry: ToolRegistry;
  private modelClientFactory: ModelClientFactory;
  private userNotifier: UserNotifier;

  constructor(config?: AgentConfig) {
    // Use provided config or get singleton instance
    this.config = config || AgentConfig.getInstance();

    // Initialize components with config
    this.modelClientFactory = ModelClientFactory.getInstance();
    this.toolRegistry = new ToolRegistry();
    this.approvalManager = new ApprovalManager(this.config);
    this.diffTracker = new DiffTracker();
    this.userNotifier = new UserNotifier();

    // Initialize session with config and toolRegistry
    this.session = new Session(this.config, true, undefined, this.toolRegistry);
    // Wire up session event emitter to CodexAgent's event queue
    this.session.setEventEmitter(async (event: Event) => this.emitEvent(event.msg));

    // Setup event processing for notifications
    this.setupNotificationHandlers();

    // Subscribe to config changes
    this.setupConfigSubscriptions();
  }

  /**
   * Initialize the agent (ensures config is loaded)
   */
  async initialize(): Promise<void> {
    await this.config.initialize();

    // Initialize model client factory with config
    await this.modelClientFactory.initialize(this.config);

    // Create model client for the session
    const modelClient = await this.modelClientFactory.createClientForModel('default');

    // Create TurnContext with ModelClient
    const turnContext = new TurnContext(modelClient, {});

    const userInstructions = await loadUserInstructions();
    turnContext.setUserInstructions(userInstructions);
    const baseInstructions = await loadPrompt();
    turnContext.setBaseInstructions(baseInstructions);

    // Set the turn context on the session
    this.session.setTurnContext(turnContext);
  }

  /**
   * Setup config change subscriptions
   */
  private setupConfigSubscriptions(): void {
    // Subscribe to model config changes
    this.config.on('config-changed', (event: IConfigChangeEvent) => {
      if (event.section === 'model') {
        this.handleModelConfigChange(event);
      } else if (event.section === 'security') {
        this.handleSecurityConfigChange(event);
      }
    });
  }

  /**
   * Handle model configuration changes
   */
  private handleModelConfigChange(event: IConfigChangeEvent): void {
    // Update model client factory with new config
    const modelConfig = this.config.getModelConfig();
    console.log('Model configuration changed:', modelConfig.selected);

    // Emit event for UI update
    this.emitEvent({
      type: 'ConfigUpdate',
      data: {
        section: 'model',
        config: modelConfig
      }
    });
  }

  /**
   * Handle security configuration changes
   */
  private handleSecurityConfigChange(event: IConfigChangeEvent): void {
    const config = this.config.getConfig();
    console.log('Security configuration changed:', config.security?.approvalPolicy);

    // Update approval manager policies
    // ApprovalManager will handle its own config updates via its subscription

    // Emit event for UI update
    this.emitEvent({
      type: 'ConfigUpdate',
      data: {
        section: 'security',
        config: config.security
      }
    });
  }

  /**
   * Submit an operation to the agent
   * Returns the submission ID
   */
  async submitOperation(op: Op): Promise<string> {
    const id = `sub_${this.nextId++}`;
    const submission: Submission = { id, op };

    this.submissionQueue.push(submission);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processSubmissionQueue();
    }

    return id;
  }

  /**
   * Get the next event from the event queue
   */
  async getNextEvent(): Promise<Event | null> {
    return this.eventQueue.shift() || null;
  }

  /**
   * Process submissions from the queue
   */
  private async processSubmissionQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.submissionQueue.length > 0) {
      const submission = this.submissionQueue.shift()!;

      try {
        await this.handleSubmission(submission);
      } catch (error) {
        this.emitEvent({
          type: 'Error',
          data: {
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          },
        });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Handle a single submission
   */
  private async handleSubmission(submission: Submission): Promise<void> {
    // Emit TaskStarted event
    this.emitEvent({
      type: 'TaskStarted',
      data: {
        model_context_window: undefined, // Will be set when model is connected
      },
    });

    try {
      switch (submission.op.type) {
        case 'Interrupt':
          await this.handleInterrupt();
          break;

        case 'UserInput':
          await this.handleUserInput(submission.op);
          break;

        case 'UserTurn':
          await this.handleUserTurn(submission.op);
          break;

        case 'OverrideTurnContext':
          await this.handleOverrideTurnContext(submission.op);
          break;

        case 'ExecApproval':
          await this.handleExecApproval(submission.op);
          break;

        case 'PatchApproval':
          await this.handlePatchApproval(submission.op);
          break;

        case 'AddToHistory':
          await this.handleAddToHistory(submission.op);
          break;

        case 'GetPath':
          await this.handleGetPath();
          break;

        case 'Compact':
          await this.handleCompact();
          break;

        case 'GetHistoryEntryRequest':
          await this.handleGetHistoryEntryRequest(submission.op);
          break;

        case 'Shutdown':
          await this.handleShutdown();
          break;

        default:
          // Handle other op types
          this.emitEvent({
            type: 'AgentMessage',
            data: {
              message: `Operation type ${(submission.op as any).type} not yet implemented`,
            },
          });
      }
    } catch (error) {
      // Emit TurnAborted event on error
      this.emitEvent({
        type: 'TurnAborted',
        data: {
          reason: 'error',
          submission_id: submission.id,
        },
      });
      throw error;
    }
  }

  /**
   * Handle interrupt operation
   * Updated (Feature 012): Delegate to Session.abortAllTasks()
   */
  private async handleInterrupt(): Promise<void> {
    // Set interrupt flag in session
    this.session.requestInterrupt();

    // Clear the submission queue
    this.submissionQueue = [];

    // Notify user about interruption
    await this.userNotifier.notifyWarning(
      'Task Interrupted',
      'The current task has been interrupted by user request'
    );

    this.emitEvent({
      type: 'TurnAborted',
      data: {
        reason: 'user_interrupt',
      },
    });

    // Delegate to Session.abortAllTasks() (Feature 012: Session task management)
    // Session will abort all tasks and emit TurnAborted events
    await this.session.abortAllTasks('UserInterrupt');

    // Clear interrupt flag after handling
    this.session.clearInterrupt();
  }

  /**
   * Process user input with SessionTask
   * Common method for handling both handleUserInput and handleUserTurn
   * Updated (Feature 012): Use RegularTask and delegate to Session.spawnTask()
   */
  private async processUserInputWithTask(
    items: Array<any>,
    contextOverrides?: {
      cwd?: string;
      approval_policy?: AskForApproval;
      sandbox_policy?: SandboxPolicy;
      model?: string;
      effort?: ReasoningEffortConfig;
      summary?: ReasoningSummaryConfig;
      final_output_json_schema?: any;
    },
    newTask: boolean = false
  ): Promise<void> {
    try {
      // Convert input items to InputItem format for SessionTask
      const inputItems: InputItem[] = items.map(item => ({
        type: item.type || 'text',
        text: item.type === 'text' ? item.text || '' : undefined,
      }));

      // Use the session's existing turn context
      let taskContext = this.session.getTurnContext();

      // Apply context overrides to session's turn context if provided
      if (contextOverrides) {
        // Create fresh context with overrides for this turn
        const modelClient = await this.modelClientFactory.createClientForModel(contextOverrides.model || 'default');
        taskContext = new TurnContext(modelClient, contextOverrides);

        // Update session turn context with overrides
        this.session.updateTurnContext(contextOverrides);
      }

      // Create RegularTask instance (Feature 011 architecture)
      // RegularTask will delegate to AgentTask → TaskRunner
      const task = new RegularTask();

      // Generate submission ID
      const submissionId = uuidv4();

      // Delegate to Session.spawnTask() (Feature 012: Session task management)
      // Session will manage task lifecycle, emit events, and handle abortion
      await this.session.spawnTask(task, taskContext, submissionId, inputItems);

      // Note: Session.spawnTask() is fire-and-forget
      // Task completion/abortion events are emitted by Session via eventEmitter
      // We don't need to wait for completion or manually manage activeTask

    } catch (error) {
      console.error('Error processing user input:', error);

      this.emitEvent({
        type: 'Error',
        data: {
          message: error instanceof Error ? error.message : 'Unknown error occurred during task execution',
        },
      });

      throw error;
    }
  }

  /**
   * Handle user input
   * Uses the current persistent TurnContext
   */
  private async handleUserInput(op: Extract<Op, { type: 'UserInput' }>): Promise<void> {
    this.session.addPendingInput(op.items);
    await this.processUserInputWithTask(op.items, undefined, true);
  }

  /**
   * Handle user turn with full context using AgentTask
   * Allows per-turn overrides of the context
   */
  private async handleUserTurn(op: Extract<Op, { type: 'UserTurn' }>): Promise<void> {
    await this.processUserInputWithTask(op.items, {
      cwd: op.cwd,
      approval_policy: op.approval_policy,
      sandbox_policy: op.sandbox_policy,
      model: op.model,
      effort: op.effort,
      summary: op.summary,
    });
  }

  /**
   * Cancel a running task
   * Updated (Feature 012): Use Session.abortAllTasks()
   */
  async cancelTask(submissionId: string): Promise<void> {
    // Check if task is running in Session
    if (this.session.hasRunningTask(submissionId)) {
      // Abort the specific task (currently aborts all tasks)
      // Note: Rust pattern is to abort all tasks, not individual ones
      await this.session.abortAllTasks('UserInterrupt');
    }
  }

  /**
   * Handle override turn context
   */
  private async handleOverrideTurnContext(
    op: Extract<Op, { type: 'OverrideTurnContext' }>
  ): Promise<void> {
    // Partial update of turn context
    const updates: any = {};

    if (op.cwd !== undefined) updates.cwd = op.cwd;
    if (op.approval_policy !== undefined) updates.approval_policy = op.approval_policy;
    if (op.sandbox_policy !== undefined) updates.sandbox_policy = op.sandbox_policy;
    if (op.model !== undefined) updates.model = op.model;
    if (op.effort !== undefined) updates.effort = op.effort;
    if (op.summary !== undefined) updates.summary = op.summary;

    this.session.updateTurnContext(updates);
  }

  /**
   * Handle exec approval
   */
  private async handleExecApproval(op: Extract<Op, { type: 'ExecApproval' }>): Promise<void> {
    // Resolve the pending approval through Session
    await this.session.notifyApproval(op.id, op.decision);

    // Emit event
    this.emitEvent({
      type: 'BackgroundEvent',
      data: {
        message: `Execution ${op.decision === 'approve' ? 'approved' : 'rejected'}: ${op.id}`,
        level: 'info',
      },
    });
  }

  /**
   * Handle patch approval
   */
  private async handlePatchApproval(op: Extract<Op, { type: 'PatchApproval' }>): Promise<void> {
    // Resolve the pending approval through Session
    await this.session.notifyApproval(op.id, op.decision);

    // Emit event
    this.emitEvent({
      type: 'BackgroundEvent',
      data: {
        message: `Patch ${op.decision === 'approve' ? 'approved' : 'rejected'}: ${op.id}`,
        level: 'info',
      },
    });
  }

  /**
   * Handle add to history
   */
  private async handleAddToHistory(op: Extract<Op, { type: 'AddToHistory' }>): Promise<void> {
    this.session.addToHistory({
      timestamp: Date.now(),
      text: op.text,
      type: 'user',
    });
  }

  /**
   * Handle get path request
   */
  private async handleGetPath(): Promise<void> {
    const conversationHistory = this.session.getConversationHistory();
    this.emitEvent({
      type: 'ConversationPath',
      data: {
        path: this.session.conversationId,
        messages_count: conversationHistory.items.length,
      },
    });
  }

  /**
   * Handle shutdown
   */
  private async handleShutdown(): Promise<void> {
    // Clean up and emit shutdown complete
    this.submissionQueue = [];
    this.eventQueue = [];

    this.emitEvent({
      type: 'ShutdownComplete',
    });
  }

  /**
   * Handle compact operation
   * Triggers conversation history compaction to reduce token usage
   */
  private async handleCompact(): Promise<void> {
    try {
      // Emit background event indicating compaction started
      this.emitEvent({
        type: 'BackgroundEvent',
        data: {
          message: 'History compaction started',
          level: 'info',
        },
      });

      // Get history size before compaction
      const historyBefore = this.session.getConversationHistory().items.length;

      // Perform compaction
      await this.session.compact();

      // Get history size after compaction
      const historyAfter = this.session.getConversationHistory().items.length;

      // Emit background event indicating compaction completed
      this.emitEvent({
        type: 'BackgroundEvent',
        data: {
          message: `History compaction completed: ${historyBefore} → ${historyAfter} items`,
          level: 'info',
        },
      });
    } catch (error) {
      this.emitEvent({
        type: 'Error',
        data: {
          message: `History compaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
      throw error;
    }
  }

  /**
   * Handle get history entry request
   * Returns a specific entry from the conversation history
   */
  private async handleGetHistoryEntryRequest(
    op: Extract<Op, { type: 'GetHistoryEntryRequest' }>
  ): Promise<void> {
    try {
      const entry = this.session.getHistoryEntry(op.index);

      if (entry) {
        // Emit event with the history entry
        this.emitEvent({
          type: 'BackgroundEvent',
          data: {
            message: `History entry ${op.index}: ${JSON.stringify(entry).substring(0, 100)}...`,
            level: 'info',
          },
        });
      } else {
        // Emit error if entry not found
        this.emitEvent({
          type: 'Error',
          data: {
            message: `History entry ${op.index} not found`,
          },
        });
      }
    } catch (error) {
      this.emitEvent({
        type: 'Error',
        data: {
          message: `Failed to get history entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
      throw error;
    }
  }

  /**
   * Emit an event to the event queue
   */
  private emitEvent(msg: EventMsg): void {
    const event: Event = {
      id: `evt_${this.nextId++}`,
      msg,
    };

    this.eventQueue.push(event);

    // Process event for user notifications
    this.userNotifier.processEvent(event);

    // Notify listeners via Chrome runtime if available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'EVENT',
        payload: event,
      }).catch(() => {
        // Ignore errors if no listeners
      });
    }
  }

  /**
   * Get the current session
   */
  getSession(): Session {
    return this.session;
  }


  /**
   * Get the tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the approval manager
   */
  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }

  /**
   * Get the diff tracker
   */
  getDiffTracker(): DiffTracker {
    return this.diffTracker;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.toolRegistry.clear();
    this.submissionQueue = [];
    this.eventQueue = [];
    await this.userNotifier.clearAll();
  }

  /**
   * Setup notification handlers
   */
  private setupNotificationHandlers(): void {
    // Register notification callback for UI updates
    this.userNotifier.onNotification((notification) => {
      // Emit notification event for UI
      this.emitEvent({
        type: 'Notification',
        data: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          timestamp: notification.timestamp,
        },
      });
    });
  }

  /**
   * Handle approval decision
   */
  private async handleApprovalDecision(
    approvalId: string,
    decision: 'approve' | 'reject'
  ): Promise<void> {
    // Process the approval decision
    const pendingApproval = this.approvalManager.getApproval(approvalId);
    if (!pendingApproval) return;

    const approval = pendingApproval.request;

    // Submit the decision as an operation based on approval type
    const reviewDecision: ReviewDecision = decision === 'approve'
      ? 'approve'
      : 'reject';

    const op: Op = approval.type === 'command'
      ? {
          type: 'ExecApproval',
          id: approvalId,
          decision: reviewDecision,
        }
      : {
          type: 'PatchApproval',
          id: approvalId,
          decision: reviewDecision,
        };

    await this.submitOperation(op);
  }

  /**
   * Get user notifier
   */
  getUserNotifier(): UserNotifier {
    return this.userNotifier;
  }

  /**
   * Handle interruption
   */
  async interrupt(): Promise<void> {
    // Request interrupt on session
    this.session.requestInterrupt();

    // Notify user
    await this.userNotifier.notifyInfo(
      'Interruption Requested',
      'The current task will be interrupted'
    );

    // Submit interrupt operation
    await this.submitOperation({ type: 'Interrupt' });
  }

  /**
   * Show progress notification
   */
  async showProgress(
    title: string,
    message: string,
    current: number,
    total: number
  ): Promise<string> {
    return this.userNotifier.notifyProgress(title, message, current, total);
  }

  /**
   * Update progress notification
   */
  async updateProgress(
    notificationId: string,
    current: number,
    total: number
  ): Promise<void> {
    await this.userNotifier.updateProgress(notificationId, current, total);
  }
}