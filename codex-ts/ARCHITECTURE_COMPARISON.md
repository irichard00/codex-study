# Architecture Comparison: Rust CLI vs TypeScript Web

## Core Loop Differences

### Rust CLI: `submission_loop()`
```rust
// Synchronous, blocking loop
loop {
    let input = read_user_input();  // Blocks waiting
    let result = process_submission(input);
    display_result(result);

    if should_exit { break; }
}
```

**Characteristics:**
- Single-threaded blocking I/O
- Sequential processing
- Stateful conversation in memory
- Direct terminal control
- One user, one session

### TypeScript Web: Event-Driven + `SubmissionLoop` Service
```typescript
// Asynchronous, event-based
websocket.on('message', async (message) => {
    // Non-blocking, concurrent handling
    const result = await submissionLoop.processSubmission(context, message);
    websocket.send(result);
});
```

**Characteristics:**
- Multi-threaded, non-blocking I/O
- Concurrent request handling
- Stateless requests (state in service)
- Browser/network intermediary
- Multiple users, multiple sessions

## Why the Implementation Differs

### 1. **Execution Model**

| Aspect | Rust CLI | TypeScript Web |
|--------|----------|----------------|
| Input Method | `stdin` (blocking) | WebSocket/HTTP (async) |
| Processing | Sequential loop | Event handlers |
| Concurrency | Single conversation | Multiple simultaneous |
| State Location | Process memory | Service/Database |

### 2. **The Submission Loop Evolution**

The TypeScript implementation actually **does** have a submission loop - it's just structured differently:

**Rust**: Explicit `while` loop in main thread
```rust
fn submission_loop() {
    while !should_exit {
        // Process one submission at a time
    }
}
```

**TypeScript**: Service-based loop per submission
```typescript
class SubmissionLoop {
    async processSubmission() {
        // Each call is one "iteration"
        // Multiple can run concurrently
    }
}
```

### 3. **State Management**

**Rust CLI:**
- Conversation state lives in the loop
- Variables persist between iterations
- Single context throughout session

**TypeScript Web:**
- State externalized to services
- Each request reconstructs context
- Multiple concurrent contexts

### 4. **Control Flow**

**Rust CLI:**
```
User → Terminal → Loop → Process → Terminal → User
        ↑                                      ↓
        └──────────────────────────────────────┘
```

**TypeScript Web:**
```
User → Browser → WebSocket → Handler → SubmissionLoop → Services
        ↑                                                      ↓
        └──────────────── WebSocket ←─────────────────────────┘
```

## The TypeScript Equivalent

The `SubmissionLoop` service I created above is the architectural equivalent:

```typescript
// backend/src/services/SubmissionLoop.ts
export class SubmissionLoop {
    async processSubmission(context, userInput) {
        // 1. Parse input (like Rust's parse_command)
        // 2. Plan tasks
        // 3. Execute tasks (like Rust's execute_tool_calls)
        // 4. Generate response
        // 5. Update conversation
        // Same logic, different structure
    }
}
```

## Key Advantages of Each Approach

### Rust CLI Advantages:
- ✅ Simple, linear flow
- ✅ Low latency (no network)
- ✅ Direct OS access
- ✅ Predictable resource usage
- ✅ Easy debugging (single thread)

### TypeScript Web Advantages:
- ✅ Multi-user support
- ✅ Remote accessibility
- ✅ Rich UI possibilities
- ✅ Concurrent processing
- ✅ Horizontal scalability

## Migration Guide

When converting from Rust to TypeScript:

1. **Loop → Service Method**
   - Rust: `loop { process() }`
   - TS: `async processSubmission()`

2. **Blocking I/O → Async Events**
   - Rust: `stdin.read_line()`
   - TS: `websocket.on('message')`

3. **Local State → Service State**
   - Rust: Variables in loop
   - TS: Service class members

4. **Sequential → Concurrent**
   - Rust: One operation at a time
   - TS: Multiple async operations

5. **Terminal UI → Web Components**
   - Rust: TUI with ratatui
   - TS: Svelte components

## Summary

The TypeScript implementation **does** have the equivalent of `submission_loop()` - it's just adapted for the web environment:

- **Location**: `backend/src/services/SubmissionLoop.ts`
- **Method**: `processSubmission()`
- **Invocation**: Per-message instead of continuous loop
- **Concurrency**: Multiple loops can run simultaneously
- **State**: Managed by services instead of loop variables

The core logic remains the same:
1. Receive input
2. Process through agent
3. Execute tasks
4. Generate response
5. Update state

The difference is architectural: from a synchronous loop to an asynchronous, event-driven service pattern suitable for web applications.