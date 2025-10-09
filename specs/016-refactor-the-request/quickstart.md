# Quickstart: OpenAI Client Rust Alignment

**Feature**: 016-refactor-the-request
**Purpose**: Verify the refactored OpenAI client aligns with Rust implementation
**Estimated Time**: 10-15 minutes

## Prerequisites

- [x] Implementation complete (all tasks.md tasks done)
- [x] All contract tests passing
- [x] Integration tests passing
- [x] TypeScript builds without errors

## Scenario 1: Build Prompt with Full Context

**Goal**: Verify Prompt structure matches Rust and includes all context

**Steps**:

1. Create a test prompt with all fields:
```typescript
import { Prompt, ResponseItem, ToolSpec, ModelFamily } from '@/models/types/ResponsesAPI';
import { get_full_instructions, get_formatted_input } from '@/models/PromptHelpers';

const prompt: Prompt = {
  input: [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Search the web for TypeScript best practices' }],
    },
  ],
  tools: [
    { type: 'web_search' },
    {
      type: 'function',
      function: {
        name: 'save_notes',
        description: 'Save notes to storage',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
          required: ['content'],
        },
      },
    },
  ],
  user_instructions: 'Follow TypeScript best practices.',
};
```

2. Get full instructions:
```typescript
const modelFamily: ModelFamily = {
  family: 'gpt-5',
  base_instructions: 'You are a helpful coding assistant.',
  supports_reasoning_summaries: true,
  needs_special_apply_patch_instructions: false,
};

const instructions = get_full_instructions(prompt, modelFamily);
console.log('Instructions:', instructions);
```

**Expected Output**:
```
Instructions: You are a helpful coding assistant.
Follow TypeScript best practices.
```

3. Get formatted input:
```typescript
const formattedInput = get_formatted_input(prompt);
console.log('Input length:', formattedInput.length);
console.log('Input is cloned:', formattedInput !== prompt.input);
```

**Expected Output**:
```
Input length: 1
Input is cloned: true
```

**Verification**:
- ✅ Instructions combine base + user
- ✅ Input is cloned (not same reference)
- ✅ Prompt structure matches Rust exactly

---

## Scenario 2: Build ResponsesApiRequest Payload

**Goal**: Verify ResponsesApiRequest payload matches Rust structure

**Steps**:

1. Create a client instance:
```typescript
import { OpenAIResponsesClient } from '@/models/OpenAIResponsesClient';

const client = new OpenAIResponsesClient({
  model: 'gpt-5',
  apiKey: 'sk-test-key',
  baseUrl: 'https://api.openai.com/v1',
  conversationId: 'conv_test_123',
  provider: {
    name: 'openai',
    wire_api: 'Responses',
    requires_openai_auth: true,
  },
});
```

2. Build request payload:
```typescript
const payload = await client.buildRequestPayload(prompt, modelFamily);
console.log('Payload structure:', JSON.stringify(payload, null, 2));
```

**Expected Output**:
```json
{
  "model": "gpt-5",
  "instructions": "You are a helpful coding assistant.\nFollow TypeScript best practices.",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [{ "type": "input_text", "text": "Search the web for TypeScript best practices" }]
    }
  ],
  "tools": [
    { "type": "web_search" },
    {
      "type": "function",
      "function": {
        "name": "save_notes",
        "description": "Save notes to storage",
        "strict": true,
        "parameters": { /* ... */ }
      }
    }
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": false,
  "store": false,
  "stream": true,
  "include": [],
  "prompt_cache_key": "conv_test_123"
}
```

3. Verify field values:
```typescript
console.log('tool_choice:', payload.tool_choice); // Should be "auto"
console.log('parallel_tool_calls:', payload.parallel_tool_calls); // Should be false
console.log('stream:', payload.stream); // Should be true
console.log('store:', payload.store); // Should be false (not Azure)
```

**Verification**:
- ✅ All required fields present
- ✅ tool_choice = "auto"
- ✅ parallel_tool_calls = false
- ✅ stream = true
- ✅ store = false (for standard OpenAI)
- ✅ prompt_cache_key = conversation ID

---

## Scenario 3: Stream Request with Responses API

**Goal**: Verify stream() method works end-to-end with Responses API

**Steps**:

1. Mock the fetch API to return SSE stream:
```typescript
import { mockSSEResponse } from '@/models/__tests__/utils';

global.fetch = vi.fn().mockResolvedValue(
  mockSSEResponse([
    'event: response.created\ndata: {}\n\n',
    'event: response.output_text.delta\ndata: {"delta":"Hello"}\n\n',
    'event: response.output_item.done\ndata: {"item":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Hello"}]}}\n\n',
    'event: response.completed\ndata: {"response":{"id":"resp_123"}}\n\n',
  ])
);
```

2. Stream the request:
```typescript
const stream = await client.stream(prompt);

const events: ResponseEvent[] = [];
for await (const event of stream) {
  events.push(event);
  console.log('Event:', event.type);
}
```

**Expected Output**:
```
Event: Created
Event: OutputTextDelta
Event: OutputItemDone
Event: Completed
```

3. Verify request headers:
```typescript
const fetchCall = (global.fetch as any).mock.calls[0];
const headers = fetchCall[1].headers;

console.log('OpenAI-Beta:', headers['OpenAI-Beta']); // Should be "responses=experimental"
console.log('conversation_id:', headers['conversation_id']); // Should be "conv_test_123"
console.log('Accept:', headers['Accept']); // Should be "text/event-stream"
```

**Verification**:
- ✅ stream() method executes successfully
- ✅ Events emitted in correct order
- ✅ Headers include OpenAI-Beta, conversation_id, Accept
- ✅ ResponseStream yields ResponseEvent objects

