import type {
  ConversationData,
  MessageRecord,
  ToolCallRecord,
  SearchResult,
  ConversationStatus
} from '../types/storage';

export class ConversationStore {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'CodexConversations';
  private readonly DB_VERSION = 1;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = this.handleUpgrade.bind(this);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private handleUpgrade(event: IDBVersionChangeEvent): void {
    const db = (event.target as IDBOpenDBRequest).result;

    // Create conversations store
    if (!db.objectStoreNames.contains('conversations')) {
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('updated', 'updated', { unique: false });
      convStore.createIndex('status', 'status', { unique: false });
      convStore.createIndex('title', 'title', { unique: false });
    }

    // Create messages store
    if (!db.objectStoreNames.contains('messages')) {
      const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
      msgStore.createIndex('conversationId', 'conversationId', { unique: false });
      msgStore.createIndex('timestamp', 'timestamp', { unique: false });
      msgStore.createIndex('role', 'role', { unique: false });
      // Compound index for conversation + timestamp for efficient queries
      msgStore.createIndex('conversation_timestamp', ['conversationId', 'timestamp'], { unique: false });
    }

    // Create tool calls store
    if (!db.objectStoreNames.contains('toolCalls')) {
      const toolStore = db.createObjectStore('toolCalls', { keyPath: 'id' });
      toolStore.createIndex('messageId', 'messageId', { unique: false });
      toolStore.createIndex('toolName', 'toolName', { unique: false });
      toolStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Create search index store for full-text search
    if (!db.objectStoreNames.contains('searchIndex')) {
      const searchStore = db.createObjectStore('searchIndex', { keyPath: 'id' });
      searchStore.createIndex('conversationId', 'conversationId', { unique: false });
      searchStore.createIndex('terms', 'terms', { unique: false, multiEntry: true });
    }
  }

  async createConversation(data: Partial<ConversationData>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const conversationId = this.generateId('conv');
    const conversation: ConversationData = {
      id: conversationId,
      title: data.title || 'New Conversation',
      status: data.status || 'active',
      created: Date.now(),
      updated: Date.now(),
      messageCount: 0,
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0
      },
      metadata: data.metadata || {},
      ...data
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.add(conversation);

      request.onsuccess = () => resolve(conversationId);
      request.onerror = () => reject(request.error);
    });
  }

  async getConversation(id: string): Promise<ConversationData | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateConversation(id: string, updates: Partial<ConversationData>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const conversation = await this.getConversation(id);
    if (!conversation) throw new Error(`Conversation ${id} not found`);

    const updated = {
      ...conversation,
      ...updates,
      updated: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(updated);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['conversations', 'messages', 'toolCalls', 'searchIndex'],
        'readwrite'
      );

      // Delete conversation
      const convStore = transaction.objectStore('conversations');
      convStore.delete(id);

      // Delete all messages for this conversation
      const msgStore = transaction.objectStore('messages');
      const msgIndex = msgStore.index('conversationId');
      const msgRequest = msgIndex.openCursor(IDBKeyRange.only(id));

      msgRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          msgStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // Delete all tool calls for messages in this conversation
      // (Would need to track by conversation ID or iterate through messages)

      // Delete search index entries
      const searchStore = transaction.objectStore('searchIndex');
      const searchIndex = searchStore.index('conversationId');
      const searchRequest = searchIndex.openCursor(IDBKeyRange.only(id));

      searchRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          searchStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async listConversations(
    filter?: { status?: ConversationStatus },
    limit = 50,
    offset = 0
  ): Promise<ConversationData[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');

      let request: IDBRequest;
      if (filter?.status) {
        const index = store.index('status');
        request = index.getAll(filter.status);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        let results = request.result || [];
        // Sort by updated timestamp descending
        results.sort((a, b) => b.updated - a.updated);
        // Apply pagination
        results = results.slice(offset, offset + limit);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addMessage(conversationId: string, message: Omit<MessageRecord, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const messageId = this.generateId('msg');
    const messageRecord: MessageRecord = {
      ...message,
      id: messageId,
      conversationId,
      timestamp: message.timestamp || Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['messages', 'conversations', 'searchIndex'],
        'readwrite'
      );

      // Add message
      const msgStore = transaction.objectStore('messages');
      msgStore.add(messageRecord);

      // Update conversation
      const convStore = transaction.objectStore('conversations');
      const convRequest = convStore.get(conversationId);

      convRequest.onsuccess = () => {
        const conversation = convRequest.result;
        if (conversation) {
          conversation.messageCount++;
          conversation.updated = Date.now();

          // Update token usage if provided
          if (message.tokenUsage) {
            conversation.tokenUsage.input += message.tokenUsage.input || 0;
            conversation.tokenUsage.output += message.tokenUsage.output || 0;
            conversation.tokenUsage.total =
              conversation.tokenUsage.input + conversation.tokenUsage.output;
          }

          convStore.put(conversation);
        }
      };

      // Update search index
      if (message.content) {
        const searchStore = transaction.objectStore('searchIndex');
        const searchEntry = {
          id: this.generateId('search'),
          conversationId,
          messageId,
          terms: this.extractSearchTerms(message.content),
          timestamp: messageRecord.timestamp
        };
        searchStore.add(searchEntry);
      }

      transaction.oncomplete = () => resolve(messageId);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessages(
    conversationId: string,
    limit = 100,
    beforeTimestamp?: number
  ): Promise<MessageRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversation_timestamp');

      // Create key range for this conversation
      const lowerBound = [conversationId, 0];
      const upperBound = beforeTimestamp
        ? [conversationId, beforeTimestamp]
        : [conversationId, Number.MAX_SAFE_INTEGER];

      const keyRange = IDBKeyRange.bound(lowerBound, upperBound, false, true);
      const messages: MessageRecord[] = [];

      // Open cursor in reverse order (newest first)
      const request = index.openCursor(keyRange, 'prev');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // Reverse to get chronological order
          resolve(messages.reverse());
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async addToolCall(messageId: string, toolCall: Omit<ToolCallRecord, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const toolCallId = this.generateId('tool');
    const toolCallRecord: ToolCallRecord = {
      ...toolCall,
      id: toolCallId,
      messageId,
      timestamp: toolCall.timestamp || Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['toolCalls'], 'readwrite');
      const store = transaction.objectStore('toolCalls');
      const request = store.add(toolCallRecord);

      request.onsuccess = () => resolve(toolCallId);
      request.onerror = () => reject(request.error);
    });
  }

  async getToolCalls(messageId: string): Promise<ToolCallRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['toolCalls'], 'readonly');
      const store = transaction.objectStore('toolCalls');
      const index = store.index('messageId');
      const request = index.getAll(messageId);

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async searchMessages(query: string, limit = 50): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    const searchTerms = this.extractSearchTerms(query);
    if (searchTerms.length === 0) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['searchIndex', 'messages', 'conversations'], 'readonly');
      const searchStore = transaction.objectStore('searchIndex');
      const searchIndex = searchStore.index('terms');

      const results: Map<string, SearchResult> = new Map();
      const promises: Promise<void>[] = [];

      // Search for each term
      searchTerms.forEach(term => {
        const promise = new Promise<void>((termResolve) => {
          const request = searchIndex.openCursor(IDBKeyRange.only(term));

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const entry = cursor.value;
              const key = `${entry.conversationId}_${entry.messageId}`;

              if (!results.has(key)) {
                results.set(key, {
                  conversationId: entry.conversationId,
                  messageId: entry.messageId,
                  timestamp: entry.timestamp,
                  relevanceScore: 1,
                  snippet: '',
                  conversationTitle: ''
                });
              } else {
                // Increase relevance score for multiple matching terms
                const existing = results.get(key)!;
                existing.relevanceScore++;
              }

              cursor.continue();
            } else {
              termResolve();
            }
          };

          request.onerror = () => termResolve();
        });

        promises.push(promise);
      });

      Promise.all(promises).then(() => {
        // Sort by relevance score and timestamp
        const sortedResults = Array.from(results.values())
          .sort((a, b) => {
            if (a.relevanceScore !== b.relevanceScore) {
              return b.relevanceScore - a.relevanceScore;
            }
            return b.timestamp - a.timestamp;
          })
          .slice(0, limit);

        // Fetch message content and conversation titles
        const enrichmentPromises = sortedResults.map(result => {
          return new Promise<void>((enrichResolve) => {
            // Get message content
            const msgStore = transaction.objectStore('messages');
            const msgRequest = msgStore.get(result.messageId);

            msgRequest.onsuccess = () => {
              const message = msgRequest.result;
              if (message) {
                result.snippet = this.generateSnippet(message.content, searchTerms);
              }

              // Get conversation title
              const convStore = transaction.objectStore('conversations');
              const convRequest = convStore.get(result.conversationId);

              convRequest.onsuccess = () => {
                const conversation = convRequest.result;
                if (conversation) {
                  result.conversationTitle = conversation.title;
                }
                enrichResolve();
              };

              convRequest.onerror = () => enrichResolve();
            };

            msgRequest.onerror = () => enrichResolve();
          });
        });

        Promise.all(enrichmentPromises).then(() => resolve(sortedResults));
      });
    });
  }

  private extractSearchTerms(text: string): string[] {
    // Normalize and tokenize text
    const normalized = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();

    // Split into words and filter
    const words = normalized.split(' ')
      .filter(word => word.length > 2)  // Ignore short words
      .filter(word => !this.isStopWord(word));

    // Remove duplicates
    return [...new Set(words)];
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
      'was', 'were', 'been', 'have', 'has', 'had', 'will',
      'would', 'could', 'should', 'may', 'might', 'can',
      'this', 'that', 'these', 'those', 'with', 'from'
    ]);
    return stopWords.has(word);
  }

  private generateSnippet(content: string, searchTerms: string[]): string {
    const maxLength = 150;
    const contentLower = content.toLowerCase();

    // Find the first occurrence of any search term
    let bestPosition = -1;
    for (const term of searchTerms) {
      const pos = contentLower.indexOf(term);
      if (pos !== -1 && (bestPosition === -1 || pos < bestPosition)) {
        bestPosition = pos;
      }
    }

    if (bestPosition === -1) {
      // No match found, return beginning of content
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    // Extract snippet around the match
    const start = Math.max(0, bestPosition - 50);
    const end = Math.min(content.length, bestPosition + 100);
    let snippet = content.substring(start, end);

    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  async getStatistics(): Promise<{
    totalConversations: number;
    totalMessages: number;
    totalToolCalls: number;
    storageUsed: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['conversations', 'messages', 'toolCalls'],
        'readonly'
      );

      const stats = {
        totalConversations: 0,
        totalMessages: 0,
        totalToolCalls: 0,
        storageUsed: 0
      };

      // Count conversations
      const convStore = transaction.objectStore('conversations');
      const convRequest = convStore.count();
      convRequest.onsuccess = () => {
        stats.totalConversations = convRequest.result;
      };

      // Count messages
      const msgStore = transaction.objectStore('messages');
      const msgRequest = msgStore.count();
      msgRequest.onsuccess = () => {
        stats.totalMessages = msgRequest.result;
      };

      // Count tool calls
      const toolStore = transaction.objectStore('toolCalls');
      const toolRequest = toolStore.count();
      toolRequest.onsuccess = () => {
        stats.totalToolCalls = toolRequest.result;
      };

      transaction.oncomplete = async () => {
        // Estimate storage used
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          stats.storageUsed = estimate.usage || 0;
        }
        resolve(stats);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async cleanup(olderThanDays = 30): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('updated');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      const conversationsToDelete: string[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const conversation = cursor.value;
          // Only delete inactive conversations
          if (conversation.status === 'inactive' || conversation.status === 'archived') {
            conversationsToDelete.push(conversation.id);
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = async () => {
        // Delete the conversations
        for (const convId of conversationsToDelete) {
          await this.deleteConversation(convId);
          deletedCount++;
        }
        resolve(deletedCount);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}