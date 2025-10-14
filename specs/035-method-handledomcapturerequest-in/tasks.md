# Tasks: Fix DOM Capture Handler and Enable Source Maps

**Input**: Design documents from `/specs/035-method-handledomcapturerequest-in/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md
**Feature Branch**: `035-method-handledomcapturerequest-in`

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.9.2, Vite 5.4.20, Vitest 3.2.4
   → Structure: Chrome Extension (codex-chrome/)
2. Load optional design documents ✓
   → research.md: 4 critical bugs identified
   → data-model.md: TraversalResult needs elementMap
   → contracts/: 2 contract test files (dom-capture, source-maps)
3. Generate tasks by category ✓
   → Setup: Verify environment
   → Tests: Run contract tests (should fail initially)
   → Core: Fix traversal, capture, and source maps
   → Integration: Validate fixes
   → Polish: Performance testing, documentation
4. Apply task rules ✓
   → Tests before implementation (TDD)
   → Sequential dependencies respected
   → [P] for parallel-safe tasks
5. Number tasks sequentially ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- All paths relative to repository root

## Path Conventions
**Chrome Extension Structure** (from plan.md):
- Source files: `codex-chrome/src/`
- Tests: `codex-chrome/src/**/__tests__/` (co-located with source)
- Build config: `codex-chrome/vite.config.content.mjs`
- Contracts: `specs/035-method-handledomcapturerequest-in/contracts/`

---

## Phase 3.1: Setup & Prerequisites

### T001: Verify development environment and dependencies
**File**: N/A (environment check)
**Description**: Verify Node.js 18+, Chrome 120+, and all npm dependencies are installed
**Commands**:
```bash
cd codex-chrome
node --version  # Should be 18+
npm --version
npm install     # Ensure all dependencies present
npm run type-check  # Verify TypeScript compiles
```
**Success Criteria**:
- No missing dependencies
- TypeScript compilation succeeds
- Vitest can be executed

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL**: These tests MUST be run and MUST FAIL before ANY implementation changes.
This validates that the bugs exist and that our tests detect them.

### T002: [P] Run DOM capture contract tests (expect failures)
**File**: `specs/035-method-handledomcapturerequest-in/contracts/dom-capture.contract.ts`
**Description**: Run the DOM capture contract tests to verify they fail, confirming the bugs exist
**Commands**:
```bash
cd codex-chrome
npm run test -- ../specs/035-method-handledomcapturerequest-in/contracts/dom-capture.contract.ts
```
**Expected Failures**:
- FR-001: "should return non-empty nodes array" ❌
- FR-003: "should attach snapshot to all element nodes" ❌
- FR-004: "should attach axNode to all element nodes" ❌
- FR-005: "should have elementMap with correct size" ❌
- FR-006: "should use string indices in nodeName" ❌

**Success Criteria**: Tests run and fail as expected (confirming bugs exist)

### T003: [P] Run source map contract tests (expect failures)
**File**: `specs/035-method-handledomcapturerequest-in/contracts/source-maps.contract.ts`
**Description**: Run the source map contract tests to verify they fail or warn about missing maps
**Commands**:
```bash
cd codex-chrome
npm run build
npm run test -- ../specs/035-method-handledomcapturerequest-in/contracts/source-maps.contract.ts
```
**Expected Failures/Warnings**:
- FR-008: "should generate content.js.map file" (may pass if Vite generates map)
- FR-009: "should include sourceMappingURL comment" ❌ (likely fails)
- FR-010: "should include TypeScript source files" (may pass)

**Success Criteria**: Tests identify missing sourceMappingURL comment

### T004: Create integration test for complete DOM capture flow
**File**: `codex-chrome/src/content/__tests__/domCapture.integration.test.ts`
**Description**: Create integration test that verifies end-to-end DOM capture with populated data
**Test Cases**:
```typescript
describe('DOM Capture Integration', () => {
  it('captures complete page snapshot with all data', () => {
    // Set up test DOM
    document.body.innerHTML = `
      <div id="root" class="container">
        <h1>Test</h1>
        <button type="button">Click</button>
      </div>
    `;

    // Capture DOM
    const result = captureDOMSnapshot({});

    // Verify structure
    expect(result.documents[0].nodes.length).toBeGreaterThan(0);

    // Verify element nodes have snapshots
    const elements = result.documents[0].nodes.filter(n => n.nodeType === 1);
    elements.forEach(el => {
      expect(el.snapshot).toBeDefined();
      expect(el.axNode).toBeDefined();
    });

    // Verify string interning
    expect(result.strings.length).toBeGreaterThan(0);
    elements.forEach(el => {
      expect(typeof el.nodeName).toBe('number');
      expect(el.nodeName).toBeLessThan(result.strings.length);
    });
  });
});
```
**Success Criteria**: Test file created, test fails (confirms bugs)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### T005: Update TraversalResult interface to include elementMap
**File**: `codex-chrome/src/tools/dom/chrome/domTraversal.ts`
**Description**: Add `elementMap: Map<number, Element>` field to TraversalResult interface
**Line**: ~56-65
**Change**:
```typescript
// BEFORE:
export interface TraversalResult {
  nodes: TraversedNode[];
  stats: { /* ... */ };
}

