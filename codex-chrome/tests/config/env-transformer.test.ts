/**
 * T017: Environment Configuration Transformer Tests
 * Tests for type transformations and validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigTransformer, type IConfigTransformer } from '@config/env-transformer';
import type { EnvironmentConfig, ValidationResult } from '@config/env-types';
import type { IChromeConfig } from '@config/types';

describe('ConfigTransformer', () => {
  let transformer: IConfigTransformer;

  beforeEach(() => {
    transformer = new ConfigTransformer();
  });

  describe('transform', () => {
    it('should transform flat environment to hierarchical config', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_MODEL_PROVIDER: 'openai',
        CODEX_MODEL_CONTEXT_WINDOW: '128000',
        CODEX_MODEL_MAX_OUTPUT_TOKENS: '4096',
        CODEX_PROVIDER_OPENAI_API_KEY: 'sk-test-key'
      };

      const result = await transformer.transform(env);

      expect(result.model).toEqual({
        selected: 'gpt-4',
        provider: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 4096
      });

      expect(result.providers).toHaveProperty('openai');
      expect(result.providers!.openai.apiKey).toBe('sk-test-key');
    });

    it('should transform model configuration correctly', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'claude-3',
        CODEX_MODEL_PROVIDER: 'anthropic',
        CODEX_MODEL_REASONING_EFFORT: 'high',
        CODEX_MODEL_REASONING_SUMMARY: 'detailed',
        CODEX_MODEL_VERBOSITY: 'medium'
      };

      const result = await transformer.transform(env);

      expect(result.model).toEqual({
        selected: 'claude-3',
        provider: 'anthropic',
        reasoningEffort: 'high',
        reasoningSummary: 'detailed',
        verbosity: 'medium'
      });
    });

    it('should transform preferences configuration', async () => {
      const env: EnvironmentConfig = {
        CODEX_PREFERENCES_AUTO_SYNC: 'true',
        CODEX_PREFERENCES_TELEMETRY_ENABLED: 'false',
        CODEX_PREFERENCES_THEME: 'dark'
      };

      const result = await transformer.transform(env);

      expect(result.preferences).toEqual({
        autoSync: true,
        telemetryEnabled: false,
        theme: 'dark'
      });
    });

    it('should transform cache configuration', async () => {
      const env: EnvironmentConfig = {
        CODEX_CACHE_ENABLED: 'true',
        CODEX_CACHE_TTL: '3600',
        CODEX_CACHE_MAX_SIZE: '104857600',
        CODEX_CACHE_COMPRESSION_ENABLED: 'false',
        CODEX_CACHE_PERSIST_TO_STORAGE: 'true'
      };

      const result = await transformer.transform(env);

      expect(result.cache).toEqual({
        enabled: true,
        ttl: 3600,
        maxSize: 104857600,
        compressionEnabled: false,
        persistToStorage: true
      });
    });

    it('should transform extension configuration', async () => {
      const env: EnvironmentConfig = {
        CODEX_EXTENSION_ENABLED: 'true',
        CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED: 'false',
        CODEX_EXTENSION_ALLOWED_ORIGINS: 'https://example.com,https://test.com',
        CODEX_EXTENSION_STORAGE_QUOTA_WARNING: '80',
        CODEX_EXTENSION_UPDATE_CHANNEL: 'beta'
      };

      const result = await transformer.transform(env);

      expect(result.extension).toEqual({
        enabled: true,
        contentScriptEnabled: false,
        allowedOrigins: ['https://example.com', 'https://test.com'],
        storageQuotaWarning: 80,
        updateChannel: 'beta'
      });
    });

    it('should transform extension permissions', async () => {
      const env: EnvironmentConfig = {
        CODEX_EXTENSION_PERMISSIONS_TABS: 'true',
        CODEX_EXTENSION_PERMISSIONS_STORAGE: 'true',
        CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS: 'false',
        CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_READ: 'true',
        CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_WRITE: 'false'
      };

      const result = await transformer.transform(env);

      expect(result.extension!.permissions).toEqual({
        tabs: true,
        storage: true,
        notifications: false,
        clipboardRead: true,
        clipboardWrite: false
      });
    });

    it('should handle partial configuration', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_CACHE_ENABLED: 'true'
      };

      const result = await transformer.transform(env);

      expect(result.model).toEqual({
        selected: 'gpt-4'
      });
      expect(result.cache).toEqual({
        enabled: true
      });
      expect(result.preferences).toBeUndefined();
      expect(result.extension).toBeUndefined();
    });

    it('should skip empty sections', async () => {
      const env: EnvironmentConfig = {
        SOME_OTHER_VAR: 'value'
      };

      const result = await transformer.transform(env);

      expect(result.model).toBeUndefined();
      expect(result.preferences).toBeUndefined();
      expect(result.cache).toBeUndefined();
      expect(result.extension).toBeUndefined();
    });

    it('should handle invalid enum values gracefully', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_REASONING_EFFORT: 'invalid',
        CODEX_PREFERENCES_THEME: 'purple'
      };

      const result = await transformer.transform(env);

      // Should not include invalid enum values
      expect(result.model?.reasoningEffort).toBeUndefined();
      expect(result.preferences?.theme).toBeUndefined();
    });

    it('should handle provider extraction', async () => {
      const env: EnvironmentConfig = {
        CODEX_PROVIDER_OPENAI_API_KEY: 'sk-openai-key',
        CODEX_PROVIDER_ANTHROPIC_API_KEY: 'sk-ant-key',
        CODEX_PROVIDER_OPENAI_BASE_URL: 'https://api.openai.com/v1',
        CODEX_PROVIDER_OPENAI_NAME: 'Custom OpenAI'
      };

      const result = await transformer.transform(env);

      expect(result.providers).toHaveProperty('openai');
      expect(result.providers).toHaveProperty('anthropic');
      expect(result.providers!.openai.apiKey).toBe('sk-openai-key');
      expect(result.providers!.anthropic.apiKey).toBe('sk-ant-key');
    });
  });

  describe('validate', () => {
    it('should validate correct configuration', async () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'openai',
          contextWindow: 128000,
          maxOutputTokens: 4096
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        }
      };

      const result = await transformer.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect maxOutputTokens > contextWindow violation', async () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          contextWindow: 1000,
          maxOutputTokens: 2000
        }
      };

      const result = await transformer.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field).toBe('model');
      expect(result.errors![0].message).toContain('maxOutputTokens cannot exceed contextWindow');
    });

    it('should require at least one API key', async () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: ''
          }
        }
      };

      const result = await transformer.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field).toBe('providers');
      expect(result.errors![0].message).toContain('At least one provider must have an API key');
      expect(result.errors![0].required).toBe(true);
    });

    it('should accept valid API keys', async () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          },
          anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            apiKey: ''
          }
        }
      };

      const result = await transformer.validate(config);

      expect(result.valid).toBe(true);
    });

    it('should validate with Zod schema', async () => {
      const invalidConfig = {
        model: {
          selected: 123, // Should be string
          contextWindow: 'not-a-number' // Should be number
        }
      };

      const result = await transformer.validate(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle missing providers section', async () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4'
        }
      };

      const result = await transformer.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field).toBe('providers');
    });
  });

  describe('applyDefaults', () => {
    it('should merge with default configuration', async () => {
      const partialConfig: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4'
        }
      };

      const result = await transformer.applyDefaults(partialConfig);

      expect(result.model.selected).toBe('gpt-4');
      expect(result.model.contextWindow).toBeDefined(); // From defaults
      expect(result.providers).toBeDefined(); // From defaults
      expect(result.preferences).toBeDefined(); // From defaults
      expect(result.cache).toBeDefined(); // From defaults
      expect(result.extension).toBeDefined(); // From defaults
    });

    it('should override defaults with provided values', async () => {
      const partialConfig: Partial<IChromeConfig> = {
        cache: {
          enabled: false,
          ttl: 7200
        }
      };

      const result = await transformer.applyDefaults(partialConfig);

      expect(result.cache.enabled).toBe(false); // Overridden
      expect(result.cache.ttl).toBe(7200); // Overridden
      expect(result.cache.maxSize).toBeDefined(); // From defaults
    });

    it('should deeply merge nested objects', async () => {
      const partialConfig: Partial<IChromeConfig> = {
        extension: {
          enabled: false
        }
      };

      const result = await transformer.applyDefaults(partialConfig);

      expect(result.extension.enabled).toBe(false); // Overridden
      expect(result.extension.contentScriptEnabled).toBeDefined(); // From defaults
      expect(result.extension.permissions).toBeDefined(); // From defaults
    });

    it('should preserve complex provider configurations', async () => {
      const partialConfig: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'Custom OpenAI',
            apiKey: 'sk-custom-key',
            baseUrl: 'https://custom.openai.com'
          }
        }
      };

      const result = await transformer.applyDefaults(partialConfig);

      expect(result.providers.openai.name).toBe('Custom OpenAI'); // Overridden
      expect(result.providers.openai.apiKey).toBe('sk-custom-key'); // Overridden
      expect(result.providers.openai.baseUrl).toBe('https://custom.openai.com'); // Overridden
      expect(result.providers.anthropic).toBeDefined(); // From defaults
    });

    it('should return complete IChromeConfig', async () => {
      const partialConfig: Partial<IChromeConfig> = {};

      const result = await transformer.applyDefaults(partialConfig);

      // All required properties should be present
      expect(result.model).toBeDefined();
      expect(result.providers).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.cache).toBeDefined();
      expect(result.extension).toBeDefined();

      // Verify it satisfies the IChromeConfig interface
      expect(typeof result.model.selected).toBe('string');
      expect(typeof result.model.provider).toBe('string');
      expect(typeof result.preferences.autoSync).toBe('boolean');
      expect(typeof result.cache.enabled).toBe('boolean');
      expect(typeof result.extension.enabled).toBe('boolean');
    });
  });

  describe('Type transformations', () => {
    it('should handle boolean transformations', async () => {
      const env: EnvironmentConfig = {
        CODEX_CACHE_ENABLED: 'true',
        CODEX_EXTENSION_ENABLED: 'false',
        CODEX_PREFERENCES_AUTO_SYNC: '1',
        CODEX_PREFERENCES_TELEMETRY_ENABLED: '0'
      };

      const result = await transformer.transform(env);

      expect(result.cache!.enabled).toBe(true);
      expect(result.extension!.enabled).toBe(false);
      expect(result.preferences!.autoSync).toBe(true);
      expect(result.preferences!.telemetryEnabled).toBe(false);
    });

    it('should handle number transformations', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_CONTEXT_WINDOW: '128000',
        CODEX_CACHE_TTL: '3600',
        CODEX_EXTENSION_STORAGE_QUOTA_WARNING: '80'
      };

      const result = await transformer.transform(env);

      expect(result.model!.contextWindow).toBe(128000);
      expect(result.cache!.ttl).toBe(3600);
      expect(result.extension!.storageQuotaWarning).toBe(80);
    });

    it('should handle array transformations', async () => {
      const env: EnvironmentConfig = {
        CODEX_EXTENSION_ALLOWED_ORIGINS: 'https://example.com,https://test.com,https://api.service.com'
      };

      const result = await transformer.transform(env);

      expect(result.extension!.allowedOrigins).toEqual([
        'https://example.com',
        'https://test.com',
        'https://api.service.com'
      ]);
    });

    it('should handle enum transformations', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_REASONING_EFFORT: 'high',
        CODEX_PREFERENCES_THEME: 'system',
        CODEX_EXTENSION_UPDATE_CHANNEL: 'stable'
      };

      const result = await transformer.transform(env);

      expect(result.model!.reasoningEffort).toBe('high');
      expect(result.preferences!.theme).toBe('system');
      expect(result.extension!.updateChannel).toBe('stable');
    });

    it('should ignore invalid transformations', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_CONTEXT_WINDOW: 'not-a-number',
        CODEX_CACHE_ENABLED: 'maybe',
        CODEX_EXTENSION_ALLOWED_ORIGINS: '' // Empty array
      };

      const result = await transformer.transform(env);

      expect(result.model?.contextWindow).toBeUndefined();
      expect(result.cache?.enabled).toBeUndefined();
      expect(result.extension?.allowedOrigins).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should handle null/undefined environment gracefully', async () => {
      const result = await transformer.transform({});

      expect(result).toEqual({});
    });

    it('should handle validation errors gracefully', async () => {
      const invalidConfig = {
        model: null,
        providers: 'not-an-object'
      };

      const result = await transformer.validate(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should preserve original config in defaults merging', async () => {
      const originalConfig: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4'
        }
      };

      await transformer.applyDefaults(originalConfig);

      // Original should be unchanged
      expect(originalConfig.model).toEqual({
        selected: 'gpt-4'
      });
    });
  });
});