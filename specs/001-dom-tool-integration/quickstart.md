# Quickstart Guide: DOM Tool Integration

## Overview
This guide demonstrates how to use the integrated DOM tool in the Codex Chrome Extension to automate browser interactions.

## Prerequisites
- Chrome browser (version 100+)
- Codex Chrome Extension installed
- Active tab with a web page loaded

## Basic Usage

### 1. Query DOM Elements
Find elements on the page using CSS selectors:

```typescript
// Find a single element
const result = await domTool.execute({
  action: 'query',
  selector: 'button.submit-btn'
});

// Find multiple elements
const results = await domTool.execute({
  action: 'query',
  selector: 'input[type="text"]',
  options: { multiple: true }
});
```

### 2. Click Elements
Simulate click interactions:

```typescript
// Simple click
await domTool.execute({
  action: 'click',
  selector: '#login-button'
});

// Click with options
await domTool.execute({
  action: 'click',
  selector: '.menu-item',
  options: {
    scrollIntoView: true,
    force: true  // Click even if partially obscured
  }
});
```

### 3. Type Text
Enter text into input fields:

```typescript
// Type into input field
await domTool.execute({
  action: 'type',
  selector: 'input[name="username"]',
  text: 'john.doe@example.com'
});

// Type with clearing existing content
await domTool.execute({
  action: 'type',
  selector: '#search-box',
  text: 'chrome extension',
  options: {
    clear: true,
    delay: 50  // Delay between keystrokes
  }
});
```

### 4. Extract Content
Get text or HTML from elements:

```typescript
// Get text content
const textResult = await domTool.execute({
  action: 'getText',
  selector: 'h1.page-title'
});
console.log(textResult.text);

// Get HTML content
const htmlResult = await domTool.execute({
  action: 'getHtml',
  selector: '.article-content'
});
console.log(htmlResult.html);
```

### 5. Form Operations
Fill and submit forms:

```typescript
// Fill entire form
await domTool.execute({
  action: 'fillForm',
  formData: {
    username: 'john.doe',
    email: 'john@example.com',
    password: 'secure123'
  },
  formSelector: '#signup-form'
});

// Submit form
await domTool.execute({
  action: 'submit',
  selector: '#signup-form'
});
```

## Advanced Features

### Wait for Elements
Handle dynamic content:

```typescript
// Wait for element to appear
const element = await domTool.waitForElement(
  tabId,
  '.dynamic-content',
  5000  // 5 second timeout
);

// Wait for element to be visible
const visible = await domTool.waitForVisible(
  tabId,
  '#loading-complete',
  10000
);
```

### Execute Action Sequences
Perform multiple actions in order:

```typescript
const results = await domTool.executeSequence(tabId, [
  { action: 'click', selector: '#open-menu' },
  { action: 'waitForElement', selector: '.menu-items' },
  { action: 'click', selector: '.menu-item:nth-child(2)' },
  { action: 'type', selector: '#search', text: 'test' },
  { action: 'submit', selector: 'form' }
]);
```

### Capture DOM Snapshot
Get complete DOM state:

```typescript
const snapshot = await domTool.execute({
  action: 'captureSnapshot'
});

console.log('Captured', snapshot.nodeCount, 'nodes');
console.log('Documents:', snapshot.documentCount);
```

### Get Accessibility Tree
Extract semantic structure:

```typescript
const accessibilityTree = await domTool.execute({
  action: 'getAccessibilityTree'
});

// Navigate tree structure
function printTree(node, depth = 0) {
  console.log('  '.repeat(depth), node.role, node.name);
  node.children?.forEach(child => printTree(child, depth + 1));
}
printTree(accessibilityTree.tree[0]);
```

## Error Handling

### Common Errors

```typescript
try {
  await domTool.execute({
    action: 'click',
    selector: '.non-existent'
  });
} catch (error) {
  switch (error.code) {
    case 'ELEMENT_NOT_FOUND':
      console.log('Element does not exist');
      break;
    case 'ELEMENT_NOT_VISIBLE':
      console.log('Element is hidden');
      break;
    case 'ELEMENT_NOT_INTERACTABLE':
      console.log('Element cannot be clicked');
      break;
    case 'TIMEOUT':
      console.log('Operation timed out');
      break;
  }
}
```

### Retry Logic
Automatically retry failed operations:

```typescript
const executeWithRetry = async (request, maxRetries = 3) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await domTool.execute(request);
    } catch (error) {
      lastError = error;
      if (error.code === 'TIMEOUT' || error.code === 'ELEMENT_NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;  // Don't retry other errors
    }
  }

  throw lastError;
};
```

## Working with Frames

### Access iframe Content
```typescript
// Target element in iframe
await domTool.execute({
  action: 'click',
  selector: 'button',
  options: {
    frameSelector: 'iframe#payment-frame'
  }
});

// Note: Cross-origin iframes have limited access
```

## Performance Tips

### 1. Batch Operations
Minimize message passing overhead:

```typescript
// Instead of multiple individual calls
await domTool.execute({ action: 'click', selector: '#btn1' });
await domTool.execute({ action: 'click', selector: '#btn2' });

// Use sequence for better performance
await domTool.executeSequence(tabId, [
  { action: 'click', selector: '#btn1' },
  { action: 'click', selector: '#btn2' }
]);
```

### 2. Selector Optimization
Use efficient selectors:

```typescript
// Good - specific ID or class
'#submit-button'
'.primary-action'

// Avoid - overly complex
'div > span > button:nth-child(3) > span.text'

// Better - direct selection
'button[data-action="submit"]'
```

### 3. Visibility Checks
Check visibility before interaction:

```typescript
const isVisible = await domTool.execute({
  action: 'checkVisibility',
  selector: '#dynamic-button'
});

if (isVisible) {
  await domTool.execute({
    action: 'click',
    selector: '#dynamic-button'
  });
}
```

## Testing Your Integration

### Unit Test Example
```typescript
describe('DOM Tool Integration', () => {
  it('should find elements by selector', async () => {
    const result = await domTool.execute({
      action: 'query',
      selector: 'button'
    });

    expect(result.elements).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
  });

  it('should click elements', async () => {
    const result = await domTool.execute({
      action: 'click',
      selector: '#test-button'
    });

    expect(result.clicked).toBe(true);
  });
});
```

### Integration Test Example
```typescript
describe('Form Automation', () => {
  it('should fill and submit a form', async () => {
    // Fill form
    await domTool.execute({
      action: 'fillForm',
      formData: {
        email: 'test@example.com',
        password: 'test123'
      }
    });

    // Submit
    await domTool.execute({
      action: 'submit',
      selector: 'form#login'
    });

    // Wait for result
    const success = await domTool.waitForElement(
      tabId,
      '.success-message',
      5000
    );

    expect(success).toBeTruthy();
  });
});
```

## Troubleshooting

### Content Script Not Injected
```typescript
// Manually inject content script
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['/content/content-script.js']
});
```

### Element Not Found
1. Verify selector in browser DevTools
2. Check if element is in iframe
3. Ensure page is fully loaded
4. Try waiting for element

### Cross-Origin Issues
- Same-origin iframes: Full access
- Cross-origin iframes: Limited to frame existence check
- Workaround: Use browser automation tools for cross-origin

## Next Steps

1. Review the [Data Model](./data-model.md) for entity details
2. Check [API Contracts](./contracts/) for complete interface definitions
3. Explore advanced serialization and paint order features
4. Implement custom automation workflows

## Support

For issues or questions:
- Check existing implementations in `codex-chrome/src/tools/dom/`
- Review test cases in `codex-chrome/tests/`
- Consult Chrome Extension documentation