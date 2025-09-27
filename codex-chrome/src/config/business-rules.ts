/**
 * T033: Business rule validations
 */

import type { IChromeConfig, IModelConfig } from './types';

export interface BusinessRuleViolation {
  rule: string;
  message: string;
  field: string;
  suggestion?: string;
}

/**
 * Validates that maxOutputTokens does not exceed contextWindow
 */
export function validateTokenLimits(model: IModelConfig): BusinessRuleViolation | null {
  if (model.maxOutputTokens && model.contextWindow) {
    if (model.maxOutputTokens > model.contextWindow) {
      return {
        rule: 'token-limits',
        message: `maxOutputTokens (${model.maxOutputTokens}) cannot exceed contextWindow (${model.contextWindow})`,
        field: 'model.maxOutputTokens',
        suggestion: `Set maxOutputTokens to ${Math.min(model.maxOutputTokens, model.contextWindow)} or less`,
      };
    }
  }
  return null;
}

/**
 * Validates storage quota warning range
 */
export function validateStorageQuota(quotaWarning?: number): BusinessRuleViolation | null {
  if (quotaWarning !== undefined) {
    if (quotaWarning < 0 || quotaWarning > 100) {
      return {
        rule: 'storage-quota',
        message: `Storage quota warning must be between 0 and 100 (got ${quotaWarning})`,
        field: 'extension.storageQuotaWarning',
        suggestion: 'Use a value between 0 and 100 to represent percentage',
      };
    }
  }
  return null;
}

/**
 * Validates that at least one provider has an API key
 */
export function validateApiKeys(config: Partial<IChromeConfig>): BusinessRuleViolation | null {
  if (config.providers) {
    const hasValidKey = Object.values(config.providers).some(
      provider => provider.apiKey && provider.apiKey.trim() !== '' && provider.apiKey !== '{{RUNTIME_REPLACE}}'
    );

    if (!hasValidKey) {
      return {
        rule: 'api-keys',
        message: 'At least one provider must have a valid API key',
        field: 'providers',
        suggestion: 'Add an API key for at least one provider (e.g., CODEX_PROVIDER_OPENAI_API_KEY)',
      };
    }
  } else {
    return {
      rule: 'api-keys',
      message: 'No providers configured',
      field: 'providers',
      suggestion: 'Configure at least one provider with an API key',
    };
  }
  return null;
}

/**
 * Validates provider exists for selected model
 */
export function validateProviderExists(config: Partial<IChromeConfig>): BusinessRuleViolation | null {
  if (config.model?.provider && config.providers) {
    if (!config.providers[config.model.provider]) {
      return {
        rule: 'provider-exists',
        message: `Selected provider '${config.model.provider}' is not configured`,
        field: 'model.provider',
        suggestion: `Configure the '${config.model.provider}' provider or select a different one`,
      };
    }
  }
  return null;
}

/**
 * Run all business rule validations
 */
export function validateBusinessRules(config: Partial<IChromeConfig>): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];

  // Token limits
  if (config.model) {
    const tokenViolation = validateTokenLimits(config.model);
    if (tokenViolation) violations.push(tokenViolation);
  }

  // Storage quota
  if (config.extension?.storageQuotaWarning !== undefined) {
    const quotaViolation = validateStorageQuota(config.extension.storageQuotaWarning);
    if (quotaViolation) violations.push(quotaViolation);
  }

  // API keys
  const apiKeyViolation = validateApiKeys(config);
  if (apiKeyViolation) violations.push(apiKeyViolation);

  // Provider exists
  const providerViolation = validateProviderExists(config);
  if (providerViolation) violations.push(providerViolation);

  return violations;
}