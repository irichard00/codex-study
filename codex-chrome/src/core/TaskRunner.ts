/**
 * TaskRunner implementation - ports run_task functionality from codex-rs
 * Manages task execution lifecycle, handles task cancellation, and emits progress events
 * Enhanced with AgentTask integration - contains the majority of task execution logic
 */

import { Session } from './Session';
import { TurnManager } from './TurnManager';
import { TurnContext } from './TurnContext';
import type { ProcessedResponseItem, TurnRunResult } from './TurnManager';
import type { InputItem, Event, ResponseItem } from '../protocol/types';
import type {
  EventMsg,
  TaskCompleteEvent,
  TaskStartedEvent,
  TokenUsage,
  TurnAbortReason,
} from '../protocol/events';

/**
 * Task state for tracking execution
 */
export interface TaskState {
  submissionId: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';
  currentTurnIndex: number;
  tokenUsage: {
    used: number;
    max: number;
  };
  compactionPerformed: boolean;
  abortReason?: TurnAbortReason;
  lastAgentMessage?: string;
  tokenUsageDetail?: {
    total?: TokenUsage;
    last?: TokenUsage;
  };
  lastError?: Error;
}

/**
 * Task execution result
 */
export interface TaskResult {
  success: boolean;
  lastAgentMessage?: string;
  error?: string;
  aborted?: boolean;
}

/**
 * Task execution options
 */
export interface TaskOptions {
  /** Enable review mode for isolated execution */
  reviewMode?: boolean;
  /** Task timeout in milliseconds */
  timeoutMs?: number;
  /** Auto-compact when token limit reached */
  autoCompact?: boolean;
}

interface LoopOutcome {
  lastAgentMessage?: string;
  abortedReason?: TurnAbortReason;
  turnCount: number;
  compactionPerformed: boolean;
  tokenUsage: {
    total?: TokenUsage;
    last?: TokenUsage;
  };
}

interface LoopOutcomeInit {
  turnCount: number;
  compactionPerformed: boolean;
  lastAgentMessage?: string;
  totalTokenUsage?: TokenUsage;
  lastTokenUsage?: TokenUsage;
  abortedReason?: TurnAbortReason;
}

/**
 * TaskRunner handles the execution of a complete task which may involve multiple turns
 * Port of run_task function from codex-rs/core/src/codex.rs
 * Enhanced with AgentTask coordination - maintains the majority of task execution logic
 */
export class TaskRunner {
  private session: Session;
  private turnContext: TurnContext;
  private turnManager: TurnManager;
  private submissionId: string;
  private input: InputItem[];
  private options: TaskOptions;
  private cancelled = false;
  private cancelPromise: Promise<void> | null = null;
  private cancelResolve: (() => void) | null = null;
  private state: TaskState;
  private static readonly MAX_TURNS = 50;
  private static readonly COMPACTION_THRESHOLD = 0.75;

  constructor(
    session: Session,
    turnContext: TurnContext,
    turnManager: TurnManager,
    submissionId: string,
    input: InputItem[],
    options: TaskOptions = {}
  ) {
    this.session = session;
    this.turnContext = turnContext;
    this.turnManager = turnManager;
    this.submissionId = submissionId;
    this.input = input;
    this.options = {
      autoCompact: true,
      ...options,
    };

    // Set up cancellation mechanism
    this.cancelPromise = new Promise<void>((resolve) => {
      this.cancelResolve = resolve;
    });

    const contextWindow = this.turnContext.getModelContextWindow() ?? 100000;
    this.state = {
      submissionId,
      status: 'idle',
      currentTurnIndex: 0,
      tokenUsage: {
        used: 0,
        max: contextWindow,
      },
      compactionPerformed: false,
    };
  }

  /**
   * Cancel the running task
   */
  cancel(): void {
    this.cancelled = true;
    this.turnManager.cancel();
    if (this.cancelResolve) {
      this.cancelResolve();
    }
    this.state.status = 'cancelled';
    this.state.abortReason = 'user_interrupt';
  }

  /**
   * Check if task is cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Run the task - main execution method
   */
  async run(): Promise<TaskResult> {
    return this.executeTask();
  }

