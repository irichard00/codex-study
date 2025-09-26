import {
	CurrentPageTargets,
	TargetAllTrees,
	EnhancedAXNode,
	EnhancedDOMTreeNode,
	SerializedDOMState,
	TargetInfo,
	CaptureSnapshotReturns,
	GetDocumentReturns,
	GetFullAXTreeReturns,
	AXNode,
	NodeType,
	DOMRect,
	EnhancedSnapshotNode
} from './views';
import { DOMTreeSerializer } from './serializer/serializer';
import { build_snapshot_lookup } from './enhancedSnapshot';

// Browser session interface - to be provided by host extension
interface BrowserSession {
	tab_id?: number;
	frame_id?: string;
	// Add other properties as needed
}

// Logger interface
interface Logger {
	log(message: string): void;
	error(message: string): void;
	warn(message: string): void;
}

export class DomService {
	private browser_session: BrowserSession;
	private logger?: Logger;
	private cross_origin_iframes: boolean;
	private paint_order_filtering: boolean;
	private max_iframes: number;
	private max_iframe_depth: number;
	private serializer: DOMTreeSerializer;

	constructor(
		browser_session: BrowserSession,
		logger?: Logger,
		cross_origin_iframes: boolean = false,
		paint_order_filtering: boolean = true,
		max_iframes: number = 15,
		max_iframe_depth: number = 3
	) {
		this.browser_session = browser_session;
		this.logger = logger;
		this.cross_origin_iframes = cross_origin_iframes;
		this.paint_order_filtering = paint_order_filtering;
		this.max_iframes = max_iframes;
		this.max_iframe_depth = max_iframe_depth;
		this.serializer = new DOMTreeSerializer();
	}

	/**
	 * Get targets for the current page - replaces CDP Target.getTargets()
	 * Uses chrome.tabs and chrome.webNavigation APIs
	 */
	async _get_targets_for_page(target_id: string): Promise<CurrentPageTargets> {
		// Implementation will use chrome.tabs.query() and chrome.webNavigation.getAllFrames()
		// For now, return a placeholder
		const page_session: TargetInfo = {
			targetId: target_id,
			type: 'page',
			title: '',
			url: '',
			attached: true
		};

		const iframe_sessions: TargetInfo[] = [];

		// TODO: Implement chrome.webNavigation.getAllFrames() call
		// const frames = await chrome.webNavigation.getAllFrames({ tabId: this.browser_session.tab_id });
		// Convert frames to TargetInfo format

		return {
			page_session,
			iframe_sessions
		};
	}

	/**
	 * Build enhanced accessibility node from CDP AX node
	 */
	_build_enhanced_ax_node(ax_node: AXNode): EnhancedAXNode {
		const enhanced: EnhancedAXNode = {
			ax_node_id: ax_node.nodeId,
			ignored: ax_node.ignored || false,
			role: ax_node.role?.value || null,
			name: ax_node.name?.value || null,
			description: ax_node.description?.value || null,
			properties: null,
			child_ids: ax_node.childIds || null
		};

		// Process properties
		if (ax_node.properties && ax_node.properties.length > 0) {
			enhanced.properties = ax_node.properties.map(prop => ({
				name: prop.name,
				value: prop.value?.value || null
			}));
		}

		return enhanced;
	}

	/**
	 * Get viewport ratio - replaces CDP Page.getLayoutMetrics()
	 * Uses content script to get devicePixelRatio
	 */
	async _get_viewport_ratio(target_id: string): Promise<number> {
		// TODO: Implement chrome.scripting.executeScript to get devicePixelRatio
		// For now, return default value
		return window.devicePixelRatio || 1;
	}

