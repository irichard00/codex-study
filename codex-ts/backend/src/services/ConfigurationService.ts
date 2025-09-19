import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as toml from 'toml';
import type { Configuration, CreateConfiguration } from '../../../shared/types/index.js';

export class ConfigurationService {
  private configurations: Map<string, Configuration> = new Map();
  private configPath = process.env.CONFIG_PATH || './config.toml';

  constructor() {
    this.loadConfigFromFile();
  }

  private async loadConfigFromFile(): Promise<void> {
    try {
      const configFile = await fs.readFile(this.configPath, 'utf-8');
      const parsed = toml.parse(configFile);

      const config: Configuration = {
        id: uuidv4(),
        name: 'default',
        sandboxMode: parsed.sandbox_mode || 'read-only',
        mcpServers: parsed.mcp_servers || [],
        notificationSettings: parsed.notifications || {
          enabled: true,
          desktop: false,
          sound: false,
        },
        authEnabled: parsed.auth_enabled || false,
        customSettings: parsed.custom || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.configurations.set(config.id, config);
    } catch (error) {
      // If config file doesn't exist, create default
      const defaultConfig = await this.createDefaultConfiguration();
      this.configurations.set(defaultConfig.id, defaultConfig);
    }
  }

  async createConfiguration(data: CreateConfiguration): Promise<Configuration> {
    const config: Configuration = {
      id: uuidv4(),
      name: data.name,
      sandboxMode: data.sandboxMode || 'read-only',
      mcpServers: data.mcpServers || [],
      notificationSettings: {
        enabled: true,
        desktop: false,
        sound: false,
      },
      authEnabled: data.authEnabled || false,
      customSettings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.configurations.set(config.id, config);
    return config;
  }

  async getConfiguration(id: string): Promise<Configuration | null> {
    return this.configurations.get(id) || null;
  }

  async listConfigurations(): Promise<Configuration[]> {
    return Array.from(this.configurations.values());
  }

  async updateConfiguration(id: string, updates: Partial<Configuration>): Promise<Configuration | null> {
    const config = this.configurations.get(id);
    if (!config) return null;

    const updated = {
      ...config,
      ...updates,
      updatedAt: new Date(),
    };

    this.configurations.set(id, updated);
    return updated;
  }

  async deleteConfiguration(id: string): Promise<boolean> {
    return this.configurations.delete(id);
  }

  async getDefaultConfiguration(): Promise<Configuration> {
    const configs = Array.from(this.configurations.values());
    return configs.find((c) => c.name === 'default') || await this.createDefaultConfiguration();
  }

  private async createDefaultConfiguration(): Promise<Configuration> {
    return this.createConfiguration({
      name: 'default',
      sandboxMode: 'workspace-write',
      authEnabled: false,
    });
  }

  async saveConfigToFile(id: string): Promise<void> {
    const config = this.configurations.get(id);
    if (!config) return;

    const tomlConfig = {
      sandbox_mode: config.sandboxMode,
      auth_enabled: config.authEnabled,
      mcp_servers: config.mcpServers,
      notifications: config.notificationSettings,
      custom: config.customSettings,
    };

    const tomlString = Object.entries(tomlConfig)
      .map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          return `[${key}]\n${Object.entries(value)
            .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
            .join('\n')}`;
        }
        return `${key} = ${JSON.stringify(value)}`;
      })
      .join('\n\n');

    await fs.writeFile(this.configPath, tomlString);
  }
}

export const configurationService = new ConfigurationService();