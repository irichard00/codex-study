# Quickstart Guide: DOMTool High-Level DOM Reading

**Feature**: 020-refactor-dom-tool
**Version**: 2.0.0

This guide demonstrates how to use the refactored DOMTool to capture and analyze complete DOM states in a single operation.

---

## Prerequisites

1. Chrome extension installed and loaded
2. Active browser tab with content loaded
3. Content script injection enabled

---

## Basic Usage

### 1. Capture DOM from Active Tab

```typescript
import { DOMTool } from './tools/DOMTool';

const domTool = new DOMTool();

// Capture DOM with default settings
const response = await domTool.captureDOM({});

if (response.success) {
  const { serialized_tree, selector_map, metadata } = response.dom_state;

  console.log('Captured DOM:', serialized_tree);
  console.log(`Total nodes: ${metadata.total_nodes}`);
  console.log(`Interactive elements: ${metadata.interactive_elements}`);
} else {
  console.error('DOM capture failed:', response.error);
}
```

**Expected Output**:
```
Captured DOM:
[1] <button class="primary">Submit</button>
[2] <input type="text" placeholder="Enter name" />
[3] <a href="/home">Home</a>
<div class="container">
  [4] <button class="secondary">Cancel</button>
</div>

Total nodes: 342
Interactive elements: 4
```

---

### 2. Capture DOM from Specific Tab

```typescript
const tabId = 123; // Chrome tab ID

const response = await domTool.captureDOM({
  tab_id: tabId
});

if (response.success) {
  console.log(`Captured DOM from tab ${tabId}`);
}
```

---

### 3. Access Element Details via selector_map

After capturing the DOM, look up detailed information about specific elements using the selector_map:

```typescript
// First, capture DOM
const captureResponse = await domTool.captureDOM({});

if (captureResponse.success) {
  const { serialized_tree, selector_map } = captureResponse.dom_state;

  // Look up element [1] from the selector_map
  const element = selector_map[1];

  if (element) {
    console.log('Element details:');
    console.log('  Tag:', element.node_name);
    console.log('  Attributes:', element.attributes);
    console.log('  Position:', element.absolute_position);
    console.log('  Visible:', element.is_visible);
    console.log('  Role:', element.ax_node?.role);
  }
}
```

**Expected Output**:
```
Element details:
  Tag: BUTTON
  Attributes: { class: 'primary', type: 'button' }
  Position: { x: 100, y: 200, width: 120, height: 40 }
  Visible: true
  Role: button
```

---

## Advanced Usage

### 4. Custom Capture Options

```typescript
const response = await domTool.captureDOM({
  // Include options
  include_shadow_dom: true,
  include_iframes: true,

  // Limits
  max_iframe_depth: 2,        // Only 2 levels of iframes
  max_iframe_count: 10,        // Max 10 iframes total

  // Filtering
  paint_order_filtering: true, // Remove occluded elements
  bbox_filtering: true,        // Remove off-screen elements

  // Performance
  timeout_ms: 3000,            // 3 second timeout
  use_cache: true,             // Use cached result if valid
  include_timing: true         // Include performance metrics
});

if (response.success) {
  const { timing } = response.dom_state;

  console.log('Performance:');
  console.log(`  DOM traversal: ${timing.dom_traversal_ms}ms`);
  console.log(`  Serialization: ${timing.serialization_ms}ms`);
  console.log(`  Total: ${timing.total_ms}ms`);
}
```

---

### 5. Handle Errors and Warnings

```typescript
const response = await domTool.captureDOM({ tab_id: 999 });

if (!response.success) {
  const { code, message, details } = response.error;

  switch (code) {
    case 'TAB_NOT_FOUND':
      console.error('Tab does not exist:', message);
      break;
    case 'TIMEOUT':
      console.error('Capture took too long:', message);
      break;
    case 'PERMISSION_DENIED':
      console.error('Cannot access tab:', message);
      break;
    default:
      console.error('Unknown error:', message);
  }
}

// Check warnings even on success
if (response.success && response.warnings) {
  for (const warning of response.warnings) {
    console.warn(`${warning.type}: ${warning.message}`);
  }
}
```

**Example Warnings**:
```
DEPTH_LIMIT_REACHED: Stopped at iframe depth 3
CROSS_ORIGIN_IFRAME_SKIPPED: Cannot access https://third-party.com
```

---

### 6. Work with Large Pages

For pages with many nodes (10,000+), optimize capture settings:

```typescript
const response = await domTool.captureDOM({
  // Aggressive filtering for large pages
  paint_order_filtering: true,
  bbox_filtering: true,

  // Reduce iframe processing
  max_iframe_depth: 1,
  max_iframe_count: 5,

  // Increase timeout
  timeout_ms: 10000
});

if (response.success) {
  const { total_nodes, interactive_elements } = response.dom_state.metadata;

  console.log(`Captured ${total_nodes} nodes`);
  console.log(`Reduced to ${interactive_elements} interactive elements`);
}
```

---

### 7. Cache Management

```typescript
// Capture with caching enabled (default)
const response1 = await domTool.captureDOM({ use_cache: true });
console.log('First capture:', response1.dom_state.timing.total_ms, 'ms');

// Second capture uses cache (should be much faster)
const response2 = await domTool.captureDOM({ use_cache: true });
console.log('Cached capture:', response2.dom_state.timing.total_ms, 'ms');

// Force fresh capture
const response3 = await domTool.captureDOM({ use_cache: false });
console.log('Fresh capture:', response3.dom_state.timing.total_ms, 'ms');

// Clear cache for specific tab
domTool.clearCache(123);

// Clear all caches
domTool.clearCache();
```

