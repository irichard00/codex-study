/**
 * Session management class - port of Session struct from codex.rs
 * Manages conversation state, turn context, and history
 *
 * REFACTORED: Now uses SessionState, SessionServices, and ActiveTurn for better organization
 * while maintaining full backward compatibility
 */

import type { InputItem, AskForApproval, SandboxPolicy, ReasoningEffortConfig, ReasoningSummaryConfig, Event, ResponseItem, ConversationHistory, ReviewDecision } from '../protocol/types';
import type { EventMsg } from '../protocol/events';
import type { MessageRecord, ConversationData } from '../types/storage';
import { RolloutRecorder, type RolloutItem } from '../storage/rollout';
import { v4 as uuidv4 } from 'uuid';
import { TurnContext } from './TurnContext';
import type { AgentConfig } from '../config/AgentConfig';

// New state management imports
import { SessionState, type SessionStateExport } from './session/state/SessionState';
import { type SessionServices, createSessionServices } from './session/state/SessionServices';
import { ActiveTurn } from './session/state/ActiveTurn';
import { TaskKind } from './session/state/types';
import type { TokenUsageInfo, RunningTask, RateLimitSnapshot, InitialHistory, TurnAbortReason } from './session/state/types';

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
 * Tool definition interface (to avoid circular dependency with TurnManager)
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: any;
  };
}

/**
 * Session class managing conversation state
 * REFACTORED: Now internally uses SessionState for pure data management
 */
export class Session {
  readonly conversationId: string;
  private config?: AgentConfig;
  private sessionState: SessionState; // Pure data state
  private services: SessionServices | null = null; // Service collection
  private activeTurn: ActiveTurn | null = null; // Active turn management
  private turnContext: TurnContext;
  private messageCount: number = 0;
  private currentTurnItems: InputItem[] = [];
  private pendingInput: InputItem[] = []; // Will delegate to ActiveTurn when active
  private eventEmitter: ((event: Event) => Promise<void>) | null = null;
  private conversation: ConversationData | null = null;
  private isPersistent: boolean = true;

  // Runtime state (not persisted, lives in Session only)
  private currentTurnState: TurnState | null = null;
  private turnHistory: TurnState[] = [];
  private toolUsageStats: Map<string, number> = new Map();
  private errorHistory: Array<{timestamp: number, error: string, context?: any}> = [];
  private interruptRequested: boolean = false;

  constructor(configOrIsPersistent?: AgentConfig | boolean, isPersistent?: boolean, services?: SessionServices) {
    this.conversationId = `conv_${uuidv4()}`;

    // Handle both new and old signatures for backward compatibility
    if (typeof configOrIsPersistent === 'boolean') {
      // Old signature: Session(isPersistent?: boolean)
      this.isPersistent = configOrIsPersistent;
      this.config = undefined;
    } else {
      // New signature: Session(config?: AgentConfig, isPersistent?: boolean, services?: SessionServices)
      this.config = configOrIsPersistent;
      this.isPersistent = isPersistent ?? true;
    }

    // Initialize session state
    this.sessionState = new SessionState(); // Pure data state
    this.services = services ?? null; // Will be created in initialize()

    // Initialize with default turn context, using config values if available
    this.turnContext = new TurnContext({
      cwd: this.getDefaultCwd(),
      approval_policy: 'on-request',
      sandbox_policy: { mode: 'workspace-write' },
      model: 'gpt-5',
      summary: { enabled: false },
    });
  }

  /**
   * Initialize session with storage and services
   */
  async initialize(): Promise<void> {
    // Create services if not provided
    if (!this.services) {
      this.services = await createSessionServices({}, false);
    }

    // Persistence is now handled by RolloutRecorder via initializeSession()
    // No need to initialize ConversationStore
  }

