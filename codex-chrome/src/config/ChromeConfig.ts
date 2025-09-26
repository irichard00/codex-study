/**
 * T033-T036, T043: Main Chrome extension configuration class
 */

import {
  IChromeConfig,
  IModelConfig,
  IProviderConfig,
  IProfileConfig,
  IConfigService,
  IConfigChangeEvent,
  IExportData,
  ConfigValidationError
} from './types';
import { ConfigStorage } from '../storage/ConfigStorage';
import {
  DEFAULT_CHROME_CONFIG,
  mergeWithDefaults,
  getDefaultProviders
} from './defaults';
import { validateConfig, validateModelConfig, validateProviderConfig } from './validators';

export class ChromeConfig implements IConfigService {
  private storage: ConfigStorage;
  private currentConfig: IChromeConfig;
  private eventHandlers: Map<string, Set<(e: IConfigChangeEvent) => void>>;
  private initialized: boolean = false;

  constructor() {
    this.storage = new ConfigStorage();
    this.currentConfig = DEFAULT_CHROME_CONFIG;
    this.eventHandlers = new Map();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const storedConfig = await this.storage.get();
      if (storedConfig) {
        this.currentConfig = mergeWithDefaults(storedConfig);
      } else {
        // First time setup
        this.currentConfig = DEFAULT_CHROME_CONFIG;
        await this.storage.set(this.currentConfig);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize config:', error);
      this.currentConfig = DEFAULT_CHROME_CONFIG;
      this.initialized = true;
    }
  }

  // T034: Core CRUD operations
  async getConfig(): Promise<IChromeConfig> {
    await this.initialize();
    return { ...this.currentConfig };
  }

  async updateConfig(config: Partial<IChromeConfig>): Promise<IChromeConfig> {
    await this.initialize();

    const oldConfig = { ...this.currentConfig };
    const newConfig = mergeWithDefaults({ ...this.currentConfig, ...config });

    // Validate the new configuration
    const validation = validateConfig(newConfig);
    if (!validation.valid) {
      throw new ConfigValidationError(
        validation.field || 'config',
        validation.value,
        validation.error || 'Invalid configuration'
      );
    }

    this.currentConfig = newConfig;
    await this.storage.set(this.currentConfig);

    // Emit change events
    this.emitChangeEvent('model', oldConfig.model, newConfig.model);

    return { ...this.currentConfig };
  }

  async resetConfig(preserveApiKeys?: boolean): Promise<IChromeConfig> {
    await this.initialize();

    let newConfig = DEFAULT_CHROME_CONFIG;

    if (preserveApiKeys && this.currentConfig.providers) {
      // Preserve API keys from existing providers
      const preservedProviders: Record<string, IProviderConfig> = {};
      Object.entries(this.currentConfig.providers).forEach(([id, provider]) => {
        if (provider.apiKey) {
          preservedProviders[id] = {
            ...getDefaultProviders()[id],
            apiKey: provider.apiKey,
            organization: provider.organization
          };
        }
      });
      newConfig.providers = preservedProviders;
    }

    this.currentConfig = newConfig;
    await this.storage.set(this.currentConfig);

    return { ...this.currentConfig };
  }

  // Model operations
  async getModelConfig(): Promise<IModelConfig> {
    await this.initialize();

    let modelConfig = { ...this.currentConfig.model };

    // Apply profile overrides if active
    if (this.currentConfig.activeProfile && this.currentConfig.profiles) {
      const profile = this.currentConfig.profiles[this.currentConfig.activeProfile];
      if (profile) {
        modelConfig = {
          ...modelConfig,
          selected: profile.model,
          provider: profile.provider,
          ...(profile.modelSettings || {})
        };
      }
    }

    return modelConfig;
  }

  async updateModelConfig(config: Partial<IModelConfig>): Promise<IModelConfig> {
    await this.initialize();

    const oldModel = await this.getModelConfig();
    const newModel = { ...oldModel, ...config };

    // Validate model configuration
    const validation = validateModelConfig(newModel);
    if (!validation.valid) {
      throw new ConfigValidationError(
        validation.field || 'model',
        validation.value,
        validation.error || 'Invalid model configuration'
      );
    }

    // Check provider exists
    if (newModel.provider && !this.currentConfig.providers[newModel.provider]) {
      throw new Error(`Provider not found: ${newModel.provider}`);
    }

    // Validate maxOutputTokens <= contextWindow
    if (newModel.maxOutputTokens && newModel.contextWindow &&
        newModel.maxOutputTokens > newModel.contextWindow) {
      throw new Error('maxOutputTokens cannot exceed contextWindow');
    }

    this.currentConfig.model = newModel;
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('model', oldModel, newModel);

    return newModel;
  }

  // T035: Provider management
  async getProviders(): Promise<Record<string, IProviderConfig>> {
    await this.initialize();
    return { ...this.currentConfig.providers };
  }

