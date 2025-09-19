import { FastifyInstance } from 'fastify';
import { SendMessageSchema, ConversationSchema, MessageSchema } from '../../../shared/types/index.js';
import { conversationService } from '../services/ConversationService.js';
import { agentService } from '../services/AgentService.js';

export function registerConversationRoutes(server: FastifyInstance) {
  // Get conversations for session
  server.get('/api/sessions/:sessionId/conversations', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { limit, offset } = request.query as { limit?: number; offset?: number };

      const conversations = await conversationService.getConversationsBySession(
        sessionId,
        limit,
        offset
      );

      reply.send(conversations);
    },
  });

  // Send message to conversation
  server.post('/api/sessions/:sessionId/conversations', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
      },
      body: SendMessageSchema,
      response: {
        201: MessageSchema,
      },
    },
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const messageData = request.body as any;

      // Get agent for session
      const agent = await agentService.getAgentBySession(sessionId);
      if (!agent) {
        reply.code(404).send({ error: 'No agent found for session' });
        return;
      }

      // Process message through agent
      const response = await agentService.processMessage(agent.id, messageData.content);

      reply.code(201).send({ response });
    },
  });
}