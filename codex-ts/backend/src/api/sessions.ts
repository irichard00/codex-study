import { FastifyInstance } from 'fastify';
import { CreateSessionSchema, SessionSchema } from '../../../shared/types/index.js';
import { sessionService } from '../services/SessionService.js';

export function registerSessionRoutes(server: FastifyInstance) {
  // Create session
  server.post('/api/sessions', {
    schema: {
      body: CreateSessionSchema,
      response: {
        201: SessionSchema,
      },
    },
    handler: async (request, reply) => {
      const session = await sessionService.createSession(request.body as any);
      reply.code(201).send(session);
    },
  });

  // Get session
  server.get('/api/sessions/:sessionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
      },
      response: {
        200: SessionSchema,
      },
    },
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      reply.send(session);
    },
  });

  // List sessions
  server.get('/api/sessions', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'idle', 'disconnected'] },
        },
      },
    },
    handler: async (request, reply) => {
      const { status } = request.query as { status?: any };
      const sessions = await sessionService.listSessions(status);
      reply.send(sessions);
    },
  });

  // Delete session
  server.delete('/api/sessions/:sessionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const deleted = await sessionService.deleteSession(sessionId);

      if (!deleted) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      reply.code(204).send();
    },
  });
}