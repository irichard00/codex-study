import { z } from 'zod';

// Client to Server message types
export const ClientMessageTypeSchema = z.enum([
  'SEND_MESSAGE',
  'EXECUTE_TASK',
  'CANCEL_TASK',
  'UPDATE_CONFIG',
  'FILE_OPERATION',
  'MCP_REQUEST',
  'SEARCH_FILES',
  'HEARTBEAT',
]);
export type ClientMessageType = z.infer<typeof ClientMessageTypeSchema>;

// Server to Client message types
export const ServerMessageTypeSchema = z.enum([
  'INITIAL_STATE',
  'AGENT_STATUS',
  'TASK_UPDATE',
  'CONVERSATION_MESSAGE',
  'FILE_CHANGE',
  'MCP_EVENT',
  'CONFIG_UPDATE',
  'NOTIFICATION',
  'ERROR',
  'SEARCH_RESULTS',
  'HEARTBEAT_ACK',
]);
export type ServerMessageType = z.infer<typeof ServerMessageTypeSchema>;

export const WSMessageTypeSchema = z.union([ClientMessageTypeSchema, ServerMessageTypeSchema]);
export type WSMessageType = z.infer<typeof WSMessageTypeSchema>;

export const WebSocketMessageSchema = z.object({
  id: z.string().uuid(),
  type: WSMessageTypeSchema,
  payload: z.any(),
  timestamp: z.date(),
  sessionId: z.string().uuid(),
  sequenceNumber: z.number(),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Error codes
export const WSErrorCodeSchema = z.enum([
  'WS_1001', // Invalid message format
  'WS_1002', // Unknown message type
  'WS_1003', // Unauthorized session
  'WS_1004', // Session expired
  'WS_1005', // Rate limit exceeded
  'WS_1006', // Invalid payload
  'WS_1007', // Task not found
  'WS_1008', // File access denied
  'WS_1009', // MCP connection failed
  'WS_1010', // Internal server error
]);
export type WSErrorCode = z.infer<typeof WSErrorCodeSchema>;

export const WSErrorSchema = z.object({
  code: WSErrorCodeSchema,
  message: z.string(),
  details: z.any().optional(),
  relatedMessageId: z.string().uuid().optional(),
});
export type WSError = z.infer<typeof WSErrorSchema>;