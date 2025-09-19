import { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { WebSocketMessage } from '../../../shared/types/index.js';
import { handleClientMessage } from './handlers.js';
import { sessionService } from '../services/SessionService.js';

interface ExtendedWebSocket extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

export function registerWebSocketHandler(server: FastifyInstance) {
  server.get('/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket as ExtendedWebSocket;
    const sessionId = (req.query as any).sessionId;

    if (!sessionId) {
      socket.close(1008, 'Session ID required');
      return;
    }

    // Verify session exists
    sessionService.getSession(sessionId).then(session => {
      if (!session) {
        socket.close(1008, 'Invalid session');
        return;
      }

      socket.sessionId = sessionId;
      socket.isAlive = true;

      // Send initial state
      const initialMessage: WebSocketMessage = {
        id: uuidv4(),
        type: 'INITIAL_STATE',
        payload: {
          session,
          agent: null,
          conversation: null,
          connections: [],
        },
        timestamp: new Date(),
        sessionId,
        sequenceNumber: 0,
      };

      socket.send(JSON.stringify(initialMessage));

      // Handle messages
      socket.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleClientMessage(socket, message);
        } catch (error) {
          const errorMessage: WebSocketMessage = {
            id: uuidv4(),
            type: 'ERROR',
            payload: {
              code: 'WS_1001',
              message: 'Invalid message format',
            },
            timestamp: new Date(),
            sessionId,
            sequenceNumber: 0,
          };
          socket.send(JSON.stringify(errorMessage));
        }
      });

      // Handle pong for heartbeat
      socket.on('pong', () => {
        socket.isAlive = true;
      });

      // Handle disconnect
      socket.on('close', () => {
        if (sessionId) {
          sessionService.updateSessionStatus(sessionId, 'disconnected');
        }
      });
    });
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    server.websocketServer?.clients.forEach((ws) => {
      const socket = ws as ExtendedWebSocket;
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  server.addHook('onClose', () => {
    clearInterval(interval);
  });
}