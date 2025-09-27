/**
 * Contract definitions for component initialization with AgentConfig
 * These interfaces define the expected behavior after the fix is implemented
 */

import type { AgentConfig } from '../../../codex-chrome/src/config/AgentConfig';
import type { Event } from '../../../codex-chrome/src/protocol/types';
import type { EventCollector } from '../../../codex-chrome/src/tests/utils/test-helpers';

/**
 * Contract for components that accept AgentConfig in constructor
 */
export interface ConfigurableComponent {
  // Components should store config reference
  readonly config?: AgentConfig;
}

/**
 * Contract for components that can be initialized with config
 */
export interface InitializableComponent {
  /**
   * Initialize the component with configuration
   * @param config The agent configuration
   * @returns Promise that resolves when initialization is complete
   */
  initialize(config: AgentConfig): Promise<void>;
}

/**
 * Contract for Session component after fix
 */
export interface SessionContract extends ConfigurableComponent {
  constructor(config?: AgentConfig, isPersistent?: boolean);

  // Config should influence these behaviors
  getDefaultModel(): string;
  getDefaultCwd(): string;
  isStorageEnabled(): boolean;
}

/**
 * Contract for ToolRegistry component after fix
 */
export interface ToolRegistryContract extends ConfigurableComponent, InitializableComponent {
  constructor(config?: AgentConfig, eventCollector?: EventCollector);

  // Config should influence these behaviors
  getEnabledTools(): string[];
  getToolTimeout(): number;
  getSandboxPolicy(): any; // SandboxPolicy type
}

/**
 * Contract for ApprovalManager component after fix
 */
export interface ApprovalManagerContract extends ConfigurableComponent {
  constructor(config?: AgentConfig, eventEmitter?: (event: Event) => void);

  // Config should influence these behaviors
  getDefaultPolicy(): any; // ApprovalPolicy type
  getAutoApproveList(): string[];
  getApprovalTimeout(): number;
}

/**
 * Contract for ModelClientFactory after fix
 */
export interface ModelClientFactoryContract extends InitializableComponent {
  // Singleton pattern preserved
  static getInstance(): ModelClientFactoryContract;

  // Config should influence these behaviors
  getSelectedModel(): string;
  getApiKey(provider: string): string | undefined;
  getBaseUrl(provider: string): string | undefined;
}

/**
 * Contract test scenarios
 */
export const testScenarios = {
  /**
   * Test: Components accept config in constructor
   */
  constructorAcceptsConfig: {
    description: 'All components should accept optional AgentConfig parameter',
    components: ['Session', 'ToolRegistry', 'ApprovalManager'],
    assertion: 'No runtime errors when passing config to constructor'
  },

  /**
   * Test: Initialize methods exist and work
   */
  initializeMethodExists: {
    description: 'ModelClientFactory and ToolRegistry should have initialize methods',
    components: ['ModelClientFactory', 'ToolRegistry'],
    assertion: 'initialize(config) method exists and returns Promise<void>'
  },

  /**
   * Test: Config values are used
   */
  configValuesApplied: {
    description: 'Components should use config values for their operations',
    components: ['Session', 'ToolRegistry', 'ApprovalManager', 'ModelClientFactory'],
    assertion: 'Component behavior changes based on config values'
  },

  /**
   * Test: Backward compatibility
   */
  backwardCompatibility: {
    description: 'Components should work without config (backward compatibility)',
    components: ['Session', 'ToolRegistry', 'ApprovalManager'],
    assertion: 'Components work with default behavior when no config provided'
  },

  /**
   * Test: Config change handling
   */
  configChangeEvents: {
    description: 'Components should respond to config change events',
    components: ['Session', 'ToolRegistry', 'ApprovalManager'],
    assertion: 'Components update behavior when config-changed event is emitted'
  }
};

/**
 * Integration test contract
 */
export interface IntegrationTestContract {
  /**
   * Full initialization flow should work
   */
  testFullInitialization(): Promise<void>;

  /**
   * Config should propagate through component hierarchy
   */
  testConfigPropagation(): Promise<void>;

  /**
   * Runtime config updates should work
   */
  testRuntimeConfigUpdates(): Promise<void>;
}