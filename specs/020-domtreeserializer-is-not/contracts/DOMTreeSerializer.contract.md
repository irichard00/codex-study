# Contract: DOMTreeSerializer Constructor

**Version**: 1.0.0
**Date**: 2025-10-10
**Status**: Verification (existing implementation)

## Constructor Signature

```typescript
constructor(
    root_node: EnhancedDOMTreeNode,
    previous_cached_state: SerializedDOMState | null = null,
    enable_bbox_filtering: boolean = true,
    containment_threshold: number | null = null,
    paint_order_filtering: boolean = true
)
```

## Input Contract

### Parameters

**`root_node`** (REQUIRED)
- **Type**: `EnhancedDOMTreeNode`
- **Purpose**: The DOM tree to serialize
- **Validation**:
  - MUST NOT be null or undefined
  - MUST have valid `node_type` field
  - MUST have `uuid` field
- **Error**: Throws TypeError if missing or invalid

**`previous_cached_state`** (optional)
- **Type**: `SerializedDOMState | null`
- **Purpose**: Previous serialization for index stability
- **Validation**: If provided, must have `selector_map` field
- **Default**: `null`

**`enable_bbox_filtering`** (optional)
- **Type**: `boolean`
- **Purpose**: Enable bounding box containment filtering
- **Default**: `true`

**`containment_threshold`** (optional)
- **Type**: `number | null`
- **Purpose**: Custom containment threshold (0-1 range)
- **Validation**: If provided, must be 0 ≤ value ≤ 1
- **Default**: `null` (uses `DEFAULT_CONTAINMENT_THRESHOLD`)

**`paint_order_filtering`** (optional)
- **Type**: `boolean`
- **Purpose**: Enable paint order occlusion filtering
- **Default**: `true`

### Preconditions
- `root_node` MUST be a fully constructed EnhancedDOMTreeNode
- `root_node` MUST have valid parent/children relationships
- If caching enabled, `previous_cached_state.selector_map` MUST be valid

## State Contract

### Internal State Initialized

```typescript
{
    root_node: EnhancedDOMTreeNode;                    // Stored reference
    _interactive_counter: number = 1;                   // Reset to 1
    _selector_map: DOMSelectorMap = {};                 // Empty map
    _previous_cached_selector_map?: DOMSelectorMap;     // From previous state
    _clickable_cache: Record<number, boolean> = {};     // Empty cache
    timing_info: Record<string, number> = {};           // Empty timing
    enable_bbox_filtering: boolean;                     // From parameter
    containment_threshold: number;                      // From parameter or default
    paint_order_filtering: boolean;                     // From parameter
}
```

### Invariants After Construction
1. `this.root_node` MUST reference the provided root_node
2. `this._interactive_counter` MUST be 1
3. `this._selector_map` MUST be empty object
4. If `previous_cached_state` provided, `this._previous_cached_selector_map` MUST be set
5. All boolean flags MUST have defined values (no undefined)

## Behavior Contract

### Immutability
- Constructor MUST NOT modify the provided `root_node`
- Constructor MUST NOT modify the provided `previous_cached_state`

### Side Effects
- NONE (pure initialization, no I/O or external state changes)

### Thread Safety
- Each instance is independent
- No shared state between instances
- Safe for concurrent instantiation

## Method Contract: serialize_accessible_elements()

### Signature
```typescript
serialize_accessible_elements(): [SerializedDOMState, Record<string, number>]
```

### Behavior
- **MUST** use the `root_node` provided in constructor
- **MUST** build `_selector_map` during processing
- **MUST** preserve indices from `_previous_cached_selector_map` when possible
- **MUST** return tuple of [SerializedDOMState, timing_info]

### Post-Conditions
- `this._selector_map` populated with all interactive elements
- `this.timing_info` contains performance metrics
- Returned SerializedDOMState matches constructor's root_node

## Usage Pattern

### Correct Usage ✅
```typescript
const dom_tree = await get_dom_tree('main');
const serializer = new DOMTreeSerializer(
    dom_tree,                 // REQUIRED
    previous_state || null,
    true,
    null,
    paint_order_filtering
);
const [result, timing] = serializer.serialize_accessible_elements();
```

### Incorrect Usage ❌
```typescript
// ERROR: Missing required root_node parameter
const serializer = new DOMTreeSerializer();

// ERROR: Wrong parameter order
const serializer = new DOMTreeSerializer(true, dom_tree);

// ERROR: Reusing serializer for different tree
serializer.root_node = different_tree;  // No setter exists
```

## Error Handling

### Constructor Errors
- **TypeError**: If `root_node` is null/undefined
- **TypeError**: If `root_node` is not an EnhancedDOMTreeNode
- **RangeError**: If `containment_threshold` is outside [0, 1] range

### Runtime Errors
- serialize_accessible_elements() may throw if root_node is malformed
- Errors should propagate to caller (no internal error suppression)

## Performance Contract

### Construction Time
- **Expected**: <1ms for any valid root_node
- **Complexity**: O(1) (no tree traversal in constructor)

### Memory Footprint
- **Base**: ~1KB for instance fields
- **Scaling**: O(n) where n = number of nodes (due to caches)
- **Peak**: ~5MB for large trees (10k+ nodes)

## Testing Contract

### Constructor Tests Required

1. **Test: Valid Construction**
   ```typescript
   const node = createMockEnhancedDOMTreeNode();
   const serializer = new DOMTreeSerializer(node);
   expect(serializer).toBeDefined();
   ```

2. **Test: Missing Root Node**
   ```typescript
   expect(() => new DOMTreeSerializer(null as any))
       .toThrow(TypeError);
   ```

3. **Test: Parameter Defaults**
   ```typescript
   const serializer = new DOMTreeSerializer(node);
   // Verify enable_bbox_filtering = true
   // Verify paint_order_filtering = true
   // Verify containment_threshold = DEFAULT_CONTAINMENT_THRESHOLD
   ```

4. **Test: Previous State Handling**
   ```typescript
   const previous_state = { _root: null, selector_map: { '/html': 1 } };
   const serializer = new DOMTreeSerializer(node, previous_state);
   // Verify _previous_cached_selector_map is set
   ```

## Compatibility

### Existing Code
- Constructor signature MUST remain unchanged
- All optional parameters MUST retain defaults
- serialize_accessible_elements() signature MUST remain unchanged

### Migration Path
- Callers MUST provide root_node (previously missing)
- All other parameters can use defaults (no changes needed)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-10 | Documented existing constructor contract |

---

**Contract Status**: Verified (existing implementation) ✅
**Tests Status**: Partial (missing constructor parameter tests) ⚠️
**Implementation Status**: Exists (no changes needed) ✅
