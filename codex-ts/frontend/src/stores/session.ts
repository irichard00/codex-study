import { writable } from 'svelte/store';
import type { Session } from '../../../shared/types';
import { apiClient } from '../services/api';

function createSessionStore() {
  const { subscribe, set, update } = writable<Session | null>(null);

  return {
    subscribe,
    set,
    get: () => {
      let value: Session | null = null;
      subscribe((v) => (value = v))();
      return value;
    },
  };
}

export const sessionStore = createSessionStore();

export async function createSession(workspaceDir: string): Promise<Session> {
  const session = await apiClient.post('/api/sessions', { workspaceDir });
  sessionStore.set(session);

  // Create agent for the session
  await apiClient.post(`/api/sessions/${session.id}/agents`, { model: 'gpt-4' });

  return session;
}