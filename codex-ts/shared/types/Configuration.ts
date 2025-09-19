import { z } from 'zod';

export const SandboxModeSchema = z.enum([
  'read-only',
  'workspace-write',
  'danger-full-access',
]);
export type SandboxMode = z.infer<typeof SandboxModeSchema>;

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  capabilities: z.array(z.string()).default([]),
});
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  desktop: z.boolean().default(false),
  sound: z.boolean().default(false),
});
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;

export const ConfigurationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sandboxMode: SandboxModeSchema.default('read-only'),
  mcpServers: z.array(MCPServerConfigSchema).default([]),
  notificationSettings: NotificationConfigSchema.default({
    enabled: true,
    desktop: false,
    sound: false,
  }),
  authEnabled: z.boolean().default(false),
  customSettings: z.record(z.any()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

export const CreateConfigurationSchema = z.object({
  name: z.string(),
  sandboxMode: SandboxModeSchema.optional(),
  mcpServers: z.array(MCPServerConfigSchema).optional(),
  authEnabled: z.boolean().optional(),
});

export type CreateConfiguration = z.infer<typeof CreateConfigurationSchema>;