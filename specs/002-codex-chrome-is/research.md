# Research Document: AgentConfig Integration

## Overview
This document captures research findings for integrating AgentConfig throughout the codex-chrome extension based on patterns from codex-rs.

## Key Decisions

### 1. Singleton Pattern for Config Management
**Decision**: Use singleton instance of AgentConfig shared across all contexts
**Rationale**:
- Mirrors Arc<Config> pattern from Rust
- Ensures configuration consistency across components
- Reduces memory overhead in browser environment
- Simplifies config synchronization across Chrome extension contexts
**Alternatives considered**:
- Per-component config instances: Rejected due to synchronization complexity
- Static class: Rejected as it doesn't support async initialization well

### 2. Chrome Extension Context Communication
**Decision**: Use Chrome messaging API for config synchronization across contexts
**Rationale**:
- Service worker, content scripts, and sidepanel run in isolated contexts
- Chrome messaging is the standard IPC mechanism for extensions
- Supports async configuration updates
**Alternatives considered**:
- SharedWorker: Not supported in service workers
- BroadcastChannel: Limited browser support in extension contexts

### 3. Configuration Injection Pattern
**Decision**: Pass config via constructor parameters or initialization methods
**Rationale**:
- Explicit dependencies make testing easier
- Follows dependency injection pattern from codex-rs
- Allows for config mocking in tests
**Alternatives considered**:
- Global import: Rejected as it creates hidden dependencies
- Service locator: Rejected as anti-pattern for testability

### 4. Config Change Propagation
**Decision**: Use event emitter pattern with typed events
**Rationale**:
- AgentConfig already implements event emitter
- Components can subscribe to specific config sections
- Matches observer pattern used in codex-rs for updates
**Alternatives considered**:
- Polling: Rejected due to performance overhead
- Redux-style state management: Over-complex for config management

### 5. Storage Strategy
**Decision**: Use existing ConfigStorage with chrome.storage.local
**Rationale**:
- Already implemented and tested
- Persists across browser sessions
- Supports complex objects with JSON serialization
**Alternatives considered**:
- IndexedDB: Overkill for config data size
- localStorage: Not available in service workers

### 6. Config Validation
**Decision**: Validate on write, trust on read
**Rationale**:
- Validators already exist in validators.ts
- Prevents invalid state from persisting
- Read path stays performant
**Alternatives considered**:
- Validate on every access: Performance overhead
- No validation: Risk of runtime errors

### 7. Profile Management
**Decision**: Support profile switching at runtime
**Rationale**:
- AgentConfig already has profile support
- Matches codex-rs capability for per-turn config
- Useful for model switching scenarios
**Alternatives considered**:
- Static profiles: Less flexible for user needs
- No profiles: Limits configuration flexibility

### 8. Default Values
**Decision**: Use existing defaults.ts with mergeWithDefaults
**Rationale**:
- Already implemented and tested
- Ensures backward compatibility
- Provides sensible defaults for new installations
**Alternatives considered**:
- Required all fields: Poor user experience
- Hardcoded defaults: Harder to maintain

## Component Integration Points

### CodexAgent
- Receives config in constructor
- Uses config for: model selection, approval policy, sandbox policy
- Subscribes to model config changes

### ModelClientFactory
- Singleton instance receives config reference
- Uses config for: provider selection, API keys, model parameters
- Updates on provider configuration changes

### Session
- Receives config at initialization
- Uses config for: context window limits, user instructions
- May clone config for per-turn modifications

### TaskRunner
- Receives config through AgentTask
- Uses config for: tool availability, execution policies
- Reads config per task execution

### ToolRegistry
- Receives config at initialization
- Uses config for: tool enable/disable flags
- Rebuilds registry on tool configuration changes

### ApprovalManager
- Receives config in constructor
- Uses config for: approval policy, trusted projects
- Updates approval flow on policy changes

### Background Service Worker
- Initializes singleton config instance
- Handles config update messages from UI
- Broadcasts config changes to other contexts

### Content Scripts
- Receives config via messaging from background
- Caches config locally for performance
- Updates cache on change events

### Side Panel UI
- Accesses config for display preferences
- Provides UI for config updates
- Shows current config state to user

## Testing Strategy

### Unit Tests
- Mock AgentConfig for component tests
- Test config validation logic
- Test event emission on updates

### Integration Tests
- Test config flow across contexts
- Test persistence and recovery
- Test profile switching scenarios

### Contract Tests
- Verify config shape matches expectations
- Test backward compatibility
- Validate default merging behavior

## Performance Considerations

- Config cached in memory after first load
- Lazy initialization to avoid blocking startup
- Debounced saves to storage (already implemented)
- Minimal serialization overhead with JSON

## Security Considerations

- API keys stored in config need encryption consideration
- Config validation prevents injection attacks
- Chrome storage isolated per extension
- No sensitive data in config exports without user consent

## Migration Path

1. Update component constructors to accept config
2. Initialize singleton in background service worker
3. Add messaging handlers for cross-context sync
4. Update existing config usage to use injected instance
5. Add config change subscriptions where needed
6. Test each component with mock configs
7. Integration test full config flow

## Conclusion

The research confirms that integrating AgentConfig following codex-rs patterns is feasible and beneficial. The existing AgentConfig implementation provides most needed functionality. The main work involves wiring it through the component hierarchy and ensuring cross-context synchronization in the Chrome extension environment.