  private async executeTask(signal?: AbortSignal): Promise<TaskResult> {
    this.state.status = 'running';
    this.state.abortReason = undefined;
    this.state.compactionPerformed = false;
    this.state.tokenUsage.used = 0;
    this.state.currentTurnIndex = 0;
    this.state.tokenUsageDetail = undefined;
    this.state.lastAgentMessage = undefined;

    await this.emitTaskStarted();

    // Early exit for empty input tasks
    if (this.input.length === 0) {
      this.state.status = 'completed';
      await this.emitTaskComplete({
        lastAgentMessage: undefined,
        compactionPerformed: false,
        turnCount: 0,
        tokenUsage: {},
      });
      return { success: true };
    }

    try {
      const outcome = await this.runLoop(signal);

      this.state.currentTurnIndex = outcome.turnCount;
      this.state.compactionPerformed = outcome.compactionPerformed;
      this.state.lastAgentMessage = outcome.lastAgentMessage;
      this.state.tokenUsageDetail = outcome.tokenUsage;
      this.state.tokenUsage.used = outcome.tokenUsage.total
        ? outcome.tokenUsage.total.total_tokens
        : 0;

      if (outcome.abortedReason) {
        this.state.status = 'cancelled';
        this.state.abortReason = outcome.abortedReason;
        if (outcome.abortedReason === 'automatic_abort') {
          await this.emitBackgroundEvent(
            `Task stopped after reaching the maximum of ${TaskRunner.MAX_TURNS} turns`,
            'warning'
          );
        }
        await this.emitAbortedEvent(outcome.abortedReason);

        return {
          success: false,
          aborted: true,
          lastAgentMessage: outcome.lastAgentMessage,
        };
      }

      await this.emitTaskComplete(outcome);

      this.state.status = 'completed';
      return {
        success: true,
        lastAgentMessage: outcome.lastAgentMessage,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.status = this.cancelled ? 'cancelled' : 'failed';
      this.state.lastError = err;

      if (this.cancelled && !this.state.abortReason) {
        this.state.abortReason = 'user_interrupt';
        await this.emitAbortedEvent('user_interrupt');
      }

      await this.emitErrorEvent(`Task execution failed: ${err.message}`);

      return {
        success: false,
        error: err.message,
      };
    }
  }

  private async runLoop(signal?: AbortSignal): Promise<LoopOutcome> {
    const reviewHistory = this.options.reviewMode
      ? await this.buildInitialReviewContext()
      : undefined;

    if (reviewHistory) {
      reviewHistory.push(...this.convertInputItemsToResponses(this.input));
    } else {
      await this.session.recordInput(this.input);
    }

    let turnCount = 0;
    let lastAgentMessage: string | undefined;
    let compactionPerformed = false;
    let autoCompactAttempted = false;
    let totalTokenUsage: TokenUsage | undefined;
    let lastTokenUsage: TokenUsage | undefined;

    while (!this.cancelled) {
      if (signal?.aborted) {
        this.cancel();
        return this.buildLoopOutcome({
          turnCount,
          compactionPerformed,
          lastAgentMessage,
          totalTokenUsage,
          lastTokenUsage,
          abortedReason: 'user_interrupt',
        });
      }

      if (turnCount >= TaskRunner.MAX_TURNS) {
        return this.buildLoopOutcome({
          turnCount,
          compactionPerformed,
          lastAgentMessage,
          totalTokenUsage,
          lastTokenUsage,
          abortedReason: 'automatic_abort',
        });
      }

      const pendingInput = (await this.session.getPendingInput()) as ResponseItem[];
      const turnInput = this.options.reviewMode
        ? this.buildReviewTurnInput(reviewHistory!, pendingInput)
        : await this.buildNormalTurnInput(pendingInput);

      if (this.cancelled) {
        return this.buildLoopOutcome({
          turnCount,
          compactionPerformed,
          lastAgentMessage,
          totalTokenUsage,
          lastTokenUsage,
          abortedReason: 'user_interrupt',
        });
      }

      try {
        const turnResult = await this.runTurnWithTimeout(turnInput, signal);
        const processResult = await this.processTurnResult(turnResult, reviewHistory);

        lastAgentMessage = processResult.lastAgentMessage ?? lastAgentMessage;
        if (turnResult.totalTokenUsage) {
          totalTokenUsage = this.aggregateTokenUsage(totalTokenUsage, turnResult.totalTokenUsage);
          lastTokenUsage = turnResult.totalTokenUsage;
        }

        turnCount += 1;
        this.state.currentTurnIndex = turnCount;

        if (
          processResult.tokenLimitReached &&
          this.options.autoCompact &&
          !autoCompactAttempted
        ) {
          compactionPerformed = await this.attemptAutoCompact(turnCount, totalTokenUsage);
          autoCompactAttempted = true;
        }

        if (processResult.taskComplete) {
          return this.buildLoopOutcome({
            turnCount,
            compactionPerformed,
            lastAgentMessage,
            totalTokenUsage,
            lastTokenUsage,
          });
        }
      } catch (error) {
        if (this.cancelled || signal?.aborted) {
          if (!this.cancelled) {
            this.cancel();
          }
          return this.buildLoopOutcome({
            turnCount,
            compactionPerformed,
            lastAgentMessage,
            totalTokenUsage,
            lastTokenUsage,
            abortedReason: 'user_interrupt',
          });
        }

        throw error;
      }
    }

    return this.buildLoopOutcome({
      turnCount,
      compactionPerformed,
      lastAgentMessage,
      totalTokenUsage,
      lastTokenUsage,
      abortedReason: 'user_interrupt',
    });
  }

  private buildLoopOutcome(init: LoopOutcomeInit): LoopOutcome {
    return {
      lastAgentMessage: init.lastAgentMessage,
      abortedReason: init.abortedReason,
      turnCount: init.turnCount,
      compactionPerformed: init.compactionPerformed,
      tokenUsage: {
        total: init.totalTokenUsage,
        last: init.lastTokenUsage,
      },
    };
  }

  private aggregateTokenUsage(
    current: TokenUsage | undefined,
    next: TokenUsage
  ): TokenUsage {
    if (!current) {
      return { ...next };
    }

    return {
      input_tokens: current.input_tokens + next.input_tokens,
      cached_input_tokens: current.cached_input_tokens + next.cached_input_tokens,
      output_tokens: current.output_tokens + next.output_tokens,
      reasoning_output_tokens: current.reasoning_output_tokens + next.reasoning_output_tokens,
      total_tokens: current.total_tokens + next.total_tokens,
    };
  }

  private async emitTaskStarted(): Promise<void> {
    const contextWindow = this.turnContext.getModelContextWindow();
    const toolsConfig = this.turnContext.getToolsConfig();
    const enabledTools = Object.entries(toolsConfig)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name)
      .sort();

    const data: TaskStartedEvent = {
      submission_id: this.submissionId,
      model_context_window: contextWindow,
      model: this.turnContext.getModel(),
      cwd: this.turnContext.getCwd(),
      approval_policy: this.turnContext.getApprovalPolicy(),
      sandbox_policy: this.turnContext.getSandboxPolicy(),
      review_mode: Boolean(this.options.reviewMode),
      auto_compact: this.options.autoCompact !== false,
      compaction_threshold: TaskRunner.COMPACTION_THRESHOLD,
      tools: enabledTools,
      tools_config: toolsConfig as Record<string, unknown>,
      timeout_ms: this.options.timeoutMs,
      browser_environment_policy: this.turnContext.getBrowserEnvironmentPolicy(),
    };

    const effort = this.turnContext.getEffort();
    if (effort) {
      data.reasoning_effort = effort;
    }

    const summary = this.turnContext.getSummary();
    if (summary) {
      data.reasoning_summary = summary;
    }

    await this.emitEvent({
      type: 'TaskStarted',
      data,
    });
  }

