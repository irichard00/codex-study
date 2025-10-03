# Tasks: Align codex-chrome Model Client with codex-rs

**Input**: Design documents from `/specs/009-refactor-codex-chrome/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md
**Tech Stack**: TypeScript 5.9, Vitest 3.2, Chrome Extension Manifest V3
**Target**: Refactor `codex-chrome/src/models/` to match `codex-rs/core/src/client.rs`

## Execution Flow Summary

This is a **refactoring task** (behavior preservation), not new features:
1. Run existing tests to establish baseline
2. Create contract tests (TDD - expected to fail)
3. Refactor incrementally: Types → Base Classes → Implementations
4. Verify tests pass after each phase
5. Update documentation

**Critical**: This is NOT test-driven development for new features. We're refactoring existing working code, so:
- Existing tests must pass before and after
- Contract tests validate new structure matches Rust
- No behavior changes - only naming and structure alignment

---

## Phase 3.1: Pre-Refactoring Setup

### T001: Establish Test Baseline ✅
**Type**: Setup
**Files**: Run existing test suite
**Description**: Run all existing tests in `codex-chrome/src/models/__tests__/` to establish baseline. Document current pass/fail status. This ensures refactoring preserves behavior.

**Commands**:
```bash
cd codex-chrome
npm test src/models/__tests__/
```

**Success Criteria**:
- All existing tests documented (pass count, fail count)
- Baseline captured for comparison after refactoring
- Any existing failures noted separately

**Dependencies**: None

---

### T002 [P]: Create Contract Test - ModelClient Interface ✅
**Type**: Contract Test
**Files**: Create `codex-chrome/tests/contract/ModelClient.test.ts`
**Description**: Create contract test validating ModelClient interface matches Rust implementation. Test should verify all 13 methods exist with correct signatures. Use contract from `specs/009-refactor-codex-chrome/contracts/ModelClient.contract.ts`.

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';
import { validateModelClientContract } from '../../specs/009-refactor-codex-chrome/contracts/ModelClient.contract';

describe('ModelClient Contract Compliance', () => {
  it('should have all 13 methods matching Rust client.rs', () => {
    // Test will initially fail - that's expected
    const client = new ModelClient(mockConfig);
    expect(() => validateModelClientContract(client)).not.toThrow();
  });

  it('should have getModelContextWindow() matching Rust', () => {
    const client = new ModelClient(mockConfig);
    expect(client.getModelContextWindow).toBeDefined();
    expect(typeof client.getModelContextWindow()).toBe('number' || 'undefined');
  });

  // ... 11 more method tests
});
```

