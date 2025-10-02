/**
 * Session management class - port of Session struct from codex.rs
 * Manages conversation state, turn context, and history
 *
 * REFACTORED: Now uses SessionState, SessionServices, and ActiveTurn for better organization
 * while maintaining full backward compatibility
 */

import type { InputItem, AskForApproval, SandboxPolicy, ReasoningEffortConfig, ReasoningSummaryConfig, Event, ResponseItem, ConversationHistory } from '../protocol/types';
import type { EventMsg } from '../protocol/events';
import type { MessageRecord, ConversationData } from '../types/storage';
import { ConversationStore } from '../storage/ConversationStore';
import { State } from './State';
import { v4 as uuidv4 } from 'uuid';
import { TurnContext } from './TurnContext';
import type { AgentConfig } from '../config/AgentConfig';

// New state management imports
import { SessionState, type SessionStateExport } from './session/state/SessionState';
import { type SessionServices, createSessionServices } from './session/state/SessionServices';
import { ActiveTurn } from './session/state/ActiveTurn';
import type { TokenUsageInfo } from './session/state/types';

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
  private state: State; // Legacy state - kept for compatibility
  private sessionState: SessionState; // NEW: Pure data state
  private services: SessionServices | null = null; // NEW: Service collection
  private activeTurn: ActiveTurn | null = null; // NEW: Active turn management
  private turnContext: TurnContext;
  private messageCount: number = 0;
  private currentTurnItems: InputItem[] = [];
  private pendingInput: InputItem[] = []; // Will delegate to ActiveTurn when active
  private eventEmitter: ((event: Event) => Promise<void>) | null = null;
  private conversationStore: ConversationStore | null = null;
  private conversation: ConversationData | null = null;
  private isPersistent: boolean = true;

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

    // Initialize both state systems (legacy and new)
    this.state = new State(this.conversationId); // Legacy - kept for compatibility
    this.sessionState = new SessionState(); // NEW: Pure data state
    this.services = services ?? null; // NEW: Will be created in initialize()

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

    if (!this.isPersistent) return;

    this.conversationStore = new ConversationStore();
    await this.conversationStore.initialize();

    // Update services with conversation store
    if (this.services) {
      this.services.conversationStore = this.conversationStore;
    }

    // Load or create conversation
    const conversationId = await this.getOrCreateConversation();
    this.conversation = await this.conversationStore.getConversation(conversationId);
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
      this.state.setConversationHistoryItems(items);
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
   * Delegates to BOTH legacy State and new SessionState
   */
  async addToHistory(entry: { timestamp: number; text: string; type: 'user' | 'agent' | 'system' }): Promise<void> {
    // Delegate to legacy State
    this.state.addToHistory(entry);
    this.messageCount++;

    // NEW: Also record in SessionState
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
    return this.state.getConversationHistory();
  }

  /**
   * Get history entry by offset
   * @param offset Negative offset from end of history
   */
  getHistoryEntry(offset: number): ResponseItem | undefined {
    return this.state.getHistoryEntry(offset);
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.state.clearHistory();
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
      startTime: this.state.getConversationHistory().metadata?.startTime || Date.now(),
      currentModel: this.turnContext.model,
    };
  }

  /**
   * Export session for persistence
   * NEW FORMAT: Uses SessionState export structure
   */
  export(): {
    id: string;
    state: SessionStateExport;
    metadata: {
      created: number;
      lastAccessed: number;
      messageCount: number;
    };
    // Legacy fields for backward compatibility
    conversationId?: string;
    conversationHistory?: ConversationHistory;
    turnContext?: TurnContext;
  } {
    return {
      // NEW format
      id: this.conversationId,
      state: this.sessionState.export(),
      metadata: {
        created: this.state.getConversationHistory().metadata?.startTime || Date.now(),
        lastAccessed: Date.now(),
        messageCount: this.messageCount,
      },
      // Legacy fields for backward compatibility
      conversationId: this.conversationId,
      conversationHistory: this.state.getConversationHistory(),
      turnContext: { ...this.turnContext },
    };
  }

  /**
   * Import session from persistence
   * Supports both NEW format (with state and metadata) and LEGACY format
   */
  static import(data: any, services?: SessionServices): Session {
    const session = new Session(false, undefined, services);

    // Determine format and import accordingly
    if (data.state && data.metadata) {
      // NEW format: Use SessionState
      session.sessionState = SessionState.import(data.state);

      // Also update legacy state for compatibility
      if (data.state.history?.items) {
        session.state.setConversationHistoryItems(data.state.history.items);
      }

      Object.assign(session, {
        conversationId: data.id || data.conversationId,
        messageCount: data.metadata.messageCount || 0,
      });

      // Restore turn context if available
      if (data.turnContext) {
        session.turnContext = { ...data.turnContext };
      }
    } else {
      // LEGACY format: Handle old export structure
      const conversationId = data.conversationId || data.id;

      // Handle conversation history
      if (data.conversationHistory) {
        session.state.setConversationHistory(data.conversationHistory);
      } else if (data.history) {
        // Convert very old format to new
        const items = data.history.map((h: any) => ({
          role: h.type === 'user' ? 'user' as const : h.type === 'system' ? 'system' as const : 'assistant' as const,
          content: h.text,
          timestamp: h.timestamp
        }));
        session.state.setConversationHistoryItems(items);
      }

      Object.assign(session, {
        conversationId,
        turnContext: data.turnContext ? { ...data.turnContext } : session.turnContext,
        messageCount: data.messageCount || 0,
      });
    }

    return session;
  }

  /**
   * Check if session is empty
   */
  isEmpty(): boolean {
    return this.state.getConversationHistory().items.length === 0;
  }

  /**
   * Get last message from history
   */
  getLastMessage(): ResponseItem | undefined {
    return this.state.getLastMessage();
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: 'user' | 'agent' | 'system'): ResponseItem[] {
    return this.state.getMessagesByType(type);
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
    const conversationHistory = this.state.getConversationHistory();
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
    // Delegate to State
    this.state.compact();
    this.messageCount = this.state.getConversationHistory().items.length;
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
  async searchMessages(query: string): Promise<any[]> {
    if (!this.conversationStore) {
      // Search in memory if no storage
      return this.state.searchMessages(query);
    }

    const results = await this.conversationStore.searchMessages(query);
    return results.map(r => ({
      conversationId: r.conversationId,
      messageId: r.messageId,
      snippet: r.snippet,
      timestamp: r.timestamp,
      relevance: r.relevanceScore
    }));
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

    // Reset state
    this.state = new State(this.conversationId);

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
    this.state = new State(this.conversationId);

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
   * Get the State instance
   */
  getState(): State {
    return this.state;
  }

  /**
   * Start a new turn in state
   */
  startTurn(): void {
    this.state.startTurn();
  }

  /**
   * End current turn in state
   */
  endTurn(): void {
    this.state.endTurn();
  }

  /**
   * Track token usage
   * Delegates to BOTH legacy State and new SessionState
   */
  addTokenUsage(tokens: number): void {
    this.state.addTokenUsage(tokens); // Legacy
    this.sessionState.addTokenUsage(tokens); // NEW
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
   * NEW: Creates ActiveTurn instance
   */
  async startTurn(): Promise<void> {
    if (this.activeTurn) {
      throw new Error('Cannot start turn: turn already active');
    }
    this.activeTurn = new ActiveTurn();
    this.state.startTurn(); // Legacy
  }

  /**
   * End a turn (clears ActiveTurn)
   * NEW: Drains and clears ActiveTurn
   */
  async endTurn(): Promise<void> {
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
    this.state.endTurn(); // Legacy
  }

  /**
   * Track tool usage
   */
  trackToolUsage(toolName: string): void {
    this.state.trackToolUsage(toolName);
  }

  /**
   * Add error to state
   */
  addError(error: string, context?: any): void {
    this.state.addError(error, context);
  }

  /**
   * Request interrupt
   */
  requestInterrupt(): void {
    this.state.requestInterrupt();
  }

  /**
   * Check if interrupt requested
   */
  isInterruptRequested(): boolean {
    return this.state.isInterruptRequested();
  }

  /**
   * Clear interrupt flag
   */
  clearInterrupt(): void {
    this.state.clearInterrupt();
  }

  /**
   * Export session with state
   */
  exportWithState(): any {
    const baseExport = this.export();
    return {
      ...baseExport,
      state: this.state.export()
    };
  }

  /**
   * Import session with state
   */
  static importWithState(data: any): Session {
    const session = Session.import(data);
    if (data.state) {
      session.state = State.import(data.state);
    }
    return session;
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
}