  private async emitTaskComplete(outcome: LoopOutcome): Promise<void> {
    const data: TaskCompleteEvent = {
      submission_id: this.submissionId,
      last_agent_message: outcome.lastAgentMessage,
      turn_count: outcome.turnCount,
      compaction_performed: outcome.compactionPerformed,
      aborted: false,
    };

    if (outcome.tokenUsage.total || outcome.tokenUsage.last) {
      data.token_usage = {
        total: outcome.tokenUsage.total,
        last_turn: outcome.tokenUsage.last,
      };
    }

    await this.emitEvent({
      type: 'TaskComplete',
      data,
    });
  }

  private async emitErrorEvent(message: string): Promise<void> {
    await this.emitEvent({
      type: 'Error',
      data: { message },
    });
  }

  private async emitBackgroundEvent(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info'
  ): Promise<void> {
    await this.emitEvent({
      type: 'BackgroundEvent',
      data: { message, level },
    });
  }

  /**
   * Run a turn with timeout support
   */
  private async runTurnWithTimeout(turnInput: ResponseItem[], signal?: AbortSignal): Promise<TurnRunResult> {
    const timeout = this.options.timeoutMs;
    const racers: Array<Promise<TurnRunResult>> = [
      this.turnManager.runTurn(turnInput),
    ];

    const cleanups: Array<() => void> = [];

    if (timeout) {
      racers.push(
        new Promise((_, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Turn timeout')), timeout);
          cleanups.push(() => clearTimeout(timeoutId));
        }) as unknown as Promise<TurnRunResult>
      );
    }

    if (this.cancelPromise) {
      racers.push(
        this.cancelPromise.then(() => {
          throw new Error('Task cancelled');
        }) as unknown as Promise<TurnRunResult>
      );
    }

    if (signal) {
      if (signal.aborted) {
        throw new Error('Task cancelled');
      }

      racers.push(
        new Promise((_, reject) => {
          const abortHandler = () => reject(new Error('Task cancelled'));
          signal.addEventListener('abort', abortHandler, { once: true });
          cleanups.push(() => signal.removeEventListener('abort', abortHandler));
        }) as unknown as Promise<TurnRunResult>
      );
    }

    try {
      return await Promise.race(racers);
    } finally {
      cleanups.forEach(cleanup => cleanup());
    }
  }

