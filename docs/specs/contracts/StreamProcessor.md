# StreamProcessor API Contract

## Overview
Handles streaming responses in browser context, managing chunked data efficiently and updating UI progressively.

## Interface

```typescript
class StreamProcessor {
  constructor(
    source: 'model' | 'tool' | 'network',
    config?: StreamConfig
  );

  // Stream control
  async start(stream: ReadableStream): Promise<void>;
  pause(): void;
  resume(): void;
  abort(): void;

  // Buffer management
  getBufferSize(): number;
  clearBuffer(): void;
  setMaxBufferSize(size: number): void;

  // UI updates
  onUpdate(callback: (update: UIUpdate) => void): void;
  flushPendingUpdates(): void;

  // Status
  getStatus(): StreamStatus;
  getMetrics(): StreamMetrics;
}
```

## Core Methods

### `start(stream: ReadableStream): Promise<void>`
Begins processing a stream with automatic flow control.

**Flow:**
```typescript
async start(stream: ReadableStream) {
  const reader = stream.getReader();
  this.status = 'streaming';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      await this.processChunk(value);

      if (this.shouldApplyBackpressure()) {
        this.pause();
        await this.waitForBuffer();
        this.resume();
      }
    }

    this.status = 'completed';
    this.flushPendingUpdates();
  } catch (error) {
    this.status = 'error';
    throw error;
  } finally {
    reader.releaseLock();
  }
}
```

### `pause(): void`
Pauses stream processing temporarily.

**Behavior:**
- Sets status to 'paused'
- Stops reading from stream
- Maintains buffer state
- Can be resumed

### `resume(): void`
Resumes paused stream processing.

**Behavior:**
- Checks if paused
- Sets status to 'streaming'
- Continues reading
- Processes buffered data

### `abort(): void`
Cancels stream processing immediately.

**Behavior:**
- Sets status to 'error'
- Cancels reader
- Clears buffer
- Emits abort event

## Private Methods

### `processChunk(chunk: Uint8Array | string): Promise<void>`
Processes individual stream chunks.

**Steps:**
1. Decode chunk if binary
2. Add to buffer
3. Check for complete units
4. Trigger UI updates
5. Manage buffer size

### `shouldApplyBackpressure(): boolean`
Determines if flow control is needed.

**Logic:**
```typescript
shouldApplyBackpressure() {
  return this.buffer.length > this.pauseThreshold ||
         this.pendingUpdates.length > 100;
}
```

### `waitForBuffer(): Promise<void>`
Waits for buffer to drain below resume threshold.

```typescript
async waitForBuffer() {
  while (this.buffer.length > this.resumeThreshold) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
```

### `scheduleUIUpdate(): void`
Batches UI updates for efficiency.

```typescript
scheduleUIUpdate() {
  if (this.updateTimer) return;

  this.updateTimer = setTimeout(() => {
    this.flushPendingUpdates();
    this.updateTimer = null;
  }, this.updateInterval);
}
```

## Configuration

```typescript
interface StreamConfig {
  maxBufferSize: number;      // Default: 1MB
  pauseThreshold: number;      // Default: 0.8 * maxBufferSize
  resumeThreshold: number;     // Default: 0.5 * maxBufferSize
  updateInterval: number;      // Default: 100ms
  encoding: 'utf-8' | 'binary'; // Default: 'utf-8'
  chunkSize: number;          // Default: 16KB
}
```

## UI Update System

### Update Types
```typescript
interface UIUpdate {
  id: string;
  type: 'append' | 'replace' | 'clear';
  target: 'message' | 'code' | 'status';
  content: string;
  metadata?: {
    tokens?: number;
    timestamp?: number;
    sequenceNumber?: number;
  };
}
```

### Update Batching
```typescript
class StreamProcessor {
  private pendingUpdates: UIUpdate[] = [];

  private batchUpdate(update: UIUpdate): void {
    // Coalesce consecutive appends
    const lastUpdate = this.pendingUpdates[this.pendingUpdates.length - 1];

    if (lastUpdate?.type === 'append' &&
        update.type === 'append' &&
        lastUpdate.target === update.target) {
      lastUpdate.content += update.content;
    } else {
      this.pendingUpdates.push(update);
    }

    this.scheduleUIUpdate();
  }

  flushPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) return;

    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];

    this.updateCallbacks.forEach(callback => {
      updates.forEach(update => callback(update));
    });
  }
}
```

## Stream Sources