---

## Integration with Agent

### Example: Agent Task Using DOM Capture

```typescript
class FormFillingAgent {
  private domTool: DOMTool;

  constructor() {
    this.domTool = new DOMTool();
  }

  async fillForm(tabId: number, formData: Record<string, string>) {
    // Step 1: Capture complete DOM
    const captureResponse = await this.domTool.captureDOM({ tab_id: tabId });

    if (!captureResponse.success) {
      throw new Error(`Cannot capture DOM: ${captureResponse.error.message}`);
    }

    const { serialized_tree, selector_map } = captureResponse.dom_state;

    // Step 2: Parse serialized tree to find form elements
    // (In practice, this would be done by LLM analyzing the tree)
    console.log('Available form elements:');
    console.log(serialized_tree);

    // Step 3: Look up element details from selector_map
    // Example: Get details for input field [2]
    const inputElement = selector_map[2];

    if (inputElement) {
      console.log('Found input field:');
      console.log('  Placeholder:', inputElement.attributes.placeholder);
      console.log('  Type:', inputElement.attributes.type);
      console.log('  Position:', inputElement.absolute_position);

      // Step 4: Use element information for interaction
      // (Actual interaction would use a separate interaction tool)
      console.log(`Would type "${formData.name}" into element [2]`);
    }
  }
}

// Usage
const agent = new FormFillingAgent();
await agent.fillForm(123, { name: 'John Doe', email: 'john@example.com' });
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DOMTool } from './tools/DOMTool';

describe('DOMTool.captureDOM', () => {
  let domTool: DOMTool;

  beforeEach(() => {
    domTool = new DOMTool();
  });

  it('should capture DOM from active tab', async () => {
    const response = await domTool.captureDOM({});

    expect(response.success).toBe(true);
    expect(response.dom_state).toBeDefined();
    expect(response.dom_state.serialized_tree).toContain('[1]');
    expect(response.dom_state.metadata.total_nodes).toBeGreaterThan(0);
  });

  it('should handle tab not found error', async () => {
    const response = await domTool.captureDOM({ tab_id: 999999 });

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('TAB_NOT_FOUND');
  });

  it('should respect iframe depth limit', async () => {
    const response = await domTool.captureDOM({
      max_iframe_depth: 1
    });

    if (response.warnings) {
      const depthWarning = response.warnings.find(
        w => w.type === 'DEPTH_LIMIT_REACHED'
      );
      if (depthWarning) {
        expect(depthWarning.message).toContain('depth 1');
      }
    }
  });
});
```

---

## Performance Tips

1. **Use caching**: Enable `use_cache: true` for repeated captures
2. **Limit iframes**: Reduce `max_iframe_depth` and `max_iframe_count` for faster captures
3. **Enable filtering**: Keep `paint_order_filtering` and `bbox_filtering` enabled to reduce tree size
4. **Increase timeout**: For large pages, set `timeout_ms` to 10000 or more
5. **Monitor timing**: Use `include_timing: true` to identify bottlenecks

---

## Troubleshooting

### Issue: "Content script not loaded"

**Solution**: Ensure content script is injected before calling captureDOM
```typescript
// DOMTool automatically injects content script
// Just ensure tab has loaded content
await chrome.tabs.reload(tabId);
await new Promise(resolve => setTimeout(resolve, 1000));
await domTool.captureDOM({ tab_id: tabId });
```

### Issue: "Message size exceeded"

**Solution**: Enable aggressive filtering
```typescript
const response = await domTool.captureDOM({
  paint_order_filtering: true,
  bbox_filtering: true,
  max_iframe_count: 5,
  max_iframe_depth: 1
});
```

### Issue: Slow capture on complex pages

**Solution**: Adjust limits and increase timeout
```typescript
const response = await domTool.captureDOM({
  max_iframe_depth: 1,
  timeout_ms: 15000
});
```

---

## Migration from v1.x

If you're upgrading from DOMTool v1.x (atomic operations):

**Old way (v1.x)**:
```typescript
// Multiple round trips
const queryResult = await domTool.query({ selector: 'button' });
const button = queryResult.elements[0];
const textResult = await domTool.getText({ selector: 'button' });
const attrResult = await domTool.getAttribute({ selector: 'button', attribute: 'class' });
```

**New way (v2.0)**:
```typescript
// Single capture
const response = await domTool.captureDOM({});
const { serialized_tree, selector_map } = response.dom_state;

// Parse tree to find button (e.g., [1])
// Get all details from selector_map
const button = selector_map[1];

console.log(button.node_name); // BUTTON
console.log(button.snapshot_node.text_value); // Button text
console.log(button.attributes.class); // Button class
```

**Benefits**:
- 1 operation instead of 3+
- Complete page context available
- Better for LLM analysis
- More efficient

---

## Next Steps

- Read [data-model.md](./data-model.md) for detailed data structure documentation
- Read [contracts/dom-tool-api.ts](./contracts/dom-tool-api.ts) for full API reference
- See [research.md](./research.md) for implementation details
- Run tests: `npm test tests/tools/DOMTool.test.ts`
