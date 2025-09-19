import { v4 as uuidv4 } from 'uuid';
import type {
  Conversation,
  Message,
  SendMessage,
  ConversationContext
} from '../../../shared/types/index.js';

export class ConversationService {
  private conversations: Map<string, Conversation> = new Map();

  async createConversation(sessionId: string): Promise<string> {
    const conversation: Conversation = {
      id: uuidv4(),
      sessionId,
      messages: [],
      context: {
        workspaceFiles: [],
        recentCommands: [],
        environment: {},
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(conversation.id, conversation);
    return conversation.id;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  async getConversationsBySession(
    sessionId: string,
    limit = 50,
    offset = 0
  ): Promise<Conversation[]> {
    const allConversations = Array.from(this.conversations.values())
      .filter((c) => c.sessionId === sessionId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return allConversations.slice(offset, offset + limit);
  }

  async addMessage(
    conversationId: string,
    messageData: Omit<Message, 'id' | 'timestamp'>
  ): Promise<Message> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message: Message = {
      id: uuidv4(),
      ...messageData,
      timestamp: new Date(),
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);

    return message;
  }

  async updateContext(
    conversationId: string,
    context: Partial<ConversationContext>
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.context = {
      ...conversation.context,
      ...context,
    };
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversations.delete(id);
  }

  async deleteConversationsBySession(sessionId: string): Promise<void> {
    for (const [id, conversation] of this.conversations.entries()) {
      if (conversation.sessionId === sessionId) {
        this.conversations.delete(id);
      }
    }
  }

  async getRecentMessages(conversationId: string, count = 10): Promise<Message[]> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.messages.slice(-count);
  }

  async clearMessages(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.messages = [];
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
  }
}

export const conversationService = new ConversationService();