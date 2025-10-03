# Phase 1 Quickstart Guide

**Spec ID**: 009-refactor-codex-chrome
**Phase**: 1 - Design Artifacts
**Date**: 2025-10-02

## Overview

This guide provides quick verification steps for Phase 1 design artifacts. Use this to ensure all contracts and data models are correctly defined before proceeding to implementation.

---

## Prerequisites

- Node.js v22+
- TypeScript 5.x
- Chrome extension development environment
- Access to `codex-rs` source code for reference

---

## Step 1: Review Data Model Documentation

**File**: `/specs/009-refactor-codex-chrome/data-model.md`

**Verification Checklist**:

- [ ] All 13 ModelClient methods documented
- [ ] All 9 ResponseEvent variants defined
- [ ] ModelProviderInfo includes all 12 fields from Rust
- [ ] StreamAttemptError covers 3 error types
- [ ] Browser adaptations documented (fetch, ReadableStream, chrome.storage)
- [ ] Validation rules (FR-001 to FR-005) specified

**Quick Scan**:
```bash
# Count documented methods (should be 13)
grep -c "^| \`[a-z]" specs/009-refactor-codex-chrome/data-model.md

# Check ResponseEvent types (should find all 9)
grep "type: '" specs/009-refactor-codex-chrome/data-model.md | wc -l
```

---

## Step 2: Validate Contract Files

**Directory**: `/specs/009-refactor-codex-chrome/contracts/`

**Files to Check**:
1. `ModelClient.contract.ts` - Main interface contract
2. `ResponseEvent.contract.ts` - Event type definitions
3. `StreamAttemptError.contract.ts` - Error classification
4. `BrowserAdaptations.contract.ts` - Browser-specific interfaces

### 2.1 ModelClient Contract

**Verification**:
```typescript
// File: contracts/ModelClient.contract.ts

// Check interface has all 13 methods
interface IModelClient {
  // Constructor (not in interface, documented)
  // 13 methods:
  getModelContextWindow(): number | undefined;
  getAutoCompactTokenLimit(): number | undefined;
  stream(prompt: Prompt): AsyncGenerator<ResponseEvent>;
  streamResponses(prompt: Prompt): AsyncGenerator<ResponseEvent>;
  attemptStreamResponses(attempt: number, payload: ResponsesApiRequest, auth?: AuthContext): Promise<ResponseStream>;
  getProvider(): ModelProviderInfo;
  getOtelEventManager(): OtelEventManager;
  getModel(): string;
  getModelFamily(): ModelFamily;
  getReasoningEffort(): ReasoningEffortConfig | undefined;
  getReasoningSummary(): ReasoningSummaryConfig;
  getAuthManager(): ChromeAuthManager | undefined;
}

// Run validation function
validateModelClientContract(instance);
```

**Checklist**:
- [ ] All method signatures match Rust (camelCase conversion)
- [ ] Return types preserve Rust semantics (Option<T> → T | undefined)
- [ ] JSDoc comments reference Rust line numbers
- [ ] Contract validation function included

### 2.2 ResponseEvent Contract

**Verification**:
```typescript
// File: contracts/ResponseEvent.contract.ts

// Check all 9 event types
const eventTypes = [
  'Created',
  'OutputItemDone',
  'Completed',
  'OutputTextDelta',
  'ReasoningSummaryDelta',
  'ReasoningContentDelta',
  'ReasoningSummaryPartAdded',
  'WebSearchCallBegin',
  'RateLimits',
];

// Validate type names (MUST be exact case match)
for (const type of eventTypes) {
  const event: ResponseEvent = { type } as any;
  validateResponseEventType(event); // Should not throw
}

// Test type guards
const created: ResponseEvent = { type: 'Created' };
if (isCreatedEvent(created)) {
  console.log('Type guard works');
}

// Test pattern matcher
matchResponseEvent(created, {
  Created: () => console.log('Match works'),
  _: () => console.log('Default case'),
});
```

**Checklist**:
- [ ] All 9 event types defined as discriminated union
- [ ] Type names match Rust exactly (case-sensitive)
- [ ] Type guards for each variant
- [ ] Pattern matcher helper included
- [ ] SSE mapping documented in JSDoc

### 2.3 StreamAttemptError Contract

