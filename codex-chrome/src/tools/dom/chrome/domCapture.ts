import { CaptureSnapshotReturns, DocumentSnapshot, NodeTreeSnapshot, LayoutTreeSnapshot } from '../views';

/**
 * Captures a DOM snapshot similar to CDP DOMSnapshot.captureSnapshot
 * This function runs in a content script context
 */
export async function captureSnapshot(): Promise<CaptureSnapshotReturns> {
	const documents: DocumentSnapshot[] = [];
	const strings: string[] = [];
	const stringMap = new Map<string, number>();

	// Helper to add string to string table
	function addString(str: string): number {
		if (stringMap.has(str)) {
			return stringMap.get(str)!;
		}
		const index = strings.length;
		strings.push(str);
		stringMap.set(str, index);
		return index;
	}

	// Capture main document
	const mainDoc = captureDocument(document, addString);
	documents.push(mainDoc);

	// Capture iframes
	const iframes = document.querySelectorAll('iframe');
	for (const iframe of iframes) {
		try {
			if (iframe.contentDocument) {
				const iframeDoc = captureDocument(iframe.contentDocument, addString);
				documents.push(iframeDoc);
			}
		} catch (e) {
			// Cross-origin iframe, skip
			console.warn('Cannot access cross-origin iframe:', e);
		}
	}

	return { documents, strings };
}

/**
 * Capture a single document's snapshot
 */
function captureDocument(doc: Document, addString: (str: string) => number): DocumentSnapshot {
	const nodeTree: NodeTreeSnapshot = {
		parentIndex: [],
		nodeType: [],
		nodeName: [],
		nodeValue: [],
		backendNodeId: [],
		attributes: [],
		textValue: { index: [], value: [] },
		isClickable: { index: [] }
	};

	const layoutTree: LayoutTreeSnapshot = {
		nodeIndex: [],
		styles: [],
		bounds: [],
		text: [],
		stackingContexts: { index: [] },
		paintOrders: []
	};

	const nodeToIndex = new Map<Node, number>();
	let nodeIdCounter = 0;

	// Walk the DOM tree
	walkTree(doc.documentElement, -1);

	function walkTree(node: Node, parentIndex: number) {
		const nodeIndex = nodeIdCounter++;
		nodeToIndex.set(node, nodeIndex);

		// Add to node tree
		nodeTree.parentIndex!.push(parentIndex);
		nodeTree.nodeType!.push(node.nodeType);
		nodeTree.nodeName!.push(node.nodeName);

		// Node value
		if (node.nodeValue) {
			nodeTree.nodeValue!.push(node.nodeValue);
		} else {
			nodeTree.nodeValue!.push('');
		}

		// Backend node ID (simulated)
		nodeTree.backendNodeId!.push(nodeIndex);

		// Attributes for element nodes
		if (node.nodeType === Node.ELEMENT_NODE) {
			const element = node as Element;
			const attrs: string[] = [];

			for (const attr of element.attributes) {
				attrs.push(attr.name);
				attrs.push(attr.value);
			}
			nodeTree.attributes!.push(attrs);

			// Check if clickable
			const isClickable = isElementClickable(element);
			if (isClickable) {
				nodeTree.isClickable!.index.push(nodeIndex);
			}

			// Capture layout information
			captureLayout(element, nodeIndex);
		} else {
			nodeTree.attributes!.push([]);
		}

		// Process children
		for (const child of node.childNodes) {
			walkTree(child, nodeIndex);
		}
	}

	function captureLayout(element: Element, nodeIndex: number) {
		const rect = element.getBoundingClientRect();
		const styles = window.getComputedStyle(element);

		// Add to layout tree
		layoutTree.nodeIndex.push(nodeIndex);

		// Capture important styles
		const styleIndices: string[] = [];
		const importantStyles = [
			'display', 'visibility', 'opacity', 'overflow', 'overflow-x', 'overflow-y',
			'cursor', 'pointer-events', 'position', 'background-color', 'z-index'
		];

		for (const styleName of importantStyles) {
			styleIndices.push(styleName);
			styleIndices.push(styles.getPropertyValue(styleName));
		}
		layoutTree.styles.push(styleIndices);

		// Bounds [x, y, width, height]
		layoutTree.bounds.push([rect.x, rect.y, rect.width, rect.height]);

		// Text content
		const text = element.textContent || '';
		layoutTree.text.push(text.substring(0, 100)); // Cap text length

		// Paint order (simplified - use z-index as approximation)
		const zIndex = parseInt(styles.zIndex) || 0;
		layoutTree.paintOrders!.push(zIndex);
	}

	return {
		documentURL: doc.URL,
		title: doc.title,
		baseURL: doc.baseURI,
		contentLanguage: doc.documentElement.lang || '',
		encodingName: doc.characterSet || 'UTF-8',
		publicId: '',
		systemId: '',
		frameId: generateFrameId(),
		nodes: nodeTree,
		layout: layoutTree,
		textBoxes: { layoutIndex: [], bounds: [], start: [], length: [] },
		scrollOffsetX: window.scrollX,
		scrollOffsetY: window.scrollY,
		contentWidth: doc.documentElement.scrollWidth,
		contentHeight: doc.documentElement.scrollHeight
	};
}

/**
 * Check if an element is clickable
 */
function isElementClickable(element: Element): boolean {
	const tagName = element.tagName.toLowerCase();

	// Check for naturally clickable elements
	if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
		return true;
	}

	// Check for click handlers
	if (element.hasAttribute('onclick')) {
		return true;
	}

	// Check for role attribute
	const role = element.getAttribute('role');
	if (role && ['button', 'link', 'checkbox', 'radio', 'tab'].includes(role)) {
		return true;
	}

	// Check cursor style
	const cursor = window.getComputedStyle(element).cursor;
	if (cursor === 'pointer') {
		return true;
	}

	return false;
}

/**
 * Generate a unique frame ID
 */
function generateFrameId(): string {
	return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Execute snapshot capture in a specific tab/frame
 */
export async function captureSnapshotInTab(
	tabId: number,
	frameId?: number
): Promise<CaptureSnapshotReturns> {
	// This would be called from the extension background/service worker
	// Uses chrome.scripting.executeScript to run captureSnapshot in content script

	const results = await chrome.scripting.executeScript({
		target: { tabId, frameIds: frameId ? [frameId] : undefined },
		func: captureSnapshot,
		world: 'MAIN'
	});

	return results[0].result as CaptureSnapshotReturns;
}