**Success Criteria**:
- Test file created at `codex-chrome/tests/contract/ModelClient.test.ts`
- Tests FAIL initially (expected - we haven't refactored yet)
- All 13 methods tested
- Line references to Rust code included in comments

**Dependencies**: None (can run in parallel)

---

### T003 [P]: Create Contract Test - ResponseEvent Types ✅
**Type**: Contract Test
**Files**: Create `codex-chrome/tests/contract/ResponseEvent.test.ts`
**Description**: Create contract test validating ResponseEvent discriminated union matches Rust enum. Test all 9 event type variants. Use contract from `specs/009-refactor-codex-chrome/contracts/ResponseEvent.contract.ts`.

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';
import { isResponseEvent, matchResponseEvent } from '../../specs/009-refactor-codex-chrome/contracts/ResponseEvent.contract';

describe('ResponseEvent Contract Compliance', () => {
  it('should recognize all 9 event types', () => {
    const events = [
      { type: 'Created' },
      { type: 'OutputItemDone', item: mockItem },
      { type: 'Completed', responseId: 'id', tokenUsage: mockUsage },
      { type: 'OutputTextDelta', delta: 'text' },
      { type: 'ReasoningContentDelta', delta: 'reasoning' },
      { type: 'ReasoningSummaryDelta', delta: 'summary' },
      { type: 'ReasoningSummaryPartAdded' },
      { type: 'WebSearchCallBegin', callId: 'call-1' },
      { type: 'RateLimits', snapshot: mockSnapshot }
    ];

    events.forEach(event => {
      expect(isResponseEvent(event)).toBe(true);
    });
  });

  it('should match event types correctly with pattern matcher', () => {
    const result = matchResponseEvent(mockEvent, {
      Created: () => 'created',
      OutputItemDone: (item) => `item: ${item}`,
      // ... other matchers
    });
    expect(result).toBeDefined();
  });
});
```

**Success Criteria**:
- Test file created at `codex-chrome/tests/contract/ResponseEvent.test.ts`
- Tests verify all 9 event types
- Type guards tested
- Pattern matcher tested

**Dependencies**: None (can run in parallel)

---

### T004 [P]: Create Contract Test - StreamAttemptError Classification ✅
**Type**: Contract Test
**Files**: Create `codex-chrome/tests/contract/StreamAttemptError.test.ts`
**Description**: Create contract test validating error classification matches Rust StreamAttemptError enum. Test retry logic, backoff calculation, and error type detection. Use contract from `specs/009-refactor-codex-chrome/contracts/StreamAttemptError.contract.ts`.

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';
import { StreamAttemptError } from '../../specs/009-refactor-codex-chrome/contracts/StreamAttemptError.contract';

describe('StreamAttemptError Contract Compliance', () => {
  it('should classify HTTP errors correctly', () => {
    // Retryable errors
    expect(StreamAttemptError.fromHttpStatus(429).isRetryable()).toBe(true);
    expect(StreamAttemptError.fromHttpStatus(500).isRetryable()).toBe(true);
    expect(StreamAttemptError.fromHttpStatus(503).isRetryable()).toBe(true);

    // Fatal errors
    expect(StreamAttemptError.fromHttpStatus(400).isRetryable()).toBe(false);
    expect(StreamAttemptError.fromHttpStatus(404).isRetryable()).toBe(false);

    // Special cases
    expect(StreamAttemptError.fromHttpStatus(401).isRetryable()).toBe(true); // Auth refresh
  });

  it('should calculate backoff delay matching Rust formula', () => {
    const error = StreamAttemptError.retryableHttp(429);

    // Rust formula: 2^n * 1000ms + jitter
    const delay0 = error.delay(0); // 1000ms + jitter
    const delay1 = error.delay(1); // 2000ms + jitter
    const delay2 = error.delay(2); // 4000ms + jitter

    expect(delay0).toBeGreaterThanOrEqual(1000);
    expect(delay0).toBeLessThan(1500); // 1000 + 50% max jitter

    expect(delay1).toBeGreaterThanOrEqual(2000);
    expect(delay1).toBeLessThan(3000);
  });

  it('should convert to CodexError correctly', () => {
    const error = StreamAttemptError.fatal(new Error('test'));
    const codexError = error.intoError();
    expect(codexError).toBeInstanceOf(Error);
  });
});
```

**Success Criteria**:
- Test file created at `codex-chrome/tests/contract/StreamAttemptError.test.ts`
- HTTP status classification tested (401, 429, 4xx, 5xx)
- Backoff delay formula validated against Rust
- Error conversion tested

**Dependencies**: None (can run in parallel)

---

### T005 [P]: Create Contract Test - Browser Adaptations ✅
**Type**: Contract Test
**Files**: Create `codex-chrome/tests/contract/BrowserAdaptations.test.ts`
**Description**: Create contract test validating browser-specific adaptations preserve Rust behavior. Test fetch() vs reqwest, ReadableStream vs tokio::mpsc, chrome.storage vs fs. Use contract from `specs/009-refactor-codex-chrome/contracts/BrowserAdaptations.contract.ts`.

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';

describe('Browser Adaptations Contract Compliance', () => {
  it('should use fetch() with same request structure as Rust reqwest', () => {
    // Verify headers match Rust implementation
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key',
      'OpenAI-Beta': 'responses=experimental',
      'conversation_id': 'conv-123',
      'session_id': 'conv-123',
      'Accept': 'text/event-stream',
    };

    // Rust adds chatgpt-account-id header conditionally
    // TypeScript should match this behavior
  });

  it('should use ReadableStream with same event parsing as Rust', () => {
    // Test SSE parsing maintains same event structure
    const mockSSE = 'event: response.output_item.done\ndata: {"type":"message"}\n\n';
    // Should parse to same ResponseEvent as Rust
  });

  it('should use chrome.storage with same auth interface as Rust fs', () => {
    // Test auth storage maintains same interface
    // getAuth() and setAuth() should match Rust behavior
  });
});
```

**Success Criteria**:
- Test file created at `codex-chrome/tests/contract/BrowserAdaptations.test.ts`
- fetch() request structure validated
- ReadableStream SSE parsing validated
- chrome.storage auth interface validated

**Dependencies**: None (can run in parallel)

---

### T006: Run Contract Tests (Expected Failures) ✅
**Type**: Validation
**Files**: Run all contract tests created in T002-T005
**Description**: Run all contract tests to verify they fail (as expected). Document failure points - these show what needs to be refactored. This establishes the "red" state in TDD.

**Commands**:
```bash
cd codex-chrome
npm test tests/contract/
```

**Success Criteria**:
- All contract tests run
- All contract tests FAIL (expected - code not refactored yet)
- Failure points documented for each test
- Failures indicate specific mismatches with Rust

**Dependencies**: T002, T003, T004, T005 must be complete

---

## Phase 3.2: Core Type Refactoring

**Note**: These tasks refactor type definitions. Since they're in different files, they can run in parallel [P].

### T007 [P]: Align ResponseEvent Type Names ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/types/ResponseEvent.ts`
**Description**: Verify ResponseEvent type already matches Rust. According to `codex-chrome/src/models/types/ResponsesAPI.ts` lines 10-19, the type already exists and matches Rust exactly. Document this in comments with Rust line references.

**Changes**:
```typescript
// File: codex-chrome/src/models/types/ResponsesAPI.ts
// Lines 10-19 already match Rust protocol.rs ResponseEvent enum

/**
 * Response events emitted during model streaming
 * Preserves exact naming from Rust's ResponseEvent enum
 * Rust Reference: codex-rs/core/src/client_common.rs Lines 72-87
 */
export type ResponseEvent =
  | { type: 'Created' }  // Rust: Created
  | { type: 'OutputItemDone'; item: ResponseItem }  // Rust: OutputItemDone(ResponseItem)
  | { type: 'Completed'; responseId: string; tokenUsage?: TokenUsage }  // Rust: Completed
  | { type: 'OutputTextDelta'; delta: string }  // Rust: OutputTextDelta(String)
  | { type: 'ReasoningContentDelta'; delta: string }  // Rust: ReasoningContentDelta
  | { type: 'ReasoningSummaryDelta'; delta: string }  // Rust: ReasoningSummaryDelta
  | { type: 'ReasoningSummaryPartAdded' }  // Rust: ReasoningSummaryPartAdded
  | { type: 'WebSearchCallBegin'; callId: string }  // Rust: WebSearchCallBegin
  | { type: 'RateLimits'; snapshot: RateLimitSnapshot };  // Rust: RateLimits
```

