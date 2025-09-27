/**
 * Environment Configuration Type Definitions
 */

import type { IChromeConfig } from './types';

/**
 * Raw environment configuration from .env file
 */
export interface EnvironmentConfig {
  // Model Configuration
  CODEX_MODEL_SELECTED?: string;
  CODEX_MODEL_PROVIDER?: string;
  CODEX_MODEL_CONTEXT_WINDOW?: string;
  CODEX_MODEL_MAX_OUTPUT_TOKENS?: string;
  CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT?: string;
  CODEX_MODEL_REASONING_EFFORT?: string;
  CODEX_MODEL_REASONING_SUMMARY?: string;
  CODEX_MODEL_VERBOSITY?: string;

  // Dynamic provider keys
  [key: string]: string | undefined;
}

/**
 * Validation result for environment configuration
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  value: any;
  message: string;
  required?: boolean;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Configuration migration options
 */
export interface MigrationOptions {
  redactSecrets?: boolean;
  includeProfiles?: boolean;
}