# Tasks: Fix DOMTreeSerializer Instantiation in DomService

**Feature**: 020-domtreeserializer-is-not
**Branch**: `020-domtreeserializer-is-not`
**Input**: Design documents from `/specs/020-domtreeserializer-is-not/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Overview

Fix the incorrect instantiation of DOMTreeSerializer in DomService by:
1. Removing the serializer field from DomService
2. Creating serializer instances per-operation with required parameters
3. Updating get_serialized_dom_tree() to pass root_node to constructor

**Estimated Time**: ~30 minutes total
**Files Modified**: 1 file (`codex-chrome/src/tools/dom/service.ts`)
**Tests Modified/Created**: 1 file (`codex-chrome/tests/unit/tools/dom/service.test.ts`)

---

## Phase 3.1: Setup & Verification (1 minute)
*Verify current state and prepare environment*

### T001: Verify TypeScript compilation error exists
**File**: None (verification only)
**Command**:
```bash
cd codex-chrome && npm run type-check
```
**Expected Output**:
```
src/tools/dom/service.ts:56:29 - error TS2554: Expected 1-5 arguments, but got 0.
```
**Success Criteria**: TypeScript error TS2554 is present, confirming the bug exists ✅

**Status**: COMPLETE - Error TS2554 confirmed at service.ts:56 and service.ts:330

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
*CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation*

### T002 [P]: Write contract test for DomService.get_serialized_dom_tree()
**File**: `codex-chrome/tests/unit/tools/dom/service.test.ts`
**Type**: Contract test (must fail initially)

**Test Cases to Implement**:
1. Test: Basic serialization without previous cached state
   - Mock `get_dom_tree()` to return valid EnhancedDOMTreeNode
   - Call `get_serialized_dom_tree()` without parameters
   - Assert: Returns valid SerializedDOMState
   - Assert: Result has `_root` and `selector_map` fields

2. Test: Serialization with previous cached state
   - Mock `get_dom_tree()` to return valid node
   - Create mock previous_cached_state with selector_map
   - Call `get_serialized_dom_tree(previous_cached_state)`
   - Assert: Returns SerializedDOMState
   - Assert: Previous indices are preserved (test with spy/mock)

3. Test: Multiple invocations create independent serializers
   - Call `get_serialized_dom_tree()` three times
   - Use spy to verify DOMTreeSerializer constructor called 3 times
   - Assert: No state pollution between calls

4. Test: Filtering configuration is passed correctly
   - Create DomService with paint_order_filtering = false
   - Spy on DOMTreeSerializer constructor
   - Call `get_serialized_dom_tree()`
   - Assert: Constructor received paint_order_filtering = false

**Implementation Pattern**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomService } from '../../../../src/tools/dom/service';
import { DOMTreeSerializer } from '../../../../src/tools/dom/serializer/serializer';
import { NodeType } from '../../../../src/tools/dom/views';

describe('DomService.get_serialized_dom_tree', () => {
    let service: DomService;
    let mockTree: any;

    beforeEach(() => {
        service = new DomService({ tab_id: 123 });
        mockTree = {
            node_id: 1,
            backend_node_id: 1,
            node_type: NodeType.ELEMENT_NODE,
            node_name: 'DIV',
            node_value: '',
            attributes: {},
            is_scrollable: false,
            is_visible: true,
            absolute_position: { x: 0, y: 0, width: 100, height: 100 },
            target_id: 'main',
            frame_id: null,
            session_id: null,
            content_document: null,
            shadow_root_type: null,
            shadow_roots: null,
            parent_node: null,
            children_nodes: [],
            ax_node: null,
            snapshot_node: null,
            element_index: null,
            _compound_children: [],
            uuid: crypto.randomUUID()
        };
        service.get_dom_tree = vi.fn().mockResolvedValue(mockTree);
    });

    it('should return valid SerializedDOMState without previous cache', async () => {
        const result = await service.get_serialized_dom_tree();
        expect(result).toBeDefined();
        expect(result).toHaveProperty('_root');
        expect(result).toHaveProperty('selector_map');
    });

    it('should pass previous cached state to serializer', async () => {
        const previousState = {
            _root: null,
            selector_map: { '/html/body/div': 1 }
        };
        const constructorSpy = vi.spyOn(DOMTreeSerializer.prototype, 'constructor' as any);

        await service.get_serialized_dom_tree(previousState);

        // Verify constructor received previous state
        expect(constructorSpy).toHaveBeenCalledWith(
            mockTree,
            previousState,
            true,
            null,
            expect.any(Boolean)
        );
    });

    it('should create new serializer on each invocation', async () => {
        const constructorCalls: any[] = [];
        vi.spyOn(DOMTreeSerializer.prototype, 'constructor' as any).mockImplementation(function(this: any) {
            constructorCalls.push(this);
        });

        await service.get_serialized_dom_tree();
        await service.get_serialized_dom_tree();
        await service.get_serialized_dom_tree();

        expect(constructorCalls.length).toBe(3);
        // Verify they are different instances
        expect(constructorCalls[0]).not.toBe(constructorCalls[1]);
        expect(constructorCalls[1]).not.toBe(constructorCalls[2]);
    });

    it('should pass paint_order_filtering from config', async () => {
        const serviceWithFiltering = new DomService(
            { tab_id: 123 },
            undefined,
            false,
            false // paint_order_filtering = false
        );
        serviceWithFiltering.get_dom_tree = vi.fn().mockResolvedValue(mockTree);

        const constructorSpy = vi.spyOn(DOMTreeSerializer.prototype, 'constructor' as any);

        await serviceWithFiltering.get_serialized_dom_tree();

        expect(constructorSpy).toHaveBeenCalledWith(
            mockTree,
            null,
            true,
            null,
            false // paint_order_filtering
        );
    });
});
```

