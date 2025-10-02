/**
 * Model clients for codex-chrome extension
 * Exports all model client components
 */

// Base classes and interfaces
export {
  ModelClient,
  ModelClientError,
  type CompletionRequest,
  type CompletionResponse,
  type StreamChunk,
  type Message,
  type Choice,
  type Usage,
  type ToolCall,
  type RetryConfig,
} from './ModelClient';

// Re-export ToolDefinition from tools/BaseTool.ts
export type { ToolDefinition } from '../tools/BaseTool';

// Provider implementations
export { OpenAIClient } from './OpenAIClient';
export { AnthropicClient } from './AnthropicClient';
export { OpenAIResponsesClient, type OpenAIResponsesConfig } from './OpenAIResponsesClient';

// Factory and utilities
export {
  ModelClientFactory,
  getModelClientFactory,
  type ModelProvider,
  type ModelClientConfig,
} from './ModelClientFactory';

// Rate limiting and token tracking
export {
  RateLimitManager,
  createRateLimitManager,
  type RateLimitConfig,
  type RateLimitHistory,
} from './RateLimitManager';

export {
  TokenUsageTracker,
  createTokenUsageTracker,
  createDefaultTokenUsageConfig,
  type TokenUsageConfig,
  type TokenUsageEntry,
  type TimeRange,
  type UsagePeriod,
} from './TokenUsageTracker';

// Authentication management
export {
  ChromeAuthManager,
  chromeAuthManager,
} from './ChromeAuthManager';

// Performance optimizations (Phase 9)
export {
  SSEEventParser,
} from './SSEEventParser';

export {
  RequestQueue,
  RequestPriority,
  type QueuedRequest,
  type RateLimitConfig,
  type QueueMetrics,
} from './RequestQueue';