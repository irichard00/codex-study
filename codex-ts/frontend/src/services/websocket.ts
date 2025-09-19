import { v4 as uuidv4 } from 'uuid';
import type { WebSocketMessage } from '../../../shared/types';

class WebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private sequenceNumber = 0;

  async connect(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sessionId = sessionId;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3000/ws?sessionId=${sessionId}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.stopHeartbeat();
        this.reconnect();
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
  }

  sendMessage(content: string): void {
    this.send('SEND_MESSAGE', { content });
  }

  executeTask(taskType: string, input: any): void {
    this.send('EXECUTE_TASK', { taskType, input });
  }

  searchFiles(query: string, fuzzy = true): void {
    this.send('SEARCH_FILES', { query, fuzzy });
  }

  private send(type: string, payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message: WebSocketMessage = {
      id: uuidv4(),
      type: type as any,
      payload,
      timestamp: new Date(),
      sessionId: this.sessionId!,
      sequenceNumber: this.sequenceNumber++,
    };

    this.ws.send(JSON.stringify(message));
  }

  private handleMessage(message: WebSocketMessage): void {
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach((callback) => callback(message.payload));
    }
  }

  on(type: string, callback: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  off(type: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private heartbeatInterval: number | null = null;

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      this.send('HEARTBEAT', { timestamp: new Date().toISOString() });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Reconnecting in ${delay}ms...`);
    setTimeout(async () => {
      if (this.sessionId) {
        try {
          await this.connect(this.sessionId);
          this.reconnectAttempts = 0;
        } catch (error) {
          console.error('Reconnection failed:', error);
          this.reconnect();
        }
      }
    }, delay);
  }
}

export const websocketService = new WebSocketService();