  /**
   * Build initial review context for review mode
   */
  private async buildInitialReviewContext(): Promise<ResponseItem[]> {
    const contextWindow = this.turnContext.getModelContextWindow();
    const toolsConfig = this.turnContext.getToolsConfig();
    const enabledTools = Object.entries(toolsConfig)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name)
      .sort();

    const sandboxPolicy = this.turnContext.getSandboxPolicy();
    const effort = this.turnContext.getEffort();
    const summary = this.turnContext.getSummary();

    const lines = [
      `Working directory: ${this.turnContext.getCwd()}`,
      `Model: ${this.turnContext.getModel()}`,
      `Context window: ${contextWindow ?? 'unknown'}`,
      `Approval policy: ${this.turnContext.getApprovalPolicy()}`,
      `Sandbox policy: ${JSON.stringify(sandboxPolicy)}`,
      `Browser environment policy: ${this.turnContext.getBrowserEnvironmentPolicy()}`,
      `Review mode: ${this.options.reviewMode ? 'enabled' : 'disabled'}`,
      `Auto-compaction threshold: ${Math.round(TaskRunner.COMPACTION_THRESHOLD * 100)}% of window`,
    ];

    if (enabledTools.length > 0) {
      lines.push(`Tools enabled: ${enabledTools.join(', ')}`);
    }

    if (effort) {
      lines.push(`Reasoning effort: ${effort.effort}`);
    }

    if (summary) {
      lines.push(`Reasoning summary: ${summary.enabled ? 'enabled' : 'disabled'}`);
    }

    if (this.options.timeoutMs) {
      lines.push(`Turn timeout: ${this.options.timeoutMs}ms`);
    }

