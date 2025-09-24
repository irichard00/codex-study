# Data Model: Missing Components for Codex Chrome Extension

## Missing Core Classes

### AgentTask (Critical Missing Component)
```typescript
/**
 * Coordinates multiple turns in response to user input
 * Port of codex-rs AgentTask struct
 */
interface AgentTask {
  // Core properties
  id: string;
  sessionId: string;
  submissionId: string;
  input: ResponseItem[];

  // Execution state
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentTurnIndex: number;
  maxTurns: number;

  // Context management
  turnContext: TurnContext;
  tokenBudget: TokenBudget;
  compactionHistory: CompactionEvent[];

  // Browser-specific context
  tabContext?: TabContext;
  activeToolCalls: ToolCall[];

  // Timing
  startTime: number;
  endTime?: number;
  lastActivity: number;

  // Error handling
  error?: TaskError;
  retryCount: number;
  maxRetries: number;
}

interface TokenBudget {
  maxTokens: number;
  usedTokens: number;
  reservedTokens: number; // For system prompts
  shouldCompact: boolean;
  compactionThreshold: number;
}

interface CompactionEvent {
  timestamp: number;
  turnIndex: number;
  tokensBefore: number;
  tokensAfter: number;
  itemsRemoved: number;
}

interface TaskError {
  code: string;
  message: string;
  turnIndex?: number;
  toolName?: string;
  recoverable: boolean;
  details?: any;
}
```

### StreamProcessor (Missing)
```typescript
/**
 * Handles streaming responses in browser context
 */
interface StreamProcessor {
  // Stream management
  streamId: string;
  source: 'model' | 'tool' | 'network';
  status: 'idle' | 'streaming' | 'paused' | 'completed' | 'error';

  // Buffering
  buffer: StreamChunk[];
  bufferSize: number;
  maxBufferSize: number;

  // Flow control
  backpressure: boolean;
  pauseThreshold: number;
  resumeThreshold: number;

  // UI updates
  updateInterval: number;
  lastUpdate: number;
  pendingUpdates: UIUpdate[];
}

interface StreamChunk {
  id: string;
  data: string | Uint8Array;
  timestamp: number;
  sequenceNumber: number;
  isFinal: boolean;
}

interface UIUpdate {
  type: 'append' | 'replace' | 'clear';
  target: 'message' | 'code' | 'status';
  content: string;
  metadata?: any;
}
```

### Enhanced Browser Tools Data Models

#### WebScrapingTool
```typescript
interface WebScrapingPattern {
  id: string;
  name: string;
  description: string;

  // Selectors
  selectors: SelectorConfig[];

  // Extraction rules
  extraction: ExtractionRule[];

  // Pagination
  pagination?: PaginationConfig;

  // Validation
  validation?: ValidationRule[];

  // Transform
  transform?: TransformPipeline;
}

interface SelectorConfig {
  type: 'css' | 'xpath' | 'text' | 'regex';
  selector: string;
  multiple: boolean;
  required: boolean;
  fallback?: string;
}

interface ExtractionRule {
  field: string;
  source: 'text' | 'attribute' | 'html' | 'computed';
  attribute?: string;
  format?: 'string' | 'number' | 'date' | 'json';
  default?: any;
}

interface PaginationConfig {
  type: 'click' | 'scroll' | 'load-more' | 'url-pattern';
  nextSelector?: string;
  urlPattern?: string;
  maxPages: number;
  delay: number;
}
```

#### FormAutomationTool
```typescript
interface FormAutomationTask {
  id: string;
  name: string;
  url: string;

  // Form detection
  formSelector?: string;
  autoDetect: boolean;

  // Field mappings
  fields: FormFieldMapping[];

  // Multi-step support
  steps?: FormStep[];

  // Submission
  submitButton?: string;
  submitMethod: 'click' | 'enter' | 'javascript';

  // Validation
  validateBeforeSubmit: boolean;
  validationRules?: ValidationRule[];

  // Post-submit
  waitAfterSubmit?: number;
  successIndicator?: string;
  errorIndicator?: string;
}

interface FormFieldMapping {
  name: string;
  selector?: string;
  type: 'text' | 'email' | 'password' | 'select' | 'checkbox' | 'radio' | 'file';
  value: any;
  required: boolean;
  validation?: string; // Regex pattern
}

interface FormStep {
  name: string;
  trigger: 'auto' | 'click' | 'wait';
  selector?: string;
  delay?: number;
  fields: FormFieldMapping[];
}
```

#### NetworkInterceptTool
```typescript
interface NetworkInterceptConfig {
  id: string;
  enabled: boolean;

  // Matching rules
  patterns: NetworkPattern[];

  // Modifications
  requestModifications?: RequestModification[];
  responseModifications?: ResponseModification[];

  // Monitoring
  monitoring: MonitoringConfig;

  // Caching
  caching?: CachingConfig;
}

interface NetworkPattern {
  type: 'url' | 'method' | 'header' | 'mime-type';
  pattern: string | RegExp;
  include: boolean; // true = include, false = exclude
}

interface RequestModification {
  type: 'header' | 'body' | 'url' | 'method';
  action: 'add' | 'modify' | 'remove';
  key?: string;
  value?: any;
}

interface MonitoringConfig {
  logRequests: boolean;
  logResponses: boolean;
  captureTimings: boolean;
  captureHeaders: boolean;
  captureBody: boolean;
  maxBodySize: number;
}
```

