/**
 * Cleanup API Contract (Service Worker Integration)
 * Feature: 006-use-the-rolloutrecorder
 *
 * Defines how service worker schedules RolloutRecorder cleanup
 */

// ============================================================================
// Cleanup Scheduler
// ============================================================================

export interface CleanupScheduler {
  /**
   * Schedule periodic cleanup using Chrome Alarms API
   * Replaces: ConversationStore cleanup scheduling
   */
  scheduleCleanup(intervalMinutes?: number): Promise<void>;

  /**
   * Manually trigger cleanup
   */
  runCleanup(): Promise<CleanupResult>;

  /**
   * Cancel scheduled cleanup
   */
  cancelCleanup(): Promise<void>;

  /**
   * Get next scheduled cleanup time
   */
  getNextCleanupTime(): Promise<number | null>;
}

export interface CleanupResult {
  success: boolean;
  rolloutsDeleted: number;
  itemsDeleted: number;
  bytesFreed: number;
  errors?: string[];
}

// ============================================================================
// Service Worker Integration
// ============================================================================

/**
 * Service worker alarm handler
 */
export interface AlarmHandler {
  /**
   * Handle 'rollout-cleanup' alarm
   */
  onAlarm(alarm: chrome.alarms.Alarm): Promise<void>;
}

/**
 * Background cleanup configuration
 */
export interface CleanupConfig {
  alarmName: 'rollout-cleanup';
  intervalMinutes: number; // Default: 60 (1 hour)
  batchSize: number; // Max rollouts to delete per run (default: 100)
}

// ============================================================================
// Expected Behavior (Contract Tests)
// ============================================================================

/**
 * Test: Should schedule cleanup alarm on service worker start
 */
export const CONTRACT_SCHEDULE_ON_START = {
  given: 'Service worker starts',
  when: 'chrome.runtime.onStartup fires',
  then: 'chrome.alarms.create("rollout-cleanup", { periodInMinutes: 60 }) is called',
};

/**
 * Test: Should run cleanup on alarm
 */
export const CONTRACT_RUN_ON_ALARM = {
  given: 'Alarm "rollout-cleanup" fires',
  when: 'chrome.alarms.onAlarm listener receives alarm',
  then: 'RolloutRecorder.cleanupExpired() is called',
};

/**
 * Test: Should delete expired rollouts
 */
export const CONTRACT_DELETE_EXPIRED = {
  given: 'RolloutRecorder has 10 rollouts, 3 expired (TTL exceeded)',
  when: 'runCleanup() is called',
  then: '3 rollouts are deleted, result.rolloutsDeleted === 3',
};

/**
 * Test: Should handle cleanup errors gracefully
 */
export const CONTRACT_HANDLE_ERRORS = {
  given: 'RolloutRecorder.cleanupExpired() throws error',
  when: 'runCleanup() is called',
  then: 'Error is logged, result.success === false, service worker continues',
};

/**
 * Test: Should cleanup cascade to items
 */
export const CONTRACT_CASCADE_DELETE = {
  given: 'Rollout "abc-123" has 50 items, rollout is expired',
  when: 'runCleanup() is called',
  then: 'Rollout "abc-123" AND all 50 items are deleted (cascade)',
};

/**
 * Test: Should batch large cleanups
 */
export const CONTRACT_BATCH_CLEANUP = {
  given: '500 expired rollouts exist, batchSize is 100',
  when: 'runCleanup() is called',
  then: 'Only 100 rollouts are deleted per run (prevent blocking)',
};

/**
 * Test: Should report bytes freed
 */
export const CONTRACT_REPORT_BYTES = {
  given: 'Cleanup deletes 5 rollouts totaling 2MB',
  when: 'runCleanup() is called',
  then: 'result.bytesFreed === 2097152 (2MB in bytes)',
};
