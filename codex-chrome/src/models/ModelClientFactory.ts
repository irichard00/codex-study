/**
 * Model Client Factory for codex-chrome
 * Creates and manages model client instances with provider selection and caching
 */

import { ModelClient, ModelClientError, type RetryConfig } from './ModelClient';
import { OpenAIResponsesClient } from './OpenAIResponsesClient';
import { chromeAuthManager } from './ChromeAuthManager';
import type { AgentConfig } from '../config/AgentConfig';

/**
 * Supported model providers
 * Note: Anthropic removed - not supported in Rust codex-rs implementation
 */
export type ModelProvider = 'openai';

/**
 * Configuration for model client creation
 */
export interface ModelClientConfig {
  /** Provider to use */
  provider: ModelProvider;
  /** API key for the provider */
  apiKey: string;
  /** Additional provider-specific options */
  options?: {
    /** Base URL for API requests (optional) */
    baseUrl?: string;
    /** Organization ID (OpenAI) */
    organization?: string;
  };
}

/**
 * Storage keys for Chrome storage
 */
const STORAGE_KEYS = {
  OPENAI_API_KEY: 'openai_api_key',
  DEFAULT_PROVIDER: 'default_provider',
  OPENAI_ORGANIZATION: 'openai_organization',
} as const;

/**
 * Model name to provider mapping
 * Note: Only OpenAI models supported (matching Rust codex-rs implementation)
 */
const MODEL_PROVIDER_MAP: Record<string, ModelProvider> = {
  // OpenAI models
  'gpt-5': 'openai',
  'gpt-4': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4o': 'openai',
};

const DEFAULT_MODEL = 'gpt-5';

/**
 * Factory for creating and managing model clients
 */
export class ModelClientFactory {
  private static instance: ModelClientFactory;
  private clientCache: Map<string, ModelClient> = new Map();
  private config?: AgentConfig;

  private constructor() {}

  /**
   * Get the singleton instance of the factory
   */
  static getInstance(): ModelClientFactory {
    if (!ModelClientFactory.instance) {
      ModelClientFactory.instance = new ModelClientFactory();
    }
    return ModelClientFactory.instance;
  }

  /**
   * Create a model client for the specified model
   * @param model The model name to create a client for
   * @returns Promise resolving to a model client
   */
  async createClientForModel(model: string): Promise<ModelClient> {
    if (model === 'default') {
      model = DEFAULT_MODEL;
    }

    const provider = this.getProviderForModel(model);
    return this.createClient(provider);
  }

  /**
   * Create a model client for the specified provider
   * @param provider The provider to create a client for
   * @returns Promise resolving to a model client
   */
  async createClient(provider: ModelProvider): Promise<ModelClient> {
    // Check cache first
    const cached = this.clientCache.get(provider);
    if (cached) {
      return cached;
    }

    const config = await this.loadConfigForProvider(provider);
    const client = this.instantiateClient(config);

    // Cache the client instance
    this.clientCache.set(provider, client);

    return client;
  }

  /**
   * Create a client with explicit configuration
   * @param config The client configuration
   * @returns Model client instance
   */
  createClientWithConfig(config: ModelClientConfig): ModelClient {
    const cacheKey = `${config.provider}-${this.hashConfig(config)}`;

    // Check cache first
    const cached = this.clientCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = this.instantiateClient(config);

    // Cache the client instance
    this.clientCache.set(cacheKey, client);

    return client;
  }

  /**
   * Get the provider for a given model name
   * @param model The model name
   * @returns The provider for the model
   */
  getProviderForModel(model: string): ModelProvider {
    if (model === 'default') {
      return 'openai';
    }

    const provider = MODEL_PROVIDER_MAP[model];

    if (!provider) {
      // Try to infer from model name patterns
      if (model.startsWith('gpt-')) {
        return 'openai';
      }

      throw new ModelClientError(`Unknown model: ${model}. Only OpenAI models supported.`);
    }

    return provider;
  }

  /**
   * Get all supported models for a provider
   * @param provider The provider
   * @returns Array of model names
   */
  getSupportedModels(provider: ModelProvider): string[] {
    return Object.entries(MODEL_PROVIDER_MAP)
      .filter(([, p]) => p === provider)
      .map(([model]) => model);
  }

