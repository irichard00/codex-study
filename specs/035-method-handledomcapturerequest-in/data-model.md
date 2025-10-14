# Data Model: DOM Capture System

**Feature**: 035-method-handledomcapturerequest-in
**Date**: 2025-10-12

## Overview

This document defines the data structures for DOM capture, focusing on the bug fixes required in `domCaptureHandler.ts`. The model is based on Chrome DevTools Protocol (CDP) DOM domain with custom extensions for accessibility and element snapshots.

## Core Entities

### TraversalResult (Extended)

**Purpose**: Result of DOM tree traversal including element reference map

**Current State** (src/tools/dom/chrome/domTraversal.ts:56-65):
```typescript
export interface TraversalResult {
  nodes: TraversedNode[];
  stats: {
    totalNodes: number;
    elementNodes: number;
    textNodes: number;
    maxDepth: number;
  };
}
```

**Required Extension** (Bug Fix):
```typescript
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

**Validation Rules**:
- `nodes.length === stats.totalNodes`
- `elementMap.size === stats.elementNodes`
- All keys in `elementMap` must be valid indices in `nodes` array
- All elements in `elementMap` must have `nodeType === 1` (ELEMENT_NODE)

**Relationships**:
- Used by: `captureDocument()` to attach snapshots and ARIA data
- Produced by: `traverseDOM()` during tree walk

---

### CapturedNode

**Purpose**: Serializable representation of a single DOM node

**Current State** (src/content/domCaptureHandler.ts:52-62):
```typescript
export interface CapturedNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  backendNodeId: number;
  parentIndex: number | null;
  childIndices: number[];
  attributes: Record<string, string>;
  snapshot?: ElementSnapshot;
  axNode?: EnhancedAXNode;
}
```

**Bug**: `nodeName` should be `number` (string pool index), not `string`

**Fixed Definition**:
```typescript
export interface CapturedNode {
  nodeType: number;
  nodeName: number;            // FIX: string pool index, not literal string
  nodeValue: string | null;
  backendNodeId: number;
  parentIndex: number | null;
  childIndices: number[];
  attributes: Record<number, number>;  // FIX: both key and value are indices
  snapshot?: ElementSnapshot;   // Only present for element nodes
  axNode?: EnhancedAXNode;      // Only present for element nodes
}
```

**Validation Rules**:
- `nodeType` must be 1 (ELEMENT), 3 (TEXT), 8 (COMMENT), or 9 (DOCUMENT)
- `backendNodeId` must be unique within document
- If `nodeType === 1`: `snapshot` and `axNode` MUST be present
- If `nodeType !== 1`: `snapshot` and `axNode` MUST be undefined
- `parentIndex` is null only for root node
- All indices in `childIndices` must exist in parent document's `nodes` array
- `nodeName` must be valid index in parent `CaptureSnapshotReturns.strings` array
- All keys/values in `attributes` must be valid indices in `strings` array

**State Transitions**:
1. Created empty during traversal
2. Populated with node metadata (type, name, value)
3. Enhanced with snapshot data (if element)
4. Enhanced with ARIA data (if element)
5. Serialized to JSON for message passing

---

### CaptureSnapshotReturns

**Purpose**: Complete snapshot of captured document(s) with string interning

**Current State** (src/content/domCaptureHandler.ts:67-70):
```typescript
export interface CaptureSnapshotReturns {
  documents: CapturedDocument[];
  strings: string[];
}
```

**Definition**: (No changes needed, already correct)

**Validation Rules**:
- `documents.length >= 1` (at least main document)
- `strings` array contains all unique strings referenced by indices in documents
- String indices used in `CapturedNode.nodeName` and `attributes` must be valid
- Interned strings reduce payload size by 60-70% for typical pages

**Serialization Format**:
```json
{
  "documents": [
    {
      "documentURL": "https://example.com",
      "baseURL": "https://example.com",
      "title": "Example Page",
      "frameId": "main",
      "nodes": [
        {
          "nodeType": 1,
          "nodeName": 5,  // index into strings array
          "backendNodeId": 1,
          "parentIndex": null,
          "childIndices": [1, 2],
          "attributes": { 12: 34 },  // key=strings[12], value=strings[34]
          "snapshot": { /* ... */ },
          "axNode": { /* ... */ }
        }
      ]
    }
  ],
  "strings": [
    "#document", "HTML", "HEAD", "BODY", "DIV", /* ... */
  ]
}
```

---

### ElementSnapshot

**Purpose**: Element bounding box, computed styles, and attributes

**Current State** (src/tools/dom/chrome/snapshotCapture.ts:8-28):
```typescript
export interface ElementSnapshot {
  backendNodeId: number;
  tagName: string;
  attributes: Record<string, string>;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyle: Record<string, string>;
  isVisible: boolean;
  innerHTML?: string;
  innerText?: string;
}
```

**Definition**: (No changes needed for bug fix)

**Validation Rules**:
- `backendNodeId` matches parent `CapturedNode.backendNodeId`
- `tagName` matches dereferenced `CapturedNode.nodeName`
- `boundingBox` values are non-negative numbers
- `isVisible` must match computed visibility (not display:none, visibility:hidden, etc.)

**Performance Considerations**:
- `getComputedStyle()` is expensive, captured in single pass
- `innerHTML` and `innerText` are optional (reduce payload for large elements)

---

### EnhancedAXNode

**Purpose**: Accessibility tree node with ARIA attributes and role

**Current State** (src/tools/dom/chrome/ariaExtraction.ts:27-45):
```typescript
export interface EnhancedAXNode {
  backendNodeId: number;
  role: string;
  name?: string;
  description?: string;
  value?: string;
  properties: Record<string, any>;
  focused: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
  selected?: boolean;
  parent?: number;
  children: number[];
}
```

**Definition**: (No changes needed for bug fix)

**Validation Rules**:
- `backendNodeId` matches parent `CapturedNode.backendNodeId`
- `role` is valid ARIA role or implicit role from tag name
- `parent` and `children` are backend node IDs (not array indices)
- Accessibility tree may be sparse (not all elements have AX nodes)

---

### StringPool

**Purpose**: String interning to reduce serialization payload size

**Current State** (src/tools/dom/chrome/stringInterning.ts:7-50):
```typescript
export class StringPool {
  private strings: string[] = [];
  private stringToIndex: Map<string, number> = new Map();

