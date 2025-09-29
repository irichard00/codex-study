# AgentConfig Integration Implementation Guide

## Overview
This guide outlines the specific changes needed to fix the AgentConfig integration issues in the codex-chrome extension.

## Required Changes by Component

### 1. Session.ts Changes

```typescript
// Add to imports
import { AgentConfig } from '../config/AgentConfig';

// Update class definition
export class Session {
  private config?: AgentConfig;
  private isPersistent: boolean;

  // Update constructor
  constructor(configOrIsPersistent?: AgentConfig | boolean, isPersistent?: boolean) {
    // Handle both new and old signatures
    if (typeof configOrIsPersistent === 'boolean') {
      // Old signature: Session(isPersistent?: boolean)
      this.isPersistent = configOrIsPersistent;
      this.config = undefined;
    } else {
      // New signature: Session(config?: AgentConfig, isPersistent?: boolean)
      this.config = configOrIsPersistent;
      this.isPersistent = isPersistent ?? true;
    }

    // Initialize turn context with config values if available
    if (this.config) {
      this.setupWithConfig();
    }
  }

  // Add config usage methods
  getDefaultModel(): string {
    return this.config?.getModelConfig()?.selected || 'claude-3-sonnet';
  }

  getDefaultCwd(): string {
    return this.config?.getConfig()?.features?.defaultCwd || '/';
  }

  isStorageEnabled(): boolean {
    return this.config?.getConfig()?.storage?.enabled ?? true;
  }

  // Add config change handler
  private setupWithConfig(): void {
    this.config?.on('config-changed', (event) => {
      this.handleConfigChange(event);
    });
  }

  private handleConfigChange(event: any): void {
    // Update internal state based on config changes
    if (event.section === 'model' || event.section === 'features') {
      this.updateTurnContext({
        model: this.getDefaultModel(),
        cwd: this.getDefaultCwd()
      });
    }
  }
}
```

### 2. ToolRegistry.ts Changes

```typescript
// Add to imports
import { AgentConfig } from '../config/AgentConfig';

export class ToolRegistry {
  private config?: AgentConfig;
  private eventCollector?: EventCollector;

  // Update constructor
  constructor(configOrEventCollector?: AgentConfig | EventCollector, eventCollector?: EventCollector) {
    if (configOrEventCollector instanceof AgentConfig ||
        (configOrEventCollector && 'getConfig' in configOrEventCollector)) {
      this.config = configOrEventCollector as AgentConfig;
      this.eventCollector = eventCollector;
    } else {
      this.eventCollector = configOrEventCollector as EventCollector;
    }
  }

  // Add initialize method
  async initialize(config: AgentConfig): Promise<void> {
    this.config = config;
    // Initialize tools based on config
    await this.loadConfiguredTools();
  }

  // Add config usage methods
  getEnabledTools(): string[] {
    return this.config?.getConfig()?.features?.enabledTools || [];
  }

  getToolTimeout(): number {
    return this.config?.getConfig()?.features?.toolTimeout || 30000;
  }

  getSandboxPolicy(): any {
    return this.config?.getConfig()?.security?.sandboxPolicy || { mode: 'workspace-write' };
  }

  private async loadConfiguredTools(): Promise<void> {
    const enabledTools = this.getEnabledTools();
    // Load only enabled tools
  }
}
```

### 3. ApprovalManager.ts Changes

```typescript
// Add to imports
import { AgentConfig } from '../config/AgentConfig';

export class ApprovalManager {
  private config?: AgentConfig;
  private eventEmitter?: (event: Event) => void;

  // Update constructor
  constructor(configOrEventEmitter?: AgentConfig | ((event: Event) => void), eventEmitter?: (event: Event) => void) {
    if (configOrEventEmitter && typeof configOrEventEmitter !== 'function') {
      this.config = configOrEventEmitter as AgentConfig;
      this.eventEmitter = eventEmitter;
    } else {
      this.eventEmitter = configOrEventEmitter as (event: Event) => void;
    }

    // Setup config-based policies
    if (this.config) {
      this.setupWithConfig();
    }
  }

  // Add config usage methods
  getDefaultPolicy(): any {
    return this.config?.getConfig()?.security?.approvalPolicy || { mode: 'always_ask' };
  }

  getAutoApproveList(): string[] {
    return this.config?.getConfig()?.security?.autoApproveList || [];
  }

  getApprovalTimeout(): number {
    return this.config?.getConfig()?.security?.approvalTimeout || 30000;
  }

  private setupWithConfig(): void {
    // Apply config-based policy
    this.policy = this.getDefaultPolicy();

    // Subscribe to config changes
    this.config?.on('config-changed', (event) => {
      if (event.section === 'security') {
        this.policy = this.getDefaultPolicy();
      }
    });
  }
}
```

### 4. ModelClientFactory.ts Changes

```typescript
// Add to class
export class ModelClientFactory {
  private config?: AgentConfig;

  // Add initialize method
  async initialize(config: AgentConfig): Promise<void> {
    this.config = config;
    // Clear cache when config changes
    this.clientCache.clear();
  }

  // Add config usage methods
  getSelectedModel(): string {
    return this.config?.getModelConfig()?.selected || DEFAULT_MODEL;
  }

  getApiKey(provider: string): string | undefined {
    return this.config?.getConfig()?.model?.apiKeys?.[provider];
  }

  getBaseUrl(provider: string): string | undefined {
    return this.config?.getConfig()?.model?.baseUrls?.[provider];
  }

  // Update createClientForModel to use config
  async createClientForModel(model: string): Promise<ModelClient> {
    if (model === 'default') {
      model = this.getSelectedModel();
    }
    // ... rest of implementation
  }
}
```

## Testing the Implementation

After implementing these changes, run the test suite to verify:

```bash
cd codex-chrome
pnpm test
```

Specific test files to check:
- tests/core/Session.config.test.ts
- tests/tools/ToolRegistry.config.test.ts
- tests/core/ApprovalManager.config.test.ts
- tests/models/ModelClientFactory.config.test.ts
- tests/integration/config-flow.test.ts
- tests/integration/backward-compat.test.ts

## Validation Checklist

- [ ] All constructors accept optional AgentConfig
- [ ] Initialize methods added where needed
- [ ] Config properties stored in components
- [ ] Config values used in component logic
- [ ] Config change events handled
- [ ] Backward compatibility maintained
- [ ] All tests pass
- [ ] TypeScript compilation succeeds
- [ ] Extension builds without errors