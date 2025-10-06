# Legacy Code to Remove

**Purpose**: Document all code without Rust equivalents for removal
**Requirement**: FR-025, FR-026, FR-027 - Remove legacy code, no backward compatibility
**Source Reference**: `codex-rs/core/src/client.rs`

## Removal Strategy

1. **Identify** files/code without Rust equivalents
2. **Verify** no dependencies in current codebase
3. **Document** any migration needed
4. **Remove** completely (no deprecation period)

## Files to Remove

### 1. AnthropicClient.ts
**Location**: `src/models/AnthropicClient.ts`
**Reason**: No Anthropic support in Rust client.rs
**Rust Equivalent**: None
**Dependencies**: Check ModelClientFactory.ts for references
**Action**: DELETE entire file + all imports/references

**Verification**:
```bash
grep -r "AnthropicClient" src/ tests/
```

### 2. RequestQueue.ts
**Location**: `src/models/RequestQueue.ts`
**Reason**: Rust handles concurrency differently (no explicit queue in client.rs)
**Rust Equivalent**: None (uses tokio async/await directly)
**Dependencies**: Check if used in OpenAIResponsesClient
**Action**: DELETE if not in Rust, or verify if it exists elsewhere in codex-rs

**Verification**:
```bash
# Check if RequestQueue exists in Rust codebase
grep -r "RequestQueue\|request_queue" codex-rs/
```

**Note**: If found in Rust (but not in client.rs), may need to keep but align

### 3. RateLimitManager.ts (if exists)
**Location**: `src/models/RateLimitManager.ts`
**Reason**: Rate limiting handled inline in Rust (parse_rate_limit_snapshot)
**Rust Equivalent**: Inline parsing (lines 580-619)
**Action**: DELETE - rate limits parsed in parseRateLimitSnapshot() method

### 4. TokenUsageTracker.ts (if exists)
**Location**: `src/models/TokenUsageTracker.ts`
**Reason**: May not be in client.rs (check if in other Rust files)
**Rust Equivalent**: Unknown - needs verification
**Action**:
1. Search codex-rs for token_usage_tracker or similar
2. If not found: DELETE
3. If found elsewhere: Keep but verify alignment

**Verification**:
```bash
grep -r "TokenUsageTracker\|token_usage_tracker" codex-rs/
```

## Deprecated Method Names

### In ModelClient.ts

| Deprecated Name | New Name | Reason |
|----------------|----------|--------|
| `getContextWindow()` | `getModelContextWindow()` | FR-001: Match Rust naming |
| `getTokenLimit()` | `getAutoCompactTokenLimit()` | FR-001: Match Rust naming |

**Action**:
1. Search codebase for old names
2. Update all call sites to new names
3. Remove old methods (no aliases)

**Verification**:
```bash
grep -r "getContextWindow\|getTokenLimit" src/
```

### In OpenAIResponsesClient.ts

Check for any methods not in Rust:
- Any custom retry logic → DELETE (use Rust backoff() only)
- Any caching logic → DELETE (unless in Rust)
- Any custom header logic → DELETE (unless in Rust)

## Deprecated Type Definitions

### camelCase Field Types

**Issue**: Old types may use camelCase fields (e.g., `inputTokens` instead of `input_tokens`)

**Files to Check**:
- `src/models/types/TokenUsage.ts`
- `src/models/types/RateLimits.ts`
- `src/models/types/ResponseEvent.ts`
- Any other type files

**Action**:
1. Search for camelCase field patterns
2. Verify against Rust serde serialization (snake_case)
3. Remove old camelCase type aliases
4. Update all imports/usage

**Verification**:
```bash
# Look for camelCase fields in type definitions
grep -E "(inputTokens|outputTokens|cachedTokens|usedPercent|windowMinutes)" src/models/types/
```

## Custom Implementations to Verify/Remove

### 1. Custom Retry Logic Variations

**Check**: Any retry logic that differs from Rust backoff()

**Rust Pattern** (lines 245-264):
```rust
for attempt in 0..=max_attempts {
    match attempt_stream() {
        Ok(stream) => return Ok(stream),
        Err(Fatal(e)) => return Err(e),
        Err(retryable) => {
            if attempt == max_attempts { return Err(...) }
            sleep(retryable.delay(attempt)).await;
        }
    }
}
```

**Action**: Remove any custom retry implementations that don't match this pattern

### 2. Custom SSE Parsing

**Check**: Any SSE parsing logic that differs from Rust (lines 637-860)

**Rust Pattern**:
- Parse "data: " prefix
- Check for [DONE]
- Store response.completed, yield at end
- Map event types exactly

