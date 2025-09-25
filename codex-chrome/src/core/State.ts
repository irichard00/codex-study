/**
 * State management class - port of State struct from codex-rs
 * Manages session state including conversation history, turn context, and execution state
 */

import type { InputItem, AskForApproval, SandboxPolicy, ReasoningEffortConfig, ReasoningSummaryConfig } from '../protocol/types';
import type { HistoryEntry } from '../protocol/events';

/**
 * Execution state of the session
 */
export type ExecutionState =
  | 'idle'           // Waiting for input
  | 'processing'     // Processing a submission
  | 'executing'      // Executing a task
  | 'waiting'        // Waiting for approval
  | 'interrupted'    // Interrupted by user
  | 'error';         // Error state

/**
 * Turn state information
 */
export interface TurnState {
  turnNumber: number;
  startTime: number;
  endTime?: number;
  tokenCount: number;
  toolCallCount: number;
  interrupted: boolean;
}

/**
 * State class managing the internal state of a session
 * Based on codex-rs State struct
 */
export class State {
  // Execution state
  private executionState: ExecutionState = 'idle';

  // Conversation history
  private history: HistoryEntry[] = [];

  // Current turn state
  private currentTurn: TurnState | null = null;

  // Turn history
  private turnHistory: TurnState[] = [];

  // Token usage tracking
  private totalTokensUsed: number = 0;
  private tokenLimit: number = 100000; // Default limit

  // Tool usage statistics
  private toolUsageStats: Map<string, number> = new Map();

  // Error history
  private errorHistory: Array<{
    timestamp: number;
    error: string;
    context?: any;
  }> = [];

  // Interrupt flag
  private interruptRequested: boolean = false;

  // Rollout state (for turn replaying)
  private rolloutHistory: any[] = [];

  // Last activity timestamp
  private lastActivityTime: number = Date.now();

  // Session metadata
  private sessionStartTime: number = Date.now();
  private sessionId: string;

  // Model state
  private currentModel: string = 'claude-3-sonnet';

  // Approval state
  private pendingApprovals: Map<string, any> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Get current execution state
   */
  getExecutionState(): ExecutionState {
    return this.executionState;
  }

  /**
   * Set execution state
   */
  setExecutionState(state: ExecutionState): void {
    this.executionState = state;
    this.lastActivityTime = Date.now();
  }

  /**
   * Start a new turn
   */
  startTurn(): void {
    if (this.currentTurn) {
      this.endTurn();
    }

    this.currentTurn = {
      turnNumber: this.turnHistory.length + 1,
      startTime: Date.now(),
      tokenCount: 0,
      toolCallCount: 0,
      interrupted: false,
    };

    this.setExecutionState('processing');
  }

  /**
   * End the current turn
   */
  endTurn(): void {
    if (this.currentTurn) {
      this.currentTurn.endTime = Date.now();
      this.turnHistory.push({ ...this.currentTurn });
      this.currentTurn = null;
    }

    this.setExecutionState('idle');
  }

  /**
   * Add to conversation history
   */
  addToHistory(entry: HistoryEntry): void {
    this.history.push(entry);
    this.lastActivityTime = Date.now();
  }

