/**
 * Configuration migration utilities
 */

import type { IChromeConfig } from './types';
import type { EnvironmentConfig, MigrationOptions } from './env-types';
import { redactValue, isSensitive } from './sensitive-handler';

export interface IConfigMigrator {
  /**
   * Detect if migration is needed
   */
  needsMigration(storage: any): Promise<boolean>;

  /**
   * Migrate from storage-based to env-based config
   */
  migrate(oldConfig: IChromeConfig, options?: MigrationOptions): EnvironmentConfig;

  /**
   * Generate .env file from existing config
   */
  generateEnvFile(config: IChromeConfig, options?: MigrationOptions): string;
}

export class ConfigMigrator implements IConfigMigrator {
  async needsMigration(storage: any): Promise<boolean> {
    // Check if storage has old format
    return storage?.hasOldFormat?.() || false;
  }

  migrate(oldConfig: IChromeConfig, options?: MigrationOptions): EnvironmentConfig {
    const env: EnvironmentConfig = {};

    // Migrate model configuration
    if (oldConfig.model) {
      if (oldConfig.model.selected) env.CODEX_MODEL_SELECTED = oldConfig.model.selected;
      if (oldConfig.model.provider) env.CODEX_MODEL_PROVIDER = oldConfig.model.provider;
      if (oldConfig.model.contextWindow) env.CODEX_MODEL_CONTEXT_WINDOW = String(oldConfig.model.contextWindow);
      if (oldConfig.model.maxOutputTokens) env.CODEX_MODEL_MAX_OUTPUT_TOKENS = String(oldConfig.model.maxOutputTokens);
      if (oldConfig.model.autoCompactTokenLimit) env.CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT = String(oldConfig.model.autoCompactTokenLimit);
      if (oldConfig.model.reasoningEffort) env.CODEX_MODEL_REASONING_EFFORT = oldConfig.model.reasoningEffort;
      if (oldConfig.model.reasoningSummary) env.CODEX_MODEL_REASONING_SUMMARY = oldConfig.model.reasoningSummary;
      if (oldConfig.model.verbosity) env.CODEX_MODEL_VERBOSITY = oldConfig.model.verbosity;
    }

    // Migrate providers
    if (oldConfig.providers) {
      for (const [id, provider] of Object.entries(oldConfig.providers)) {
        const upperProvider = id.toUpperCase();
        if (provider.apiKey) env[`CODEX_PROVIDER_${upperProvider}_API_KEY`] = provider.apiKey;
        if (provider.baseUrl) env[`CODEX_PROVIDER_${upperProvider}_BASE_URL`] = provider.baseUrl;
        if (provider.organization) env[`CODEX_PROVIDER_${upperProvider}_ORGANIZATION`] = provider.organization;
        if (provider.version) env[`CODEX_PROVIDER_${upperProvider}_VERSION`] = provider.version;
        if (provider.timeout) env[`CODEX_PROVIDER_${upperProvider}_TIMEOUT`] = String(provider.timeout);

        // Migrate retry config
        if (provider.retryConfig) {
          if (provider.retryConfig.maxRetries) {
            env[`CODEX_PROVIDER_${upperProvider}_RETRY_MAX_RETRIES`] = String(provider.retryConfig.maxRetries);
          }
          if (provider.retryConfig.initialDelay) {
            env[`CODEX_PROVIDER_${upperProvider}_RETRY_INITIAL_DELAY`] = String(provider.retryConfig.initialDelay);
          }
          if (provider.retryConfig.maxDelay) {
            env[`CODEX_PROVIDER_${upperProvider}_RETRY_MAX_DELAY`] = String(provider.retryConfig.maxDelay);
          }
          if (provider.retryConfig.backoffMultiplier) {
            env[`CODEX_PROVIDER_${upperProvider}_RETRY_BACKOFF_MULTIPLIER`] = String(provider.retryConfig.backoffMultiplier);
          }
        }
      }
    }

    // Migrate preferences
    if (oldConfig.preferences) {
      if (oldConfig.preferences.autoSync !== undefined) {
        env.CODEX_PREFERENCES_AUTO_SYNC = String(oldConfig.preferences.autoSync);
      }
      if (oldConfig.preferences.telemetryEnabled !== undefined) {
        env.CODEX_PREFERENCES_TELEMETRY_ENABLED = String(oldConfig.preferences.telemetryEnabled);
      }
      if (oldConfig.preferences.theme) {
        env.CODEX_PREFERENCES_THEME = oldConfig.preferences.theme;
      }
    }

    // Migrate cache settings
    if (oldConfig.cache) {
      if (oldConfig.cache.enabled !== undefined) {
        env.CODEX_CACHE_ENABLED = String(oldConfig.cache.enabled);
      }
      if (oldConfig.cache.ttl) {
        env.CODEX_CACHE_TTL = String(oldConfig.cache.ttl);
      }
      if (oldConfig.cache.maxSize) {
        env.CODEX_CACHE_MAX_SIZE = String(oldConfig.cache.maxSize);
      }
      if (oldConfig.cache.compressionEnabled !== undefined) {
        env.CODEX_CACHE_COMPRESSION_ENABLED = String(oldConfig.cache.compressionEnabled);
      }
      if (oldConfig.cache.persistToStorage !== undefined) {
        env.CODEX_CACHE_PERSIST_TO_STORAGE = String(oldConfig.cache.persistToStorage);
      }
    }

    // Migrate extension settings
    if (oldConfig.extension) {
      if (oldConfig.extension.enabled !== undefined) {
        env.CODEX_EXTENSION_ENABLED = String(oldConfig.extension.enabled);
      }
      if (oldConfig.extension.contentScriptEnabled !== undefined) {
        env.CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED = String(oldConfig.extension.contentScriptEnabled);
      }
      if (oldConfig.extension.allowedOrigins) {
        env.CODEX_EXTENSION_ALLOWED_ORIGINS = oldConfig.extension.allowedOrigins.join(',');
      }
      if (oldConfig.extension.storageQuotaWarning) {
        env.CODEX_EXTENSION_STORAGE_QUOTA_WARNING = String(oldConfig.extension.storageQuotaWarning);
      }
      if (oldConfig.extension.updateChannel) {
        env.CODEX_EXTENSION_UPDATE_CHANNEL = oldConfig.extension.updateChannel;
      }

      // Migrate permissions
      if (oldConfig.extension.permissions) {
        const perms = oldConfig.extension.permissions;
        if (perms.tabs !== undefined) env.CODEX_EXTENSION_PERMISSIONS_TABS = String(perms.tabs);
        if (perms.storage !== undefined) env.CODEX_EXTENSION_PERMISSIONS_STORAGE = String(perms.storage);
        if (perms.notifications !== undefined) env.CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS = String(perms.notifications);
        if (perms.clipboardRead !== undefined) env.CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_READ = String(perms.clipboardRead);
        if (perms.clipboardWrite !== undefined) env.CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_WRITE = String(perms.clipboardWrite);
      }
    }

    return env;
  }