// AFTER:
export interface TraversalResult {
  nodes: TraversedNode[];
  elementMap: Map<number, Element>;  // NEW: index → element mapping
  stats: {
    totalNodes: number;
    elementNodes: number;
    textNodes: number;
    maxDepth: number;
  };
}
```
**Success Criteria**: TypeScript compiles without errors, interface updated

**Dependency**: Blocks T006

### T006: Implement element map tracking in traverseDOM()
**File**: `codex-chrome/src/tools/dom/chrome/domTraversal.ts`
**Description**: Build element map during DOM traversal by storing element references at their indices
**Lines**: ~77-177
**Changes**:
```typescript
export function traverseDOM(
  root: Node = document.documentElement,
  options: TraversalOptions = {}
): TraversalResult {
  const nodes: TraversedNode[] = [];
  const elementMap = new Map<number, Element>();  // NEW
  const stats = { /* ... */ };
  const stack: Array<[Node, number, number | null]> = [[root, 0, null]];

  while (stack.length > 0) {
    const [node, depth, parentIndex] = stack.pop()!;

    // ... existing depth/filtering logic ...

    const currentIndex = nodes.length;

    // NEW: Store element reference immediately
    if (node.nodeType === DOMNodeType.ELEMENT_NODE) {
      elementMap.set(currentIndex, node as Element);
    }

    const traversedNode: TraversedNode = { /* ... */ };
    nodes.push(traversedNode);

    // ... rest of loop ...
  }

  return { nodes, elementMap, stats };  // NEW: include elementMap
}
```
**Success Criteria**:
- elementMap populated with all element nodes
- Map size equals stats.elementNodes
- TypeScript compiles

**Dependency**: Requires T005, blocks T007

### T007: Update captureDocument() to use element map for snapshots
**File**: `codex-chrome/src/content/domCaptureHandler.ts`
**Description**: Replace broken getElementByPath() logic with direct element map lookup
**Lines**: ~155-240
**Changes**:
```typescript
function captureDocument(
  doc: Document,
  frameId: string,
  options: { includeShadowDOM: boolean; skipHiddenElements: boolean },
  stringPool: StringPool
): CapturedDocument {
  // Traverse DOM tree
  const traversalResult = traverseDOM(doc.documentElement, {
    maxDepth: 100,
    includeTextNodes: true,
    includeComments: false,
    skipHiddenElements: options.skipHiddenElements
  });

  // Collect elements from element map
  const elements: Element[] = [];
  const elementIndices: number[] = [];

  for (const [index, element] of traversalResult.elementMap.entries()) {
    elements.push(element);
    elementIndices.push(index);
  }

  // Batch capture snapshots and ARIA data
  const snapshots = batchCaptureSnapshots(elements);
  const axNodes = batchExtractARIA(elements);

  // Build captured nodes
  const nodes: CapturedNode[] = traversalResult.nodes.map((node, index) => {
    const capturedNode: CapturedNode = {
      nodeType: node.nodeType,
      nodeName: stringPool.internString(node.nodeName),  // Returns number
      nodeValue: node.nodeValue,
      backendNodeId: index + 1,
      parentIndex: node.parentIndex,
      childIndices: node.childIndices,
      attributes: {}
    };

    // Attach snapshot and ARIA data if element node
    if (node.nodeType === 1) {
      const element = traversalResult.elementMap.get(index);
      if (element) {
        capturedNode.snapshot = snapshots.get(element);
        capturedNode.axNode = axNodes.get(element);

        // Intern attributes
        if (capturedNode.snapshot) {
          const internedAttrs: Record<number, number> = {};
          for (const [key, value] of Object.entries(capturedNode.snapshot.attributes)) {
            const keyIndex = stringPool.internString(key);
            const valueIndex = stringPool.internString(value);
            internedAttrs[keyIndex] = valueIndex;
          }
          capturedNode.attributes = internedAttrs;
        }
      }
    }

    return capturedNode;
  });

  return {
    documentURL: doc.location?.href || '',
    baseURL: doc.baseURI || '',
    title: doc.title || '',
    frameId,
    nodes
  };
}
```
**Success Criteria**:
- CapturedNode objects have populated snapshot and axNode fields
- String interning returns number indices (not cast to string)
- Attributes use number keys and values

**Dependency**: Requires T006, blocks T010

### T008: Remove stub getElementByPath() function
**File**: `codex-chrome/src/content/domCaptureHandler.ts`
**Description**: Delete the stub `getElementByPath()` function (lines ~252-266) as it's no longer needed
**Lines**: ~252-266
**Change**: Delete entire function
```typescript
// DELETE THIS FUNCTION:
function getElementByPath(
  root: Element,
  index: number,
  traversalResult: TraversalResult
): Element | null {
  // Simplified implementation - in production, maintain a map during traversal
  const node = traversalResult.nodes[index];
  if (node.nodeType !== 1) {
    return null;
  }

  // For now, return root as placeholder
  // TODO: Implement proper element lookup
  return root;
}
```
**Success Criteria**: Function deleted, no references remain, TypeScript compiles

**Dependency**: Requires T007

### T009: [P] Fix Vite config to generate external source maps with URL comment
**File**: `codex-chrome/vite.config.content.mjs`
**Description**: Update build configuration to ensure source map URL comment is included in IIFE bundle
**Lines**: ~9-34
**Changes**:
```typescript
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/content/content-script.ts'),
      name: 'CodexContentScript',
      formats: ['iife'],
      fileName: () => 'content.js'
    },
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true,
        sourcemap: true,  // NEW: Ensure Rollup generates source map
        sourcemapExcludeSources: false  // NEW: Include sources in map
      }
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: 'external',  // CHANGED: Explicit external (not just true)
    minify: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
