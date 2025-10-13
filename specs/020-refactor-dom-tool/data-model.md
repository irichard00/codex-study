# Data Model: DOMTool High-Level DOM Reading

**Date**: 2025-10-11
**Feature**: 020-refactor-dom-tool

## Overview

This document defines the data structures for the refactored DOMTool that provides high-level DOM reading capabilities. The model focuses on comprehensive page representation suitable for AI agent consumption.

---

## Core Entities

### 1. SerializedDOMState

**Purpose**: Complete representation of a page's DOM suitable for LLM consumption

**Fields**:
```typescript
interface SerializedDOMState {
  // Serialized tree as string (with element indices like "[1]" for clickable elements)
  serialized_tree: string;

  // Mapping from element index to full node details
  selector_map: DOMSelectorMap;  // { [index: number]: EnhancedDOMTreeNode }

  // Metadata about the capture
  metadata: {
    capture_timestamp: number;
    page_url: string;
    page_title: string;
    viewport: ViewportInfo;
    total_nodes: number;
    interactive_elements: number;
    iframe_count: number;
    max_depth: number;
  };

  // Performance timing info
  timing: {
    dom_traversal_ms: number;
    serialization_ms: number;
    total_ms: number;
  };

  // Errors and warnings encountered during capture
  errors?: DOMCaptureError[];
  warnings?: DOMCaptureWarning[];
}
```

**Relationships**:
- Contains multiple EnhancedDOMTreeNode via selector_map
- References ViewportInfo for display context
- May have multiple DOMCaptureError/Warning

**Validation Rules**:
- `serialized_tree` must not be empty
- `capture_timestamp` must be valid Unix timestamp
- `total_nodes` must be >= `interactive_elements`
- `iframe_count` must be <= max_iframes configuration

**State Transitions**: Immutable once created

---

### 2. EnhancedDOMTreeNode

**Purpose**: Rich representation of a single DOM node with all metadata

**Fields**:
```typescript
interface EnhancedDOMTreeNode {
  // Core DOM properties
  node_id: number;
  backend_node_id: number;
  node_type: NodeType;
  node_name: string;
  node_value: string;
  attributes: Record<string, string>;

  // Computed properties
  is_visible: boolean | null;
  is_scrollable: boolean | null;
  absolute_position: DOMRect | null;

  // Context information
  target_id: string;           // Page or iframe ID
  frame_id: string | null;
  session_id: string | null;

  // Tree structure
  parent_node: EnhancedDOMTreeNode | null;
  children_nodes: EnhancedDOMTreeNode[] | null;
  content_document: EnhancedDOMTreeNode | null;  // For iframes
  shadow_roots: EnhancedDOMTreeNode[] | null;
  shadow_root_type: ShadowRootType | null;

  // Enrichment data
  ax_node: EnhancedAXNode | null;           // Accessibility information
  snapshot_node: EnhancedSnapshotNode | null; // Snapshot data

  // Indexing
  element_index: number | null;  // Interactive element index (e.g., 1 for [1])

  // Internal
  uuid: string;
  _compound_children: any[];
}
```

**Relationships**:
- Parent-child tree structure via `parent_node` and `children_nodes`
- One-to-one with EnhancedAXNode (accessibility info)
- One-to-one with EnhancedSnapshotNode (computed styles, bounds)
- May contain iframe via `content_document`
- May contain shadow DOM via `shadow_roots`

**Validation Rules**:
- `node_type` must be valid NodeType enum value
- If `element_index` is set, node must be visible and interactive
- `absolute_position` must be non-negative coordinates if set
- `children_nodes` must not contain self (prevent cycles)

---

### 3. EnhancedAXNode

**Purpose**: Accessibility information for a DOM element

**Fields**:
```typescript
interface EnhancedAXNode {
  ax_node_id: string;
  ignored: boolean;              // Whether ignored by accessibility tree
  role: string | null;           // ARIA role
  name: string | null;           // Accessible name
  description: string | null;    // Accessible description
  properties: AXProperty[] | null; // ARIA properties
  child_ids: string[] | null;    // Child AX node IDs
}

interface AXProperty {
  name: string;                   // Property name (e.g., "aria-expanded")
  value: any;                     // Property value
}
```

**Relationships**:
- One-to-one with EnhancedDOMTreeNode
- References other EnhancedAXNode via `child_ids`

