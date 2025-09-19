import { z } from 'zod';

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const AttachmentTypeSchema = z.enum(['file', 'image', 'code']);
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  type: AttachmentTypeSchema,
  name: z.string(),
  content: z.string(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const MessageMetadataSchema = z.object({
  model: z.string().optional(),
  tokens: z.number().optional(),
  processingTime: z.number().optional(),
});
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
  timestamp: z.date(),
  metadata: MessageMetadataSchema.optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationContextSchema = z.object({
  workspaceFiles: z.array(z.string()),
  activeFile: z.string().optional(),
  recentCommands: z.array(z.string()),
  environment: z.record(z.string()),
});
export type ConversationContext = z.infer<typeof ConversationContextSchema>;

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  messages: z.array(MessageSchema),
  context: ConversationContextSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const SendMessageSchema = z.object({
  content: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
});
export type SendMessage = z.infer<typeof SendMessageSchema>;