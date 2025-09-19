import { z } from 'zod';
import { TaskSchema } from './Task.js';

export const AgentStatusSchema = z.enum([
  'idle',
  'thinking',
  'executing',
  'waiting_input',
  'error',
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  model: z.string(),
  status: AgentStatusSchema,
  currentTask: z.lazy(() => TaskSchema).optional(),
  conversationId: z.string().uuid(),
  createdAt: z.date(),
  lastResponseAt: z.date().optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const CreateAgentSchema = z.object({
  model: z.string(),
});

export type CreateAgent = z.infer<typeof CreateAgentSchema>;