  /**
   * Save API key for a provider to Chrome storage
   * @param provider The provider
   * @param apiKey The API key to save
   */
  async saveApiKey(provider: ModelProvider, apiKey: string): Promise<void> {
    // Save to ChromeAuthManager
    await chromeAuthManager.storeApiKey(apiKey);

    // Also save to original storage for backward compatibility
    const key = STORAGE_KEYS.OPENAI_API_KEY;

    await new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ [key]: apiKey }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });

    // Clear cache to force recreation with new API key
    this.clearCache(provider);
  }

  /**
   * Load API key for a provider from Chrome storage
   * @param provider The provider
   * @returns Promise resolving to the API key or null if not found
   */
  async loadApiKey(provider: ModelProvider): Promise<string | null> {
    // First try to get API key from ChromeAuthManager
    const apiKey = await chromeAuthManager.retrieveApiKey();

    if (apiKey) {
      // Validate if this key is for OpenAI
      // OpenAI keys start with 'sk-'
      const isOpenAIKey = apiKey.startsWith('sk-');

      if (provider === 'openai' && isOpenAIKey) {
        return apiKey;
      }
    }

    // Fallback to original storage method for backward compatibility
    const key = STORAGE_KEYS.OPENAI_API_KEY;

    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }

  /**
   * Set the default provider
   * @param provider The provider to set as default
   */
  async setDefaultProvider(provider: ModelProvider): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEYS.DEFAULT_PROVIDER]: provider }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the default provider
   * @returns Promise resolving to the default provider
   */
  async getDefaultProvider(): Promise<ModelProvider> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([STORAGE_KEYS.DEFAULT_PROVIDER], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[STORAGE_KEYS.DEFAULT_PROVIDER] || 'openai');
        }
      });
    });
  }

  /**
   * Clear the client cache
   * @param provider Optional provider to clear, or all if not specified
   */
  clearCache(provider?: ModelProvider): void {
    if (provider) {
      this.clientCache.delete(provider);
    } else {
      this.clientCache.clear();
    }
  }

  /**
   * Check if a provider has a valid API key configured
   * @param provider The provider to check
   * @returns Promise resolving to true if API key exists
   */
  async hasValidApiKey(provider: ModelProvider): Promise<boolean> {
    const apiKey = await this.loadApiKey(provider);

    if (apiKey && apiKey.trim().length > 0) {
      // Additional validation using ChromeAuthManager
      return chromeAuthManager.validateApiKey(apiKey);
    }

    return false;
  }

  /**
   * Get configuration status for all providers
   * @returns Promise resolving to configuration status
   */
  async getConfigurationStatus(): Promise<Record<ModelProvider, { hasApiKey: boolean; isDefault: boolean }>> {
    const [openaiHasKey, defaultProvider] = await Promise.all([
      this.hasValidApiKey('openai'),
      this.getDefaultProvider(),
    ]);

    return {
      openai: {
        hasApiKey: openaiHasKey,
        isDefault: defaultProvider === 'openai',
      },
    };
  }

  /**
   * Load configuration for a provider from Chrome storage
   * @param provider The provider
   * @returns Promise resolving to the client configuration
   */
  private async loadConfigForProvider(provider: ModelProvider): Promise<ModelClientConfig> {
    const apiKey = await this.loadApiKey(provider);

    if (!apiKey) {
      throw new ModelClientError(`No API key configured for provider: ${provider}`);
    }

    const config: ModelClientConfig = {
      provider,
      apiKey,
      options: {},
    };

    // Load provider-specific options
    if (provider === 'openai') {
      const organization = await this.loadFromStorage(STORAGE_KEYS.OPENAI_ORGANIZATION);
      if (organization) {
        config.options!.organization = organization;
      }
    }

    return config;
  }

  /**
   * Load a value from Chrome storage
   * @param key The storage key
   * @returns Promise resolving to the value or null
   */
  private async loadFromStorage(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }

  /**
   * Instantiate a client with the given configuration
   * @param config The client configuration
   * @returns Model client instance
   */
  private instantiateClient(config: ModelClientConfig): ModelClient {
    switch (config.provider) {
      case 'openai':
        // Use the experimental OpenAI Responses API client by default
        // Construct minimal provider and model family configs aligned with codex-rs
        const baseUrl = config.options?.baseUrl;
        const organization = config.options?.organization;

        const provider = {
          name: 'openai',
          base_url: baseUrl,
          wire_api: 'Responses' as const,
          requires_openai_auth: true,
        };

        const modelFamily = {
          family: 'gpt-5',
          base_instructions: 'You are a helpful coding assistant.',
          supports_reasoning_summaries: true,
          needs_special_apply_patch_instructions: false,
        };

        // Generate a conversation ID for prompt_cache_key usage
        const conversationId = (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function')
          ? (crypto as any).randomUUID()
          : `conv_${Math.random().toString(36).slice(2)}`;

        return new OpenAIResponsesClient({
          apiKey: config.apiKey,
          baseUrl,
          organization,
          conversationId,
          modelFamily,
          provider,
        });

      default:
        throw new ModelClientError(`Unsupported provider: ${(config as any).provider}`);
    }
  }

  /**
   * Create a simple hash of the configuration for caching
   * @param config The configuration to hash
   * @returns Hash string
   */
  private hashConfig(config: ModelClientConfig): string {
    const str = JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey.slice(0, 10), // Only use first 10 chars for privacy
      options: config.options || {},
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Initialize with configuration
   */
  async initialize(config: AgentConfig): Promise<void> {
    this.config = config;
    // Clear cache when config changes to use new settings
    this.clientCache.clear();
  }

  /**
   * Get selected model from config
   */
  getSelectedModel(): string {
    // Config integration placeholder - returns default
    return DEFAULT_MODEL;
  }

  /**
   * Get API key from config for a provider
   */
  getApiKey(provider: string): string | undefined {
    // Config integration placeholder - returns undefined
    return undefined;
  }

  /**
   * Get base URL from config for a provider
   */
  getBaseUrl(provider: string): string | undefined {
    // Config integration placeholder - returns undefined
    return undefined;
  }
}

/**
 * Convenience function to get the factory instance
 */
export const getModelClientFactory = () => ModelClientFactory.getInstance();