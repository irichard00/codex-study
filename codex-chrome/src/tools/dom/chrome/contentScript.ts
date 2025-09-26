/**
 * DOM traversal functions for content script context
 * These functions run directly in the page context and have access to the DOM
 */

import { GetDocumentReturns, Node as CDPNode, NodeType } from '../views';

/**
 * Get the document tree similar to CDP DOM.getDocument()
 */
export function getDocumentTree(): GetDocumentReturns {
	const nodeMap = new Map<Node, number>();
	let nodeIdCounter = 1;

	function buildNode(node: Node, parentId?: number): CDPNode {
		const nodeId = nodeIdCounter++;
		nodeMap.set(node, nodeId);

		const cdpNode: CDPNode = {
			nodeId,
			parentId,
			backendNodeId: nodeId, // Using same as nodeId for simplicity
			nodeType: node.nodeType,
			nodeName: node.nodeName,
			nodeValue: node.nodeValue || ''
		};

		// Add attributes for element nodes
		if (node.nodeType === Node.ELEMENT_NODE) {
			const element = node as Element;

			// Collect attributes
			if (element.attributes.length > 0) {
				const attrs: string[] = [];
				for (const attr of element.attributes) {
					attrs.push(attr.name, attr.value);
				}
				cdpNode.attributes = attrs;
			}

			// Add frame ID for iframes
			if (element.tagName === 'IFRAME') {
				const iframe = element as HTMLIFrameElement;
				cdpNode.frameId = generateFrameId(iframe);

				// Add content document if accessible
				try {
					if (iframe.contentDocument) {
						cdpNode.contentDocument = buildNode(iframe.contentDocument, nodeId);
					}
				} catch (e) {
					// Cross-origin iframe, can't access
				}
			}

			// Check for shadow root
			const shadowRoot = (element as any).shadowRoot;
			if (shadowRoot) {
				cdpNode.shadowRoots = [buildNode(shadowRoot, nodeId)];
				cdpNode.shadowRootType = shadowRoot.mode; // 'open' or 'closed'
			}

			// Count children
			cdpNode.childNodeCount = element.childNodes.length;
		}

		// Add children
		if (node.childNodes.length > 0) {
			cdpNode.children = [];
			for (const child of node.childNodes) {
				// Skip certain node types
				if (shouldIncludeNode(child)) {
					cdpNode.children.push(buildNode(child, nodeId));
				}
			}
		}

		// Add document-specific properties
		if (node.nodeType === Node.DOCUMENT_NODE) {
			const doc = node as Document;
			cdpNode.documentURL = doc.URL;
		}

		return cdpNode;
	}

	// Start from document
	const root = buildNode(document);
	return { root };
}

/**
 * Check if a node should be included in the tree
 */
function shouldIncludeNode(node: Node): boolean {
	// Skip comment nodes
	if (node.nodeType === Node.COMMENT_NODE) {
		return false;
	}

	// Skip empty text nodes
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent?.trim();
		if (!text) {
			return false;
		}
	}

	return true;
}

/**
 * Generate a unique frame ID for an iframe
 */
function generateFrameId(iframe: HTMLIFrameElement): string {
	// Try to use existing ID or generate one
	if (iframe.id) {
		return `frame_${iframe.id}`;
	}

	// Use src as part of ID if available
	const src = iframe.src ? iframe.src.substring(0, 50) : 'no-src';
	const random = Math.random().toString(36).substr(2, 9);
	return `frame_${src}_${random}`;
}

/**
 * Find elements by selector
 */
export function findElements(selector: string): Array<{
	nodeId: number;
	backendNodeId: number;
	element: Element;
}> {
	const elements = document.querySelectorAll(selector);
	const results = [];

	for (let i = 0; i < elements.length; i++) {
		results.push({
			nodeId: i + 1,
			backendNodeId: i + 1,
			element: elements[i]
		});
	}

	return results;
}

/**
 * Get element by coordinates
 */
export function getElementAtPoint(x: number, y: number): Element | null {
	return document.elementFromPoint(x, y);
}

/**
 * Get all elements at coordinates (handles overlapping elements)
 */
export function getElementsAtPoint(x: number, y: number): Element[] {
	return document.elementsFromPoint(x, y) as Element[];
}

/**
 * Scroll element into view
 */
export function scrollIntoView(selector: string, options?: ScrollIntoViewOptions): boolean {
	const element = document.querySelector(selector);
	if (element) {
		element.scrollIntoView(options || { behavior: 'smooth', block: 'center' });
		return true;
	}
	return false;
}

/**
 * Get scroll information for the page
 */