**Success Criteria**:
- ResponseEvent type verified to match Rust
- JSDoc comments added with Rust line references
- No changes needed (already aligned)
- Re-export from `types/index.ts` if needed

**Dependencies**: None (can run in parallel)

---

### T008 [P]: Align TokenUsage Type ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/types/TokenUsage.ts`
**Description**: Verify TokenUsage interface matches Rust TokenUsage struct. Add Rust line references and ensure field names match exactly (snake_case in Rust → camelCase in TS).

**Expected Structure** (matching Rust):
```typescript
/**
 * Token usage statistics from model response
 * Rust Reference: codex-rs/protocol/src/protocol.rs TokenUsage struct
 */
export interface TokenUsage {
  /** Number of input tokens */
  input_tokens: number;  // Matches Rust: input_tokens

  /** Number of cached input tokens (from prompt caching) */
  cached_input_tokens: number;  // Matches Rust: cached_input_tokens

  /** Number of output tokens */
  output_tokens: number;  // Matches Rust: output_tokens

  /** Number of reasoning tokens (for reasoning models) */
  reasoning_output_tokens: number;  // Matches Rust: reasoning_output_tokens

  /** Total tokens used */
  total_tokens: number;  // Matches Rust: total_tokens
}
```

**Success Criteria**:
- TokenUsage field names match Rust exactly
- JSDoc comments added with field descriptions
- Rust line references added
- Type exported from `types/index.ts`

**Dependencies**: None (can run in parallel)

---

### T009 [P]: Align RateLimitSnapshot Type ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/types/RateLimits.ts`
**Description**: Verify RateLimitSnapshot and RateLimitWindow interfaces match Rust structs. Add Rust line references and ensure field names match (snake_case conversion).

**Expected Structure** (matching Rust):
```typescript
/**
 * Rate limit window information
 * Rust Reference: codex-rs/protocol/src/protocol.rs RateLimitWindow struct
 */
export interface RateLimitWindow {
  used_percent: number;
  window_minutes?: number | null;
  resets_in_seconds?: number | null;
}

/**
 * Complete rate limit snapshot with primary and secondary windows
 * Rust Reference: codex-rs/protocol/src/protocol.rs RateLimitSnapshot struct
 */
export interface RateLimitSnapshot {
  primary?: RateLimitWindow | null;
  secondary?: RateLimitWindow | null;
}
```

**Success Criteria**:
- Field names use snake_case to match Rust
- Optional fields marked correctly
- Rust line references added
- Type exported from `types/index.ts`

**Dependencies**: None (can run in parallel)

---

### T010 [P]: Create StreamAttemptError Type ✅
**Type**: New File Creation
**Files**: Create `codex-chrome/src/models/types/StreamAttemptError.ts`
**Description**: Create new StreamAttemptError type matching Rust enum. This is internal error classification for retry logic. Use implementation from `specs/009-refactor-codex-chrome/contracts/StreamAttemptError.contract.ts` as reference.

**Implementation**:
```typescript
/**
 * Internal error classification for stream retry logic
 * Rust Reference: codex-rs/core/src/client.rs Lines 447-486
 */
export class StreamAttemptError extends Error {
  readonly type: 'RetryableHttp' | 'RetryableTransport' | 'Fatal';
  readonly status?: number;
  readonly retryAfter?: number;
  readonly cause?: Error;

  private constructor(
    type: 'RetryableHttp' | 'RetryableTransport' | 'Fatal',
    message: string,
    options?: { status?: number; retryAfter?: number; cause?: Error }
  ) {
    super(message);
    this.type = type;
    this.status = options?.status;
    this.retryAfter = options?.retryAfter;
    this.cause = options?.cause;
    this.name = 'StreamAttemptError';
  }

  static retryableHttp(status: number, retryAfter?: number): StreamAttemptError {
    return new StreamAttemptError('RetryableHttp', `HTTP ${status}`, { status, retryAfter });
  }

  static retryableTransport(error: Error): StreamAttemptError {
    return new StreamAttemptError('RetryableTransport', error.message, { cause: error });
  }

  static fatal(error: Error): StreamAttemptError {
    return new StreamAttemptError('Fatal', error.message, { cause: error });
  }

  /**
   * Calculate backoff delay matching Rust formula: 2^attempt * 1000ms + jitter
   * Rust Reference: Lines 458-471
   */
  delay(attempt: number): number {
    if (this.type === 'RetryableHttp' && this.retryAfter) {
      // Use server-provided retry-after with minimal jitter
      const jitter = this.retryAfter * 0.1;
      return this.retryAfter + Math.random() * jitter;
    }

    // Exponential backoff: 2^(attempt+1) * 1000ms
    const baseDelay = Math.pow(2, attempt + 1) * 1000;
    const jitter = baseDelay * 0.1;
    return baseDelay + Math.random() * jitter;
  }

  /**
   * Convert to CodexError for throwing
   * Rust Reference: Lines 473-485
   */
  intoError(): Error {
    if (this.type === 'Fatal') {
      return this.cause || this;
    }
    if (this.type === 'RetryableHttp' && this.status === 500) {
      return new Error('Internal Server Error');
    }
    return new Error(`Retry limit exceeded: ${this.message}`);
  }

  isRetryable(): boolean {
    return this.type !== 'Fatal';
  }
}
```

**Success Criteria**:
- File created at `codex-chrome/src/models/types/StreamAttemptError.ts`
- All 3 error types implemented (RetryableHttp, RetryableTransport, Fatal)
- delay() method matches Rust backoff formula
- intoError() method matches Rust error conversion
- Type exported from `types/index.ts`