	/**
	 * Check if element is visible according to all parent elements
	 */
	is_element_visible_according_to_all_parents(
		node: EnhancedDOMTreeNode,
		html_frames: Map<string, any>
	): boolean {
		// Check if element itself is visible
		if (node.is_visible === false) {
			return false;
		}

		// Check computed styles for visibility
		if (node.snapshot_node?.computed_styles) {
			const styles = node.snapshot_node.computed_styles;

			// Check display
			if (styles['display'] === 'none') {
				return false;
			}

			// Check visibility
			if (styles['visibility'] === 'hidden' || styles['visibility'] === 'collapse') {
				return false;
			}

			// Check opacity
			const opacity = parseFloat(styles['opacity'] || '1');
			if (opacity === 0) {
				return false;
			}
		}

		// Check parent visibility recursively
		if (node.parent_node) {
			return this.is_element_visible_according_to_all_parents(node.parent_node, html_frames);
		}

		// Check if in iframe that might be hidden
		if (node.frame_id && html_frames.has(node.frame_id)) {
			const frame_info = html_frames.get(node.frame_id);
			if (frame_info && frame_info.is_visible === false) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get accessibility tree for all frames - replaces CDP Accessibility.getFullAXTree()
	 * Uses chrome.debugger API or ARIA fallback
	 */
	async _get_ax_tree_for_all_frames(target_id: string): Promise<Map<string, any>> {
		const ax_trees = new Map<string, any>();

		// TODO: Implement chrome.debugger API call or ARIA parsing fallback
		// For now, return empty map

		// Main frame
		ax_trees.set(target_id, { nodes: [] });

		// Get iframe accessibility trees if cross_origin_iframes is enabled
		if (this.cross_origin_iframes) {
			// TODO: Iterate through iframes and get their AX trees
		}

		return ax_trees;
	}

	/**
	 * Get all trees (DOM, AX, snapshot) for a target - replaces multiple CDP calls
	 */
	async _get_all_trees(target_id: string): Promise<TargetAllTrees> {
		const start_time = Date.now();
		const cdp_timing: { [key: string]: number } = {};

		// Get device pixel ratio
		const device_pixel_ratio = await this._get_viewport_ratio(target_id);
		cdp_timing['viewport_ratio'] = Date.now() - start_time;

		// Get DOM tree - replaces CDP DOM.getDocument()
		// TODO: Implement custom DOM traversal in content script
		const dom_tree_start = Date.now();
		const dom_tree: GetDocumentReturns = {
			root: {
				nodeId: 1,
				backendNodeId: 1,
				nodeType: NodeType.DOCUMENT_NODE,
				nodeName: '#document',
				nodeValue: ''
			}
		};
		cdp_timing['dom_tree'] = Date.now() - dom_tree_start;

		// Get AX tree - replaces CDP Accessibility.getFullAXTree()
		const ax_tree_start = Date.now();
		const ax_tree: GetFullAXTreeReturns = {
			nodes: []
		};
		cdp_timing['ax_tree'] = Date.now() - ax_tree_start;

		// Get snapshot - replaces CDP DOMSnapshot.captureSnapshot()
		// TODO: Implement custom snapshot capture
		const snapshot_start = Date.now();
		const snapshot: CaptureSnapshotReturns = {
			documents: [],
			strings: []
		};
		cdp_timing['snapshot'] = Date.now() - snapshot_start;

		return {
			snapshot,
			dom_tree,
			ax_tree,
			device_pixel_ratio,
			cdp_timing
		};
	}

	/**
	 * Get enhanced DOM tree with all metadata
	 */
	async get_dom_tree(
		target_id: string,
		initial_html_frames?: Map<string, any>,
		initial_total_frame_offset?: { x: number; y: number },
		iframe_depth: number = 0
	): Promise<EnhancedDOMTreeNode> {
		// Check iframe depth limit
		if (iframe_depth > this.max_iframe_depth) {
			this.logger?.warn(`Reached max iframe depth: ${this.max_iframe_depth}`);
			// Return minimal node
			return {
				node_id: -1,
				backend_node_id: -1,
				node_type: NodeType.ELEMENT_NODE,
				node_name: 'IFRAME_DEPTH_LIMIT',
				node_value: '',
				attributes: {},
				is_scrollable: null,
				is_visible: null,
				absolute_position: null,
				target_id: target_id,
				frame_id: null,
				session_id: null,
				content_document: null,
				shadow_root_type: null,
				shadow_roots: null,
				parent_node: null,
				children_nodes: null,
				ax_node: null,
				snapshot_node: null,
				element_index: null,
				_compound_children: [],
				uuid: crypto.randomUUID()
			};
		}

		// Get all trees for this target
		const all_trees = await this._get_all_trees(target_id);

		// Build snapshot lookup
		const snapshot_lookup = build_snapshot_lookup(
			all_trees.snapshot,
			all_trees.device_pixel_ratio
		);

		// Build AX tree lookup
		const ax_tree_map = new Map<number, EnhancedAXNode>();
		if (all_trees.ax_tree.nodes) {
			for (const ax_node of all_trees.ax_tree.nodes) {
				const enhanced = this._build_enhanced_ax_node(ax_node);
				if (ax_node.backendDOMNodeId) {
					ax_tree_map.set(ax_node.backendDOMNodeId, enhanced);
				}
			}
		}

		// Convert DOM tree to enhanced tree
		const enhanced_tree = this._convert_to_enhanced_tree(
			all_trees.dom_tree.root,
			null, // parent
			ax_tree_map,
			snapshot_lookup,
			target_id,
			initial_html_frames || new Map(),
			initial_total_frame_offset || { x: 0, y: 0 },
			iframe_depth
		);

		return enhanced_tree;
	}

	/**
	 * Get serialized DOM tree for LLM consumption
	 */
	async get_serialized_dom_tree(
		previous_cached_state?: SerializedDOMState
	): Promise<SerializedDOMState> {
		// Get the main page target ID
		// TODO: Get actual target ID from browser session
		const target_id = 'main';

		// Get the full DOM tree
		const dom_tree = await this.get_dom_tree(target_id);

		// Serialize the tree
		const serialized = this.serializer.serialize_accessible_elements(
			dom_tree,
			this.paint_order_filtering,
			previous_cached_state
		);

		return serialized;
	}

	/**
	 * Helper method to convert CDP DOM node to enhanced tree node
	 */
	private _convert_to_enhanced_tree(
		node: any, // CDP Node type
		parent: EnhancedDOMTreeNode | null,
		ax_tree_map: Map<number, EnhancedAXNode>,
		snapshot_lookup: Map<number, EnhancedSnapshotNode>,
		target_id: string,
		html_frames: Map<string, any>,
		total_frame_offset: { x: number; y: number },
		iframe_depth: number
	): EnhancedDOMTreeNode {
		// Create base enhanced node
		const enhanced: EnhancedDOMTreeNode = {
			node_id: node.nodeId,
			backend_node_id: node.backendNodeId,
			node_type: node.nodeType,
			node_name: node.nodeName,
			node_value: node.nodeValue || '',
			attributes: {},
			is_scrollable: null,
			is_visible: null,
			absolute_position: null,
			target_id: target_id,
			frame_id: node.frameId || null,
			session_id: null,
			content_document: null,
			shadow_root_type: node.shadowRootType || null,
			shadow_roots: null,
			parent_node: parent,
			children_nodes: null,
			ax_node: ax_tree_map.get(node.backendNodeId) || null,
			snapshot_node: snapshot_lookup.get(node.backendNodeId) || null,
			element_index: null,
			_compound_children: [],
			uuid: crypto.randomUUID()
		};

		// Parse attributes
		if (node.attributes && Array.isArray(node.attributes)) {
			for (let i = 0; i < node.attributes.length; i += 2) {
				enhanced.attributes[node.attributes[i]] = node.attributes[i + 1];
			}
		}

		// Process snapshot data for position and scrollability
		if (enhanced.snapshot_node) {
			enhanced.is_scrollable = this._check_scrollability(enhanced);
			enhanced.absolute_position = this._calculate_absolute_position(
				enhanced.snapshot_node.bounds,
				total_frame_offset
			);
			enhanced.is_visible = this._check_visibility(enhanced);
		}

		// Process children
		if (node.children && node.children.length > 0) {
			enhanced.children_nodes = node.children.map((child: any) =>
				this._convert_to_enhanced_tree(
					child,
					enhanced,
					ax_tree_map,
					snapshot_lookup,
					target_id,
					html_frames,
					total_frame_offset,
					iframe_depth
				)
			);
		}

		// Process shadow roots
		if (node.shadowRoots && node.shadowRoots.length > 0) {
			enhanced.shadow_roots = node.shadowRoots.map((shadow: any) =>
				this._convert_to_enhanced_tree(
					shadow,
					enhanced,
					ax_tree_map,
					snapshot_lookup,
					target_id,
					html_frames,
					total_frame_offset,
					iframe_depth
				)
			);
		}

		// Process content document (iframe)
		if (node.contentDocument) {
			// Check iframe limit
			if (this._get_iframe_count(enhanced) < this.max_iframes) {
				enhanced.content_document = this._convert_to_enhanced_tree(
					node.contentDocument,
					enhanced,
					ax_tree_map,
					snapshot_lookup,
					target_id,
					html_frames,
					total_frame_offset,
					iframe_depth + 1
				);
			}
		}

		return enhanced;
	}

	/**
	 * Check if element is scrollable based on computed styles
	 */
	private _check_scrollability(node: EnhancedDOMTreeNode): boolean {
		if (!node.snapshot_node?.computed_styles) {
			return false;
		}

		const styles = node.snapshot_node.computed_styles;
		const overflow = styles['overflow'] || 'visible';
		const overflowX = styles['overflow-x'] || overflow;
		const overflowY = styles['overflow-y'] || overflow;

		// Element is scrollable if overflow is auto or scroll
		return (
			overflowX === 'auto' || overflowX === 'scroll' ||
			overflowY === 'auto' || overflowY === 'scroll'
		);
	}

	/**
	 * Calculate absolute position including frame offsets
	 */
	private _calculate_absolute_position(
		bounds: DOMRect | null,
		frame_offset: { x: number; y: number }
	): DOMRect | null {
		if (!bounds) {
			return null;
		}

		return {
			x: bounds.x + frame_offset.x,
			y: bounds.y + frame_offset.y,
			width: bounds.width,
			height: bounds.height
		};
	}

	/**
	 * Check if element is visible based on styles and bounds
	 */
	private _check_visibility(node: EnhancedDOMTreeNode): boolean {
		// Check bounds
		if (!node.snapshot_node?.bounds) {
			return false;
		}

		const bounds = node.snapshot_node.bounds;
		if (bounds.width <= 0 || bounds.height <= 0) {
			return false;
		}

		// Check computed styles
		if (node.snapshot_node.computed_styles) {
			const styles = node.snapshot_node.computed_styles;

			if (styles['display'] === 'none') {
				return false;
			}

			if (styles['visibility'] === 'hidden' || styles['visibility'] === 'collapse') {
				return false;
			}

			const opacity = parseFloat(styles['opacity'] || '1');
			if (opacity === 0) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Count total iframes in tree
	 */
	private _get_iframe_count(root: EnhancedDOMTreeNode): number {
		let count = 0;

		// Count this node if it's an iframe
		if (root.node_name === 'IFRAME') {
			count++;
		}

		// Count children
		if (root.children_nodes) {
			for (const child of root.children_nodes) {
				count += this._get_iframe_count(child);
			}
		}

		// Count shadow roots
		if (root.shadow_roots) {
			for (const shadow of root.shadow_roots) {
				count += this._get_iframe_count(shadow);
			}
		}

		// Count content document
		if (root.content_document) {
			count += this._get_iframe_count(root.content_document);
		}

		return count;
	}
}