```
**Success Criteria**:
- Build generates `dist/content.js.map` file
- `dist/content.js` ends with `//# sourceMappingURL=content.js.map` comment
- Source map contains TypeScript source paths

**Dependency**: Can run in parallel with T005-T008

---

## Phase 3.4: Integration & Validation

### T010: Run DOM capture contract tests (expect passes)
**File**: `specs/035-method-handledomcapturerequest-in/contracts/dom-capture.contract.ts`
**Description**: Re-run contract tests to verify all bugs are fixed
**Commands**:
```bash
cd codex-chrome
npm run test -- ../specs/035-method-handledomcapturerequest-in/contracts/dom-capture.contract.ts
```
**Expected Results**: All tests pass ✅
- FR-001: "should return non-empty nodes array" ✅
- FR-002: "should populate nodes array" ✅
- FR-003: "should attach snapshot to all element nodes" ✅
- FR-004: "should attach axNode to all element nodes" ✅
- FR-005: "should have elementMap with correct size" ✅
- FR-006: "should use string indices in nodeName" ✅
- FR-013: "should preserve node relationships" ✅
- FR-014: "should capture element attributes" ✅

**Success Criteria**: All contract tests pass

**Dependency**: Requires T007, T008

### T011: Run source map contract tests (expect passes)
**File**: `specs/035-method-handledomcapturerequest-in/contracts/source-maps.contract.ts`
**Description**: Rebuild and verify source maps are correctly generated
**Commands**:
```bash
cd codex-chrome
npm run build
npm run test -- ../specs/035-method-handledomcapturerequest-in/contracts/source-maps.contract.ts
```
**Expected Results**: All tests pass ✅
- FR-008: "should generate content.js.map file" ✅
- FR-009: "should include sourceMappingURL comment" ✅
- FR-010: "should include TypeScript source files" ✅

