/**
 * T020: Zod schemas for environment config
 */

import { z } from 'zod';

// Model configuration schema
export const modelConfigSchema = z.object({
  selected: z.string().optional(),
  provider: z.string().optional(),
  contextWindow: z.number().optional().nullable(),
  maxOutputTokens: z.number().optional().nullable(),
  autoCompactTokenLimit: z.number().optional().nullable(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional().nullable(),
  reasoningSummary: z.enum(['none', 'brief', 'detailed']).optional(),
  verbosity: z.enum(['low', 'medium', 'high']).optional().nullable(),
});

// Provider configuration schema
export const providerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string().url().optional().nullable(),
  organization: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().min(1000).max(600000),
  retryConfig: z.object({
    maxRetries: z.number().min(0).max(10).optional(),
    initialDelay: z.number().min(100).optional(),
    maxDelay: z.number().max(60000).optional(),
    backoffMultiplier: z.number().min(1).max(5).optional(),
  }).optional(),
});

// User preferences schema
export const userPreferencesSchema = z.object({
  autoSync: z.boolean().optional(),
  telemetryEnabled: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  shortcuts: z.record(z.string()).optional(),
  experimental: z.record(z.boolean()).optional(),
});

// Cache settings schema
export const cacheSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  ttl: z.number().min(0).optional(),
  maxSize: z.number().min(0).optional(),
  compressionEnabled: z.boolean().optional(),
  persistToStorage: z.boolean().optional(),
});

// Permission settings schema
export const permissionSettingsSchema = z.object({
  tabs: z.boolean().optional(),
  storage: z.boolean().optional(),
  notifications: z.boolean().optional(),
  clipboardRead: z.boolean().optional(),
  clipboardWrite: z.boolean().optional(),
});

// Extension settings schema
export const extensionSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  contentScriptEnabled: z.boolean().optional(),
  allowedOrigins: z.array(z.string()).optional(),
  storageQuotaWarning: z.number().min(0).max(100).optional(),
  updateChannel: z.enum(['stable', 'beta']).optional(),
  permissions: permissionSettingsSchema.optional(),
});

// Complete Chrome config schema
export const chromeConfigSchema = z.object({
  version: z.string(),
  model: modelConfigSchema,
  providers: z.record(providerConfigSchema),
  profiles: z.record(z.object({
    name: z.string(),
    description: z.string().optional().nullable(),
    model: z.string(),
    provider: z.string(),
    modelSettings: modelConfigSchema.partial().optional(),
    created: z.number(),
    lastUsed: z.number().optional().nullable(),
  })).optional(),
  activeProfile: z.string().optional().nullable(),
  preferences: userPreferencesSchema,
  cache: cacheSettingsSchema,
  extension: extensionSettingsSchema,
});

// Environment config schema (raw strings)
export const envConfigSchema = z.record(z.string());

// Validation function
export function validateConfig(config: any): z.SafeParseReturnType<any, any> {
  return chromeConfigSchema.safeParse(config);
}

export function validateEnvConfig(env: any): z.SafeParseReturnType<any, any> {
  return envConfigSchema.safeParse(env);
}