**Validation Rules**:
- `role` should be valid ARIA role if set
- `ignored` must be boolean

---

### 4. EnhancedSnapshotNode

**Purpose**: Snapshot data captured from the live DOM

**Fields**:
```typescript
interface EnhancedSnapshotNode {
  // Bounding box
  bounds: DOMRect | null;

  // Computed styles (subset of important styles)
  computed_styles: Record<string, string>;

  // Content
  text_value: string | null;
  input_value: string | null;

  // State
  is_clickable: boolean;
  current_source_url: string | null; // For img, iframe, etc.

  // Scrolling
  scroll_offset_x: number | null;
  scroll_offset_y: number | null;

  // Layout
  layout_node_index: number | null;
  paint_order: number | null;
}
```

**Relationships**:
- One-to-one with EnhancedDOMTreeNode

**Validation Rules**:
- `bounds` coordinates must be non-negative if set
- `computed_styles` should contain at least display, visibility, opacity

---

### 5. DOMCaptureRequest

**Purpose**: Request to capture DOM from a specific tab

**Fields**:
```typescript
interface DOMCaptureRequest {
  // Target
  tab_id?: number;               // Tab to capture (undefined = active tab)

  // Options
  include_shadow_dom?: boolean;  // Include shadow DOM (default: true)
  include_iframes?: boolean;     // Include iframes (default: true)
  max_iframe_depth?: number;     // Max iframe nesting (default: 3)
  max_iframe_count?: number;     // Max total iframes (default: 15)

  // Filtering
  paint_order_filtering?: boolean;  // Remove occluded elements (default: true)
  bbox_filtering?: boolean;         // Remove off-screen elements (default: true)

  // Performance
  timeout_ms?: number;           // Capture timeout (default: 5000)
  use_cache?: boolean;           // Use cached result if valid (default: true)

  // Debugging
  include_timing?: boolean;      // Include performance timing (default: false)
}
```

**Relationships**:
- Produces one SerializedDOMState

**Validation Rules**:
- `tab_id` must be valid Chrome tab ID if specified
- `max_iframe_depth` must be >= 0 and <= 10
- `max_iframe_count` must be >= 0 and <= 50
- `timeout_ms` must be >= 100 and <= 30000

---

### 6. DOMCaptureResponse

**Purpose**: Response from DOM capture operation

**Fields**:
```typescript
interface DOMCaptureResponse {
  success: boolean;
  dom_state?: SerializedDOMState;
  error?: DOMCaptureError;
  warnings?: DOMCaptureWarning[];
}
```

**Relationships**:
- Contains one SerializedDOMState on success
- Contains one DOMCaptureError on failure
- May contain multiple DOMCaptureWarning

**Validation Rules**:
- If `success` is true, `dom_state` must be present
- If `success` is false, `error` must be present

---

### 7. DOMCaptureError

**Purpose**: Detailed error information from failed capture

**Fields**:
```typescript
interface DOMCaptureError {
  code: DOMErrorCode;
  message: string;
  element?: string;              // Selector or description of problematic element
  details?: any;                 // Additional error context
}

enum DOMErrorCode {
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TAB_NOT_FOUND = 'TAB_NOT_FOUND',
  CONTENT_SCRIPT_NOT_LOADED = 'CONTENT_SCRIPT_NOT_LOADED',
  CROSS_ORIGIN_FRAME = 'CROSS_ORIGIN_FRAME',
  MESSAGE_SIZE_EXCEEDED = 'MESSAGE_SIZE_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

**State Transitions**: Immutable once created

---

### 8. DOMCaptureWarning

**Purpose**: Non-fatal issues encountered during capture

**Fields**:
```typescript
interface DOMCaptureWarning {
  type: DOMWarningType;
  message: string;
  element?: string;
}

