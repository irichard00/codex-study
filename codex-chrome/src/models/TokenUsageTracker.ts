import {
  TokenUsage,
  TokenUsageInfo,
  createEmptyTokenUsage,
  createEmptyTokenUsageInfo,
  addTokenUsage,
  updateTokenUsageInfo,
  aggregateTokenUsage,
} from './types/TokenUsage.js';

/**
 * Token usage entry with timestamp for historical tracking
 */
export interface TokenUsageEntry {
  usage: TokenUsage;
  timestamp: number;
  turnId?: string;
}

/**
 * Configuration for token usage tracking
 */
export interface TokenUsageConfig {
  /** Context window size for the model */
  contextWindow: number;
  /** Token limit that triggers auto-compaction (default: 80% of context window) */
  autoCompactLimit: number;
  /** Maximum age of historical entries in milliseconds (default: 24 hours) */
  maxHistoryAge: number;
  /** Maximum number of historical entries to keep (default: 1000) */
  maxHistoryEntries: number;
}

/**
 * Time range filter for usage queries
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Aggregated usage statistics for a time period
 */
export interface UsagePeriod {
  range: TimeRange;
  usage: TokenUsage;
  entryCount: number;
}

/**
 * Tracks token usage over time with aggregation and compaction detection
 *
 * This class handles:
 * - Updating usage with new token consumption data
 * - Tracking session totals and per-turn usage
 * - Detecting when context should be compacted based on usage
 * - Providing historical usage queries with time filtering
 * - Managing usage history with automatic cleanup
 */
export class TokenUsageTracker {
  private sessionInfo: TokenUsageInfo;
  private history: TokenUsageEntry[] = [];
  private config: TokenUsageConfig;

  constructor(config: TokenUsageConfig) {
    this.config = config;
    this.sessionInfo = createEmptyTokenUsageInfo(
      config.contextWindow,
      config.autoCompactLimit
    );
  }

  /**
   * Updates usage with new token consumption, aggregating with session totals
   */
  update(newUsage: TokenUsage, turnId?: string): TokenUsageInfo {
    const timestamp = Date.now();

    // Update session info
    this.sessionInfo = updateTokenUsageInfo(this.sessionInfo, newUsage);

    // Add to history
    this.history.push({
      usage: { ...newUsage },
      timestamp,
      turnId,
    });

    // Clean old history
    this.cleanHistory();

    return { ...this.sessionInfo };
  }

  /**
   * Gets current session usage information
   */
  getSessionInfo(): TokenUsageInfo {
    return { ...this.sessionInfo };
  }

  /**
   * Gets usage statistics for the specified time range
   */
  getUsageForRange(range: TimeRange): UsagePeriod {
    const entriesInRange = this.history.filter(
      entry => entry.timestamp >= range.start && entry.timestamp <= range.end
    );

    const usage = entriesInRange.length > 0
      ? aggregateTokenUsage(entriesInRange.map(entry => entry.usage))
      : createEmptyTokenUsage();

    return {
      range,
      usage,
      entryCount: entriesInRange.length,
    };
  }

  /**
   * Gets usage for the current session (all tracked usage)
   */
  getSessionUsage(): UsagePeriod {
    if (this.history.length === 0) {
      const now = Date.now();
      return {
        range: { start: now, end: now },
        usage: createEmptyTokenUsage(),
        entryCount: 0,
      };
    }

    const start = this.history[0].timestamp;
    const end = this.history[this.history.length - 1].timestamp;

    return {
      range: { start, end },
      usage: { ...this.sessionInfo.total_token_usage },
      entryCount: this.history.length,
    };
  }

  /**
   * Gets usage for the last N minutes
   */
  getUsageForLastMinutes(minutes: number): UsagePeriod {
    const end = Date.now();
    const start = end - (minutes * 60 * 1000);
    return this.getUsageForRange({ start, end });
  }

  /**
   * Gets usage for the last N turns
   */
  getUsageForLastTurns(turnCount: number): UsagePeriod {
    const recentEntries = this.history
      .slice(-turnCount)
      .filter(entry => entry.turnId);

    if (recentEntries.length === 0) {
      const now = Date.now();
      return {
        range: { start: now, end: now },
        usage: createEmptyTokenUsage(),
        entryCount: 0,
      };
    }

    const start = recentEntries[0].timestamp;
    const end = recentEntries[recentEntries.length - 1].timestamp;
    const usage = aggregateTokenUsage(recentEntries.map(entry => entry.usage));

    return {
      range: { start, end },
      usage,
      entryCount: recentEntries.length,
    };
  }

