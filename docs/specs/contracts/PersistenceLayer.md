# Persistence Layer API Contracts

## Overview
Browser-native storage system using IndexedDB for conversations and chrome.storage for settings, providing offline support and efficient data management.

## ConversationStore

### Interface
```typescript
class ConversationStore {
  constructor(dbName?: string, version?: number);

  // Database lifecycle
  async initialize(): Promise<void>;
  async close(): Promise<void>;
  async clear(): Promise<void>;
  async upgrade(oldVersion: number, newVersion: number): Promise<void>;

  // Conversation CRUD
  async createConversation(conversation: ConversationData): Promise<string>;
  async getConversation(id: string): Promise<ConversationData | null>;
  async updateConversation(id: string, updates: Partial<ConversationData>): Promise<void>;
  async deleteConversation(id: string): Promise<void>;

  // Message operations
  async addMessage(conversationId: string, message: MessageRecord): Promise<string>;
  async getMessages(conversationId: string, limit?: number, offset?: number): Promise<MessageRecord[]>;
  async updateMessage(id: string, updates: Partial<MessageRecord>): Promise<void>;

  // Query operations
  async listConversations(filter?: ConversationFilter): Promise<ConversationSummary[]>;
  async searchMessages(query: string): Promise<SearchResult[]>;
  async getConversationsByDate(start: Date, end: Date): Promise<ConversationData[]>;

  // Bulk operations
  async exportConversations(ids?: string[]): Promise<ExportData>;
  async importConversations(data: ExportData): Promise<ImportResult>;

  // Statistics
  async getStats(): Promise<StoreStats>;
}
```

### Core Methods

#### `initialize(): Promise<void>`
Opens IndexedDB connection and creates object stores.

```typescript
async initialize() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(this.dbName, this.version);

    request.onsuccess = () => {
      this.db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create conversations store
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('updated', 'updated', { unique: false });
        convStore.createIndex('status', 'status', { unique: false });
      }

      // Create messages store
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        msgStore.createIndex('turnIndex', ['conversationId', 'turnIndex']);
      }

      // Create tool calls store
      if (!db.objectStoreNames.contains('toolCalls')) {
        const toolStore = db.createObjectStore('toolCalls', { keyPath: 'id' });
        toolStore.createIndex('messageId', 'messageId', { unique: false });
        toolStore.createIndex('toolName', 'toolName', { unique: false });
      }
    };

    request.onerror = () => reject(request.error);
  });
}
```

#### `createConversation(conversation: ConversationData): Promise<string>`
Creates new conversation with auto-generated ID.

```typescript
async createConversation(conversation: ConversationData): Promise<string> {
  const id = conversation.id || crypto.randomUUID();
  const now = Date.now();

  const record: ConversationRecord = {
    ...conversation,
    id,
    created: now,
    updated: now,
    status: 'active',
    turnCount: 0,
    tokenCount: 0,
    messageIds: []
  };

  const transaction = this.db.transaction(['conversations'], 'readwrite');
  const store = transaction.objectStore('conversations');

  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}
```

#### `searchMessages(query: string): Promise<SearchResult[]>`
Full-text search across messages.

```typescript
async searchMessages(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  const transaction = this.db.transaction(['messages', 'conversations'], 'readonly');
  const messageStore = transaction.objectStore('messages');
  const convStore = transaction.objectStore('conversations');

  return new Promise((resolve, reject) => {
    const cursor = messageStore.openCursor();

    cursor.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor) {
        const message = cursor.value;
        const content = typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content);

        if (content.toLowerCase().includes(queryLower)) {
          results.push({
            messageId: message.id,
            conversationId: message.conversationId,
            snippet: this.extractSnippet(content, query),
            timestamp: message.timestamp,
            score: this.calculateRelevance(content, query)
          });
        }

        cursor.continue();
      } else {
        // Sort by relevance score
        results.sort((a, b) => b.score - a.score);
        resolve(results);
      }
    };

    cursor.onerror = () => reject(cursor.error);
  });
}
```

### Data Models

```typescript
interface ConversationRecord {
  id: string;
  title: string;
  created: number;
  updated: number;
  status: 'active' | 'archived' | 'deleted';
  turnCount: number;
  tokenCount: number;
  turnContext: TurnContext;
  metadata: Record<string, any>;
  messageIds: string[];
  toolCallIds: string[];
  tags?: string[];
}

interface MessageRecord {
  id: string;
  conversationId: string;
  turnIndex: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];
  timestamp: number;
  tokenCount: number;
  model?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  metadata?: Record<string, any>;
}

interface ToolCallRecord {
  id: string;
  messageId: string;
  toolName: string;
  parameters: any;
  result?: any;
  status: 'pending' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  error?: string;
}
```

### IndexedDB Schema

