import { v4 as uuidv4 } from 'uuid';
import type { WebSocketMessage } from '../../../shared/types/index.js';
import { agentService } from '../services/AgentService.js';
import { fileService } from '../services/FileService.js';
import { sessionService } from '../services/SessionService.js';

export async function handleClientMessage(socket: any, message: WebSocketMessage) {
  const { type, payload, sessionId } = message;

  switch (type) {
    case 'HEARTBEAT':
      await handleHeartbeat(socket, sessionId);
      break;

    case 'SEND_MESSAGE':
      await handleSendMessage(socket, sessionId, payload);
      break;

    case 'EXECUTE_TASK':
      await handleExecuteTask(socket, sessionId, payload);
      break;

    case 'FILE_OPERATION':
      await handleFileOperation(socket, sessionId, payload);
      break;

    case 'SEARCH_FILES':
      await handleSearchFiles(socket, sessionId, payload);
      break;

    default:
      sendError(socket, sessionId, 'WS_1002', 'Unknown message type');
  }
}

async function handleHeartbeat(socket: any, sessionId: string) {
  const response: WebSocketMessage = {
    id: uuidv4(),
    type: 'HEARTBEAT_ACK',
    payload: {
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString(),
    },
    timestamp: new Date(),
    sessionId,
    sequenceNumber: 0,
  };

  socket.send(JSON.stringify(response));
  await sessionService.updateSessionActivity(sessionId);
}

async function handleSendMessage(socket: any, sessionId: string, payload: any) {
  try {
    const agent = await agentService.getAgentBySession(sessionId);
    if (!agent) {
      sendError(socket, sessionId, 'WS_1007', 'No agent found for session');
      return;
    }

    // Update agent status
    const statusUpdate: WebSocketMessage = {
      id: uuidv4(),
      type: 'AGENT_STATUS',
      payload: {
        agentId: agent.id,
        status: 'thinking',
      },
      timestamp: new Date(),
      sessionId,
      sequenceNumber: 0,
    };
    socket.send(JSON.stringify(statusUpdate));

    // Process message
    const response = await agentService.processMessage(agent.id, payload.content);

    // Send response
    const messageResponse: WebSocketMessage = {
      id: uuidv4(),
      type: 'CONVERSATION_MESSAGE',
      payload: {
        message: {
          id: uuidv4(),
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        },
      },
      timestamp: new Date(),
      sessionId,
      sequenceNumber: 0,
    };
    socket.send(JSON.stringify(messageResponse));

    // Update agent status back to idle
    const finalStatus: WebSocketMessage = {
      id: uuidv4(),
      type: 'AGENT_STATUS',
      payload: {
        agentId: agent.id,
        status: 'idle',
      },
      timestamp: new Date(),
      sessionId,
      sequenceNumber: 0,
    };
    socket.send(JSON.stringify(finalStatus));

  } catch (error: any) {
    sendError(socket, sessionId, 'WS_1010', error.message);
  }
}

async function handleExecuteTask(socket: any, sessionId: string, payload: any) {
  // Task execution logic would go here
  const response: WebSocketMessage = {
    id: uuidv4(),
    type: 'TASK_UPDATE',
    payload: {
      taskId: uuidv4(),
      status: 'running',
      progress: 0.5,
    },
    timestamp: new Date(),
    sessionId,
    sequenceNumber: 0,
  };

  socket.send(JSON.stringify(response));
}

async function handleFileOperation(socket: any, sessionId: string, payload: any) {
  try {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      sendError(socket, sessionId, 'WS_1003', 'Session not found');
      return;
    }

    let result;
    switch (payload.operation) {
      case 'read':
        result = await fileService.readFile(session.workspaceDir, payload.path);
        break;
      case 'write':
        result = await fileService.writeFile(session.workspaceDir, payload.path, payload.content);
        break;
      default:
        sendError(socket, sessionId, 'WS_1006', 'Invalid file operation');
        return;
    }

    const response: WebSocketMessage = {
      id: uuidv4(),
      type: 'FILE_CHANGE',
      payload: {
        path: payload.path,
        changeType: payload.operation === 'write' ? 'modified' : 'read',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      sessionId,
      sequenceNumber: 0,
    };

    socket.send(JSON.stringify(response));
  } catch (error: any) {
    sendError(socket, sessionId, 'WS_1008', error.message);
  }
}

async function handleSearchFiles(socket: any, sessionId: string, payload: any) {
  try {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      sendError(socket, sessionId, 'WS_1003', 'Session not found');
      return;
    }

    const results = await fileService.searchFiles(
      session.workspaceDir,
      payload.query,
      payload.fuzzy
    );

    const response: WebSocketMessage = {
      id: uuidv4(),
      type: 'SEARCH_RESULTS',
      payload: {
        query: payload.query,
        results,
      },
      timestamp: new Date(),
      sessionId,
      sequenceNumber: 0,
    };

    socket.send(JSON.stringify(response));
  } catch (error: any) {
    sendError(socket, sessionId, 'WS_1010', error.message);
  }
}

function sendError(socket: any, sessionId: string, code: string, message: string) {
  const errorMessage: WebSocketMessage = {
    id: uuidv4(),
    type: 'ERROR',
    payload: {
      code,
      message,
    },
    timestamp: new Date(),
    sessionId,
    sequenceNumber: 0,
  };

  socket.send(JSON.stringify(errorMessage));
}