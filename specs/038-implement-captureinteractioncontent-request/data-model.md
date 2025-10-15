# Data Model: Capture Interaction Content

**Feature**: 038-implement-captureinteractioncontent-request
**Date**: 2025-10-14
**Status**: Complete

## Overview
This document defines the data structures for the page interaction model. These entities represent the compact, LLM-optimized view of web page interactive elements.

---

## Entities

### 1. PageModel

**Purpose**: Root output structure representing the complete interaction model of a web page.

**Schema**:
```typescript
interface PageModel {
  title: string;                    // Page title (from document.title)
  url?: string;                     // Page URL (optional, from baseUrl or document.location)
  headings: string[];               // Extracted headings (h1, h2, h3), max 30
  regions: string[];                // Unique landmark region types present on page
  controls: InteractiveControl[];   // Actionable elements, max 400
  aimap: SelectorMap;               // Mapping of stable IDs to CSS selectors
}
```

**Fields**:
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| title | string | Yes | Max 500 chars | Page document title |
| url | string | No | Valid URL format | Page URL (from baseUrl option or location.href) |
| headings | string[] | Yes | Max 30 items, each max 200 chars | Ordered list of h1/h2/h3 text content |
| regions | string[] | Yes | Unique values only | Landmark types: main, nav, header, footer, aside, dialog, search |
| controls | InteractiveControl[] | Yes | Max 400 items | Interactive elements captured on page |
| aimap | SelectorMap | Yes | Keys match control IDs | ID-to-selector mapping for element location |

**Relationships**:
- Contains 0-400 `InteractiveControl` instances
- Each `InteractiveControl.id` has corresponding entry in `aimap`
- `regions` values correspond to `InteractiveControl.region` values

**Validation Rules**:
- `title` must not be empty (default to "Untitled" if document.title empty)
- `headings` must be deduplicated and trimmed
- `regions` must contain unique values only (Set semantics)
- `controls` must have unique `id` values
- `aimap` keys must match all `controls[].id` values exactly

**Example**:
```json
{
  "title": "Login - Example Site",
  "url": "https://example.com/login",
  "headings": ["Login", "Welcome Back"],
  "regions": ["main", "navigation", "header"],
  "controls": [
    {
      "id": "te_1",
      "role": "textbox",
      "name": "Email",
      "states": {
        "required": true,
        "placeholder": "you@example.com",
        "value_len": 0
      },
      "selector": "#email",
      "region": "main",
      "boundingBox": { "x": 100, "y": 200, "width": 300, "height": 40 },
      "visible": true,
      "inViewport": true
    }
  ],
  "aimap": {
    "te_1": "#email",
    "te_2": "#password",
    "bu_3": "form > button.primary"
  }
}
```

---

### 2. InteractiveControl

**Purpose**: Represents a single actionable element on the page with its current state and actionability metadata.

**Schema**:
```typescript
interface InteractiveControl {
  id: string;                       // Stable unique ID for LLM reference
  role: string;                     // ARIA role or inferred semantic role
  name: string;                     // Computed accessible name (WCAG)
  states: ControlStates;            // Element-specific states
  selector: string;                 // CSS selector for element location
  region?: string;                  // Containing landmark region type
  boundingBox?: BoundingBox;        // Element position and dimensions
  visible: boolean;                 // Element visibility (computed styles + bbox)
  inViewport: boolean;              // Element within current viewport
}
```

**Fields**:
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | string | Yes | Format: `{role[0:2]}_{counter}` | Stable unique identifier |
| role | string | Yes | Valid ARIA role or HTML semantic | Element role (button, link, textbox, etc.) |
| name | string | Yes | Max 160 chars, trimmed | Accessible name from WCAG calculation |
| states | ControlStates | Yes | See ControlStates schema | Element-specific state properties |
| selector | string | Yes | Valid CSS selector syntax | CSS selector for element location |
| region | string | No | One of: main, nav, header, footer, aside, dialog, search | Containing landmark region |
| boundingBox | BoundingBox | No | Valid dimensions | Element position and size |
| visible | boolean | Yes | - | Element visibility (styles + bbox check) |
| inViewport | boolean | Yes | - | Element within viewport bounds |

**Validation Rules**:
- `id` must be unique within a PageModel
- `id` format: 2-char role prefix + underscore + sequential number (e.g., "bu_1", "te_5")
- `name` must be trimmed, max 160 characters
- `selector` must be valid CSS selector (parseable by querySelector)
- `role` must match one of 20+ supported types (see Role Types below)
- `region` if present must match one of the landmark types in PageModel.regions