export function getScrollInfo(): {
	scrollX: number;
	scrollY: number;
	scrollWidth: number;
	scrollHeight: number;
	clientWidth: number;
	clientHeight: number;
} {
	return {
		scrollX: window.scrollX,
		scrollY: window.scrollY,
		scrollWidth: document.documentElement.scrollWidth,
		scrollHeight: document.documentElement.scrollHeight,
		clientWidth: document.documentElement.clientWidth,
		clientHeight: document.documentElement.clientHeight
	};
}

/**
 * Simulate click on element
 */
export function clickElement(selector: string): boolean {
	const element = document.querySelector(selector) as HTMLElement;
	if (element) {
		// Create and dispatch click event
		const event = new MouseEvent('click', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		element.dispatchEvent(event);
		return true;
	}
	return false;
}

/**
 * Type text into an input element
 */
export function typeIntoElement(selector: string, text: string): boolean {
	const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
	if (element) {
		// Focus the element
		element.focus();

		// Set value
		element.value = text;

		// Dispatch input event
		const inputEvent = new Event('input', { bubbles: true });
		element.dispatchEvent(inputEvent);

		// Dispatch change event
		const changeEvent = new Event('change', { bubbles: true });
		element.dispatchEvent(changeEvent);

		return true;
	}
	return false;
}

/**
 * Get viewport information
 */
export function getViewportInfo(): {
	devicePixelRatio: number;
	width: number;
	height: number;
	visualViewport: {
		offsetLeft: number;
		offsetTop: number;
		pageLeft: number;
		pageTop: number;
		width: number;
		height: number;
		scale: number;
	} | null;
} {
	const visualViewport = window.visualViewport;

	return {
		devicePixelRatio: window.devicePixelRatio,
		width: window.innerWidth,
		height: window.innerHeight,
		visualViewport: visualViewport ? {
			offsetLeft: visualViewport.offsetLeft,
			offsetTop: visualViewport.offsetTop,
			pageLeft: visualViewport.pageLeft,
			pageTop: visualViewport.pageTop,
			width: visualViewport.width,
			height: visualViewport.height,
			scale: visualViewport.scale
		} : null
	};
}

/**
 * Highlight element on page
 */
export function highlightElement(selector: string, color: string = 'red', duration: number = 2000): boolean {
	const element = document.querySelector(selector) as HTMLElement;
	if (element) {
		const originalOutline = element.style.outline;
		element.style.outline = `2px solid ${color}`;

		setTimeout(() => {
			element.style.outline = originalOutline;
		}, duration);

		return true;
	}
	return false;
}

/**
 * Get computed styles for an element
 */
export function getComputedStylesForElement(selector: string): CSSStyleDeclaration | null {
	const element = document.querySelector(selector);
	if (element) {
		return window.getComputedStyle(element);
	}
	return null;
}

/**
 * Check if element is in viewport
 */
export function isElementInViewport(selector: string): boolean {
	const element = document.querySelector(selector);
	if (!element) {
		return false;
	}

	const rect = element.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}

/**
 * Get text content of an element
 */
export function getElementText(selector: string, maxLength: number = 1000): string | null {
	const element = document.querySelector(selector);
	if (element) {
		const text = element.textContent || '';
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
	}
	return null;
}

/**
 * Monitor DOM mutations
 */
export function observeMutations(
	callback: (mutations: MutationRecord[]) => void,
	options?: MutationObserverInit
): MutationObserver {
	const observer = new MutationObserver(callback);

	observer.observe(document.body, options || {
		childList: true,
		subtree: true,
		attributes: true,
		attributeOldValue: true,
		characterData: true,
		characterDataOldValue: true
	});

	return observer;
}

/**
 * Execute XPath query
 */
export function evaluateXPath(xpath: string): Element[] {
	const result = document.evaluate(
		xpath,
		document,
		null,
		XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
		null
	);

	const elements: Element[] = [];
	for (let i = 0; i < result.snapshotLength; i++) {
		const node = result.snapshotItem(i);
		if (node && node.nodeType === Node.ELEMENT_NODE) {
			elements.push(node as Element);
		}
	}

	return elements;
}

/**
 * Get element by XPath
 */
export function getElementByXPath(xpath: string): Element | null {
	const elements = evaluateXPath(xpath);
	return elements.length > 0 ? elements[0] : null;
}

/**
 * Wait for element to appear
 */
export async function waitForElement(
	selector: string,
	timeout: number = 5000
): Promise<Element | null> {
	return new Promise((resolve) => {
		const element = document.querySelector(selector);
		if (element) {
			resolve(element);
			return;
		}

		const observer = new MutationObserver(() => {
			const element = document.querySelector(selector);
			if (element) {
				observer.disconnect();
				resolve(element);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, timeout);
	});
}