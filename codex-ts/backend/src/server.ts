import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from 'dotenv';

// Load environment variables
config();

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

// Register plugins
await server.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
});

await server.register(helmet, {
  contentSecurityPolicy: false, // Will configure properly later
});

await server.register(jwt, {
  secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
});

await server.register(websocket);

// Health check endpoint
server.get('/health', async () => {
  return {
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
  };
});

// Register API routes
import { registerSessionRoutes } from './api/sessions.js';
import { registerAgentRoutes } from './api/agents.js';
import { registerConversationRoutes } from './api/conversations.js';
import { registerTaskRoutes } from './api/tasks.js';
import { registerFileRoutes } from './api/files.js';
import { registerMCPRoutes } from './api/mcp.js';
import { registerConfigurationRoutes } from './api/configurations.js';
import { registerWebSocketHandler } from './websocket/server.js';

registerSessionRoutes(server);
registerAgentRoutes(server);
registerConversationRoutes(server);
registerTaskRoutes(server);
registerFileRoutes(server);
registerMCPRoutes(server);
registerConfigurationRoutes(server);
registerWebSocketHandler(server);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();