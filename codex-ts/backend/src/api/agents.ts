import { FastifyInstance } from 'fastify';
import { CreateAgentSchema, AgentSchema } from '../../../shared/types/index.js';
import { agentService } from '../services/AgentService.js';
import { sessionService } from '../services/SessionService.js';

export function registerAgentRoutes(server: FastifyInstance) {
  // Create agent for session
  server.post('/api/sessions/:sessionId/agents', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
      },
      body: CreateAgentSchema,
      response: {
        201: AgentSchema,
      },
    },
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      // Verify session exists
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      const agent = await agentService.createAgent(sessionId, request.body as any);
      reply.code(201).send(agent);
    },
  });

  // Get agent for session
  server.get('/api/sessions/:sessionId/agents', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
      },
      response: {
        200: AgentSchema,
      },
    },
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const agent = await agentService.getAgentBySession(sessionId);

      if (!agent) {
        reply.code(404).send({ error: 'Agent not found for session' });
        return;
      }

      reply.send(agent);
    },
  });
}