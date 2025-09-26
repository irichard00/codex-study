# Research: Config Refactoring for Chrome Extension

## Executive Summary
This document captures research findings for refactoring the config system from codex-rs (terminal-based) to codex-chrome (Chrome extension). The main challenge is adapting a file-based configuration system to Chrome's storage APIs while removing terminal-specific features.

## Key Decisions

### 1. Storage Mechanism
**Decision**: Use Chrome storage.sync API for primary config storage with storage.local fallback

**Rationale**:
- storage.sync provides automatic synchronization across user's devices
- 100KB total quota is sufficient for config data
- Fallback to storage.local for large data or when sync fails

**Alternatives Considered**:
- IndexedDB: Too complex for simple key-value config
- localStorage: Not available in service workers (Manifest V3)
- File system access: Not appropriate for extensions

### 2. Config Properties to Remove
**Decision**: Remove the following terminal-specific configs from codex-rs:

**Removed Configs**:
- `mcp_servers`: MCP (Model Context Protocol) server configurations - not applicable to browser context
- `sandbox_policy`: Linux sandbox and seccomp filters - browser has its own sandboxing
- `shell_environment_policy`: Shell environment variables - no shell access in browser
- `codex_home`: File system home directory - use Chrome storage instead
- `project_doc_max_bytes`: File-based project docs - not applicable
- `codex_linux_sandbox_exe`: Linux sandbox executable path
- `notify`: External command notification system
- `tui_notifications`: Terminal UI notifications
- `file_opener`: URI-based file opener for terminals
- `disable_paste_burst`: Terminal paste detection
- `history` file persistence: File-based history storage
- `experimental_instructions_file`: File path for instructions
- `approval_policy` (terminal commands): Command approval not needed in browser
- `use_experimental_streamable_shell_tool`: Shell-specific
- `use_experimental_unified_exec_tool`: Execution tools for terminal

**Rationale**: These features are either terminal-specific, file-system dependent, or security models that don't apply to browser environments.

### 3. Config Properties to Retain
**Decision**: Keep and adapt the following configs for Chrome:

**Retained Configs**:
- `model`: Selected AI model
- `review_model`: Model for review operations
- `model_family`: Model categorization
- `model_context_window`: Token window size
- `model_max_output_tokens`: Output token limit
- `model_auto_compact_token_limit`: Auto-compaction threshold
- `model_provider_id`: Provider identifier (openai, anthropic)
- `model_provider`: Provider configuration with API details
- `model_providers`: Map of available providers
- `model_reasoning_effort`: Reasoning effort level
- `model_reasoning_summary`: Summary generation settings
- `model_verbosity`: Output verbosity control
- `tools_web_search_request`: Web search capability toggle
- `include_view_image_tool`: Image viewing capability
- `active_profile`: Current configuration profile
- `profiles`: Named configuration profiles

**Rationale**: These are model and API configurations that remain relevant in browser context.

### 4. New Chrome-Specific Configs
**Decision**: Add Chrome extension specific configurations:

**New Configs**:
- `extension_enabled`: Master on/off switch
- `auto_sync`: Enable/disable settings sync
- `cache_ttl`: Cache time-to-live for API responses
- `api_timeout`: API request timeout settings
- `content_script_enabled`: Enable content script injection
- `allowed_origins`: CORS allowed origins for API calls
- `storage_quota_warning`: Threshold for storage warnings
- `telemetry_enabled`: Usage telemetry opt-in

**Rationale**: Chrome extensions need browser-specific controls for permissions, storage, and network behavior.

### 5. Migration Strategy
**Decision**: Implement automatic migration from current ModelClientFactory storage

**Approach**:
1. Check for existing keys in storage (openai_api_key, anthropic_api_key, etc.)
2. Map old keys to new ChromeConfig structure
3. Preserve user's API keys and model selection
4. Clean up old storage keys after successful migration
5. Version the config schema for future migrations

**Rationale**: Ensures smooth upgrade path for existing users without data loss.

### 6. Chrome Storage Constraints
**Research Findings**:
- **storage.sync limits**:
  - 100KB total storage
  - 8KB per item
  - 512 items maximum
  - 1,800 operations per hour
- **storage.local limits**:
  - 10MB total storage (can request unlimited)
  - No per-item limits
  - No sync across devices

**Design Implications**:
- Split large configs into multiple storage keys if needed
- Use compression for large profile data
- Implement caching to reduce storage operations
- Monitor quota usage and warn users

### 7. API Compatibility
**Decision**: Maintain backward compatibility with existing ModelClientFactory interface

**Approach**:
- ChromeConfig wraps storage operations
- Existing code continues using ModelClientFactory methods
- Gradual migration to new config API
- Deprecation warnings for old methods

**Rationale**: Allows incremental refactoring without breaking existing functionality.

## Technical Architecture

### Config Class Hierarchy
```
ChromeConfig (main class)
├── ConfigStorage (storage abstraction)
├── ConfigMigration (handles upgrades)
├── ConfigDefaults (default values)
└── ConfigTypes (TypeScript interfaces)
```

### Storage Schema
```typescript
{
  version: "1.0.0",
  model: {
    selected: string,
    provider: string,
    settings: ModelSettings
  },
  providers: {
    [key: string]: ProviderConfig
  },
  profiles: {
    [name: string]: ProfileConfig
  },
  preferences: UserPreferences,
  cache: CacheSettings
}
```

## Risks and Mitigations

### Risk 1: Storage Quota Exceeded
**Mitigation**: Implement quota monitoring, data compression, and old data cleanup

### Risk 2: Sync Conflicts
**Mitigation**: Implement conflict resolution with timestamp-based last-write-wins

### Risk 3: Migration Failure
**Mitigation**: Backup old config before migration, provide manual recovery option

### Risk 4: Performance Impact
**Mitigation**: Lazy loading, caching, and batch operations for storage access

## Validation Approach
- Unit tests with mocked Chrome storage
- Integration tests with real Chrome extension environment
- Migration tests with various legacy config scenarios
- Performance benchmarks for storage operations
- User acceptance testing with config UI

## Next Steps
With research complete, Phase 1 will design the specific contracts and data models for the new ChromeConfig system, ensuring clean interfaces and testability.