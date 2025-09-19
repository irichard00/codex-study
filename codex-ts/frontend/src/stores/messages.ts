import { writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../../../shared/types';

function createMessagesStore() {
  const { subscribe, set, update } = writable<Message[]>([]);

  return {
    subscribe,
    addMessage: (message: Partial<Message>) => {
      update((messages) => [
        ...messages,
        {
          id: message.id || uuidv4(),
          role: message.role || 'user',
          content: message.content || '',
          timestamp: message.timestamp || new Date(),
          attachments: message.attachments,
          metadata: message.metadata,
        } as Message,
      ]);
    },
    clear: () => set([]),
  };
}

export const messagesStore = createMessagesStore();