**Action**: Remove any alternative SSE parsing implementations

### 3. Custom Error Handling

**Check**: Any error types not in StreamAttemptError enum

**Rust Pattern** (lines 457-499):
- RetryableHttpError
- RetryableTransportError
- Fatal

**Action**: Remove any custom error types/handling

## Files to Review for Legacy Code

### High Priority (Likely to Remove)
- [x] `src/models/AnthropicClient.ts` - No Rust equivalent
- [ ] `src/models/RequestQueue.ts` - Verify against Rust
- [ ] `src/models/RateLimitManager.ts` - Likely removed (inline in Rust)
- [ ] `src/models/TokenUsageTracker.ts` - Verify against Rust

### Medium Priority (Check for Deprecated Methods)
- [ ] `src/models/ModelClient.ts` - Remove deprecated method names
- [ ] `src/models/OpenAIResponsesClient.ts` - Remove custom logic
- [ ] `src/models/OpenAIClient.ts` - Verify alignment with Rust Chat support

### Low Priority (Likely Keep but Align)
- [ ] `src/models/ResponseStream.ts` - Keep, align with Rust
- [ ] `src/models/SSEEventParser.ts` - Keep, align with Rust
- [ ] `src/models/ModelClientError.ts` - Keep, align with Rust CodexErr

## Type Files to Review

### Check for camelCase → snake_case Conversion
- [ ] `src/models/types/TokenUsage.ts`
- [ ] `src/models/types/RateLimits.ts`
- [ ] `src/models/types/ResponseEvent.ts`
- [ ] `src/models/types/ResponsesAPI.ts`
- [ ] `src/models/types/StreamAttemptError.ts`

**Action**: Remove old camelCase versions after updating to snake_case

## Removal Checklist

Before removing any file/code:

1. **Search for usages**:
   ```bash
   grep -r "FileName\|functionName" src/ tests/
   ```

2. **Check imports**:
   ```bash
   grep -r "from.*FileName\|import.*functionName" src/
   ```

3. **Verify no Rust equivalent**:
   ```bash
   grep -r "similar_name" codex-rs/
   ```

4. **Document impact**:
   - List files that import the removed code
   - Note any tests that need updating
   - Identify any calling code to refactor

5. **Remove completely**:
   - Delete file
   - Remove all imports
   - Update tests
   - No backward compatibility shims

## Migration Path for Removed Features

### If AnthropicClient is removed:
- Users must use OpenAI or future providers
- No Anthropic support until Rust adds it
- Update ModelClientFactory to only support available providers

### If RequestQueue is removed:
- Concurrency handled via browser's natural async/await
- No explicit queueing (matches Rust approach)
- Update any code relying on queue behavior

### If custom retry logic is removed:
- All retry logic uses Rust backoff() pattern
- Exponential backoff with jitter
- Retry-After header respected
- No custom retry strategies

## Verification Commands

### Find files not in Rust:
```bash
# List all TypeScript files in models
find src/models -name "*.ts" -type f

# Compare with Rust client.rs structure
# Manually verify each file has Rust equivalent
```

### Find deprecated method calls:
```bash
grep -r "getContextWindow(" src/ tests/
grep -r "getTokenLimit(" src/ tests/
```

### Find camelCase fields:
```bash
grep -rE "(inputTokens|outputTokens|cachedTokens|usedPercent)" src/models/types/
```

### Find legacy imports:
```bash
grep -r "AnthropicClient\|RequestQueue\|RateLimitManager\|TokenUsageTracker" src/
```

## Summary

**Confirmed Removals** (no backward compatibility):
1. ✅ AnthropicClient.ts - No Rust equivalent
2. ⏳ RequestQueue.ts - Verify first
3. ⏳ RateLimitManager.ts - Likely removed (inline parsing)
4. ⏳ TokenUsageTracker.ts - Verify first

**Method Renames** (no aliases):
1. ✅ getContextWindow() → getModelContextWindow()
2. ✅ getTokenLimit() → getAutoCompactTokenLimit()

**Type Updates** (no backward compatibility):
1. ✅ All fields: camelCase → snake_case
2. ✅ Remove old camelCase type definitions

**Custom Logic Removals**:
1. ✅ Any retry logic != Rust backoff()
2. ✅ Any SSE parsing != Rust process_sse()
3. ✅ Any error handling != StreamAttemptError pattern

---

**Next Steps**:
1. Verify each file marked ⏳ against codex-rs
2. Execute removals in Phase 3.5 (Tasks T050-T055)
3. Update all imports and calling code
4. Run tests to verify nothing breaks
5. No rollback plan needed (FR-026: no backward compatibility)
