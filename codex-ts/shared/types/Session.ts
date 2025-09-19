import { z } from 'zod';
import { ConfigurationSchema } from './Configuration.js';

export const SessionStatusSchema = z.enum(['active', 'idle', 'disconnected']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  workspaceDir: z.string().min(1),
  config: z.lazy(() => ConfigurationSchema),
  createdAt: z.date(),
  lastActivityAt: z.date(),
  status: SessionStatusSchema,
});

export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = z.object({
  workspaceDir: z.string().min(1),
  configId: z.string().uuid().optional(),
});

export type CreateSession = z.infer<typeof CreateSessionSchema>;