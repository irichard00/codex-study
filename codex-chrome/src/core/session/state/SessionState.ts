/**
 * SessionState - pure data container for session state
 * Port of Rust SessionState struct (commit 250b244ab)
 */

import type { ResponseItem, ConversationHistory } from '../../protocol/types';
import type { TokenUsageInfo, RateLimitSnapshot } from './types';

/**
 * Export format for SessionState
 */
export interface SessionStateExport {
  history: ConversationHistory;
  approvedCommands: string[];
  tokenInfo?: TokenUsageInfo;
  latestRateLimits?: RateLimitSnapshot;
}

/**
 * Pure data container for session state
 * Separates state management from business logic
 */
export class SessionState {
  /** Set of commands approved by user */
  private approvedCommands: Set<string>;

  /** Conversation history */
  private history: ResponseItem[];

  /** Token usage information */
  private tokenInfo?: TokenUsageInfo;

  /** Latest rate limit information */
  private latestRateLimits?: RateLimitSnapshot;

  constructor() {
    this.approvedCommands = new Set();
    this.history = [];
    this.tokenInfo = undefined;
    this.latestRateLimits = undefined;
  }

  // ===== History Management =====

  /**
   * Record items to conversation history
   * @param items Items to append to history
   */
  recordItems(items: ResponseItem[]): void {
    this.history.push(...items);
  }

  /**
   * Get a snapshot of conversation history (deep copy for immutability)
   * @returns Deep copy of history items
   */
  historySnapshot(): ResponseItem[] {
    return JSON.parse(JSON.stringify(this.history));
  }

  /**
   * Get conversation history as ConversationHistory object
   * @returns ConversationHistory with items
   */
  getConversationHistory(): ConversationHistory {
    return {
      items: this.historySnapshot(),
    };
  }

  /**
   * T011: Replace entire conversation history
   * Used for compaction - replaces all history with new items
   * @param items New history items to replace existing history
   */
  replaceHistory(items: ResponseItem[]): void {
    this.history = [...items];
  }

  // ===== Token Tracking =====

  /**
   * Add token usage (simple accumulation)
   * @param tokens Number of tokens to add to total
   */
  addTokenUsage(tokens: number): void {
    if (!this.tokenInfo) {
      this.tokenInfo = {
        total_tokens: tokens,
      };
    } else {
      this.tokenInfo.total_tokens = (this.tokenInfo.total_tokens ?? 0) + tokens;
    }
  }

  /**
   * Update token usage info with detailed information
   * @param info Token usage information to merge
   */
  updateTokenInfo(info: TokenUsageInfo): void {
    if (!this.tokenInfo) {
      this.tokenInfo = { ...info };
    } else {
      this.tokenInfo = {
        ...this.tokenInfo,
        ...info,
      };
    }
  }

  // ===== Rate Limit Tracking =====

  /**
   * Update rate limit information
   * @param limits Rate limit snapshot
   */
  updateRateLimits(limits: RateLimitSnapshot): void {
    this.latestRateLimits = { ...limits };
  }

  // ===== Approved Commands =====

  /**
   * Add an approved command
   * @param command Command to approve
   */
  addApprovedCommand(command: string): void {
    this.approvedCommands.add(command);
  }

  /**
   * Check if a command is approved
   * @param command Command to check
   * @returns True if command is approved
   */
  isCommandApproved(command: string): boolean {
    return this.approvedCommands.has(command);
  }

  // ===== Export/Import =====

  /**
   * Export state for persistence
   * @returns Serializable state object
   */
  export(): SessionStateExport {
    return {
      history: {
        items: this.historySnapshot(),
      },
      approvedCommands: Array.from(this.approvedCommands),
      tokenInfo: this.tokenInfo ? { ...this.tokenInfo } : undefined,
      latestRateLimits: this.latestRateLimits
        ? { ...this.latestRateLimits }
        : undefined,
    };
  }

  /**
   * Import state from exported data
   * @param data Exported state data
   * @returns New SessionState instance
   */
  static import(data: SessionStateExport): SessionState {
    const state = new SessionState();

    // Restore history
    if (data.history?.items) {
      state.history = JSON.parse(JSON.stringify(data.history.items));
    }

    // Restore approved commands
    if (data.approvedCommands) {
      state.approvedCommands = new Set(data.approvedCommands);
    }

    // Restore token info
    if (data.tokenInfo) {
      state.tokenInfo = { ...data.tokenInfo };
    }

    // Restore rate limits
    if (data.latestRateLimits) {
      state.latestRateLimits = { ...data.latestRateLimits };
    }

    return state;
  }

  /**
   * Create a deep copy of this state
   * @returns Independent copy of state
   */
  deepCopy(): SessionState {
    return SessionState.import(this.export());
  }
}
