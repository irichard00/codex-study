/**
 * Browser Use DOM TypeScript Library
 * Main entry point for the library exports
 */

// Main service class
export { DomService } from './service';

// Enhanced DOM tree node with computed properties
export { EnhancedDOMTreeNodeImpl } from './enhancedDOMTreeNode';

// Serializer classes
export { DOMTreeSerializer } from './serializer/serializer';
export { ClickableElementDetector } from './serializer/clickableElements';
export { PaintOrderRemover, Rect, RectUnionPure } from './serializer/paintOrder';

// All interfaces and types
export * from './views';

// Utility functions
export { cap_text_length } from './utils';
export { build_snapshot_lookup, parse_rare_boolean_data, parse_computed_styles } from './enhancedSnapshot';

// Chrome API adapters
export { captureSnapshot, captureSnapshotInTab } from './chrome/domCapture';
export { getAccessibilityTree } from './chrome/accessibilityTree';
export {
  getAllFrames,
  getFrameTargets,
  executeInFrame,
  executeInAllFrames,
  getFrameTree,
  sendMessageToFrame,
  broadcastToFrames,
  getFrameOffset,
  isFrameSameOrigin,
  getFrameDimensions,
  onFrameNavigated,
  onFrameCreated
} from './chrome/frameUtils';
export {
  getDocumentTree,
  findElements,
  getElementAtPoint,
  getElementsAtPoint,
  scrollIntoView,
  getScrollInfo,
  clickElement,
  typeIntoElement,
  getViewportInfo,
  highlightElement,
  getComputedStylesForElement,
  isElementInViewport,
  getElementText,
  observeMutations,
  evaluateXPath,
  getElementByXPath,
  waitForElement
} from './chrome/contentScript';

// Re-export constants for convenience
export {
  DISABLED_ELEMENTS,
  DEFAULT_INCLUDE_ATTRIBUTES,
  STATIC_ATTRIBUTES,
  REQUIRED_COMPUTED_STYLES,
  PROPAGATING_ELEMENTS,
  DEFAULT_CONTAINMENT_THRESHOLD
} from './views';