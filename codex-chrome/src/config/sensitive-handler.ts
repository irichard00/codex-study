/**
 * T025: Sensitive data handler
 */

import type { EnvironmentConfig } from './env-types';

const SENSITIVE_PATTERNS = [
  'API_KEY',
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'CREDENTIAL',
  'PRIVATE',
];

export function isSensitive(key: string): boolean {
  const upperKey = key.toUpperCase();
  return SENSITIVE_PATTERNS.some(pattern => upperKey.includes(pattern));
}

export function redactValue(value: string, key: string): string {
  if (!value || value === '') {
    return '[EMPTY]';
  }
  return '[REDACTED]';
}

export function validateApiKeyFormat(key: string, value: string): boolean {
  if (!value || value.trim() === '') return false;

  if (key.includes('OPENAI')) {
    return value.startsWith('sk-') && value.length > 20;
  }

  if (key.includes('ANTHROPIC')) {
    return value.startsWith('sk-ant-') && value.length > 20;
  }

  // Generic validation
  return value.length >= 10;
}

export function sanitizeForLogging(config: EnvironmentConfig): EnvironmentConfig {
  const sanitized: EnvironmentConfig = {};

  for (const [key, value] of Object.entries(config)) {
    if (value && isSensitive(key)) {
      sanitized[key] = redactValue(value, key);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function sanitizeForBuild(config: any): any {
  const sanitized = JSON.parse(JSON.stringify(config));
  const redactedFields: string[] = [];

  function recursiveSanitize(obj: any, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (isSensitive(key)) {
        obj[key] = '{{RUNTIME_REPLACE}}';
        redactedFields.push(fullPath);
      } else if (typeof value === 'object' && value !== null) {
        recursiveSanitize(value, fullPath);
      }
    }
  }

  recursiveSanitize(sanitized);

  // Add metadata about redacted fields
  sanitized._metadata = {
    ...sanitized._metadata,
    redactedFields,
  };

  return sanitized;
}

// Optional encryption/decryption (basic implementation)
const SIMPLE_KEY = 'codex-chrome-env-config';

export function encryptSensitiveValue(value: string): string {
  // This is a simple XOR cipher for demonstration
  // In production, use proper encryption
  let encrypted = '';
  for (let i = 0; i < value.length; i++) {
    encrypted += String.fromCharCode(
      value.charCodeAt(i) ^ SIMPLE_KEY.charCodeAt(i % SIMPLE_KEY.length)
    );
  }
  return Buffer.from(encrypted).toString('base64');
}

export function decryptSensitiveValue(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString();
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(
        decoded.charCodeAt(i) ^ SIMPLE_KEY.charCodeAt(i % SIMPLE_KEY.length)
      );
    }
    return decrypted;
  } catch {
    throw new Error('Failed to decrypt value');
  }
}