    return [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: lines.join('\n'),
          },
        ],
      },
    ];
  }

  /**
   * Convert input items to response format
   */
  private convertInputItemsToResponses(items: InputItem[]): ResponseItem[] {
    if (items.length === 0) {
      return [];
    }

    const content = items.map(item => {
      switch (item.type) {
        case 'text':
          return { type: 'text', text: item.text };
        case 'image':
          return { type: 'image', image_url: item.image_url };
        case 'clipboard':
          return { type: 'text', text: item.content || '[clipboard content]' };
        case 'context': {
          const path = item.path ? this.turnContext.resolvePath(item.path) : 'unknown';
          return { type: 'text', text: `[context: ${path}]` };
        }
        default:
          return { type: 'text', text: '[unknown input]' };
      }
    });

    return [
      {
        role: 'user',
        content,
      },
    ];
  }

  /**
   * Build turn input for review mode
   */
  private buildReviewTurnInput(reviewHistory: ResponseItem[], pendingInput: ResponseItem[]): ResponseItem[] {
    if (pendingInput.length > 0) {
      reviewHistory.push(...pendingInput);
    }
    return [...reviewHistory];
  }

  /**
   * Build turn input for normal mode
   */
  private async buildNormalTurnInput(pendingInput: ResponseItem[]): Promise<ResponseItem[]> {
    if (pendingInput.length > 0) {
      await this.session.recordConversationItems(pendingInput);
    }
    const turnInput = await this.session.buildTurnInputWithHistory(pendingInput);
    return turnInput as ResponseItem[];
  }

  /**
   * Process the results of a turn execution
   */
  private async processTurnResult(
    turnResult: TurnRunResult,
    reviewHistory?: ResponseItem[]
  ): Promise<{
    taskComplete: boolean;
    tokenLimitReached: boolean;
    lastAgentMessage?: string;
  }> {
    const { processedItems, totalTokenUsage } = turnResult;

    let taskComplete = true;
    let lastAgentMessage: string | undefined;
    const itemsToRecord: ResponseItem[] = [];

    // Process each response item
    for (const processedItem of processedItems) {
      const { item, response } = processedItem as ProcessedResponseItem;
      const messageItem = item as ResponseItem;

      // Check if this is an assistant message (task completion indicator)
      if (messageItem.role === 'assistant' && !response) {
        lastAgentMessage = this.extractTextContent(messageItem);
        itemsToRecord.push(messageItem);
      }
      // Check if this is a tool call that needs response (task continues)
      else if (response) {
        taskComplete = false;
        itemsToRecord.push(messageItem);
        if (response.role === 'tool') {
          itemsToRecord.push(response as ResponseItem);
        }
      }
    }

    // Record processed items in conversation history
    if (this.options.reviewMode) {
      // Add to isolated review history
      reviewHistory?.push(...itemsToRecord);
    } else {
      // Add to session history
      await this.session.recordConversationItems(itemsToRecord);
    }

    // Check token limits
    const contextWindow = this.turnContext.getModelContextWindow();
    const tokenLimitReached = Boolean(
      totalTokenUsage &&
      contextWindow &&
      totalTokenUsage.total_tokens >= contextWindow * TaskRunner.COMPACTION_THRESHOLD
    );

    return {
      taskComplete,
      tokenLimitReached,
      lastAgentMessage,
    };
  }

  /**
   * Extract text content from a message item
   */
  private extractTextContent(item: ResponseItem): string | undefined {
    if (!item.content) {
      return undefined;
    }

    if (typeof item.content === 'string') {
      return item.content;
    }

    if (Array.isArray(item.content)) {
      return item.content
        .filter((content: any) => content?.type === 'text')
        .map((content: any) => content.text)
        .join(' ');
    }

    return undefined;
  }

  /**
   * Attempt automatic compaction when token limit is reached
   */
  private async attemptAutoCompact(turnIndex: number, usage?: TokenUsage): Promise<boolean> {
    const usageNote = usage ? ` (tokens: ${usage.total_tokens}/${this.state.tokenUsage.max})` : '';

    try {
      await this.session.compact();
      await this.emitBackgroundEvent(
        `Context compacted at turn ${turnIndex}${usageNote}`,
        'info'
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Auto-compact failed:', error);
      await this.emitBackgroundEvent(
        `Context compaction failed at turn ${turnIndex}: ${message}${usageNote}`,
        'warning'
      );
      return false;
    }
  }

  /**
   * Emit an event through the session's event queue
   */
  private async emitEvent(msg: EventMsg): Promise<void> {
    const event: Event = {
      id: this.submissionId,
      msg,
    };
    await this.session.emitEvent(event);
  }

  /**
   * Emit task aborted event
   */
  private async emitAbortedEvent(reason: TurnAbortReason): Promise<void> {
    await this.emitEvent({
      type: 'TurnAborted',
      data: {
        reason,
        submission_id: this.submissionId,
        turn_count: this.state.currentTurnIndex,
      },
    });
  }

  /**
   * Static factory method to create and run a task
   */
  static async runTask(
    session: Session,
    turnContext: TurnContext,
    turnManager: TurnManager,
    submissionId: string,
    input: InputItem[],
    options?: TaskOptions
  ): Promise<TaskResult> {
    const taskRunner = new TaskRunner(
      session,
      turnContext,
      turnManager,
      submissionId,
      input,
      options
    );

    return taskRunner.run();
  }

  /**
   * New method for AgentTask coordination
   * Contains the main task execution logic
   */
  async executeWithCoordination(
    submissionId: string,
    signal: AbortSignal
  ): Promise<void> {
    if (submissionId !== this.submissionId) {
      this.state.submissionId = submissionId;
    }

    const abortHandler = () => this.cancel();
    signal.addEventListener('abort', abortHandler, { once: true });

    try {
      await this.executeTask(signal);
    } finally {
      signal.removeEventListener('abort', abortHandler);
    }
  }

  /**
   * Get task status for a submission
   */
  getTaskStatus(_submissionId: string): TaskState['status'] {
    return this.state.status;
  }

  /**
   * Get current turn index for a submission
   */
  getCurrentTurnIndex(_submissionId: string): number {
    return this.state.currentTurnIndex;
  }

  /**
   * Get token usage for a submission
   */
  getTokenUsage(_submissionId: string): { used: number; max: number; compactionThreshold: number } {
    return {
      used: this.state.tokenUsage.used,
      max: this.state.tokenUsage.max,
      compactionThreshold: TaskRunner.COMPACTION_THRESHOLD,
    };
  }
}
