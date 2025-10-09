# Contract: Prompt Interface

**Feature**: 016-refactor-the-request
**Status**: Draft
**Rust Reference**: `codex-rs/core/src/client_common.rs:24-69`

## Interface Definition

```typescript
interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[];

  /** Tools available to the model */
  tools: ToolSpec[];

  /** Optional override for base instructions */
  base_instructions_override?: string;

  /** Optional user instructions (development guidelines) */
  user_instructions?: string;

  /** Optional output schema for structured responses */
  output_schema?: any;
}

/**
 * Get full instructions by combining base + user instructions
 * Matches Rust: impl Prompt::get_full_instructions(&self, model: &ModelFamily)
 */
function get_full_instructions(prompt: Prompt, model: ModelFamily): string;

/**
 * Get formatted input for API request
 * Matches Rust: impl Prompt::get_formatted_input(&self)
 */
function get_formatted_input(prompt: Prompt): ResponseItem[];
```

## Contract Tests

### Test 1: Prompt Structure Alignment

**Test Name**: `test_prompt_structure_matches_rust`

**Purpose**: Verify Prompt interface fields match Rust struct exactly

**Test Implementation**:
```typescript
import { describe, it, expect } from 'vitest';

describe('Prompt Interface Contract', () => {
  it('should have all required fields matching Rust', () => {
    const prompt: Prompt = {
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }
      ],
      tools: [],
    };

    // Verify required fields
    expect(prompt).toHaveProperty('input');
    expect(prompt).toHaveProperty('tools');

    // Verify input is ResponseItem[]
    expect(Array.isArray(prompt.input)).toBe(true);
    expect(prompt.input[0]).toHaveProperty('type');

    // Verify tools is ToolSpec[]
    expect(Array.isArray(prompt.tools)).toBe(true);
  });

  it('should support optional fields', () => {
    const prompt: Prompt = {
      input: [],
      tools: [],
      base_instructions_override: 'Custom instructions',
      user_instructions: 'Development guidelines',
      output_schema: { type: 'object' },
    };

    expect(prompt.base_instructions_override).toBe('Custom instructions');
    expect(prompt.user_instructions).toBe('Development guidelines');
    expect(prompt.output_schema).toEqual({ type: 'object' });
  });
});
```

**Expected Result**: Test passes, all fields present

---

### Test 2: get_full_instructions Method

**Test Name**: `test_get_full_instructions_combines_base_and_user`

**Purpose**: Verify get_full_instructions() combines base + user instructions correctly

**Rust Reference**: `client_common.rs:42-64`

**Test Implementation**:
```typescript
describe('get_full_instructions()', () => {
  it('should return base instructions when no override', () => {
    const prompt: Prompt = {
      input: [],
      tools: [],
    };

    const model: ModelFamily = {
      family: 'gpt-5',
      base_instructions: 'You are a helpful assistant.',
      supports_reasoning_summaries: true,
      needs_special_apply_patch_instructions: false,
    };

    const result = get_full_instructions(prompt, model);

    expect(result).toBe('You are a helpful assistant.');
  });

  it('should use override when provided', () => {
    const prompt: Prompt = {
      input: [],
      tools: [],
      base_instructions_override: 'Custom system prompt',
    };

    const model: ModelFamily = {
      family: 'gpt-5',
      base_instructions: 'You are a helpful assistant.',
      supports_reasoning_summaries: true,
      needs_special_apply_patch_instructions: false,
    };

    const result = get_full_instructions(prompt, model);

    expect(result).toBe('Custom system prompt');
  });

  it('should combine base and user instructions', () => {
    const prompt: Prompt = {
      input: [],
      tools: [],
      user_instructions: 'Follow coding best practices.',
    };

    const model: ModelFamily = {
      family: 'gpt-5',
      base_instructions: 'You are a coding assistant.',
      supports_reasoning_summaries: true,
      needs_special_apply_patch_instructions: false,
    };

    const result = get_full_instructions(prompt, model);

    // Should contain both base and user instructions
    expect(result).toContain('You are a coding assistant.');
    expect(result).toContain('Follow coding best practices.');
  });
});
```

**Expected Result**: All tests pass, instructions combined correctly

---

### Test 3: get_formatted_input Method

**Test Name**: `test_get_formatted_input_returns_cloned_array`

**Purpose**: Verify get_formatted_input() returns cloned input array

**Rust Reference**: `client_common.rs:66-68`

**Test Implementation**:
```typescript
describe('get_formatted_input()', () => {
  it('should return cloned input array', () => {
    const originalInput: ResponseItem[] = [
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hi' }] },
    ];

    const prompt: Prompt = {
      input: originalInput,
      tools: [],
    };

    const result = get_formatted_input(prompt);

    // Should be equal but not same reference
    expect(result).toEqual(originalInput);
    expect(result).not.toBe(originalInput);

    // Verify deep clone
    expect(result.length).toBe(2);
    expect(result[0]).toEqual(originalInput[0]);
  });

  it('should preserve all ResponseItem types', () => {
    const prompt: Prompt = {
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
        { type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{}' },
        { type: 'function_call_output', call_id: 'call_1', output: 'sunny' },
      ],
      tools: [],
    };

    const result = get_formatted_input(prompt);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('message');
    expect(result[1].type).toBe('function_call');
    expect(result[2].type).toBe('function_call_output');
  });
});
```

**Expected Result**: Tests pass, input cloned correctly

---

## Acceptance Criteria

- [ ] Prompt interface defined with all Rust fields
- [ ] get_full_instructions() function implemented
- [ ] get_formatted_input() function implemented
- [ ] Contract tests written and failing (no implementation yet)
- [ ] Tests verify exact alignment with Rust behavior

## Dependencies

- `ResponseItem` type from protocol (already aligned)
- `ToolSpec` type (to be defined)
- `ModelFamily` interface

## Implementation Notes

1. get_full_instructions() should:
   - Use `base_instructions_override` if present, otherwise `model.base_instructions`
   - Append `user_instructions` if present
   - Handle apply_patch tool instructions if needed (future enhancement)

2. get_formatted_input() should:
   - Return a shallow clone of the input array
   - Preserve all ResponseItem structure and types

3. TypeScript implementation differs from Rust:
   - Rust uses methods on struct (`impl Prompt`)
   - TypeScript uses standalone functions (better for functional composition)
   - Both patterns are equivalent in behavior
