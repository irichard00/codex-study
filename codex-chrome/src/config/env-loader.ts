/**
 * T016: Environment Configuration Loader Interface and Implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IChromeConfig } from './types';
import type { EnvironmentConfig, ValidationResult, ValidationWarning } from './env-types';

/**
 * Interface for environment configuration loader
 */
export interface IEnvConfigLoader {
  /**
   * Load environment variables from .env file
   */
  loadEnv(path?: string, environment?: string): Promise<EnvironmentConfig>;

  /**
   * Merge with defaults from .env.defaults
   */
  mergeDefaults(env: EnvironmentConfig): Promise<EnvironmentConfig>;

  /**
   * Generate build-time configuration module
   */
  generateConfigModule(config: IChromeConfig): Promise<string>;

  /**
   * Validate required environment variables
   */
  validateRequired(env: EnvironmentConfig): Promise<ValidationResult>;
}

/**
 * Environment configuration loader implementation
 */
export class EnvConfigLoader implements IEnvConfigLoader {
  private defaultsPath: string;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.defaultsPath = path.join(this.projectRoot, '.env.defaults');
  }

  async loadEnv(envPath?: string, environment?: string): Promise<EnvironmentConfig> {
    // T034: Support environment-specific loading
    const env = environment || process.env.NODE_ENV || 'production';
    const configs: EnvironmentConfig[] = [];

    // Load base .env file
    const basePath = envPath || path.join(this.projectRoot, '.env');
    if (fs.existsSync(basePath)) {
      const content = fs.readFileSync(basePath, 'utf8');
      configs.push(this.parseEnvFile(content));
    }

    // Load environment-specific file (.env.development, .env.production, .env.test)
    const envSpecificPath = envPath
      ? envPath.replace('.env', `.env.${env}`)
      : path.join(this.projectRoot, `.env.${env}`);

    if (fs.existsSync(envSpecificPath)) {
      const content = fs.readFileSync(envSpecificPath, 'utf8');
      configs.push(this.parseEnvFile(content));
    }

    // Load .env.local (highest priority, always ignored by git)
    const localPath = envPath
      ? envPath.replace('.env', '.env.local')
      : path.join(this.projectRoot, '.env.local');

    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      configs.push(this.parseEnvFile(content));
    }

    // Merge all configs (later configs override earlier ones)
    const merged = configs.reduce((acc, config) => ({ ...acc, ...config }), {});

    if (Object.keys(merged).length === 0 && envPath) {
      throw new Error(`Environment file not found: ${envPath}`);
    }

    return merged;
  }

  async mergeDefaults(env: EnvironmentConfig): Promise<EnvironmentConfig> {
    let defaults: EnvironmentConfig = {};

    if (fs.existsSync(this.defaultsPath)) {
      const defaultsContent = fs.readFileSync(this.defaultsPath, 'utf8');
      defaults = this.parseEnvFile(defaultsContent);
    }

    // Merge with defaults (env values override defaults)
    return { ...defaults, ...env };
  }

  async generateConfigModule(config: IChromeConfig): Promise<string> {
    const sanitizedConfig = this.sanitizeForBuild(config);

    const moduleContent = `/**
 * Generated build-time configuration
 * DO NOT EDIT - This file is auto-generated
 */

import type { IChromeConfig } from './types';

export const BUILD_CONFIG: Partial<IChromeConfig> = ${JSON.stringify(sanitizedConfig, null, 2)};

export const BUILD_TIME = "${new Date().toISOString()}";
export const BUILD_ENV = "${process.env.NODE_ENV || 'production'}";

// Runtime initialization placeholder
export function initializeRuntime(secrets: Record<string, string>): IChromeConfig {
  // Replace placeholders with actual values at runtime
  const config = JSON.parse(JSON.stringify(BUILD_CONFIG));

  // Replace {{RUNTIME_REPLACE}} placeholders
  if (config.providers) {
    Object.values(config.providers).forEach((provider: any) => {
      if (provider.apiKey === '{{RUNTIME_REPLACE}}') {
        provider.apiKey = secrets[provider.id] || '';
      }
    });
  }

  return config as IChromeConfig;
}
`;

    return moduleContent;
  }

  async validateRequired(env: EnvironmentConfig): Promise<ValidationResult> {
    const warnings: ValidationWarning[] = [];

    // API key validation removed - not required per requirements
    // API keys are optional for build

    // Check for model selection
    if (!env.CODEX_MODEL_SELECTED) {
      warnings.push({
        field: 'CODEX_MODEL_SELECTED',
        message: 'No model selected',
        suggestion: 'Add CODEX_MODEL_SELECTED=gpt-4 to your .env file',
      });
    }

    return {
      valid: true, // No required fields by default
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private parseEnvFile(content: string): EnvironmentConfig {
    const env: EnvironmentConfig = {};

    content.split('\n').forEach((line) => {
      // Skip comments and empty lines
      if (line.startsWith('#') || line.trim() === '') {
        return;
      }

      // Remove inline comments
      const commentIndex = line.indexOf('#');
      if (commentIndex > 0) {
        line = line.substring(0, commentIndex);
      }

      // Parse key-value
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let [, key, value] = match;
        key = key.trim();
        value = value.trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Handle export statements
        if (key.startsWith('export ')) {
          key = key.replace('export ', '');
        }

        env[key] = value;
      }
    });

    return env;
  }

  private sanitizeForBuild(config: any): any {
    const sanitized = JSON.parse(JSON.stringify(config));

    // Replace sensitive values with placeholders
    if (sanitized.providers) {
      Object.values(sanitized.providers).forEach((provider: any) => {
        if (provider.apiKey) {
          provider.apiKey = '{{RUNTIME_REPLACE}}';
          provider._keyPresent = true;
        }
      });
    }

    // Add metadata
    sanitized._metadata = {
      generated: true,
      timestamp: new Date().toISOString(),
      redactedFields: this.findRedactedFields(config),
    };

    return sanitized;
  }

  private findRedactedFields(obj: any, prefix = ''): string[] {
    const fields: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (key.toLowerCase().includes('api') && key.toLowerCase().includes('key')) {
        fields.push(fieldPath);
      } else if (key.toLowerCase().includes('secret')) {
        fields.push(fieldPath);
      } else if (key.toLowerCase().includes('password')) {
        fields.push(fieldPath);
      } else if (typeof value === 'object' && value !== null) {
        fields.push(...this.findRedactedFields(value, fieldPath));
      }
    }

    return fields;
  }
}