**Role Types** (20+ supported):
- **Buttons**: button
- **Links**: link
- **Inputs**: textbox, checkbox, radio, combobox (select)
- **Containers**: main, navigation, header, footer, aside, dialog, search, region
- **Interactive**: menuitem, tab, switch, slider
- **Other**: (expandable based on ARIA roles)

**Example**:
```json
{
  "id": "bu_3",
  "role": "button",
  "name": "Sign In",
  "states": {
    "disabled": false
  },
  "selector": "form > button.btn-primary",
  "region": "main",
  "boundingBox": { "x": 150, "y": 350, "width": 120, "height": 40 },
  "visible": true,
  "inViewport": true
}
```

---

### 3. ControlStates

**Purpose**: Element-specific state properties that vary by role and element type.

**Schema**:
```typescript
interface ControlStates {
  // Common states (all elements)
  disabled?: boolean;               // Element is disabled (not actionable)

  // Checkbox/Radio states
  checked?: boolean | string;       // Checked state (boolean or "mixed")

  // Expandable element states (accordions, menus)
  expanded?: boolean;               // Expansion state

  // Form field states
  required?: boolean;               // Field is required
  placeholder?: string;             // Placeholder text (max 80 chars)
  value_len?: number;               // Value length (privacy: not actual value)

  // Link states
  href?: string;                    // Link destination (relative path preferred)

  // Extensible: Additional states as needed
  [key: string]: boolean | string | number | null | undefined;
}
```

**Fields**:
| Field | Type | Applicable Roles | Description |
|-------|------|------------------|-------------|
| disabled | boolean | All | Element is disabled (aria-disabled or HTMLElement.disabled) |
| checked | boolean \| string | checkbox, radio | Checked state (true/false/"mixed") |
| expanded | boolean | button (with aria-expanded), details, summary | Expansion state |
| required | boolean | textbox, combobox, checkbox, radio | Field is required for form submission |
| placeholder | string (max 80) | textbox, combobox | Placeholder text hint |
| value_len | number | textbox (non-password), combobox | Character count (NOT actual value) |
| href | string | link | Link destination (relative path or full URL) |

**Validation Rules**:
- `disabled`: Only included if true
- `checked`: Only for checkbox/radio roles
- `expanded`: Only for expandable elements (aria-expanded attribute)
- `required`: Only for form fields
- `placeholder`: Trimmed, max 80 characters
- `value_len`: Only for non-password textbox/combobox, never negative
- `href`: For links, convert to relative path when possible (strip origin)

**Privacy Rules**:
- **NEVER** include actual form field values
- Use `value_len` to indicate filled vs. empty (preserves signal without exposing data)
- **NEVER** include `value_len` for password fields (even length can leak info)

**Example**:
```json
{
  "required": true,
  "placeholder": "Enter your email",
  "value_len": 0
}
```

---

### 4. BoundingBox

**Purpose**: Element position and dimensions for actionability and viewport calculations.

**Schema**:
```typescript
interface BoundingBox {
  x: number;          // Left position (pixels from viewport left)
  y: number;          // Top position (pixels from viewport top)
  width: number;      // Element width (pixels)
  height: number;     // Element height (pixels)
}
```

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| x | number | >= 0 | Left edge position relative to viewport |
| y | number | >= 0 | Top edge position relative to viewport |
| width | number | > 0 | Element width in pixels |
| height | number | > 0 | Element height in pixels |

**Validation Rules**:
- All fields must be finite numbers
- `width` and `height` must be positive (> 0)
- `x` and `y` can be negative (element off-screen to left/top)

**Source**: Derived from `Element.getBoundingClientRect()`

**Example**:
```json
{
  "x": 100,
  "y": 250,
  "width": 300,
  "height": 40
}
```

---

### 5. SelectorMap (aimap)

**Purpose**: Mapping from stable IDs to CSS selectors, kept separate from LLM-facing content to save tokens.

**Schema**:
```typescript
type SelectorMap = Record<string, string>;
```

**Structure**:
- **Key**: InteractiveControl.id (format: `{role[0:2]}_{counter}`)
- **Value**: CSS selector string (must be valid querySelector syntax)

**Validation Rules**:
- All keys must correspond to InteractiveControl.id values in PageModel.controls
- All values must be valid CSS selector syntax
- No orphaned keys (every ID must have corresponding control)
- No duplicate values allowed (though selectors may be non-unique across page)

**Example**:
```json
{
  "te_1": "#email",
  "te_2": "#password",
  "bu_3": "form > button.btn-primary",
  "li_4": "a.forgot-password",
  "ch_5": "input[type='checkbox']"
}
```

---

### 6. CaptureRequest

**Purpose**: Input parameters for configuring page interaction content capture behavior.

