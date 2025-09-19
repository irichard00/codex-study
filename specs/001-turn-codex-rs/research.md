# Research & Technical Decisions

**Feature**: TypeScript Web-Based Implementation of Codex
**Date**: 2025-09-19
**Phase**: Research and Discovery

## Executive Summary
This document consolidates research findings and technical decisions for migrating the Rust-based Codex CLI to a TypeScript web application with Svelte frontend.

## Architecture Decisions

### 1. Frontend Framework
**Decision**: Svelte 4.x with SvelteKit
**Rationale**:
- Compile-time optimizations result in smaller bundle sizes
- No virtual DOM overhead, direct DOM manipulation
- Built-in reactivity without external state management
- Excellent TypeScript support
- SvelteKit provides SSR capabilities if needed
**Alternatives Considered**:
- React: Larger ecosystem but heavier runtime
- Vue: Good alternative but less performant than Svelte
- Solid: Similar performance but smaller ecosystem

### 2. Backend Framework
**Decision**: Fastify with TypeScript
**Rationale**:
- High performance, comparable to native HTTP servers
- Excellent TypeScript support with type providers
- Built-in schema validation with JSON Schema
- Plugin ecosystem for common needs
- WebSocket support via fastify-websocket
**Alternatives Considered**:
- Express: Mature but slower, less TypeScript-friendly
- NestJS: Too heavy for this use case
- Hono: Newer, less mature ecosystem

### 3. WebSocket Implementation
**Decision**: Native WebSocket with fastify-websocket
**Rationale**:
- Lower overhead than Socket.io
- Direct protocol control for MCP communication
- Better performance for real-time updates
- Simpler client-side implementation
**Alternatives Considered**:
- Socket.io: Feature-rich but adds unnecessary overhead
- ws library: Good but Fastify integration is cleaner

### 4. Testing Strategy
**Decision**: Vitest (unit/integration) + Playwright (E2E)
**Rationale**:
- Vitest: Jest-compatible, fast, native ESM support
- Playwright: Cross-browser testing, reliable, good DX
- Both have excellent TypeScript support
**Alternatives Considered**:
- Jest: Slower, configuration heavy
- Cypress: Good for E2E but limited to browser testing
- WebdriverIO: More complex setup

### 5. Build Tools
**Decision**: Vite for both frontend and backend
**Rationale**:
- Unified tooling across stack
- Fast HMR for development
- Optimized production builds
- Native TypeScript/ESM support
**Alternatives Considered**:
- Webpack: Slower, more configuration
- Rollup: Good but Vite uses it under the hood
- esbuild: Fast but less ecosystem support

## Technical Clarifications

### 1. Sandboxing in Web Environment
**Challenge**: Browser sandboxing vs OS-level sandboxing (seatbelt/landlock)
**Solution**:
- Browser naturally sandboxes client code
- Server-side: Use Node.js worker threads with limited permissions
- Implement resource limits via Node.js APIs
- Use Docker containers for stronger isolation in production

### 2. Authentication Method
**Decision**: JWT-based authentication with refresh tokens
**Implementation**:
- Local mode: Optional auth, token stored in localStorage
- Multi-user mode: Required auth with secure httpOnly cookies
- OAuth2 support for future cloud deployment

### 3. MCP Protocol Integration
**Challenge**: Adapting MCP for web environment
**Solution**:
- WebSocket transport for client-server MCP communication
- Server acts as MCP client to external servers
- Protocol messages wrapped in WebSocket frames
- Maintain compatibility with existing MCP ecosystem

### 4. Configuration Management
**Decision**: Maintain config.toml compatibility
**Implementation**:
- Server-side TOML parser (toml library)
- Configuration UI in web interface
- Real-time config updates via WebSocket
- Migration tool for existing configs

### 5. File System Access
**Challenge**: Browser cannot directly access local files
**Solution**:
- Server provides file system API
- File browser component in UI
- Upload/download for file editing
- Virtual file system for browser-only mode

## Migration Strategy

### Phase 1: Core Functionality
1. Port core business logic from Rust to TypeScript
2. Implement basic web UI with essential features
3. WebSocket communication infrastructure
4. File system API

### Phase 2: MCP & Advanced Features
1. MCP client/server implementation
2. Configuration management UI
3. Authentication system
4. Notification system

### Phase 3: Optimization & Polish
1. Performance optimization
2. Advanced UI features
3. Mobile responsiveness
4. Cloud deployment readiness

## Performance Considerations

### Expected Metrics
- Initial page load: <2s
- WebSocket latency: <50ms local, <200ms remote
- File operations: <100ms for files <1MB
- UI interactions: <16ms (60fps)

### Optimization Strategies
1. Code splitting with dynamic imports
2. Web Workers for heavy computations
3. Virtual scrolling for large lists
4. Debounced WebSocket messages
5. IndexedDB for client-side caching

## Security Considerations

### Web-Specific Threats
1. **XSS Prevention**: CSP headers, input sanitization
2. **CSRF Protection**: CSRF tokens, SameSite cookies
3. **WebSocket Security**: Origin validation, rate limiting
4. **File Access**: Path traversal prevention, whitelist approach

### Implementation
- Helmet.js for security headers
- Input validation on both client and server
- Rate limiting with fastify-rate-limit
- File access restricted to workspace directory

## Dependency Analysis

### Core Dependencies
```json
{
  "backend": {
    "fastify": "^4.x",
    "fastify-websocket": "^4.x",
    "@fastify/cors": "^8.x",
    "@fastify/helmet": "^11.x",
    "@fastify/jwt": "^7.x",
    "toml": "^3.x",
    "tsx": "^4.x"
  },
  "frontend": {
    "svelte": "^4.x",
    "@sveltejs/kit": "^2.x",
    "vite": "^5.x",
    "@sveltejs/adapter-node": "^4.x"
  },
  "shared": {
    "typescript": "^5.x",
    "zod": "^3.x"
  },
  "dev": {
    "vitest": "^1.x",
    "playwright": "^1.x",
    "@types/node": "^20.x"
  }
}
```

## Browser Compatibility

### Minimum Requirements
- Chrome 100+ (2022)
- Firefox 100+ (2022)
- Safari 15+ (2021)
- Edge 100+ (2022)

### Required Features
- WebSocket API
- Web Workers
- IndexedDB
- ES2020+ support

## Unknowns Resolved

1. **Sandboxing**: ✅ Docker + Worker Threads approach
2. **Authentication**: ✅ JWT with refresh tokens
3. **Protocol Requirements**: ✅ WebSocket-wrapped MCP
4. **Browser Versions**: ✅ Modern browsers from 2021+
5. **Performance Targets**: ✅ Defined metrics above

## Next Steps

With all technical decisions made and unknowns resolved, proceed to Phase 1:
1. Design data models based on Rust implementation
2. Create API contracts for all endpoints
3. Define WebSocket message protocols
4. Generate test specifications

---
*Research complete. All NEEDS CLARIFICATION items resolved.*