```typescript
const DB_SCHEMA = {
  name: 'CodexConversations',
  version: 1,
  stores: {
    conversations: {
      keyPath: 'id',
      indexes: [
        { name: 'updated', keyPath: 'updated', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'title', keyPath: 'title', unique: false }
      ]
    },
    messages: {
      keyPath: 'id',
      indexes: [
        { name: 'conversationId', keyPath: 'conversationId', unique: false },
        { name: 'timestamp', keyPath: 'timestamp', unique: false },
        { name: 'turnIndex', keyPath: ['conversationId', 'turnIndex'], unique: true }
      ]
    },
    toolCalls: {
      keyPath: 'id',
      indexes: [
        { name: 'messageId', keyPath: 'messageId', unique: false },
        { name: 'toolName', keyPath: 'toolName', unique: false },
        { name: 'status', keyPath: 'status', unique: false }
      ]
    },
    patterns: {
      keyPath: 'id',
      indexes: [
        { name: 'name', keyPath: 'name', unique: true },
        { name: 'category', keyPath: 'category', unique: false }
      ]
    }
  }
};
```

## CacheManager

### Interface
```typescript
class CacheManager {
  constructor(config?: CacheConfig);

  // Cache operations
  async get(key: string): Promise<any | null>;
  async set(key: string, value: any, ttl?: number): Promise<void>;
  async delete(key: string): Promise<void>;
  async clear(): Promise<void>;

  // Bulk operations
  async getMany(keys: string[]): Promise<Map<string, any>>;
  async setMany(entries: Map<string, any>): Promise<void>;

  // TTL management
  async refresh(key: string): Promise<void>;
  async cleanup(): Promise<number>; // Returns number of evicted entries

  // Statistics
  getStats(): CacheStats;
  async getSize(): Promise<number>;

  // Response caching
  async cacheResponse(url: string, response: any, options?: CacheOptions): Promise<void>;
  async getCachedResponse(url: string): Promise<CachedResponse | null>;
}
```

### Core Methods

#### `set(key: string, value: any, ttl?: number): Promise<void>`
Stores value with automatic compression and TTL.

```typescript
async set(key: string, value: any, ttl?: number) {
  const size = this.calculateSize(value);
  const shouldCompress = size > this.config.compressionThreshold;

  const entry: CacheEntry = {
    key,
    value: shouldCompress ? await this.compress(value) : value,
    compressed: shouldCompress,
    size,
    timestamp: Date.now(),
    ttl: ttl || this.config.defaultTTL,
    hits: 0
  };

  // Check if we need to evict
  if (await this.shouldEvict(size)) {
    await this.evict(size);
  }

  // Store in chrome.storage.local
  await chrome.storage.local.set({ [`cache.${key}`]: entry });

  // Update in-memory cache
  this.memoryCache.set(key, entry);

  // Update stats
  this.stats.entryCount++;
  this.stats.currentSize += size;
}
```

#### `cleanup(): Promise<number>`
Removes expired entries and applies eviction policy.

```typescript
async cleanup(): Promise<number> {
  const now = Date.now();
  let evicted = 0;

  // Get all cache entries
  const items = await chrome.storage.local.get(null);
  const cacheEntries = Object.entries(items)
    .filter(([key]) => key.startsWith('cache.'))
    .map(([key, value]) => ({ key: key.substring(6), ...value }));

  // Find expired entries
  const expired = cacheEntries.filter(entry => {
    return now - entry.timestamp > entry.ttl;
  });

  // Remove expired
  if (expired.length > 0) {
    const keys = expired.map(e => `cache.${e.key}`);
    await chrome.storage.local.remove(keys);
    evicted = expired.length;
  }

  // Apply eviction policy if over limit
  const remaining = cacheEntries.length - evicted;
  if (remaining > this.config.maxEntries) {
    const toEvict = this.selectForEviction(
      cacheEntries.filter(e => !expired.includes(e)),
      remaining - this.config.maxEntries
    );

    await chrome.storage.local.remove(toEvict.map(e => `cache.${e.key}`));
    evicted += toEvict.length;
  }

  this.stats.evictions += evicted;
  return evicted;
}
```

### Eviction Policies

```typescript
class CacheManager {
  private selectForEviction(entries: CacheEntry[], count: number): CacheEntry[] {
    switch (this.config.evictionPolicy) {
      case 'lru': // Least Recently Used
        return entries
          .sort((a, b) => a.lastAccess - b.lastAccess)
          .slice(0, count);

      case 'lfu': // Least Frequently Used
        return entries
          .sort((a, b) => a.hits - b.hits)
          .slice(0, count);

      case 'fifo': // First In First Out
        return entries
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, count);

      case 'size': // Largest first
        return entries
          .sort((a, b) => b.size - a.size)
          .slice(0, count);

      default:
        return entries.slice(0, count);
    }
  }
}
```

### Response Caching

