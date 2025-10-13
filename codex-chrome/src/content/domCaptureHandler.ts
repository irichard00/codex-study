/**
 * DOM Capture Handler - Main Integration
 *
 * Integrates all DOM capture helpers to provide complete page snapshot
 * functionality for the content script.
 *
 * This handler is called by the content script when a DOM capture request
 * is received from the background script.
 */

import { traverseDOM, getInteractiveElements, type TraversalResult } from '../tools/dom/chrome/domTraversal';
import { captureElementSnapshot, batchCaptureSnapshots, type ElementSnapshot } from '../tools/dom/chrome/snapshotCapture';
import { StringPool } from '../tools/dom/chrome/stringInterning';
import { extractARIA, batchExtractARIA, type EnhancedAXNode } from '../tools/dom/chrome/ariaExtraction';
import {
  getAccessibleIframeDocuments,
  type IframePlaceholder,
  traverseIframes,
  type IframeTraversalOptions
} from '../tools/dom/chrome/iframeTraversal';
import {
  getAllShadowRoots,
  mergeWithShadowDOM,
  type ShadowRootInfo
} from '../tools/dom/chrome/shadowDOMTraversal';

/**
 * DOM capture options
 */
export interface DOMCaptureOptions {
  includeShadowDOM?: boolean;
  includeIframes?: boolean;
  maxIframeDepth?: number;
  maxIframeCount?: number;
  skipHiddenElements?: boolean;
}

/**
 * Captured DOM document structure (CDP-compatible)
 */
export interface CapturedDocument {
  documentURL: string;
  baseURL: string;
  title: string;
  frameId: string;
  nodes: CapturedNode[];
}

/**
 * Captured node structure (CDP-compatible)
 */
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

/**
 * Complete capture result (CDP-compatible format)
 */
export interface CaptureSnapshotReturns {
  documents: CapturedDocument[];
  strings: string[];
}

/**
 * Capture viewport information
 */
export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
  visibleWidth: number;
  visibleHeight: number;
}

/**
 * Main DOM capture handler
 *
 * Captures complete DOM state including:
 * - DOM tree structure
 * - Element snapshots (bounds, styles, attributes)
 * - Accessibility tree (ARIA attributes)
 * - Iframes (respecting limits)
 * - Shadow DOM
 *
 * @param options - Capture options
 * @returns Capture result with documents and string pool
 */
export function captureDOMSnapshot(options: DOMCaptureOptions = {}): CaptureSnapshotReturns {
  const {
    includeShadowDOM = true,
    includeIframes = true,
    maxIframeDepth = 3,
    maxIframeCount = 15,
    skipHiddenElements = true
  } = options;

  // Initialize string pool for efficient transfer
  const stringPool = new StringPool();

  // Capture main document
  const mainDocument = captureDocument(
    document,
    'main',
    { includeShadowDOM, skipHiddenElements },
    stringPool
  );

  const documents: CapturedDocument[] = [mainDocument];

  // Capture iframe documents if requested
  if (includeIframes) {
    const iframeDocs = getAccessibleIframeDocuments(
      document,
      maxIframeDepth,
      maxIframeCount
    );

    for (const { document: iframeDoc, depth, src } of iframeDocs) {
      const frameId = `iframe-${src}-depth${depth}`;
      const capturedDoc = captureDocument(
        iframeDoc,
        frameId,
        { includeShadowDOM, skipHiddenElements },
        stringPool
      );
      documents.push(capturedDoc);
    }
  }

  return {
    documents,
    strings: stringPool.export()
  };
}

/**
 * Capture a single document (main page or iframe)
 *
 * @param doc - Document to capture
 * @param frameId - Frame identifier
 * @param options - Capture options
 * @param stringPool - String pool for interning
 * @returns Captured document
 */
