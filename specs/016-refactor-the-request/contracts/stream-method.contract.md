# Contract: Stream Method Execution Flow

**Feature**: 016-refactor-the-request
**Status**: Draft
**Rust Reference**: `codex-rs/core/src/client.rs:126-272`

## Interface Definition

```typescript
abstract class ModelClient {
  /**
   * Stream a model response (public API)
   * Dispatches to streamResponses() or streamChat() based on wire_api
   * Rust: pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream>
   */
  abstract stream(prompt: Prompt): Promise<ResponseStream>;

  /**
   * Stream using Responses API (protected)
   * Rust: async fn stream_responses(&self, prompt: &Prompt) -> Result<ResponseStream>
   */
  protected abstract streamResponses(prompt: Prompt): Promise<ResponseStream>;

  /**
   * Attempt single streaming request with retry handling (protected)
   * Rust: async fn attempt_stream_responses(...) -> Result<ResponseStream, StreamAttemptError>
   */
  protected abstract attemptStreamResponses(
    attempt: number,
    payload: any,
    authManager?: any
  ): Promise<ResponseStream>;
}
```

## Contract Tests

### Test 1: Stream Method Dispatch

**Test Name**: `test_stream_dispatches_to_responses_api`

**Purpose**: Verify stream() method dispatches to streamResponses() for Responses API

**Rust Reference**: `client.rs:126-166`

