/**
 * T020: Business Rules Validation Tests
 * Tests for simplified validation rules without migration features
 */

import { describe, it, expect } from 'vitest';
import {
  validateTokenLimits,
  validateStorageQuota,
  validateApiKeys,
  validateProviderExists,
  validateBusinessRules,
  type BusinessRuleViolation
} from '@config/business-rules';
import type { IChromeConfig, IModelConfig } from '@config/types';

describe('Business Rules Validation', () => {
  describe('validateTokenLimits', () => {
    it('should pass when maxOutputTokens is less than contextWindow', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 4096
      };

      const result = validateTokenLimits(model);

      expect(result).toBeNull();
    });

    it('should pass when maxOutputTokens equals contextWindow', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai',
        contextWindow: 4096,
        maxOutputTokens: 4096
      };

      const result = validateTokenLimits(model);

      expect(result).toBeNull();
    });

    it('should fail when maxOutputTokens exceeds contextWindow', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai',
        contextWindow: 1000,
        maxOutputTokens: 2000
      };

      const result = validateTokenLimits(model);

      expect(result).not.toBeNull();
      expect(result!.rule).toBe('token-limits');
      expect(result!.field).toBe('model.maxOutputTokens');
      expect(result!.message).toContain('maxOutputTokens (2000) cannot exceed contextWindow (1000)');
      expect(result!.suggestion).toContain('Set maxOutputTokens to 1000 or less');
    });

    it('should pass when maxOutputTokens is undefined', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai',
        contextWindow: 128000
      };

      const result = validateTokenLimits(model);

      expect(result).toBeNull();
    });

    it('should pass when contextWindow is undefined', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai',
        maxOutputTokens: 4096
      };

      const result = validateTokenLimits(model);

      expect(result).toBeNull();
    });

    it('should pass when both are undefined', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai'
      };

      const result = validateTokenLimits(model);

      expect(result).toBeNull();
    });

    it('should handle zero values correctly', () => {
      const model: IModelConfig = {
        selected: 'gpt-4',
        provider: 'openai',
        contextWindow: 0,
        maxOutputTokens: 1
      };

      const result = validateTokenLimits(model);

      expect(result).not.toBeNull();
      expect(result!.message).toContain('maxOutputTokens (1) cannot exceed contextWindow (0)');
    });
  });

  describe('validateStorageQuota', () => {
    it('should pass for valid quota values', () => {
      const validValues = [0, 25, 50, 75, 80, 90, 100];

      validValues.forEach(value => {
        const result = validateStorageQuota(value);
        expect(result).toBeNull();
      });
    });

    it('should fail for negative values', () => {
      const result = validateStorageQuota(-1);

      expect(result).not.toBeNull();
      expect(result!.rule).toBe('storage-quota');
      expect(result!.field).toBe('extension.storageQuotaWarning');
      expect(result!.message).toContain('Storage quota warning must be between 0 and 100 (got -1)');
      expect(result!.suggestion).toBe('Use a value between 0 and 100 to represent percentage');
    });

    it('should fail for values greater than 100', () => {
      const result = validateStorageQuota(150);

      expect(result).not.toBeNull();
      expect(result!.rule).toBe('storage-quota');
      expect(result!.message).toContain('Storage quota warning must be between 0 and 100 (got 150)');
    });

    it('should pass when quota is undefined', () => {
      const result = validateStorageQuota(undefined);

      expect(result).toBeNull();
    });

    it('should handle edge cases', () => {
      // Test boundary values
      expect(validateStorageQuota(0)).toBeNull();
      expect(validateStorageQuota(100)).toBeNull();
      expect(validateStorageQuota(-0.1)).not.toBeNull();
      expect(validateStorageQuota(100.1)).not.toBeNull();
    });
  });

  describe('validateApiKeys', () => {
    it('should pass when at least one provider has a valid API key', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          },
          anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            apiKey: ''
          }
        }
      };

      const result = validateApiKeys(config);

      expect(result).toBeNull();
    });

    it('should fail when no providers have API keys', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: ''
          },
          anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            apiKey: '   '
          }
        }
      };

      const result = validateApiKeys(config);

      expect(result).not.toBeNull();
      expect(result!.rule).toBe('api-keys');
      expect(result!.field).toBe('providers');
      expect(result!.message).toBe('At least one provider must have a valid API key');
      expect(result!.suggestion).toContain('CODEX_PROVIDER_OPENAI_API_KEY');
    });

    it('should fail when providers section is missing', () => {
      const config: Partial<IChromeConfig> = {};

      const result = validateApiKeys(config);

      expect(result).not.toBeNull();
      expect(result!.rule).toBe('api-keys');
      expect(result!.field).toBe('providers');
      expect(result!.message).toBe('No providers configured');
      expect(result!.suggestion).toBe('Configure at least one provider with an API key');
    });

    it('should ignore placeholder values', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: '{{RUNTIME_REPLACE}}'
          }
        }
      };

      const result = validateApiKeys(config);

      expect(result).not.toBeNull();
      expect(result!.message).toBe('At least one provider must have a valid API key');
    });

    it('should handle whitespace-only API keys', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: '   \t\n   '
          }
        }
      };

      const result = validateApiKeys(config);

      expect(result).not.toBeNull();
    });

    it('should validate multiple providers correctly', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: ''
          },
          anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            apiKey: 'sk-ant-valid-key'
          },
          custom: {
            id: 'custom',
            name: 'Custom Provider',
            apiKey: '{{RUNTIME_REPLACE}}'
          }
        }
      };

      const result = validateApiKeys(config);

      expect(result).toBeNull(); // anthropic has a valid key
    });
  });

  describe('validateProviderExists', () => {
    it('should pass when selected provider exists', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'openai'
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        }
      };

      const result = validateProviderExists(config);

      expect(result).toBeNull();
    });

    it('should fail when selected provider does not exist', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'nonexistent'
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        }
      };

      const result = validateProviderExists(config);

      expect(result).not.toBeNull();
      expect(result!.rule).toBe('provider-exists');
      expect(result!.field).toBe('model.provider');
      expect(result!.message).toBe("Selected provider 'nonexistent' is not configured");
      expect(result!.suggestion).toBe("Configure the 'nonexistent' provider or select a different one");
    });

    it('should pass when no provider is selected', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4'
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        }
      };

      const result = validateProviderExists(config);

      expect(result).toBeNull();
    });

    it('should pass when no model section exists', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        }
      };

      const result = validateProviderExists(config);

      expect(result).toBeNull();
    });

    it('should pass when no providers section exists', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'openai'
        }
      };

      const result = validateProviderExists(config);

      expect(result).toBeNull(); // Can't validate without providers section
    });
  });

  describe('validateBusinessRules (comprehensive)', () => {
    it('should return no violations for valid configuration', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'openai',
          contextWindow: 128000,
          maxOutputTokens: 4096
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        },
        extension: {
          enabled: true,
          storageQuotaWarning: 80
        }
      };

      const violations = validateBusinessRules(config);

      expect(violations).toHaveLength(0);
    });

    it('should return multiple violations for invalid configuration', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'nonexistent',
          contextWindow: 1000,
          maxOutputTokens: 2000
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: ''
          }
        },
        extension: {
          enabled: true,
          storageQuotaWarning: 150
        }
      };

      const violations = validateBusinessRules(config);

      expect(violations.length).toBeGreaterThan(1);

      // Check that all expected violations are present
      const ruleNames = violations.map(v => v.rule);
      expect(ruleNames).toContain('token-limits');
      expect(ruleNames).toContain('storage-quota');
      expect(ruleNames).toContain('api-keys');
      expect(ruleNames).toContain('provider-exists');
    });

    it('should handle missing sections gracefully', () => {
      const config: Partial<IChromeConfig> = {};

      const violations = validateBusinessRules(config);

      // Should have at least API key violation
      expect(violations.length).toBeGreaterThan(0);
      const apiKeyViolation = violations.find(v => v.rule === 'api-keys');
      expect(apiKeyViolation).toBeDefined();
    });

    it('should provide helpful error messages', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          contextWindow: 1000,
          maxOutputTokens: 2000
        }
      };

      const violations = validateBusinessRules(config);

      violations.forEach(violation => {
        expect(violation.message).toBeTruthy();
        expect(violation.field).toBeTruthy();
        expect(violation.rule).toBeTruthy();
        expect(violation.suggestion).toBeTruthy();
      });
    });

    it('should validate storage quota when present', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        },
        extension: {
          enabled: true,
          storageQuotaWarning: -10
        }
      };

      const violations = validateBusinessRules(config);

      const quotaViolation = violations.find(v => v.rule === 'storage-quota');
      expect(quotaViolation).toBeDefined();
      expect(quotaViolation!.field).toBe('extension.storageQuotaWarning');
    });

    it('should skip storage quota validation when not present', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        },
        extension: {
          enabled: true
        }
      };

      const violations = validateBusinessRules(config);

      const quotaViolation = violations.find(v => v.rule === 'storage-quota');
      expect(quotaViolation).toBeUndefined();
    });
  });

  describe('Business rule violation structure', () => {
    it('should have consistent violation structure', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          contextWindow: 1000,
          maxOutputTokens: 2000
        }
      };

      const violations = validateBusinessRules(config);

      violations.forEach(violation => {
        expect(violation).toHaveProperty('rule');
        expect(violation).toHaveProperty('message');
        expect(violation).toHaveProperty('field');
        expect(violation).toHaveProperty('suggestion');

        expect(typeof violation.rule).toBe('string');
        expect(typeof violation.message).toBe('string');
        expect(typeof violation.field).toBe('string');
        expect(typeof violation.suggestion).toBe('string');

        expect(violation.rule.length).toBeGreaterThan(0);
        expect(violation.message.length).toBeGreaterThan(0);
        expect(violation.field.length).toBeGreaterThan(0);
      });
    });

    it('should have unique rule names', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'nonexistent',
          contextWindow: 1000,
          maxOutputTokens: 2000
        },
        providers: {},
        extension: {
          enabled: true,
          storageQuotaWarning: 150
        }
      };

      const violations = validateBusinessRules(config);
      const ruleNames = violations.map(v => v.rule);
      const uniqueRuleNames = [...new Set(ruleNames)];

      expect(ruleNames.length).toBe(uniqueRuleNames.length);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null values gracefully', () => {
      const config = {
        model: null,
        providers: null,
        extension: null
      };

      expect(() => validateBusinessRules(config as any)).not.toThrow();
    });

    it('should handle empty objects', () => {
      const config = {
        model: {},
        providers: {},
        extension: {}
      };

      const violations = validateBusinessRules(config as any);

      expect(Array.isArray(violations)).toBe(true);
    });

    it('should handle malformed provider objects', () => {
      const config: Partial<IChromeConfig> = {
        providers: {
          malformed: {} as any,
          another: {
            id: 'valid',
            name: 'Valid Provider',
            apiKey: 'sk-test-key'
          }
        }
      };

      const violations = validateBusinessRules(config);

      // Should pass because 'another' provider has a valid key
      const apiKeyViolation = violations.find(v => v.rule === 'api-keys');
      expect(apiKeyViolation).toBeNull();
    });

    it('should handle extreme token values', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'openai',
          contextWindow: Number.MAX_SAFE_INTEGER,
          maxOutputTokens: Number.MAX_SAFE_INTEGER
        },
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'sk-test-key'
          }
        }
      };

      expect(() => validateBusinessRules(config)).not.toThrow();
    });
  });

  describe('Performance considerations', () => {
    it('should validate large configurations efficiently', () => {
      const config: Partial<IChromeConfig> = {
        model: {
          selected: 'gpt-4',
          provider: 'openai',
          contextWindow: 128000,
          maxOutputTokens: 4096
        },
        providers: {}
      };

      // Create many providers
      for (let i = 0; i < 1000; i++) {
        config.providers![`provider-${i}`] = {
          id: `provider-${i}`,
          name: `Provider ${i}`,
          apiKey: i === 500 ? 'sk-test-key' : '' // Only one valid key
        };
      }

      const start = performance.now();
      const violations = validateBusinessRules(config);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete within 100ms
      expect(violations).toHaveLength(0); // Should find the valid key
    });
  });
});