import { v4 as uuidv4 } from 'uuid';
import type { Agent, CreateAgent, AgentStatus, Task } from '../../../shared/types/index.js';
import { ConversationService } from './ConversationService.js';

export class AgentService {
  private agents: Map<string, Agent> = new Map();
  private conversationService = new ConversationService();

  async createAgent(sessionId: string, data: CreateAgent): Promise<Agent> {
    const conversationId = await this.conversationService.createConversation(sessionId);

    const agent: Agent = {
      id: uuidv4(),
      sessionId,
      model: data.model,
      status: 'idle',
      conversationId,
      createdAt: new Date(),
    };

    this.agents.set(agent.id, agent);
    return agent;
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }

  async getAgentBySession(sessionId: string): Promise<Agent | null> {
    for (const agent of this.agents.values()) {
      if (agent.sessionId === sessionId) {
        return agent;
      }
    }
    return null;
  }

  async updateAgentStatus(id: string, status: AgentStatus): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      if (status !== 'idle' && status !== 'error') {
        agent.lastResponseAt = new Date();
      }
      this.agents.set(id, agent);
    }
  }

  async setCurrentTask(id: string, task: Task | undefined): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      agent.currentTask = task;
      this.agents.set(id, agent);
    }
  }

  async processMessage(agentId: string, content: string): Promise<string> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Update agent status
    await this.updateAgentStatus(agentId, 'thinking');

    // Add user message to conversation
    await this.conversationService.addMessage(agent.conversationId, {
      role: 'user',
      content,
    });

    // Simulate processing (this would connect to actual AI model)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate response (placeholder - would use actual AI)
    const response = `I understand you said: "${content}". I'm here to help with your Codex needs.`;

    // Add assistant response to conversation
    await this.conversationService.addMessage(agent.conversationId, {
      role: 'assistant',
      content: response,
    });

    // Update agent status back to idle
    await this.updateAgentStatus(agentId, 'idle');

    return response;
  }

  async deleteAgentsBySession(sessionId: string): Promise<void> {
    for (const [id, agent] of this.agents.entries()) {
      if (agent.sessionId === sessionId) {
        this.agents.delete(id);
      }
    }
  }

  // State machine transition validation
  isValidStatusTransition(from: AgentStatus, to: AgentStatus): boolean {
    const transitions: Record<AgentStatus, AgentStatus[]> = {
      idle: ['thinking', 'executing'],
      thinking: ['executing', 'waiting_input', 'error', 'idle'],
      executing: ['idle', 'error'],
      waiting_input: ['thinking'],
      error: ['idle'],
    };

    return transitions[from]?.includes(to) || false;
  }
}

export const agentService = new AgentService();