**Dependencies**: None (can run in parallel)

---

### T011 [P]: Verify Prompt Interface (Already Aligned) ✅
**Type**: Verification
**Files**: `codex-chrome/src/models/types/ResponsesAPI.ts`
**Description**: Verify Prompt interface at lines 45-54 already matches Rust. Per user instruction, we use the existing Prompt interface. Add Rust line references and document alignment.

**Changes** (documentation only):
```typescript
/**
 * Prompt structure for model requests
 * Based on Rust's Prompt struct
 * Rust Reference: codex-rs/core/src/client_common.rs Lines 26-69
 *
 * NOTE: This interface already exists and matches Rust structure.
 * No refactoring needed - already aligned.
 */
export interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[];  // Matches Rust: input
  /** Tools available to the model */
  tools: any[];  // Matches Rust: tools (Vec<OpenAiTool>)
  /** Optional override for base instructions */
  baseInstructionsOverride?: string;  // Matches Rust: base_instructions_override
  /** Optional output schema for the model's response */
  outputSchema?: any;  // Matches Rust: output_schema
}
```

**Success Criteria**:
- JSDoc comment updated with Rust references
- Note added that interface is already aligned
- No structural changes needed
- Verification documented in commit message

**Dependencies**: None (can run in parallel)

---

## Phase 3.3: Base Class Refactoring

**Note**: These tasks modify ModelClient base class. They must be sequential since they modify the same file.

### T012: Rename ModelClient Methods to Match Rust ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/ModelClient.ts`
**Description**: Rename abstract methods in ModelClient base class to match Rust naming. This is the core alignment task. Existing methods like `complete()` and `stream()` need to be renamed/aligned.

**Method Renames** (based on research.md Section 2.2):

| Current TS Method | New Method Name | Rust Reference |
|-------------------|-----------------|----------------|
| `complete()` | Keep (TS-specific) | N/A |
| `stream()` | Keep (delegates to streamResponses) | client.rs:124-164 |
| `countTokens()` | Keep (TS-specific) | N/A |
| `streamCompletion()` | Keep (adapter method) | N/A |
| `getProvider()` | Update return type: `string` → `ModelProviderInfo` | client.rs:414-416 |
| `getModel()` | Keep ✅ | client.rs:423-425 |
| `setModel()` | Keep (TS-specific) | N/A |
| `getContextWindow()` | Rename to `getModelContextWindow()` | client.rs:109-113 |
| `getReasoningEffort()` | Keep ✅ | client.rs:434-436 |
| `setReasoningEffort()` | Keep (TS-specific) | N/A |
| `getReasoningSummary()` | Keep ✅ | client.rs:439-441 |
| `setReasoningSummary()` | Keep (TS-specific) | N/A |

**Add Missing Methods**:
```typescript
abstract class ModelClient {
  // ... existing methods ...

  /**
   * Get auto-compact token limit for this model
   * Rust Reference: client.rs:115-119
   */
  abstract getAutoCompactTokenLimit(): number | undefined;

  /**
   * Get model family configuration
   * Rust Reference: client.rs:428-430
   */
  abstract getModelFamily(): ModelFamily;

  /**
   * Get auth manager instance (if available)
   * Rust Reference: client.rs:443-445
   */
  abstract getAuthManager(): ChromeAuthManager | undefined;
}
```

**Success Criteria**:
- `getContextWindow()` renamed to `getModelContextWindow()`
- `getProvider()` return type changed to `ModelProviderInfo`
- 3 new abstract methods added (getAutoCompactTokenLimit, getModelFamily, getAuthManager)
- All existing TS-specific methods preserved
- JSDoc comments updated with Rust line references
- No breaking changes to consumers (update imports if needed)

**Dependencies**: T007-T011 complete (types must be aligned first)

---

### T013: Add StreamResponses Method Structure ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/ModelClient.ts`
**Description**: Ensure `stream()` method matches Rust dispatch pattern (WireApi::Responses vs WireApi::Chat). The base class should have a clear pattern for provider-specific implementations.

**Implementation Pattern** (matching Rust client.rs:124-164):
```typescript
abstract class ModelClient {
  /**
   * Main streaming method - dispatches to provider-specific implementation
   * Rust Reference: client.rs:124-164
   */
  async stream(prompt: Prompt): AsyncGenerator<ResponseEvent> {
    // Rust dispatches based on provider.wire_api
    // TypeScript should match this pattern
    if (this.provider.wireApi === 'responses') {
      return this.streamResponses(prompt);
    } else if (this.provider.wireApi === 'chat') {
      return this.streamChat(prompt);
    }
    throw new Error(`Unknown wire API: ${this.provider.wireApi}`);
  }

  /**
   * Responses API implementation (OpenAI experimental /v1/responses)
   * Rust Reference: client.rs:167-266
   */
  protected abstract streamResponses(prompt: Prompt): AsyncGenerator<ResponseEvent>;

  /**
   * Chat Completions API implementation (OpenAI /v1/chat/completions)
   * Rust Reference: client.rs chat_completions.rs integration
   */
  protected abstract streamChat(prompt: Prompt): AsyncGenerator<ResponseEvent>;
}
```

**Success Criteria**:
- `stream()` method dispatches based on `wireApi`
- `streamResponses()` and `streamChat()` are protected abstract methods
- Pattern matches Rust client.rs:124-164
- JSDoc comments reference Rust code

**Dependencies**: T012 complete

---