---

## Scenario 4: Azure Endpoint Handling

**Goal**: Verify Azure-specific workarounds (store flag, item IDs)

**Steps**:

1. Create Azure client:
```typescript
const azureClient = new OpenAIResponsesClient({
  model: 'gpt-5',
  apiKey: 'azure-key',
  baseUrl: 'https://my-resource.openai.azure.com',
  conversationId: 'conv_azure_456',
  provider: {
    name: 'azure',
    base_url: 'https://my-resource.openai.azure.com',
    wire_api: 'Responses',
    requires_openai_auth: false,
  },
});
```

2. Build payload for Azure:
```typescript
const azurePrompt: Prompt = {
  input: [
    {
      type: 'message',
      role: 'user',
      id: 'msg_user_1',
      content: [{ type: 'input_text', text: 'Hello' }],
    },
    {
      type: 'reasoning',
      id: 'reasoning_1',
      summary: [],
      content: [{ type: 'reasoning_text', text: 'Thinking...' }],
    },
  ],
  tools: [],
};

const azurePayload = await azureClient.buildRequestPayload(azurePrompt, modelFamily);
```

3. Verify Azure-specific fields:
```typescript
console.log('store flag:', azurePayload.store); // Should be true
console.log('Input with IDs:', JSON.stringify(azurePayload.input, null, 2));
```

**Expected Output**:
```
store flag: true
Input with IDs: [
  {
    "type": "message",
    "role": "user",
    "id": "msg_user_1",
    "content": [...]
  },
  {
    "type": "reasoning",
    "id": "reasoning_1",
    "summary": [],
    "content": [...]
  }
]
```

**Verification**:
- ✅ store = true for Azure endpoints
- ✅ Item IDs preserved in input array
- ✅ Reasoning IDs attached correctly

---

## Scenario 5: Retry Logic with Backoff

**Goal**: Verify retry logic matches Rust behavior

**Steps**:

1. Mock fetch to fail first 2 attempts:
```typescript
let attemptCount = 0;
global.fetch = vi.fn().mockImplementation(() => {
  attemptCount++;
  if (attemptCount < 3) {
    return Promise.resolve({
      ok: false,
      status: 503, // Service Unavailable
      headers: new Headers(),
    });
  }
  return mockSSEResponse(['event: response.completed\ndata: {"response":{"id":"resp_retry"}}\n\n']);
});
```

2. Stream with retries:
```typescript
const startTime = Date.now();
const stream = await client.stream(prompt);

const events: ResponseEvent[] = [];
for await (const event of stream) {
  events.push(event);
}

const duration = Date.now() - startTime;
console.log('Attempts:', attemptCount); // Should be 3
console.log('Duration:', duration); // Should include backoff delays
```

**Expected Output**:
```
Attempts: 3
Duration: ~3000ms (includes exponential backoff)
```

**Verification**:
- ✅ Retry attempted 3 times
- ✅ Exponential backoff applied between attempts
- ✅ Request succeeds on third attempt
- ✅ Total duration includes backoff delays

---

## Scenario 6: Integration with TurnManager

**Goal**: Verify TurnManager uses new Prompt structure

**Steps**:

1. Create a TurnManager instance:
```typescript
import { TurnManager } from '@/core/TurnManager';
import { Session } from '@/core/Session';

const session = new Session({
  conversationId: 'conv_integration_789',
  config: { model: 'gpt-5' },
});

const turnManager = new TurnManager(session);
```

2. Submit a turn with user instructions:
```typescript
await turnManager.submitUserMessage('Build a TypeScript function to parse JSON');
```

3. Verify prompt structure in model call:
```typescript
// Inspect the prompt passed to model client
const capturedPrompt = turnManager.getLastPrompt();

console.log('Has user_instructions:', !!capturedPrompt.user_instructions);
console.log('Input length:', capturedPrompt.input.length);
console.log('Tools count:', capturedPrompt.tools.length);
```

**Expected Output**:
```
Has user_instructions: true
Input length: 1 (user message)
Tools count: 5+ (browser tools)
```

**Verification**:
- ✅ TurnManager builds Prompt with user_instructions
- ✅ Prompt includes all conversation context
- ✅ Tools array populated with browser tools
- ✅ Integration works end-to-end

---

## Success Criteria

All scenarios should complete without errors:

- [x] Scenario 1: Prompt structure matches Rust
- [x] Scenario 2: ResponsesApiRequest payload correct
- [x] Scenario 3: Stream method works end-to-end
- [x] Scenario 4: Azure handling works
- [x] Scenario 5: Retry logic behaves correctly
- [x] Scenario 6: TurnManager integration works

## Troubleshooting

### Issue: Instructions not combining correctly

**Solution**: Check `get_full_instructions()` implementation:
```typescript
// Should combine base + user
const instructions = [
  prompt.base_instructions_override || modelFamily.base_instructions,
  prompt.user_instructions,
]
  .filter(Boolean)
  .join('\n');
```

### Issue: store flag not set correctly

**Solution**: Verify Azure detection:
```typescript
const isAzure =
  provider.base_url?.includes('azure.com') &&
  provider.wire_api === 'Responses';
```

### Issue: Retry not working

**Solution**: Check error classification:
```typescript
function isRetryable(error: any): boolean {
  return error.type === 'RetryableHttpError' ||
         error.type === 'RetryableTransportError';
}
```

## Next Steps

After quickstart validation:
1. Run full test suite: `pnpm test`
2. Run integration tests: `pnpm test:integration`
3. Verify build: `pnpm build`
4. Test in Chrome extension environment
5. Update documentation in CLAUDE.md
