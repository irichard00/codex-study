/**
 * T016: Environment Configuration Loader Tests
 * Tests for simplified loader implementation without migration features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EnvConfigLoader, type IEnvConfigLoader } from '@config/env-loader';
import type { EnvironmentConfig, ValidationResult } from '@config/env-types';

describe('EnvConfigLoader', () => {
  let loader: IEnvConfigLoader;
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, 'test-env-loader');
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    loader = new EnvConfigLoader(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadEnv', () => {
    it('should load environment variables from .env file', async () => {
      const envContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_PROVIDER_OPENAI_API_KEY=sk-test-key
CODEX_CACHE_ENABLED=true
`;
      fs.writeFileSync(path.join(testDir, '.env'), envContent);

      const result = await loader.loadEnv();

      expect(result).toEqual({
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_MODEL_PROVIDER: 'openai',
        CODEX_PROVIDER_OPENAI_API_KEY: 'sk-test-key',
        CODEX_CACHE_ENABLED: 'true'
      });
    });

    it('should load environment-specific files', async () => {
      const baseEnv = `
CODEX_MODEL_SELECTED=gpt-3.5-turbo
CODEX_CACHE_ENABLED=false
`;
      const devEnv = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_CACHE_ENABLED=true
`;
      fs.writeFileSync(path.join(testDir, '.env'), baseEnv);
      fs.writeFileSync(path.join(testDir, '.env.development'), devEnv);

      const result = await loader.loadEnv(undefined, 'development');

      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_CACHE_ENABLED).toBe('true');
    });

    it('should prioritize .env.local over other files', async () => {
      const baseEnv = `CODEX_MODEL_SELECTED=gpt-3.5-turbo`;
      const devEnv = `CODEX_MODEL_SELECTED=gpt-4`;
      const localEnv = `CODEX_MODEL_SELECTED=claude-3`;

      fs.writeFileSync(path.join(testDir, '.env'), baseEnv);
      fs.writeFileSync(path.join(testDir, '.env.development'), devEnv);
      fs.writeFileSync(path.join(testDir, '.env.local'), localEnv);

      const result = await loader.loadEnv(undefined, 'development');

      expect(result.CODEX_MODEL_SELECTED).toBe('claude-3');
    });

    it('should handle quoted values correctly', async () => {
      const envContent = `
QUOTED_DOUBLE="hello world"
QUOTED_SINGLE='hello world'
UNQUOTED=hello world
EMPTY=""
`;
      fs.writeFileSync(path.join(testDir, '.env'), envContent);

      const result = await loader.loadEnv();

      expect(result.QUOTED_DOUBLE).toBe('hello world');
      expect(result.QUOTED_SINGLE).toBe('hello world');
      expect(result.UNQUOTED).toBe('hello world');
      expect(result.EMPTY).toBe('');
    });

    it('should skip comments and empty lines', async () => {
      const envContent = `
# This is a comment
CODEX_MODEL_SELECTED=gpt-4

# Another comment
CODEX_CACHE_ENABLED=true # inline comment
`;
      fs.writeFileSync(path.join(testDir, '.env'), envContent);

      const result = await loader.loadEnv();

      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_CACHE_ENABLED).toBe('true');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle export statements', async () => {
      const envContent = `
export CODEX_MODEL_SELECTED=gpt-4
export CODEX_CACHE_ENABLED=true
`;
      fs.writeFileSync(path.join(testDir, '.env'), envContent);

      const result = await loader.loadEnv();

      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
      expect(result.CODEX_CACHE_ENABLED).toBe('true');
    });

    it('should throw error for missing file when path is specified', async () => {
      const missingPath = path.join(testDir, 'missing.env');

      await expect(loader.loadEnv(missingPath)).rejects.toThrow(
        `Environment file not found: ${missingPath}`
      );
    });

    it('should return empty object when no .env files exist', async () => {
      const result = await loader.loadEnv();

      expect(result).toEqual({});
    });
  });

  describe('mergeDefaults', () => {
    it('should merge with defaults from .env.defaults', async () => {
      const defaultsContent = `
CODEX_MODEL_CONTEXT_WINDOW=128000
CODEX_CACHE_TTL=3600
CODEX_CACHE_ENABLED=false
`;
      fs.writeFileSync(path.join(testDir, '.env.defaults'), defaultsContent);

      const env: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4',
        CODEX_CACHE_ENABLED: 'true'
      };

      const result = await loader.mergeDefaults(env);

      expect(result).toEqual({
        CODEX_MODEL_CONTEXT_WINDOW: '128000',
        CODEX_CACHE_TTL: '3600',
        CODEX_CACHE_ENABLED: 'true', // env overrides defaults
        CODEX_MODEL_SELECTED: 'gpt-4'
      });
    });

    it('should return env unchanged when no defaults file exists', async () => {
      const env: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4'
      };

      const result = await loader.mergeDefaults(env);

      expect(result).toEqual(env);
    });
  });

  describe('generateConfigModule', () => {
    it('should generate build-time configuration module', async () => {
      const config = {
        model: {
          selected: 'gpt-4',
          provider: 'openai',
          contextWindow: 128000
        },
        providers: {
          openai: {
            id: 'openai',
            apiKey: 'sk-test-key'
          }
        }
      };

      const module = await loader.generateConfigModule(config as any);

      expect(module).toContain('export const BUILD_CONFIG');
      expect(module).toContain('export const BUILD_TIME');
      expect(module).toContain('export const BUILD_ENV');
      expect(module).toContain('export function initializeRuntime');
      expect(module).toContain('DO NOT EDIT - This file is auto-generated');
    });

    it('should sanitize sensitive data in generated module', async () => {
      const config = {
        providers: {
          openai: {
            id: 'openai',
            apiKey: 'sk-secret-key-12345'
          },
          anthropic: {
            id: 'anthropic',
            apiKey: 'sk-ant-secret-98765'
          }
        }
      };

      const module = await loader.generateConfigModule(config as any);

      expect(module).not.toContain('sk-secret-key-12345');
      expect(module).not.toContain('sk-ant-secret-98765');
      expect(module).toContain('{{RUNTIME_REPLACE}}');
      expect(module).toContain('_keyPresent: true');
    });

    it('should include metadata in generated config', async () => {
      const config = {
        model: { selected: 'gpt-4' },
        providers: {
          openai: { apiKey: 'sk-test' }
        }
      };

      const module = await loader.generateConfigModule(config as any);

      expect(module).toContain('_metadata');
      expect(module).toContain('generated: true');
      expect(module).toContain('timestamp');
      expect(module).toContain('redactedFields');
    });

    it('should create runtime initialization function', async () => {
      const config = {
        providers: {
          openai: { id: 'openai', apiKey: 'sk-test' }
        }
      };

      const module = await loader.generateConfigModule(config as any);

      expect(module).toContain('function initializeRuntime(secrets: Record<string, string>)');
      expect(module).toContain('Replace {{RUNTIME_REPLACE}} placeholders');
      expect(module).toContain('secrets[provider.id]');
    });
  });

  describe('validateRequired', () => {
    it('should validate API key presence', async () => {
      const envWithKeys: EnvironmentConfig = {
        CODEX_PROVIDER_OPENAI_API_KEY: 'sk-test-key'
      };

      const result = await loader.validateRequired(envWithKeys);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('should warn when no API keys are configured', async () => {
      const envWithoutKeys: EnvironmentConfig = {
        CODEX_MODEL_SELECTED: 'gpt-4'
      };

      const result = await loader.validateRequired(envWithoutKeys);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].field).toBe('API_KEY');
      expect(result.warnings![0].message).toContain('No API keys configured');
    });

    it('should warn when no model is selected', async () => {
      const envWithoutModel: EnvironmentConfig = {
        CODEX_PROVIDER_OPENAI_API_KEY: 'sk-test-key'
      };

      const result = await loader.validateRequired(envWithoutModel);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0].field).toBe('CODEX_MODEL_SELECTED');
      expect(result.warnings![0].message).toContain('No model selected');
    });

    it('should accept either OpenAI or Anthropic API keys', async () => {
      const envWithAnthropic: EnvironmentConfig = {
        CODEX_PROVIDER_ANTHROPIC_API_KEY: 'sk-ant-test-key'
      };

      const result = await loader.validateRequired(envWithAnthropic);

      expect(result.valid).toBe(true);
      expect(result.warnings?.some(w => w.field === 'API_KEY')).toBe(false);
    });

    it('should provide helpful suggestions in warnings', async () => {
      const emptyEnv: EnvironmentConfig = {};

      const result = await loader.validateRequired(emptyEnv);

      expect(result.warnings).toHaveLength(2);

      const apiKeyWarning = result.warnings!.find(w => w.field === 'API_KEY');
      expect(apiKeyWarning?.suggestion).toContain('Add CODEX_PROVIDER_OPENAI_API_KEY');

      const modelWarning = result.warnings!.find(w => w.field === 'CODEX_MODEL_SELECTED');
      expect(modelWarning?.suggestion).toContain('CODEX_MODEL_SELECTED=gpt-4');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed .env files gracefully', async () => {
      const malformedContent = `
VALID_KEY=value
INVALID_LINE_NO_EQUALS
=VALUE_WITHOUT_KEY
KEY_WITH_EMPTY_VALUE=
`;
      fs.writeFileSync(path.join(testDir, '.env'), malformedContent);

      const result = await loader.loadEnv();

      expect(result.VALID_KEY).toBe('value');
      expect(result.KEY_WITH_EMPTY_VALUE).toBe('');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle file system errors gracefully', async () => {
      // Mock fs.readFileSync to throw error
      const originalReadFileSync = fs.readFileSync;
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const envPath = path.join(testDir, '.env');
      fs.writeFileSync(envPath, 'CODEX_MODEL_SELECTED=gpt-4');

      await expect(loader.loadEnv(envPath)).rejects.toThrow('Permission denied');

      // Restore original function
      fs.readFileSync = originalReadFileSync;
    });
  });

  describe('Integration with different project structures', () => {
    it('should work with custom project root', () => {
      const customRoot = path.join(testDir, 'custom');
      fs.mkdirSync(customRoot, { recursive: true });

      const customLoader = new EnvConfigLoader(customRoot);
      expect(customLoader).toBeInstanceOf(EnvConfigLoader);
    });

    it('should handle relative paths correctly', async () => {
      const envContent = 'CODEX_MODEL_SELECTED=gpt-4';
      fs.writeFileSync(path.join(testDir, '.env'), envContent);

      const relativeLoader = new EnvConfigLoader('.');
      const result = await relativeLoader.loadEnv();

      expect(result.CODEX_MODEL_SELECTED).toBe('gpt-4');
    });
  });
});