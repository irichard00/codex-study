/**
 * T024: Config validation utilities
 */

import type { EnvironmentConfig, ValidationResult, ValidationError, ValidationWarning } from './env-types';
import { transformers } from './type-transformers';

// Environment variable type definitions
const ENV_VAR_TYPES: Record<string, string | string[]> = {
  // Numbers
  CODEX_MODEL_CONTEXT_WINDOW: 'number',
  CODEX_MODEL_MAX_OUTPUT_TOKENS: 'number',
  CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT: 'number',
  CODEX_CACHE_TTL: 'number',
  CODEX_CACHE_MAX_SIZE: 'number',
  CODEX_EXTENSION_STORAGE_QUOTA_WARNING: 'number',

  // Booleans
  CODEX_CACHE_ENABLED: 'boolean',
  CODEX_CACHE_COMPRESSION_ENABLED: 'boolean',
  CODEX_CACHE_PERSIST_TO_STORAGE: 'boolean',
  CODEX_PREFERENCES_AUTO_SYNC: 'boolean',
  CODEX_PREFERENCES_TELEMETRY_ENABLED: 'boolean',
  CODEX_EXTENSION_ENABLED: 'boolean',
  CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED: 'boolean',

  // Enums
  CODEX_MODEL_REASONING_EFFORT: ['low', 'medium', 'high'],
  CODEX_MODEL_REASONING_SUMMARY: ['none', 'brief', 'detailed'],
  CODEX_MODEL_VERBOSITY: ['low', 'medium', 'high'],
  CODEX_PREFERENCES_THEME: ['light', 'dark', 'system'],
  CODEX_EXTENSION_UPDATE_CHANNEL: ['stable', 'beta'],

  // Arrays
  CODEX_EXTENSION_ALLOWED_ORIGINS: 'array',
};

export async function validate(config: EnvironmentConfig): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate types
  for (const [key, value] of Object.entries(config)) {
    if (!value) continue;

    const expectedType = ENV_VAR_TYPES[key];
    if (!expectedType) continue;

    try {
      if (expectedType === 'number') {
        transformers.number(value);
      } else if (expectedType === 'boolean') {
        transformers.boolean(value);
      } else if (expectedType === 'array') {
        transformers.array(value);
      } else if (Array.isArray(expectedType)) {
        transformers.enum(value, expectedType as any);
      }
    } catch (error: any) {
      errors.push({
        field: key,
        value,
        message: error.message,
      });
    }
  }

  // Validate URLs
  const urlFields = [
    'CODEX_PROVIDER_OPENAI_BASE_URL',
    'CODEX_PROVIDER_ANTHROPIC_BASE_URL',
  ];

  for (const field of urlFields) {
    if (config[field]) {
      try {
        transformers.url(config[field]!);
      } catch (error: any) {
        errors.push({
          field,
          value: config[field],
          message: `Invalid URL format: ${error.message}`,
        });
      }
    }
  }

  // Business rule validations
  const contextWindow = config.CODEX_MODEL_CONTEXT_WINDOW;
  const maxOutputTokens = config.CODEX_MODEL_MAX_OUTPUT_TOKENS;

  if (contextWindow && maxOutputTokens) {
    const cw = Number(contextWindow);
    const mot = Number(maxOutputTokens);
    if (!isNaN(cw) && !isNaN(mot) && mot > cw) {
      errors.push({
        field: 'CODEX_MODEL_MAX_OUTPUT_TOKENS',
        value: maxOutputTokens,
        message: `maxOutputTokens (${mot}) cannot exceed contextWindow (${cw})`,
      });
    }
  }

  // Storage quota validation
  const quotaWarning = config.CODEX_EXTENSION_STORAGE_QUOTA_WARNING;
  if (quotaWarning) {
    const quota = Number(quotaWarning);
    if (!isNaN(quota) && (quota < 0 || quota > 100)) {
      errors.push({
        field: 'CODEX_EXTENSION_STORAGE_QUOTA_WARNING',
        value: quotaWarning,
        message: 'Storage quota warning must be between 0 and 100',
      });
    }
  }

  // Check for API keys
  const hasOpenAIKey = config.CODEX_PROVIDER_OPENAI_API_KEY;
  const hasAnthropicKey = config.CODEX_PROVIDER_ANTHROPIC_API_KEY;

  if (!hasOpenAIKey && !hasAnthropicKey) {
    errors.push({
      field: 'API_KEY',
      value: undefined,
      message: 'At least one provider must have an API key configured',
      required: true,
    });
  }

  // Add warnings for missing optional values
  if (!config.CODEX_MODEL_SELECTED) {
    warnings.push({
      field: 'CODEX_MODEL_SELECTED',
      message: 'No model selected, will use default',
      suggestion: 'Add CODEX_MODEL_SELECTED=gpt-4 to your .env file',
    });
  }

  if (!config.CODEX_MODEL_PROVIDER) {
    warnings.push({
      field: 'CODEX_MODEL_PROVIDER',
      message: 'No provider specified, will use default',
      suggestion: 'Add CODEX_MODEL_PROVIDER=openai to your .env file',
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateApiKeyFormat(key: string, value: string): boolean {
  if (!value || value.length === 0) return false;

  if (key.includes('OPENAI')) {
    return value.startsWith('sk-') && value.length > 20;
  }

  if (key.includes('ANTHROPIC')) {
    return value.startsWith('sk-ant-') && value.length > 20;
  }

  // Generic API key validation (minimum length)
  return value.length >= 10;
}