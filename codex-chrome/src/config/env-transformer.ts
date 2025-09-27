/**
 * T017-T019: Configuration Transformer Interface and Implementation
 */

import type { IChromeConfig } from './types';
import type { EnvironmentConfig, ValidationResult, ValidationError } from './env-types';
import { transformers } from './type-transformers';
import { extractProviders } from './provider-extractor';
import { validateConfig } from './env-schemas';
import { DEFAULT_CHROME_CONFIG } from './defaults';

/**
 * Interface for configuration transformer
 */
export interface IConfigTransformer {
  /**
   * Transform flat environment variables to hierarchical config
   */
  transform(env: EnvironmentConfig): Promise<Partial<IChromeConfig>>;

  /**
   * Validate transformed configuration
   */
  validate(config: Partial<IChromeConfig>): Promise<ValidationResult>;

  /**
   * Apply defaults to missing values
   */
  applyDefaults(config: Partial<IChromeConfig>): Promise<IChromeConfig>;
}

/**
 * T019: ConfigTransformer implementation
 */
export class ConfigTransformer implements IConfigTransformer {
  async transform(env: EnvironmentConfig): Promise<Partial<IChromeConfig>> {
    const config: Partial<IChromeConfig> = {};

    // Transform model configuration
    const model: any = {};
    if (env.CODEX_MODEL_SELECTED) model.selected = env.CODEX_MODEL_SELECTED;
    if (env.CODEX_MODEL_PROVIDER) model.provider = env.CODEX_MODEL_PROVIDER;
    if (env.CODEX_MODEL_CONTEXT_WINDOW) {
      model.contextWindow = transformers.number(env.CODEX_MODEL_CONTEXT_WINDOW);
    }
    if (env.CODEX_MODEL_MAX_OUTPUT_TOKENS) {
      model.maxOutputTokens = transformers.number(env.CODEX_MODEL_MAX_OUTPUT_TOKENS);
    }
    if (env.CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT) {
      model.autoCompactTokenLimit = transformers.number(env.CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT);
    }
    if (env.CODEX_MODEL_REASONING_EFFORT) {
      model.reasoningEffort = transformers.enum(
        env.CODEX_MODEL_REASONING_EFFORT,
        ['low', 'medium', 'high'] as const
      );
    }
    if (env.CODEX_MODEL_REASONING_SUMMARY) {
      model.reasoningSummary = transformers.enum(
        env.CODEX_MODEL_REASONING_SUMMARY,
        ['none', 'brief', 'detailed'] as const
      );
    }
    if (env.CODEX_MODEL_VERBOSITY) {
      model.verbosity = transformers.enum(
        env.CODEX_MODEL_VERBOSITY,
        ['low', 'medium', 'high'] as const
      );
    }
    if (Object.keys(model).length > 0) {
      config.model = model;
    }

    // Extract and transform providers
    config.providers = extractProviders(env);

    // Transform preferences
    const preferences: any = {};
    if (env.CODEX_PREFERENCES_AUTO_SYNC) {
      preferences.autoSync = transformers.boolean(env.CODEX_PREFERENCES_AUTO_SYNC);
    }
    if (env.CODEX_PREFERENCES_TELEMETRY_ENABLED) {
      preferences.telemetryEnabled = transformers.boolean(env.CODEX_PREFERENCES_TELEMETRY_ENABLED);
    }
    if (env.CODEX_PREFERENCES_THEME) {
      preferences.theme = transformers.enum(
        env.CODEX_PREFERENCES_THEME,
        ['light', 'dark', 'system'] as const
      );
    }
    if (Object.keys(preferences).length > 0) {
      config.preferences = preferences;
    }

    // Transform cache settings
    const cache: any = {};
    if (env.CODEX_CACHE_ENABLED) {
      cache.enabled = transformers.boolean(env.CODEX_CACHE_ENABLED);
    }
    if (env.CODEX_CACHE_TTL) {
      cache.ttl = transformers.number(env.CODEX_CACHE_TTL);
    }
    if (env.CODEX_CACHE_MAX_SIZE) {
      cache.maxSize = transformers.number(env.CODEX_CACHE_MAX_SIZE);
    }
    if (env.CODEX_CACHE_COMPRESSION_ENABLED) {
      cache.compressionEnabled = transformers.boolean(env.CODEX_CACHE_COMPRESSION_ENABLED);
    }
    if (env.CODEX_CACHE_PERSIST_TO_STORAGE) {
      cache.persistToStorage = transformers.boolean(env.CODEX_CACHE_PERSIST_TO_STORAGE);
    }
    if (Object.keys(cache).length > 0) {
      config.cache = cache;
    }

    // Transform extension settings
    const extension: any = {};
    if (env.CODEX_EXTENSION_ENABLED) {
      extension.enabled = transformers.boolean(env.CODEX_EXTENSION_ENABLED);
    }
    if (env.CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED) {
      extension.contentScriptEnabled = transformers.boolean(env.CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED);
    }
    if (env.CODEX_EXTENSION_ALLOWED_ORIGINS) {
      extension.allowedOrigins = transformers.array(env.CODEX_EXTENSION_ALLOWED_ORIGINS);
    }
    if (env.CODEX_EXTENSION_STORAGE_QUOTA_WARNING) {
      extension.storageQuotaWarning = transformers.number(env.CODEX_EXTENSION_STORAGE_QUOTA_WARNING);
    }
    if (env.CODEX_EXTENSION_UPDATE_CHANNEL) {
      extension.updateChannel = transformers.enum(
        env.CODEX_EXTENSION_UPDATE_CHANNEL,
        ['stable', 'beta'] as const
      );
    }

    // Transform permissions
    const permissions: any = {};
    if (env.CODEX_EXTENSION_PERMISSIONS_TABS) {
      permissions.tabs = transformers.boolean(env.CODEX_EXTENSION_PERMISSIONS_TABS);
    }
    if (env.CODEX_EXTENSION_PERMISSIONS_STORAGE) {
      permissions.storage = transformers.boolean(env.CODEX_EXTENSION_PERMISSIONS_STORAGE);
    }
    if (env.CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS) {
      permissions.notifications = transformers.boolean(env.CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS);
    }
    if (env.CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_READ) {
      permissions.clipboardRead = transformers.boolean(env.CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_READ);
    }
    if (env.CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_WRITE) {
      permissions.clipboardWrite = transformers.boolean(env.CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_WRITE);
    }
    if (Object.keys(permissions).length > 0) {
      extension.permissions = permissions;
    }
    if (Object.keys(extension).length > 0) {
      config.extension = extension;
    }

    return config;
  }