**Success Criteria**: All source map tests pass

**Dependency**: Requires T009

### T012: Run integration test for complete DOM capture flow
**File**: `codex-chrome/src/content/__tests__/domCapture.integration.test.ts`
**Description**: Run the integration test created in T004 to verify end-to-end functionality
**Commands**:
```bash
cd codex-chrome
npm run test -- src/content/__tests__/domCapture.integration.test.ts
```
**Expected Results**: Test passes ✅
- DOM snapshot populated with nodes
- All element nodes have snapshot and axNode
- String interning works correctly

**Success Criteria**: Integration test passes

**Dependency**: Requires T007, T008

### T013: Manual validation with Chrome DevTools
**File**: N/A (manual testing)
**Description**: Follow quickstart.md validation steps to test in real Chrome extension environment
**Steps** (from quickstart.md):
1. Build extension: `npm run build`
2. Load unpacked extension in Chrome (`chrome://extensions`)
3. Navigate to any web page
4. Open DevTools Console
5. Execute DOM capture request:
```javascript
chrome.runtime.sendMessage({
  type: 'DOM_CAPTURE_REQUEST',
  request_id: 'manual-test',
  options: { include_shadow_dom: true }
}, (response) => {
  console.log('Nodes count:', response.snapshot.documents[0].nodes.length);
  console.log('Strings count:', response.snapshot.strings.length);

  // Verify nodes have snapshots
  const elementNodes = response.snapshot.documents[0].nodes.filter(n => n.nodeType === 1);
  console.log('Element nodes:', elementNodes.length);
  console.log('First element:', elementNodes[0]);
  console.assert(elementNodes[0].snapshot, 'Element should have snapshot');
  console.assert(elementNodes[0].axNode, 'Element should have axNode');
});
```
6. Verify DevTools Sources panel shows TypeScript files (content-script.ts, domCaptureHandler.ts)
7. Set breakpoint in TypeScript, trigger capture, verify pause at correct line

**Success Criteria**:
- DOM capture returns populated nodes array
- All element nodes have snapshot and axNode
- TypeScript sources visible in DevTools
- Breakpoints work in TypeScript files

**Dependency**: Requires T010, T011

---

## Phase 3.5: Polish & Performance

