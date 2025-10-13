# Contract: DomService.get_serialized_dom_tree()

**Version**: 1.0.0
**Date**: 2025-10-10
**Status**: Stable (no breaking changes)

## Method Signature

```typescript
async get_serialized_dom_tree(
    previous_cached_state?: SerializedDOMState
): Promise<SerializedDOMState>
```

## Input Contract

### Parameters

**`previous_cached_state`** (optional)
- **Type**: `SerializedDOMState | undefined`
- **Purpose**: Previous serialization state for differential updates
- **Validation**:
  - If provided, MUST have valid `_root` and `selector_map` fields
  - If undefined, treated as first serialization (no caching)
- **Default**: `undefined`

### Preconditions
- DomService instance MUST be properly initialized
- Browser session MUST be valid
- DOM tree MUST be retrievable via `get_dom_tree()`

## Output Contract

### Return Value

**Type**: `Promise<SerializedDOMState>`

**Structure**:
```typescript
interface SerializedDOMState {
    _root: SimplifiedNode | null;      // Serialized tree root
    selector_map: DOMSelectorMap;       // XPath -> index mapping
}
```

### Success Criteria
- Promise MUST resolve with valid SerializedDOMState
- `selector_map` MUST contain all interactive elements
- If `previous_cached_state` provided, stable indices MUST be preserved
- Serialization MUST complete in <50ms for typical trees

### Error Conditions
- Throws if DOM tree retrieval fails
- Throws if DOMTreeSerializer instantiation fails (invalid root_node)
- Throws if serialization process encounters unrecoverable error

## Behavior Contract

### Internal Requirements

1. **MUST NOT** store DOMTreeSerializer as instance field
2. **MUST** create new DOMTreeSerializer per invocation
3. **MUST** pass all required parameters to serializer constructor:
   - `root_node`: Result from `get_dom_tree()`
   - `previous_cached_state`: From input parameter
   - `enable_bbox_filtering`: `true`
   - `containment_threshold`: `null` (use default)
   - `paint_order_filtering`: From `this.paint_order_filtering`

### Implementation Pattern

```typescript
async get_serialized_dom_tree(
    previous_cached_state?: SerializedDOMState
): Promise<SerializedDOMState> {
    // 1. Retrieve DOM tree
    const target_id = 'main';
    const dom_tree = await this.get_dom_tree(target_id);

    // 2. Create serializer per-operation
    const serializer = new DOMTreeSerializer(
        dom_tree,                        // REQUIRED root_node
        previous_cached_state || null,   // Optional previous state
        true,                            // enable_bbox_filtering
        null,                            // containment_threshold (default)
        this.paint_order_filtering       // From service config
    );

    // 3. Serialize
    const [serialized, timing] = serializer.serialize_accessible_elements();

    // 4. Return result
    return serialized;
}
```

## Compatibility

### Backward Compatibility
- **External API**: No breaking changes (signature unchanged)
- **Downstream Consumers**: No changes required
- **Serialization Format**: Output format unchanged

### Forward Compatibility
- Implementation detail (per-operation instantiation) is internal
- Future changes to serializer constructor will require updates here

## Performance Contract

### Time Complexity
- **Best Case**: O(n) where n = number of visible DOM nodes
- **Worst Case**: O(n²) with paint order filtering enabled
- **Expected**: <50ms for typical web pages (<1000 nodes)

### Space Complexity
- **Serializer Instance**: O(n) where n = tree size
- **Output Size**: O(m) where m = interactive elements
- **Peak Memory**: <5MB additional per operation

### Guarantees
- Serializer instance MUST be garbage collected after method returns
- No memory leaks from retained serializer state
- Performance MUST match previous implementation

## Testing Contract

### Unit Tests Required
1. **Test: Basic Serialization**
   - Input: No previous cached state
   - Expected: Valid SerializedDOMState returned
   - Verify: New serializer created

2. **Test: Cached State Preservation**
   - Input: Previous SerializedDOMState with selector_map
   - Expected: Stable indices maintained
   - Verify: previous_cached_state passed to serializer

3. **Test: Filtering Configuration**
   - Input: Various paint_order_filtering settings
   - Expected: Configuration passed to serializer
   - Verify: Correct filtering behavior

4. **Test: Multiple Invocations**
   - Action: Call method 3 times in sequence
   - Expected: Each creates independent serializer
   - Verify: No state pollution between calls

### Integration Tests Required
1. **Test: End-to-End Serialization**
   - Retrieve actual DOM tree
   - Serialize with new implementation
   - Verify output format matches expected structure

2. **Test: Performance Regression**
   - Benchmark against previous implementation
   - Expected: <50ms for 1000-node tree
   - Verify: No performance degradation

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-10 | Initial contract for refactored implementation |

---

**Contract Status**: Defined ✅
**Tests Status**: Pending ⏳
**Implementation Status**: Pending ⏳
