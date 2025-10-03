# ResponseStream API Contract

**Feature**: 010-refactor-the-codex
**Rust Reference**: `codex-rs/core/src/client_common.rs:149-164`
**TypeScript Target**: `codex-chrome/src/models/ResponseStream.ts`

## Contract Overview

This contract defines the `ResponseStream` class, which implements the TypeScript equivalent of Rust's channel-based streaming pattern. The stream provides an async iterable interface for consuming model response events.

## Behavioral Equivalence to Rust

### Rust Pattern
```rust
// Producer side
let (tx_event, rx_event) = mpsc::channel::<Result<ResponseEvent>>(1600);
tokio::spawn(async move {
    while let Some(event) = source.next().await {
        tx_event.send(Ok(event)).await.ok();
    }
});

// Consumer side
let stream = ResponseStream { rx_event };
while let Some(event) = stream.next().await {
    match event {
        Ok(evt) => println!("{:?}", evt),
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

### TypeScript Pattern
```typescript
// Producer side
const stream = new ResponseStream();
(async () => {
  for await (const event of source) {
    stream.addEvent(event);
  }
  stream.complete();
})();

// Consumer side
for await (const event of stream) {
  console.log(event.type);
}
// Errors throw exceptions, not yielded as values
```

## Public API

### Constructor

**Signature**:
```typescript
constructor(
  abortSignal?: AbortSignal,
  config?: Partial<ResponseStreamConfig>
)
```

**Contract**:
- **Input**:
  - `abortSignal`: Optional AbortSignal for cancellation
  - `config`: Optional configuration overrides
- **Default Config**:
  ```typescript
  {
    maxBufferSize: 1000,     // Match Rust channel capacity (1600 in Rust)
    eventTimeout: 30000,     // 30s timeout
    enableBackpressure: true // Throw when buffer full
  }
  ```
- **Behavior**:
  - Creates empty event buffer
  - Sets up abort handling
  - Initializes waiter queue

**Example**:
```typescript
const stream = new ResponseStream();
// Or with abort signal
const controller = new AbortController();
const stream = new ResponseStream(controller.signal);
```

---

### Producer Methods

#### addEvent()

**Rust Equivalent**: `tx_event.send(Ok(event))`

**Signature**:
```typescript
addEvent(event: ResponseEvent): void
```

**Contract**:
- **Input**: `ResponseEvent` to add to stream
- **Output**: None (void)
- **Behavior**:
  - Appends event to buffer
  - Notifies waiting consumers
  - If buffer full and backpressure enabled: throws `ResponseStreamError`
- **Errors**:
  - Throws if stream is completed
  - Throws if stream is aborted
  - Throws `ResponseStreamError('BACKPRESSURE')` if buffer full

**Example**:
```typescript
const stream = new ResponseStream();
stream.addEvent({ type: 'Created' });
stream.addEvent({ type: 'OutputTextDelta', delta: 'Hello' });
```

---

#### addEvents()

**Signature**:
```typescript
addEvents(events: ResponseEvent[]): void
```

**Contract**:
- **Input**: Array of ResponseEvent objects
- **Output**: None (void)
- **Behavior**: Calls `addEvent()` for each event in array
- **Errors**: Same as `addEvent()`

**Example**:
```typescript
stream.addEvents([
  { type: 'Created' },
  { type: 'OutputTextDelta', delta: 'Hi' },
]);
```

---

#### complete()

**Rust Equivalent**: Drop `tx_event` (sender drops → receiver gets None)

**Signature**:
```typescript
complete(): void
```

**Contract**:
- **Input**: None
- **Output**: None (void)
- **Behavior**:
  - Marks stream as completed
  - Notifies waiting consumers
  - Future `addEvent()` calls will throw
  - Consumer iteration will end after draining buffer

**Example**:
```typescript
stream.addEvent({ type: 'Completed', responseId: '123' });
stream.complete(); // Signal no more events
```

---

#### error()

**Rust Equivalent**: `tx_event.send(Err(e))`

**Signature**:
```typescript
error(err: Error): void
```

**Contract**:
- **Input**: Error object
- **Output**: None (void)
- **Behavior**:
  - Stores error
  - Marks stream as completed
  - Notifies waiting consumers
  - Consumer iteration will throw this error

**Example**:
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    stream.error(new Error('HTTP error'));
    return;
  }
  // ... process response
} catch (e) {
  stream.error(e);
}
```

---

#### abort()

**Signature**:
```typescript
abort(): void
```