  /**
   * Get conversation history
   */
  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.history = [];
    this.turnHistory = [];
    this.totalTokensUsed = 0;
    this.toolUsageStats.clear();
    this.errorHistory = [];
  }

  /**
   * Track token usage
   */
  addTokenUsage(tokens: number): void {
    this.totalTokensUsed += tokens;

    if (this.currentTurn) {
      this.currentTurn.tokenCount += tokens;
    }
  }

  /**
   * Get total tokens used
   */
  getTotalTokensUsed(): number {
    return this.totalTokensUsed;
  }

  /**
   * Check if token limit exceeded
   */
  isTokenLimitExceeded(): boolean {
    return this.totalTokensUsed >= this.tokenLimit;
  }

  /**
   * Set token limit
   */
  setTokenLimit(limit: number): void {
    this.tokenLimit = limit;
  }

  /**
   * Track tool usage
   */
  trackToolUsage(toolName: string): void {
    const current = this.toolUsageStats.get(toolName) || 0;
    this.toolUsageStats.set(toolName, current + 1);

    if (this.currentTurn) {
      this.currentTurn.toolCallCount++;
    }
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats(): Map<string, number> {
    return new Map(this.toolUsageStats);
  }

  /**
   * Add error to history
   */
  addError(error: string, context?: any): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      error,
      context,
    });

    this.setExecutionState('error');
  }

  /**
   * Get error history
   */
  getErrorHistory(): Array<{ timestamp: number; error: string; context?: any }> {
    return [...this.errorHistory];
  }

  /**
   * Request interrupt
   */
  requestInterrupt(): void {
    this.interruptRequested = true;

    if (this.currentTurn) {
      this.currentTurn.interrupted = true;
    }
  }

  /**
   * Check if interrupt requested
   */
  isInterruptRequested(): boolean {
    return this.interruptRequested;
  }

  /**
   * Clear interrupt flag
   */
  clearInterrupt(): void {
    this.interruptRequested = false;
  }

  /**
   * Add to rollout history (for turn replaying)
   */
  addToRollout(item: any): void {
    this.rolloutHistory.push({
      ...item,
      timestamp: Date.now(),
    });
  }

  /**
   * Get rollout history
   */
  getRolloutHistory(): any[] {
    return [...this.rolloutHistory];
  }

  /**
   * Clear rollout history
   */
  clearRollout(): void {
    this.rolloutHistory = [];
  }

  /**
   * Get session statistics
   */
  getStatistics(): {
    sessionId: string;
    startTime: number;
    lastActivity: number;
    totalTurns: number;
    totalTokens: number;
    totalToolCalls: number;
    totalErrors: number;
    averageTurnDuration: number;
    toolUsage: Record<string, number>;
  } {
    const totalToolCalls = this.turnHistory.reduce(
      (sum, turn) => sum + turn.toolCallCount,
      0
    );

    const turnDurations = this.turnHistory
      .filter(turn => turn.endTime)
      .map(turn => (turn.endTime! - turn.startTime));

    const averageTurnDuration = turnDurations.length > 0
      ? turnDurations.reduce((sum, dur) => sum + dur, 0) / turnDurations.length
      : 0;

    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      lastActivity: this.lastActivityTime,
      totalTurns: this.turnHistory.length,
      totalTokens: this.totalTokensUsed,
      totalToolCalls,
      totalErrors: this.errorHistory.length,
      averageTurnDuration,
      toolUsage: Object.fromEntries(this.toolUsageStats),
    };
  }

  /**
   * Export state for persistence
   */
  export(): any {
    return {
      sessionId: this.sessionId,
      executionState: this.executionState,
      history: [...this.history],
      turnHistory: [...this.turnHistory],
      totalTokensUsed: this.totalTokensUsed,
      tokenLimit: this.tokenLimit,
      toolUsageStats: Object.fromEntries(this.toolUsageStats),
      errorHistory: [...this.errorHistory],
      rolloutHistory: [...this.rolloutHistory],
      sessionStartTime: this.sessionStartTime,
      lastActivityTime: this.lastActivityTime,
      currentModel: this.currentModel,
    };
  }

  /**
   * Import state from persistence
   */
  static import(data: any): State {
    const state = new State(data.sessionId);

    state.executionState = data.executionState || 'idle';
    state.history = data.history || [];
    state.turnHistory = data.turnHistory || [];
    state.totalTokensUsed = data.totalTokensUsed || 0;
    state.tokenLimit = data.tokenLimit || 100000;
    state.toolUsageStats = new Map(Object.entries(data.toolUsageStats || {}));
    state.errorHistory = data.errorHistory || [];
    state.rolloutHistory = data.rolloutHistory || [];
    state.sessionStartTime = data.sessionStartTime || Date.now();
    state.lastActivityTime = data.lastActivityTime || Date.now();
    state.currentModel = data.currentModel || 'claude-3-sonnet';

    return state;
  }

  /**
   * Set current model
   */
  setCurrentModel(model: string): void {
    this.currentModel = model;
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Add pending approval
   */
  addPendingApproval(id: string, approval: any): void {
    this.pendingApprovals.set(id, approval);
    this.setExecutionState('waiting');
  }

  /**
   * Get pending approval
   */
  getPendingApproval(id: string): any {
    return this.pendingApprovals.get(id);
  }

  /**
   * Remove pending approval
   */
  removePendingApproval(id: string): void {
    this.pendingApprovals.delete(id);

    if (this.pendingApprovals.size === 0 && this.executionState === 'waiting') {
      this.setExecutionState('idle');
    }
  }

  /**
   * Has pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): Map<string, any> {
    return new Map(this.pendingApprovals);
  }

  /**
   * Check if session is idle
   */
  isIdle(): boolean {
    return this.executionState === 'idle';
  }

  /**
   * Check if session is processing
   */
  isProcessing(): boolean {
    return this.executionState === 'processing' || this.executionState === 'executing';
  }

  /**
   * Get current turn information
   */
  getCurrentTurn(): TurnState | null {
    return this.currentTurn ? { ...this.currentTurn } : null;
  }

  /**
   * Get turn history
   */
  getTurnHistory(): TurnState[] {
    return [...this.turnHistory];
  }
}