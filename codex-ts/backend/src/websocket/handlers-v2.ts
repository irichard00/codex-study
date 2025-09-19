import { v4 as uuidv4 } from 'uuid';
import type { WebSocketMessage } from '../../../shared/types/index.js';
import { agentService } from '../services/AgentService.js';
import { sessionService } from '../services/SessionService.js';
import { submissionLoop } from '../services/SubmissionLoop.js';
import { fileService } from '../services/FileService.js';

/**
 * Enhanced handler that uses the submission loop for message processing
 * This is more aligned with the Rust implementation's approach
 */
export async function handleClientMessageV2(socket: any, message: WebSocketMessage) {
  const { type, payload, sessionId } = message;

  switch (type) {
    case 'HEARTBEAT':
      await handleHeartbeat(socket, sessionId);
      break;

    case 'SEND_MESSAGE':
      // Use submission loop for message processing
      await handleSendMessageWithLoop(socket, sessionId, payload);
      break;

    case 'CANCEL_TASK':
      await handleCancelTask(socket, sessionId, payload);
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

/**
 * Process message through submission loop (like Rust's submission_loop)
 */
async function handleSendMessageWithLoop(socket: any, sessionId: string, payload: any) {
  try {
    // Get session and agent
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      sendError(socket, sessionId, 'WS_1003', 'Session not found');
      return;
    }

    const agent = await agentService.getAgentBySession(sessionId);
    if (!agent) {
      sendError(socket, sessionId, 'WS_1007', 'No agent found for session');
      return;
    }

    // Check if already processing
    if (submissionLoop.isProcessing(agent.id)) {
      sendError(socket, sessionId, 'WS_1005', 'Already processing a submission');
      return;
    }

    // Create context for submission loop
    const context = {
      sessionId,
      agentId: agent.id,
      conversationId: agent.conversationId,
      workspaceDir: session.workspaceDir,
    };

    // Status update callback
    const onStatusUpdate = (status: string) => {
      const statusMessage: WebSocketMessage = {
        id: uuidv4(),
        type: 'AGENT_STATUS',
        payload: {
          agentId: agent.id,
          status,
        },
        timestamp: new Date(),
        sessionId,
        sequenceNumber: 0,
      };
      socket.send(JSON.stringify(statusMessage));
    };

    // Process through submission loop
    const result = await submissionLoop.processSubmission(
      context,
      payload.content,
      onStatusUpdate
    );

    // Send response message
    const responseMessage: WebSocketMessage = {
      id: uuidv4(),
      type: 'CONVERSATION_MESSAGE',
      payload: {
        message: {
          id: uuidv4(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString(),
          metadata: {
            tasksExecuted: result.tasksExecuted.length,
            filesModified: result.filesModified.length,
          },
        },
      },
      timestamp: new Date(),
      sessionId,
      sequenceNumber: 0,
    };
    socket.send(JSON.stringify(responseMessage));

    // Send task updates if any
    for (const task of result.tasksExecuted) {
      const taskMessage: WebSocketMessage = {
        id: uuidv4(),
        type: 'TASK_UPDATE',
        payload: {
          taskId: task.id,
          type: task.type,
          status: task.status,
          output: task.output,
          error: task.error,
        },
        timestamp: new Date(),
        sessionId,
        sequenceNumber: 0,
      };
      socket.send(JSON.stringify(taskMessage));
    }

    // Send file change notifications
    for (const filePath of result.filesModified) {
      const fileMessage: WebSocketMessage = {
        id: uuidv4(),
        type: 'FILE_CHANGE',
        payload: {
          path: filePath,
          changeType: 'modified',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        sessionId,
        sequenceNumber: 0,
      };
      socket.send(JSON.stringify(fileMessage));
    }

  } catch (error: any) {
    console.error('Submission loop error:', error);
    sendError(socket, sessionId, 'WS_1010', error.message);
  }
}

async function handleCancelTask(socket: any, sessionId: string, payload: any) {
  try {
    const agent = await agentService.getAgentBySession(sessionId);
    if (!agent) {
      sendError(socket, sessionId, 'WS_1007', 'No agent found');
      return;
    }

    // Cancel the submission if running
    await submissionLoop.cancelSubmission(agent.id);

    const response: WebSocketMessage = {
      id: uuidv4(),
      type: 'TASK_UPDATE',
      payload: {
        taskId: payload.taskId,
        status: 'cancelled',
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

async function handleExecuteTask(socket: any, sessionId: string, payload: any) {
  // This could also use the submission loop for task execution
  const response: WebSocketMessage = {
    id: uuidv4(),
    type: 'TASK_UPDATE',
    payload: {
      taskId: uuidv4(),
      status: 'pending',
      type: payload.taskType,
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
        result = await fileService.writeFile(
          session.workspaceDir,
          payload.path,
          payload.content
        );
        break;
      case 'delete':
        result = await fileService.deleteFile(session.workspaceDir, payload.path);
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
        changeType: payload.operation === 'delete' ? 'deleted' : 'modified',
        timestamp: new Date().toISOString(),
        result,
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