### T014: [P] Create performance test for large DOM capture
**File**: `codex-chrome/src/content/__tests__/domCapture.performance.test.ts`
**Description**: Create performance test to ensure large DOM captures complete within acceptable time
**Test Cases**:
```typescript
describe('DOM Capture Performance', () => {
  it('captures 1000 node DOM in <500ms', () => {
    // Generate 1000 node DOM
    const container = document.createElement('div');
    for (let i = 0; i < 1000; i++) {
      const el = document.createElement('div');
      el.className = `item-${i}`;
      el.textContent = `Item ${i}`;
      container.appendChild(el);
    }
    document.body.appendChild(container);

    const startTime = performance.now();
    const result = captureDOMSnapshot({});
    const duration = performance.now() - startTime;

    expect(result.documents[0].nodes.length).toBeGreaterThan(1000);
    expect(duration).toBeLessThan(500);
  });

  it('captures 10k node DOM in <5s', () => {
    // Generate 10k node DOM
    const container = document.createElement('div');
    for (let i = 0; i < 10000; i++) {
      const el = document.createElement('div');
      el.textContent = `Item ${i}`;
      container.appendChild(el);
    }
    document.body.appendChild(container);

    const startTime = performance.now();
    const result = captureDOMSnapshot({});
    const duration = performance.now() - startTime;

    expect(result.documents[0].nodes.length).toBeGreaterThan(10000);
    expect(duration).toBeLessThan(5000);
  });

  it('string interning reduces payload size significantly', () => {
    // Create DOM with many repeated strings
    const container = document.createElement('div');
    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div');
      el.className = 'repeated-class';
      el.setAttribute('data-type', 'test');
      container.appendChild(el);
    }
    document.body.appendChild(container);

    const result = captureDOMSnapshot({});

    // Verify string "repeated-class" appears only once in strings array
    const classOccurrences = result.strings.filter(s => s === 'repeated-class');
    expect(classOccurrences.length).toBe(1);

    // Verify multiple nodes reference same string index
    const classIndex = result.strings.indexOf('repeated-class');
    const nodesWithClass = result.documents[0].nodes.filter(n => {
      if (!n.attributes) return false;
      const classKey = Object.keys(n.attributes).find(k =>
        result.strings[parseInt(k)] === 'class'
      );
      return classKey && result.strings[n.attributes[parseInt(classKey)]] === 'repeated-class';
    });
    expect(nodesWithClass.length).toBeGreaterThan(10);
  });
});
```
**Success Criteria**: Test file created, all performance benchmarks pass

**Dependency**: Requires T007 (can run in parallel with T010-T013)

### T015: [P] Run full test suite
**File**: N/A (all tests)
**Description**: Run complete test suite to ensure no regressions
**Commands**:
```bash
cd codex-chrome
npm run test
npm run type-check
```
**Success Criteria**: All tests pass, no TypeScript errors

**Dependency**: Requires T010, T011, T012, T014

### T016: Verify quickstart validation steps
**File**: `specs/035-method-handledomcapturerequest-in/quickstart.md`
**Description**: Execute all steps in quickstart.md to validate fixes
**Steps**: Follow Steps 1-6 in quickstart.md
**Success Criteria**: All validation criteria met as documented

**Dependency**: Requires T013, T015

### T017: [P] Update CLAUDE.md with bug fix details
**File**: `CLAUDE.md`
**Description**: Document the bug fixes in the DOMTool v2.0 section
**Changes**: Add subsection documenting the fixes:
```markdown
### Bug Fixes (2025-10-12)

Fixed critical bugs in DOM capture implementation:

1. **Element Map Tracking**: Added `elementMap` to `TraversalResult` to maintain index→element mapping during traversal. Previously, `getElementByPath()` was a stub that always returned root element, causing snapshots to never attach.

2. **String Interning Types**: Fixed type casts that incorrectly converted `number` indices to `string`. `StringPool.internString()` returns `number` (index), not `string`.

3. **Source Maps**: Updated `vite.config.content.mjs` to generate external source maps with explicit `sourceMappingURL` comment for Chrome DevTools integration.

**Files Modified**:
- `src/tools/dom/chrome/domTraversal.ts`: Added elementMap tracking
- `src/content/domCaptureHandler.ts`: Fixed element-to-snapshot attachment logic
- `vite.config.content.mjs`: Fixed source map generation

**Testing**: Contract tests in `specs/035-method-handledomcapturerequest-in/contracts/`
```
**Success Criteria**: Documentation updated with bug fix details

**Dependency**: Requires T016 (can run in parallel)

---

## Dependencies

### Critical Path (Sequential)
```
T001 (Setup)
  ↓
T002, T003, T004 (Run failing tests - parallel)
  ↓
T005 (Update interface)
  ↓
T006 (Implement elementMap)
  ↓
T007 (Fix captureDocument)
  ↓
T008 (Remove stub)
  ↓
T010 (Verify DOM capture tests pass)
  ↓
T012 (Integration test)
  ↓
T013 (Manual validation)
  ↓
T015 (Full test suite)
  ↓
T016 (Quickstart validation)
```

### Parallel Branch (Source Maps)
```
T001 (Setup)
  ↓
T003 (Run source map tests)
  ↓
T009 (Fix Vite config) [P]
  ↓
T011 (Verify source map tests pass)
  ↓
T013 (Manual validation - DevTools)
```