  async getProvider(id: string): Promise<IProviderConfig | null> {
    await this.initialize();
    return this.currentConfig.providers[id] || null;
  }

  async addProvider(provider: IProviderConfig): Promise<IProviderConfig> {
    await this.initialize();

    const validation = validateProviderConfig(provider);
    if (!validation.valid) {
      throw new ConfigValidationError(
        validation.field || 'provider',
        validation.value,
        validation.error || 'Invalid provider configuration'
      );
    }

    this.currentConfig.providers[provider.id] = provider;
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('provider', null, provider);

    return provider;
  }

  async updateProvider(id: string, provider: Partial<IProviderConfig>): Promise<IProviderConfig> {
    await this.initialize();

    const existing = this.currentConfig.providers[id];
    if (!existing) {
      throw new Error(`Provider not found: ${id}`);
    }

    const updated = { ...existing, ...provider };

    const validation = validateProviderConfig(updated);
    if (!validation.valid) {
      throw new ConfigValidationError(
        validation.field || 'provider',
        validation.value,
        validation.error || 'Invalid provider configuration'
      );
    }

    this.currentConfig.providers[id] = updated;
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('provider', existing, updated);

    return updated;
  }

  async deleteProvider(id: string): Promise<void> {
    await this.initialize();

    // Check if provider is currently active
    if (this.currentConfig.model.provider === id) {
      throw new Error('Cannot delete active provider');
    }

    const deleted = this.currentConfig.providers[id];
    delete this.currentConfig.providers[id];
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('provider', deleted, null);
  }

  // T036: Profile management
  async getProfiles(): Promise<Record<string, IProfileConfig>> {
    await this.initialize();
    return { ...(this.currentConfig.profiles || {}) };
  }

  async getProfile(name: string): Promise<IProfileConfig | null> {
    await this.initialize();
    return this.currentConfig.profiles?.[name] || null;
  }

  async createProfile(profile: IProfileConfig): Promise<IProfileConfig> {
    await this.initialize();

    if (!this.currentConfig.profiles) {
      this.currentConfig.profiles = {};
    }

    if (this.currentConfig.profiles[profile.name]) {
      throw new Error(`Profile already exists: ${profile.name}`);
    }

    this.currentConfig.profiles[profile.name] = profile;
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('profile', null, profile);

    return profile;
  }

  async updateProfile(name: string, profile: Partial<IProfileConfig>): Promise<IProfileConfig> {
    await this.initialize();

    if (!this.currentConfig.profiles?.[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    const updated = { ...this.currentConfig.profiles[name], ...profile };
    this.currentConfig.profiles[name] = updated;
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('profile', this.currentConfig.profiles[name], updated);

    return updated;
  }

  async deleteProfile(name: string): Promise<void> {
    await this.initialize();

    if (this.currentConfig.activeProfile === name) {
      throw new Error('Cannot delete active profile');
    }

    const deleted = this.currentConfig.profiles?.[name];
    if (this.currentConfig.profiles) {
      delete this.currentConfig.profiles[name];
    }
    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('profile', deleted, null);
  }

  async activateProfile(name: string): Promise<void> {
    await this.initialize();

    if (!this.currentConfig.profiles?.[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    this.currentConfig.activeProfile = name;
    const profile = this.currentConfig.profiles[name];
    profile.lastUsed = Date.now();

    await this.storage.set(this.currentConfig);

    this.emitChangeEvent('profile', null, profile);
  }

  // Import/Export
  async exportConfig(includeApiKeys?: boolean): Promise<IExportData> {
    await this.initialize();

    const configToExport = { ...this.currentConfig };

    if (!includeApiKeys) {
      // Redact API keys
      Object.values(configToExport.providers).forEach(provider => {
        provider.apiKey = '[REDACTED]';
      });
    }

    return {
      version: configToExport.version,
      exportDate: Date.now(),
      config: configToExport
    };
  }

  async importConfig(data: IExportData): Promise<IChromeConfig> {
    const validation = validateConfig(data.config);
    if (!validation.valid) {
      throw new ConfigValidationError(
        validation.field || 'config',
        validation.value,
        validation.error || 'Invalid configuration'
      );
    }

    this.currentConfig = data.config;
    await this.storage.set(this.currentConfig);

    return { ...this.currentConfig };
  }

  // T043: Event emitter functionality
  on(event: 'config-changed', handler: (e: IConfigChangeEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: 'config-changed', handler: (e: IConfigChangeEvent) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emitChangeEvent(
    section: IConfigChangeEvent['section'],
    oldValue: any,
    newValue: any
  ): void {
    const handlers = this.eventHandlers.get('config-changed');
    if (handlers) {
      const event: IConfigChangeEvent = {
        type: 'config-changed',
        section,
        oldValue,
        newValue,
        timestamp: Date.now()
      };
      handlers.forEach(handler => handler(event));
    }
  }
}