  async validate(config: Partial<IChromeConfig>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Business rule: maxOutputTokens <= contextWindow
    if (config.model?.maxOutputTokens && config.model?.contextWindow) {
      if (config.model.maxOutputTokens > config.model.contextWindow) {
        errors.push({
          field: 'model',
          value: config.model,
          message: 'maxOutputTokens cannot exceed contextWindow',
        });
      }
    }

    // Check for at least one API key
    if (config.providers) {
      const hasApiKey = Object.values(config.providers).some(p => p.apiKey && p.apiKey !== '');
      if (!hasApiKey) {
        errors.push({
          field: 'providers',
          value: config.providers,
          message: 'At least one provider must have an API key',
          required: true,
        });
      }
    }

    // Validate with Zod schema
    const zodValidation = validateConfig(config);
    if (!zodValidation.success) {
      zodValidation.error.errors.forEach(err => {
        errors.push({
          field: err.path.join('.'),
          value: err.input,
          message: err.message,
        });
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async applyDefaults(config: Partial<IChromeConfig>): Promise<IChromeConfig> {
    // Merge with defaults
    return {
      ...DEFAULT_CHROME_CONFIG,
      ...config,
      model: {
        ...DEFAULT_CHROME_CONFIG.model,
        ...(config.model || {}),
      },
      providers: {
        ...DEFAULT_CHROME_CONFIG.providers,
        ...(config.providers || {}),
      },
      preferences: {
        ...DEFAULT_CHROME_CONFIG.preferences,
        ...(config.preferences || {}),
      },
      cache: {
        ...DEFAULT_CHROME_CONFIG.cache,
        ...(config.cache || {}),
      },
      extension: {
        ...DEFAULT_CHROME_CONFIG.extension,
        ...(config.extension || {}),
      },
    } as IChromeConfig;
  }
}