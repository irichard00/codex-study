import { z } from 'zod';

export const ConnectionStatusSchema = z.enum([
  'connecting',
  'connected',
  'disconnected',
  'error',
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const MCPMetadataSchema = z.object({
  version: z.string(),
  serverName: z.string(),
  supportedProtocols: z.array(z.string()),
});
export type MCPMetadata = z.infer<typeof MCPMetadataSchema>;

export const MCPConnectionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  serverUrl: z.string().url(),
  status: ConnectionStatusSchema,
  capabilities: z.array(z.string()),
  lastPingAt: z.date().optional(),
  metadata: MCPMetadataSchema,
});
export type MCPConnection = z.infer<typeof MCPConnectionSchema>;

export const ConnectMCPSchema = z.object({
  serverUrl: z.string().url(),
});
export type ConnectMCP = z.infer<typeof ConnectMCPSchema>;