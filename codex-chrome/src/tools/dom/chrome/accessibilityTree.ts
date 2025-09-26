import { GetFullAXTreeReturns, AXNode, AXValue, AXProperty } from '../views';

/**
 * Get accessibility tree using Chrome Debugger API or ARIA fallback
 */
export async function getAccessibilityTree(tabId: number): Promise<GetFullAXTreeReturns> {
	try {
		// Try using chrome.debugger API first
		return await getAccessibilityTreeViaDebugger(tabId);
	} catch (error) {
		console.warn('Failed to get AX tree via debugger, falling back to ARIA:', error);
		// Fallback to ARIA attribute parsing
		return await getAccessibilityTreeViaARIA(tabId);
	}
}

/**
 * Get accessibility tree using Chrome Debugger API
 */
async function getAccessibilityTreeViaDebugger(tabId: number): Promise<GetFullAXTreeReturns> {
	// Attach debugger
	await chrome.debugger.attach({ tabId }, '1.3');

	try {
		// Enable accessibility domain
		await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable', {});

		// Get full AX tree
		const result = await chrome.debugger.sendCommand(
			{ tabId },
			'Accessibility.getFullAXTree',
			{}
		) as GetFullAXTreeReturns;

		return result;
	} finally {
		// Always detach debugger
		await chrome.debugger.detach({ tabId });
	}
}

/**
 * Fallback: Build accessibility tree from ARIA attributes
 */
async function getAccessibilityTreeViaARIA(tabId: number): Promise<GetFullAXTreeReturns> {
	// Execute script in the tab to collect ARIA data
	const results = await chrome.scripting.executeScript({
		target: { tabId },
		func: collectARIAData,
		world: 'MAIN'
	});

	const ariaData = results[0].result as ARIANodeData[];

	// Convert ARIA data to AXNode format
	const nodes = ariaData.map(data => convertToAXNode(data));

	return { nodes };
}

/**
 * Interface for ARIA data collected from the page
 */
interface ARIANodeData {
	nodeId: string;
	backendNodeId: number;
	role: string | null;
	name: string | null;
	description: string | null;
	value: string | null;
	properties: { [key: string]: string | boolean | null };
	childIds: string[];
	ignored: boolean;
}

/**
 * Collect ARIA data from the page (runs in content script)
 */
