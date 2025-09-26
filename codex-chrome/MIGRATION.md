# Migration Guide: Enhanced OpenAI Client & Performance Improvements

This guide helps you migrate from the basic OpenAIClient to the enhanced version with performance optimizations, request queuing, and improved streaming capabilities.

## Overview of Changes

### Phase 9 Improvements
- **SSEEventParser**: Memory pooling, hot path optimization, performance monitoring
- **RequestQueue**: Priority-based queuing with persistence and rate limiting
- **Model Client**: Enhanced streaming with better error handling

## Migration Steps

### 1. SSEEventParser Usage

#### Old Usage
```typescript
const parser = new SSEEventParser();
const event = parser.parse(sseData);
const processedEvents = parser.processEvent(event);

// Modifying parsed events directly
event.customField = 'some value';
```

#### New Usage (Recommended)
```typescript
const parser = new SSEEventParser();

// Parse and process (event is now pooled)
const event = parser.parse(sseData);
const processedEvents = parser.processEvent(event);

// Don't modify parsed events directly - copy first
const customEvent = { ...event, customField: 'some value' };

// Monitor performance
const metrics = parser.getPerformanceMetrics();
if (!metrics.isWithinTarget) {
  console.warn(`Performance issue: ${metrics.averageTime}ms average`);
}

// Batch processing for better performance
const events = parser.processBatch(['data1', 'data2', 'data3']);
```

### 2. Request Queue Integration

#### Old Direct API Calls
```typescript
class MyModelClient {
  async makeRequest(request: CompletionRequest): Promise<Response> {
    // Direct fetch call
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(request)
    });
    return response.json();
  }
}
```

#### New Queued Approach
```typescript
import { RequestQueue, RequestPriority } from './models/RequestQueue';

class EnhancedModelClient {
  private requestQueue: RequestQueue;

  constructor() {
    this.requestQueue = new RequestQueue({
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10
    });
  }

  async makeRequest(
    request: CompletionRequest,
    priority: RequestPriority = RequestPriority.NORMAL
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.enqueue(request, priority, {
        maxRetries: 3,
        onComplete: resolve,
        onError: reject
      });
    });
  }

  // Get queue status for monitoring
  getQueueStatus() {
    return this.requestQueue.getStatus();
  }

  // Get analytics for optimization
  getAnalytics() {
    return this.requestQueue.getAnalytics();
  }
}
```

### 3. Enhanced Streaming

#### Old Streaming Implementation
```typescript
async *streamResponse(request: CompletionRequest): AsyncGenerator<any> {
  const response = await fetch(url, { ... });
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Basic parsing
    const chunk = parseChunk(value);
    yield chunk;
  }
}
```

#### New Enhanced Streaming
```typescript
import { SSEEventParser } from './models/SSEEventParser';

async *streamResponse(request: CompletionRequest): AsyncGenerator<any> {
  // Use queue for rate limiting
  const requestId = this.requestQueue.enqueue(request, RequestPriority.HIGH);

  const response = await this.makeQueuedRequest(requestId);
  const reader = response.body.getReader();
  const parser = new SSEEventParser();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Enhanced parsing with performance monitoring
    const textData = new TextDecoder().decode(value);
    const lines = textData.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = parser.parse(line.slice(6));
        if (event) {
          const processedEvents = parser.processEvent(event);
          for (const processed of processedEvents) {
            yield processed;
          }
        }
      }
    }
  }

  // Monitor performance
  const metrics = parser.getPerformanceMetrics();
  console.log(`Stream processed ${metrics.totalProcessed} events, avg: ${metrics.averageTime}ms`);
}
```

### 4. Error Handling Improvements

#### Old Error Handling
```typescript
try {
  const response = await makeRequest(request);
  return response;
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
```

#### New Enhanced Error Handling
```typescript
class RobustClient {
  async makeRequest(request: CompletionRequest): Promise<Response> {
    try {
      // Queue automatically handles retries and rate limiting
      return await this.queuedRequest(request);
    } catch (error) {
      // Enhanced error handling with queue analytics
      const analytics = this.requestQueue.getAnalytics();

      console.error('Request failed after queue processing:', {
        error: error.message,
        successRate: analytics.successRate,
        queueSize: this.requestQueue.getStatus().queueSize
      });

      // Check if it's a rate limit error
      if (error.message.includes('rate limit')) {
        console.warn('Rate limited - queue will handle retry with backoff');
      }

      throw error;
    }
  }
}
```

### 5. Memory Management

#### Old Approach (Memory Leaks Possible)
```typescript
class SimpleParser {
  private events: Array<any> = [];

  processStream(data: string) {
    const event = JSON.parse(data);
    this.events.push(event); // Accumulates in memory
    return this.handleEvent(event);
  }
}
```

