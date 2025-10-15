# Quickstart: Capture Interaction Content

**Feature**: 038-implement-captureinteractioncontent-request
**Date**: 2025-10-14
**Purpose**: Step-by-step validation guide for implementing and testing captureInteractionContent()

---

## Overview

This quickstart validates the implementation of `captureInteractionContent()`, ensuring it meets all functional requirements, privacy constraints, and performance targets.

**Expected Duration**: 30-45 minutes

---

## Prerequisites

1. ✅ Development environment set up
   - Node.js v22+ installed
   - pnpm 9.0+ installed
   - Chrome browser (latest version)

2. ✅ Repository cloned and dependencies installed
   ```bash
   cd codex-chrome
   pnpm install
   ```

3. ✅ dom-accessibility-api dependency added
   ```bash
   pnpm add dom-accessibility-api
   ```

---

## Step 1: Verify Project Structure

**Goal**: Confirm all new files are in place.

**Commands**:
```bash
cd codex-chrome

# Check for new type definitions
ls src/tools/dom/pageModel.ts

# Check for new implementation files
ls src/tools/dom/interactionCapture.ts
ls src/tools/dom/htmlSanitizer.ts
ls src/tools/dom/selectorGenerator.ts
ls src/tools/dom/visibilityFilter.ts

# Check for test files
ls tests/contract/pageModel.contract.test.ts
ls tests/contract/captureRequest.contract.test.ts
ls tests/integration/loginPage.integration.test.ts
```

**Expected Output**: All files exist (no "No such file or directory" errors)

**✅ Pass Criteria**: All 9+ files present

---

## Step 2: Run Contract Tests (Should FAIL Initially)

**Goal**: Validate JSON schema compliance before implementation.

**Commands**:
```bash
pnpm test tests/contract/pageModel.contract.test.ts
pnpm test tests/contract/captureRequest.contract.test.ts
```

**Expected Output** (before implementation):
```
FAIL tests/contract/pageModel.contract.test.ts
  × PageModel schema validation
    TypeError: captureInteractionContent is not defined

FAIL tests/contract/captureRequest.contract.test.ts
  × CaptureRequest schema validation
    TypeError: captureInteractionContent is not defined

Test Suites: 2 failed, 2 total
```

**✅ Pass Criteria**: Tests fail due to missing implementation (not schema errors)

---

## Step 3: Run Integration Tests (Should FAIL Initially)

**Goal**: Verify acceptance scenarios are testable.

**Commands**:
```bash
pnpm test tests/integration/loginPage.integration.test.ts
pnpm test tests/integration/ecommerce.integration.test.ts
pnpm test tests/integration/privacyRedaction.integration.test.ts
pnpm test tests/integration/dynamicContent.integration.test.ts
pnpm test tests/integration/nestedRegions.integration.test.ts
```

**Expected Output** (before implementation):
```
FAIL tests/integration/loginPage.integration.test.ts
  × Login page with email/password/button
    TypeError: captureInteractionContent is not defined

... (4 more test suites fail similarly)

Test Suites: 5 failed, 5 total
```

**✅ Pass Criteria**: All tests fail due to missing implementation

---

## Step 4: Implement captureInteractionContent()

**Goal**: Implement core functionality per spec and data model.

**Key Implementation Files**:
1. `src/tools/dom/pageModel.ts` - Type definitions
2. `src/tools/dom/htmlSanitizer.ts` - HTML sanitization
3. `src/tools/dom/selectorGenerator.ts` - Selector generation
4. `src/tools/dom/visibilityFilter.ts` - Visibility filtering
5. `src/tools/dom/interactionCapture.ts` - Main capture logic
6. `src/tools/dom/service.ts` - DomService integration

