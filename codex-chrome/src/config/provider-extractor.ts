/**
 * T022: Provider extraction logic
 */

import type { EnvironmentConfig } from './env-types';
import type { IProviderConfig } from './types';
import { transformers } from './type-transformers';

const PROVIDER_PATTERN = /^CODEX_PROVIDER_([A-Z0-9_]+)_(.+)$/;

export function extractProviders(env: EnvironmentConfig): Record<string, IProviderConfig> {
  const providers: Record<string, IProviderConfig> = {};

  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;

    const match = key.match(PROVIDER_PATTERN);
    if (!match) continue;

    const [, providerKey, fieldKey] = match;
    const providerId = normalizeProviderId(providerKey);
    const fieldName = normalizeFieldName(fieldKey);

    // Initialize provider if not exists
    if (!providers[providerId]) {
      providers[providerId] = {
        id: providerId,
        name: capitalize(providerId),
        apiKey: '',
        timeout: 30000, // Default timeout
      };
    }

    // Set field value with appropriate transformation
    if (fieldName === 'timeout') {
      providers[providerId].timeout = transformers.number(value);
    } else if (fieldName === 'headers') {
      try {
        providers[providerId].headers = JSON.parse(value);
      } catch {
        console.warn(`Failed to parse headers for ${providerId}: ${value}`);
      }
    } else if (fieldName.startsWith('retry')) {
      // Handle retry config
      if (!providers[providerId].retryConfig) {
        providers[providerId].retryConfig = {};
      }
      const retryField = fieldName.replace('retry', '').toLowerCase();
      if (retryField === 'maxretries') {
        providers[providerId].retryConfig!.maxRetries = transformers.number(value);
      } else if (retryField === 'initialdelay') {
        providers[providerId].retryConfig!.initialDelay = transformers.number(value);
      } else if (retryField === 'maxdelay') {
        providers[providerId].retryConfig!.maxDelay = transformers.number(value);
      } else if (retryField === 'backoffmultiplier') {
        providers[providerId].retryConfig!.backoffMultiplier = transformers.number(value);
      }
    } else {
      // Direct field assignment
      (providers[providerId] as any)[fieldName] = value;
    }
  }

  return providers;
}

export function normalizeProviderId(key: string): string {
  return key.toLowerCase();
}

export function getProviderField(key: string): { providerId: string; field: string } | null {
  const match = key.match(PROVIDER_PATTERN);
  if (!match) return null;

  const [, providerKey, fieldKey] = match;
  return {
    providerId: normalizeProviderId(providerKey),
    field: normalizeFieldName(fieldKey),
  };
}

function normalizeFieldName(fieldKey: string): string {
  // Convert SNAKE_CASE to camelCase
  const parts = fieldKey.toLowerCase().split('_');
  if (parts.length === 1) return parts[0];

  return parts[0] + parts.slice(1).map(capitalize).join('');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}