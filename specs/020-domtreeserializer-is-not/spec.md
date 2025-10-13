# Feature Specification: Fix DOMTreeSerializer Instantiation in DomService

**Feature Branch**: `020-domtreeserializer-is-not`
**Created**: 2025-10-10
**Status**: Draft
**Input**: User description: "DOMTreeSerializer is not correctly instantiated in codex-chrome/src/tools/dom/service.ts, in the constructor codex-chrome/src/tools/dom/serializer/serializer.ts, it needs params to work with it. This task is to scan through the whole codex-chrome/ to see how we can correctly construct the params for DOMTreeSerializer"

## Execution Flow (main)
```
1. Parse user description from Input
   → Identified: DOMTreeSerializer instantiation issue in service.ts:56
2. Extract key concepts from description
   → Actors: DomService class, DOMTreeSerializer class
   → Actions: Instantiate serializer with required parameters
   → Data: DOM tree root node, previous cached state, filtering options
   → Constraints: Constructor signature requires root_node parameter
3. For each unclear aspect:
   → ✓ Clear: Constructor signature analysis shows root_node is required
   → ✓ Clear: serialize_accessible_elements is an instance method, not static
4. Fill User Scenarios & Testing section
   → Primary scenario: DomService instantiates serializer per operation
5. Generate Functional Requirements
   → All requirements are testable and unambiguous
6. Identify Key Entities
   → DOMTreeSerializer, DomService, EnhancedDOMTreeNode
7. Run Review Checklist
   → ✓ No implementation details beyond necessary API signatures
   → ✓ No [NEEDS CLARIFICATION] markers remain
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
When the DOM service needs to serialize a DOM tree for agent consumption, it must create a serializer instance with the appropriate DOM tree root node. The current implementation incorrectly instantiates the serializer without required parameters in the constructor, causing it to fail when the serialize method is called.

### Acceptance Scenarios
1. **Given** a DomService instance is created, **When** get_serialized_dom_tree() is called, **Then** a DOMTreeSerializer must be instantiated with the root node from the DOM tree
2. **Given** a DOM tree has been retrieved, **When** serializing the tree, **Then** the serializer must receive the root node, optional previous cached state, and filtering configuration
3. **Given** the serializer is created per operation, **When** multiple serialization operations occur, **Then** each operation must create a new serializer instance with its own root node

### Edge Cases
- What happens when previous_cached_state is undefined (first serialization)?
- How does the system handle when the root node is null or invalid?
- What should occur if paint_order_filtering configuration changes between operations?

## Requirements

### Functional Requirements
- **FR-001**: System MUST NOT instantiate DOMTreeSerializer without a root node parameter in the DomService constructor
- **FR-002**: System MUST create a new DOMTreeSerializer instance for each serialization operation in get_serialized_dom_tree()
- **FR-003**: System MUST pass the retrieved DOM tree root node as the first parameter to DOMTreeSerializer constructor
- **FR-004**: System MUST pass the optional previous_cached_state parameter to DOMTreeSerializer constructor when provided
- **FR-005**: System MUST pass filtering configuration (enable_bbox_filtering, containment_threshold, paint_order_filtering) to DOMTreeSerializer constructor
- **FR-006**: System MUST call the instance method serialize_accessible_elements() on the instantiated serializer (not as a static method)
- **FR-007**: System MUST remove the serializer field from DomService class since serialization is per-operation, not per-service

### Key Entities
- **DOMTreeSerializer**: Stateful serialization processor that requires a specific DOM tree root node to operate on. Contains configuration for filtering and caching behavior.
- **DomService**: Service class that orchestrates DOM tree retrieval and serialization operations. Should create serializer instances as needed rather than storing a reusable instance.
- **EnhancedDOMTreeNode**: The root node of a DOM tree that serves as input to the serializer. Represents the starting point for tree traversal and serialization.

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none found - signatures are clear)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