function collectARIAData(): ARIANodeData[] {
	const nodes: ARIANodeData[] = [];
	const nodeToId = new Map<Node, string>();
	let nodeIdCounter = 0;

	// Walk the DOM tree and collect ARIA information
	walkTree(document.documentElement);

	function walkTree(node: Node): string {
		const nodeId = `ax_${nodeIdCounter++}`;
		nodeToId.set(node, nodeId);

		if (node.nodeType === Node.ELEMENT_NODE) {
			const element = node as Element;
			const ariaNode = collectElementARIA(element, nodeId);

			// Add child IDs
			const childIds: string[] = [];
			for (const child of element.children) {
				childIds.push(walkTree(child));
			}
			ariaNode.childIds = childIds;

			nodes.push(ariaNode);
		} else if (node.nodeType === Node.TEXT_NODE) {
			// Handle text nodes
			const textContent = node.textContent?.trim();
			if (textContent) {
				nodes.push({
					nodeId,
					backendNodeId: nodeIdCounter,
					role: 'text',
					name: textContent,
					description: null,
					value: null,
					properties: {},
					childIds: [],
					ignored: false
				});
			}
		}

		return nodeId;
	}

	function collectElementARIA(element: Element, nodeId: string): ARIANodeData {
		const computedRole = getComputedRole(element);
		const accessibleName = getAccessibleName(element);
		const accessibleDescription = getAccessibleDescription(element);

		// Collect ARIA properties
		const properties: { [key: string]: string | boolean | null } = {};

		// Check various ARIA attributes
		const ariaAttributes = [
			'aria-expanded', 'aria-selected', 'aria-checked', 'aria-disabled',
			'aria-hidden', 'aria-pressed', 'aria-readonly', 'aria-required',
			'aria-invalid', 'aria-busy', 'aria-live', 'aria-atomic',
			'aria-relevant', 'aria-dropeffect', 'aria-grabbed', 'aria-activedescendant',
			'aria-colcount', 'aria-colindex', 'aria-colspan', 'aria-controls',
			'aria-describedby', 'aria-errormessage', 'aria-flowto', 'aria-labelledby',
			'aria-owns', 'aria-posinset', 'aria-rowcount', 'aria-rowindex',
			'aria-rowspan', 'aria-setsize', 'aria-level', 'aria-multiline',
			'aria-multiselectable', 'aria-orientation', 'aria-placeholder',
			'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow',
			'aria-valuetext', 'aria-current', 'aria-haspopup', 'aria-keyshortcuts',
			'aria-roledescription'
		];

		for (const attr of ariaAttributes) {
			const value = element.getAttribute(attr);
			if (value !== null) {
				properties[attr] = value;
			}
		}

		// Check if element is ignored
		const ignored = isElementIgnored(element);

		// Get value for form controls
		let value = null;
		if (element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement ||
			element instanceof HTMLSelectElement) {
			value = element.value;
		}

		return {
			nodeId,
			backendNodeId: parseInt(nodeId.replace('ax_', '')),
			role: computedRole,
			name: accessibleName,
			description: accessibleDescription,
			value,
			properties,
			childIds: [],
			ignored
		};
	}

	function getComputedRole(element: Element): string | null {
		// Check explicit role
		const role = element.getAttribute('role');
		if (role) {
			return role;
		}

		// Compute implicit role based on element type
		const tagName = element.tagName.toLowerCase();
		const implicitRoles: { [key: string]: string } = {
			'a': 'link',
			'article': 'article',
			'aside': 'complementary',
			'button': 'button',
			'datalist': 'listbox',
			'dd': 'definition',
			'details': 'group',
			'dialog': 'dialog',
			'dt': 'term',
			'fieldset': 'group',
			'figure': 'figure',
			'footer': 'contentinfo',
			'form': 'form',
			'h1': 'heading',
			'h2': 'heading',
			'h3': 'heading',
			'h4': 'heading',
			'h5': 'heading',
			'h6': 'heading',
			'header': 'banner',
			'hr': 'separator',
			'img': 'img',
			'input': getInputRole(element as HTMLInputElement),
			'li': 'listitem',
			'main': 'main',
			'math': 'math',
			'menu': 'list',
			'nav': 'navigation',
			'ol': 'list',
			'optgroup': 'group',
			'option': 'option',
			'output': 'status',
			'progress': 'progressbar',
			'section': 'region',
			'select': 'combobox',
			'summary': 'button',
			'table': 'table',
			'tbody': 'rowgroup',
			'td': 'cell',
			'textarea': 'textbox',
			'tfoot': 'rowgroup',
			'th': 'columnheader',
			'thead': 'rowgroup',
			'tr': 'row',
			'ul': 'list'
		};

		return implicitRoles[tagName] || null;
	}

	function getInputRole(input: HTMLInputElement): string {
		const type = input.type.toLowerCase();
		const inputRoles: { [key: string]: string } = {
			'button': 'button',
			'checkbox': 'checkbox',
			'email': 'textbox',
			'image': 'button',
			'number': 'spinbutton',
			'radio': 'radio',
			'range': 'slider',
			'reset': 'button',
			'search': 'searchbox',
			'submit': 'button',
			'tel': 'textbox',
			'text': 'textbox',
			'url': 'textbox'
		};
		return inputRoles[type] || 'textbox';
	}

	function getAccessibleName(element: Element): string | null {
		// Check aria-label
		const ariaLabel = element.getAttribute('aria-label');
		if (ariaLabel) {
			return ariaLabel;
		}

		// Check aria-labelledby
		const labelledBy = element.getAttribute('aria-labelledby');
		if (labelledBy) {
			const labels = labelledBy.split(' ')
				.map(id => document.getElementById(id)?.textContent)
				.filter(Boolean)
				.join(' ');
			if (labels) {
				return labels;
			}
		}

		// Check for associated label
		if (element.id) {
			const label = document.querySelector(`label[for="${element.id}"]`);
			if (label?.textContent) {
				return label.textContent;
			}
		}

		// Check for title attribute
		const title = element.getAttribute('title');
		if (title) {
			return title;
		}

		// For certain elements, use text content
		const tagName = element.tagName.toLowerCase();
		if (['button', 'a'].includes(tagName)) {
			return element.textContent || null;
		}

		// For inputs, check placeholder
		if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
			return element.placeholder || null;
		}

		return null;
	}

	function getAccessibleDescription(element: Element): string | null {
		// Check aria-describedby
		const describedBy = element.getAttribute('aria-describedby');
		if (describedBy) {
			const descriptions = describedBy.split(' ')
				.map(id => document.getElementById(id)?.textContent)
				.filter(Boolean)
				.join(' ');
			if (descriptions) {
				return descriptions;
			}
		}

		// Check aria-description
		const ariaDescription = element.getAttribute('aria-description');
		if (ariaDescription) {
			return ariaDescription;
		}

		return null;
	}

	function isElementIgnored(element: Element): boolean {
		// Check aria-hidden
		if (element.getAttribute('aria-hidden') === 'true') {
			return true;
		}

		// Check if element is invisible
		const style = window.getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden') {
			return true;
		}

		// Check if element has zero size
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			return true;
		}

		return false;
	}

	return nodes;
}

/**
 * Convert ARIA data to AXNode format
 */
function convertToAXNode(data: ARIANodeData): AXNode {
	const node: AXNode = {
		nodeId: data.nodeId,
		ignored: data.ignored,
		backendDOMNodeId: data.backendNodeId
	};

	// Add role
	if (data.role) {
		node.role = createAXValue(data.role);
	}

	// Add name
	if (data.name) {
		node.name = createAXValue(data.name);
	}

	// Add description
	if (data.description) {
		node.description = createAXValue(data.description);
	}

	// Add value
	if (data.value) {
		node.value = createAXValue(data.value);
	}

	// Convert properties
	if (Object.keys(data.properties).length > 0) {
		node.properties = Object.entries(data.properties).map(([name, value]) => ({
			name,
			value: createAXValue(value)
		}));
	}

	// Add child IDs
	if (data.childIds.length > 0) {
		node.childIds = data.childIds;
	}

	return node;
}

/**
 * Create an AXValue object
 */
function createAXValue(value: any): AXValue {
	if (typeof value === 'string') {
		return { type: 'string', value };
	} else if (typeof value === 'boolean') {
		return { type: 'boolean', value };
	} else if (typeof value === 'number') {
		return { type: 'number', value };
	} else {
		return { type: 'string', value: String(value) };
	}
}