#### New Memory-Efficient Approach
```typescript
class EfficientParser {
  private parser = new SSEEventParser(); // Uses object pooling

  processStream(data: string) {
    // Events are pooled and reused automatically
    const event = this.parser.parse(data);
    if (event) {
      const processed = this.parser.processEvent(event);
      // Event is returned to pool after processing
      return processed;
    }
    return [];
  }

  // Clean up resources
  cleanup() {
    this.parser.resetPerformanceMetrics();
  }
}
```

## Breaking Changes & Compatibility

### Non-Breaking Changes
- All existing APIs continue to work
- Performance improvements are transparent
- Memory optimizations happen automatically

### Behavioral Changes
- **Event Objects**: Don't modify parsed SSE events directly (copy first)
- **Request Timing**: Requests may be delayed due to queue rate limiting
- **Memory Usage**: Lower memory usage due to object pooling

### New Required Patterns

#### Performance Monitoring
```typescript
// Recommended: Monitor performance in production
const metrics = parser.getPerformanceMetrics();
if (!metrics.isWithinTarget) {
  console.warn('Performance degradation detected');
  parser.resetPerformanceMetrics(); // Reset if needed
}
```

#### Queue Monitoring
```typescript
// Recommended: Monitor queue health
const status = queue.getStatus();
if (status.queueSize > 50) {
  console.warn('Queue backup detected:', status);
}

const analytics = queue.getAnalytics();
if (analytics.successRate < 0.9) {
  console.error('High failure rate:', analytics);
}
```

## Testing Your Migration

### 1. Performance Tests
```typescript
describe('Performance Migration', () => {
  test('should meet performance targets', async () => {
    const parser = new SSEEventParser();
    const startTime = Date.now();

    // Process many events
    for (let i = 0; i < 1000; i++) {
      const event = parser.parse(`{"type": "response.output_text.delta", "delta": "test ${i}"}`);
      if (event) parser.processEvent(event);
    }

    const metrics = parser.getPerformanceMetrics();
    expect(metrics.averageTime).toBeLessThan(10); // < 10ms target
    expect(metrics.isWithinTarget).toBe(true);
  });
});
```

### 2. Queue Integration Tests
```typescript
describe('Queue Integration', () => {
  test('should handle rate limiting gracefully', async () => {
    const queue = new RequestQueue({ requestsPerMinute: 5 });

    // Queue many requests rapidly
    const requests = Array(10).fill(mockRequest);
    const promises = requests.map(req =>
      queue.enqueue(req, RequestPriority.NORMAL)
    );

    // Should not overwhelm API
    const status = queue.getStatus();
    expect(status.queueSize).toBeGreaterThan(0);
  });
});
```

### 3. Memory Leak Tests
```typescript
describe('Memory Management', () => {
  test('should not leak memory with many events', () => {
    const parser = new SSEEventParser();
    const initialHeap = (performance as any).memory?.usedJSHeapSize || 0;

    // Process many events
    for (let i = 0; i < 10000; i++) {
      const event = parser.parse(`{"type": "response.output_text.delta", "delta": "${i}"}`);
      if (event) parser.processEvent(event);
    }

    // Force GC if available
    if (global.gc) global.gc();

    const finalHeap = (performance as any).memory?.usedJSHeapSize || 0;
    const growth = finalHeap - initialHeap;

    // Memory growth should be minimal due to pooling
    expect(growth).toBeLessThan(1024 * 1024); // < 1MB growth
  });
});
```

## Rollback Plan

If you need to rollback the changes:

### 1. Disable Queue Integration
```typescript
// Temporarily bypass queue
class FallbackClient {
  private useQueue = false; // Set to false to bypass

  async makeRequest(request: CompletionRequest) {
    if (this.useQueue) {
      return this.queuedRequest(request);
    } else {
      return this.directRequest(request); // Fallback to old method
    }
  }
}
```

### 2. Use Simple Parser
```typescript
// Fallback to simple parsing if needed
class SimpleSSEParser {
  parse(data: string) {
    return JSON.parse(data); // Simple, no pooling
  }

  processEvent(event: any) {
    // Your existing logic
    return [];
  }
}
```

## Support & Troubleshooting

### Common Issues

1. **"Event object is read-only"** - Don't modify parsed events directly
2. **"Requests are slow"** - Check queue status, may be rate limited
3. **"Memory usage increased"** - Check that events aren't being held onto

### Debug Information

```typescript
// Add debug logging
const parser = new SSEEventParser();
const queue = new RequestQueue();

console.log('Parser metrics:', parser.getPerformanceMetrics());
console.log('Queue status:', queue.getStatus());
console.log('Queue analytics:', queue.getAnalytics());
```

### Performance Profiling

Use Chrome DevTools to profile the improvements:
1. Open Chrome DevTools
2. Go to Performance tab
3. Record while processing many SSE events
4. Look for reduced GC pressure and faster event processing

The migration is designed to be backward compatible while providing significant performance benefits. Monitor the metrics to ensure the improvements are working as expected.