#!/usr/bin/env node

/**
 * T029: Build-time config generation script
 * Generates build-config.ts from environment variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import validation from validate-env.js
const { loadEnvFile, validateBusinessRules } = require('./validate-env');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function generateConfig() {
  log('\n🔧 Generating build-time configuration...', colors.yellow);

  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const defaultsPath = path.join(projectRoot, '.env.defaults');
  const outputPath = path.join(projectRoot, 'src', 'config', 'build-config.ts');

  // Load environment files
  const defaults = loadEnvFile(defaultsPath);
  const userEnv = loadEnvFile(envPath);
  const merged = { ...defaults, ...userEnv };

  // Validate business rules
  const businessErrors = validateBusinessRules(merged);
  if (businessErrors.length > 0) {
    businessErrors.forEach(error => {
      log(`❌ ${error}`, colors.red);
    });
    process.exit(1);
  }

  // Transform to config structure
  const config = transformToConfig(merged);

  // Generate TypeScript module
  const moduleContent = generateModule(config);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write the file
  fs.writeFileSync(outputPath, moduleContent, 'utf8');
  log(`✅ Configuration generated at ${outputPath}`, colors.green);
}

function transformToConfig(env) {
  const config = {
    model: {},
    providers: {},
    preferences: {},
    cache: {},
    extension: {
      permissions: {}
    }
  };

  // Transform model settings
  if (env.CODEX_MODEL_SELECTED) config.model.selected = env.CODEX_MODEL_SELECTED;
  if (env.CODEX_MODEL_PROVIDER) config.model.provider = env.CODEX_MODEL_PROVIDER;
  if (env.CODEX_MODEL_CONTEXT_WINDOW) config.model.contextWindow = Number(env.CODEX_MODEL_CONTEXT_WINDOW);
  if (env.CODEX_MODEL_MAX_OUTPUT_TOKENS) config.model.maxOutputTokens = Number(env.CODEX_MODEL_MAX_OUTPUT_TOKENS);

  // Transform providers
  Object.keys(env).forEach(key => {
    const match = key.match(/^CODEX_PROVIDER_([A-Z]+)_(.+)$/);
    if (match) {
      const [, provider, field] = match;
      const providerId = provider.toLowerCase();

      if (!config.providers[providerId]) {
        config.providers[providerId] = {
          id: providerId,
          name: provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase(),
          timeout: 30000
        };
      }

      const fieldName = field.toLowerCase().replace(/_/g, '');
      let value = env[key];

      // Sanitize API keys
      if (fieldName === 'apikey') {
        value = '{{RUNTIME_REPLACE}}';
        config.providers[providerId]._keyPresent = true;
      } else if (fieldName === 'timeout') {
        value = Number(value);
      }

      config.providers[providerId][fieldName] = value;
    }
  });

  // Transform preferences
  if (env.CODEX_PREFERENCES_AUTO_SYNC) config.preferences.autoSync = env.CODEX_PREFERENCES_AUTO_SYNC === 'true';
  if (env.CODEX_PREFERENCES_TELEMETRY_ENABLED) config.preferences.telemetryEnabled = env.CODEX_PREFERENCES_TELEMETRY_ENABLED === 'true';
  if (env.CODEX_PREFERENCES_THEME) config.preferences.theme = env.CODEX_PREFERENCES_THEME;

  // Transform cache settings
  if (env.CODEX_CACHE_ENABLED) config.cache.enabled = env.CODEX_CACHE_ENABLED === 'true';
  if (env.CODEX_CACHE_TTL) config.cache.ttl = Number(env.CODEX_CACHE_TTL);
  if (env.CODEX_CACHE_MAX_SIZE) config.cache.maxSize = Number(env.CODEX_CACHE_MAX_SIZE);

  // Transform extension settings
  if (env.CODEX_EXTENSION_ENABLED) config.extension.enabled = env.CODEX_EXTENSION_ENABLED === 'true';
  if (env.CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED) config.extension.contentScriptEnabled = env.CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED === 'true';
  if (env.CODEX_EXTENSION_UPDATE_CHANNEL) config.extension.updateChannel = env.CODEX_EXTENSION_UPDATE_CHANNEL;

  return config;
}

function generateModule(config) {
  return `/**
 * Generated build-time configuration
 * DO NOT EDIT - This file is auto-generated
 * Generated at: ${new Date().toISOString()}
 */

import type { IChromeConfig } from './types';

export const BUILD_CONFIG: Partial<IChromeConfig> = ${JSON.stringify(config, null, 2)};

export const BUILD_TIME = "${new Date().toISOString()}";
export const BUILD_ENV = "${process.env.NODE_ENV || 'production'}";

// Runtime initialization for sensitive values
export function initializeRuntime(secrets: Record<string, string>): IChromeConfig {
  const config = JSON.parse(JSON.stringify(BUILD_CONFIG));

  // Replace API key placeholders
  if (config.providers) {
    Object.entries(config.providers).forEach(([id, provider]) => {
      if (provider.apiKey === '{{RUNTIME_REPLACE}}' && provider._keyPresent) {
        provider.apiKey = secrets[id] || '';
        delete provider._keyPresent;
      }
    });
  }

  return config as IChromeConfig;
}
`;
}

// Run if called directly
if (require.main === module) {
  generateConfig();
}

module.exports = {
  generateConfig,
  transformToConfig,
};