### T014: Add AttemptStreamResponses Method ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/ModelClient.ts`
**Description**: Add `attemptStreamResponses()` method to base class matching Rust single-attempt pattern (Rust client.rs:269-412). This separates single attempt from retry loop.

**Implementation**:
```typescript
abstract class ModelClient {
  /**
   * Single attempt to start streaming (no retries)
   * Rust Reference: client.rs:269-412
   *
   * @param attempt Current attempt number (0-based)
   * @param payload Request payload for Responses API
   * @param auth Optional auth context
   * @returns ResponseStream on success
   * @throws StreamAttemptError on failure (caller handles retries)
   */
  protected abstract attemptStreamResponses(
    attempt: number,
    payload: ResponsesApiRequest,
    auth?: AuthContext
  ): Promise<ResponseStream>;
}
```

**Success Criteria**:
- Method signature matches Rust
- Returns `Promise<ResponseStream>` (matches Rust Result<ResponseStream>)
- Throws `StreamAttemptError` for retry logic
- JSDoc explains single-attempt semantics
- Protected access (called by streamResponses retry loop)

**Dependencies**: T013 complete, T010 complete (needs StreamAttemptError)

---

### T015: Add ProcessSSE Method Signature ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/ModelClient.ts`
**Description**: Add `processSSE()` method signature to base class matching Rust SSE processing function (client.rs:624-848). This handles Server-Sent Events parsing and ResponseEvent emission.

**Implementation**:
```typescript
abstract class ModelClient {
  /**
   * Process Server-Sent Events stream from Responses API
   * Rust Reference: client.rs:624-848
   *
   * @param stream ReadableStream from fetch response body
   * @param headers Response headers (for rate limit parsing)
   * @yields ResponseEvent objects as they're parsed from SSE
   */
  protected abstract processSSE(
    stream: ReadableStream<Uint8Array>,
    headers: Headers
  ): AsyncGenerator<ResponseEvent>;

  /**
   * Parse rate limit information from response headers
   * Rust Reference: client.rs:567-607
   */
  protected abstract parseRateLimitSnapshot(headers: Headers): RateLimitSnapshot | null;
}
```

**Success Criteria**:
- `processSSE()` signature matches Rust function
- Takes `ReadableStream` (browser equivalent of tokio stream)
- Returns `AsyncGenerator<ResponseEvent>` (matches Rust mpsc::channel pattern)
- `parseRateLimitSnapshot()` added for header parsing
- JSDoc references Rust line numbers

**Dependencies**: T014 complete

---

## Phase 3.4: Implementation Refactoring

**Note**: These tasks refactor concrete implementations. Since they're different files, they can run in parallel [P].

### T016 [P]: Refactor OpenAIResponsesClient Methods ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/OpenAIResponsesClient.ts`
**Description**: Implement all abstract methods from ModelClient in OpenAIResponsesClient. Rename existing methods to match new signatures from T012-T015.

**Key Changes**:

1. **Implement getAutoCompactTokenLimit()**:
```typescript
getAutoCompactTokenLimit(): number | undefined {
  // From Rust: config.model_auto_compact_token_limit or model info default
  return this.modelFamily.autoCompactTokenLimit;
}
```

2. **Implement getModelFamily()**:
```typescript
getModelFamily(): ModelFamily {
  return this.modelFamily;
}
```

3. **Implement getAuthManager()**:
```typescript
getAuthManager(): ChromeAuthManager | undefined {
  return this.authManager;
}
```

4. **Update getProvider() return type**:
```typescript
getProvider(): ModelProviderInfo {
  // Was: return this.provider.name;
  // Now: return full provider object
  return this.provider;
}
```

5. **Rename getContextWindow() → getModelContextWindow()**:
```typescript
getModelContextWindow(): number | undefined {
  // Implementation stays same, just renamed
  const contextWindows: Record<string, number> = {
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-5': 200000,
  };
  return contextWindows[this.currentModel];
}
```

6. **Implement attemptStreamResponses()** (extract from existing makeResponsesApiRequest):
```typescript
protected async attemptStreamResponses(
  attempt: number,
  payload: ResponsesApiRequest,
  auth?: AuthContext
): Promise<ResponseStream> {
  // Extract single-attempt logic from current retry loop
  // Throw StreamAttemptError instead of retrying
  try {
    const response = await this.makeRequest(payload, auth);
    if (!response.ok) {
      const status = response.status;
      if (status === 429 || status >= 500) {
        throw StreamAttemptError.retryableHttp(status);
      } else {
        throw StreamAttemptError.fatal(new Error(`HTTP ${status}`));
      }
    }
    return this.createResponseStream(response);
  } catch (error) {
    if (error instanceof StreamAttemptError) throw error;
    throw StreamAttemptError.retryableTransport(error as Error);
  }
}
```

