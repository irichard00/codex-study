# Data Model: Fix DOMTreeSerializer Instantiation

**Date**: 2025-10-10
**Feature**: 020-domtreeserializer-is-not

## Overview
This refactoring does not introduce new data models. It modifies the lifecycle and instantiation pattern of existing entities.

## Entities

### DOMTreeSerializer (Modified Lifecycle)

**Purpose**: Serializes a DOM tree into a format consumable by LLMs.

**Lifecycle Change**:
- **Before**: Instance created in DomService constructor, reused across operations
- **After**: Instance created per-operation in get_serialized_dom_tree(), destroyed after use

**Constructor Parameters**:
```typescript
interface DOMTreeSerializerParams {
    root_node: EnhancedDOMTreeNode;              // REQUIRED - DOM tree to serialize
    previous_cached_state?: SerializedDOMState;  // Optional - for differential updates
    enable_bbox_filtering?: boolean;             // Optional - default true
    containment_threshold?: number | null;       // Optional - default null (uses DEFAULT_CONTAINMENT_THRESHOLD)
    paint_order_filtering?: boolean;             // Optional - default true
}
```

**State**:
- `root_node: EnhancedDOMTreeNode` - The tree being serialized
- `_interactive_counter: number` - Tracks interactive element indices
- `_selector_map: DOMSelectorMap` - Maps XPaths to interactive indices
- `_clickable_cache: Record<number, boolean>` - Cached clickability checks
- `timing_info: Record<string, number>` - Performance metrics

**Validation Rules**:
- `root_node` MUST NOT be null/undefined
- `root_node` MUST be a valid EnhancedDOMTreeNode
- If `previous_cached_state` provided, its selector_map MUST be used for index stability

**State Transitions**:
```
[Created] → (constructor) → [Initialized]
[Initialized] → (serialize_accessible_elements) → [Serialized]
[Serialized] → (end of method scope) → [Destroyed]
```

### DomService (Modified)

**Purpose**: Orchestrates DOM tree retrieval and serialization operations.

**Field Removal**:
```typescript
// REMOVE: private serializer: DOMTreeSerializer;
```

**Method Modification**: `get_serialized_dom_tree()`

**Input**:
```typescript
{
    previous_cached_state?: SerializedDOMState
}
```

**Output**:
```typescript
SerializedDOMState
```

**Internal Flow**:
1. Retrieve DOM tree via `get_dom_tree(target_id)`
2. Create DOMTreeSerializer with retrieved tree + parameters
3. Call `serialize_accessible_elements()` on the instance
4. Return serialized result

### EnhancedDOMTreeNode (Unchanged)

**Purpose**: Represents a node in the enhanced DOM tree.

**Key Attributes**:
- `node_id: number`
- `node_type: NodeType`
- `node_name: string`
- `children_nodes: EnhancedDOMTreeNode[] | null`
- `ax_node: EnhancedAXNode | null`
- `snapshot_node: EnhancedSnapshotNode | null`

**Role**: Serves as the root input to DOMTreeSerializer constructor.

### SerializedDOMState (Unchanged)

**Purpose**: Output format of serialization.

**Structure**:
```typescript
interface SerializedDOMState {
    _root: SimplifiedNode | null;
    selector_map: DOMSelectorMap;
}
```

**Role**: Both input (previous state) and output of serialization operations.

## Relationships

```
DomService
    ├─ creates ──> DOMTreeSerializer (per operation)
    ├─ retrieves ──> EnhancedDOMTreeNode (via get_dom_tree)
    └─ passes ──> SerializedDOMState (previous state)

DOMTreeSerializer
    ├─ requires ──> EnhancedDOMTreeNode (constructor)
    ├─ accepts ──> SerializedDOMState (optional, for caching)
    └─ produces ──> SerializedDOMState (output)
```

## Constraints

### Invariants
1. DOMTreeSerializer MUST NOT be instantiated without a root_node
2. DomService MUST NOT store a DOMTreeSerializer instance as a field
3. Each serialization operation MUST create a new DOMTreeSerializer
4. Previous cached state MUST be passed to constructor, not to serialize_accessible_elements()

### Performance Constraints
- Serializer instantiation MUST complete in <1ms
- Total serialization time MUST remain <50ms for typical trees
- Memory overhead per serializer MUST be <5MB

## Migration Path

### Before (Incorrect)
```typescript
export class DomService {
    private serializer: DOMTreeSerializer;  // ❌ Stored as field

    constructor(...) {
        this.serializer = new DOMTreeSerializer();  // ❌ No parameters
    }

    async get_serialized_dom_tree(previous_cached_state?: SerializedDOMState) {
        const dom_tree = await this.get_dom_tree(target_id);
        // ❌ Calls with parameters but serializer has no root_node
        return this.serializer.serialize_accessible_elements(
            dom_tree,
            this.paint_order_filtering,
            previous_cached_state
        );
    }
}
```

### After (Correct)
```typescript
export class DomService {
    // ✅ No serializer field

    constructor(...) {
        // ✅ No serializer initialization
    }

    async get_serialized_dom_tree(previous_cached_state?: SerializedDOMState) {
        const dom_tree = await this.get_dom_tree(target_id);

        // ✅ Create per-operation with required parameters
        const serializer = new DOMTreeSerializer(
            dom_tree,
            previous_cached_state || null,
            true,  // enable_bbox_filtering
            null,  // containment_threshold (use default)
            this.paint_order_filtering
        );

        // ✅ Call instance method (returns tuple)
        const [serialized, timing] = serializer.serialize_accessible_elements();

        return serialized;
    }
}
```

## Validation

### Type Safety
- TypeScript compiler MUST enforce root_node requirement
- TypeScript MUST prevent DOMTreeSerializer() call without parameters

### Runtime Checks
- No explicit validation needed (TypeScript enforces at compile time)
- Existing error handling in serialize_accessible_elements() remains

---

**Status**: Data model analysis complete, ready for contracts generation
