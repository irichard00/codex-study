# Research: Environment-Based AgentConfig Configuration

**Date**: 2025-01-27
**Feature**: Simplified .env-based configuration (without migration)
**Branch**: `004-agentconfig-is-the`

## Executive Summary

The codex-chrome extension has an existing comprehensive configuration system that already supports environment variables. The task is to simplify this implementation by removing migration-related code while preserving the core .env functionality.

## Current Implementation Analysis

### 1. Existing AgentConfig Architecture

**Decision**: Keep singleton pattern with simplified initialization
**Rationale**: Singleton ensures consistent configuration across extension
**Alternatives considered**:
- Factory pattern: Rejected - unnecessary complexity
- Direct module export: Rejected - loses initialization control

### 2. Configuration Structure

**Decision**: Preserve existing `IChromeConfig` interface structure
**Rationale**: Maintains backward compatibility and clear type definitions
**Alternatives considered**:
- Flat configuration object: Rejected - loses type safety
- Dynamic schema: Rejected - harder to validate

### 3. Environment Variable Schema

**Decision**: Keep `CODEX_[SECTION]_[PROPERTY]` naming convention
**Rationale**: Clear, hierarchical, and already implemented
**Alternatives considered**:
- Dotted notation (codex.model.selected): Rejected - not standard in env vars
- Underscore prefix (_CODEX_): Rejected - no benefit

## Technical Decisions

### Build-Time vs Runtime Configuration

**Decision**: Build-time injection via Vite plugin
**Rationale**:
- Chrome extensions can't access process.env at runtime
- API keys protected from client-side exposure
- Better performance (no runtime parsing)

**Alternatives considered**:
- Runtime .env loading: Rejected - security risk with API keys
- Chrome storage only: Rejected - requires manual configuration

### Validation Strategy

**Decision**: Lightweight validation without complex Zod schemas
**Rationale**: Simplicity per user requirements
**Alternatives considered**:
- Full Zod validation: Rejected - over-engineered for current needs
- No validation: Rejected - could lead to runtime errors

### Files to Remove

Based on user requirements to remove migration code:
- `/scripts/migrate-config.js` - Migration tool
- `/scripts/env-migrator.contract.test.ts` - Migration tests
- `/tests/config/env-migrator.test.ts` - Migration unit tests
- Any migration-related imports or functions

### Files to Keep/Simplify

Core .env implementation:
- `.env.example` - Comprehensive template
- `.env.defaults` - Default values
- `/src/config/env-loader.ts` - Simplified loader
- `/src/config/env-transformer.ts` - Type transformation
- `/src/build/vite-plugin-env.ts` - Build-time injection
- `/scripts/validate-env.js` - Validation script

## Implementation Approach

### Phase 1: Cleanup
1. Remove all migration-related code
2. Simplify env-loader to remove migration logic
3. Update tests to remove migration scenarios

### Phase 2: Simplification
1. Streamline validation to essential checks only
2. Reduce complex type transformations where not needed
3. Simplify error messaging

### Phase 3: Documentation
1. Update .env.example with clear instructions
2. Remove migration references from README
3. Add simple setup guide

## Risk Assessment

### Low Risk
- Removing migration code (not yet used in production)
- Simplifying validation (can add complexity later if needed)

### Medium Risk
- Breaking existing AgentConfig initialization (mitigated by preserving core structure)
- Missing edge cases in simplified validation (mitigated by keeping essential checks)

## Security Considerations

### API Key Handling
- Never embed actual keys in build output
- Use `{{RUNTIME_REPLACE}}` placeholder pattern
- Keys loaded from Chrome storage at runtime

### Build-Time Safety
- Validate environment before build
- Clear error messages for missing configuration
- No sensitive data in logs

## Performance Impact

### Positive
- Smaller bundle size without migration code
- Faster build times with simplified validation
- Reduced memory usage

### Neutral
- Same runtime performance (config loaded once)
- No impact on extension startup time

## Conclusion

The simplification removes approximately 300-400 lines of migration-related code while preserving the core .env functionality. The resulting implementation will be:
1. Easier to maintain
2. Clearer to understand
3. Focused on essential features
4. Still fully functional for environment-based configuration

## Next Steps

1. Generate simplified data model
2. Create minimal contract definitions
3. Write quickstart guide for .env setup
4. Plan task breakdown for implementation