7. **Implement processSSE()** (extract from existing SSE processing):
```typescript
protected async *processSSE(
  stream: ReadableStream<Uint8Array>,
  headers: Headers
): AsyncGenerator<ResponseEvent> {
  // Move existing SSE parsing logic here
  // Match Rust client.rs:624-848 structure
  const rateLimitSnapshot = this.parseRateLimitSnapshot(headers);
  if (rateLimitSnapshot) {
    yield { type: 'RateLimits', snapshot: rateLimitSnapshot };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let responseCompleted: ResponseCompleted | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (responseCompleted) {
          yield {
            type: 'Completed',
            responseId: responseCompleted.id,
            tokenUsage: responseCompleted.usage
          };
        } else {
          throw new Error('Stream closed before response.completed');
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Parse SSE events - match Rust logic
        // ...
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

8. **Implement parseRateLimitSnapshot()**:
```typescript
protected parseRateLimitSnapshot(headers: Headers): RateLimitSnapshot | null {
  // Match Rust client.rs:567-607
  const primary = this.parseRateLimitWindow(
    headers,
    'x-codex-primary-used-percent',
    'x-codex-primary-window-minutes',
    'x-codex-primary-reset-after-seconds'
  );

  const secondary = this.parseRateLimitWindow(
    headers,
    'x-codex-secondary-used-percent',
    'x-codex-secondary-window-minutes',
    'x-codex-secondary-reset-after-seconds'
  );

  if (!primary && !secondary) return null;
  return { primary, secondary };
}
```

**Success Criteria**:
- All abstract methods implemented
- Method names match Rust client.rs
- Existing functionality preserved (behavior unchanged)
- StreamAttemptError used for retry logic
- SSE processing matches Rust structure
- All existing tests still pass

**Dependencies**: T012-T015 complete (base class must be updated first)

---

### T017 [P]: Refactor OpenAIClient Methods ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/OpenAIClient.ts`
**Description**: Update OpenAIClient (Chat Completions API) to implement new abstract methods. This client is for the Chat API, not Responses API, but must implement the same interface.

**Key Changes**:

1. Implement new abstract methods (getAutoCompactTokenLimit, getModelFamily, getAuthManager)
2. Rename getContextWindow() → getModelContextWindow()
3. Update getProvider() return type to ModelProviderInfo
4. Ensure streamCompletion() method preserved (TS-specific adapter)

**Success Criteria**:
- All abstract methods implemented
- Method names aligned with base class
- Chat API functionality unchanged
- Existing tests still pass

**Dependencies**: T012-T015 complete (base class must be updated first)

---

### T018 [P]: Refactor SSEEventParser Method Names ✅
**Type**: Refactoring
**Files**: `codex-chrome/src/models/SSEEventParser.ts`
**Description**: Ensure SSEEventParser method names align with Rust SSE processing if applicable. This is a performance optimization module specific to TypeScript, but naming should be consistent.

**Review and Update**:
- Check method names against Rust process_sse function
- Ensure event type names match Rust exactly (case-sensitive)
- Update comments to reference Rust code
- Preserve performance optimizations (batch processing, etc.)

**Success Criteria**:
- Method names reviewed for alignment
- Event type strings match Rust exactly
- Comments reference Rust code
- Performance optimizations preserved
- Existing tests pass

**Dependencies**: T007 complete (ResponseEvent types must be aligned)

---

### T019 [P]: Review ChromeAuthManager (Minimal Changes) ✅
**Type**: Review/Documentation
**Files**: `codex-chrome/src/models/ChromeAuthManager.ts`
**Description**: Review ChromeAuthManager for any naming alignment with Rust AuthManager. This is browser-specific but should maintain interface compatibility.

**Review Points**:
- Does interface match Rust AuthManager intent?
- Are method names consistent (getAuth, setAuth, refreshToken)?
- Add Rust reference comments where applicable
- Preserve browser-specific implementation (chrome.storage)

**Success Criteria**:
- Interface reviewed and documented
- Rust references added where applicable
- Browser-specific code preserved
- No breaking changes
- Tests pass

**Dependencies**: None (independent review)

---

## Phase 3.5: Test Updates

**Note**: These tasks update tests to work with refactored code. They must run sequentially after implementation refactoring.

### T020: Update Unit Tests for New Method Names
**Type**: Test Update
**Files**: All files in `codex-chrome/src/models/__tests__/`
**Description**: Update all unit tests to use new method names from refactoring. This is a find-replace task across test files.

**Changes Needed**:
- `getContextWindow()` → `getModelContextWindow()`
- `getProvider()` assertions updated for ModelProviderInfo return type
- Add tests for new methods (getAutoCompactTokenLimit, getModelFamily, getAuthManager)

**Commands**:
```bash
# Find all test files that need updates
grep -r "getContextWindow" codex-chrome/src/models/__tests__/
grep -r "getProvider" codex-chrome/src/models/__tests__/

# Update each file found
```

**Success Criteria**:
- All unit tests updated for new method names
- Tests for new methods added
- All unit tests pass
- No broken references to old method names

**Dependencies**: T016, T017 complete (implementations must be refactored first)

---

### T021: Update Integration Tests
**Type**: Test Update
**Files**: `codex-chrome/src/models/__tests__/integration.test.ts` and related files
**Description**: Update integration tests to use new method signatures and verify behavior preservation.

**Success Criteria**:
- Integration tests updated for new signatures
- Tests verify refactored code behaves identically
- All integration tests pass
- Test coverage maintained or improved

**Dependencies**: T020 complete

---

### T022: Run Contract Tests (Should Pass Now)
**Type**: Validation
**Files**: All contract tests from Phase 3.1
**Description**: Re-run all contract tests created in T002-T005. They should now PASS since code has been refactored to match contracts.

**Commands**:
```bash
cd codex-chrome
npm test tests/contract/
```

**Success Criteria**:
- All contract tests PASS (were failing in T006, now passing)
- ModelClient contract validates ✅
- ResponseEvent contract validates ✅
- StreamAttemptError contract validates ✅
- BrowserAdaptations contract validates ✅

**Dependencies**: T016, T017, T018 complete (all implementations must be refactored)

---

### T023: Run All Existing Tests (Regression Check)
**Type**: Validation
**Files**: All test files
**Description**: Run complete test suite to verify no regressions. Compare with baseline from T001.

