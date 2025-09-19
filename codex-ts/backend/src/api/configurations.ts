import { FastifyInstance } from 'fastify';
import { configurationService } from '../services/ConfigurationService.js';

export function registerConfigurationRoutes(server: FastifyInstance) {
  // List configurations
  server.get('/api/configurations', {
    handler: async (request, reply) => {
      const configs = await configurationService.listConfigurations();
      reply.send(configs);
    },
  });

  // Create configuration
  server.post('/api/configurations', {
    handler: async (request, reply) => {
      const config = await configurationService.createConfiguration(request.body as any);
      reply.code(201).send(config);
    },
  });
}