### Persistence Layer

#### ConversationStore (IndexedDB)
```typescript
interface ConversationStore {
  // Database info
  dbName: string;
  version: number;

  // Stores
  conversations: IDBObjectStore;
  messages: IDBObjectStore;
  tools: IDBObjectStore;
  patterns: IDBObjectStore;
  cache: IDBObjectStore;
}

interface ConversationRecord {
  id: string;
  title: string;
  created: Date;
  updated: Date;

  // State
  status: 'active' | 'archived' | 'deleted';
  turnCount: number;
  tokenCount: number;

  // Context
  turnContext: TurnContext;
  metadata: Record<string, any>;

  // References
  messageIds: string[];
  toolCallIds: string[];
}

interface MessageRecord {
  id: string;
  conversationId: string;
  turnIndex: number;

  // Content
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];

  // Metadata
  timestamp: Date;
  tokenCount: number;
  model?: string;

  // Tool calls
  toolCalls?: ToolCall[];
  toolCallId?: string;
}
```

#### CacheManager
```typescript
interface CacheManager {
  // Cache stores
  responseCache: Map<string, CachedResponse>;
  toolCache: Map<string, CachedToolResult>;
  patternCache: Map<string, CachedPattern>;

  // Configuration
  config: CacheConfig;

  // Statistics
  stats: CacheStats;
}

interface CachedResponse {
  key: string;
  response: any;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  compressed: boolean;
}

interface CacheConfig {
  maxSize: number; // bytes
  maxEntries: number;
  defaultTTL: number; // milliseconds
  compressionThreshold: number; // bytes
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  entryCount: number;
}
```

### Browser-Specific Contexts

#### TabContext (Enhanced)
```typescript
interface TabContext {
  // Tab identification
  tabId: number;
  windowId: number;
  index: number;

  // Navigation state
  url: string;
  title: string;
  status: 'loading' | 'complete';

  // Content state
  documentReady: boolean;
  contentScriptInjected: boolean;

  // Capabilities
  permissions: string[];
  canExecuteScript: boolean;
  canAccessDOM: boolean;

  // History
  navigationHistory: NavigationEntry[];
  toolExecutionHistory: ToolExecution[];

  // Screenshots
  lastScreenshot?: string;
  screenshotTimestamp?: number;
}

interface NavigationEntry {
  url: string;
  title: string;
  timestamp: number;
  trigger: 'user' | 'tool' | 'redirect' | 'refresh';
}

interface ToolExecution {
  toolName: string;
  timestamp: number;
  success: boolean;
  duration: number;
  changes?: any;
}
```

## Integration Relationships

### Component Dependencies
```
AgentTask
  ├── TaskRunner (existing)
  ├── TurnManager (existing)
  ├── StreamProcessor (new)
  └── TabContext (enhanced)

StreamProcessor
  ├── ModelClient (existing)
  └── UIUpdate system

WebScrapingTool
  ├── DOMTool (existing)
  ├── PatternLibrary (new)
  └── ConversationStore (new)

FormAutomationTool
  ├── DOMTool (existing)
  ├── ValidationEngine (new)
  └── Multi-step coordinator

NetworkInterceptTool
  ├── Chrome webRequest API
  ├── CacheManager (new)
  └── MonitoringSystem

ConversationStore
  ├── IndexedDB
  ├── MessageRecord
  └── Migration utilities

CacheManager
  ├── chrome.storage.local
  ├── Compression utilities
  └── Eviction policies
```

## Migration Path

### From Existing to Enhanced
1. **TaskRunner** → Add AgentTask coordination
2. **TurnManager** → Add review mode support
3. **Session** → Add token budget tracking
4. **DOMTool** → Integrate with WebScrapingTool
5. **StorageTool** → Integrate with ConversationStore

### New Component Priority
1. **AgentTask** - Critical for coordination
2. **StreamProcessor** - Needed for UI responsiveness
3. **ConversationStore** - Essential for persistence
4. **WebScrapingTool** - High user value
5. **FormAutomationTool** - High user value
6. **CacheManager** - Performance optimization
7. **NetworkInterceptTool** - Advanced feature

## Type Guards and Validators

```typescript
// Type guard for AgentTask
function isAgentTask(obj: any): obj is AgentTask {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.submissionId === 'string' &&
    Array.isArray(obj.input) &&
    ['initializing', 'running', 'completed', 'failed', 'cancelled'].includes(obj.status);
}

// Validator for WebScrapingPattern
function validateScrapingPattern(pattern: any): ValidationResult {
  const errors: string[] = [];

  if (!pattern.name) errors.push('Pattern name required');
  if (!pattern.selectors || !Array.isArray(pattern.selectors)) {
    errors.push('Selectors array required');
  }
  if (!pattern.extraction || !Array.isArray(pattern.extraction)) {
    errors.push('Extraction rules required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

## Constants

```typescript
// AgentTask limits
export const MAX_TURNS_PER_TASK = 50;
export const MAX_TOKENS_PER_TURN = 8000;
export const AUTO_COMPACT_THRESHOLD = 0.75; // 75% of token budget

// StreamProcessor limits
export const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
export const UI_UPDATE_INTERVAL = 100; // milliseconds

// Cache limits
export const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
export const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// Tool limits
export const MAX_SCRAPING_PAGES = 10;
export const MAX_FORM_STEPS = 10;
export const MAX_NETWORK_LOG_SIZE = 1000;
```