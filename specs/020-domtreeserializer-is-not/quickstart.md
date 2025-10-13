# Quickstart: Fix DOMTreeSerializer Instantiation

**Feature**: 020-domtreeserializer-is-not
**Time to Complete**: ~5 minutes
**Prerequisites**: TypeScript 5.9+, Node.js 22+, Vitest installed

## Overview
Verify that DOMTreeSerializer is correctly instantiated with required parameters in DomService.

## Setup

```bash
# Navigate to codex-chrome directory
cd codex-chrome

# Install dependencies (if not already done)
npm install

# Run type checker to verify current errors
npm run type-check
```

**Expected Output (Before Fix)**:
```
src/tools/dom/service.ts:56:29 - error TS2554: Expected 1-5 arguments, but got 0.
    this.serializer = new DOMTreeSerializer();
                            ~~~~~~~~~~~~~~~~~
```

## Implementation Steps

### Step 1: Remove serializer field from DomService

**File**: `codex-chrome/src/tools/dom/service.ts`

**Action**: Delete the private field declaration (line ~40)
```typescript
// DELETE THIS LINE:
private serializer: DOMTreeSerializer;
```

### Step 2: Remove serializer initialization from constructor

**File**: `codex-chrome/src/tools/dom/service.ts`

**Action**: Delete the constructor initialization (line ~56)
```typescript
// DELETE THIS LINE:
this.serializer = new DOMTreeSerializer();
```

### Step 3: Update get_serialized_dom_tree() method

**File**: `codex-chrome/src/tools/dom/service.ts`

**Action**: Replace the method implementation (lines ~318-336)

**Before**:
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

**After**:
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

## Verification

### Step 1: Type Check

```bash
npm run type-check
```

**Expected Output**:
```
✓ No TypeScript errors
```

### Step 2: Run Unit Tests

```bash
npm test src/tools/dom/service.test.ts
```

**Expected Output**:
```
 ✓ src/tools/dom/service.test.ts (X tests)
   ✓ DomService.get_serialized_dom_tree
     ✓ creates serializer with correct parameters
     ✓ handles undefined previous_cached_state
     ✓ passes paint_order_filtering from config
     ✓ creates new serializer on each invocation
```

### Step 3: Build

```bash
npm run build
```

**Expected Output**:
```
✓ Built successfully
dist/
  └── service.js
```

## Testing the Fix

### Manual Test Script

Create a test file: `codex-chrome/tests/manual/test-serializer-fix.ts`

```typescript
import { DomService } from '../../src/tools/dom/service';
import { EnhancedDOMTreeNode, NodeType } from '../../src/tools/dom/views';

// Create mock DOM tree
const mockTree: EnhancedDOMTreeNode = {
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

// Create service
const service = new DomService({ tab_id: 123 });

// Mock get_dom_tree to return our mock tree
service.get_dom_tree = async () => mockTree;

// Test serialization
console.log('Testing DOMTreeSerializer instantiation...');
const result = await service.get_serialized_dom_tree();
console.log('✓ Serialization successful');
console.log('  - Root:', result._root ? 'Present' : 'Null');
console.log('  - Selector Map:', Object.keys(result.selector_map).length, 'entries');
```

**Run**:
```bash
npx tsx tests/manual/test-serializer-fix.ts
```

**Expected Output**:
```
Testing DOMTreeSerializer instantiation...
✓ Serialization successful
  - Root: Present
  - Selector Map: 0 entries
```

## Success Criteria

- [ ] TypeScript compilation passes with no errors
- [ ] No references to `this.serializer` remain in DomService
- [ ] `get_serialized_dom_tree()` creates new serializer per call
- [ ] All parameters passed correctly to DOMTreeSerializer constructor
- [ ] Unit tests pass
- [ ] Build succeeds
- [ ] Manual test demonstrates correct instantiation

## Rollback

If issues arise, revert changes:

```bash
git checkout codex-chrome/src/tools/dom/service.ts
```

## Common Issues

### Issue: TypeScript error about serialize_accessible_elements signature

**Symptom**:
```
error TS2322: Type '[SerializedDOMState, Record<string, number>]' is not assignable to type 'SerializedDOMState'
```

**Solution**:
The method returns a tuple `[SerializedDOMState, Record<string, number>]`. Destructure it:
```typescript
const [serialized, timing] = serializer.serialize_accessible_elements();
```

### Issue: Tests fail with "DOM tree not found"

**Symptom**: Tests throw errors about missing DOM tree

**Solution**: Ensure test mocks provide valid `get_dom_tree()` implementation with proper EnhancedDOMTreeNode structure.

### Issue: Performance regression

**Symptom**: Serialization takes >50ms

**Solution**: Verify that:
1. Filtering config is passed correctly
2. No duplicate serialization operations
3. Previous cached state is propagated when available

## Next Steps

After completing this quickstart:

1. Run full test suite: `npm test`
2. Verify Chrome extension build: `npm run build`
3. Test in browser environment (load extension in Chrome)
4. Monitor for any runtime errors in console

## Additional Resources

- [DomService Contract](./contracts/DomService.contract.md)
- [DOMTreeSerializer Contract](./contracts/DOMTreeSerializer.contract.md)
- [Data Model](./data-model.md)
- [Research Document](./research.md)

---

**Status**: Ready for implementation ✅
**Estimated Time**: 5 minutes
**Difficulty**: Easy (straightforward refactoring)
