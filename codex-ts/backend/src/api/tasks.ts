import { FastifyInstance } from 'fastify';

export function registerTaskRoutes(server: FastifyInstance) {
  server.get('/api/sessions/:sessionId/tasks', async (request, reply) => {
    reply.send([]);
  });

  server.post('/api/sessions/:sessionId/tasks', async (request, reply) => {
    reply.code(201).send({ message: 'Task endpoint placeholder' });
  });
}