function captureDocument(
  doc: Document,
  frameId: string,
  options: { includeShadowDOM: boolean; skipHiddenElements: boolean },
  stringPool: StringPool
): CapturedDocument {
  // Traverse DOM tree
  const traversalResult = traverseDOM(doc.documentElement, {
    maxDepth: 100,
    includeTextNodes: true,
    includeComments: false,
    skipHiddenElements: options.skipHiddenElements
  });

  // Collect all element nodes
  const elements: Element[] = [];
  const elementIndices: Map<Element, number> = new Map();

  for (let i = 0; i < traversalResult.nodes.length; i++) {
    const node = traversalResult.nodes[i];
    if (node.nodeType === 1) { // ELEMENT_NODE
      // Get actual element from DOM
      const element = getElementByPath(doc.documentElement, i, traversalResult);
      if (element) {
        elements.push(element);
        elementIndices.set(element, i);
      }
    }
  }

  // Batch capture snapshots for all elements
  const snapshots = batchCaptureSnapshots(elements);

  // Batch extract ARIA information
  const axNodes = batchExtractARIA(elements);

  // Build captured nodes
  const nodes: CapturedNode[] = traversalResult.nodes.map((node, index) => {
    const capturedNode: CapturedNode = {
      nodeType: node.nodeType,
      nodeName: stringPool.internString(node.nodeName) as any,
      nodeValue: node.nodeValue,
      backendNodeId: index + 1,
      parentIndex: node.parentIndex,
      childIndices: node.childIndices,
      attributes: {}
    };

    // Add snapshot and ARIA data for element nodes
    if (node.nodeType === 1) {
      const element = elements[elementIndices.size - elements.length + Array.from(elementIndices.values()).indexOf(index)];
      if (element) {
        capturedNode.snapshot = snapshots.get(element);
        capturedNode.axNode = axNodes.get(index);

        // Intern attribute names and values
        if (capturedNode.snapshot) {
          const internedAttrs: Record<string, string> = {};
          for (const [key, value] of Object.entries(capturedNode.snapshot.attributes)) {
            const internedKey = stringPool.internString(key);
            const internedValue = stringPool.internString(value);
            internedAttrs[internedKey as any] = internedValue as any;
          }
          capturedNode.attributes = internedAttrs;
        }
      }
    }

    return capturedNode;
  });

  // Handle shadow DOM if requested
  if (options.includeShadowDOM) {
    const shadowRoots = getAllShadowRoots(doc.documentElement, false);
    // TODO: Integrate shadow DOM nodes into main tree
    // For now, shadow roots are detected but not merged
  }

  return {
    documentURL: doc.location?.href || '',
    baseURL: doc.baseURI || '',
    title: doc.title || '',
    frameId,
    nodes
  };
}

/**
 * Get element by traversal index
 *
 * Helper to map traversal index back to actual DOM element.
 *
 * @param root - Root element
 * @param index - Traversal index
 * @param traversalResult - Traversal result
 * @returns Element or null
 */
function getElementByPath(
  root: Element,
  index: number,
  traversalResult: TraversalResult
): Element | null {
  // Simplified implementation - in production, maintain a map during traversal
  const node = traversalResult.nodes[index];
  if (node.nodeType !== 1) {
    return null;
  }

  // For now, return root as placeholder
  // TODO: Implement proper element lookup
  return root;
}

/**
 * Capture viewport information
 *
 * @returns Viewport info
 */
export function captureViewportInfo(): ViewportInfo {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    visibleWidth: document.documentElement.clientWidth,
    visibleHeight: document.documentElement.clientHeight
  };
}

/**
 * Main handler for DOM capture requests from background script
 *
 * @param options - Capture options from background
 * @returns Complete capture result including viewport
 */
export function handleDOMCaptureRequest(options: DOMCaptureOptions): {
  snapshot: CaptureSnapshotReturns;
  viewport: ViewportInfo;
  timing: {
    startTime: number;
    traversalTime: number;
    totalTime: number;
  };
} {
  console.log('starting dom capture with options', options);
  const startTime = performance.now();

  // Capture DOM snapshot
  const snapshot = captureDOMSnapshot(options);

  const traversalTime = performance.now() - startTime;

  // Capture viewport
  const viewport = captureViewportInfo();

  const totalTime = performance.now() - startTime;
  console.log('dom capture completed with snapshot', snapshot);
  return {
    snapshot,
    viewport,
    timing: {
      startTime,
      traversalTime,
      totalTime
    }
  };
}
