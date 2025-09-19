import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'task_complete',
  'error',
  'system',
  'mcp_event',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSeveritySchema = z.enum(['info', 'warning', 'error', 'success']);
export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string().max(100),
  message: z.string().max(1000),
  severity: NotificationSeveritySchema,
  timestamp: z.date(),
  read: z.boolean().default(false),
  metadata: z.any().optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;