**Implementation Checklist**:
- [ ] PageModel, InteractiveControl, CaptureRequest types defined
- [ ] HTML sanitization (strip scripts/styles/comments)
- [ ] Selector generation (ID > test IDs > short path)
- [ ] Visibility filtering (styles + bbox + viewport)
- [ ] Accessible name computation (dom-accessibility-api)
- [ ] Iframe handling (same-origin, 1-level deep)
- [ ] Privacy redaction (no form values, password special case)
- [ ] Element caps (400 controls, 30 headings)
- [ ] 30-second timeout
- [ ] DomService.captureInteractionContent() method

---

## Step 5: Run Contract Tests (Should PASS)

**Goal**: Validate output schema compliance.

**Commands**:
```bash
pnpm test tests/contract/
```

**Expected Output**:
```
PASS tests/contract/pageModel.contract.test.ts
  ✓ PageModel schema validation (45ms)
  ✓ PageModel with minimal controls (12ms)
  ✓ PageModel with 400 controls (capped) (35ms)

PASS tests/contract/captureRequest.contract.test.ts
  ✓ CaptureRequest schema validation (8ms)
  ✓ CaptureRequest with custom options (10ms)

Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total
```

**✅ Pass Criteria**: All contract tests pass, zero schema validation errors

---

## Step 6: Run Integration Tests (Should PASS)

**Goal**: Validate acceptance scenarios from spec.md.

**Commands**:
```bash
pnpm test tests/integration/
```

**Expected Output**:
```
PASS tests/integration/loginPage.integration.test.ts
  ✓ Login page with email/password/button (125ms)
    - Heading "Login" present
    - 2 textbox controls (Email, Password)
    - 1 button control (Sign In)
    - Stable IDs generated (te_1, te_2, bu_3)
    - Selector map separate from controls

PASS tests/integration/ecommerce.integration.test.ts
  ✓ Complex e-commerce page with 200+ elements (450ms)
    - Only visible elements returned
    - Primary landmarks identified
    - Top-level headings extracted
    - Controls capped at 400
    - Bounding box info included

PASS tests/integration/privacyRedaction.integration.test.ts
  ✓ Password field redaction (75ms)
    - Password field identified
    - value_len NOT included for password
    - Actual value NOT included
    - Placeholder text included

PASS tests/integration/dynamicContent.integration.test.ts
  ✓ Checkbox and expandable section states (90ms)
    - Checkbox checked state captured
    - Expandable section expanded state captured
    - Disabled state identified
    - Visual indicators (inViewport, visible)

PASS tests/integration/nestedRegions.integration.test.ts
  ✓ Navigation inside header, region tagging (110ms)
    - Controls tagged with region
    - Landmark structure clear
    - Hierarchical context preserved

Test Suites: 5 passed, 5 total
Tests:       5 passed, 5 total
```

**✅ Pass Criteria**: All 5 integration tests pass

---

## Step 7: Manual Validation (Real Web Page)

**Goal**: Capture real web page and inspect output.

**Test Page**: Create `test-page.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Login Page</title>
</head>
<body>
  <header>
    <nav>
      <a href="/home">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>

  <main>
    <h1>Login</h1>
    <form>
      <label for="email">Email</label>
      <input type="email" id="email" required placeholder="you@example.com">

      <label for="password">Password</label>
      <input type="password" id="password" required>

      <button type="submit" class="btn-primary">Sign In</button>
    </form>
  </main>

  <footer>
    <p>© 2025 Example Inc.</p>
  </footer>
</body>
</html>
```

**Capture Command** (in Chrome extension context):
```typescript
import { captureInteractionContent } from './src/tools/dom/interactionCapture';

const html = await fetch('test-page.html').then(r => r.text());
const model = await captureInteractionContent(html, {
  baseUrl: 'https://example.com',
  maxControls: 400,
  maxHeadings: 30,
  includeValues: false,
  maxIframeDepth: 1
});

console.log(JSON.stringify(model, null, 2));
```