### Polish Tasks (Parallel after integration)
```
T012 (Integration complete)
  ↓
T014, T017 [P] (Performance tests, docs)
  ↓
T015 (Full suite)
  ↓
T016 (Quickstart)
```

## Parallel Execution Examples

### Run Initial Test Validation (T002, T003, T004)
These can all run in parallel since they just execute existing tests:
```bash
# Terminal 1
cd codex-chrome && npm run test -- ../specs/035-method-handledomcapturerequest-in/contracts/dom-capture.contract.ts

# Terminal 2
cd codex-chrome && npm run build && npm run test -- ../specs/035-method-handledomcapturerequest-in/contracts/source-maps.contract.ts

# Terminal 3
# After creating integration test in T004
cd codex-chrome && npm run test -- src/content/__tests__/domCapture.integration.test.ts
```

### Fix DOM Capture and Source Maps in Parallel (T005-T008 vs T009)
After tests fail, DOM capture fixes (T005-T008) and source map fix (T009) can proceed in parallel:
```bash
# Branch 1: Fix DOM capture (sequential within this branch)
# T005 → T006 → T007 → T008

# Branch 2: Fix source maps (parallel with Branch 1)
# T009
```

### Run Final Validation (T014, T017)
```bash
# Terminal 1: Performance tests
cd codex-chrome && npm run test -- src/content/__tests__/domCapture.performance.test.ts

# Terminal 2: Update documentation
# Edit CLAUDE.md with bug fix details
```

## Notes

### Test-First Approach (TDD)
- **Phase 3.2 MUST complete before Phase 3.3**: All contract tests must fail first
- Failing tests confirm bugs exist and tests are valid
- Only after tests fail should implementation changes begin

### Parallel Safety
- [P] tasks modify different files or are read-only
- DOM capture fixes (T005-T008) sequential within chain due to dependencies
- Source map fix (T009) independent, can run parallel with DOM capture fixes
- Performance tests (T014) independent, can run parallel with validation

### File Ownership
- `domTraversal.ts`: T005, T006 (sequential)
- `domCaptureHandler.ts`: T007, T008 (sequential)
- `vite.config.content.mjs`: T009 (parallel-safe)
- Contract tests: T002, T003 (parallel-safe - read-only)
- Documentation: T017 (parallel-safe with other tasks)

### Success Validation
After all tasks complete:
- ✅ All contract tests pass (20+ assertions)
- ✅ Integration tests pass
- ✅ Performance benchmarks met (<5s for 10k nodes)
- ✅ TypeScript compiles without errors
- ✅ Source maps visible in Chrome DevTools
- ✅ Breakpoints work in TypeScript files
- ✅ DOM capture returns populated nodes with snapshots and ARIA data
- ✅ String interning works (attributes use number indices)

### Commit Strategy
Recommended commits:
1. After T004: "Add failing contract and integration tests for DOM capture bug"
2. After T006: "Fix: Add element map tracking to DOM traversal"
3. After T008: "Fix: Update DOM capture to use element map and fix string interning"
4. After T009: "Fix: Configure Vite to generate external source maps with URL comment"
5. After T012: "Test: Verify all DOM capture and source map fixes"
6. After T016: "Docs: Update CLAUDE.md with bug fix details"

---

## Validation Checklist
*GATE: Checked before marking complete*

- [x] All contracts have corresponding test tasks (T002, T003)
- [x] All entities have model/interface tasks (T005 for TraversalResult)
- [x] All tests come before implementation (T002-T004 before T005-T009)
- [x] Parallel tasks truly independent (T009 vs T005-T008, T014 vs T010-T013)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD flow enforced (tests fail → implement → tests pass)
- [x] Performance validation included (T014)
- [x] Manual validation included (T013, T016)
- [x] Documentation updates included (T017)

---

**Status**: Tasks generated and ready for execution
**Total Tasks**: 17
**Estimated Time**: 4-6 hours (sequential), 2-3 hours (with parallelization)
**Risk Level**: Low (isolated bug fixes, comprehensive test coverage)