**Verification**:
```typescript
// File: contracts/StreamAttemptError.contract.ts

// Test error classification
const testCases = [
  { status: 401, expected: 'RetryableHttpError' },
  { status: 429, expected: 'RetryableHttpError' },
  { status: 500, expected: 'RetryableHttpError' },
  { status: 400, expected: 'Fatal' },
  { status: 404, expected: 'Fatal' },
];

for (const { status, expected } of testCases) {
  const error = StreamAttemptError.fromHttpResponse(status, {});
  console.assert(error.type === expected, `Status ${status} should be ${expected}`);
}

// Test backoff calculation
const error = new StreamAttemptError('RetryableTransportError');
for (let attempt = 0; attempt < 3; attempt++) {
  const delay = error.delay(attempt);
  const expectedMin = Math.pow(2, attempt) * 1000;
  const expectedMax = expectedMin + 1000;
  console.assert(delay >= expectedMin && delay <= expectedMax, `Backoff incorrect for attempt ${attempt}`);
}

// Test Retry-After override
const rateLimitError = new StreamAttemptError('RetryableHttpError', {
  statusCode: 429,
  retryAfter: 5,
});
const retryDelay = rateLimitError.delay(0);
console.assert(retryDelay === 5000, 'Retry-After should override backoff');

// Run contract validation
validateErrorClassificationContract();
validateBackoffCalculation();
```

**Checklist**:
- [ ] 3 error types defined (RetryableHttpError, RetryableTransportError, Fatal)
- [ ] `delay()` method implements exponential backoff with jitter
- [ ] `intoError()` method converts to CodexError
- [ ] HTTP status classification matches Rust
- [ ] Contract validation tests included

### 2.4 BrowserAdaptations Contract

**Verification**:
```typescript
// File: contracts/BrowserAdaptations.contract.ts

// Validate browser APIs available
validateBrowserAPIs(); // Should not throw in Chrome extension

// Test fetch wrapper
const httpClient = new FetchHttpClient();
const response = await httpClient.fetch('https://api.example.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: true }),
});
console.log('Fetch wrapper works:', response.status);

// Test stream reader
const reader = new BrowserSSEStreamReader(response.body!);
const { done, value } = await reader.read();
console.log('Stream reader works:', done, value);

// Test timeout controller
const slowPromise = new Promise(resolve => setTimeout(resolve, 5000));
try {
  await TimeoutController.withTimeout(slowPromise, 1000);
} catch (error) {
  console.log('Timeout works:', error.message);
}

// Test storage
const storage = new ChromeConfigStorage();
await storage.set('test_key', { value: 123 });
const retrieved = await storage.get('test_key');
console.assert(retrieved.value === 123, 'Storage works');

// Create default adapters
const adapters = createBrowserAdapters();
console.log('Adapters created:', adapters);
```

**Checklist**:
- [ ] FetchHttpClient wraps browser fetch API
- [ ] BrowserSSEStreamReader wraps ReadableStream
- [ ] TimeoutController implements Promise.race() timeout
- [ ] ChromeConfigStorage wraps chrome.storage.local
- [ ] ChromeAuthTokenStorage stores tokens securely
- [ ] ConsoleTelemetryManager logs to console
- [ ] Browser API validation function included

---

## Step 3: Cross-Reference with Rust Implementation

**Rust Files to Compare**:
1. `codex-rs/core/src/client.rs` (Lines 74-445) - ModelClient struct
2. `codex-rs/core/src/client_common.rs` (Lines 72-87) - ResponseEvent enum
3. `codex-rs/core/src/model_provider_info.rs` (Lines 44-89) - ModelProviderInfo
4. `codex-rs/core/src/client.rs` (Lines 447-486) - StreamAttemptError

**Verification Commands**:
```bash
# Compare ModelClient method count
grep "pub fn" codex-rs/core/src/client.rs | grep -v "pub(crate)" | wc -l
# Should match 13 methods in contract

# Compare ResponseEvent variant count
grep "^\s*[A-Z][a-zA-Z]*" codex-rs/core/src/client_common.rs | grep -v "//" | wc -l
# Should match 9 variants in contract

# Check field names match
diff <(grep "pub [a-z_]*:" codex-rs/core/src/model_provider_info.rs | awk '{print $2}' | sort) \
     <(grep "readonly [a-zA-Z]*" contracts/ModelClient.contract.ts | awk '{print $2}' | sort)
# Should show no differences (ignoring case conversion)
```

**Manual Checks**:
- [ ] Method names converted correctly (snake_case → camelCase)
- [ ] Return types match (Option<T> → T | undefined, Result<T> → Promise<T>)
- [ ] Field types match (String → string, u64 → number, bool → boolean)
- [ ] Error handling patterns equivalent (Result → try/catch)

---

## Step 4: Validate Against Acceptance Criteria

**From spec.md Acceptance Criteria**:

### AC1: Type Definitions Match Rust
```typescript
// Verify type names exact match
const rustEventTypes = [
  'Created', 'OutputItemDone', 'Completed', 'OutputTextDelta',
  'ReasoningSummaryDelta', 'ReasoningContentDelta',
  'ReasoningSummaryPartAdded', 'WebSearchCallBegin', 'RateLimits'
];

type ResponseEventType = ResponseEvent['type'];
const tsEventTypes: ResponseEventType[] = rustEventTypes as ResponseEventType[];
// No TypeScript errors = types match
```