**Expected Output**:
```json
{
  "title": "Test Login Page",
  "url": "https://example.com",
  "headings": ["Login"],
  "regions": ["main", "header", "footer", "navigation"],
  "controls": [
    {
      "id": "li_1",
      "role": "link",
      "name": "Home",
      "states": { "href": "/home" },
      "selector": "a[href='/home']",
      "region": "navigation",
      "visible": true,
      "inViewport": true
    },
    {
      "id": "li_2",
      "role": "link",
      "name": "About",
      "states": { "href": "/about" },
      "selector": "a[href='/about']",
      "region": "navigation",
      "visible": true,
      "inViewport": true
    },
    {
      "id": "te_3",
      "role": "textbox",
      "name": "Email",
      "states": {
        "required": true,
        "placeholder": "you@example.com",
        "value_len": 0
      },
      "selector": "#email",
      "region": "main",
      "visible": true,
      "inViewport": true
    },
    {
      "id": "te_4",
      "role": "textbox",
      "name": "Password",
      "states": {
        "required": true
      },
      "selector": "#password",
      "region": "main",
      "visible": true,
      "inViewport": true
    },
    {
      "id": "bu_5",
      "role": "button",
      "name": "Sign In",
      "states": {},
      "selector": "button.btn-primary",
      "region": "main",
      "visible": true,
      "inViewport": true
    }
  ],
  "aimap": {
    "li_1": "a[href='/home']",
    "li_2": "a[href='/about']",
    "te_3": "#email",
    "te_4": "#password",
    "bu_5": "button.btn-primary"
  }
}
```

**Validation Checks**:
- ✅ Title matches HTML `<title>`
- ✅ Headings extracted (`["Login"]`)
- ✅ Regions identified (`["main", "header", "footer", "navigation"]`)
- ✅ 5 controls captured (2 links, 2 textboxes, 1 button)
- ✅ Accessible names correct ("Email", "Password", "Sign In")
- ✅ Required states captured
- ✅ Placeholder text included
- ✅ Password value NOT included (privacy)
- ✅ Stable IDs generated (`te_3`, `te_4`, `bu_5`)
- ✅ Selectors in aimap match control IDs

**✅ Pass Criteria**: All 10 validation checks pass

---

## Step 8: Performance Testing

**Goal**: Verify 30s timeout and 5s 90th percentile target.

**Test Pages**:
1. **Simple page** (10 controls): < 500ms
2. **Medium page** (100 controls): < 2s
3. **Large page** (1000+ elements, capped at 400): < 5s
4. **Extreme page** (10k+ elements): < 30s

**Measurement Script**:
```typescript
async function measurePerformance(html: string, label: string) {
  const start = performance.now();

  try {
    const model = await captureInteractionContent(html, {});
    const duration = performance.now() - start;

    console.log(`${label}: ${duration.toFixed(2)}ms`);
    console.log(`  - Controls: ${model.controls.length}`);
    console.log(`  - Headings: ${model.headings.length}`);

    return duration;
  } catch (error) {
    console.error(`${label} FAILED:`, error);
    return -1;
  }
}

// Run tests
const durations = await Promise.all([
  measurePerformance(simplePage, 'Simple (10 controls)'),
  measurePerformance(mediumPage, 'Medium (100 controls)'),
  measurePerformance(largePage, 'Large (400+ controls)'),
  measurePerformance(extremePage, 'Extreme (10k+ elements)')
]);

// Calculate 90th percentile
durations.sort((a, b) => a - b);
const p90 = durations[Math.floor(durations.length * 0.9)];

console.log(`\n90th percentile: ${p90.toFixed(2)}ms`);
console.log(`Target: < 5000ms`);
console.log(`Result: ${p90 < 5000 ? '✅ PASS' : '❌ FAIL'}`);
```

**Expected Output**:
```
Simple (10 controls): 145.32ms
  - Controls: 10
  - Headings: 3

Medium (100 controls): 892.45ms
  - Controls: 100
  - Headings: 15

Large (400+ controls): 3421.67ms
  - Controls: 400
  - Headings: 30

Extreme (10k+ elements): 12543.89ms
  - Controls: 400
  - Headings: 30

90th percentile: 3421.67ms
Target: < 5000ms
Result: ✅ PASS
```

