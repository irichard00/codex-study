import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import type {
  MCPConnection,
  ConnectMCP,
  ConnectionStatus,
} from '../../../shared/types/index.js';

export class MCPService {
  private connections: Map<string, MCPConnection> = new Map();
  private websockets: Map<string, WebSocket> = new Map();

  async connectToServer(sessionId: string, data: ConnectMCP): Promise<MCPConnection> {
    const connection: MCPConnection = {
      id: uuidv4(),
      sessionId,
      serverUrl: data.serverUrl,
      status: 'connecting',
      capabilities: [],
      metadata: {
        version: '1.0.0',
        serverName: 'unknown',
        supportedProtocols: [],
      },
    };

    this.connections.set(connection.id, connection);

    // Establish WebSocket connection
    try {
      const ws = new WebSocket(data.serverUrl);

      ws.on('open', () => {
        this.updateConnectionStatus(connection.id, 'connected');
        this.sendHandshake(ws, connection.id);
      });

      ws.on('message', (data) => {
        this.handleMCPMessage(connection.id, data.toString());
      });

      ws.on('error', (error) => {
        console.error(`MCP connection error for ${connection.id}:`, error);
        this.updateConnectionStatus(connection.id, 'error');
      });

      ws.on('close', () => {
        this.updateConnectionStatus(connection.id, 'disconnected');
        this.websockets.delete(connection.id);
      });

      this.websockets.set(connection.id, ws);
    } catch (error) {
      this.updateConnectionStatus(connection.id, 'error');
      throw error;
    }

    return connection;
  }

  async disconnectFromServer(connectionId: string): Promise<void> {
    const ws = this.websockets.get(connectionId);
    if (ws) {
      ws.close();
      this.websockets.delete(connectionId);
    }
    this.updateConnectionStatus(connectionId, 'disconnected');
  }

  async getConnection(id: string): Promise<MCPConnection | null> {
    return this.connections.get(id) || null;
  }

  async listConnections(sessionId: string): Promise<MCPConnection[]> {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.sessionId === sessionId
    );
  }

  async sendRequest(connectionId: string, method: string, params: any): Promise<any> {
    const ws = this.websockets.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection not available');
    }

    const request = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      const messageHandler = (data: WebSocket.Data) => {
        const response = JSON.parse(data.toString());
        if (response.id === request.id) {
          clearTimeout(timeout);
          ws.off('message', messageHandler);

          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.result);
          }
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(request));
    });
  }

  private updateConnectionStatus(id: string, status: ConnectionStatus): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.status = status;
      if (status === 'connected') {
        connection.lastPingAt = new Date();
      }
      this.connections.set(id, connection);
    }
  }

  private sendHandshake(ws: WebSocket, connectionId: string): void {
    const handshake = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        clientInfo: {
          name: 'codex-ts',
          version: '1.0.0',
        },
      },
      id: uuidv4(),
    };

    ws.send(JSON.stringify(handshake));
  }

  private handleMCPMessage(connectionId: string, message: string): void {
    try {
      const parsed = JSON.parse(message);

      if (parsed.method === 'initialized') {
        const connection = this.connections.get(connectionId);
        if (connection && parsed.params) {
          connection.capabilities = parsed.params.capabilities || [];
          connection.metadata = {
            version: parsed.params.version || '1.0.0',
            serverName: parsed.params.serverName || 'unknown',
            supportedProtocols: parsed.params.supportedProtocols || [],
          };
          this.connections.set(connectionId, connection);
        }
      }
    } catch (error) {
      console.error('Failed to parse MCP message:', error);
    }
  }

  async pingConnection(connectionId: string): Promise<boolean> {
    const ws = this.websockets.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      await this.sendRequest(connectionId, 'ping', {});
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastPingAt = new Date();
        this.connections.set(connectionId, connection);
      }
      return true;
    } catch {
      return false;
    }
  }

  async pingAllConnections(): Promise<void> {
    for (const [id, connection] of this.connections.entries()) {
      if (connection.status === 'connected') {
        const success = await this.pingConnection(id);
        if (!success) {
          this.updateConnectionStatus(id, 'disconnected');
        }
      }
    }
  }

  async cleanupDisconnectedConnections(sessionId: string): Promise<void> {
    for (const [id, connection] of this.connections.entries()) {
      if (connection.sessionId === sessionId && connection.status === 'disconnected') {
        this.connections.delete(id);
        const ws = this.websockets.get(id);
        if (ws) {
          ws.close();
          this.websockets.delete(id);
        }
      }
    }
  }
}

export const mcpService = new MCPService();