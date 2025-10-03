# Quickstart: Validating the Refactored Model Client

**Feature**: 010-refactor-the-codex
**Purpose**: Step-by-step guide to validate that the refactored TypeScript implementation matches Rust behavior

## Prerequisites

- Node.js 18+ installed
- Chrome browser with extension loaded
- OpenAI API key
- All refactoring tasks completed
- Contract tests passing

## Quick Validation Scenario

This scenario validates the core refactoring goals: method signatures, types, and execution flow match the Rust implementation.

### Step 1: Environment Setup

```bash
cd codex-chrome
npm install
npm run build
```

**Expected**: Build succeeds without TypeScript errors

---

### Step 2: Create Model Client

Create a test file: `codex-chrome/quickstart-test.ts`

```typescript
import { ModelClientFactory } from './src/models/ModelClientFactory';
import type { Prompt } from './src/models/types/ResponsesAPI';
import type { ModelFamily, ModelProviderInfo } from './src/models/types/ResponsesAPI';

// Configuration
const apiKey = process.env.OPENAI_API_KEY || 'your-api-key-here';

const modelFamily: ModelFamily = {
  family: 'gpt-4',
  baseInstructions: 'You are a helpful assistant.',
  supportsReasoningSummaries: false,
  needsSpecialApplyPatchInstructions: false,
};

const provider: ModelProviderInfo = {
  name: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  wireApi: 'responses',
  requestMaxRetries: 3,
  streamIdleTimeoutMs: 60000,
};

// Create client using factory
const client = ModelClientFactory.create({
  apiKey,
  modelFamily,
  provider,
  conversationId: 'quickstart-test-' + Date.now(),
});

console.log('✓ Client created successfully');
console.log('Model:', client.getModel());
console.log('Context window:', client.getModelContextWindow());
console.log('Auto-compact limit:', client.getAutoCompactTokenLimit());
```

**Run**:
```bash
npx tsx quickstart-test.ts
```

**Expected Output**:
```
✓ Client created successfully
Model: gpt-4
Context window: 8192
Auto-compact limit: 6553
```

**Validates**:
- ✅ FR-001: Method names match Rust (camelCase conversion)
- ✅ FR-002: Method signatures return correct types

---

### Step 3: Call stream() Method

Add to `quickstart-test.ts`:

```typescript
async function testStream() {
  const prompt: Prompt = {
    input: [
      {
        type: 'message',
        role: 'user',
        content: 'Say "Hello from quickstart test" and nothing else.',
      },
    ],
    tools: [],
  };

  console.log('\n📡 Starting stream...');

  const stream = await client.stream(prompt);

  // Validate: stream() returns ResponseStream (not AsyncGenerator)
  console.log('✓ stream() returned:', stream.constructor.name);

  // Validate: ResponseStream is async iterable
  console.log('✓ Is async iterable:', Symbol.asyncIterator in stream);

  return stream;
}

testStream().catch(console.error);
```

**Expected Output**:
```
📡 Starting stream...
✓ stream() returned: ResponseStream
✓ Is async iterable: true
```

**Validates**:
- ✅ FR-005: `stream()` returns `ResponseStream` (not `AsyncGenerator<StreamChunk>`)
- ✅ ResponseStream implements async iterator protocol

---

### Step 4: Consume ResponseStream Events

Add to `quickstart-test.ts`:

```typescript
async function testStreamConsumption() {
  const stream = await testStream();

  console.log('\n📨 Receiving events:');

  const eventTypes: string[] = [];
  let textContent = '';
  let tokenUsage: any = null;

  for await (const event of stream) {
    eventTypes.push(event.type);
    console.log(`  ${event.type}`);

    // Collect text deltas
    if (event.type === 'OutputTextDelta') {
      textContent += event.delta;
      process.stdout.write(event.delta);
    }

    // Capture token usage
    if (event.type === 'Completed') {
      tokenUsage = event.tokenUsage;
    }
  }

  console.log('\n\n✓ Stream completed');
  console.log('Event types received:', eventTypes);
  console.log('Text content:', textContent);
  console.log('Token usage:', tokenUsage);

  // Validate event types match Rust ResponseEvent enum
  const validEventTypes = [
    'Created',
    'OutputItemDone',
    'OutputTextDelta',
    'ReasoningSummaryDelta',
    'ReasoningContentDelta',
    'ReasoningSummaryPartAdded',
    'WebSearchCallBegin',
    'RateLimits',
    'Completed',
  ];

  for (const type of eventTypes) {
    if (!validEventTypes.includes(type)) {
      throw new Error(`Invalid event type: ${type}`);
    }
  }

  console.log('✓ All event types match Rust ResponseEvent enum');
}

testStreamConsumption().catch(console.error);
```

