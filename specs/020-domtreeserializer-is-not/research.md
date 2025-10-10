# Research: Fix DOMTreeSerializer Instantiation

**Date**: 2025-10-10
**Feature**: 020-domtreeserializer-is-not

## Problem Analysis

### Current Implementation Issue
**Location**: `codex-chrome/src/tools/dom/service.ts:56`

```typescript
// INCORRECT: No parameters passed to constructor
this.serializer = new DOMTreeSerializer();
```

**Location**: `codex-chrome/src/tools/dom/serializer/serializer.ts:32-44`

```typescript
// Constructor signature REQUIRES root_node
constructor(
    root_node: EnhancedDOMTreeNode,
    previous_cached_state: SerializedDOMState | null = null,
    enable_bbox_filtering: boolean = true,
    containment_threshold: number | null = null,
    paint_order_filtering: boolean = true
)
```

### Root Cause
DOMTreeSerializer is a **stateful** serializer that operates on a specific DOM tree. The constructor requires:
1. `root_node` - The DOM tree to serialize (REQUIRED)
2. `previous_cached_state` - For differential serialization (optional)
3. Filtering configuration parameters (optional with defaults)

The serializer cannot be reused across different DOM trees because it stores the root_node in its state.

## Design Decision

### Decision: Per-Operation Instantiation
Create a new DOMTreeSerializer instance for each `get_serialized_dom_tree()` call.

### Rationale
1. **Stateful Nature**: The serializer stores `this.root_node` and builds internal caches (`_clickable_cache`, `_selector_map`) specific to one tree
2. **Different Trees**: Each call to `get_serialized_dom_tree()` may retrieve a different DOM tree from the current page state
3. **Cache Invalidation**: Previous cached state is operation-specific, not service-wide
4. **Thread Safety**: In async contexts, having instance-level state could cause race conditions if reused

### Alternatives Considered

**Alternative 1: Reset Method**
- Add a `reset(root_node, previous_cached_state)` method to reinitialize the serializer
- **Rejected**: More complex API, easy to forget to call reset, doesn't align with stateless service patterns

**Alternative 2: Static Method**
- Make `serialize_accessible_elements()` static and pass all state as parameters
- **Rejected**: Would require extensive refactoring of the serializer's internal methods that rely on instance state

**Alternative 3: Lazy Initialization**
- Keep serializer field, initialize on first use
- **Rejected**: Doesn't solve the fundamental issue of needing different root_nodes per operation

## Implementation Approach

### Changes Required

#### 1. Remove serializer field from DomService
```typescript
// DELETE this line from service.ts
private serializer: DOMTreeSerializer;
```

#### 2. Remove serializer initialization from constructor
```typescript
// DELETE this line from service.ts constructor
this.serializer = new DOMTreeSerializer();
```

#### 3. Update get_serialized_dom_tree() method
```typescript
async get_serialized_dom_tree(
    previous_cached_state?: SerializedDOMState
): Promise<SerializedDOMState> {
    const target_id = 'main';
    const dom_tree = await this.get_dom_tree(target_id);

    // CREATE serializer per-operation with all required parameters
    const serializer = new DOMTreeSerializer(
        dom_tree,                        // root_node (REQUIRED)
        previous_cached_state || null,   // previous state
        true,                            // enable_bbox_filtering (default)
        null,                            // containment_threshold (use default)
        this.paint_order_filtering       // from service config
    );

    // Call instance method
    const [serialized, timing] = serializer.serialize_accessible_elements();

    return serialized;
}
```

### API Surface Changes
- **Breaking Changes**: None - `get_serialized_dom_tree()` signature unchanged
- **Internal Changes**: Serializer lifecycle (constructor-scoped → method-scoped)

## Testing Strategy

### Unit Tests Required
1. **Test: Constructor Parameters**
   - Verify DOMTreeSerializer receives correct root_node
   - Verify filtering config is passed correctly
   - Verify previous_cached_state is passed when provided

2. **Test: Multiple Operations**
   - Call `get_serialized_dom_tree()` multiple times
   - Verify each creates a new serializer instance
   - Verify no state pollution between calls

3. **Test: Edge Cases**
   - Null/undefined previous_cached_state
   - Different filtering configurations
   - Empty DOM tree

### Integration Tests
- Verify existing DomService consumers still work
- Verify serialization output format unchanged

## Dependencies

### TypeScript/Language Features
- **Feature**: Constructor parameter passing
- **Version**: TypeScript 5.9 fully supports
- **Risk**: None

### Chrome Extension APIs
- **Impact**: None - pure internal refactoring
- **Risk**: None

## Performance Impact

### Expected
- **Memory**: Slight improvement (no persistent serializer state)
- **CPU**: Negligible (constructor overhead ~0.1ms)
- **Overall**: No measurable change to serialization time (<50ms target maintained)

### Measurement
- Existing performance tests should continue to pass
- No new performance benchmarks required

## Rollout Strategy

### Deployment
1. Update service.ts and remove serializer field
2. Run unit tests
3. Run integration tests
4. No phased rollout needed (internal refactoring)

### Rollback
- Simple: Revert commit
- Risk: Low (breaking changes = none)

## Open Questions

None - implementation approach is straightforward.

---

**Status**: Research complete, ready for Phase 1 (Design & Contracts)