  internString(str: string): number {
    if (this.stringToIndex.has(str)) {
      return this.stringToIndex.get(str)!;
    }
    const index = this.strings.length;
    this.strings.push(str);
    this.stringToIndex.set(str, index);
    return index;
  }

  export(): string[] {
    return this.strings;
  }
}
```

**Bug**: Usage in `domCaptureHandler.ts` casts `number` return value to `string`:
```typescript
// WRONG (line 195):
nodeName: stringPool.internString(node.nodeName) as any

// CORRECT:
nodeName: stringPool.internString(node.nodeName)  // keep as number
```

**Validation Rules**:
- All interned strings must have unique indices
- `export()` returns array where `strings[index]` retrieves original string
- Same string always returns same index (idempotent)

**Performance**:
- Reduces payload size by 60-70% for typical pages
- Attribute names and common values (class names, etc.) heavily duplicated

---

## Entity Relationships

```
CaptureSnapshotReturns
├── documents: CapturedDocument[]
│   └── CapturedDocument
│       ├── nodes: CapturedNode[]
│       │   └── CapturedNode
│       │       ├── nodeName: number → strings[index]
│       │       ├── attributes: Record<number, number> → strings[k], strings[v]
│       │       ├── snapshot?: ElementSnapshot
│       │       └── axNode?: EnhancedAXNode
│       └── frameId: string
└── strings: string[]

TraversalResult
├── nodes: TraversedNode[]
├── elementMap: Map<number, Element>  ← NEW: enables snapshot attachment
└── stats: { ... }
```

## Data Flow (Bug Fix)

### Current (Broken) Flow

```
traverseDOM(doc.documentElement)
  → TraversalResult { nodes, stats }  ← missing elementMap!

captureDocument()
  → Loop through nodes
  → getElementByPath(index)  ← STUB: always returns root
  → element = null or wrong element
  → snapshot never attaches
  → axNode never attaches
  → CapturedNode incomplete

Result: Empty nodes array or nodes without snapshot/axNode
```

### Fixed Flow

```
traverseDOM(doc.documentElement)
  → Build elementMap during traversal
  → TraversalResult { nodes, elementMap, stats }  ← NEW: includes map

captureDocument()
  → Loop through nodes
  → element = elementMap.get(index)  ← Direct lookup
  → if (element) batchCaptureSnapshots([element])
  → if (element) batchExtractARIA([element])
  → Attach snapshot and axNode to CapturedNode
  → Intern strings in attributes

Result: Complete CapturedNode with all data attached
```

## Validation States

### CapturedNode States

1. **Invalid**: Missing required fields or inconsistent data
2. **Minimal**: Text/comment node with only basic fields (type, name, value)
3. **Partial**: Element node missing snapshot or axNode (BUG STATE)
4. **Complete**: Element node with all fields populated (CORRECT STATE)

### Validation Algorithm

```typescript
function validateCapturedNode(node: CapturedNode, strings: string[]): boolean {
  // Basic fields
  if (node.backendNodeId <= 0) return false;
  if (node.nodeName < 0 || node.nodeName >= strings.length) return false;

  // Element nodes MUST have snapshot and axNode
  if (node.nodeType === 1) {
    if (!node.snapshot) return false;  // BUG: missing snapshot
    if (!node.axNode) return false;    // BUG: missing axNode
    if (node.snapshot.backendNodeId !== node.backendNodeId) return false;
  }

  // Non-element nodes MUST NOT have snapshot/axNode
  if (node.nodeType !== 1) {
    if (node.snapshot || node.axNode) return false;
  }

  return true;
}
```

## Migration Notes

### Breaking Changes

None - this is a bug fix that makes existing interfaces work correctly.

### Data Compatibility

- Existing protocol types (`DOMCaptureRequestMessage`, `DOMCaptureResponseMessage`) unchanged
- Only internal implementation fixed to populate data correctly
- String interning fix requires updating both storage and retrieval logic

### Test Data Requirements

Test fixtures must include:
- Simple DOM: `<body><div>text</div></body>`
- Nested elements: Deep tree to test parent/child indices
- Multiple attributes: Test string interning with duplicates
- Hidden elements: Test `isVisible` and filtering logic
- Cross-origin iframe: Test error handling

---

**Status**: Data model defined, ready for contract generation
