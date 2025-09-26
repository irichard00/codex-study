# ModelClient Dependencies

## Dependencies Added for ModelClient Alignment

### Runtime Dependencies

1. **eventsource**: `^2.0.2`
   - Provides Server-Sent Events (SSE) parsing functionality
   - Replaces Rust's `eventsource-stream` crate
   - Essential for streaming chat completions from OpenAI API
   - Works in browser context for Chrome extension

2. **@types/eventsource**: `^1.1.15`
   - TypeScript type definitions for eventsource
   - Ensures type safety when working with SSE streams

### Existing Dependencies (Already Available)

1. **uuid**: `^13.0.0`
   - Used for generating conversation IDs and request tracking
   - Matches Rust's uuid functionality

2. **zod**: `^4.1.11`
   - Runtime type validation
   - Used for API response validation and type safety

3. **@types/chrome**: `^0.1.12`
   - Chrome extension API types
   - Enables browser-specific functionality (storage, tabs, etc.)

## Architecture Notes

The TypeScript ModelClient will:

1. Use `fetch()` API (built into browsers) instead of Rust's `reqwest`
2. Use `eventsource` library for SSE parsing instead of `eventsource-stream`
3. Use native `Promise`/`async`/`await` instead of Rust's `futures` and `tokio`
4. Utilize Chrome extension APIs for storage and configuration

## Rationale

These dependencies maintain functional parity with the Rust implementation while leveraging browser-native APIs where possible. The SSE parsing is the main external dependency required since browsers don't have a built-in EventSource constructor that works well with custom headers and authentication.