### Model Stream
```typescript
interface ModelStreamProcessor extends StreamProcessor {
  // Specific to LLM streaming
  parseTokens(chunk: string): string[];
  detectCompletion(tokens: string[]): boolean;
  handleFunctionCall(chunk: string): void;
}
```

### Tool Stream
```typescript
interface ToolStreamProcessor extends StreamProcessor {
  // Tool output streaming
  parseToolOutput(chunk: string): ToolOutput;
  validateOutput(output: ToolOutput): boolean;
}
```

### Network Stream
```typescript
interface NetworkStreamProcessor extends StreamProcessor {
  // HTTP response streaming
  parseHeaders(chunk: Uint8Array): Headers;
  handleRedirect(location: string): void;
}
```

## Buffer Management

### Buffer Structure
```typescript
interface StreamBuffer {
  chunks: StreamChunk[];
  totalSize: number;
  maxSize: number;

  push(chunk: StreamChunk): boolean;
  shift(): StreamChunk | undefined;
  clear(): void;
  getSize(): number;
}
```

### Memory Management
```typescript
class StreamProcessor {
  private manageMemory(): void {
    if (this.buffer.totalSize > this.maxBufferSize) {
      // Remove oldest chunks
      while (this.buffer.totalSize > this.resumeThreshold) {
        const removed = this.buffer.shift();
        if (!removed) break;
      }
    }
  }
}
```

## Error Handling

### Error Types
```typescript
enum StreamError {
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  DECODE_ERROR = 'DECODE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ABORT_ERROR = 'ABORT_ERROR',
  TIMEOUT = 'TIMEOUT'
}
```

### Recovery Strategies
1. **Buffer overflow**: Apply backpressure
2. **Decode error**: Skip chunk, continue
3. **Network error**: Retry with backoff
4. **Abort**: Clean shutdown
5. **Timeout**: Cancel and report

## Metrics

```typescript
interface StreamMetrics {
  bytesProcessed: number;
  chunksProcessed: number;
  averageChunkSize: number;
  processingRate: number; // bytes/second
  bufferUtilization: number; // percentage
  updateCount: number;
  errorCount: number;
  startTime: number;
  endTime?: number;
}
```

## Testing Requirements

### Unit Tests
- Stream processing flow
- Buffer management
- Backpressure application
- UI update batching
- Error handling

### Performance Tests
- Large stream handling (>10MB)
- High-frequency updates
- Memory usage under load
- Update batching efficiency

### Integration Tests
```typescript
describe('StreamProcessor Integration', () => {
  it('should handle model streaming', async () => {
    const processor = new StreamProcessor('model');
    const updates = [];

    processor.onUpdate(update => updates.push(update));

    const stream = createMockModelStream();
    await processor.start(stream);

    expect(updates.length).toBeGreaterThan(0);
    expect(processor.getStatus()).toBe('completed');
  });

  it('should apply backpressure on buffer overflow', async () => {
    const processor = new StreamProcessor('tool', {
      maxBufferSize: 1024,
      pauseThreshold: 800
    });

    let paused = false;
    processor.on('pause', () => { paused = true; });

    const largeStream = createLargeStream();
    await processor.start(largeStream);

    expect(paused).toBe(true);
  });
});
```

## Performance Requirements

- Chunk processing: < 5ms per chunk
- UI update batching: Max 100ms delay
- Buffer operations: O(1) complexity
- Memory usage: < 10MB per stream
- Concurrent streams: Support up to 3

## Browser Compatibility

### Required APIs
- ReadableStream API
- TextDecoder API
- setTimeout/clearTimeout
- Uint8Array

### Polyfills
```typescript
if (!window.ReadableStream) {
  // Load polyfill
  await import('web-streams-polyfill/ponyfill');
}
```

## Usage Example

```typescript
// Model streaming
const modelProcessor = new StreamProcessor('model', {
  updateInterval: 50,
  maxBufferSize: 2 * 1024 * 1024 // 2MB
});

modelProcessor.onUpdate((update) => {
  if (update.type === 'append' && update.target === 'message') {
    messageDiv.innerHTML += update.content;
  }
});

const response = await fetch('/api/chat', { method: 'POST', body });
await modelProcessor.start(response.body);

// Tool output streaming
const toolProcessor = new StreamProcessor('tool');

toolProcessor.onUpdate((update) => {
  console.log('Tool output:', update.content);
});

const toolStream = await executeToolWithStream('screenshot');
await toolProcessor.start(toolStream);
```