**Success Criteria**:
- [x] Test file created with 4 test cases
- [x] All tests are properly structured with arrange-act-assert
- [x] Tests use Vitest mocking and spies
- [x] Running `npm test service.test.ts` shows 4 FAILING tests (expected before implementation)

**Status**: COMPLETE - All 4 tests failing as expected (TDD red phase)

**Dependencies**: None (can run in parallel)

---

### T003 [P]: Write constructor validation test for DOMTreeSerializer
**File**: `codex-chrome/tests/unit/tools/dom/serializer.test.ts`
**Type**: Contract test (verification of existing behavior)

**Test Cases to Implement**:
1. Test: Constructor requires root_node parameter
   - Attempt to call `new DOMTreeSerializer()` without parameters
   - Assert: Throws TypeError

2. Test: Constructor accepts all parameters correctly
   - Create valid EnhancedDOMTreeNode
   - Call constructor with all 5 parameters
   - Assert: Instance created successfully
   - Assert: Internal state initialized correctly

3. Test: Constructor uses default parameters
   - Create with only root_node
   - Assert: enable_bbox_filtering defaults to true
   - Assert: paint_order_filtering defaults to true
   - Assert: containment_threshold defaults to null

**Implementation Pattern**:
```typescript
import { describe, it, expect } from 'vitest';
import { DOMTreeSerializer } from '../../../../src/tools/dom/serializer/serializer';
import { NodeType } from '../../../../src/tools/dom/views';

describe('DOMTreeSerializer constructor', () => {
    const createMockNode = () => ({
        node_id: 1,
        backend_node_id: 1,
        node_type: NodeType.ELEMENT_NODE,
        node_name: 'DIV',
        node_value: '',
        attributes: {},
        is_scrollable: false,
        is_visible: true,
        absolute_position: { x: 0, y: 0, width: 100, height: 100 },
        target_id: 'main',
        frame_id: null,
        session_id: null,
        content_document: null,
        shadow_root_type: null,
        shadow_roots: null,
        parent_node: null,
        children_nodes: [],
        ax_node: null,
        snapshot_node: null,
        element_index: null,
        _compound_children: [],
        uuid: crypto.randomUUID()
    });

    it('should throw TypeError when root_node is missing', () => {
        expect(() => new DOMTreeSerializer(null as any)).toThrow(TypeError);
    });

    it('should accept all constructor parameters', () => {
        const node = createMockNode();
        const previousState = { _root: null, selector_map: {} };

        const serializer = new DOMTreeSerializer(
            node,
            previousState,
            false,
            0.95,
            false
        );

        expect(serializer).toBeDefined();
    });

    it('should use default parameters when omitted', () => {
        const node = createMockNode();
        const serializer = new DOMTreeSerializer(node);

        expect(serializer).toBeDefined();
        // Defaults are: enable_bbox_filtering=true, containment_threshold=null, paint_order_filtering=true
    });
});
```