  /**
   * Get or create a conversation in storage
   */
  private async getOrCreateConversation(): Promise<string> {
    if (!this.conversationStore) {
      return this.conversationId;
    }

    // Try to find an active conversation
    const conversations = await this.conversationStore.listConversations(
      { status: 'active' },
      1
    );

    if (conversations.length > 0) {
      // Use the most recent active conversation
      const conv = conversations[0];
      Object.assign(this, { conversationId: conv.id });

      // Load messages from storage
      const messages = await this.conversationStore.getMessages(conv.id);
      const items = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp
      }));
      this.sessionState.recordItems(items);
      this.messageCount = messages.length;

      return conv.id;
    }

    // Create new conversation
    const newConvId = await this.conversationStore.createConversation({
      title: 'New Conversation',
      status: 'active',
      metadata: {
        model: this.turnContext.model,
        cwd: this.turnContext.cwd
      }
    });

    Object.assign(this, { conversationId: newConvId });
    return newConvId;
  }

  /**
   * Save current session state to storage
   */
  async saveState(): Promise<void> {
    if (!this.conversationStore || !this.conversation) return;

    await this.conversationStore.updateConversation(this.conversation.id, {
      metadata: {
        ...this.conversation.metadata,
        turnContext: this.turnContext,
        lastUpdate: Date.now()
      }
    });
  }

  /**
   * Update turn context with new values
   */
  updateTurnContext(updates: Partial<TurnContext>): void {
    this.turnContext = {
      ...this.turnContext,
      ...updates,
    };
  }

  /**
   * Get current turn context
   */
  getTurnContext(): TurnContext {
    return { ...this.turnContext };
  }

  /**
   * Add a message to history
   */
  async addToHistory(entry: { timestamp: number; text: string; type: 'user' | 'agent' | 'system' }): Promise<void> {
    this.messageCount++;

    // Record in SessionState
    const responseItem: ResponseItem = {
      role: entry.type === 'user' ? 'user' : entry.type === 'system' ? 'system' : 'assistant',
      content: entry.text,
      timestamp: entry.timestamp,
    };
    this.sessionState.recordItems([responseItem]);

    // Persist to storage if enabled
    if (this.conversationStore && this.conversation) {
      const messageRecord: Omit<MessageRecord, 'id'> = {
        conversationId: this.conversation.id,
        role: entry.type === 'user' ? 'user' : entry.type === 'system' ? 'system' : 'assistant',
        content: entry.text,
        timestamp: entry.timestamp,
      };

      await this.conversationStore.addMessage(this.conversation.id, messageRecord);
    }
  }

  /**
   * Get conversation history as ConversationHistory
   */
  getConversationHistory(): ConversationHistory {
    return this.sessionState.getConversationHistory();
  }

  /**
   * Get history entry by offset
   * @param offset Negative offset from end of history
   */
  getHistoryEntry(offset: number): ResponseItem | undefined {
    const items = this.sessionState.historySnapshot();
    if (offset >= 0 || Math.abs(offset) > items.length) {
      return undefined;
    }
    return items[items.length + offset];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.sessionState = new SessionState();
    this.messageCount = 0;
  }

  /**
   * Get current message count
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Set current turn input items
   */
  setCurrentTurnItems(items: InputItem[]): void {
    this.currentTurnItems = items;
  }

  /**
   * Get current turn input items
   */
  getCurrentTurnItems(): InputItem[] {
    return [...this.currentTurnItems];
  }

  /**
   * Clear current turn items
   */
  clearCurrentTurn(): void {
    this.currentTurnItems = [];
  }

  /**
   * Get session metadata
   */
  getMetadata(): {
    conversationId: string;
    messageCount: number;
    startTime: number;
    currentModel: string;
  } {
    return {
      conversationId: this.conversationId,
      messageCount: this.messageCount,
      startTime: this.sessionState.getConversationHistory().metadata?.startTime || Date.now(),
      currentModel: this.turnContext.model,
    };
  }

  /**
   * Export session for persistence
   * Uses SessionState export structure
   */
  export(): {
    id: string;
    state: SessionStateExport;
    metadata: {
      created: number;
      lastAccessed: number;
      messageCount: number;
    };
  } {
    return {
      id: this.conversationId,
      state: this.sessionState.export(),
      metadata: {
        created: this.sessionState.getConversationHistory().metadata?.startTime || Date.now(),
        lastAccessed: Date.now(),
        messageCount: this.messageCount,
      },
    };
  }

  /**
   * Import session from persistence
   */
  static import(data: {
    id: string;
    state: SessionStateExport;
    metadata: {
      created: number;
      lastAccessed: number;
      messageCount: number;
    };
  }, services?: SessionServices): Session {
    const session = new Session(undefined, true, services);

    // Import SessionState
    session.sessionState = SessionState.import(data.state);

    // Set metadata
    Object.assign(session, {
      conversationId: data.id,
      messageCount: data.metadata.messageCount || 0,
    });

    return session;
  }

  /**
   * Check if session is empty
   */
  isEmpty(): boolean {
    return this.sessionState.getConversationHistory().items.length === 0;
  }

  /**
   * Get last message from history
   */
  getLastMessage(): ResponseItem | undefined {
    const items = this.sessionState.historySnapshot();
    return items[items.length - 1];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: 'user' | 'agent' | 'system'): ResponseItem[] {
    const role = type === 'user' ? 'user' : type === 'system' ? 'system' : 'assistant';
    return this.sessionState.historySnapshot().filter(item => item.role === role);
  }

  /**
   * Set event emitter for sending events to the queue
   */
  setEventEmitter(emitter: (event: Event) => Promise<void>): void {
    this.eventEmitter = emitter;
  }

  /**
   * Emit an event
   */
  async emitEvent(event: Event): Promise<void> {
    if (this.eventEmitter) {
      await this.eventEmitter(event);
    } else {
      console.warn('Event emitter not set, event dropped:', event);
    }
  }

  /**
   * Get session ID (conversation ID)
   */
  getSessionId(): string {
    return this.conversationId;
  }

  /**
   * Record input items in conversation
   */
  async recordInput(items: InputItem[]): Promise<void> {
    const timestamp = Date.now();

    for (const item of items) {
      let text = '';

      switch (item.type) {
        case 'text':
          text = item.text;
          break;
        case 'image':
          text = '[image]';
          break;
        case 'clipboard':
          text = item.content || '[clipboard]';
          break;
        case 'context':
          text = `[context: ${item.path || 'unknown'}]`;
          break;
        default:
          text = '[unknown input]';
      }

      await this.addToHistory({
        timestamp,
        text,
        type: 'user',
      });
    }
  }

  /**
   * Record conversation items (messages, tool calls, etc.)
   */
  async recordConversationItems(items: any[]): Promise<void> {
    const timestamp = Date.now();

    for (const item of items) {
      if (item.role === 'assistant' || item.role === 'user' || item.role === 'system') {
        const text = this.extractTextFromItem(item);
        if (text) {
          await this.addToHistory({
            timestamp,
            text,
            type: item.role === 'assistant' ? 'agent' : item.role === 'system' ? 'system' : 'user',
          });
        }
      }
    }
  }

  /**
   * Extract text content from conversation items
   */
  private extractTextFromItem(item: any): string {
    if (typeof item.content === 'string') {
      return item.content;
    }

    if (Array.isArray(item.content)) {
      return item.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join(' ');
    }

    return '';
  }

  /**
   * Get pending user input during turn execution
   * NEW: Delegates to ActiveTurn if turn is active
   */
  async getPendingInput(): Promise<any[]> {
    if (this.activeTurn) {
      // Delegate to ActiveTurn
      const pending = this.activeTurn.takePendingInput();
      return pending.map(item => this.convertInputToResponse(item));
    } else {
      // Fall back to legacy behavior
      const pending = [...this.pendingInput];
      this.pendingInput = []; // Clear pending input
      return pending.map(item => this.convertInputToResponse(item));
    }
  }

  /**
   * Add pending input (for interrupting turns)
   * NEW: Delegates to ActiveTurn if turn is active
   */
  addPendingInput(items: InputItem[]): void {
    if (this.activeTurn) {
      // Delegate to ActiveTurn
      items.forEach(item => this.activeTurn!.pushPendingInput(item));
    } else {
      // Fall back to legacy behavior
      this.pendingInput.push(...items);
    }
  }

  /**
   * Convert input item to response format
   */
  private convertInputToResponse(item: InputItem): any {
    switch (item.type) {
      case 'text':
        return {
          role: 'user',
          content: [{ type: 'text', text: item.text }],
        };
      case 'image':
        return {
          role: 'user',
          content: [{ type: 'image', image_url: item.image_url }],
        };
      case 'clipboard':
        return {
          role: 'user',
          content: [{ type: 'text', text: item.content || '[clipboard]' }],
        };
      case 'context':
        return {
          role: 'user',
          content: [{ type: 'text', text: `[context: ${item.path || 'unknown'}]` }],
        };
      default:
        return {
          role: 'user',
          content: [{ type: 'text', text: '[unknown]' }],
        };
    }
  }

  /**
   * Build turn input with full conversation history
   */
  async buildTurnInputWithHistory(newItems: any[]): Promise<any[]> {
    const conversationHistory = this.sessionState.getConversationHistory();
    const historyItems = conversationHistory.items.map(item => ({
      role: item.role,
      content: typeof item.content === 'string'
        ? [{ type: 'text', text: item.content }]
        : item.content,
    }));

    return [...historyItems, ...newItems];
  }

  /**
   * Get MCP tools available to the session
   */
  async getMcpTools(): Promise<ToolDefinition[]> {
    // Placeholder for MCP tools integration
    // In a full implementation, this would connect to MCP servers
    return [];
  }

  /**
   * Execute an MCP tool
   */
  async executeMcpTool(toolName: string, parameters: any): Promise<any> {
    // Placeholder for MCP tool execution
    // In a full implementation, this would call the appropriate MCP server
    throw new Error(`MCP tool '${toolName}' not implemented`);
  }

  /**
   * Record turn context for rollout/history
   */
  async recordTurnContext(contextItem: any): Promise<void> {
    // In a full implementation, this would persist turn context
    console.log('Recording turn context:', contextItem);
  }

  /**
   * Compact conversation history to save tokens
   */
  async compact(): Promise<void> {
    const items = this.sessionState.historySnapshot();
    const keepCount = 20;
    if (items.length > keepCount) {
      const kept = items.slice(-keepCount);
      this.sessionState = new SessionState();
      this.sessionState.recordItems(kept);
      this.messageCount = kept.length;
    }
  }

  /**
   * Build initial context for review mode
   */
  buildInitialContext(turnContext?: any): any[] {
    return [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `Working directory: ${turnContext?.cwd || '/'}`,
          },
        ],
      },
    ];
  }

  /**
   * Search messages in conversation history
   */
  async searchMessages(query: string): Promise<ResponseItem[]> {
    return this.sessionState.historySnapshot().filter(item => {
      const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
      return content.toLowerCase().includes(query.toLowerCase());
    });
  }

  /**
   * Export session with storage persistence
   */
  async exportWithStorage(): Promise<any> {
    const baseExport = this.export();

    if (!this.conversationStore) {
      return baseExport;
    }

    const stats = await this.conversationStore.getStatistics();
    return {
      ...baseExport,
      storageStats: stats,
      persistent: this.isPersistent
    };
  }

  /**
   * Reset session to initial state (for new conversation)
   */
  async reset(): Promise<void> {
    // Clear conversation history
    this.clearHistory();

    // Clear current turn items and pending input
    this.currentTurnItems = [];
    this.pendingInput = [];

    // Close old conversation if exists
    if (this.conversation && this.conversationStore) {
      await this.conversationStore.updateConversation(this.conversation.id, {
        status: 'inactive',
        metadata: {
          ...this.conversation.metadata,
          closedAt: Date.now()
        }
      });
    }

    // Create new conversation ID
    Object.assign(this, { conversationId: `conv_${uuidv4()}` });

    // Reinitialize with storage if enabled
    if (this.isPersistent && this.conversationStore) {
      const newConvId = await this.conversationStore.createConversation({
        title: 'New Conversation',
        status: 'active',
        metadata: {
          model: this.turnContext.model,
          cwd: this.turnContext.cwd
        }
      });

      Object.assign(this, { conversationId: newConvId });
      this.conversation = await this.conversationStore.getConversation(newConvId);
    }

    console.log('Session reset complete:', this.conversationId);
  }

  /**
   * Close session and cleanup resources
   */
  async close(): Promise<void> {
    if (this.conversation && this.conversationStore) {
      await this.conversationStore.updateConversation(this.conversation.id, {
        status: 'inactive',
        metadata: {
          ...this.conversation.metadata,
          closedAt: Date.now()
        }
      });

      await this.conversationStore.close();
    }
  }

  /**
   * Get session ID (conversation ID)
   */
  getId(): string {
    return this.conversationId;
  }

  /**
   * Track token usage
   */
  addTokenUsage(tokens: number): void {
    this.sessionState.addTokenUsage(tokens);
    if (this.currentTurnState) {
      this.currentTurnState.tokenCount += tokens;
    }
  }

  /**
   * Add approved command to session
   * NEW: Delegates to SessionState
   */
  addApprovedCommand(command: string): void {
    this.sessionState.addApprovedCommand(command);
  }

  /**
   * Check if command is approved
   * NEW: Delegates to SessionState
   */
  isCommandApproved(command: string): boolean {
    return this.sessionState.isCommandApproved(command);
  }

  /**
   * Check if there's an active turn
   * NEW: Uses ActiveTurn
   */
  isActiveTurn(): boolean {
    return this.activeTurn !== null;
  }

  /**
   * Start a turn (creates ActiveTurn)
   */
  async startTurn(): Promise<void> {
    if (this.currentTurnState) {
      throw new Error('Cannot start turn: turn already active');
    }
    this.currentTurnState = {
      turnNumber: this.turnHistory.length + 1,
      startTime: Date.now(),
      tokenCount: 0,
      toolCallCount: 0,
      interrupted: false,
    };
    // Also create ActiveTurn for active turn management
    if (this.activeTurn) {
      throw new Error('Cannot start turn: turn already active');
    }
    this.activeTurn = new ActiveTurn();
  }

  /**
   * End a turn (clears ActiveTurn)
   */
  async endTurn(): Promise<void> {
    if (this.currentTurnState) {
      this.currentTurnState.endTime = Date.now();
      this.turnHistory.push({...this.currentTurnState});
      this.currentTurnState = null;
    }

    if (!this.activeTurn) {
      console.warn('No active turn to end');
      return;
    }

    // Drain any remaining tasks
    const remaining = this.activeTurn.drain();
    if (remaining.size > 0) {
      console.warn(`Ending turn with ${remaining.size} remaining tasks`);
    }

    this.activeTurn = null;
  }

  /**
   * Track tool usage
   */
  trackToolUsage(toolName: string): void {
    const current = this.toolUsageStats.get(toolName) || 0;
    this.toolUsageStats.set(toolName, current + 1);
    if (this.currentTurnState) {
      this.currentTurnState.toolCallCount++;
    }
  }

  /**
   * Add error to state
   */
  addError(error: string, context?: any): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      error,
      context,
    });
  }

  /**
   * Request interrupt
   */
  requestInterrupt(): void {
    this.interruptRequested = true;
    if (this.currentTurnState) {
      this.currentTurnState.interrupted = true;
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
   * Get default model from config or fallback
   */
  getDefaultModel(): string {
    // AgentConfig.getConfig() might return synchronously or via property
    // For now, return default until config structure is clarified
    return 'gpt-5';
  }

  /**
   * Get default cwd from config or fallback
   */
  getDefaultCwd(): string {
    // AgentConfig.getConfig() might return synchronously or via property
    // For now, return default until config structure is clarified
    return '/';
  }

  /**
   * Check if storage is enabled from config or fallback
   */
  isStorageEnabled(): boolean {
    // AgentConfig.getConfig() might return synchronously or via property
    // For now, return default until config structure is clarified
    return true;
  }

  /**
   * Initialize session with RolloutRecorder (replaces ConversationStore)
   * T023: Follows codex-rs pattern from research.md
   */
  async initializeSession(
    mode: 'create' | 'resume',
    conversationId: string,
    config?: AgentConfig
  ): Promise<void> {
    try {
      if (mode === 'create') {
        // Create new rollout
        const rollout = await RolloutRecorder.create(
          {
            type: 'create',
            conversationId,
            instructions: config?.instructions,
          },
          config
        );

        if (this.services) {
          this.services.rollout = rollout;
        }
      } else {
        // Resume from existing rollout
        const rollout = await RolloutRecorder.create(
          {
            type: 'resume',
            conversationId,
          },
          config
        );

        if (this.services) {
          this.services.rollout = rollout;
        }

        // Reconstruct history from rollout
        const items = await rollout.getRolloutHistory();
        this.reconstructHistoryFromRollout(items);
      }
    } catch (e) {
      console.error('Failed to initialize rollout recorder:', e);
      // Graceful degradation: set rollout to null, session continues without persistence
      if (this.services) {
        this.services.rollout = null;
      }
    }
  }

  /**
   * Persist rollout items (replaces ConversationStore.addMessage)
   * T024: Record items to RolloutRecorder
   */
  async persistRolloutItems(items: RolloutItem[]): Promise<void> {
    if (this.services?.rollout) {
      try {
        await this.services.rollout.recordItems(items);
      } catch (e) {
        console.error('Failed to record rollout items:', e);
        // Don't throw - persistence failure should not stop execution
      }
    }
  }

  /**
   * Reconstruct conversation history from rollout items
   * T025: Used when resuming a session
   */
  private reconstructHistoryFromRollout(items: RolloutItem[]): void {
    const responseItems: ResponseItem[] = [];
    for (const item of items) {
      if (item.type === 'response_item') {
        // Add response items to conversation history
        responseItems.push(item.payload as ResponseItem);
      } else if (item.type === 'compacted') {
        // Add compacted summaries to history
        // Note: Compacted items contain a message field
        const compacted = item.payload as { message: string };
        // Add as a system message or summary marker
        responseItems.push({
          type: 'Message',
          content: `[Summary: ${compacted.message}]`,
        } as ResponseItem);
      }
      // Skip event_msg, session_meta, turn_context (metadata only, not part of conversation history)
    }
    this.sessionState.recordItems(responseItems);
  }

  /**
   * Flush rollout recorder before session ends
   * T025: Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.services?.rollout) {
      try {
        await this.services.rollout.flush();
      } catch (e) {
        console.error('Failed to flush rollout recorder:', e);
      }
    }
  }

  // ========================================================================
  // NEW METHODS: Browser-Compatible Session Methods from codex-rs
  // ========================================================================

  /**
   * T010: Generate internal submission ID
   *
   * Generates unique internal submission IDs for auto-generated operations
   * (e.g., auto-compact). Uses simple counter since JavaScript is single-threaded.
   *
   * @returns Unique submission ID in format "auto-compact-{id}"
   */
  private internalSubIdCounter: number = 0;

  nextInternalSubId(): string {
    const id = this.internalSubIdCounter++;
    return `auto-compact-${id}`;
  }

  /**
   * T012: Utility getters
   */

  /**
   * Check if raw agent reasoning should be shown
   * @returns Boolean from SessionServices or config
   */
  showRawAgentReasoning(): boolean {
    return this.services?.showRawAgentReasoning ?? false;
  }

  /**
   * Get user notifier service
   * @returns User notifier (can integrate with Chrome notifications or UI)
   */
  notifier(): any {
    return this.services?.notifier ?? null;
  }

  /**
   * T013: Enhanced send_event with rollout persistence
   *
   * Persists event to rollout and emits via event emitter.
   * Replaces/enhances existing emitEvent() method.
   *
   * @param event Event to send
   */
  async sendEvent(event: Event): Promise<void> {
    // Persist event to rollout as EventMsg
    if (this.services?.rollout) {
      const rolloutItems: RolloutItem[] = [{
        type: 'event_msg',
        payload: event.msg,
      }];

      try {
        await this.services.rollout.recordItems(rolloutItems);
      } catch (e) {
        // Graceful degradation - log and continue
        console.error('Failed to persist event to rollout:', e);
      }
    }

    // Emit event via existing event emitter
    if (this.eventEmitter) {
      await this.eventEmitter(event);
    }
  }

  /**
   * T014: Notify background event
   *
   * Helper to create and send BackgroundEvent.
   *
   * @param subId Submission ID
   * @param message Background event message
   */
  async notifyBackgroundEvent(subId: string, message: string): Promise<void> {
    const event: Event = {
      id: subId,
      msg: {
        type: 'BackgroundEvent',
        data: {
          message,
        },
      } as EventMsg,
    };
    await this.sendEvent(event);
  }

  /**
   * T015: Notify stream error
   *
   * Helper to create and send StreamErrorEvent.
   *
   * @param subId Submission ID
   * @param message Error message
   */
  async notifyStreamError(subId: string, message: string): Promise<void> {
    const event: Event = {
      id: subId,
      msg: {
        type: 'StreamError',
        data: {
          message,
        },
      } as EventMsg,
    };
    await this.sendEvent(event);
  }

  /**
   * T016: Send token count event
   *
   * Retrieves token info and rate limits from SessionState and emits TokenCountEvent.
   *
   * @param subId Submission ID
   */
  async sendTokenCountEvent(subId: string): Promise<void> {
    // Get token info from SessionState
    const tokenInfo = undefined; // Would need getTokenInfo method from SessionState
    const rateLimits = undefined; // Would need getRateLimits method from SessionState

    const event: Event = {
      id: subId,
      msg: {
        type: 'TokenCount',
        data: {
          info: tokenInfo,
          rate_limits: rateLimits,
        },
      } as EventMsg,
    };
    await this.sendEvent(event);
  }

  /**
   * T018: Notify approval
   *
   * Resolves a pending approval request with the user's decision.
   * Locates the pending approval in ActiveTurn, removes it, and calls the resolver.
   *
   * @param executionId Unique identifier for the approval request
   * @param decision User's review decision (approve/reject/request_change)
   */
  notifyApproval(executionId: string, decision: ReviewDecision): void {
    if (!this.activeTurn) {
      console.warn(`No active turn to notify approval for executionId: ${executionId}`);
      return;
    }

    const resolver = this.activeTurn.removePendingApproval(executionId);
    if (resolver) {
      resolver(decision);
    } else {
      console.warn(`No pending approval found for executionId: ${executionId}`);
    }
  }

  // ========================================================================
  // Task Lifecycle Management
  // ========================================================================

  /**
   * T020: Register new active task
   *
   * Creates ActiveTurn if needed and registers a running task.
   * This is called when a new task is spawned.
   *
   * @param subId Submission ID for the task
   * @param task RunningTask information
   * @private
   */
  private registerNewActiveTask(subId: string, task: RunningTask): void {
    if (!this.activeTurn) {
      this.activeTurn = new ActiveTurn();
    }
    this.activeTurn.addTask(subId, task);
  }

  /**
   * T021: Take all running tasks
   *
   * Extracts all running tasks from ActiveTurn, drains pending approvals/input,
   * and clears the ActiveTurn.
   *
   * @returns Map of all running tasks (submission ID -> RunningTask)
   * @private
   */
  private takeAllRunningTasks(): Map<string, RunningTask> {
    if (!this.activeTurn) {
      return new Map();
    }

    // Drain all tasks from the turn
    const tasks = this.activeTurn.drain();

    // Clear the active turn since all tasks are removed
    this.activeTurn = null;

    return tasks;
  }

  /**
   * T022: Handle task abort
   *
   * Aborts an individual task with the specified reason, triggers AbortController,
   * and emits TurnAbortedEvent.
   *
   * @param subId Submission ID of the task to abort
   * @param task RunningTask to abort
   * @param reason Reason for aborting the task
   * @private
   */
  private async handleTaskAbort(
    subId: string,
    task: RunningTask,
    reason: TurnAbortReason
  ): Promise<void> {
    // Abort the task via AbortController
    task.handle.abort();

    // Emit TurnAbortedEvent
    const event: Event = {
      id: subId,
      msg: {
        type: 'TurnAborted',
        data: {
          reason,
          submission_id: subId,
          turn_count: undefined, // Could track turn count if needed
        },
      } as EventMsg,
    };
    await this.sendEvent(event);
  }

  /**
   * T023: Abort all tasks
   *
   * Aborts all running tasks with the specified reason.
   * Extracts all tasks, aborts each one, and clears ActiveTurn.
   *
   * @param reason Reason for aborting all tasks
   */
  async abortAllTasks(reason: TurnAbortReason): Promise<void> {
    const tasks = this.takeAllRunningTasks();

    // Abort each task
    const abortPromises: Promise<void>[] = [];
    for (const [subId, task] of tasks) {
      abortPromises.push(this.handleTaskAbort(subId, task, reason));
    }

    // Wait for all aborts to complete
    await Promise.all(abortPromises);
  }

  /**
   * T024: On task finished
   *
   * Called when a task completes successfully.
   * Removes the task from ActiveTurn, clears ActiveTurn if empty,
   * and emits TaskCompleteEvent.
   *
   * @param subId Submission ID of the completed task
   */
  async onTaskFinished(subId: string): Promise<void> {
    if (!this.activeTurn) {
      return;
    }

    // Remove task from ActiveTurn
    const isEmpty = this.activeTurn.removeTask(subId);

    // Clear ActiveTurn if no more tasks
    if (isEmpty) {
      this.activeTurn = null;
    }

    // Emit TaskCompleteEvent
    const event: Event = {
      id: subId,
      msg: {
        type: 'TaskComplete',
        data: {
          submission_id: subId,
          last_agent_message: undefined,
          turn_count: undefined,
        },
      } as EventMsg,
    };
    await this.sendEvent(event);
  }

  /**
   * T025: Spawn task
   *
   * Aborts any existing tasks, creates a new task with AbortController,
   * registers it in ActiveTurn, and executes the task function.
   *
   * @param subId Submission ID for this task
   * @param taskFn Task function to execute (receives AbortSignal)
   */
  async spawnTask<T>(
    subId: string,
    taskFn: (signal: AbortSignal) => Promise<T>
  ): Promise<void> {
    // Abort all existing tasks (new task replaces them)
    await this.abortAllTasks('automatic_abort');

    // Create AbortController for this task
    const abortController = new AbortController();

    // Create RunningTask entry
    const runningTask: RunningTask = {
      handle: abortController,
      kind: TaskKind.Regular,
      startTime: Date.now(),
      subId: subId,
    };

    // Register in ActiveTurn
    this.registerNewActiveTask(subId, runningTask);

    // Execute task asynchronously (don't await here - let it run in background)
    taskFn(abortController.signal)
      .then(() => {
        // Task completed successfully
        this.onTaskFinished(subId);
      })
      .catch((error) => {
        // Task failed or was aborted
        if (abortController.signal.aborted) {
          // Already aborted, no need to emit error
          console.debug(`Task ${subId} was aborted`);
        } else {
          // Task failed with error
          console.error(`Task ${subId} failed:`, error);
          this.notifyStreamError(subId, error.message || 'Unknown error');
        }
      });
  }

  /**
   * T026: Interrupt task
   *
   * Wrapper around abortAllTasks with Interrupted reason.
   * Used when user explicitly interrupts execution.
   */
  async interruptTask(): Promise<void> {
    await this.abortAllTasks('user_interrupt');
  }

  // ========================================================================
  // Rollout Recording & History Management
  // ========================================================================

  /**
   * T027: Persist rollout response items
   *
   * Converts ResponseItems to RolloutItems and persists them via RolloutRecorder.
   * This is used to save conversation history to persistent storage.
   *
   * @param items Response items to persist
   * @private
   */
  private async persistRolloutResponseItems(items: ResponseItem[]): Promise<void> {
    if (!this.services?.rollout) {
      return;
    }

    // Convert ResponseItems to RolloutItems
    const rolloutItems: RolloutItem[] = items.map((item) => ({
      type: 'response_item',
      payload: item,
    }));

    try {
      await this.services.rollout.recordItems(rolloutItems);
    } catch (error) {
      console.error('Failed to persist response items to rollout:', error);
      // Non-fatal: rollout persistence failures should not break session
    }
  }

  /**
   * T028: Record conversation items with dual persistence
   *
   * Records ResponseItems to both SessionState (in-memory history) and
   * RolloutRecorder (persistent storage).
   *
   * @param items Response items to record
   */
  async recordConversationItemsDual(items: ResponseItem[]): Promise<void> {
    // Record to SessionState (in-memory history)
    this.sessionState.recordItems(items);

    // Persist to rollout storage
    await this.persistRolloutResponseItems(items);
  }

  /**
   * T029: Record input and rollout user message
   *
   * Converts InputItems to ResponseItem, records to history, derives UserMessage event,
   * and persists only the UserMessage to rollout (not the full ResponseItem).
   *
   * This is used when recording user input to the conversation.
   *
   * @param subId Submission ID
   * @param input Input items from user
   * @private
   */
  private async recordInputAndRolloutUsermsg(
    subId: string,
    input: InputItem[]
  ): Promise<void> {
    // Convert input to ResponseItem (simplified - would need full protocol mapping)
    const responseItems: ResponseItem[] = input.map((item) => ({
      role: 'user',
      content: item,
    })) as ResponseItem[];

    // Record to SessionState history
    this.sessionState.recordItems(responseItems);

    // Derive UserMessage text from input
    const messageText = input
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        } else if (typeof item === 'object' && 'text' in item) {
          return (item as any).text;
        }
        return '';
      })
      .join(' ');

    // Create and persist UserMessage event to rollout (NOT full ResponseItem)
    if (this.services?.rollout && messageText) {
      const userMsgEvent: EventMsg = {
        type: 'UserMessage',
        data: {
          message: messageText,
        },
      };

      const rolloutItems: RolloutItem[] = [{
        type: 'event_msg',
        payload: userMsgEvent,
      }];

      try {
        await this.services.rollout.recordItems(rolloutItems);
      } catch (error) {
        console.error('Failed to persist user message to rollout:', error);
      }
    }
  }

  /**
   * T030: Enhance reconstruct history from rollout
   *
   * Reconstructs conversation history from rollout storage, handling both
   * regular ResponseItems and compacted history with summaries.
   *
   * This is called when resuming a session from persistent storage.
   *
   * @param rolloutItems Items from rollout storage
   * @private
   */
  private reconstructHistoryFromRollout(rolloutItems: RolloutItem[]): void {
    const responseItems: ResponseItem[] = [];

    for (const rolloutItem of rolloutItems) {
      if (rolloutItem.type === 'response_item') {
        // Regular response item
        responseItems.push(rolloutItem.payload as ResponseItem);
      } else if (rolloutItem.type === 'compacted') {
        // Compacted history with summary
        // The compacted item should contain a summary that replaces multiple items
        const compactedData = rolloutItem.payload as any;
        if (compactedData.summary) {
          // Add summary as a system message
          responseItems.push({
            role: 'system',
            content: compactedData.summary,
          } as ResponseItem);
        }
      }
      // Other rollout item types (event_msg, etc.) are not added to history
    }

    // Replace entire history with reconstructed items
    this.sessionState.replaceHistory(responseItems);
  }

  // ========================================================================
  // Token & Rate Limit Tracking
  // ========================================================================

  /**
   * T031: Update token usage info
   *
   * Updates SessionState with token usage information and sends token count event.
   *
   * @param subId Submission ID
   * @param tokenUsage Token usage data (or null if not available)
   * @private
   */
  private async updateTokenUsageInfo(
    subId: string,
    tokenUsage: any | null
  ): Promise<void> {
    if (!tokenUsage) {
      return;
    }

    // Convert TokenUsage to TokenUsageInfo for SessionState
    const tokenInfo: TokenUsageInfo = {
      input_tokens: tokenUsage.input_tokens,
      output_tokens: tokenUsage.output_tokens,
      total_tokens: tokenUsage.total_tokens,
      cache_creation_input_tokens: tokenUsage.cached_input_tokens,
      cache_read_input_tokens: 0, // Not provided in TokenUsage
    };

    // Update SessionState
    this.sessionState.updateTokenInfo(tokenInfo);

    // Send token count event
    await this.sendTokenCountEvent(subId);
  }

  /**
   * T032: Update rate limits
   *
   * Updates SessionState with rate limit information and sends token count event.
   *
   * @param subId Submission ID
   * @param rateLimits Rate limit snapshot
   * @private
   */
  private async updateRateLimits(
    subId: string,
    rateLimits: RateLimitSnapshot
  ): Promise<void> {
    // Update SessionState
    this.sessionState.updateRateLimits(rateLimits);

    // Send token count event
    await this.sendTokenCountEvent(subId);
  }

  // ========================================================================
  // Initialization & Utilities
  // ========================================================================

  /**
   * T033: Inject input
   *
   * Attempts to inject input into the active turn. If there's an active turn,
   * the input is queued for processing. If there's no active turn, the input
   * is returned back to the caller.
   *
   * @param input Input items to inject
   * @returns Result object with success status and optionally returned input
   */
  async injectInput(input: InputItem[]): Promise<{ success: boolean; returned?: InputItem[] }> {
    if (!this.activeTurn) {
      // No active turn - return input back to caller
      return {
        success: false,
        returned: input,
      };
    }

    // Inject input into active turn
    for (const item of input) {
      this.activeTurn.pushPendingInput(item);
    }

    return {
      success: true,
    };
  }

  /**
   * T034: Turn input with history
   *
   * Combines session history with extra turn items to create full turn input.
   * This is used when preparing input for a new turn.
   *
   * @param extra Additional response items for this turn
   * @returns Combined array of history + extra items
   */
  async turnInputWithHistory(extra: ResponseItem[]): Promise<ResponseItem[]> {
    // Get history snapshot from SessionState
    const history = this.sessionState.historySnapshot();

    // Combine history with extra items
    return [...history, ...extra];
  }

  /**
   * T036: Record initial history
   *
   * Records initial conversation history based on session mode.
   * - New sessions: Records initial context
   * - Resumed sessions: Reconstructs history from rollout
   * - Forked sessions: Reconstructs and persists history
   *
   * @param initialHistory Initial history configuration
   * @private
   */
  private async recordInitialHistory(
    initialHistory: InitialHistory
  ): Promise<void> {
    if (initialHistory.mode === 'new') {
      // New session - no history to record yet
      return;
    } else if (initialHistory.mode === 'resumed') {
      // Resumed session - reconstruct from rollout
      this.reconstructHistoryFromRollout(initialHistory.rolloutItems);
    } else if (initialHistory.mode === 'forked') {
      // Forked session - reconstruct and persist
      this.reconstructHistoryFromRollout(initialHistory.rolloutItems);

      // Persist forked history to new rollout
      const history = this.sessionState.historySnapshot();
      await this.persistRolloutResponseItems(history);
    }
  }
}