**Test Implementation**:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Stream Method Dispatch', () => {
  it('should dispatch to streamResponses for Responses API', async () => {
    const client = new TestModelClient({
      wire_api: 'Responses',
      // ... other config
    });

    const streamResponsesSpy = vi.spyOn(client as any, 'streamResponses');

    const prompt: Prompt = {
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
      tools: [],
    };

    await client.stream(prompt);

    expect(streamResponsesSpy).toHaveBeenCalledWith(prompt);
  });

  it('should dispatch to streamChat for Chat API', async () => {
    const client = new TestModelClient({
      wire_api: 'Chat',
      // ... other config
    });

    const streamChatSpy = vi.spyOn(client as any, 'streamChat');

    const prompt: Prompt = {
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
      tools: [],
    };

    await client.stream(prompt);

    expect(streamChatSpy).toHaveBeenCalledWith(prompt);
  });
});
```

**Expected Result**: stream() dispatches correctly based on wire_api

---

### Test 2: Request Headers

**Test Name**: `test_request_headers_responses_api`

**Purpose**: Verify request headers include required OpenAI-Beta and conversation headers

**Rust Reference**: `client.rs:296-302`

**Test Implementation**:
```typescript
describe('Request Headers', () => {
  it('should include OpenAI-Beta header for Responses API', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    const callArgs = fetchSpy.mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;

    expect(headers['OpenAI-Beta']).toBe('responses=experimental');
  });

  it('should include conversation_id and session_id headers', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const conversationId = 'conv_456';
    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId,
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    const callArgs = fetchSpy.mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;

    expect(headers['conversation_id']).toBe(conversationId);
    expect(headers['session_id']).toBe(conversationId);
  });

  it('should include Accept: text/event-stream header', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    const callArgs = fetchSpy.mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;

    expect(headers['Accept']).toBe('text/event-stream');
  });
});
```

**Expected Result**: All required headers present

---

### Test 3: Retry Logic

**Test Name**: `test_retry_logic_exponential_backoff`

**Purpose**: Verify attemptStreamResponses() retries up to max attempts with exponential backoff

**Rust Reference**: `client.rs:249-269`

**Test Implementation**:
```typescript
describe('Retry Logic', () => {
  it('should retry up to max attempts', async () => {
    let attemptCount = 0;

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
      requestMaxRetries: 3,
    });

    // Mock attemptStreamResponses to fail first 2 times
    vi.spyOn(client as any, 'attemptStreamResponses').mockImplementation(async (attempt) => {
      attemptCount++;
      if (attempt < 2) {
        throw { type: 'RetryableHttpError', status: 500 };
      }
      return new ResponseStream();
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    expect(attemptCount).toBe(3); // Attempted 3 times (0, 1, 2)
  });

  it('should throw fatal errors immediately', async () => {
    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
      requestMaxRetries: 3,
    });

    vi.spyOn(client as any, 'attemptStreamResponses').mockImplementation(async () => {
      throw { type: 'Fatal', error: new Error('Invalid API key') };
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await expect(client.stream(prompt)).rejects.toThrow('Invalid API key');
  });

  it('should use exponential backoff between retries', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;

    vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(fn as any, 0); // Execute immediately in test
    });

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
      requestMaxRetries: 2,
    });

    vi.spyOn(client as any, 'attemptStreamResponses').mockImplementation(async (attempt) => {
      if (attempt < 2) {
        throw { type: 'RetryableHttpError', status: 503 };
      }
      return new ResponseStream();
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    // Verify exponential backoff (delays should increase)
    expect(delays.length).toBeGreaterThan(0);
    if (delays.length > 1) {
      expect(delays[1]).toBeGreaterThan(delays[0]);
    }
  });
});
```

**Expected Result**: Retry logic matches Rust behavior

---

### Test 4: Retry-After Header Parsing

**Test Name**: `test_retry_after_header_parsing`

**Purpose**: Verify Retry-After header parsed and used for delay calculation

**Rust Reference**: `client.rs:358-363`

**Test Implementation**:
```typescript
describe('Retry-After Header', () => {
  it('should parse Retry-After header from response', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        'Retry-After': '5', // 5 seconds
      }),
    } as Response);

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
      requestMaxRetries: 0, // No retries, just test header parsing
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    try {
      await client.stream(prompt);
    } catch (error: any) {
      // Verify error includes retry_after information
      expect(error.retryAfter).toBeDefined();
    }
  });

  it('should use Retry-After delay instead of exponential backoff', async () => {
    const delays: number[] = [];

    vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return setTimeout(fn as any, 0);
    });

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
      requestMaxRetries: 1,
    });

    let attemptCount = 0;
    vi.spyOn(client as any, 'attemptStreamResponses').mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw {
          type: 'RetryableHttpError',
          status: 429,
          retryAfter: 10000, // 10 seconds
        };
      }
      return new ResponseStream();
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    // Verify delay matches Retry-After value (10 seconds)
    expect(delays[0]).toBe(10000);
  });
});
```

**Expected Result**: Retry-After header parsed and used correctly

---

### Test 5: Auth Token Refresh on 401

**Test Name**: `test_auth_refresh_on_401`

**Purpose**: Verify auth token refreshed on 401 Unauthorized responses

**Rust Reference**: `client.rs:365-370`

**Test Implementation**:
```typescript
describe('Auth Token Refresh', () => {
  it('should refresh auth token on 401 Unauthorized', async () => {
    const authManager = {
      auth: () => ({ token: 'old-token' }),
      refreshToken: vi.fn().mockResolvedValue({ token: 'new-token' }),
    };

    const client = new OpenAIResponsesClient({
      model: 'gpt-5',
      apiKey: 'test-key',
      conversationId: 'conv_123',
      authManager,
      requestMaxRetries: 1,
    });

    let attemptCount = 0;
    vi.spyOn(client as any, 'attemptStreamResponses').mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw { type: 'RetryableHttpError', status: 401 };
      }
      return new ResponseStream();
    });

    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    await client.stream(prompt);

    expect(authManager.refreshToken).toHaveBeenCalled();
  });
});
```

**Expected Result**: Auth manager refresh called on 401

---

## Acceptance Criteria

- [ ] stream() method defined on ModelClient
- [ ] streamResponses() protected method defined
- [ ] attemptStreamResponses() protected method defined
- [ ] stream() dispatches based on wire_api
- [ ] Request headers include OpenAI-Beta, conversation_id, session_id
- [ ] Retry logic with exponential backoff implemented
- [ ] Retry-After header parsed and used
- [ ] Auth token refresh on 401
- [ ] Contract tests written and failing (no implementation yet)

## Dependencies

- `Prompt` interface
- `ResponseStream` class
- `ModelProviderInfo` configuration
- `AuthManager` for token refresh

## Implementation Notes

1. Stream dispatch pattern:
   ```typescript
   async stream(prompt: Prompt): Promise<ResponseStream> {
     if (this.provider.wire_api === 'Responses') {
       return this.streamResponses(prompt);
     } else {
       return this.streamChat(prompt);
     }
   }
   ```

2. Retry loop pattern:
   ```typescript
   async streamResponses(prompt: Prompt): Promise<ResponseStream> {
     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         return await this.attemptStreamResponses(attempt, payload);
       } catch (error) {
         if (isFatal(error) || attempt === maxRetries) throw error;
         await sleep(calculateDelay(attempt, error));
       }
     }
   }
   ```

3. Headers:
   ```typescript
   const headers = {
     'OpenAI-Beta': 'responses=experimental',
     'conversation_id': this.conversationId,
     'session_id': this.conversationId,
     'Accept': 'text/event-stream',
   };
   ```

4. Exponential backoff:
   ```typescript
   function calculateDelay(attempt: number, error: any): number {
     if (error.retryAfter) return error.retryAfter;
     return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
   }
   ```
