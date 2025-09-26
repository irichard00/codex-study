/**
 * Comprehensive tests for error handling and recovery
 * Tests extended error classes, retry logic, and error metadata preservation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ModelClientError,
  RateLimitError,
  UsageLimitReachedError,
  NetworkError,
  AuthenticationError,
  QuotaExceededError,
  ModelError,
  ContentPolicyError,
  ErrorFactory,
  ErrorTypeGuards,
  type PlanType,
  type RateLimitMetadata,
  type UsageLimitMetadata,
  type NetworkMetadata,
} from '../ModelClientError';
import { ModelClient } from '../ModelClient';

// Mock implementation for testing
class TestModelClient extends ModelClient {
  private mockComplete: () => Promise<any>;
  private mockStream: () => AsyncGenerator<any>;

  constructor(mockComplete?: () => Promise<any>, mockStream?: () => AsyncGenerator<any>) {
    super();
    this.mockComplete = mockComplete || (() => Promise.resolve({}));
    this.mockStream = mockStream || (async function* () { yield {}; });
  }

  async complete(request: any): Promise<any> {
    this.validateRequest(request);
    return this.withRetry(() => this.mockComplete());
  }

  async *stream(request: any): AsyncGenerator<any> {
    this.validateRequest(request);
    yield* this.mockStream();
  }

  countTokens(text: string, model: string): number {
    return text.length / 4; // Rough approximation
  }

  getProvider(): string {
    return 'test';
  }

  async *streamCompletion(request: any): AsyncGenerator<any> {
    yield* this.stream(request);
  }

  getModel(): string {
    return 'test-model';
  }

  setModel(model: string): void {
    // No-op for testing
  }

  getContextWindow(): number | undefined {
    return 4000;
  }

  getReasoningEffort(): any {
    return null;
  }

  setReasoningEffort(effort: any): void {
    // No-op for testing
  }

  getReasoningSummary(): any {
    return null;
  }

  setReasoningSummary(summary: any): void {
    // No-op for testing
  }

  // Expose protected methods for testing
  public testIsRetryableError(error: any): boolean {
    return this.isRetryableError(error);
  }

  public testWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.withRetry(fn);
  }

  public testCalculateBackoff(attempt: number, retryAfter?: number): number {
    return this.calculateBackoff(attempt, retryAfter);
  }
}

describe('Extended Error Classes', () => {
  describe('RateLimitError', () => {
    const rateLimitMetadata: RateLimitMetadata = {
      limit: 100,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 3600,
      window: 3600,
      retryAfter: 5000,
    };

    it('should create rate limit error with metadata', () => {
      const error = new RateLimitError(
        'Rate limit exceeded',
        rateLimitMetadata,
        429,
        'openai'
      );

      expect(error).toBeInstanceOf(ModelClientError);
      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.provider).toBe('openai');
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.rateLimitMetadata).toEqual(rateLimitMetadata);
    });

    it('should provide human-readable rate limit description', () => {
      const error = new RateLimitError('Test', rateLimitMetadata);
      const description = error.getRateLimitDescription();

      expect(description).toContain('Rate limit of 100 requests per 3600s exceeded');
      expect(description).toContain('0 requests remaining');
      expect(description).toContain('Resets at');
    });
  });

  describe('UsageLimitReachedError', () => {
    const usageLimitMetadata: UsageLimitMetadata = {
      planType: 'free',
      currentUsage: 100,
      planLimit: 100,
      suggestedPlan: 'pro',
    };

    it('should create usage limit error with metadata', () => {
      const error = new UsageLimitReachedError(
        'Usage limit reached',
        usageLimitMetadata,
        402,
        'anthropic'
      );

      expect(error).toBeInstanceOf(ModelClientError);
      expect(error.name).toBe('UsageLimitReachedError');
      expect(error.statusCode).toBe(402);
      expect(error.provider).toBe('anthropic');
      expect(error.retryable).toBe(false);
      expect(error.usageLimitMetadata).toEqual(usageLimitMetadata);
    });

    it('should provide usage limit description', () => {
      const error = new UsageLimitReachedError('Test', usageLimitMetadata);
      const description = error.getUsageLimitDescription();

      expect(description).toContain('Usage limit reached for free plan: 100/100');
    });

    it('should handle unlimited plans', () => {
      const unlimitedMetadata: UsageLimitMetadata = {
        planType: 'enterprise',
        currentUsage: 1000,
        planLimit: -1,
      };
      const error = new UsageLimitReachedError('Test', unlimitedMetadata);
      const description = error.getUsageLimitDescription();

      expect(description).toContain('Unlimited usage for enterprise plan, current usage: 1000');
    });

    it('should indicate upgrade suggestions', () => {
      const error = new UsageLimitReachedError('Test', usageLimitMetadata);
      expect(error.hasUpgradeSuggestion()).toBe(true);

      const noSuggestionMetadata = { ...usageLimitMetadata, suggestedPlan: undefined };
      const errorNoSuggestion = new UsageLimitReachedError('Test', noSuggestionMetadata);
      expect(errorNoSuggestion.hasUpgradeSuggestion()).toBe(false);
    });
  });

  describe('NetworkError', () => {
    const networkMetadata: NetworkMetadata = {
      attempts: 2,
      code: 'ECONNRESET',
      aborted: false,
      timeout: 30000,
    };

    it('should create network error with metadata', () => {
      const error = new NetworkError('Connection reset', networkMetadata, undefined, 'openai');

      expect(error).toBeInstanceOf(ModelClientError);
      expect(error.name).toBe('NetworkError');
      expect(error.retryable).toBe(true);
      expect(error.networkMetadata).toEqual(networkMetadata);
    });

    it('should not be retryable if aborted', () => {
      const abortedMetadata = { ...networkMetadata, aborted: true };
      const error = new NetworkError('Aborted', abortedMetadata);
      expect(error.retryable).toBe(false);
    });

    it('should detect timeout errors', () => {
      const timeoutMetadata = { ...networkMetadata, code: 'ETIMEDOUT' };
      const error = new NetworkError('Timeout', timeoutMetadata);
      expect(error.isTimeout()).toBe(true);

      const regularError = new NetworkError('Regular error', networkMetadata);
      expect(regularError.isTimeout()).toBe(true); // Has timeout property
    });

    it('should detect connection errors', () => {
      const error = new NetworkError('Connection reset', networkMetadata);
      expect(error.isConnectionError()).toBe(true);

      const dnsError = new NetworkError('DNS failed', {
        ...networkMetadata,
        code: 'ENOTFOUND'
      });
      expect(dnsError.isConnectionError()).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid API key', 401, 'openai');

      expect(error).toBeInstanceOf(ModelClientError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Other Error Types', () => {
    it('should create quota exceeded error', () => {
      const error = new QuotaExceededError('Quota exceeded', 'free', 402, 'openai');
      expect(error.name).toBe('QuotaExceededError');
      expect(error.planType).toBe('free');
      expect(error.retryable).toBe(false);
    });

    it('should create model error', () => {
      const error = new ModelError('Model unavailable', 'gpt-4', 503, 'openai', true);
      expect(error.name).toBe('ModelError');
      expect(error.modelName).toBe('gpt-4');
      expect(error.retryable).toBe(true);
    });

    it('should create content policy error', () => {
      const error = new ContentPolicyError('Content blocked', 'harmful', 400, 'openai');
      expect(error.name).toBe('ContentPolicyError');
      expect(error.contentType).toBe('harmful');
      expect(error.retryable).toBe(false);
    });
  });
});

describe('Error Factory', () => {
  describe('createRateLimitError', () => {
    it('should create rate limit error from headers', () => {
      const headers = {
        'x-ratelimit-limit': '100',
        'x-ratelimit-remaining': '5',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        'x-ratelimit-window': '3600',
        'retry-after': '60',
      };

      const error = ErrorFactory.createRateLimitError(headers, 'openai');

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.rateLimitMetadata.limit).toBe(100);
      expect(error.rateLimitMetadata.remaining).toBe(5);
      expect(error.rateLimitMetadata.retryAfter).toBe(60000);
      expect(error.provider).toBe('openai');
    });

    it('should handle missing headers gracefully', () => {
      const error = ErrorFactory.createRateLimitError({});
      expect(error.rateLimitMetadata.limit).toBe(0);
      expect(error.rateLimitMetadata.remaining).toBe(0);
    });
  });

  describe('createUsageLimitError', () => {
    it('should create usage limit error for different plan types', () => {
      const planTypes: PlanType[] = ['free', 'pro', 'team', 'enterprise'];

      planTypes.forEach(planType => {
        const error = ErrorFactory.createUsageLimitError(planType, 100, 100);
        expect(error).toBeInstanceOf(UsageLimitReachedError);
        expect(error.usageLimitMetadata.planType).toBe(planType);
      });
    });

    it('should suggest appropriate upgrades', () => {
      const freeError = ErrorFactory.createUsageLimitError('free', 100, 100);
      expect(freeError.usageLimitMetadata.suggestedPlan).toBe('pro');

      const proError = ErrorFactory.createUsageLimitError('pro', 1000, 1000);
      expect(proError.usageLimitMetadata.suggestedPlan).toBe('team');

      const teamError = ErrorFactory.createUsageLimitError('team', 5000, 5000);
      expect(teamError.usageLimitMetadata.suggestedPlan).toBeUndefined();
    });

    it('should handle unlimited plans', () => {
      const error = ErrorFactory.createUsageLimitError('enterprise', 1000, -1);
      expect(error.message).toContain('Unexpected usage limit reached');
    });
  });

  describe('createNetworkError', () => {
    it('should create network errors from different exception types', () => {
      const testCases = [
        { error: { code: 'ETIMEDOUT' }, expectedMessage: 'Request timed out' },
        { error: { code: 'ENOTFOUND' }, expectedMessage: 'DNS lookup failed' },
        { error: { code: 'ECONNRESET' }, expectedMessage: 'Connection was reset' },
        { error: { code: 'ECONNREFUSED' }, expectedMessage: 'Connection was refused' },
        { error: { name: 'AbortError' }, expectedMessage: 'Request was aborted' },
        { error: { message: 'Unknown error' }, expectedMessage: 'Network error occurred' },
      ];

      testCases.forEach(({ error, expectedMessage }) => {
        const networkError = ErrorFactory.createNetworkError(error, 2, 'openai');
        expect(networkError).toBeInstanceOf(NetworkError);
        expect(networkError.message).toBe(expectedMessage);
        expect(networkError.networkMetadata.attempts).toBe(2);
        expect(networkError.provider).toBe('openai');
      });
    });
  });

  describe('createAuthError', () => {
    it('should create different types of authentication errors', () => {
      const authReasons = [
        'invalid_key',
        'expired_key',
        'insufficient_permissions',
        'unknown'
      ] as const;

      authReasons.forEach(reason => {
        const error = ErrorFactory.createAuthError(reason, 'anthropic');
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBeTruthy();
        expect(error.provider).toBe('anthropic');
      });
    });
  });

  describe('createModelError', () => {
    it('should create model errors with appropriate retryability', () => {
      const modelReasons = [
        { reason: 'not_found', retryable: false, statusCode: 404 },
        { reason: 'unavailable', retryable: true, statusCode: 503 },
        { reason: 'deprecated', retryable: false, statusCode: 400 },
        { reason: 'unsupported_feature', retryable: false, statusCode: 400 },
        { reason: 'unknown', retryable: false, statusCode: 400 },
      ] as const;

      modelReasons.forEach(({ reason, retryable, statusCode }) => {
        const error = ErrorFactory.createModelError('gpt-4', reason, 'openai');
        expect(error).toBeInstanceOf(ModelError);
        expect(error.retryable).toBe(retryable);
        expect(error.statusCode).toBe(statusCode);
        expect(error.modelName).toBe('gpt-4');
      });
    });
  });
});

describe('Error Type Guards', () => {
  const rateLimitError = new RateLimitError('Test', {
    limit: 100, remaining: 0, reset: 0, window: 3600
  });
  const usageLimitError = new UsageLimitReachedError('Test', {
    planType: 'free', currentUsage: 100, planLimit: 100
  });
  const networkError = new NetworkError('Test', { attempts: 1, aborted: false });
  const authError = new AuthenticationError('Test');
  const quotaError = new QuotaExceededError('Test', 'free');
  const modelError = new ModelError('Test', 'gpt-4');
  const contentError = new ContentPolicyError('Test', 'harmful');
  const baseError = new ModelClientError('Test');
  const regularError = new Error('Regular error');

  it('should correctly identify error types', () => {
    expect(ErrorTypeGuards.isRateLimitError(rateLimitError)).toBe(true);
    expect(ErrorTypeGuards.isRateLimitError(usageLimitError)).toBe(false);

    expect(ErrorTypeGuards.isUsageLimitError(usageLimitError)).toBe(true);
    expect(ErrorTypeGuards.isUsageLimitError(rateLimitError)).toBe(false);

    expect(ErrorTypeGuards.isNetworkError(networkError)).toBe(true);
    expect(ErrorTypeGuards.isNetworkError(authError)).toBe(false);

    expect(ErrorTypeGuards.isAuthenticationError(authError)).toBe(true);
    expect(ErrorTypeGuards.isAuthenticationError(quotaError)).toBe(false);

    expect(ErrorTypeGuards.isQuotaError(quotaError)).toBe(true);
    expect(ErrorTypeGuards.isQuotaError(modelError)).toBe(false);

    expect(ErrorTypeGuards.isModelError(modelError)).toBe(true);
    expect(ErrorTypeGuards.isModelError(contentError)).toBe(false);

    expect(ErrorTypeGuards.isContentPolicyError(contentError)).toBe(true);
    expect(ErrorTypeGuards.isContentPolicyError(baseError)).toBe(false);

    expect(ErrorTypeGuards.isModelClientError(baseError)).toBe(true);
    expect(ErrorTypeGuards.isModelClientError(rateLimitError)).toBe(true);
    expect(ErrorTypeGuards.isModelClientError(regularError)).toBe(false);
  });
});

describe('Error Recovery and Retry Logic', () => {
  let client: TestModelClient;
  let mockComplete: vi.Mock;

  beforeEach(() => {
    mockComplete = vi.fn();
    client = new TestModelClient(mockComplete);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors', async () => {
      const retryableError = new RateLimitError('Rate limited', {
        limit: 100, remaining: 0, reset: 0, window: 3600, retryAfter: 1000
      });

      mockComplete
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ id: 'success' });

      const request = { model: 'test', messages: [{ role: 'user' as const, content: 'test' }] };

      // Start the completion
      const completionPromise = client.complete(request);

      // Fast-forward through the retry delay
      await vi.advanceTimersToNextTimerAsync();

      const result = await completionPromise;
      expect(result).toEqual({ id: 'success' });
      expect(mockComplete).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new AuthenticationError('Invalid key');
      mockComplete.mockRejectedValue(nonRetryableError);

      const request = { model: 'test', messages: [{ role: 'user' as const, content: 'test' }] };

      await expect(client.complete(request)).rejects.toThrow(AuthenticationError);
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });

    it('should respect maximum retry attempts', async () => {
      const retryableError = new NetworkError('Connection failed', {
        attempts: 0, aborted: false
      });

      mockComplete.mockRejectedValue(retryableError);

      const request = { model: 'test', messages: [{ role: 'user' as const, content: 'test' }] };

      const completionPromise = client.complete(request);

      // Fast-forward through all retries
      for (let i = 0; i <= 3; i++) { // maxRetries is 3 by default
        await vi.advanceTimersToNextTimerAsync();
      }

      await expect(completionPromise).rejects.toThrow(NetworkError);
      expect(mockComplete).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should use retry-after delays from rate limit errors', async () => {
      const rateLimitError = new RateLimitError('Rate limited', {
        limit: 100, remaining: 0, reset: 0, window: 3600, retryAfter: 5000
      });

      mockComplete
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ id: 'success' });

      const request = { model: 'test', messages: [{ role: 'user' as const, content: 'test' }] };

      const completionPromise = client.complete(request);

      // The retry should wait approximately 5000ms (with jitter)
      await vi.advanceTimersByTimeAsync(4000); // Not enough time
      expect(mockComplete).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000); // Should be enough with jitter
      await completionPromise;

      expect(mockComplete).toHaveBeenCalledTimes(2);
    });
  });

  describe('Backoff Calculation', () => {
    it('should calculate exponential backoff', () => {
      const delays = [0, 1, 2, 3].map(attempt =>
        client.testCalculateBackoff(attempt)
      );

      // Each delay should be larger than the previous (with jitter considered)
      expect(delays[1]).toBeGreaterThan(900); // ~1000ms base delay
      expect(delays[2]).toBeGreaterThan(1800); // ~2000ms
      expect(delays[3]).toBeGreaterThan(3600); // ~4000ms
    });

    it('should respect retry-after headers', () => {
      const retryAfter = 10000;
      const delay = client.testCalculateBackoff(0, retryAfter);

      // Should be close to retryAfter value (with jitter)
      expect(delay).toBeGreaterThan(retryAfter);
      expect(delay).toBeLessThan(retryAfter * 1.2); // Max 20% jitter
    });

    it('should cap maximum delay', () => {
      // Very high attempt number should be capped
      const delay = client.testCalculateBackoff(10);
      expect(delay).toBeLessThan(35000); // maxDelay is 30000 + jitter
    });
  });

  describe('Error Detection', () => {
    it('should correctly identify retryable errors', () => {
      const retryableErrors = [
        new RateLimitError('Rate limited', { limit: 100, remaining: 0, reset: 0, window: 3600 }),
        new NetworkError('Network failed', { attempts: 1, aborted: false }),
        new ModelError('Model unavailable', 'gpt-4', 503, 'openai', true),
        { status: 500 }, // HTTP 500 error
        { statusCode: 502 }, // HTTP 502 error
        { code: 'ECONNRESET' }, // Network error
      ];

      retryableErrors.forEach(error => {
        expect(client.testIsRetryableError(error)).toBe(true);
      });
    });

    it('should correctly identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new AuthenticationError('Invalid key'),
        new UsageLimitReachedError('Usage exceeded', {
          planType: 'free', currentUsage: 100, planLimit: 100
        }),
        new ContentPolicyError('Content blocked', 'harmful'),
        { status: 400 }, // HTTP 400 error
        { name: 'AbortError' }, // Aborted request
      ];

      nonRetryableErrors.forEach(error => {
        expect(client.testIsRetryableError(error)).toBe(false);
      });
    });
  });

  describe('Usage Limit Scenarios', () => {
    const usageLimitTestCases: Array<{
      planType: PlanType;
      currentUsage: number;
      planLimit: number;
      shouldHaveSuggestion: boolean;
    }> = [
      { planType: 'free', currentUsage: 100, planLimit: 100, shouldHaveSuggestion: true },
      { planType: 'pro', currentUsage: 1000, planLimit: 1000, shouldHaveSuggestion: true },
      { planType: 'team', currentUsage: 5000, planLimit: 5000, shouldHaveSuggestion: false },
      { planType: 'enterprise', currentUsage: 1000, planLimit: -1, shouldHaveSuggestion: false },
    ];

    it.each(usageLimitTestCases)(
      'should handle $planType plan limits correctly',
      ({ planType, currentUsage, planLimit, shouldHaveSuggestion }) => {
        const error = ErrorFactory.createUsageLimitError(planType, currentUsage, planLimit);

        expect(error.usageLimitMetadata.planType).toBe(planType);
        expect(error.usageLimitMetadata.currentUsage).toBe(currentUsage);
        expect(error.usageLimitMetadata.planLimit).toBe(planLimit);
        expect(error.hasUpgradeSuggestion()).toBe(shouldHaveSuggestion);
      }
    );
  });

  describe('Network Error Scenarios', () => {
    const networkTestCases = [
      { code: 'ETIMEDOUT', expectedMessage: 'Request timed out', shouldRetry: true },
      { code: 'ENOTFOUND', expectedMessage: 'DNS lookup failed', shouldRetry: true },
      { code: 'ECONNRESET', expectedMessage: 'Connection was reset', shouldRetry: true },
      { code: 'ECONNREFUSED', expectedMessage: 'Connection was refused', shouldRetry: true },
      { name: 'AbortError', expectedMessage: 'Request was aborted', shouldRetry: false },
    ];

    it.each(networkTestCases)(
      'should handle $code network errors correctly',
      ({ code, name, expectedMessage, shouldRetry }) => {
        const mockError = code ? { code } : { name };
        const networkError = ErrorFactory.createNetworkError(mockError, 1, 'test');

        expect(networkError.message).toBe(expectedMessage);
        expect(networkError.retryable).toBe(shouldRetry);
        expect(networkError.networkMetadata.attempts).toBe(1);
      }
    );
  });

  describe('Error Metadata Preservation', () => {
    it('should preserve rate limit metadata through retries', async () => {
      const originalMetadata: RateLimitMetadata = {
        limit: 100,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 3600,
        window: 3600,
        retryAfter: 1000
      };

      const rateLimitError = new RateLimitError('Rate limited', originalMetadata);
      mockComplete.mockRejectedValue(rateLimitError);

      const request = { model: 'test', messages: [{ role: 'user' as const, content: 'test' }] };

      try {
        await client.testWithRetry(() => mockComplete());
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.rateLimitMetadata).toEqual(originalMetadata);
        }
      }
    });

    it('should preserve usage limit metadata in error chains', () => {
      const originalMetadata: UsageLimitMetadata = {
        planType: 'pro',
        currentUsage: 1000,
        planLimit: 1000,
        resetTime: Date.now() + 86400000,
        suggestedPlan: 'team',
      };

      const usageError = new UsageLimitReachedError('Usage exceeded', originalMetadata);

      expect(usageError.usageLimitMetadata).toEqual(originalMetadata);
      expect(usageError.usageLimitMetadata.resetTime).toBe(originalMetadata.resetTime);
    });
  });
});

describe('Integration with ModelClient Base Class', () => {
  let client: TestModelClient;

  beforeEach(() => {
    client = new TestModelClient();
  });

  it('should validate requests and throw appropriate errors', () => {
    expect(() => client.complete({ model: '', messages: [] })).toThrow(ModelClientError);
    expect(() => client.complete({ model: 'test', messages: [] })).toThrow(ModelClientError);
    expect(() => client.complete({
      model: 'test',
      messages: [{ role: 'invalid' as any, content: 'test' }]
    })).toThrow(ModelClientError);
  });

  it('should handle tool message validation', () => {
    expect(() => client.complete({
      model: 'test',
      messages: [{ role: 'tool', content: 'result' }] // Missing toolCallId
    })).toThrow(ModelClientError);

    // Should not throw with valid tool message
    expect(() => client.complete({
      model: 'test',
      messages: [{ role: 'tool', content: 'result', toolCallId: 'call_123' }]
    })).not.toThrow();
  });

  it('should validate temperature and maxTokens', () => {
    expect(() => client.complete({
      model: 'test',
      messages: [{ role: 'user', content: 'test' }],
      temperature: -1
    })).toThrow(ModelClientError);

    expect(() => client.complete({
      model: 'test',
      messages: [{ role: 'user', content: 'test' }],
      maxTokens: 0
    })).toThrow(ModelClientError);
  });
});