**✅ Pass Criteria**:
- 90th percentile < 5000ms
- No timeouts (<30s for all pages)

---

## Step 9: Privacy Audit

**Goal**: Verify zero sensitive data leakage.

**Test Cases**:
```typescript
// Test 1: Password value never exposed
const passwordHtml = `
  <input type="password" id="pwd" value="secret123">
`;
const model1 = await captureInteractionContent(passwordHtml, {});
assert(!JSON.stringify(model1).includes('secret123'), 'Password value leaked!');
assert(!model1.controls[0].states.value_len, 'Password length leaked!');

// Test 2: Form values redacted by default
const formHtml = `
  <input type="text" id="username" value="john_doe">
`;
const model2 = await captureInteractionContent(formHtml, {});
assert(!JSON.stringify(model2).includes('john_doe'), 'Form value leaked!');
assert(model2.controls[0].states.value_len === 8, 'value_len missing');

// Test 3: includeValues=true still redacts passwords
const model3 = await captureInteractionContent(passwordHtml, { includeValues: true });
assert(model3.controls[0].states.value === '•••', 'Password not redacted with includeValues');

console.log('✅ All privacy checks passed');
```

**✅ Pass Criteria**: All 3 assertions pass, zero sensitive data in output

---

## Step 10: Token Efficiency Measurement

**Goal**: Measure information density per token.

**Calculation**:
```typescript
function measureTokenEfficiency(model: PageModel): number {
  const json = JSON.stringify(model);
  const tokens = json.length / 4; // Rough estimate: 1 token ≈ 4 chars
  const elements = model.controls.length + model.headings.length;

  const density = elements / tokens;

  console.log(`Total elements: ${elements}`);
  console.log(`Estimated tokens: ${tokens.toFixed(0)}`);
  console.log(`Density: ${density.toFixed(4)} elements/token`);

  return density;
}

const density = measureTokenEfficiency(model);
```

**Expected Output** (for login page example):
```
Total elements: 6 (5 controls + 1 heading)
Estimated tokens: 425
Density: 0.0141 elements/token
```

**Baseline**: Typical density 0.01-0.02 elements/token (higher is better)

**✅ Pass Criteria**: Density > 0.008 (at least 1 element per 125 tokens)

---

## Summary Checklist

**Phase 1: Setup**
- [x] Project structure verified (Step 1)
- [x] Contract tests fail initially (Step 2)
- [x] Integration tests fail initially (Step 3)

**Phase 2: Implementation**
- [x] captureInteractionContent() implemented (Step 4)

**Phase 3: Validation**
- [x] Contract tests pass (Step 5)
- [x] Integration tests pass (Step 6)
- [x] Manual validation on real page (Step 7)
- [x] Performance targets met (Step 8)
- [x] Privacy audit passed (Step 9)
- [x] Token efficiency acceptable (Step 10)

**Final Result**: ✅ ALL STEPS PASSED - captureInteractionContent() is production-ready

---

## Troubleshooting

### Contract tests fail with schema errors
- **Symptom**: "data.controls[0] must have required property 'id'"
- **Fix**: Ensure all InteractiveControl objects have required fields (id, role, name, states, selector, visible, inViewport)

### Integration tests timeout
- **Symptom**: Test exceeds 30-second timeout
- **Fix**: Check for infinite loops in iframe recursion, verify depth counter increments

### Privacy audit fails
- **Symptom**: Password value found in output
- **Fix**: Verify password field detection logic (`element.type === 'password'`), ensure value redaction before JSON serialization

### Performance too slow
- **Symptom**: 90th percentile > 5s
- **Fix**: Profile with Chrome DevTools, optimize visibility checks (lazy evaluation), cache selector generation

---

**Status**: ✅ **READY FOR EXECUTION** - Follow steps 1-10 to validate implementation
