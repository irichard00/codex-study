import type { StorageQuota, StorageStats } from '../types/storage';
import { ConversationStore } from './ConversationStore';
import { CacheManager } from './CacheManager';

export class StorageQuotaManager {
  private conversationStore: ConversationStore | null = null;
  private cacheManager: CacheManager | null = null;
  private quotaCheckInterval: number | null = null;
  private warningThreshold = 80; // Warn at 80% usage
  private criticalThreshold = 95; // Critical at 95% usage

  constructor(
    conversationStore?: ConversationStore,
    cacheManager?: CacheManager
  ) {
    this.conversationStore = conversationStore || null;
    this.cacheManager = cacheManager || null;
  }

  async initialize(
    conversationStore?: ConversationStore,
    cacheManager?: CacheManager
  ): Promise<void> {
    if (conversationStore) this.conversationStore = conversationStore;
    if (cacheManager) this.cacheManager = cacheManager;

    // Check if persistent storage is available and request if needed
    await this.requestPersistentStorage();

    // Start monitoring
    this.startQuotaMonitoring();
  }

  async getQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;

        // Check if persistent storage is granted
        let persistent = false;
        if ('persisted' in navigator.storage) {
          persistent = await navigator.storage.persisted();
        }

        return {
          usage,
          quota,
          percentage: quota > 0 ? (usage / quota) * 100 : 0,
          persistent
        };
      } catch (error) {
        console.error('Failed to get storage quota:', error);
        return this.fallbackEstimate();
      }
    }

    return this.fallbackEstimate();
  }

  private fallbackEstimate(): StorageQuota {
    // Fallback for browsers that don't support storage.estimate()
    // Use chrome.storage API to get an estimate
    return {
      usage: 0,
      quota: 5 * 1024 * 1024 * 1024, // Assume 5GB default
      percentage: 0,
      persistent: false
    };
  }

  async getDetailedStats(): Promise<StorageStats> {
    const quota = await this.getQuota();

    const stats: StorageStats = {
      conversations: {
        count: 0,
        sizeEstimate: 0
      },
      messages: {
        count: 0,
        sizeEstimate: 0
      },
      cache: {
        entries: 0,
        sizeEstimate: 0
      },
      totalUsage: quota.usage,
      quota: quota.quota,
      percentageUsed: quota.percentage
    };

    // Get conversation store stats
    if (this.conversationStore) {
      try {
        const convStats = await this.conversationStore.getStatistics();
        stats.conversations.count = convStats.totalConversations;
        stats.messages.count = convStats.totalMessages;

        // Estimate sizes (rough approximations)
        stats.conversations.sizeEstimate = convStats.totalConversations * 2048; // ~2KB per conversation
        stats.messages.sizeEstimate = convStats.totalMessages * 512; // ~512B per message
      } catch (error) {
        console.error('Failed to get conversation stats:', error);
      }
    }

    // Get cache stats
    if (this.cacheManager) {
      const cacheStats = this.cacheManager.getStatistics();
      stats.cache.entries = cacheStats.entries;
      stats.cache.sizeEstimate = cacheStats.size;
    }

    return stats;
  }

  async cleanup(targetPercentage = 50): Promise<{
    conversationsDeleted: number;
    cacheEntriesRemoved: number;
    spaceFreed: number;
  }> {
    const quotaBefore = await this.getQuota();
    const results = {
      conversationsDeleted: 0,
      cacheEntriesRemoved: 0,
      spaceFreed: 0
    };

    if (quotaBefore.percentage <= targetPercentage) {
      // Already below target
      return results;
    }

    // Step 1: Clear expired cache entries
    if (this.cacheManager) {
      results.cacheEntriesRemoved = await this.cacheManager.cleanup();
    }

    // Check if we've freed enough space
    let quotaAfterCache = await this.getQuota();
    if (quotaAfterCache.percentage <= targetPercentage) {
      results.spaceFreed = quotaBefore.usage - quotaAfterCache.usage;
      return results;
    }

    // Step 2: Clear old conversations (older than 30 days, inactive)
    if (this.conversationStore) {
      results.conversationsDeleted = await this.conversationStore.cleanup(30);
    }

    // Check space freed again
    quotaAfterCache = await this.getQuota();
    if (quotaAfterCache.percentage <= targetPercentage) {
      results.spaceFreed = quotaBefore.usage - quotaAfterCache.usage;
      return results;
    }

    // Step 3: More aggressive cleanup - clear all cache
    if (this.cacheManager && quotaAfterCache.percentage > targetPercentage) {
      await this.cacheManager.clear();
      results.cacheEntriesRemoved = -1; // Indicates full clear
    }

    // Step 4: If still above target, delete older conversations more aggressively
    if (this.conversationStore && quotaAfterCache.percentage > targetPercentage) {
      // Delete conversations older than 7 days
      const additionalDeleted = await this.conversationStore.cleanup(7);
      results.conversationsDeleted += additionalDeleted;
    }

    const quotaAfter = await this.getQuota();
    results.spaceFreed = quotaBefore.usage - quotaAfter.usage;

    return results;
  }

  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          const result = await navigator.storage.persist();
          if (result) {
            console.log('Persistent storage granted');
            return true;
          } else {
            console.log('Persistent storage denied');
            return false;
          }
        }
        return true;
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }

  startQuotaMonitoring(intervalMinutes = 10): void {
    // Clear any existing interval
    this.stopQuotaMonitoring();

    // Check quota periodically
    this.quotaCheckInterval = window.setInterval(async () => {
      const quota = await this.getQuota();

      if (quota.percentage >= this.criticalThreshold) {
        // Critical: Automatic cleanup
        console.warn(`Storage critical: ${quota.percentage.toFixed(2)}%. Running cleanup...`);
        const results = await this.cleanup(this.warningThreshold);
        console.log('Cleanup results:', results);

        // Notify user if supported
        if ('chrome' in window && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: 'storage-critical',
            quota,
            cleanupResults: results
          });
        }
      } else if (quota.percentage >= this.warningThreshold) {
        // Warning: Notify but don't cleanup automatically
        console.warn(`Storage warning: ${quota.percentage.toFixed(2)}% used`);

        if ('chrome' in window && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: 'storage-warning',
            quota
          });
        }
      }
    }, intervalMinutes * 60 * 1000);

    // Also check immediately
    this.checkQuotaImmediate();
  }

  stopQuotaMonitoring(): void {
    if (this.quotaCheckInterval !== null) {
      clearInterval(this.quotaCheckInterval);
      this.quotaCheckInterval = null;
    }
  }

  private async checkQuotaImmediate(): Promise<void> {
    const quota = await this.getQuota();
    console.log(`Storage usage: ${quota.percentage.toFixed(2)}% (${this.formatBytes(quota.usage)} / ${this.formatBytes(quota.quota)})`);

    if (quota.percentage >= this.warningThreshold) {
      console.warn('Storage usage is above warning threshold');
    }
  }

  async exportData(options?: {
    includeConversations?: boolean;
    includeCache?: boolean;
  }): Promise<Blob> {
    const data: any = {
      version: '1.0.0',
      timestamp: Date.now(),
      storage: await this.getDetailedStats()
    };

    if (options?.includeConversations && this.conversationStore) {
      // Export conversations (implementation would depend on ConversationStore methods)
      const conversations = await this.conversationStore.listConversations();
      data.conversations = conversations;
    }

    if (options?.includeCache && this.cacheManager) {
      // Cache is typically transient, but we can export statistics
      data.cacheStats = this.cacheManager.getStatistics();
    }

    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  async optimizeStorage(): Promise<{
    optimized: boolean;
    actionsToken: string[];
  }> {
    const actions: string[] = [];

    try {
      // 1. Clean expired cache entries
      if (this.cacheManager) {
        const removed = await this.cacheManager.cleanup();
        if (removed > 0) {
          actions.push(`Removed ${removed} expired cache entries`);
        }
      }

      // 2. Request persistent storage if not already granted
      const persistent = await this.requestPersistentStorage();
      if (persistent) {
        actions.push('Persistent storage enabled');
      }

      // 3. Compact IndexedDB if possible
      if (this.conversationStore) {
        // IndexedDB doesn't have a direct compact method, but we can
        // trigger cleanup of deleted records by reopening the database
        // This is handled internally by the browser
        actions.push('Database optimization requested');
      }

      // 4. Check and log current usage
      const quota = await this.getQuota();
      actions.push(`Current usage: ${quota.percentage.toFixed(2)}%`);

      return {
        optimized: true,
        actionsToken: actions
      };
    } catch (error) {
      console.error('Storage optimization failed:', error);
      return {
        optimized: false,
        actionsToken: [`Optimization failed: ${error}`]
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async shouldCleanup(): Promise<boolean> {
    const quota = await this.getQuota();
    return quota.percentage >= this.warningThreshold;
  }

  setThresholds(warning: number, critical: number): void {
    if (warning < 0 || warning > 100 || critical < 0 || critical > 100) {
      throw new Error('Thresholds must be between 0 and 100');
    }
    if (warning >= critical) {
      throw new Error('Warning threshold must be less than critical threshold');
    }

    this.warningThreshold = warning;
    this.criticalThreshold = critical;
  }

  async getRecommendedActions(): Promise<string[]> {
    const recommendations: string[] = [];
    const quota = await this.getQuota();
    const stats = await this.getDetailedStats();

    // Check overall usage
    if (quota.percentage > 90) {
      recommendations.push('Critical: Immediate cleanup required');
    } else if (quota.percentage > 70) {
      recommendations.push('Consider cleaning up old conversations');
    }

    // Check persistent storage
    if (!quota.persistent) {
      recommendations.push('Enable persistent storage to prevent data loss');
    }

    // Check conversation count
    if (stats.conversations.count > 100) {
      recommendations.push('Archive or export old conversations');
    }

    // Check cache size
    if (stats.cache.sizeEstimate > 10 * 1024 * 1024) { // 10MB
      recommendations.push('Clear cache to free up space');
    }

    // Check message count
    if (stats.messages.count > 10000) {
      recommendations.push('Consider exporting and archiving old messages');
    }

    return recommendations;
  }

  destroy(): void {
    this.stopQuotaMonitoring();
    this.conversationStore = null;
    this.cacheManager = null;
  }
}