**Commands**:
```bash
cd codex-chrome
npm test
```

**Success Criteria**:
- Test results match baseline from T001
- No new test failures
- All refactored tests pass
- Performance tests show no degradation

**Dependencies**: T020, T021, T022 complete

---

## Phase 3.6: Documentation & Validation

**Note**: These tasks update documentation and perform final validation. Some can run in parallel [P].

### T024 [P]: Update CLAUDE.md with New Architecture
**Type**: Documentation
**Files**: `CLAUDE.md`
**Description**: Update CLAUDE.md to document the refactored model client architecture. Add section explaining alignment with Rust, method name mappings, and browser adaptations.

**Sections to Add/Update**:

```markdown
## Model Client Architecture (Refactored 2025-10-02)

The model client implementation in `codex-chrome/src/models/` has been refactored to align with `codex-rs/core/src/client.rs`.

### Key Alignment Points

**Rust → TypeScript Method Mapping**:
- `get_model_context_window()` → `getModelContextWindow()`
- `get_auto_compact_token_limit()` → `getAutoCompactTokenLimit()`
- `stream()` → `stream()` (dispatches to streamResponses or streamChat)
- `stream_responses()` → `streamResponses()`
- `attempt_stream_responses()` → `attemptStreamResponses()`
- `process_sse()` → `processSSE()`
- `get_provider()` → `getProvider()` (returns ModelProviderInfo)
- `get_model_family()` → `getModelFamily()`
- `get_auth_manager()` → `getAuthManager()`

**Browser Adaptations**:
- `reqwest::Client` → `fetch()` API
- `tokio::mpsc::channel` → `AsyncGenerator<ResponseEvent>`
- `tokio::time::timeout()` → `Promise.race()` with timeout
- `std::fs` auth storage → `chrome.storage.local` API

**Type Alignment**:
- All ResponseEvent types match Rust enum exactly (case-sensitive)
- StreamAttemptError matches Rust retry logic
- TokenUsage fields match Rust struct
- RateLimitSnapshot matches Rust structure

See `specs/009-refactor-codex-chrome/` for complete refactoring documentation.
```

**Success Criteria**:
- CLAUDE.md updated with new architecture section
- Method mapping table included
- Browser adaptations documented
- Links to spec documentation added

**Dependencies**: None (can run in parallel with T025)

---

### T025 [P]: Update quickstart.md Verification Guide
**Type**: Documentation
**Files**: `specs/009-refactor-codex-chrome/quickstart.md`
**Description**: Update quickstart.md to reflect completed refactoring. Change from "Phase 1 design verification" to "Phase 4 implementation verification".

**Updates**:
- Change title to "Refactoring Verification Guide"
- Update all verification steps to check actual implementation (not contracts)
- Add post-refactoring validation commands
- Update success criteria

**Success Criteria**:
- quickstart.md reflects completed refactoring
- All verification commands updated
- Success criteria aligned with implementation

**Dependencies**: None (can run in parallel with T024)

---

### T026: Performance Benchmarks
**Type**: Validation
**Files**: Create `codex-chrome/src/models/__tests__/performance.test.ts`
**Description**: Create performance benchmarks to verify refactoring maintains performance targets. Test SSE processing, retry logic, and stream handling.

**Benchmarks**:

1. **SSE Event Processing**: <10ms average
```typescript
it('should process SSE events in <10ms average', async () => {
  const events = generateMockSSEEvents(1000);
  const start = performance.now();

  for await (const event of processSSEStream(events)) {
    // Process event
  }

  const elapsed = performance.now() - start;
  const avgPerEvent = elapsed / 1000;
  expect(avgPerEvent).toBeLessThan(10);
});
```

2. **Retry Backoff**: <3 seconds total for rate limit
```typescript
it('should handle rate limit retry in <3 seconds', async () => {
  const start = performance.now();

  try {
    await client.streamResponses(prompt);
  } catch (err) {
    // Expected rate limit
  }

  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(3000);
});
```

3. **Stream Latency**: <100ms for first event
```typescript
it('should emit first event in <100ms', async () => {
  const start = performance.now();

  for await (const event of client.stream(prompt)) {
    const firstEventTime = performance.now() - start;
    expect(firstEventTime).toBeLessThan(100);
    break; // Only test first event
  }
});
```

**Success Criteria**:
- Performance test file created
- All 3 benchmarks implemented
- All benchmarks pass (meet targets)
- Results documented

**Dependencies**: T023 complete (all tests must pass first)

---

### T027: Final Validation Checklist
**Type**: Validation
**Files**: All refactored files
**Description**: Complete final validation checklist to ensure refactoring is complete and successful.

**Validation Checklist**:

- [ ] All contract tests pass (T022)
- [ ] All existing tests pass (T023)
- [ ] Performance benchmarks pass (T026)
- [ ] Documentation updated (T024, T025)
- [ ] All method names match Rust (verified)
- [ ] All type names match Rust (verified)
- [ ] Browser adaptations preserved (verified)
- [ ] No breaking changes to consumers (verified)
- [ ] Code review checklist:
  - [ ] All files have Rust line references in comments
  - [ ] No unused imports or dead code
  - [ ] Consistent code style
  - [ ] All TODOs resolved or documented

**Commands**:
```bash
# Run full validation
npm test                           # All tests
npm run type-check                 # TypeScript compilation
npm run lint                       # ESLint
npm run format                     # Prettier

# Verify no regressions
git diff --stat main...HEAD        # Review changes
```