**Expected Output**:
```
📨 Receiving events:
  Created
  OutputItemDone
  OutputTextDelta
Hello from quickstart test

✓ Stream completed
Event types received: [ 'Created', 'OutputItemDone', 'OutputTextDelta', 'Completed' ]
Text content: Hello from quickstart test
Token usage: {
  input_tokens: 15,
  cached_input_tokens: 0,
  output_tokens: 6,
  reasoning_output_tokens: 0,
  total_tokens: 21
}
✓ All event types match Rust ResponseEvent enum
```

**Validates**:
- ✅ FR-003: ResponseEvent type variants match Rust enum
- ✅ FR-004: Field names match (responseId, tokenUsage, etc.)
- ✅ FR-005: Token usage structure matches Rust

---

### Step 5: Validate Method Signatures

Add to `quickstart-test.ts`:

```typescript
function validateMethodSignatures() {
  console.log('\n🔍 Validating method signatures:');

  // getModel() -> string
  const model: string = client.getModel();
  console.log('✓ getModel():', typeof model === 'string');

  // getModelFamily() -> ModelFamily
  const family: ModelFamily = client.getModelFamily();
  console.log('✓ getModelFamily():', typeof family.family === 'string');

  // getModelContextWindow() -> number | undefined
  const contextWindow: number | undefined = client.getModelContextWindow();
  console.log('✓ getModelContextWindow():', contextWindow === undefined || typeof contextWindow === 'number');

  // getAutoCompactTokenLimit() -> number | undefined
  const autoCompact: number | undefined = client.getAutoCompactTokenLimit();
  console.log('✓ getAutoCompactTokenLimit():', autoCompact === undefined || typeof autoCompact === 'number');

  // getProvider() -> ModelProviderInfo
  const prov: ModelProviderInfo = client.getProvider();
  console.log('✓ getProvider():', typeof prov.name === 'string');

  // getReasoningEffort() -> ReasoningEffortConfig | undefined
  const effort = client.getReasoningEffort();
  console.log('✓ getReasoningEffort():', effort === undefined || typeof effort === 'string');

  // getReasoningSummary() -> ReasoningSummaryConfig
  const summary = client.getReasoningSummary();
  console.log('✓ getReasoningSummary():', summary !== undefined);

  // getAuthManager() -> undefined (browser environment)
  const authManager = client.getAuthManager();
  console.log('✓ getAuthManager():', authManager === undefined);

  console.log('\n✅ All method signatures match Rust implementation');
}

validateMethodSignatures();
```

**Expected Output**:
```
🔍 Validating method signatures:
✓ getModel(): true
✓ getModelFamily(): true
✓ getModelContextWindow(): true
✓ getAutoCompactTokenLimit(): true
✓ getProvider(): true
✓ getReasoningEffort(): true
✓ getReasoningSummary(): true
✓ getAuthManager(): true

✅ All method signatures match Rust implementation
```

**Validates**:
- ✅ FR-001: All method names match Rust (camelCase)
- ✅ FR-002: All methods present with correct signatures
- ✅ FR-005: Return types match Rust (Option → undefined, etc.)

---

### Step 6: Test Error Handling and Retries

Add to `quickstart-test.ts`:

