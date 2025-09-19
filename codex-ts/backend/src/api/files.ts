import { FastifyInstance } from 'fastify';
import { fileService } from '../services/FileService.js';
import { sessionService } from '../services/SessionService.js';

export function registerFileRoutes(server: FastifyInstance) {
  // Browse files
  server.get('/api/sessions/:sessionId/files', {
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { path: dirPath = '.' } = request.query as { path?: string };

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      const files = await fileService.listFiles(session.workspaceDir, dirPath);
      reply.send(files);
    },
  });

  // Read file
  server.get('/api/sessions/:sessionId/files/content', {
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { path: filePath } = request.query as { path: string };

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      const content = await fileService.readFile(session.workspaceDir, filePath);
      reply.send({ path: filePath, content, encoding: 'utf-8' });
    },
  });

  // Write file
  server.put('/api/sessions/:sessionId/files/content', {
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { path: filePath, content } = request.body as { path: string; content: string };

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      const operation = await fileService.writeFile(session.workspaceDir, filePath, content);
      reply.send(operation);
    },
  });

  // Search files
  server.post('/api/sessions/:sessionId/files/search', {
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { query, fuzzy = true } = request.body as { query: string; fuzzy?: boolean };

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }

      const results = await fileService.searchFiles(session.workspaceDir, query, fuzzy);
      reply.send(results);
    },
  });
}