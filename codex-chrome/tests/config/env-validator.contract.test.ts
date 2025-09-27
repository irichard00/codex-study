/**
 * Contract test for config/validate endpoint
 * Tests the environment configuration validation contract
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { EnvironmentConfig } from '../../src/config/types';
import type { ValidationResult, ValidationError, ValidationWarning } from '../../src/config/types';

describe('EnvValidator Contract Tests', () => {
  let validator: any; // Will be properly typed when implementation exists

  beforeEach(() => {
    // This will fail until implementation exists
    validator = undefined;
  });

  describe('POST /config/validate', () => {
    it('should validate valid environment configuration', async () => {
      const validConfig: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_MODEL_PROVIDER: 'openai',
        CODEX_MODEL_CONTEXT_WINDOW: '128000',
        CODEX_MODEL_MAX_OUTPUT_TOKENS: '4096',
      };

      const result: ValidationResult = await validator?.validate(validConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return validation errors for invalid types', async () => {
      const invalidConfig: EnvironmentConfig = {
        CODEX_MODEL_CONTEXT_WINDOW: 'not-a-number',
        CODEX_CACHE_TTL: 'also-not-a-number',
        CODEX_CACHE_ENABLED: 'not-a-boolean',
      };

      const result: ValidationResult = await validator?.validate(invalidConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(3);

      const contextWindowError = result.errors?.find(e => e.field === 'CODEX_MODEL_CONTEXT_WINDOW');
      expect(contextWindowError).toBeDefined();
      expect(contextWindowError?.message).toContain('number');
    });

    it('should validate enum values', async () => {
      const invalidEnumConfig: EnvironmentConfig = {
        CODEX_MODEL_REASONING_EFFORT: 'extreme', // Invalid enum value
        CODEX_PREFERENCES_THEME: 'rainbow', // Invalid enum value
      };

      const result: ValidationResult = await validator?.validate(invalidEnumConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBe(2);

      const effortError = result.errors?.find(e => e.field === 'CODEX_MODEL_REASONING_EFFORT');
      expect(effortError?.message).toContain('low, medium, high');
    });

    it('should validate business rule: maxOutputTokens <= contextWindow', async () => {
      const invalidBusinessRule: EnvironmentConfig = {
        CODEX_MODEL_CONTEXT_WINDOW: '1000',
        CODEX_MODEL_MAX_OUTPUT_TOKENS: '2000', // Greater than context window
      };

      const result: ValidationResult = await validator?.validate(invalidBusinessRule);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();

      const businessError = result.errors?.find(e =>
        e.message.includes('maxOutputTokens') && e.message.includes('contextWindow')
      );
      expect(businessError).toBeDefined();
    });

    it('should provide warnings for missing optional values', async () => {
      const minimalConfig: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_MODEL_PROVIDER: 'openai',
      };

      const result: ValidationResult = await validator?.validate(minimalConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);

      const apiKeyWarning = result.warnings?.find(w =>
        w.message.includes('API key')
      );
      expect(apiKeyWarning).toBeDefined();
      expect(apiKeyWarning?.suggestion).toBeDefined();
    });

    it('should validate array/list values', async () => {
      const arrayConfig: EnvironmentConfig = {
        CODEX_EXTENSION_ALLOWED_ORIGINS: 'https://example.com,https://api.example.com',
      };

      const result: ValidationResult = await validator?.validate(arrayConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    it('should validate URL formats', async () => {
      const urlConfig: EnvironmentConfig = {
        CODEX_PROVIDER_OPENAI_BASE_URL: 'not-a-url',
        CODEX_PROVIDER_ANTHROPIC_BASE_URL: 'https://valid-url.com',
      };

      const result: ValidationResult = await validator?.validate(urlConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);

      const urlError = result.errors?.find(e => e.field === 'CODEX_PROVIDER_OPENAI_BASE_URL');
      expect(urlError?.message).toContain('URL');
    });

    it('should validate storage quota warning range', async () => {
      const quotaConfig: EnvironmentConfig = {
        CODEX_EXTENSION_STORAGE_QUOTA_WARNING: '150', // Should be 0-100
      };

      const result: ValidationResult = await validator?.validate(quotaConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);

      const quotaError = result.errors?.find(e => e.field === 'CODEX_EXTENSION_STORAGE_QUOTA_WARNING');
      expect(quotaError?.message).toContain('0 and 100');
    });

    it('should mark API keys as required for at least one provider', async () => {
      const noApiKeys: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_MODEL_PROVIDER: 'openai',
        // No API keys provided
      };

      const result: ValidationResult = await validator?.validate(noApiKeys);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);

      const apiKeyError = result.errors?.find(e =>
        e.message.includes('API key') && e.required === true
      );
      expect(apiKeyError).toBeDefined();
    });
  });
});