**Contract**:
- **Input**: None
- **Output**: None (void)
- **Behavior**:
  - Triggers AbortController
  - Notifies waiting consumers
  - Consumer iteration will throw `ResponseStreamError('ABORTED')`

**Example**:
```typescript
// External cancellation
const controller = new AbortController();
const stream = new ResponseStream(controller.signal);

// Cancel the stream
controller.abort();
// Or from inside
stream.abort();
```

---

### Consumer Methods

#### [Symbol.asyncIterator]()

**Rust Equivalent**: `impl Stream for ResponseStream`

**Signature**:
```typescript
[Symbol.asyncIterator](): AsyncIterableIterator<ResponseEvent>
```

**Contract**:
- **Input**: None
- **Output**: AsyncIterableIterator yielding ResponseEvent objects
- **Behavior**:
  - Yields events from buffer in FIFO order
  - Waits for new events if buffer empty
  - Completes iteration when stream completed and buffer empty
  - Throws if error occurred
  - Throws if aborted
  - Throws `ResponseStreamError('TIMEOUT')` after `eventTimeout` ms of inactivity
- **Errors**:
  - `ResponseStreamError('ABORTED')` if stream aborted
  - `ResponseStreamError('STREAM_ERROR')` if error() was called
  - `ResponseStreamError('TIMEOUT')` if no events for `eventTimeout` ms

**Example**:
```typescript
const stream = await client.stream(prompt);

for await (const event of stream) {
  switch (event.type) {
    case 'Created':
      console.log('Stream started');
      break;
    case 'OutputTextDelta':
      process.stdout.write(event.delta);
      break;
    case 'Completed':
      console.log('\nUsage:', event.tokenUsage);
      break;
  }
}
```

---

### Utility Methods

#### getBufferSize()

**Signature**:
```typescript
getBufferSize(): number
```

**Contract**:
- **Input**: None
- **Output**: Current number of buffered events
- **Behavior**: Returns `eventBuffer.length`

**Example**:
```typescript
console.log('Buffered events:', stream.getBufferSize());
```

---

#### isStreamCompleted()

**Signature**:
```typescript
isStreamCompleted(): boolean
```

**Contract**:
- **Input**: None
- **Output**: `true` if stream completed, `false` otherwise

**Example**:
```typescript
if (stream.isStreamCompleted()) {
  console.log('Stream finished');
}
```

---

#### isAborted()

**Signature**:
```typescript
isAborted(): boolean
```

**Contract**:
- **Input**: None
- **Output**: `true` if stream aborted, `false` otherwise

**Example**:
```typescript
if (stream.isAborted()) {
  console.log('Stream was cancelled');
}
```

---

### Helper Methods

#### toArray()

**Signature**:
```typescript
async toArray(): Promise<ResponseEvent[]>
```

**Contract**:
- **Input**: None
- **Output**: Promise resolving to array of all events
- **Behavior**:
  - Consumes entire stream
  - Waits for stream completion
  - Returns all events in order
- **Errors**: Throws if stream errors
- **Warning**: Only use for testing or small streams

**Example**:
```typescript
const events = await stream.toArray();
console.log('Total events:', events.length);
```

---

#### take()

**Signature**:
```typescript
async *take(count: number): AsyncGenerator<ResponseEvent>
```

**Contract**:
- **Input**: Number of events to take
- **Output**: AsyncGenerator yielding up to `count` events
- **Behavior**: Stops iteration after `count` events (even if stream continues)

**Example**:
```typescript
// Take only first 5 events
for await (const event of stream.take(5)) {
  console.log(event.type);
}
```

---

#### filter()

**Signature**:
```typescript
async *filter(
  predicate: (event: ResponseEvent) => boolean
): AsyncGenerator<ResponseEvent>
```

**Contract**:
- **Input**: Predicate function
- **Output**: AsyncGenerator yielding events matching predicate
- **Behavior**: Yields only events where `predicate(event) === true`

**Example**:
```typescript
// Get only text deltas
const textEvents = stream.filter(e => e.type === 'OutputTextDelta');
for await (const event of textEvents) {
  console.log(event.delta);
}
```

---

#### map()

**Signature**:
```typescript
async *map<T>(
  mapper: (event: ResponseEvent) => T
): AsyncGenerator<T>
```

**Contract**:
- **Input**: Mapping function
- **Output**: AsyncGenerator yielding transformed values
- **Behavior**: Applies `mapper` to each event and yields result

**Example**:
```typescript
// Extract just event types
const types = stream.map(e => e.type);
for await (const type of types) {
  console.log(type);
}
```

---