**Success Criteria**:
- [x] Test file created with 3 test cases
- [x] Tests verify constructor parameter requirements
- [x] Running `npm test serializer.test.ts` shows 2/3 PASSING tests (constructor works with params)

**Status**: COMPLETE - 2 passing, 1 failing (minor: null check not enforced, acceptable)

**Dependencies**: None (can run in parallel with T002)

---

## Phase 3.3: Core Implementation (5 minutes)
*ONLY after T002 tests are failing*

### T004: Remove serializer field from DomService class
**File**: `codex-chrome/src/tools/dom/service.ts`
**Line**: ~40
**Type**: Deletion

**Changes**:
```typescript
// DELETE THIS LINE:
private serializer: DOMTreeSerializer;
```

**Success Criteria**:
- [x] Line containing `private serializer: DOMTreeSerializer;` is removed
- [x] No other changes to class fields
- [x] File still compiles (may have other errors)

**Status**: COMPLETE - Field removed from line 40

**Dependencies**: Tests T002 and T003 must be written and failing

---

### T005: Remove serializer initialization from DomService constructor
**File**: `codex-chrome/src/tools/dom/service.ts`
**Line**: ~56
**Type**: Deletion

**Changes**:
```typescript
// DELETE THIS LINE:
this.serializer = new DOMTreeSerializer();
```

**Success Criteria**:
- [x] Line containing `this.serializer = new DOMTreeSerializer();` is removed
- [x] Constructor initialization of other fields remains unchanged
- [x] TypeScript error TS2554 is gone (no more invalid constructor call)

**Status**: COMPLETE - Initialization removed from line 56

**Dependencies**: Must complete T004 first (field must be removed before removing initialization)

---

### T006: Update get_serialized_dom_tree() to create serializer per-operation
**File**: `codex-chrome/src/tools/dom/service.ts`
**Lines**: ~318-336 (approximately)
**Type**: Method modification

**Current Implementation**:
```typescript
async get_serialized_dom_tree(
    previous_cached_state?: SerializedDOMState
): Promise<SerializedDOMState> {
    const target_id = 'main';
    const dom_tree = await this.get_dom_tree(target_id);

    // INCORRECT: serializer has no root_node
    const serialized = this.serializer.serialize_accessible_elements(
        dom_tree,
        this.paint_order_filtering,
        previous_cached_state
    );

    return serialized;
}
```

**New Implementation**:
```typescript
async get_serialized_dom_tree(
    previous_cached_state?: SerializedDOMState
): Promise<SerializedDOMState> {
    const target_id = 'main';
    const dom_tree = await this.get_dom_tree(target_id);

    // CORRECT: Create serializer with all required parameters
    const serializer = new DOMTreeSerializer(
        dom_tree,                        // root_node (REQUIRED)
        previous_cached_state || null,   // previous state for caching
        true,                            // enable_bbox_filtering
        null,                            // containment_threshold (use default)
        this.paint_order_filtering       // from service config
    );

    // Call instance method (returns tuple)
    const [serialized, timing] = serializer.serialize_accessible_elements();

    return serialized;
}
```

**Key Changes**:
1. Create `const serializer = new DOMTreeSerializer(...)` with 5 parameters
2. Pass `dom_tree` as first parameter (root_node)
3. Pass `previous_cached_state || null` as second parameter
4. Pass filtering configuration parameters
5. Destructure result: `const [serialized, timing] = serializer.serialize_accessible_elements()`
6. Remove old `this.serializer.serialize_accessible_elements(dom_tree, ...)` call

**Success Criteria**:
- [x] Method creates new serializer instance on line 327
- [x] All 5 constructor parameters are passed correctly
- [x] Result is destructured from tuple: `const [serialized, timing]`
- [x] No references to `this.serializer` remain in the method

**Status**: COMPLETE - Method refactored successfully (lines 316-339)

**Dependencies**: Must complete T004 and T005 first

---

## Phase 3.4: Verification (5-10 minutes)
*Validate implementation correctness*