```typescript
interface CachedResponse {
  url: string;
  response: any;
  headers?: Record<string, string>;
  status?: number;
  timestamp: number;
  ttl: number;
  etag?: string;
  compressed: boolean;
}

class CacheManager {
  async cacheResponse(url: string, response: any, options?: CacheOptions): Promise<void> {
    const cacheKey = this.generateCacheKey(url, options?.params);

    const cached: CachedResponse = {
      url,
      response,
      headers: options?.headers,
      status: options?.status || 200,
      timestamp: Date.now(),
      ttl: options?.ttl || 5 * 60 * 1000, // 5 minutes default
      etag: options?.etag,
      compressed: false
    };

    await this.set(cacheKey, cached, cached.ttl);
  }

  async getCachedResponse(url: string, options?: CacheOptions): Promise<CachedResponse | null> {
    const cacheKey = this.generateCacheKey(url, options?.params);
    const cached = await this.get(cacheKey);

    if (!cached) return null;

    // Check if still valid
    if (options?.validateEtag && cached.etag !== options.etag) {
      await this.delete(cacheKey);
      return null;
    }

    // Update hit count
    cached.hits++;
    cached.lastAccess = Date.now();
    await this.refresh(cacheKey);

    this.stats.hits++;
    return cached;
  }
}
```

### Configuration

```typescript
interface CacheConfig {
  maxSize: number;              // bytes, default: 50MB
  maxEntries: number;           // default: 1000
  defaultTTL: number;           // milliseconds, default: 5 minutes
  compressionThreshold: number; // bytes, default: 1KB
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'size';
  memoryCache: boolean;         // Use in-memory cache, default: true
  persistentCache: boolean;     // Use chrome.storage, default: true
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024,   // 50MB
  maxEntries: 1000,
  defaultTTL: 5 * 60 * 1000,    // 5 minutes
  compressionThreshold: 1024,   // 1KB
  evictionPolicy: 'lru',
  memoryCache: true,
  persistentCache: true
};
```

## Storage Quota Management

```typescript
class StorageQuotaManager {
  async getQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
      };
    }

    // Fallback for older browsers
    return {
      usage: await this.calculateUsage(),
      quota: 1024 * 1024 * 1024, // 1GB estimate
      percentage: 0
    };
  }

  async requestPersistence(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
    return false;
  }

  async cleanup(targetPercentage: number = 50): Promise<void> {
    const quota = await this.getQuota();

    if (quota.percentage > targetPercentage) {
      // Clear old conversations
      const store = new ConversationStore();
      await store.initialize();

      const conversations = await store.listConversations({
        status: 'archived',
        olderThan: Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      for (const conv of conversations) {
        await store.deleteConversation(conv.id);
      }

      // Clear cache
      const cache = new CacheManager();
      await cache.cleanup();
    }
  }
}
```

## Testing Requirements

### ConversationStore Tests
```typescript
describe('ConversationStore', () => {
  let store: ConversationStore;

  beforeEach(async () => {
    store = new ConversationStore('test-db');
    await store.initialize();
  });

  afterEach(async () => {
    await store.clear();
    await store.close();
  });

  it('should create and retrieve conversations', async () => {
    const id = await store.createConversation({
      title: 'Test Conversation',
      turnContext: defaultTurnContext
    });

    const conv = await store.getConversation(id);
    expect(conv).toBeDefined();
    expect(conv.title).toBe('Test Conversation');
  });

  it('should search messages', async () => {
    const convId = await store.createConversation({ title: 'Test' });
    await store.addMessage(convId, {
      role: 'user',
      content: 'Find information about TypeScript'
    });

    const results = await store.searchMessages('TypeScript');
    expect(results.length).toBe(1);
  });
});
```

### CacheManager Tests
```typescript
describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  it('should cache and retrieve values', async () => {
    await cache.set('key1', { data: 'test' });
    const value = await cache.get('key1');
    expect(value).toEqual({ data: 'test' });
  });

  it('should evict expired entries', async () => {
    await cache.set('temp', 'data', 100); // 100ms TTL
    await new Promise(resolve => setTimeout(resolve, 150));

    const evicted = await cache.cleanup();
    expect(evicted).toBe(1);

    const value = await cache.get('temp');
    expect(value).toBeNull();
  });

  it('should compress large values', async () => {
    const largeData = 'x'.repeat(2000);
    await cache.set('large', largeData);

    const stats = cache.getStats();
    expect(stats.currentSize).toBeLessThan(2000);
  });
});
```

## Performance Requirements

- IndexedDB operations: < 50ms for single record
- Bulk operations: < 500ms for 100 records
- Search: < 200ms for typical query
- Cache hit: < 10ms
- Compression: < 100ms for 1MB data
- Cleanup: < 1s for 1000 entries

## Security Considerations

- Encrypt sensitive data before storage
- Sanitize search queries
- Validate import data structure
- Implement rate limiting for bulk operations
- Clear storage on extension uninstall