enum DOMWarningType {
  DEPTH_LIMIT_REACHED = 'DEPTH_LIMIT_REACHED',
  COUNT_LIMIT_REACHED = 'COUNT_LIMIT_REACHED',
  SIZE_LIMIT_REACHED = 'SIZE_LIMIT_REACHED',
  CROSS_ORIGIN_IFRAME_SKIPPED = 'CROSS_ORIGIN_IFRAME_SKIPPED',
  PARTIAL_ACCESSIBILITY_DATA = 'PARTIAL_ACCESSIBILITY_DATA'
}
```

**State Transitions**: Immutable once created

---

### 9. ViewportInfo

**Purpose**: Viewport dimensions and device information

**Fields**:
```typescript
interface ViewportInfo {
  width: number;
  height: number;
  device_pixel_ratio: number;
  scroll_x: number;
  scroll_y: number;
  visible_width: number;         // Actual visible area (excluding scrollbars)
  visible_height: number;
}
```

**Validation Rules**:
- All dimensions must be > 0
- `device_pixel_ratio` must be > 0 (typically 1-3)
- Scroll offsets must be >= 0

---

### 10. DOMRect

**Purpose**: Bounding box coordinates

**Fields**:
```typescript
interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Validation Rules**:
- All values must be finite numbers
- `width` and `height` must be >= 0
- For absolute positions, `x` and `y` should be >= 0

---

## Entity Relationship Diagram

```
DOMCaptureRequest
    ↓ produces
DOMCaptureResponse
    ↓ contains (on success)
SerializedDOMState
    ↓ contains
    ├── selector_map → { [index]: EnhancedDOMTreeNode }
    ├── metadata → ViewportInfo
    ├── errors → DOMCaptureError[]
    └── warnings → DOMCaptureWarning[]

EnhancedDOMTreeNode
    ├── ax_node → EnhancedAXNode (1:1)
    ├── snapshot_node → EnhancedSnapshotNode (1:1)
    ├── parent_node → EnhancedDOMTreeNode (recursive)
    ├── children_nodes → EnhancedDOMTreeNode[] (recursive)
    ├── content_document → EnhancedDOMTreeNode (iframe)
    └── shadow_roots → EnhancedDOMTreeNode[] (shadow DOM)
```

---

## Data Flow

1. **Request**: Agent calls `DOMTool.captureDOM(request: DOMCaptureRequest)`
2. **Validation**: Validate request parameters
3. **Target**: Resolve tab_id to actual Chrome tab
4. **Content Script**: Send message to content script with capture options
5. **Traversal**: Content script traverses DOM, building tree structure
6. **Enhancement**: Attach accessibility, snapshot, and computed data
7. **Serialization**: DOMTreeSerializer converts tree to SerializedDOMState
8. **Response**: Return DOMCaptureResponse with serialized state
9. **Agent**: Agent receives serialized tree and selector map for interaction

---

## Caching Strategy

**Cache Key**: `${tab_id}_${document_url}_${document_hash}`

**Cache Validity**:
- Valid for 30 seconds
- Invalidated on navigation events
- Invalidated on explicit user cache clear

**Cache Storage**:
- In-memory Map in background service worker
- Max 5 entries (LRU eviction)
- Each entry max 10MB

---

## Size Limits

- Max serialized_tree size: 5MB (compressed)
- Max selector_map entries: 10,000
- Max message size (content script → background): 4MB
- Max string interning pool: 100,000 unique strings

---

## Performance Characteristics

| Operation | Typical | Worst Case | Target |
|-----------|---------|------------|--------|
| Simple page (<1000 nodes) | 100ms | 300ms | <500ms |
| Medium page (1000-5000 nodes) | 300ms | 800ms | <1s |
| Complex page (5000-20000 nodes) | 800ms | 2000ms | <2s |
| Cached retrieval | 5ms | 50ms | <100ms |

---

## Example Data

### Example SerializedDOMState:
```json
{
  "serialized_tree": "[1] <button class=\"primary\">Submit</button>\n[2] <input type=\"text\" placeholder=\"Name\" />\n<div class=\"container\">\n  [3] <a href=\"/home\">Home</a>\n</div>",
  "selector_map": {
    "1": { /* EnhancedDOMTreeNode for button */ },
    "2": { /* EnhancedDOMTreeNode for input */ },
    "3": { /* EnhancedDOMTreeNode for link */ }
  },
  "metadata": {
    "capture_timestamp": 1696176000000,
    "page_url": "https://example.com/form",
    "page_title": "Contact Form",
    "viewport": {
      "width": 1920,
      "height": 1080,
      "device_pixel_ratio": 2,
      "scroll_x": 0,
      "scroll_y": 100
    },
    "total_nodes": 342,
    "interactive_elements": 3,
    "iframe_count": 0,
    "max_depth": 12
  },
  "timing": {
    "dom_traversal_ms": 145,
    "serialization_ms": 32,
    "total_ms": 177
  }
}
```
