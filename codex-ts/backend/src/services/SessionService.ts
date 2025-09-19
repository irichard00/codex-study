import { v4 as uuidv4 } from 'uuid';
import type { Session, CreateSession } from '../../../shared/types/index.js';
import { ConfigurationService } from './ConfigurationService.js';

export class SessionService {
  private sessions: Map<string, Session> = new Map();
  private configService = new ConfigurationService();

  async createSession(data: CreateSession): Promise<Session> {
    const config = data.configId
      ? await this.configService.getConfiguration(data.configId)
      : await this.configService.getDefaultConfiguration();

    const session: Session = {
      id: uuidv4(),
      workspaceDir: data.workspaceDir,
      config,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async listSessions(status?: Session['status']): Promise<Session[]> {
    const allSessions = Array.from(this.sessions.values());
    if (status) {
      return allSessions.filter((s) => s.status === status);
    }
    return allSessions;
  }

  async updateSessionActivity(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivityAt = new Date();
      this.sessions.set(id, session);
    }
  }

  async updateSessionStatus(id: string, status: Session['status']): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.status = status;
      this.sessions.set(id, session);
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  // Clean up expired sessions (24 hours)
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    for (const [id, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivityAt.getTime();
      if (timeSinceActivity > expiryTime) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionService = new SessionService();