# Data Model: Simplified Environment Configuration

**Feature**: Environment-Based AgentConfig (No Migration)
**Date**: 2025-01-27

## Core Entities

### 1. EnvironmentConfig
**Purpose**: Raw environment variables from .env files
**Source**: .env, .env.defaults, .env.{environment}, .env.local

```typescript
interface EnvironmentConfig {
  [key: string]: string;  // All env vars are strings initially
}
```

**Validations**:
- Keys must start with `CODEX_`
- Values are trimmed of whitespace
- Empty values are allowed (treated as undefined)

### 2. ConfigTransformer
**Purpose**: Transform flat env vars to hierarchical config
**Location**: `/src/config/env-transformer.ts`

```typescript
interface ConfigTransformer {
  transform(env: EnvironmentConfig): Partial<IChromeConfig>;
  validate(config: Partial<IChromeConfig>): ValidationResult;
}
```

**State Transitions**:
```
Raw Env Vars → Parse → Type Transform → Validate → IChromeConfig
```

### 3. EnvConfigLoader
**Purpose**: Load and merge environment files
**Location**: `/src/config/env-loader.ts`

```typescript
interface EnvConfigLoader {
  loadEnv(path?: string, environment?: string): EnvironmentConfig;
  mergeDefaults(env: EnvironmentConfig): EnvironmentConfig;
  generateConfigModule(config: IChromeConfig): string;
}
```

**File Loading Order**:
1. `.env.defaults` (base defaults)
2. `.env` (user configuration)
3. `.env.{environment}` (environment-specific)
4. `.env.local` (local overrides, highest priority)

## Configuration Schema

### Model Configuration
```typescript
interface IModelConfig {
  selected?: string;          // CODEX_MODEL_SELECTED
  provider?: string;          // CODEX_MODEL_PROVIDER
  contextWindow?: number;     // CODEX_MODEL_CONTEXT_WINDOW
  maxOutputTokens?: number;   // CODEX_MODEL_MAX_OUTPUT_TOKENS
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
}
```

### Provider Configuration
**Dynamic Discovery Pattern**: `CODEX_PROVIDER_{ID}_{FIELD}`

```typescript
interface IProviderConfig {
  id: string;
  name: string;
  apiKey?: string;           // Sanitized at build time
  baseUrl?: string;
  timeout?: number;
  organization?: string;
  version?: string;
}
```

### User Preferences
```typescript
interface IUserPreferences {
  autoSync?: boolean;         // CODEX_PREFERENCES_AUTO_SYNC
  telemetryEnabled?: boolean; // CODEX_PREFERENCES_TELEMETRY_ENABLED
  theme?: 'light' | 'dark' | 'system';
}
```

### Cache Settings
```typescript
interface ICacheSettings {
  enabled?: boolean;          // CODEX_CACHE_ENABLED
  ttl?: number;              // CODEX_CACHE_TTL (seconds)
  maxSize?: number;          // CODEX_CACHE_MAX_SIZE (bytes)
  compressionEnabled?: boolean;
}
```

### Extension Settings
```typescript
interface IExtensionSettings {
  enabled?: boolean;
  contentScriptEnabled?: boolean;
  allowedOrigins?: string[];  // Comma-separated in env
  storageQuotaWarning?: number; // 0-100 percentage
  permissions?: {
    tabs?: boolean;
    storage?: boolean;
    notifications?: boolean;
    clipboardRead?: boolean;
    clipboardWrite?: boolean;
  };
}
```

## Type Transformations

### String → Boolean
- `"true"`, `"1"`, `"yes"` → `true`
- `"false"`, `"0"`, `"no"` → `false`
- Case insensitive

### String → Number
- Parse with `Number()`
- NaN values rejected with error

### String → Array
- Split on comma: `"a,b,c"` → `["a", "b", "c"]`
- Trim each element
- Empty strings filtered out

## Business Rules

### R1: Token Limits
- `maxOutputTokens` must be ≤ `contextWindow`
- Validated at build time

### R2: Provider Consistency
- Selected provider must exist in providers map
- At least one provider must have an API key

### R3: Storage Quota
- `storageQuotaWarning` must be 0-100
- Default: 80%

### R4: Sensitive Data
- API keys replaced with `{{RUNTIME_REPLACE}}` in build output
- Never logged or exposed in error messages

## Build-Time Configuration

### Generated Module Structure
```typescript
// build-config.ts (generated)
export const BUILD_CONFIG: Partial<IChromeConfig> = {
  // Sanitized configuration
};

export function initializeRuntime(secrets: Record<string, string>): IChromeConfig {
  // Replace placeholders with actual API keys
}
```

### Metadata Fields
```typescript
interface BuildMetadata {
  generated: boolean;
  timestamp: string;
  environment: string;
  redactedFields: string[];
}
```

## Error Handling

### Validation Errors
```typescript
interface ValidationError {
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}
```

### Common Errors
- `MISSING_REQUIRED`: Required field not provided
- `INVALID_TYPE`: Type transformation failed
- `BUSINESS_RULE`: Business rule violation
- `PARSE_ERROR`: .env file syntax error

## State Management

### Configuration Lifecycle
```
1. Build Time:
   - Load .env files
   - Transform to config
   - Validate
   - Generate build-config.ts

2. Runtime:
   - Import build-config.ts
   - Initialize with secrets
   - Store in AgentConfig singleton
   - Persist to Chrome storage
```

### Update Flow (Simplified - No Migration)
```
User edits .env → Rebuild extension → New config embedded → Runtime uses new config
```

## Removed Entities (Per User Request)

The following entities from the original implementation are removed:
- `ConfigMigrator`: No migration support needed
- `MigrationStrategy`: No conversion from old formats
- `ImportExporter`: Simplified to basic .env files only
- `ProfileManager`: No profile switching in simplified version

## Summary

This simplified data model focuses on the core requirement: loading configuration from .env files at build time. By removing migration and profile features, we achieve a cleaner, more maintainable solution that still provides full environment-based configuration capabilities.