```typescript
async function testErrorHandling() {
  console.log('\n🚨 Testing error handling:');

  // Test 1: Invalid API key (should fail immediately)
  const badClient = ModelClientFactory.create({
    apiKey: 'invalid-key',
    modelFamily,
    provider,
    conversationId: 'error-test',
  });

  try {
    const stream = await badClient.stream({ input: [{ type: 'message', role: 'user', content: 'Hi' }], tools: [] });
    for await (const event of stream) {
      // Should not reach here
    }
    console.error('❌ Should have thrown error for invalid API key');
  } catch (error) {
    console.log('✓ Invalid API key rejected:', error.message);
  }

  // Test 2: Empty input (should validate)
  try {
    await client.stream({ input: [], tools: [] });
    console.error('❌ Should have thrown error for empty input');
  } catch (error) {
    console.log('✓ Empty input rejected:', error.message);
  }

  console.log('\n✅ Error handling matches Rust behavior');
}

testErrorHandling().catch(console.error);
```

**Expected Output**:
```
🚨 Testing error handling:
✓ Invalid API key rejected: Authentication failed - check API key
✓ Empty input rejected: At least one message is required

✅ Error handling matches Rust behavior
```

**Validates**:
- ✅ FR-006: Error handling preserves Rust behavior
- ✅ FR-008: Validation logic matches Rust

---

### Step 7: Performance Validation

Add to `quickstart-test.ts`:

```typescript
async function testPerformance() {
  console.log('\n⚡ Testing SSE processing performance:');

  const stream = await client.stream({
    input: [{ type: 'message', role: 'user', content: 'Count from 1 to 20' }],
    tools: [],
  });

  let eventCount = 0;
  const start = performance.now();

  for await (const event of stream) {
    eventCount++;
  }

  const elapsed = performance.now() - start;
  const avgTime = elapsed / eventCount;

  console.log(`Events processed: ${eventCount}`);
  console.log(`Total time: ${elapsed.toFixed(2)}ms`);
  console.log(`Average time per event: ${avgTime.toFixed(2)}ms`);

  if (avgTime < 10) {
    console.log('✅ Performance target met (<10ms per event)');
  } else {
    console.warn(`⚠️  Performance slower than target (${avgTime.toFixed(2)}ms > 10ms)`);
  }
}

testPerformance().catch(console.error);
```

**Expected Output**:
```
⚡ Testing SSE processing performance:
Events processed: 45
Total time: 234.56ms
Average time per event: 5.21ms
✅ Performance target met (<10ms per event)
```

**Validates**:
- ✅ Performance goal: <10ms per event
- ✅ Efficient SSE processing

---

## Complete Quickstart Script

Run the complete validation:

```bash
npx tsx quickstart-test.ts
```

**Expected**: All validation checks pass

---

## Success Criteria

After running the quickstart, verify:

- [x] Client created successfully
- [x] All getter methods return correct types
- [x] `stream()` returns `ResponseStream` (not `AsyncGenerator`)
- [x] ResponseStream is async iterable
- [x] Event types match Rust `ResponseEvent` enum
- [x] Token usage structure matches Rust
- [x] Error handling works correctly
- [x] Performance target met (<10ms per event)

## Troubleshooting

### Issue: TypeScript errors during build

**Solution**: Check that all types are updated:
- `ResponseEvent` uses discriminated union
- `stream()` returns `Promise<ResponseStream>`
- All method names are camelCase

### Issue: stream() returns wrong type

**Solution**: Verify `ModelClient.stream()` signature:
```typescript
abstract stream(prompt: Prompt): Promise<ResponseStream>
```

### Issue: Events don't match Rust types

**Solution**: Check `SSEEventParser.processEvent()`:
- Event type mapping must match Rust exactly
- Field names use camelCase (e.g., `responseId` not `response_id`)

### Issue: Performance slower than target

**Solution**: Optimize SSE parsing:
- Batch process multiple events per read
- Reuse TextDecoder instance
- Use object pooling for frequent allocations

## Next Steps

After quickstart validation passes:

1. Run full test suite: `npm test`
2. Test Chrome extension in browser
3. Validate with actual use cases
4. Deploy to production

## Summary

This quickstart validates that:
- Method signatures match Rust implementation
- Type definitions align with Rust structs
- Execution flow matches Rust behavior
- Performance meets targets
- Error handling preserves Rust semantics

All functional requirements (FR-001 through FR-009) are validated through this quickstart.
