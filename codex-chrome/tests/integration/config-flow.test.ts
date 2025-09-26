import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// These imports will initially fail because the implementations don't exist yet
import { AgentConfig } from '../../src/config/AgentConfig';
import { ConfigStorage } from '../../src/storage/ConfigStorage';
import { CodexAgent } from '../../src/core/CodexAgent';
import { AgentTask } from '../../src/core/AgentTask';
import type { AgentConfigData, ConfigProfile } from '../../src/config/types';

// Mock Chrome APIs
const mockChromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  connect: vi.fn(() => ({
    postMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    },
    onDisconnect: {
      addListener: vi.fn()
    }
  }))
};

// @ts-ignore - Mock Chrome API
global.chrome = {
  runtime: mockChromeRuntime,
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    }
  }
};

describe('Config Flow Integration', () => {
  let agentConfig: AgentConfig;
  let configStorage: ConfigStorage;
  let codexAgent: CodexAgent;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset singleton instances
    AgentConfig.resetInstance?.();

    agentConfig = AgentConfig.getInstance();
    configStorage = new ConfigStorage();
    codexAgent = new CodexAgent();
  });

  afterEach(() => {
    AgentConfig.resetInstance?.();
  });

  describe('End-to-End Configuration Flow', () => {
    it('should complete full configuration lifecycle', async () => {
      // Initialize with default config
      await agentConfig.initialize();

      const initialConfig = agentConfig.getConfig();
      expect(initialConfig.model).toBe('claude-3-5-sonnet-20241022');

      // Update configuration
      const newConfig: Partial<AgentConfigData> = {
        model: 'claude-3-haiku-20240307',
        approval_policy: 'never',
        sandbox_policy: { mode: 'workspace-write', network_access: true }
      };

      await agentConfig.updateConfig(newConfig);

      // Verify configuration was updated
      const updatedConfig = agentConfig.getConfig();
      expect(updatedConfig.model).toBe('claude-3-haiku-20240307');
      expect(updatedConfig.approval_policy).toBe('never');

      // Verify storage was updated
      const storedConfig = await configStorage.loadConfig();
      expect(storedConfig).toEqual(updatedConfig);
    });

    it('should handle configuration validation errors', async () => {
      await agentConfig.initialize();

      const invalidConfig = {
        model: 'invalid-model-name',
        approval_policy: 'invalid-policy'
      };

      await expect(
        agentConfig.updateConfig(invalidConfig as any)
      ).rejects.toThrow();

      // Verify original config is preserved
      const config = agentConfig.getConfig();
      expect(config.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should recover from storage corruption', async () => {
      // Mock corrupted storage data
      global.chrome.storage.sync.get.mockResolvedValue({
        'codex-agent-config': 'corrupted-json-data'
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await agentConfig.initialize();

      // Should fall back to default configuration
      const config = agentConfig.getConfig();
      expect(config.model).toBe('claude-3-5-sonnet-20241022');

      consoleSpy.mockRestore();
    });
  });

  describe('Agent Integration', () => {
    it('should inject configuration into CodexAgent', async () => {
      await agentConfig.initialize();

      // Update config
      await agentConfig.updateConfig({
        model: 'claude-3-haiku-20240307',
        approval_policy: 'never'
      });

      // Initialize agent
      await codexAgent.initialize();

      // Verify agent received configuration
      const agentConfig_received = codexAgent.getConfig();
      expect(agentConfig_received.model).toBe('claude-3-haiku-20240307');
      expect(agentConfig_received.approval_policy).toBe('never');
    });

    it('should update agent configuration dynamically', async () => {
      await agentConfig.initialize();
      await codexAgent.initialize();

      // Subscribe agent to config changes
      agentConfig.subscribe((newConfig) => {
        codexAgent.updateConfig(newConfig);
      });

      // Update configuration
      await agentConfig.updateConfig({
        model: 'claude-3-opus-20240229'
      });

      // Verify agent configuration was updated
      const agentConfigData = codexAgent.getConfig();
      expect(agentConfigData.model).toBe('claude-3-opus-20240229');
    });

    it('should handle agent task configuration', async () => {
      await agentConfig.initialize();

      // Create task with specific configuration requirements
      const taskConfig: Partial<AgentConfigData> = {
        model: 'claude-3-haiku-20240307',
        approval_policy: 'untrusted',
        sandbox_policy: { mode: 'read-only' }
      };

      const task = new AgentTask('test-task', taskConfig);

      // Verify task has correct configuration
      expect(task.getConfig()).toEqual(expect.objectContaining(taskConfig));
    });
  });

  describe('Profile Workflows', () => {
    it('should create and switch profiles with agent updates', async () => {
      await agentConfig.initialize();
      await codexAgent.initialize();

      // Create development profile
      const devConfig: Partial<AgentConfigData> = {
        model: 'claude-3-haiku-20240307',
        approval_policy: 'never',
        sandbox_policy: { mode: 'workspace-write' }
      };

      await agentConfig.createProfile('development', devConfig);

      // Subscribe agent to config changes
      agentConfig.subscribe((newConfig) => {
        codexAgent.updateConfig(newConfig);
      });

      // Switch to development profile
      await agentConfig.switchProfile('development');

      // Verify agent configuration updated
      const agentConfigData = codexAgent.getConfig();
      expect(agentConfigData.model).toBe('claude-3-haiku-20240307');
      expect(agentConfigData.approval_policy).toBe('never');
    });

    it('should persist profile selection across sessions', async () => {
      await agentConfig.initialize();

      // Create and switch to production profile
      await agentConfig.createProfile('production', {
        model: 'claude-3-opus-20240229',
        approval_policy: 'untrusted'
      });

      await agentConfig.switchProfile('production');

      // Simulate restart by creating new instance
      AgentConfig.resetInstance();
      const newInstance = AgentConfig.getInstance();
      await newInstance.initialize();

      // Should restore production profile
      expect(newInstance.getActiveProfile()).toBe('production');
      expect(newInstance.getConfig().model).toBe('claude-3-opus-20240229');
    });

    it('should handle profile deletion gracefully', async () => {
      await agentConfig.initialize();
      await codexAgent.initialize();

      // Create and switch to temporary profile
      await agentConfig.createProfile('temp', {
        model: 'claude-3-haiku-20240307'
      });
      await agentConfig.switchProfile('temp');

      // Subscribe agent to changes
      agentConfig.subscribe((newConfig) => {
        codexAgent.updateConfig(newConfig);
      });

      // Delete active profile - should switch to default
      await agentConfig.deleteProfile('temp');

      expect(agentConfig.getActiveProfile()).toBe('default');
      expect(codexAgent.getConfig().model).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle storage failures gracefully', async () => {
      // Mock storage failure
      global.chrome.storage.sync.set.mockRejectedValue(new Error('Storage failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await agentConfig.initialize();

      // Configuration update should handle error gracefully
      await agentConfig.updateConfig({ model: 'claude-3-haiku-20240307' });

      // Should still update in-memory config
      expect(agentConfig.getConfig().model).toBe('claude-3-haiku-20240307');

      consoleSpy.mockRestore();
    });

    it('should validate configurations before applying', async () => {
      await agentConfig.initialize();
      await codexAgent.initialize();

      // Subscribe agent to config changes
      const updateSpy = vi.spyOn(codexAgent, 'updateConfig');
      agentConfig.subscribe((newConfig) => {
        codexAgent.updateConfig(newConfig);
      });

      // Attempt invalid configuration update
      try {
        await agentConfig.updateConfig({
          model: 'invalid-model',
          approval_policy: 'invalid-policy'
        } as any);
      } catch (error) {
        // Expected to fail
      }

      // Agent should not have been called with invalid config
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should maintain consistency during concurrent updates', async () => {
      await agentConfig.initialize();

      const config1 = agentConfig.updateConfig({ model: 'claude-3-haiku-20240307' });
      const config2 = agentConfig.updateConfig({ approval_policy: 'never' });

      await Promise.all([config1, config2]);

      // Final configuration should have both updates
      const finalConfig = agentConfig.getConfig();
      expect(finalConfig.model).toBe('claude-3-haiku-20240307');
      expect(finalConfig.approval_policy).toBe('never');
    });
  });

  describe('Performance and Optimization', () => {
    it('should debounce rapid configuration changes', async () => {
      await agentConfig.initialize();

      const updateSpy = vi.spyOn(configStorage, 'saveConfig');

      // Rapid successive updates
      const updates = [
        agentConfig.updateConfig({ model: 'claude-3-haiku-20240307' }),
        agentConfig.updateConfig({ approval_policy: 'never' }),
        agentConfig.updateConfig({ cwd: '/new/workspace' })
      ];

      await Promise.all(updates);

      // Should have batched storage operations
      expect(updateSpy.mock.calls.length).toBeLessThan(3);
    });

    it('should cache configuration for fast access', async () => {
      await agentConfig.initialize();

      const getConfigSpy = vi.spyOn(agentConfig, 'getConfig');

      // Multiple config accesses
      for (let i = 0; i < 10; i++) {
        agentConfig.getConfig();
      }

      // Should not trigger multiple storage reads
      expect(getConfigSpy).toHaveBeenCalledTimes(10);
      // But underlying storage should only be accessed once during init
    });

    it('should handle large profile collections efficiently', async () => {
      await agentConfig.initialize();

      // Create many profiles
      const profilePromises = [];
      for (let i = 0; i < 50; i++) {
        profilePromises.push(
          agentConfig.createProfile(`profile-${i}`, {
            model: 'claude-3-haiku-20240307',
            cwd: `/workspace-${i}`
          })
        );
      }

      await Promise.all(profilePromises);

      const profiles = agentConfig.getProfiles();
      expect(Object.keys(profiles)).toHaveLength(51); // 50 + default

      // Profile switching should still be fast
      const start = Date.now();
      await agentConfig.switchProfile('profile-25');
      const end = Date.now();

      expect(end - start).toBeLessThan(100); // Should complete within 100ms
    });
  });
});