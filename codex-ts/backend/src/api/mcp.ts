import { FastifyInstance } from 'fastify';
import { mcpService } from '../services/MCPService.js';

export function registerMCPRoutes(server: FastifyInstance) {
  // List MCP connections
  server.get('/api/sessions/:sessionId/mcp/connections', {
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const connections = await mcpService.listConnections(sessionId);
      reply.send(connections);
    },
  });

  // Connect to MCP server
  server.post('/api/sessions/:sessionId/mcp/connections', {
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { serverUrl } = request.body as { serverUrl: string };

      const connection = await mcpService.connectToServer(sessionId, { serverUrl });
      reply.code(201).send(connection);
    },
  });
}