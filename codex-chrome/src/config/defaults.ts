/**
 * T037: Default configuration values
 */

import { IChromeConfig, IModelConfig, IUserPreferences, ICacheSettings, IExtensionSettings, IPermissionSettings } from './types';

export const DEFAULT_MODEL_CONFIG: IModelConfig = {
  selected: 'gpt-3.5-turbo',
  provider: 'openai',
  contextWindow: 16385,
  maxOutputTokens: 4096,
  autoCompactTokenLimit: null,
  reasoningEffort: null,
  reasoningSummary: 'none',
  verbosity: 'medium'
};

export const DEFAULT_USER_PREFERENCES: IUserPreferences = {
  autoSync: true,
  telemetryEnabled: false,
  theme: 'system',
  shortcuts: {},
  experimental: {}
};

export const DEFAULT_CACHE_SETTINGS: ICacheSettings = {
  enabled: true,
  ttl: 3600, // 1 hour
  maxSize: 5242880, // 5MB
  compressionEnabled: false,
  persistToStorage: false
};

export const DEFAULT_PERMISSION_SETTINGS: IPermissionSettings = {
  tabs: true,
  storage: true, // Always required
  notifications: false,
  clipboardRead: false,
  clipboardWrite: false
};

export const DEFAULT_EXTENSION_SETTINGS: IExtensionSettings = {
  enabled: true,
  contentScriptEnabled: true,
  allowedOrigins: [],
  storageQuotaWarning: 0.8, // 80% warning threshold
  updateChannel: 'stable',
  permissions: DEFAULT_PERMISSION_SETTINGS
};

export const DEFAULT_CHROME_CONFIG: IChromeConfig = {
  version: '1.0.0',
  model: DEFAULT_MODEL_CONFIG,
  providers: {},
  profiles: {},
  activeProfile: null,
  preferences: DEFAULT_USER_PREFERENCES,
  cache: DEFAULT_CACHE_SETTINGS,
  extension: DEFAULT_EXTENSION_SETTINGS
};

// Storage keys
export const STORAGE_KEYS = {
  CONFIG: 'codex_config_v1',
  CONFIG_BACKUP: 'codex_config_backup',
  CONFIG_CACHE: 'codex_config_cache'
} as const;

// Configuration limits
export const CONFIG_LIMITS = {
  SYNC_QUOTA_BYTES: 102400, // 100KB Chrome sync storage limit
  SYNC_ITEM_BYTES: 8192, // 8KB per item limit
  LOCAL_QUOTA_BYTES: 10485760, // 10MB local storage limit
  MAX_PROFILES: 20,
  MAX_PROVIDERS: 10,
  MAX_SHORTCUTS: 50,
  MAX_EXPERIMENTAL_FLAGS: 100
} as const;

// Validation constants
export const VALID_THEMES = ['light', 'dark', 'system'] as const;
export const VALID_UPDATE_CHANNELS = ['stable', 'beta'] as const;
export const VALID_REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
export const VALID_REASONING_SUMMARIES = ['none', 'brief', 'detailed'] as const;
export const VALID_VERBOSITIES = ['low', 'medium', 'high'] as const;

// Default retry configuration
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

// Default timeout settings (ms)
export const DEFAULT_TIMEOUTS = {
  API_REQUEST: 30000,
  STORAGE_OPERATION: 5000
};

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(partial: Partial<IChromeConfig>): IChromeConfig {
  return {
    ...DEFAULT_CHROME_CONFIG,
    ...partial,
    model: {
      ...DEFAULT_MODEL_CONFIG,
      ...(partial.model || {})
    },
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      ...(partial.preferences || {})
    },
    cache: {
      ...DEFAULT_CACHE_SETTINGS,
      ...(partial.cache || {})
    },
    extension: {
      ...DEFAULT_EXTENSION_SETTINGS,
      ...(partial.extension || {}),
      permissions: {
        ...DEFAULT_PERMISSION_SETTINGS,
        ...(partial.extension?.permissions || {})
      }
    }
  };
}

/**
 * Get default provider configurations
 */
export function getDefaultProviders(): Record<string, any> {
  return {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      timeout: DEFAULT_TIMEOUTS.API_REQUEST,
      retryConfig: DEFAULT_RETRY_CONFIG
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic',
      apiKey: '',
      baseUrl: 'https://api.anthropic.com',
      timeout: DEFAULT_TIMEOUTS.API_REQUEST,
      retryConfig: DEFAULT_RETRY_CONFIG
    }
  };
}