/**
 * Enhanced snapshot processing for browser-use DOM tree extraction.
 *
 * This module provides stateless functions for parsing Chrome DevTools Protocol (CDP) DOMSnapshot data
 * to extract visibility, clickability, cursor styles, and other layout information.
 */

import {
	DOMRect,
	EnhancedSnapshotNode,
	RareBooleanData,
	NodeTreeSnapshot,
	LayoutTreeSnapshot,
	CaptureSnapshotReturns,
	REQUIRED_COMPUTED_STYLES
} from './views';

/**
 * Parse rare boolean data from snapshot - returns True if index is in the rare data.
 */
export function parse_rare_boolean_data(rare_data: RareBooleanData, index: number): boolean | null {
	return rare_data.index.includes(index) ? true : null;
}

/**
 * Parse computed styles from layout tree using string indices.
 */
export function parse_computed_styles(strings: string[], style_indices: number[]): Record<string, string> {
	const styles: Record<string, string> = {};
	for (let i = 0; i < style_indices.length; i++) {
		if (i < REQUIRED_COMPUTED_STYLES.length && style_indices[i] >= 0 && style_indices[i] < strings.length) {
			styles[REQUIRED_COMPUTED_STYLES[i]] = strings[style_indices[i]];
		}
	}
	return styles;
}

/**
 * Build a lookup table of backend node ID to enhanced snapshot data with everything calculated upfront.
 */
export function build_snapshot_lookup(
	snapshot: CaptureSnapshotReturns,
	device_pixel_ratio: number = 1.0
): Record<number, EnhancedSnapshotNode> {
	const snapshot_lookup: Record<number, EnhancedSnapshotNode> = {};

	if (!snapshot.documents || snapshot.documents.length === 0) {
		return snapshot_lookup;
	}

	const strings = snapshot.strings;

	for (const document of snapshot.documents) {
		const nodes: NodeTreeSnapshot = document.nodes;
		const layout: LayoutTreeSnapshot = document.layout;

		// Build backend node id to snapshot index lookup
		const backend_node_to_snapshot_index: Record<number, number> = {};
		if (nodes.backendNodeId) {
			for (let i = 0; i < nodes.backendNodeId.length; i++) {
				const backend_node_id = nodes.backendNodeId[i];
				backend_node_to_snapshot_index[backend_node_id] = i;
			}
		}

		// PERFORMANCE: Pre-build layout index map to eliminate O(n²) double lookups
		// Preserve original behavior: use FIRST occurrence for duplicates
		const layout_index_map: Record<number, number> = {};
		if (layout && layout.nodeIndex) {
			for (let layout_idx = 0; layout_idx < layout.nodeIndex.length; layout_idx++) {
				const node_index = layout.nodeIndex[layout_idx];
				if (!(node_index in layout_index_map)) {  // Only store first occurrence
					layout_index_map[node_index] = layout_idx;
				}
			}
		}

		// Build snapshot lookup for each backend node id
		for (const backend_node_id in backend_node_to_snapshot_index) {
			const backend_node_id_num = parseInt(backend_node_id);
			const snapshot_index = backend_node_to_snapshot_index[backend_node_id_num];

			let is_clickable: boolean | null = null;
			if (nodes.isClickable) {
				is_clickable = parse_rare_boolean_data(nodes.isClickable, snapshot_index);
			}

			// Find corresponding layout node
			let cursor_style: string | null = null;
			let bounding_box: DOMRect | null = null;
			let computed_styles: Record<string, string> | null = null;
			let paint_order: number | null = null;
			let client_rects: DOMRect | null = null;
			let scroll_rects: DOMRect | null = null;
			let stacking_contexts: number | null = null;

			// Look for layout tree node that corresponds to this snapshot node
			if (snapshot_index in layout_index_map) {
				const layout_idx = layout_index_map[snapshot_index];

				// Parse bounding box
				if (layout.bounds && layout_idx < layout.bounds.length) {
					const bounds = layout.bounds[layout_idx];
					if (bounds.length >= 4) {
						// IMPORTANT: CDP coordinates are in device pixels, convert to CSS pixels
						// by dividing by the device pixel ratio
						const raw_x = bounds[0];
						const raw_y = bounds[1];
						const raw_width = bounds[2];
						const raw_height = bounds[3];

						// Apply device pixel ratio scaling to convert device pixels to CSS pixels
						bounding_box = {
							x: raw_x / device_pixel_ratio,
							y: raw_y / device_pixel_ratio,
							width: raw_width / device_pixel_ratio,
							height: raw_height / device_pixel_ratio
						};
					}
				}

				// Parse computed styles for this layout node
				if (layout.styles && layout_idx < layout.styles.length) {
					const style_indices = layout.styles[layout_idx];
					const styles = parse_computed_styles(strings, style_indices);
					if (Object.keys(styles).length > 0) {
						computed_styles = styles;
						cursor_style = styles.cursor || null;
					}
				}

				// Extract paint order if available
				if (layout.paintOrders && layout_idx < layout.paintOrders.length) {
					paint_order = layout.paintOrders[layout_idx];
				}

				// Extract client rects if available
				const client_rects_data = layout.clientRects || [];
				if (layout_idx < client_rects_data.length) {
					const client_rect_data = client_rects_data[layout_idx];
					if (client_rect_data && client_rect_data.length >= 4) {
						client_rects = {
							x: client_rect_data[0],
							y: client_rect_data[1],
							width: client_rect_data[2],
							height: client_rect_data[3]
						};
					}
				}

				// Extract scroll rects if available
				const scroll_rects_data = layout.scrollRects || [];
				if (layout_idx < scroll_rects_data.length) {
					const scroll_rect_data = scroll_rects_data[layout_idx];
					if (scroll_rect_data && scroll_rect_data.length >= 4) {
						scroll_rects = {
							x: scroll_rect_data[0],
							y: scroll_rect_data[1],
							width: scroll_rect_data[2],
							height: scroll_rect_data[3]
						};
					}
				}

				// Extract stacking contexts if available
				if (layout.stackingContexts && layout.stackingContexts.index && layout_idx < layout.stackingContexts.index.length) {
					stacking_contexts = layout.stackingContexts.index[layout_idx];
				}
			}

			snapshot_lookup[backend_node_id_num] = {
				is_clickable,
				cursor_style,
				bounds: bounding_box,
				clientRects: client_rects,
				scrollRects: scroll_rects,
				computed_styles,
				paint_order,
				stacking_contexts
			};
		}
	}

	return snapshot_lookup;
}