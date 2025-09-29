# Data Model: AgentConfig Integration

**Date**: 2025-01-26
**Feature**: AgentConfig propagation fix

## Overview

This document defines the data structures and relationships for proper AgentConfig integration throughout the codex-chrome extension components.

## Core Entities

### AgentConfig
**Purpose**: Centralized configuration management for the entire extension

**Existing Structure** (no changes needed):
```typescript
interface IAgentConfig {
  model: ModelConfig;
  security: SecurityConfig;
  features: FeaturesConfig;
  storage: StorageConfig;
}
```

**Event Emission**:
- Emits `config-changed` events when configuration updates
- Components subscribe to specific section changes

### Component Config Requirements

#### Session Config Usage
```typescript
interface SessionConfig {
  // Extract from AgentConfig
  defaultModel?: string;           // from config.model.selected
  defaultCwd?: string;             // from config.features.defaultCwd
  storageEnabled?: boolean;        // from config.storage.enabled
  approvalPolicy?: AskForApproval; // from config.security.approvalPolicy
}
```

#### ToolRegistry Config Usage
```typescript
interface ToolRegistryConfig {
  // Extract from AgentConfig
  enabledTools?: string[];         // from config.features.enabledTools
  toolTimeout?: number;            // from config.features.toolTimeout
  sandboxPolicy?: SandboxPolicy;  // from config.security.sandboxPolicy
}
```

#### ApprovalManager Config Usage
```typescript
interface ApprovalManagerConfig {
  // Extract from AgentConfig
  defaultPolicy?: ApprovalPolicy;  // from config.security.approvalPolicy
  autoApproveList?: string[];     // from config.security.autoApproveList
  timeout?: number;                // from config.security.approvalTimeout
}
```

#### ModelClientFactory Config Usage
```typescript
interface ModelFactoryConfig {
  // Extract from AgentConfig
  selectedModel?: string;          // from config.model.selected
  apiKeys?: Record<string, string>; // from config.model.apiKeys
  baseUrls?: Record<string, string>; // from config.model.baseUrls
}
```

## State Transitions

### Config Initialization Flow
```
1. CodexAgent creates/gets AgentConfig instance
2. AgentConfig.initialize() loads from storage
3. Components receive config in constructor
4. Components call their initialize() methods if present
5. Components subscribe to config change events
```

### Config Update Flow
```
1. Config value changes via UI or API
2. AgentConfig emits 'config-changed' event
3. Subscribed components receive event
4. Components update internal state
5. Components apply new configuration
```

## Relationships

### Component Hierarchy
```
CodexAgent
├── AgentConfig (singleton or instance)
├── Session (receives config)
├── ToolRegistry (receives config)
├── ApprovalManager (receives config)
├── ModelClientFactory (receives config via initialize)
└── TurnContext (already receives config)
```

### Config Propagation
- **Direct**: CodexAgent → Component constructors
- **Indirect**: Component.initialize(config) for async setup
- **Events**: config-changed → Component handlers

## Validation Rules

### Constructor Parameters
- Config parameters must be optional to maintain backward compatibility
- Components must handle undefined config gracefully
- Default values must be sensible when config not provided

### Initialize Methods
- Must be async to support async config loading
- Must be idempotent (safe to call multiple times)
- Must handle missing config without throwing

### Config Change Handling
- Components must validate config values before applying
- Invalid config should log warning but not crash
- Components should provide fallback behavior

## Migration Path

### Phase 1: Add Config Support
1. Add optional config parameter to constructors
2. Store config reference in components
3. No behavior change when config not provided

### Phase 2: Implement Config Usage
1. Components read values from config
2. Apply config during initialization
3. Subscribe to relevant config changes

### Phase 3: Testing & Validation
1. Unit tests for each component with/without config
2. Integration tests for full flow
3. Config change event testing

## Schema Definitions

### Component Constructor Signatures (Updated)
```typescript
// Current (broken)
new Session(this.config) // ❌ Session doesn't accept config

// Fixed signatures
class Session {
  constructor(config?: AgentConfig, isPersistent?: boolean)
}

class ToolRegistry {
  constructor(config?: AgentConfig, eventCollector?: EventCollector)
}

class ApprovalManager {
  constructor(config?: AgentConfig, eventEmitter?: (event: Event) => void)
}
```

### Initialize Method Signatures
```typescript
interface Initializable {
  initialize(config: AgentConfig): Promise<void>;
}

// Components implementing Initializable
class ModelClientFactory implements Initializable
class ToolRegistry implements Initializable
```

## Success Criteria

1. All components can receive AgentConfig
2. Config values are properly utilized
3. Config changes propagate to components
4. Backward compatibility maintained
5. No runtime errors from missing methods
6. Tests pass with and without config