### AC2: All 13 Methods Documented
```typescript
const requiredMethods = [
  'getModelContextWindow',
  'getAutoCompactTokenLimit',
  'stream',
  'streamResponses',
  'attemptStreamResponses',
  'getProvider',
  'getOtelEventManager',
  'getModel',
  'getModelFamily',
  'getReasoningEffort',
  'getReasoningSummary',
  'getAuthManager',
];

// Check all methods in contract
for (const method of requiredMethods) {
  const hasMethod = IModelClient.prototype[method] !== undefined;
  console.assert(hasMethod, `Missing method: ${method}`);
}
```

### AC3: Browser Adaptations Specified
```typescript
// Verify all browser adapters exist
const adapters = createBrowserAdapters();
console.assert(adapters.httpClient instanceof FetchHttpClient);
console.assert(adapters.storage instanceof ChromeConfigStorage);
console.assert(adapters.authStorage instanceof ChromeAuthTokenStorage);
console.assert(adapters.telemetry instanceof TelemetryManager);
```

### AC4: Error Classification Logic
```typescript
// Run built-in validation
validateErrorClassificationContract();
// Should complete without errors

// Test specific cases
const errors = [
  StreamAttemptError.fromHttpResponse(401, {}), // Should be retryable
  StreamAttemptError.fromHttpResponse(429, {}), // Should be retryable
  StreamAttemptError.fromHttpResponse(500, {}), // Should be retryable
  StreamAttemptError.fromHttpResponse(400, {}), // Should be fatal
];

console.assert(errors[0].isRetryable() === true);
console.assert(errors[1].isRetryable() === true);
console.assert(errors[2].isRetryable() === true);
console.assert(errors[3].isRetryable() === false);
```

### AC5: Validation Rules Documented
```bash
# Check data-model.md for validation rules
grep -A 20 "^### Constructor Validation (FR-001)" specs/009-refactor-codex-chrome/data-model.md
grep -A 10 "^### Context Window Validation (FR-002)" specs/009-refactor-codex-chrome/data-model.md
grep -A 10 "^### Auto-Compact Validation (FR-003)" specs/009-refactor-codex-chrome/data-model.md
grep -A 20 "^### Stream Dispatch Validation (FR-004)" specs/009-refactor-codex-chrome/data-model.md
grep -A 20 "^### Retry Logic Validation (FR-005)" specs/009-refactor-codex-chrome/data-model.md
```

---

## Step 5: Test Scenarios

### Scenario 1: Basic Type Safety

**Goal**: Verify TypeScript types provide compile-time safety.

```typescript
// This should compile
const event: ResponseEvent = {
  type: 'OutputTextDelta',
  delta: 'Hello world',
};

// This should NOT compile (wrong field name)
const invalidEvent: ResponseEvent = {
  type: 'OutputTextDelta',
  text: 'Hello world', // Error: 'text' does not exist, should be 'delta'
};

// This should NOT compile (invalid type)
const invalidType: ResponseEvent = {
  type: 'InvalidType', // Error: Type '"InvalidType"' is not assignable
};
```

### Scenario 2: Error Classification

**Goal**: Verify error classification matches Rust logic.

```typescript
// Test all HTTP status codes
const testCases = [
  { status: 200, shouldRetry: false },
  { status: 400, shouldRetry: false },
  { status: 401, shouldRetry: true },
  { status: 403, shouldRetry: false },
  { status: 404, shouldRetry: false },
  { status: 429, shouldRetry: true },
  { status: 500, shouldRetry: true },
  { status: 502, shouldRetry: true },
  { status: 503, shouldRetry: true },
];

for (const { status, shouldRetry } of testCases) {
  const error = StreamAttemptError.fromHttpResponse(status, {});
  const isRetryable = error.isRetryable();
  console.assert(
    isRetryable === shouldRetry,
    `Status ${status}: expected ${shouldRetry}, got ${isRetryable}`
  );
}
```

### Scenario 3: Backoff Calculation

**Goal**: Verify exponential backoff with jitter.

```typescript
const error = new StreamAttemptError('RetryableTransportError');

// Test exponential growth: 1s, 2s, 4s, 8s, 16s
const expectedBases = [1000, 2000, 4000, 8000, 16000];

for (let attempt = 0; attempt < 5; attempt++) {
  const delay = error.delay(attempt);
  const base = expectedBases[attempt];
  const min = base;
  const max = base + 1000; // jitter

  console.assert(
    delay >= min && delay <= max,
    `Attempt ${attempt}: expected ${min}-${max}ms, got ${delay}ms`
  );
}
```

### Scenario 4: Browser API Availability

**Goal**: Verify browser APIs are available in Chrome extension context.

