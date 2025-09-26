/**
 * Main Codex agent class - port of codex.rs Codex struct
 * Preserves the SQ/EQ (Submission Queue/Event Queue) architecture
 */

import type { Submission, Op, Event, ResponseItem, AskForApproval, SandboxPolicy, ReasoningEffortConfig, ReasoningSummaryConfig, ReviewDecision } from '../protocol/types';
import type { EventMsg } from '../protocol/events';
import type { IConfigChangeEvent } from '../config/types';
import { AgentConfig } from '../config/AgentConfig';
import { Session } from './Session';
import { TaskRunner } from './TaskRunner';
import { TurnManager } from './TurnManager';
import { TurnContext } from './TurnContext';
import { AgentTask } from './AgentTask';
import { ApprovalManager } from './ApprovalManager';
import { DiffTracker } from './DiffTracker';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ModelClientFactory } from '../models/ModelClientFactory';
import { UserNotifier } from './UserNotifier';
import { v4 as uuidv4 } from 'uuid';

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
  private activeTask: AgentTask | null = null;
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
    this.session = new Session(this.config);
    this.modelClientFactory = ModelClientFactory.getInstance();
    this.toolRegistry = new ToolRegistry(this.config);
    this.approvalManager = new ApprovalManager(this.config);
    this.diffTracker = new DiffTracker();
    this.userNotifier = new UserNotifier();

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

    // Initialize tool registry with config
    await this.toolRegistry.initialize(this.config);

    // Initialize session
    await this.session.initialize();
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
  private async handleModelConfigChange(event: IConfigChangeEvent): Promise<void> {
    // Update model client factory with new config
    const modelConfig = await this.config.getModelConfig();
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
  private async handleSecurityConfigChange(event: IConfigChangeEvent): Promise<void> {
    const config = await this.config.getConfig();
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

      // Emit TaskComplete event with turn metadata if available
      const history = this.session.getHistory();
      const lastAgentMessage = history
        .filter(h => h.type === 'agent')
        .pop()?.text;

      this.emitEvent({
        type: 'TaskComplete',
        data: {
          last_agent_message: lastAgentMessage,
          turn_id: submission.id,
          input_messages: [], // Will be populated by specific handlers
        },
      });
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

    // Cancel active task if any
    if (this.activeTask) {
      await this.activeTask.cancel();
      this.activeTask = null;
    }

    // Clear interrupt flag after handling
    this.session.clearInterrupt();
  }

  /**
   * Process user input with AgentTask
   * Common method for handling both handleUserInput and handleUserTurn
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
      // Get current running task if exists
      let currentTask = this.activeTask;
      if (newTask) {
        currentTask?.cancel();
        this.activeTask = null;
        currentTask = null;
      }

      // Convert input items to ResponseItem format
      const responseItems: ResponseItem[] = items.map(item => ({
        role: 'user' as const,
        content: item.type === 'text' ? item.text || '' : `[${item.type}]`,
      }));

      if (currentTask) {
        // Inject into existing task
        if (currentTask) {
          await currentTask.injectUserInput(responseItems);
        }
      } else {
        // No running task, spawn a new one
        let taskContext: TurnContext;

        if (contextOverrides) {
          // Create fresh context with overrides for this turn
          const modelClient = await this.modelClientFactory.createClientForModel(contextOverrides.model || 'default');
          taskContext = new TurnContext(modelClient, contextOverrides);

          // Update session turn context with overrides
          this.session.updateTurnContext(contextOverrides);
        } else {
          // Create a new context for this turn
          const modelClient = await this.modelClientFactory.createClientForModel('default');
          taskContext = new TurnContext(modelClient, {});
        }

        // Create TurnManager for this task
        const modelToUse = contextOverrides?.model || taskContext.getModel();
        const modelClient = await this.modelClientFactory.createClientForModel(modelToUse);
        const turnManager = new TurnManager(
          this.session,
          taskContext,
          modelClient
        );

        // Create and run AgentTask - AgentTask will create its own TaskRunner
        const submissionId = uuidv4();
        const agentTask = new AgentTask(
          this.session,
          taskContext,
          turnManager,
          this.session.getId(),
          submissionId,
          responseItems,
          false // not review mode
        );

        this.activeTask = agentTask;

        try {
          const result = await agentTask.run();

          // Extract last assistant message from session history
          const history = this.session.getHistory();
          const lastAgentMessage = history
            .filter(h => h.type === 'agent')
            .pop()?.text;

          // Extract input messages from this turn
          const inputMessages = responseItems
            .filter(item => item.role === 'user')
            .map(item => typeof item.content === 'string' ? item.content : JSON.stringify(item.content));

          // Emit TaskComplete with turn metadata for notification compatibility
          this.emitEvent({
            type: 'TaskComplete',
            data: {
              last_agent_message: lastAgentMessage,
              turn_id: submissionId,
              input_messages: inputMessages,
            },
          });

          this.emitEvent({
            type: 'AgentMessage',
            data: {
              message: 'Task completed successfully.',
            },
          });
        } finally {
          this.activeTask = null;
        }
      }
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
    await this.processUserInputWithTask(op.items);
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
   */
  cancelTask(submissionId: string): void {
    if (this.activeTask && this.activeTask.submissionId === submissionId) {
      this.activeTask.cancel();
      this.activeTask = null;
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
    // For now, just log the approval - proper implementation would integrate with the approval system
    console.log(`Approval ${op.decision === 'approve' ? 'granted' : 'denied'} for ${op.id}`);

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
    // For now, just log the approval - proper implementation would integrate with the diff system
    console.log(`Patch ${op.decision === 'approve' ? 'approved' : 'rejected'} for ${op.id}`);

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
    const history = this.session.getHistory();
    this.emitEvent({
      type: 'ConversationPath',
      data: {
        path: this.session.conversationId,
        messages_count: history.length,
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