## Static Factory Methods

#### fromEvents()

**Signature**:
```typescript
static fromEvents(events: ResponseEvent[]): ResponseStream
```

**Contract**:
- **Input**: Array of events
- **Output**: ResponseStream containing those events
- **Behavior**:
  - Creates stream
  - Adds all events asynchronously
  - Completes stream
- **Use Case**: Testing

**Example**:
```typescript
const stream = ResponseStream.fromEvents([
  { type: 'Created' },
  { type: 'Completed', responseId: '123' },
]);
```

---

#### fromError()

**Signature**:
```typescript
static fromError(error: Error): ResponseStream
```

**Contract**:
- **Input**: Error object
- **Output**: ResponseStream that errors immediately
- **Use Case**: Testing error handling

**Example**:
```typescript
const stream = ResponseStream.fromError(new Error('Test error'));
try {
  for await (const event of stream) {
    // Never executes
  }
} catch (e) {
  console.error('Caught:', e.message);
}
```

---

## Error Handling

### ResponseStreamError

**Signature**:
```typescript
class ResponseStreamError extends Error {
  constructor(
    message: string,
    code?: string,
    cause?: Error
  )
}
```

**Error Codes**:
- `'BACKPRESSURE'`: Buffer full, producer should slow down
- `'ABORTED'`: Stream was cancelled
- `'STREAM_ERROR'`: Upstream error occurred
- `'TIMEOUT'`: No events for `eventTimeout` ms
- `'ITERATION_ERROR'`: Error during iteration
- `'COLLECTION_ERROR'`: Error in toArray()

---

## Contract Test Requirements

Tests must verify:

1. **Lifecycle**:
   - Create → AddEvent → Complete → Iterate → Done
   - Create → AddEvent → Error → Iterate → Throws
   - Create → Abort → Iterate → Throws

2. **Backpressure**:
   - Buffer fills to maxBufferSize
   - addEvent() throws when full
   - Buffer drains as consumer iterates

3. **Timeout**:
   - Throws after eventTimeout ms of inactivity
   - Timeout resets when new event added

4. **Cancellation**:
   - AbortSignal cancels stream
   - abort() method cancels stream
   - Iteration throws after cancellation

5. **Utility Methods**:
   - toArray() collects all events
   - take() limits event count
   - filter() applies predicate
   - map() transforms events

## Example Contract Test

```typescript
describe('ResponseStream Contract', () => {
  describe('Producer-Consumer Pattern', () => {
    it('matches Rust channel behavior', async () => {
      const stream = new ResponseStream();

      // Producer (async)
      setTimeout(() => {
        stream.addEvent({ type: 'Created' });
        stream.addEvent({ type: 'OutputTextDelta', delta: 'Hi' });
        stream.complete();
      }, 0);

      // Consumer
      const events: ResponseEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('Created');
      expect(events[1].type).toBe('OutputTextDelta');
    });
  });

  describe('Backpressure', () => {
    it('throws when buffer full', () => {
      const stream = new ResponseStream(undefined, {
        maxBufferSize: 2,
        enableBackpressure: true,
      });

      stream.addEvent({ type: 'Created' });
      stream.addEvent({ type: 'OutputTextDelta', delta: 'A' });

      // Buffer full (2 events)
      expect(() => {
        stream.addEvent({ type: 'OutputTextDelta', delta: 'B' });
      }).toThrow(ResponseStreamError);
    });
  });

  describe('Error Handling', () => {
    it('throws error during iteration', async () => {
      const stream = new ResponseStream();
      const testError = new Error('Test error');

      setTimeout(() => stream.error(testError), 0);

      await expect(async () => {
        for await (const event of stream) {
          // Should throw before yielding anything
        }
      }).rejects.toThrow(ResponseStreamError);
    });
  });

  describe('Timeout', () => {
    it('throws after idle timeout', async () => {
      const stream = new ResponseStream(undefined, {
        eventTimeout: 100, // 100ms
      });

      // Don't add any events
      await expect(async () => {
        for await (const event of stream) {
          // Should timeout
        }
      }).rejects.toThrow(/timeout/i);
    });
  });
});
```

## Summary

ResponseStream contract defines:
- 4 producer methods (addEvent, addEvents, complete, error)
- 1 consumer method (async iterator)
- 3 utility methods (getBufferSize, isStreamCompleted, isAborted)
- 3 helper methods (toArray, take, filter, map)
- 2 static factories (fromEvents, fromError)
- Behavioral equivalence to Rust's mpsc::channel pattern
- Comprehensive error handling