  /**
   * Determines if context should be compacted based on current usage
   *
   * Returns true if total token usage exceeds the auto-compact limit
   */
  shouldCompact(): boolean {
    if (!this.sessionInfo.auto_compact_token_limit) {
      return false;
    }

    return this.sessionInfo.total_token_usage.total_tokens >=
      this.sessionInfo.auto_compact_token_limit;
  }

  /**
   * Gets the current token usage as a percentage of context window
   */
  getUsagePercentage(): number {
    if (!this.config.contextWindow || this.config.contextWindow === 0) {
      return 0;
    }

    return (this.sessionInfo.total_token_usage.total_tokens / this.config.contextWindow) * 100;
  }

  /**
   * Gets token usage efficiency metrics
   */
  getEfficiencyMetrics(): {
    totalTokens: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cacheHitRate: number;
    inputOutputRatio: number;
    tokensPerTurn: number;
  } {
    const usage = this.sessionInfo.total_token_usage;
    const turnCount = this.history.filter(entry => entry.turnId).length || 1;

    const totalInput = usage.input_tokens + usage.cached_input_tokens;
    const cacheHitRate = totalInput > 0 ? (usage.cached_input_tokens / totalInput) * 100 : 0;
    const inputOutputRatio = usage.output_tokens > 0 ? usage.input_tokens / usage.output_tokens : 0;

    return {
      totalTokens: usage.total_tokens,
      inputTokens: usage.input_tokens,
      cachedInputTokens: usage.cached_input_tokens,
      outputTokens: usage.output_tokens,
      reasoningTokens: usage.reasoning_output_tokens,
      cacheHitRate,
      inputOutputRatio,
      tokensPerTurn: usage.total_tokens / turnCount,
    };
  }

  /**
   * Gets all historical entries, optionally filtered by time range
   */
  getHistory(timeRange?: TimeRange): TokenUsageEntry[] {
    let entries = [...this.history];

    if (timeRange) {
      entries = entries.filter(
        entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
      );
    }

    return entries;
  }

  /**
   * Resets all usage tracking data
   */
  reset(): void {
    this.sessionInfo = createEmptyTokenUsageInfo(
      this.config.contextWindow,
      this.config.autoCompactLimit
    );
    this.history = [];
  }

  /**
   * Updates the configuration
   */
  updateConfig(config: Partial<TokenUsageConfig>): void {
    this.config = { ...this.config, ...config };

    // Update session info with new limits
    this.sessionInfo.model_context_window = this.config.contextWindow;
    this.sessionInfo.auto_compact_token_limit = this.config.autoCompactLimit;

    // Clean history if limits changed
    this.cleanHistory();
  }

  /**
   * Gets a summary of current usage status
   */
  getSummary(): {
    totalTokens: number;
    lastTurnTokens: number;
    usagePercentage: number;
    shouldCompact: boolean;
    historyEntries: number;
    efficiency: {
      cacheHitRate: number;
      tokensPerTurn: number;
    };
  } {
    const efficiency = this.getEfficiencyMetrics();

    return {
      totalTokens: this.sessionInfo.total_token_usage.total_tokens,
      lastTurnTokens: this.sessionInfo.last_token_usage.total_tokens,
      usagePercentage: this.getUsagePercentage(),
      shouldCompact: this.shouldCompact(),
      historyEntries: this.history.length,
      efficiency: {
        cacheHitRate: efficiency.cacheHitRate,
        tokensPerTurn: efficiency.tokensPerTurn,
      },
    };
  }

  /**
   * Removes old history entries based on age and count limits
   */
  private cleanHistory(): void {
    const cutoff = Date.now() - this.config.maxHistoryAge;

    // Remove entries older than maxHistoryAge
    this.history = this.history.filter(entry => entry.timestamp >= cutoff);

    // Keep only the most recent maxHistoryEntries
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history = this.history.slice(-this.config.maxHistoryEntries);
    }
  }
}

/**
 * Creates a TokenUsageTracker with the specified configuration
 */
export function createTokenUsageTracker(config: TokenUsageConfig): TokenUsageTracker {
  return new TokenUsageTracker(config);
}

/**
 * Creates a default configuration for common models
 */
export function createDefaultTokenUsageConfig(
  modelName: string,
  overrides?: Partial<TokenUsageConfig>
): TokenUsageConfig {
  // Default context windows for common models
  const contextWindows: Record<string, number> = {
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-3.5-turbo': 4096,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
  };

  const contextWindow = contextWindows[modelName] || 4096;
  const autoCompactLimit = Math.floor(contextWindow * 0.8); // 80% of context window

  return {
    contextWindow,
    autoCompactLimit,
    maxHistoryAge: 24 * 60 * 60 * 1000, // 24 hours
    maxHistoryEntries: 1000,
    ...overrides,
  };
}