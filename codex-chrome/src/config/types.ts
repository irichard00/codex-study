/**
 * Chrome Extension Configuration Type Definitions
 * T025-T029: Type definitions for the config system
 */

// T025: Main configuration interface
export interface IChromeConfig {
  version: string;
  model: IModelConfig;
  providers: Record<string, IProviderConfig>;
  profiles?: Record<string, IProfileConfig>;
  activeProfile?: string | null;
  preferences: IUserPreferences;
  cache: ICacheSettings;
  extension: IExtensionSettings;
}

// T026: Model configuration
export interface IModelConfig {
  selected: string;
  provider: string;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  autoCompactTokenLimit?: number | null;
  reasoningEffort?: 'low' | 'medium' | 'high' | null;
  reasoningSummary?: 'none' | 'brief' | 'detailed';
  verbosity?: 'low' | 'medium' | 'high' | null;
}

// T027: Provider configuration
export interface IProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string | null;
  organization?: string | null;
  version?: string | null;
  headers?: Record<string, string>;
  timeout: number;
  retryConfig?: IRetryConfig;
}

// T028: Profile configuration
export interface IProfileConfig {
  name: string;
  description?: string | null;
  model: string;
  provider: string;
  modelSettings?: Partial<IModelConfig>;
  created: number;
  lastUsed?: number | null;
}

// T029: Remaining interfaces
export interface IUserPreferences {
  autoSync?: boolean;
  telemetryEnabled?: boolean;
  theme?: 'light' | 'dark' | 'system';
  shortcuts?: Record<string, string>;
  experimental?: Record<string, boolean>;
}

export interface ICacheSettings {
  enabled?: boolean;
  ttl?: number;
  maxSize?: number;
  compressionEnabled?: boolean;
  persistToStorage?: boolean;
}

export interface IExtensionSettings {
  enabled?: boolean;
  contentScriptEnabled?: boolean;
  allowedOrigins?: string[];
  storageQuotaWarning?: number;
  updateChannel?: 'stable' | 'beta';
  permissions?: IPermissionSettings;
}

export interface IPermissionSettings {
  tabs?: boolean;
  storage?: boolean;
  notifications?: boolean;
  clipboardRead?: boolean;
  clipboardWrite?: boolean;
}

export interface IRetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

// Storage interfaces
export interface IConfigStorage {
  get(): Promise<IChromeConfig | null>;
  set(config: IChromeConfig): Promise<void>;
  clear(): Promise<void>;
  getStorageInfo(): Promise<IStorageInfo>;
}

export interface IStorageInfo {
  used: number;
  quota: number;
  percentUsed: number;
}

// Service interfaces
export interface IConfigService {
  // Core operations
  getConfig(): Promise<IChromeConfig>;
  updateConfig(config: Partial<IChromeConfig>): Promise<IChromeConfig>;
  resetConfig(preserveApiKeys?: boolean): Promise<IChromeConfig>;

  // Model operations
  getModelConfig(): Promise<IModelConfig>;
  updateModelConfig(config: Partial<IModelConfig>): Promise<IModelConfig>;

  // Provider operations
  getProviders(): Promise<Record<string, IProviderConfig>>;
  getProvider(id: string): Promise<IProviderConfig | null>;
  addProvider(provider: IProviderConfig): Promise<IProviderConfig>;
  updateProvider(id: string, provider: Partial<IProviderConfig>): Promise<IProviderConfig>;
  deleteProvider(id: string): Promise<void>;

  // Profile operations
  getProfiles(): Promise<Record<string, IProfileConfig>>;
  getProfile(name: string): Promise<IProfileConfig | null>;
  createProfile(profile: IProfileConfig): Promise<IProfileConfig>;
  updateProfile(name: string, profile: Partial<IProfileConfig>): Promise<IProfileConfig>;
  deleteProfile(name: string): Promise<void>;
  activateProfile(name: string): Promise<void>;

  // Import/Export
  exportConfig(includeApiKeys?: boolean): Promise<IExportData>;
  importConfig(data: IExportData): Promise<IChromeConfig>;
}

// Export/Import data structure
export interface IExportData {
  version: string;
  exportDate: number;
  config: IChromeConfig;
}

// Event interfaces for config changes
export interface IConfigChangeEvent {
  type: 'config-changed';
  section: 'model' | 'provider' | 'profile' | 'preferences' | 'cache' | 'extension';
  oldValue?: any;
  newValue: any;
  timestamp: number;
}

export interface IConfigEventEmitter {
  on(event: 'config-changed', handler: (e: IConfigChangeEvent) => void): void;
  off(event: 'config-changed', handler: (e: IConfigChangeEvent) => void): void;
  emit(event: 'config-changed', data: IConfigChangeEvent): void;
}

// Factory interface
export interface IConfigFactory {
  createDefault(): IChromeConfig;
  createFromStorage(data: any): IChromeConfig;
  validateConfig(config: any): config is IChromeConfig;
}

// Error types
export class ConfigValidationError extends Error {
  constructor(
    public field: string,
    public value: any,
    message: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigStorageError extends Error {
  constructor(
    public operation: 'read' | 'write' | 'delete',
    message: string
  ) {
    super(message);
    this.name = 'ConfigStorageError';
  }
}