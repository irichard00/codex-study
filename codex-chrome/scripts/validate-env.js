#!/usr/bin/env node

/**
 * Environment Configuration Validator
 * Validates .env configuration before build
 */

const fs = require('fs');
const path = require('path');

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

// Environment variable type definitions
const ENV_VAR_TYPES = {
  // Numbers
  CODEX_MODEL_CONTEXT_WINDOW: 'number',
  CODEX_MODEL_MAX_OUTPUT_TOKENS: 'number',
  CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT: 'number',
  CODEX_CACHE_TTL: 'number',
  CODEX_CACHE_MAX_SIZE: 'number',
  CODEX_EXTENSION_STORAGE_QUOTA_WARNING: 'number',
  CODEX_PROVIDER_OPENAI_TIMEOUT: 'number',
  CODEX_PROVIDER_ANTHROPIC_TIMEOUT: 'number',

  // Booleans
  CODEX_CACHE_ENABLED: 'boolean',
  CODEX_CACHE_COMPRESSION_ENABLED: 'boolean',
  CODEX_CACHE_PERSIST_TO_STORAGE: 'boolean',
  CODEX_PREFERENCES_AUTO_SYNC: 'boolean',
  CODEX_PREFERENCES_TELEMETRY_ENABLED: 'boolean',
  CODEX_EXTENSION_ENABLED: 'boolean',
  CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED: 'boolean',
  CODEX_EXTENSION_PERMISSIONS_TABS: 'boolean',
  CODEX_EXTENSION_PERMISSIONS_STORAGE: 'boolean',
  CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS: 'boolean',
  CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_READ: 'boolean',
  CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_WRITE: 'boolean',

  // Enums
  CODEX_MODEL_REASONING_EFFORT: ['low', 'medium', 'high'],
  CODEX_MODEL_REASONING_SUMMARY: ['none', 'brief', 'detailed'],
  CODEX_MODEL_VERBOSITY: ['low', 'medium', 'high'],
  CODEX_PREFERENCES_THEME: ['light', 'dark', 'system'],
  CODEX_EXTENSION_UPDATE_CHANNEL: ['stable', 'beta'],
};

// Sensitive fields that should not be logged
const SENSITIVE_FIELDS = [
  'API_KEY',
  'SECRET',
  'TOKEN',
  'PASSWORD',
];

function isSensitive(key) {
  return SENSITIVE_FIELDS.some(field => key.includes(field));
}

function validateType(key, value, expectedType) {
  if (expectedType === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: `Expected number but got "${value}"` };
    }
    return { valid: true, value: num };
  }

  if (expectedType === 'boolean') {
    if (value !== 'true' && value !== 'false') {
      return { valid: false, error: `Expected "true" or "false" but got "${value}"` };
    }
    return { valid: true, value: value === 'true' };
  }

  if (Array.isArray(expectedType)) {
    if (!expectedType.includes(value)) {
      return { valid: false, error: `Expected one of [${expectedType.join(', ')}] but got "${value}"` };
    }
    return { valid: true, value };
  }

  return { valid: true, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach((line, index) => {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      return;
    }

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim();
    }
  });

  return env;
}

function validateBusinessRules(env) {
  const errors = [];

  // Rule: maxOutputTokens <= contextWindow
  if (env.CODEX_MODEL_MAX_OUTPUT_TOKENS && env.CODEX_MODEL_CONTEXT_WINDOW) {
    const maxOutput = Number(env.CODEX_MODEL_MAX_OUTPUT_TOKENS);
    const contextWindow = Number(env.CODEX_MODEL_CONTEXT_WINDOW);

    if (maxOutput > contextWindow) {
      errors.push(`maxOutputTokens (${maxOutput}) cannot exceed contextWindow (${contextWindow})`);
    }
  }

  // Rule: Storage quota warning between 0-100
  if (env.CODEX_EXTENSION_STORAGE_QUOTA_WARNING) {
    const quota = Number(env.CODEX_EXTENSION_STORAGE_QUOTA_WARNING);
    if (quota < 0 || quota > 100) {
      errors.push(`Storage quota warning must be between 0 and 100 (got ${quota})`);
    }
  }

  // Rule: At least one provider must have an API key
  const hasOpenAIKey = env.CODEX_PROVIDER_OPENAI_API_KEY && env.CODEX_PROVIDER_OPENAI_API_KEY !== '';
  const hasAnthropicKey = env.CODEX_PROVIDER_ANTHROPIC_API_KEY && env.CODEX_PROVIDER_ANTHROPIC_API_KEY !== '';

  if (!hasOpenAIKey && !hasAnthropicKey) {
    errors.push('At least one provider must have an API key configured');
  }

  return errors;
}

function validateEnvironment() {
  log('\n🔍 Validating environment configuration...', colors.yellow);

  // Load environment files
  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const defaultsPath = path.join(projectRoot, '.env.defaults');

  const defaults = loadEnvFile(defaultsPath);
  const userEnv = loadEnvFile(envPath);

  // Merge with defaults
  const merged = { ...defaults, ...userEnv };

  let hasErrors = false;
  const warnings = [];

  // Validate types
  log('\n📋 Checking type constraints...', colors.yellow);

  Object.entries(ENV_VAR_TYPES).forEach(([key, type]) => {
    if (merged[key]) {
      const result = validateType(key, merged[key], type);
      if (!result.valid) {
        log(`  ❌ ${key}: ${result.error}`, colors.red);
        hasErrors = true;
      } else {
        const displayValue = isSensitive(key) ? '[REDACTED]' : result.value;
        log(`  ✓ ${key}: ${displayValue}`, colors.green);
      }
    }
  });

  // Validate business rules
  log('\n📏 Checking business rules...', colors.yellow);

  const businessErrors = validateBusinessRules(merged);
  if (businessErrors.length > 0) {
    businessErrors.forEach(error => {
      log(`  ❌ ${error}`, colors.red);
    });
    hasErrors = true;
  } else {
    log('  ✓ All business rules passed', colors.green);
  }

  // Check for missing recommended values
  log('\n⚠️  Checking for missing values...', colors.yellow);

  if (!userEnv.CODEX_PROVIDER_OPENAI_API_KEY && !userEnv.CODEX_PROVIDER_ANTHROPIC_API_KEY) {
    warnings.push('No API keys configured - using defaults may not work');
  }

  if (warnings.length > 0) {
    warnings.forEach(warning => {
      log(`  ⚠️  ${warning}`, colors.yellow);
    });
  } else {
    log('  ✓ No warnings', colors.green);
  }

  // Summary
  log('\n' + '='.repeat(50), colors.reset);

  if (hasErrors) {
    log('❌ Validation failed with errors', colors.red);
    log('Please fix the errors above and try again.', colors.red);
    process.exit(1);
  } else if (warnings.length > 0) {
    log('⚠️  Validation passed with warnings', colors.yellow);
    log(`Loaded ${Object.keys(merged).length} configuration values`, colors.green);
    process.exit(0);
  } else {
    log('✅ Validation passed successfully!', colors.green);
    log(`Loaded ${Object.keys(merged).length} configuration values`, colors.green);
    process.exit(0);
  }
}

// Run validation if called directly
if (require.main === module) {
  validateEnvironment();
}

module.exports = {
  loadEnvFile,
  validateType,
  validateBusinessRules,
  isSensitive,
};