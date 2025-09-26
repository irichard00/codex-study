import {
  RateLimitSnapshot,
  RateLimitWindow,
  createEmptyRateLimitSnapshot,
  createRateLimitWindow,
  createRateLimitSnapshot,
  getMostRestrictiveWindow,
  isApproachingRateLimit,
} from './types/RateLimits.js';

/**
 * Historical rate limit snapshot with timestamp
 */
export interface RateLimitHistory {
  snapshot: RateLimitSnapshot;
  timestamp: number;
}

/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  /** Threshold for determining if approaching rate limits (default: 80%) */
  approachingThreshold: number;
  /** Maximum age of historical snapshots in milliseconds (default: 1 hour) */
  maxHistoryAge: number;
  /** Minimum retry delay in milliseconds (default: 1000) */
  minRetryDelay: number;
  /** Maximum retry delay in milliseconds (default: 60000) */
  maxRetryDelay: number;
  /** Base multiplier for retry delay calculation (default: 1.5) */
  retryDelayMultiplier: number;
}

/**
 * Manages rate limit tracking, parsing headers, and retry logic
 *
 * This class handles:
 * - Parsing x-codex-primary-* and x-codex-secondary-* headers from API responses
 * - Tracking historical snapshots with timestamps
 * - Determining retry delays and whether requests should be retried
 * - Providing current limit information and warnings
 */
export class RateLimitManager {
  private current: RateLimitSnapshot = createEmptyRateLimitSnapshot();
  private history: RateLimitHistory[] = [];
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      approachingThreshold: 80,
      maxHistoryAge: 60 * 60 * 1000, // 1 hour
      minRetryDelay: 1000, // 1 second
      maxRetryDelay: 60 * 1000, // 1 minute
      retryDelayMultiplier: 1.5,
      ...config,
    };
  }

  /**
   * Updates rate limit information from API response headers
   *
   * Expected headers:
   * - x-codex-primary-used-percent: Primary window usage percentage
   * - x-codex-primary-window-minutes: Primary window duration in minutes
   * - x-codex-primary-resets-in-seconds: Primary window reset time in seconds
   * - x-codex-secondary-used-percent: Secondary window usage percentage
   * - x-codex-secondary-window-minutes: Secondary window duration in minutes
   * - x-codex-secondary-resets-in-seconds: Secondary window reset time in seconds
   */
  updateFromHeaders(headers: Record<string, string>): RateLimitSnapshot {
    const timestamp = Date.now();
    let hasData = false;

    // Parse primary window
    let primary: RateLimitWindow | undefined;
    const primaryUsedPercent = parseFloat(headers['x-codex-primary-used-percent']);
    if (!isNaN(primaryUsedPercent)) {
      hasData = true;
      const primaryWindowMinutes = headers['x-codex-primary-window-minutes']
        ? parseInt(headers['x-codex-primary-window-minutes'], 10)
        : undefined;
      const primaryResetsInSeconds = headers['x-codex-primary-resets-in-seconds']
        ? parseInt(headers['x-codex-primary-resets-in-seconds'], 10)
        : undefined;

      primary = createRateLimitWindow(
        primaryUsedPercent,
        isNaN(primaryWindowMinutes!) ? undefined : primaryWindowMinutes,
        isNaN(primaryResetsInSeconds!) ? undefined : primaryResetsInSeconds
      );
    }

    // Parse secondary window
    let secondary: RateLimitWindow | undefined;
    const secondaryUsedPercent = parseFloat(headers['x-codex-secondary-used-percent']);
    if (!isNaN(secondaryUsedPercent)) {
      hasData = true;
      const secondaryWindowMinutes = headers['x-codex-secondary-window-minutes']
        ? parseInt(headers['x-codex-secondary-window-minutes'], 10)
        : undefined;
      const secondaryResetsInSeconds = headers['x-codex-secondary-resets-in-seconds']
        ? parseInt(headers['x-codex-secondary-resets-in-seconds'], 10)
        : undefined;

      secondary = createRateLimitWindow(
        secondaryUsedPercent,
        isNaN(secondaryWindowMinutes!) ? undefined : secondaryWindowMinutes,
        isNaN(secondaryResetsInSeconds!) ? undefined : secondaryResetsInSeconds
      );
    }

    // Only update if we found valid data
    if (hasData) {
      this.current = createRateLimitSnapshot(primary, secondary);

      // Add to history
      this.history.push({
        snapshot: this.current,
        timestamp,
      });

      // Clean old history
      this.cleanHistory();
    }

    return this.current;
  }

  /**
   * Determines if a request should be retried based on current rate limits
   */
  shouldRetry(usageThreshold: number = this.config.approachingThreshold): boolean {
    return !isApproachingRateLimit(this.current, usageThreshold);
  }

  /**
   * Calculates retry delay based on rate limit information and attempt count
   *
   * Uses the most restrictive window's reset time if available, otherwise
   * uses exponential backoff based on attempt count.
   */
  calculateRetryDelay(attemptCount: number = 1): number {
    const mostRestrictive = getMostRestrictiveWindow(this.current);

    // If we have reset time information, use it
    if (mostRestrictive?.resets_in_seconds) {
      // Add some jitter and ensure it's within bounds
      const baseDelay = mostRestrictive.resets_in_seconds * 1000;
      const jitter = Math.random() * 1000; // 0-1s jitter
      const delay = baseDelay + jitter;

      return Math.min(Math.max(delay, this.config.minRetryDelay), this.config.maxRetryDelay);
    }

    // Fall back to exponential backoff
    const exponentialDelay = this.config.minRetryDelay *
      Math.pow(this.config.retryDelayMultiplier, attemptCount - 1);

    return Math.min(exponentialDelay, this.config.maxRetryDelay);
  }

  /**
   * Gets the current rate limit snapshot
   */
  getCurrentLimits(): RateLimitSnapshot {
    return { ...this.current };
  }

  /**
   * Checks if currently approaching rate limits
   */
  isApproachingLimits(threshold: number = this.config.approachingThreshold): boolean {
    return isApproachingRateLimit(this.current, threshold);
  }

  /**
   * Gets the most restrictive current rate limit window
   */
  getMostRestrictive(): RateLimitWindow | null {
    return getMostRestrictiveWindow(this.current);
  }

  /**
   * Gets historical rate limit snapshots within the specified time range
   */
  getHistory(maxAge?: number): RateLimitHistory[] {
    const cutoff = Date.now() - (maxAge || this.config.maxHistoryAge);
    return this.history.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Clears all rate limit data
   */
  reset(): void {
    this.current = createEmptyRateLimitSnapshot();
    this.history = [];
  }

  /**
   * Gets a summary of current rate limit status
   */
  getSummary(): {
    hasLimits: boolean;
    isApproaching: boolean;
    mostRestrictive: RateLimitWindow | null;
    nextResetSeconds: number | null;
  } {
    const mostRestrictive = this.getMostRestrictive();

    return {
      hasLimits: !!(this.current.primary || this.current.secondary),
      isApproaching: this.isApproachingLimits(),
      mostRestrictive,
      nextResetSeconds: mostRestrictive?.resets_in_seconds || null,
    };
  }

  /**
   * Removes historical snapshots older than maxHistoryAge
   */
  private cleanHistory(): void {
    const cutoff = Date.now() - this.config.maxHistoryAge;
    this.history = this.history.filter(entry => entry.timestamp >= cutoff);
  }
}

/**
 * Creates a RateLimitManager with default configuration
 */
export function createRateLimitManager(config?: Partial<RateLimitConfig>): RateLimitManager {
  return new RateLimitManager(config);
}