/**
 * Session management class - port of Session struct from codex.rs
 * Manages conversation state, turn context, and history
 */

import type { InputItem, AskForApproval, SandboxPolicy, ReasoningEffortConfig, ReasoningSummaryConfig, Event, ResponseItem, ConversationHistory } from '../protocol/types';
import type { EventMsg } from '../protocol/events';
import type { MessageRecord, ConversationData } from '../types/storage';
import { ConversationStore } from '../storage/ConversationStore';
import { State } from './State';
import { v4 as uuidv4 } from 'uuid';
import { TurnContext } from './TurnContext';

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
 */
export class Session {
  readonly conversationId: string;
  private state: State;
  private turnContext: TurnContext;
  private messageCount: number = 0;
  private currentTurnItems: InputItem[] = [];
  private pendingInput: InputItem[] = [];
  private eventEmitter: ((event: Event) => Promise<void>) | null = null;
  private conversationStore: ConversationStore | null = null;
  private conversation: ConversationData | null = null;
  private isPersistent: boolean = true;

  constructor(isPersistent: boolean = true) {
    this.conversationId = `conv_${uuidv4()}`;
    this.isPersistent = isPersistent;
    this.state = new State(this.conversationId);

    // Initialize with default turn context
    this.turnContext = new TurnContext({
      cwd: '/',
      approval_policy: 'on-request',
      sandbox_policy: { mode: 'workspace-write' },
      model: 'claude-3-sonnet',
      summary: { enabled: false },
    });
  }

  /**
   * Initialize session with storage
   */
  async initialize(): Promise<void> {
    if (!this.isPersistent) return;

    this.conversationStore = new ConversationStore();
    await this.conversationStore.initialize();

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
   */
  async addToHistory(entry: { timestamp: number; text: string; type: 'user' | 'agent' | 'system' }): Promise<void> {
    // Delegate to State
    this.state.addToHistory(entry);
    this.messageCount++;

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
   * Get conversation history
   * Returns items in the old format for backward compatibility
   */
  getHistory(): Array<{ timestamp: number; text: string; type: 'user' | 'agent' | 'system' }> {
    return this.state.getHistory();
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
   */
  export(): {
    conversationId: string;
    conversationHistory: ConversationHistory;
    turnContext: TurnContext;
    messageCount: number;
  } {
    return {
      conversationId: this.conversationId,
      conversationHistory: this.state.getConversationHistory(),
      turnContext: { ...this.turnContext },
      messageCount: this.messageCount,
    };
  }

  /**
   * Import session from persistence
   */
  static import(data: {
    conversationId: string;
    conversationHistory?: ConversationHistory;
    history?: Array<{ timestamp: number; text: string; type: 'user' | 'agent' | 'system' }>; // For backward compatibility
    turnContext: TurnContext;
    messageCount: number;
  }): Session {
    const session = new Session();

    // Handle both new and old format
    if (data.conversationHistory) {
      session.state.setConversationHistory(data.conversationHistory);
    } else if (data.history) {
      // Convert old format to new
      const items = data.history.map(h => ({
        role: h.type === 'user' ? 'user' as const : h.type === 'system' ? 'system' as const : 'assistant' as const,
        content: h.text,
        timestamp: h.timestamp
      }));
      session.state.setConversationHistoryItems(items);
    }

    Object.assign(session, {
      conversationId: data.conversationId,
      turnContext: { ...data.turnContext },
      messageCount: data.messageCount,
    });
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
   */
  async getPendingInput(): Promise<any[]> {
    const pending = [...this.pendingInput];
    this.pendingInput = []; // Clear pending input
    return pending.map(item => this.convertInputToResponse(item));
  }

  /**
   * Add pending input (for interrupting turns)
   */
  addPendingInput(items: InputItem[]): void {
    this.pendingInput.push(...items);
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
   */
  addTokenUsage(tokens: number): void {
    this.state.addTokenUsage(tokens);
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
}