**Schema**:
```typescript
interface CaptureRequest {
  baseUrl?: string;                 // Base URL for relative path resolution
  maxControls?: number;             // Max interactive elements to capture (default: 400)
  maxHeadings?: number;             // Max headings to capture (default: 30)
  includeValues?: boolean;          // Include form values (default: false, privacy risk)
  maxIframeDepth?: number;          // Max iframe nesting depth (default: 1)
}
```

**Fields**:
| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| baseUrl | string | No | undefined | Valid URL format | Base URL for resolving relative hrefs |
| maxControls | number | No | 400 | >= 1 | Maximum interactive elements to capture |
| maxHeadings | number | No | 30 | >= 1 | Maximum headings (h1/h2/h3) to extract |
| includeValues | boolean | No | false | - | Include actual form values (privacy risk) |
| maxIframeDepth | number | No | 1 | >= 0 | Maximum iframe nesting level to traverse |

**Validation Rules**:
- `maxControls` must be >= 1
- `maxHeadings` must be >= 1
- `maxIframeDepth` must be >= 0
- `baseUrl` if provided must be valid URL format
- `includeValues` should rarely be true (privacy warning)

**Default Behavior**:
```typescript
const defaults: CaptureRequest = {
  maxControls: 400,
  maxHeadings: 30,
  includeValues: false,
  maxIframeDepth: 1
};
```

**Example**:
```json
{
  "baseUrl": "https://example.com",
  "maxControls": 400,
  "maxHeadings": 30,
  "includeValues": false,
  "maxIframeDepth": 1
}
```

---

## Entity Relationships

```
┌─────────────────┐
│   PageModel     │
├─────────────────┤
│ title           │
│ url?            │
│ headings[]      │
│ regions[]       │───┐
│ controls[]      │───┼─── Contains ───> [ InteractiveControl ]
│ aimap           │───┘                    │
└─────────────────┘                        │
                                           │
                                           ├─── Has ───> ControlStates
                                           │
                                           └─── Has ───> BoundingBox?

┌─────────────────────┐
│ InteractiveControl  │
├─────────────────────┤
│ id                  │◄─── Referenced by ─── aimap[id]
│ role                │
│ name                │
│ states              │──> ControlStates
│ selector            │◄─── Stored in ─────── aimap
│ region?             │
│ boundingBox?        │──> BoundingBox
│ visible             │
│ inViewport          │
└─────────────────────┘

┌─────────────────┐
│ CaptureRequest  │
├─────────────────┤
│ baseUrl?        │──> Used to resolve hrefs in ControlStates
│ maxControls?    │──> Limits controls[] length
│ maxHeadings?    │──> Limits headings[] length
│ includeValues?  │──> Affects ControlStates (value vs value_len)
│ maxIframeDepth? │──> Limits recursive iframe traversal
└─────────────────┘
```

---

## State Transitions

**N/A**: This is a stateless capture system. Entities represent point-in-time snapshots with no lifecycle or state changes.

---

## Validation Summary

### PageModel Validation
- ✅ title is non-empty string
- ✅ headings length <= maxHeadings
- ✅ regions contains unique values
- ✅ controls length <= maxControls
- ✅ controls[].id are unique
- ✅ aimap keys match controls[].id exactly

### InteractiveControl Validation
- ✅ id format: `{role[0:2]}_{counter}`
- ✅ name length <= 160 chars
- ✅ selector is valid CSS selector
- ✅ role is recognized type
- ✅ visible is boolean
- ✅ inViewport is boolean

### ControlStates Validation
- ✅ disabled only if true
- ✅ checked only for checkbox/radio
- ✅ placeholder length <= 80 chars
- ✅ value_len >= 0
- ✅ NEVER include actual password values
- ✅ href is relative path or full URL

### CaptureRequest Validation
- ✅ maxControls >= 1
- ✅ maxHeadings >= 1
- ✅ maxIframeDepth >= 0
- ✅ baseUrl is valid URL if provided

---

## Examples

### Minimal PageModel (no interactive elements)
```json
{
  "title": "About Us",
  "url": "https://example.com/about",
  "headings": ["About Us", "Our Mission"],
  "regions": ["main", "header"],
  "controls": [],
  "aimap": {}
}
```

### Complex PageModel (e-commerce page, capped at 400 controls)
```json
{
  "title": "Shop - Example Store",
  "url": "https://shop.example.com/products",
  "headings": ["Featured Products", "New Arrivals", "Best Sellers"],
  "regions": ["main", "navigation", "search", "header", "footer"],
  "controls": [
    // ... 400 controls (buttons, links, inputs, checkboxes)
  ],
  "aimap": {
    "bu_1": "#add-to-cart-123",
    "li_2": "a.product-link[data-id='456']",
    // ... 400 mappings
  }
}
```

---

**Status**: ✅ **COMPLETE** - All entities defined with schemas, validation rules, and examples.
