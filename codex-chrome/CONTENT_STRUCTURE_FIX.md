# Content Structure Fix

## Problem
Runtime error when processing stream completion:
```
Error: Task execution failed: n.content.map is not a function
```

## Root Cause

The `streamCompletion()` method was creating `message` ResponseItems with `content` as a **string**:

```typescript
// ❌ WRONG - content should be an array
{
  type: 'OutputItemDone',
  item: {
    type: 'message',
    role: 'assistant',
    content: assistantText,  // string - causes .map() error
  }
}
```

However, the `ResponseItem` type definition requires `content` to be a **ContentItem array**:

```typescript
// From src/protocol/types.ts Line 183-187
type ResponseItem = {
  type: 'message';
  role: string;
  content: ContentItem[];  // Array, not string!
}

// ContentItem types (Line 134-137)
type ContentItem =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'output_text'; text: string };
```

When `getResponseItemContent()` tried to call `item.content.map()`, it failed because `content` was a string, not an array.

## Solution

### Fixed Message Content Structure

**File**: `src/models/OpenAIClient.ts`

**Lines 820-830** (stream end) and **Lines 872-883** ([DONE]):
```typescript
// ✅ CORRECT - content is an array of ContentItem
if (assistantText) {
  yield {
    type: 'OutputItemDone',
    item: {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: assistantText }],  // Array!
    },
  };
}
```

### Fixed Reasoning Content Structure

**Lines 832-842** (stream end) and **Lines 885-895** ([DONE]):
```typescript
// ✅ CORRECT - reasoning needs summary and content arrays
if (reasoningText) {
  yield {
    type: 'OutputItemDone',
    item: {
      type: 'reasoning',
      summary: [],  // Required field
      content: [{ type: 'reasoning_text', text: reasoningText }],  // Array!
    },
  };
}
```

## Type Alignment

This fix ensures proper alignment with the Rust protocol types:

### Message ResponseItem
```typescript
{
  type: 'message';
  id?: string;
  role: string;
  content: ContentItem[];  // Must be array
}
```

### Reasoning ResponseItem
```typescript
{
  type: 'reasoning';
  id?: string;
  summary: ReasoningItemReasoningSummary[];  // Required
  content?: ReasoningItemContent[];  // Optional but must be array if present
  encrypted_content?: string;
}
```

### ContentItem Types
```typescript
// For assistant output
{ type: 'output_text'; text: string }

// For user input
{ type: 'input_text'; text: string }

// For images
{ type: 'input_image'; image_url: string }
```

### ReasoningItemContent Types
```typescript
{ type: 'reasoning_text'; text: string }
// or
{ type: 'text'; text: string }
```

## Where the Error Occurred

**File**: `src/protocol/types.ts` Line 239-245

```typescript
export function getResponseItemContent(item: ResponseItem): string {
  switch (item.type) {
    case 'message':
      return item.content.map(c => {  // ❌ Crashed here when content was string
        if (c.type === 'input_text' || c.type === 'output_text') {
          return c.text;
        }
        // ...
      }).join('');
```

This function expects `item.content` to be an array to call `.map()` on it.

## Files Modified

### src/models/OpenAIClient.ts
1. **Line 827**: Fixed message content structure (stream end path)
2. **Line 839**: Fixed reasoning content structure (stream end path)
3. **Line 879**: Fixed message content structure ([DONE] path)
4. **Line 892**: Fixed reasoning content structure ([DONE] path)

## Testing

Build succeeds:
```bash
npm run build
✅ Build complete!
```

## Before vs After

### Before (Broken)
```typescript
// String content - wrong type
yield {
  type: 'OutputItemDone',
  item: {
    type: 'message',
    role: 'assistant',
    content: 'Hello world',  // ❌ String
  }
};

// Later in getResponseItemContent():
item.content.map(...)  // ❌ Crashes - strings don't have .map()
```

### After (Fixed)
```typescript
// Array content - correct type
yield {
  type: 'OutputItemDone',
  item: {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Hello world' }],  // ✅ Array
  }
};

// Later in getResponseItemContent():
item.content.map(c => c.text)  // ✅ Works - arrays have .map()
```

## Impact

This fix ensures:
1. **Type Safety**: ResponseItem content matches protocol definition
2. **No Runtime Errors**: `.map()` can be called on content arrays
3. **Rust Alignment**: Matches the Rust protocol structure exactly
4. **Proper Content Extraction**: `getResponseItemContent()` works correctly

## Related Types

All ResponseItem content fields must be arrays:
- `message.content: ContentItem[]` ✅
- `reasoning.content?: ReasoningItemContent[]` ✅
- `reasoning.summary: ReasoningItemReasoningSummary[]` ✅
- `function_call_result.content?: FunctionCallResultContent[]` ✅

## Prevention

To prevent similar issues:

1. **Always Use Array for Content**: Never set content as a string
2. **Check Protocol Types**: Refer to `src/protocol/types.ts` for structure
3. **Wrap Text in Content Items**:
   - Assistant text → `[{ type: 'output_text', text: '...' }]`
   - User text → `[{ type: 'input_text', text: '...' }]`
   - Reasoning → `[{ type: 'reasoning_text', text: '...' }]`
4. **Include Required Fields**: Reasoning needs both `summary` and `content`

## Summary

- **Root Cause**: `content` was a string instead of ContentItem[]
- **Symptom**: `.map is not a function` error in getResponseItemContent()
- **Solution**: Wrap text in proper ContentItem objects within arrays
- **Result**: Proper type alignment with Rust protocol, no runtime errors