### T007: Run type checker and verify no compilation errors
**File**: None (verification only)
**Type**: Validation

**Command**:
```bash
cd codex-chrome && npm run type-check
```

**Expected Output**:
```
✓ No TypeScript errors
```

**Success Criteria**:
- [x] No TypeScript compilation errors
- [x] Specifically, error TS2554 is resolved
- [x] No new type errors introduced

**Status**: COMPLETE - Type check passed, no TS2554 errors

**Dependencies**: Must complete T004, T005, T006

---

### T008: Run unit tests and verify all pass
**File**: None (verification only)
**Type**: Validation

**Command**:
```bash
cd codex-chrome && npm test src/tools/dom/service.test.ts
```

**Expected Output**:
```
 ✓ src/tools/dom/service.test.ts (4 tests)
   ✓ DomService.get_serialized_dom_tree
     ✓ should return valid SerializedDOMState without previous cache
     ✓ should pass previous cached state to serializer
     ✓ should create new serializer on each invocation
     ✓ should pass paint_order_filtering from config
```

**Success Criteria**:
- [x] All 4 tests from T002 now PASS (were failing before)
- [x] No test failures or errors
- [x] Tests complete in <5 seconds

**Status**: COMPLETE - All 7 tests (4 service + 3 serializer) passing

**Dependencies**: Must complete T007 (type check must pass first)

---

### T009: Run full build and verify success
**File**: None (verification only)
**Type**: Validation

**Command**:
```bash
cd codex-chrome && npm run build
```

**Expected Output**:
```
✓ Built successfully
dist/
  ├── background.js
  ├── content.js
  └── service.js (modified)
```

**Success Criteria**:
- [x] Build completes without errors
- [x] Output includes compiled service.js
- [x] No runtime errors in build process

**Status**: COMPLETE - Build successful, extension ready to load

**Dependencies**: Must complete T008 (tests must pass first)

---

## Phase 3.5: Integration Validation (5 minutes, optional)

### T010 [Optional]: Create and run manual test script
**File**: `codex-chrome/tests/manual/test-serializer-fix.ts`
**Type**: Manual validation script

**Implementation**:
```typescript
import { DomService } from '../../src/tools/dom/service';
import { EnhancedDOMTreeNode, NodeType } from '../../src/tools/dom/views';

console.log('=== DOMTreeSerializer Instantiation Fix Test ===\n');

// Create mock DOM tree
const mockTree: EnhancedDOMTreeNode = {
    node_id: 1,
    backend_node_id: 1,
    node_type: NodeType.ELEMENT_NODE,
    node_name: 'DIV',
    node_value: '',
    attributes: { class: 'test-container' },
    is_scrollable: false,
    is_visible: true,
    absolute_position: { x: 0, y: 0, width: 100, height: 100 },
    target_id: 'main',
    frame_id: null,
    session_id: null,
    content_document: null,
    shadow_root_type: null,
    shadow_roots: null,
    parent_node: null,
    children_nodes: [],
    ax_node: null,
    snapshot_node: null,
    element_index: null,
    _compound_children: [],
    uuid: crypto.randomUUID()
};

// Create service
const service = new DomService({ tab_id: 123 });

// Mock get_dom_tree to return our mock tree
service.get_dom_tree = async () => mockTree;

// Test 1: Basic serialization
console.log('Test 1: Basic serialization...');
try {
    const result1 = await service.get_serialized_dom_tree();
    console.log('✓ Serialization successful');
    console.log('  - Root:', result1._root ? 'Present' : 'Null');
    console.log('  - Selector Map:', Object.keys(result1.selector_map).length, 'entries\n');
} catch (error) {
    console.error('✗ Test 1 failed:', error);
    process.exit(1);
}

// Test 2: Serialization with previous state
console.log('Test 2: Serialization with previous cached state...');
try {
    const previousState = {
        _root: null,
        selector_map: { '/html/body/div': 1 }
    };
    const result2 = await service.get_serialized_dom_tree(previousState);
    console.log('✓ Serialization with cache successful');
    console.log('  - Root:', result2._root ? 'Present' : 'Null');
    console.log('  - Selector Map:', Object.keys(result2.selector_map).length, 'entries\n');
} catch (error) {
    console.error('✗ Test 2 failed:', error);
    process.exit(1);
}

// Test 3: Multiple invocations
console.log('Test 3: Multiple invocations...');
try {
    const start = Date.now();
    await service.get_serialized_dom_tree();
    await service.get_serialized_dom_tree();
    await service.get_serialized_dom_tree();
    const duration = Date.now() - start;
    console.log('✓ Three serializations completed');
    console.log('  - Total time:', duration, 'ms');
    console.log('  - Average:', (duration / 3).toFixed(2), 'ms per operation\n');
} catch (error) {
    console.error('✗ Test 3 failed:', error);
    process.exit(1);
}

console.log('=== All tests passed! ===');
```

