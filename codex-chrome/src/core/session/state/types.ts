/**
 * Shared types for state management
 * Port of Rust state refactoring (commit 250b244ab)
 */

import type { ReviewDecision } from '../../protocol/types';

/**
 * Kind of task running in an active turn
 * Maps to Rust TaskKind enum
 */
export enum TaskKind {
  /** Regular task execution */
  Regular = 'Regular',
  /** Task awaiting user review/approval */
  Review = 'Review',
  /** Compact mode task */
  Compact = 'Compact',
}

/**
 * A running task in an active turn
 * Maps to Rust RunningTask struct
 */
export interface RunningTask {
  /** Abort controller to cancel the task */
  handle: AbortController;
  /** Kind of task */
  kind: TaskKind;
  /** When the task started (milliseconds since epoch) */
  startTime: number;
  /** Subscription ID for tracking */
  subId: string;
}

/**
 * Callback to resolve a pending approval
 * Maps to Rust ApprovalResolver type
 */
export type ApprovalResolver = (decision: ReviewDecision) => void;

/**
 * Pending approval entry
 */
export interface PendingApproval {
  /** Unique identifier for this approval request */
  executionId: string;
  /** Resolver callback */
  resolver: ApprovalResolver;
}

/**
 * Token usage information
 * Matches existing Session token tracking
 */
export interface TokenUsageInfo {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Rate limit snapshot
 * Matches existing Session rate limit tracking
 */
export interface RateLimitSnapshot {
  limit_requests?: number;
  limit_tokens?: number;
  remaining_requests?: number;
  remaining_tokens?: number;
  reset_requests?: string;
  reset_tokens?: string;
}

/**
 * Session export format
 * Matches existing Session.export() structure
 */
export interface SessionExport {
  id: string;
  state: {
    history: any; // ConversationHistory from protocol
    approvedCommands: string[];
    tokenInfo?: TokenUsageInfo;
    latestRateLimits?: RateLimitSnapshot;
  };
  metadata: {
    created: number;
    lastAccessed: number;
    messageCount: number;
  };
}