```typescript
try {
  validateBrowserAPIs();
  console.log('✓ All browser APIs available');
} catch (error) {
  console.error('✗ Missing browser APIs:', error.message);
  // Should not happen in Chrome extension
}

// Test individual APIs
console.assert(typeof fetch !== 'undefined', 'fetch API missing');
console.assert(typeof ReadableStream !== 'undefined', 'ReadableStream missing');
console.assert(typeof chrome?.storage !== 'undefined', 'chrome.storage missing');
```

### Scenario 5: Type Guard Usage

**Goal**: Verify type guards narrow types correctly.

```typescript
function handleEvent(event: ResponseEvent) {
  if (isOutputTextDeltaEvent(event)) {
    // TypeScript knows event.delta exists
    console.log(event.delta); // OK
    // console.log(event.item); // Error: Property 'item' does not exist
  }

  if (isOutputItemDoneEvent(event)) {
    // TypeScript knows event.item exists
    console.log(event.item); // OK
    // console.log(event.delta); // Error: Property 'delta' does not exist
  }

  // Pattern matching
  matchResponseEvent(event, {
    OutputTextDelta: (delta) => console.log('Text:', delta),
    OutputItemDone: (item) => console.log('Item:', item),
    _: () => console.log('Other event'),
  });
}
```

---

## Step 6: Documentation Review

**Files to Review**:
1. `data-model.md` - Complete data model documentation
2. `contracts/*.ts` - All contract files with JSDoc
3. `quickstart.md` - This file

**Checklist**:
- [ ] All public APIs documented with JSDoc
- [ ] Rust references included (file:line format)
- [ ] Browser adaptations explained
- [ ] Validation rules specified
- [ ] Test scenarios provided
- [ ] Type safety examples included

---

## Common Issues and Solutions

### Issue 1: Type Name Mismatch

**Symptom**: TypeScript errors like "Type 'created' is not assignable to type 'Created'"

**Solution**: Ensure event type names use exact PascalCase from Rust:
```typescript
// Wrong
{ type: 'created' }
{ type: 'output_text_delta' }

// Correct
{ type: 'Created' }
{ type: 'OutputTextDelta' }
```

### Issue 2: Missing Browser APIs

**Symptom**: "fetch is not defined" or "chrome is not defined"

**Solution**: Ensure code runs in Chrome extension context:
```typescript
// Check environment
if (typeof chrome === 'undefined' || !chrome.storage) {
  throw new Error('Must run in Chrome extension context');
}
```

### Issue 3: Backoff Too Long

**Symptom**: Retry delays exceed expected range

**Solution**: Verify jitter calculation:
```typescript
// Correct formula
const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;

// Not: Math.pow(2, attempt + 1) * 1000 (off by one)
```

### Issue 4: Contract Validation Fails

**Symptom**: `validateModelClientContract()` throws error

**Solution**: Ensure all 13 methods implemented:
```typescript
class ModelClient implements IModelClient {
  getModelContextWindow() { /* ... */ }
  getAutoCompactTokenLimit() { /* ... */ }
  // ... all 13 methods
}
```

---

## Next Steps

After completing this quickstart:

1. **Phase 2**: Implement ModelClient class using contracts
2. **Phase 3**: Implement SSE processing with timeout handling
3. **Phase 4**: Add retry logic and error handling
4. **Phase 5**: Write integration tests

**Reference Documents**:
- `spec.md` - Full specification with requirements
- `plan.md` - Implementation plan and phases
- `research.md` - Rust implementation analysis

---

## Verification Checklist

Use this final checklist to confirm Phase 1 completion:

- [ ] `data-model.md` created with all entities documented
- [ ] `ModelClient.contract.ts` created with 13 methods
- [ ] `ResponseEvent.contract.ts` created with 9 event types
- [ ] `StreamAttemptError.contract.ts` created with 3 error types
- [ ] `BrowserAdaptations.contract.ts` created with all adapters
- [ ] All type names match Rust exactly (case-sensitive)
- [ ] All methods have JSDoc with Rust references
- [ ] Browser adaptations specified (fetch, ReadableStream, chrome.storage)
- [ ] Error classification logic documented
- [ ] Validation rules specified (FR-001 to FR-005)
- [ ] Type guards implemented
- [ ] Contract validation functions included
- [ ] Test scenarios documented
- [ ] Cross-referenced with Rust implementation

**Sign-off**: Phase 1 complete when all items checked ✓

---

## Support

For questions or issues:
1. Review `research.md` for Rust implementation details
2. Check `spec.md` for requirements and acceptance criteria
3. Refer to Rust source code: `codex-rs/core/src/client.rs`
4. Compare with existing TypeScript: `codex-chrome/src/models/OpenAIResponsesClient.ts`
