import { z } from 'zod';

export const TaskTypeSchema = z.enum([
  'file_read',
  'file_write',
  'file_search',
  'execute_command',
  'mcp_request',
  'code_generation',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskMetadataSchema = z.record(z.any());
export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  input: z.any(),
  output: z.any().optional(),
  error: z.string().optional(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  metadata: TaskMetadataSchema,
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = z.object({
  type: TaskTypeSchema,
  input: z.any(),
});
export type CreateTask = z.infer<typeof CreateTaskSchema>;