  generateEnvFile(config: IChromeConfig, options?: MigrationOptions): string {
    const env = this.migrate(config, options);
    let content = '# Environment Configuration Generated from Chrome Storage\n';
    content += `# Generated on ${new Date().toISOString()}\n\n`;

    // Group by sections
    const sections = {
      'Model Configuration': [] as string[],
      'Provider Configuration': [] as string[],
      'User Preferences': [] as string[],
      'Cache Settings': [] as string[],
      'Extension Settings': [] as string[],
      'Permission Settings': [] as string[],
    };

    for (const [key, value] of Object.entries(env)) {
      if (!value) continue;

      let displayValue = value;
      if (options?.redactSecrets && isSensitive(key)) {
        displayValue = '[REDACTED]';
      }

      const line = `${key}=${displayValue}`;

      if (key.startsWith('CODEX_MODEL_')) {
        sections['Model Configuration'].push(line);
      } else if (key.startsWith('CODEX_PROVIDER_')) {
        sections['Provider Configuration'].push(line);
      } else if (key.startsWith('CODEX_PREFERENCES_')) {
        sections['User Preferences'].push(line);
      } else if (key.startsWith('CODEX_CACHE_')) {
        sections['Cache Settings'].push(line);
      } else if (key.startsWith('CODEX_EXTENSION_PERMISSIONS_')) {
        sections['Permission Settings'].push(line);
      } else if (key.startsWith('CODEX_EXTENSION_')) {
        sections['Extension Settings'].push(line);
      }
    }

    // Generate content with sections
    for (const [section, lines] of Object.entries(sections)) {
      if (lines.length > 0) {
        content += `# ${section}\n`;
        content += lines.join('\n') + '\n\n';
      }
    }

    // Add profile information as comments if requested
    if (options?.includeProfiles && config.profiles) {
      content += '# Profiles (manual migration required)\n';
      for (const [name, profile] of Object.entries(config.profiles)) {
        content += `# Profile: ${name}\n`;
        content += `#   Model: ${profile.model}\n`;
        content += `#   Provider: ${profile.provider}\n`;
        if (profile.description) {
          content += `#   Description: ${profile.description}\n`;
        }
      }
      if (config.activeProfile) {
        content += `# Active Profile: ${config.activeProfile}\n`;
      }
    }

    return content;
  }
}