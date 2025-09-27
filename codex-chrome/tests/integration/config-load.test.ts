/**
 * Integration test for configuration loading flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { IEnvConfigLoader } from '../../src/config/env-loader';
import type { IConfigTransformer } from '../../src/config/env-transformer';
import type { IChromeConfig } from '../../src/config/types';

describe('Configuration Loading Integration', () => {
  let loader: IEnvConfigLoader;
  let transformer: IConfigTransformer;
  let testEnvPath: string;
  let testDefaultsPath: string;

  beforeEach(() => {
    // This will fail until implementation exists
    // @ts-ignore - Implementation not yet created
    loader = undefined;
    // @ts-ignore
    transformer = undefined;

    // Setup test file paths
    testEnvPath = path.join(__dirname, '.env.test');
    testDefaultsPath = path.join(__dirname, '.env.defaults.test');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
    if (fs.existsSync(testDefaultsPath)) {
      fs.unlinkSync(testDefaultsPath);
    }
  });

  describe('Full configuration loading flow', () => {
    it('should load, merge, transform and validate configuration', async () => {
      // Step 1: Create test .env file
      const envContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_PROVIDER_OPENAI_API_KEY=sk-test-key-123
CODEX_CACHE_ENABLED=true
`;
      fs.writeFileSync(testEnvPath, envContent);

      // Step 2: Create test .env.defaults file
      const defaultsContent = `
CODEX_MODEL_CONTEXT_WINDOW=128000
CODEX_MODEL_MAX_OUTPUT_TOKENS=4096
CODEX_PREFERENCES_THEME=system
CODEX_CACHE_TTL=3600
`;
      fs.writeFileSync(testDefaultsPath, defaultsContent);

      // Step 3: Load environment
      const envConfig = await loader?.loadEnv(testEnvPath);
      expect(envConfig).toBeDefined();
      expect(envConfig.CODEX_MODEL_SELECTED).toBe('gpt-4');

      // Step 4: Merge with defaults
      const merged = await loader?.mergeDefaults(envConfig);
      expect(merged.CODEX_MODEL_CONTEXT_WINDOW).toBe('128000'); // From defaults
      expect(merged.CODEX_MODEL_SELECTED).toBe('gpt-4'); // From env

      // Step 5: Transform to config structure
      const config = await transformer?.transform(merged);
      expect(config).toBeDefined();
      expect(config.model?.selected).toBe('gpt-4');
      expect(config.model?.contextWindow).toBe(128000);

      // Step 6: Apply remaining defaults
      const finalConfig = await transformer?.applyDefaults(config);
      expect(finalConfig).toBeDefined();
      expect(finalConfig.version).toBeDefined();

      // Step 7: Validate final configuration
      const validation = await transformer?.validate(finalConfig);
      expect(validation.valid).toBe(true);

      // Step 8: Generate build module
      const moduleContent = await loader?.generateConfigModule(finalConfig);
      expect(moduleContent).toContain('export const BUILD_CONFIG');
      expect(moduleContent).toContain('gpt-4');
    });

    it('should handle missing .env file gracefully', async () => {
      // Only defaults exist
      const defaultsContent = `
CODEX_MODEL_SELECTED=gpt-3.5-turbo
CODEX_MODEL_PROVIDER=openai
CODEX_CACHE_ENABLED=false
`;
      fs.writeFileSync(testDefaultsPath, defaultsContent);

      // Load should fall back to defaults
      const envConfig = await loader?.loadEnv(testEnvPath);
      const merged = await loader?.mergeDefaults(envConfig || {});

      expect(merged).toBeDefined();
      expect(merged.CODEX_MODEL_SELECTED).toBe('gpt-3.5-turbo');
      expect(merged.CODEX_CACHE_ENABLED).toBe('false');

      const config = await transformer?.transform(merged);
      expect(config.model?.selected).toBe('gpt-3.5-turbo');
      expect(config.cache?.enabled).toBe(false);
    });

    it('should validate and reject invalid configurations', async () => {
      const envContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_CONTEXT_WINDOW=1000
CODEX_MODEL_MAX_OUTPUT_TOKENS=2000
`;
      fs.writeFileSync(testEnvPath, envContent);

      const envConfig = await loader?.loadEnv(testEnvPath);
      const config = await transformer?.transform(envConfig);

      // Should fail validation (maxOutputTokens > contextWindow)
      const validation = await transformer?.validate(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    it('should handle multiple providers', async () => {
      const envContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_PROVIDER_OPENAI_API_KEY=sk-openai-key
CODEX_PROVIDER_OPENAI_BASE_URL=https://api.openai.com/v1
CODEX_PROVIDER_ANTHROPIC_API_KEY=sk-anthropic-key
CODEX_PROVIDER_ANTHROPIC_BASE_URL=https://api.anthropic.com
`;
      fs.writeFileSync(testEnvPath, envContent);

      const envConfig = await loader?.loadEnv(testEnvPath);
      const config = await transformer?.transform(envConfig);

      expect(config.providers).toBeDefined();
      expect(Object.keys(config.providers || {})).toHaveLength(2);
      expect(config.providers?.openai?.apiKey).toBe('sk-openai-key');
      expect(config.providers?.anthropic?.apiKey).toBe('sk-anthropic-key');
    });

    it('should generate TypeScript module with proper typing', async () => {
      const envContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_MODEL_CONTEXT_WINDOW=128000
`;
      fs.writeFileSync(testEnvPath, envContent);

      const envConfig = await loader?.loadEnv(testEnvPath);
      const config = await transformer?.transform(envConfig);
      const finalConfig = await transformer?.applyDefaults(config);

      const moduleContent = await loader?.generateConfigModule(finalConfig);

      // Check module structure
      expect(moduleContent).toContain('import type { IChromeConfig }');
      expect(moduleContent).toContain('export const BUILD_CONFIG: Partial<IChromeConfig>');
      expect(moduleContent).toContain('export const BUILD_TIME');
      expect(moduleContent).toContain('export const BUILD_ENV');

      // Check sensitive data handling
      expect(moduleContent).not.toContain('sk-openai-key'); // API keys should be placeholders
      expect(moduleContent).toContain('{{RUNTIME_REPLACE}}'); // Placeholder for sensitive data
    });

    it('should handle environment-specific configuration', async () => {
      const devContent = `
CODEX_MODEL_SELECTED=gpt-3.5-turbo
CODEX_CACHE_ENABLED=false
CODEX_PREFERENCES_TELEMETRY_ENABLED=false
`;

      const prodContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_CACHE_ENABLED=true
CODEX_PREFERENCES_TELEMETRY_ENABLED=true
`;

      // Test development environment
      fs.writeFileSync(testEnvPath, devContent);
      const devConfig = await loader?.loadEnv(testEnvPath, 'development');
      const devTransformed = await transformer?.transform(devConfig);
      expect(devTransformed.model?.selected).toBe('gpt-3.5-turbo');
      expect(devTransformed.cache?.enabled).toBe(false);

      // Test production environment
      fs.writeFileSync(testEnvPath, prodContent);
      const prodConfig = await loader?.loadEnv(testEnvPath, 'production');
      const prodTransformed = await transformer?.transform(prodConfig);
      expect(prodTransformed.model?.selected).toBe('gpt-4');
      expect(prodTransformed.cache?.enabled).toBe(true);
    });

    it('should provide warnings for missing recommended values', async () => {
      const minimalContent = `
CODEX_MODEL_SELECTED=gpt-4
`;
      fs.writeFileSync(testEnvPath, minimalContent);

      const envConfig = await loader?.loadEnv(testEnvPath);
      const validation = await loader?.validateRequired(envConfig);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.warnings?.length).toBeGreaterThan(0);

      const apiKeyWarning = validation.warnings?.find(w =>
        w.message.includes('API key')
      );
      expect(apiKeyWarning).toBeDefined();
    });

    it('should handle complex nested configuration', async () => {
      const complexContent = `
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_MODEL_CONTEXT_WINDOW=128000
CODEX_MODEL_MAX_OUTPUT_TOKENS=4096
CODEX_MODEL_REASONING_EFFORT=high
CODEX_PROVIDER_OPENAI_API_KEY=sk-test
CODEX_PROVIDER_OPENAI_RETRY_MAX_RETRIES=3
CODEX_PROVIDER_OPENAI_RETRY_INITIAL_DELAY=1000
CODEX_PREFERENCES_THEME=dark
CODEX_PREFERENCES_AUTO_SYNC=true
CODEX_CACHE_ENABLED=true
CODEX_CACHE_TTL=3600
CODEX_EXTENSION_PERMISSIONS_TABS=true
CODEX_EXTENSION_PERMISSIONS_STORAGE=true
CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS=false
`;
      fs.writeFileSync(testEnvPath, complexContent);

      const envConfig = await loader?.loadEnv(testEnvPath);
      const config = await transformer?.transform(envConfig);

      // Check all nested structures
      expect(config.model?.reasoningEffort).toBe('high');
      expect(config.providers?.openai?.retryConfig?.maxRetries).toBe(3);
      expect(config.preferences?.theme).toBe('dark');
      expect(config.cache?.ttl).toBe(3600);
      expect(config.extension?.permissions?.tabs).toBe(true);
      expect(config.extension?.permissions?.notifications).toBe(false);
    });
  });
});