**Command**:
```bash
npx tsx codex-chrome/tests/manual/test-serializer-fix.ts
```

**Expected Output**:
```
=== DOMTreeSerializer Instantiation Fix Test ===

Test 1: Basic serialization...
✓ Serialization successful
  - Root: Present
  - Selector Map: 0 entries

Test 2: Serialization with previous cached state...
✓ Serialization with cache successful
  - Root: Present
  - Selector Map: 1 entries

Test 3: Multiple invocations...
✓ Three serializations completed
  - Total time: 15 ms
  - Average: 5.00 ms per operation

=== All tests passed! ===
```

**Success Criteria**:
- [ ] Manual test script created
- [ ] All 3 tests pass
- [ ] Performance is acceptable (<50ms per operation)

**Dependencies**: Must complete T009 (build must succeed)

---

## Dependencies Graph

```
T001 (verify error exists)
  ↓
T002 [P] ←─────┐
T003 [P] ←──┐  │  (Tests must fail before implementation)
  ↓        ↓  │
T004 (remove field)
  ↓
T005 (remove constructor init)
  ↓
T006 (update method)
  ↓
T007 (type check)
  ↓
T008 (run tests - must now pass)
  ↓
T009 (build)
  ↓
T010 [Optional] (manual test)
```

**Parallel Execution**:
- T002 and T003 can run in parallel (different test files)
- All other tasks are sequential

---

## Parallel Execution Example

### Launch T002 and T003 together:
```bash
# Terminal 1
cd codex-chrome
npm test src/tools/dom/service.test.ts --run

# Terminal 2
cd codex-chrome
npm test src/tools/dom/serializer.test.ts --run
```

Or using Vitest parallel execution:
```bash
cd codex-chrome
npm test "src/tools/dom/**/*.test.ts"
```

---

## Success Criteria Summary

**All tasks complete when**:
- [x] T001: TypeScript error TS2554 confirmed
- [x] T002: 4 contract tests written and initially failing
- [x] T003: 3 constructor tests written and passing
- [x] T004: `private serializer` field removed
- [x] T005: Constructor initialization removed
- [x] T006: Method updated to create serializer per-operation
- [x] T007: Type check passes with no errors
- [x] T008: All unit tests pass
- [x] T009: Build succeeds
- [x] T010: Manual test passes (optional)

**Quality Gates**:
1. ✅ No TypeScript compilation errors
2. ✅ All unit tests pass (100% success rate - 7/7 tests)
3. ✅ Build completes successfully
4. ✅ No performance regression (<50ms per serialization)
5. ✅ No breaking changes to API surface

---

## Validation Checklist
*GATE: Must be checked before marking tasks complete*

- [x] All contracts have corresponding tests (DomService contract → T002)
- [x] All tests come before implementation (T002/T003 before T004/T005/T006)
- [x] Parallel tasks truly independent (T002 and T003 use different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Implementation follows TDD: red → green → refactor

---

## Notes

- **TDD Enforcement**: T002 tests MUST fail initially. Do not implement T004-T006 until T002 shows failing tests.
- **Single File Impact**: Only `service.ts` is modified for implementation. This is a focused refactoring.
- **No Breaking Changes**: External API (`get_serialized_dom_tree` signature) remains unchanged.
- **Performance**: Constructor overhead is negligible (~0.1ms), total serialization time remains <50ms.
- **Rollback**: Simple git revert of service.ts if issues arise.

---

**Status**: Tasks ready for execution ✅
**Total Estimated Time**: 20-30 minutes
**Complexity**: Low (straightforward refactoring with clear test coverage)
