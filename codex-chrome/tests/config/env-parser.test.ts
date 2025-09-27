/**
 * Unit test for environment variable parsing
 */

import { describe, it, expect } from 'vitest';
import type { EnvironmentConfig } from '../../src/config/types';

describe('Environment Variable Parser', () => {
  let parseEnvFile: (content: string) => EnvironmentConfig;
  let parseEnvLine: (line: string) => { key: string; value: string } | null;

  beforeEach(() => {
    // This will fail until implementation exists
    // @ts-ignore - Implementation not yet created
    parseEnvFile = undefined;
    // @ts-ignore
    parseEnvLine = undefined;
  });

  describe('parseEnvFile', () => {
    it('should parse basic key-value pairs', () => {
      const content = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_CACHE_ENABLED=true
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_MODEL_PROVIDER).toBe('openai');
      expect(result.CODEX_CACHE_ENABLED).toBe('true');
    });

    it('should handle comments', () => {
      const content = `
# This is a comment
CODEX_MODEL_SELECTED=gpt-4
# Another comment
# CODEX_MODEL_PROVIDER=anthropic # This whole line is commented
CODEX_MODEL_PROVIDER=openai
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_MODEL_PROVIDER).toBe('openai'); // Not 'anthropic'
    });

    it('should handle empty lines', () => {
      const content = `

CODEX_MODEL_SELECTED=gpt-4

CODEX_MODEL_PROVIDER=openai

`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBe(2);
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_MODEL_PROVIDER).toBe('openai');
    });

    it('should handle values with spaces', () => {
      const content = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_PROVIDER_OPENAI_BASE_URL=https://api.openai.com/v1
CODEX_EXTENSION_ALLOWED_ORIGINS=https://example.com, https://api.example.com
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_PROVIDER_OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
      expect(result.CODEX_EXTENSION_ALLOWED_ORIGINS).toBe('https://example.com, https://api.example.com');
    });

    it('should handle quoted values', () => {
      const content = `
CODEX_MODEL_SELECTED="gpt-4"
CODEX_PROVIDER_OPENAI_API_KEY='sk-test-key-123'
CODEX_CUSTOM_VALUE="value with spaces and = signs"
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4'); // Quotes removed
      expect(result.CODEX_PROVIDER_OPENAI_API_KEY).toBe('sk-test-key-123'); // Quotes removed
      expect(result.CODEX_CUSTOM_VALUE).toBe('value with spaces and = signs');
    });

    it('should handle special characters', () => {
      const content = `
CODEX_PROVIDER_OPENAI_API_KEY=sk-proj-abc123!@#$%^&*()
CODEX_CUSTOM_HEADER=Bearer token-with-special-chars_123
CODEX_URL_WITH_PARAMS=https://api.example.com/v1?param1=value1&param2=value2
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_PROVIDER_OPENAI_API_KEY).toBe('sk-proj-abc123!@#$%^&*()');
      expect(result.CODEX_CUSTOM_HEADER).toBe('Bearer token-with-special-chars_123');
      expect(result.CODEX_URL_WITH_PARAMS).toBe('https://api.example.com/v1?param1=value1&param2=value2');
    });

    it('should handle inline comments', () => {
      const content = `
CODEX_MODEL_SELECTED=gpt-4 # This is the selected model
CODEX_CACHE_ENABLED=true # Enable caching
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4'); // Comment stripped
      expect(result.CODEX_CACHE_ENABLED).toBe('true');
    });

    it('should handle multiline values with backslash', () => {
      const content = `
CODEX_LONG_VALUE=This is a very \\
long value that spans \\
multiple lines
CODEX_MODEL_SELECTED=gpt-4
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_LONG_VALUE).toBe('This is a very long value that spans multiple lines');
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
    });

    it('should handle export statements', () => {
      const content = `
export CODEX_MODEL_SELECTED=gpt-4
export CODEX_MODEL_PROVIDER=openai
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_MODEL_PROVIDER).toBe('openai');
    });

    it('should override duplicate keys with last value', () => {
      const content = `
CODEX_MODEL_SELECTED=gpt-3.5-turbo
CODEX_MODEL_SELECTED=gpt-4
`;

      const result = parseEnvFile?.(content);

      expect(result).toBeDefined();
      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4'); // Last value wins
    });
  });

  describe('parseEnvLine', () => {
    it('should parse simple key-value', () => {
      const result = parseEnvLine?.('KEY=value');

      expect(result).toBeDefined();
      expect(result?.key).toBe('KEY');
      expect(result?.value).toBe('value');
    });

    it('should return null for comments', () => {
      const result = parseEnvLine?.('# This is a comment');

      expect(result).toBeNull();
    });

    it('should return null for empty lines', () => {
      const result = parseEnvLine?.('');

      expect(result).toBeNull();
    });

    it('should handle equals sign in value', () => {
      const result = parseEnvLine?.('URL=https://api.example.com/v1?key=value');

      expect(result).toBeDefined();
      expect(result?.key).toBe('URL');
      expect(result?.value).toBe('https://api.example.com/v1?key=value');
    });

    it('should trim whitespace', () => {
      const result = parseEnvLine?.('  KEY  =  value  ');

      expect(result).toBeDefined();
      expect(result?.key).toBe('KEY');
      expect(result?.value).toBe('value');
    });

    it('should handle empty value', () => {
      const result = parseEnvLine?.('KEY=');

      expect(result).toBeDefined();
      expect(result?.key).toBe('KEY');
      expect(result?.value).toBe('');
    });

    it('should return null for invalid lines', () => {
      expect(parseEnvLine?.('invalid line without equals')).toBeNull();
      expect(parseEnvLine?.('=')).toBeNull();
      expect(parseEnvLine?.('=value')).toBeNull();
    });
  });
});