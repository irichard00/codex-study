/**
 * StorageQuotaManager API Contract (Updated for RolloutRecorder)
 * Feature: 006-use-the-rolloutrecorder
 *
 * Defines how StorageQuotaManager integrates with RolloutRecorder
 */

import type { RolloutRecorder } from '@/storage/rollout';

// ============================================================================
// Storage Quota Manager (Updated)
// ============================================================================

export interface StorageQuotaManager {
  /**
   * Get current storage usage
   * Updated: Should query RolloutRecorder instead of ConversationStore
   */
  getStorageUsage(): Promise<StorageUsage>;

  /**
   * Check if storage quota is exceeded
   */
  isQuotaExceeded(): Promise<boolean>;

  /**
   * Cleanup old conversations to free space
   * Updated: Use RolloutRecorder.cleanupExpired() instead of ConversationStore.cleanup()
   */
  cleanup(): Promise<CleanupResult>;

  /**
   * Get storage statistics
   */
  getStats(): Promise<StorageStats>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageUsage {
  used: number; // Bytes used
  quota: number; // Total quota (bytes)
  percentage: number; // 0-100
  breakdown: {
    rollouts: number; // Bytes used by rollouts store
    rolloutItems: number; // Bytes used by rollout_items store
  };
}

export interface CleanupResult {
  rolloutsDeleted: number;
  itemsDeleted: number;
  bytesFreed: number;
}

export interface StorageStats {
  totalRollouts: number;
  totalItems: number;
  oldestRollout?: {
    id: string;
    timestamp: number;
  };
  newestRollout?: {
    id: string;
    timestamp: number;
  };
  expiredRollouts: number; // Count of expired but not yet cleaned
}

// ============================================================================
// Expected Behavior (Contract Tests)
// ============================================================================

/**
 * Test: Should calculate storage usage from RolloutRecorder
 */
export const CONTRACT_STORAGE_USAGE = {
  given: 'RolloutRecorder has 10 rollouts with 100 items total',
  when: 'getStorageUsage() is called',
  then: 'Returns storage breakdown with rollouts and rolloutItems byte counts',
};

/**
 * Test: Should use RolloutRecorder cleanup
 */
export const CONTRACT_CLEANUP = {
  given: 'RolloutRecorder has 5 expired rollouts (TTL exceeded)',
  when: 'cleanup() is called',
  then: 'RolloutRecorder.cleanupExpired() is called, 5 rollouts deleted',
};

/**
 * Test: Should not reference ConversationStore
 */
export const CONTRACT_NO_CONVERSATION_STORE = {
  given: 'StorageQuotaManager is initialized',
  when: 'Any method is called',
  then: 'No references to ConversationStore exist in implementation',
};

/**
 * Test: Should detect quota exceeded
 */
export const CONTRACT_QUOTA_EXCEEDED = {
  given: 'Storage usage is 95% of quota',
  when: 'isQuotaExceeded() is called',
  then: 'Returns true (threshold: >90%)',
};

/**
 * Test: Should provide accurate stats
 */
export const CONTRACT_STATS = {
  given: 'RolloutRecorder has rollouts with various timestamps',
  when: 'getStats() is called',
  then: 'Returns total counts, oldest/newest rollout info, expired count',
};