**Success Criteria**:
- All checklist items completed ✅
- All validation commands pass
- Changes reviewed and approved
- Ready for merge

**Dependencies**: T024, T025, T026 complete

---

## Dependencies Summary

```
Phase 3.1 (Setup):
T001 → T002, T003, T004, T005 (baseline before contract tests)
T002, T003, T004, T005 → T006 (contract tests before validation)

Phase 3.2 (Types):
T006 → T007, T008, T009, T010, T011 (contract test results guide refactoring)
T007, T008, T009, T010, T011 are [P] (parallel - different files)

Phase 3.3 (Base Class):
T007-T011 → T012 (types before base class)
T012 → T013 → T014 → T015 (sequential - same file)

Phase 3.4 (Implementations):
T012-T015 → T016, T017, T018, T019 (base class before implementations)
T016, T017, T018, T019 are [P] (parallel - different files)

Phase 3.5 (Tests):
T016, T017, T018 → T020 → T021 → T022 → T023 (sequential test updates)

Phase 3.6 (Documentation):
T023 → T024, T025 (tests pass before doc updates)
T024, T025 are [P] (parallel - different files)
T023 → T026 (benchmarks need working code)
T024, T025, T026 → T027 (final validation)
```

---

## Parallel Execution Examples

### Example 1: Contract Tests (Phase 3.1)
```bash
# After T001 baseline established, run T002-T005 in parallel
# All are independent contract test files

Task: Create contract test for ModelClient at codex-chrome/tests/contract/ModelClient.test.ts
Task: Create contract test for ResponseEvent at codex-chrome/tests/contract/ResponseEvent.test.ts
Task: Create contract test for StreamAttemptError at codex-chrome/tests/contract/StreamAttemptError.test.ts
Task: Create contract test for BrowserAdaptations at codex-chrome/tests/contract/BrowserAdaptations.test.ts

# Then run T006 to validate all contract tests fail
```

### Example 2: Type Refactoring (Phase 3.2)
```bash
# After T006 contract validation, run T007-T011 in parallel
# All are different type definition files

Task: Align ResponseEvent type at codex-chrome/src/models/types/ResponseEvent.ts
Task: Align TokenUsage type at codex-chrome/src/models/types/TokenUsage.ts
Task: Align RateLimitSnapshot type at codex-chrome/src/models/types/RateLimits.ts
Task: Create StreamAttemptError type at codex-chrome/src/models/types/StreamAttemptError.ts
Task: Verify Prompt interface at codex-chrome/src/models/types/ResponsesAPI.ts
```

### Example 3: Implementation Refactoring (Phase 3.4)
```bash
# After T012-T015 base class updates, run T016-T019 in parallel
# All are different implementation files

Task: Refactor OpenAIResponsesClient at codex-chrome/src/models/OpenAIResponsesClient.ts
Task: Refactor OpenAIClient at codex-chrome/src/models/OpenAIClient.ts
Task: Refactor SSEEventParser at codex-chrome/src/models/SSEEventParser.ts
Task: Review ChromeAuthManager at codex-chrome/src/models/ChromeAuthManager.ts
```

### Example 4: Documentation (Phase 3.6)
```bash
# After T023 tests pass, run T024-T025 in parallel
# Different documentation files

Task: Update CLAUDE.md with new architecture
Task: Update quickstart.md verification guide
```

---

## Notes

### Refactoring Best Practices
- **Preserve behavior**: This is refactoring, not feature development
- **Test first, then refactor**: Contract tests define success criteria
- **Incremental changes**: Complete each phase before moving to next
- **Verify continuously**: Run tests after each task
- **Commit frequently**: Commit after each completed task

### Parallel Execution Guidelines
- **[P] marker**: Indicates task can run in parallel with other [P] tasks
- **Same file = no [P]**: Tasks modifying the same file must be sequential
- **Dependencies block parallelization**: Check dependency graph before parallelizing
- **Different files with no dependencies = parallel safe**

### Common Issues
- **Import errors**: Update imports when renaming methods
- **Type mismatches**: Ensure type definitions updated before implementations
- **Test failures**: Run baseline tests first to identify pre-existing issues
- **Performance regressions**: Run benchmarks to catch performance issues

---

## Validation Checklist

*Checked during T027 final validation*

### Code Quality
- [ ] All files have Rust line references in JSDoc comments
- [ ] Method names match Rust (camelCase conversion)
- [ ] Type names match Rust (PascalCase conversion)
- [ ] Field names match Rust (snake_case preserved or camelCase conversion documented)
- [ ] No unused imports or dead code
- [ ] Consistent code style (Prettier)
- [ ] ESLint passes with no errors

### Testing
- [ ] All contract tests pass (T022)
- [ ] All unit tests pass (T023)
- [ ] All integration tests pass (T023)
- [ ] Performance benchmarks pass (T026)
- [ ] Test coverage maintained or improved
- [ ] No test flakiness

### Documentation
- [ ] CLAUDE.md updated with architecture (T024)
- [ ] quickstart.md updated for verification (T025)
- [ ] Method mapping table documented
- [ ] Browser adaptations documented
- [ ] All TODOs resolved or documented

### Behavior Preservation
- [ ] No breaking changes to consumers
- [ ] API compatibility maintained
- [ ] Performance targets met
- [ ] Error handling unchanged
- [ ] Retry logic preserved

---

**Total Tasks**: 27 tasks
**Estimated Duration**: 3-4 days (assuming sequential execution, ~2 days with parallelization)
**Parallel Opportunities**: 15 tasks marked [P] (56% parallelizable)

Ready for execution! Start with T001 to establish baseline.
