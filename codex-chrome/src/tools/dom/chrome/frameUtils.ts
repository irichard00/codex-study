import { TargetInfo } from '../views';

/**
 * Frame information from Chrome APIs
 */
export interface FrameInfo {
	frameId: number;
	parentFrameId: number;
	url: string;
	errorOccurred: boolean;
	processId?: number;
	documentId?: string;
	documentLifecycle?: string;
}

/**
 * Get all frames for a tab using chrome.webNavigation API
 */
export async function getAllFrames(tabId: number): Promise<FrameInfo[]> {
	return new Promise((resolve, reject) => {
		chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(frames || []);
			}
		});
	});
}

/**
 * Convert frame info to CDP TargetInfo format
 */
export function frameToTargetInfo(frame: FrameInfo, tabId: number): TargetInfo {
	const isMainFrame = frame.parentFrameId === -1;

	return {
		targetId: `frame_${tabId}_${frame.frameId}`,
		type: isMainFrame ? 'page' : 'iframe',
		title: '',
		url: frame.url,
		attached: true,
		canAccessOpener: false,
		browserContextId: `context_${tabId}`
	};
}

/**
 * Get frame targets similar to CDP Target.getTargets()
 */
export async function getFrameTargets(tabId: number): Promise<TargetInfo[]> {
	const frames = await getAllFrames(tabId);
	return frames.map(frame => frameToTargetInfo(frame, tabId));
}

/**
 * Execute script in a specific frame
 */
export async function executeInFrame<T = any>(
	tabId: number,
	frameId: number,
	func: () => T
): Promise<T> {
	const results = await chrome.scripting.executeScript({
		target: { tabId, frameIds: [frameId] },
		func,
		world: 'MAIN'
	});

	if (results && results.length > 0) {
		return results[0].result as T;
	}

	throw new Error(`Failed to execute script in frame ${frameId}`);
}

/**
 * Execute script in all frames of a tab
 */
export async function executeInAllFrames<T = any>(
	tabId: number,
	func: () => T
): Promise<Map<number, T>> {
	const frames = await getAllFrames(tabId);
	const results = new Map<number, T>();

	// Execute in parallel for better performance
	const promises = frames.map(async (frame) => {
		try {
			const result = await executeInFrame(tabId, frame.frameId, func);
			results.set(frame.frameId, result);
		} catch (error) {
			console.warn(`Failed to execute in frame ${frame.frameId}:`, error);
			// Cross-origin frames will fail, that's expected
		}
	});

	await Promise.all(promises);
	return results;
}

/**
 * Get frame tree structure
 */
export interface FrameTreeNode {
	frameId: number;
	url: string;
	children: FrameTreeNode[];
	isAccessible: boolean;
}

export async function getFrameTree(tabId: number): Promise<FrameTreeNode> {
	const frames = await getAllFrames(tabId);

	// Build frame map
	const frameMap = new Map<number, FrameInfo>();
	const childrenMap = new Map<number, FrameInfo[]>();

	for (const frame of frames) {
		frameMap.set(frame.frameId, frame);

		if (!childrenMap.has(frame.parentFrameId)) {
			childrenMap.set(frame.parentFrameId, []);
		}
		childrenMap.get(frame.parentFrameId)!.push(frame);
	}

	// Find main frame
	const mainFrame = frames.find(f => f.parentFrameId === -1);
	if (!mainFrame) {
		throw new Error('No main frame found');
	}

	// Build tree recursively
	async function buildNode(frame: FrameInfo): Promise<FrameTreeNode> {
		const children = childrenMap.get(frame.frameId) || [];

		// Check if frame is accessible
		let isAccessible = true;
		try {
			await executeInFrame(tabId, frame.frameId, () => document.title);
		} catch {
			isAccessible = false;
		}

		return {
			frameId: frame.frameId,
			url: frame.url,
			isAccessible,
			children: await Promise.all(children.map(buildNode))
		};
	}

	return buildNode(mainFrame);
}

/**
 * Message passing between frames
 */
export interface FrameMessage {
	type: string;
	data: any;
	sourceFrameId: number;
	targetFrameId?: number;
}

/**
 * Send message to a specific frame
 */
export async function sendMessageToFrame(
	tabId: number,
	frameId: number,
	message: any
): Promise<any> {
	return chrome.tabs.sendMessage(tabId, message, { frameId });
}

/**
 * Broadcast message to all frames
 */
export async function broadcastToFrames(
	tabId: number,
	message: any
): Promise<Map<number, any>> {
	const frames = await getAllFrames(tabId);
	const responses = new Map<number, any>();

	const promises = frames.map(async (frame) => {
		try {
			const response = await sendMessageToFrame(tabId, frame.frameId, message);
			responses.set(frame.frameId, response);
		} catch (error) {
			console.warn(`Failed to send message to frame ${frame.frameId}:`, error);
		}
	});

	await Promise.all(promises);
	return responses;
}

/**
 * Get frame offset relative to main frame
 */
export async function getFrameOffset(
	tabId: number,
	frameId: number
): Promise<{ x: number; y: number }> {
	// Execute script to find iframe element and get its offset
	const offset = await executeInFrame(tabId, 0, () => {
		// This runs in main frame
		const iframes = document.querySelectorAll('iframe');
		for (const iframe of iframes) {
			// Try to match by frame ID (this is simplified, actual matching is complex)
			const rect = iframe.getBoundingClientRect();
			return {
				x: rect.left + window.scrollX,
				y: rect.top + window.scrollY
			};
		}
		return { x: 0, y: 0 };
	});

	return offset || { x: 0, y: 0 };
}

/**
 * Utility to check if frame is same-origin
 */
export async function isFrameSameOrigin(
	tabId: number,
	frameId: number
): Promise<boolean> {
	try {
		await executeInFrame(tabId, frameId, () => document.domain);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get frame dimensions
 */
export async function getFrameDimensions(
	tabId: number,
	frameId: number
): Promise<{ width: number; height: number }> {
	try {
		return await executeInFrame(tabId, frameId, () => ({
			width: document.documentElement.scrollWidth,
			height: document.documentElement.scrollHeight
		}));
	} catch {
		// Cross-origin frame, return default
		return { width: 0, height: 0 };
	}
}

/**
 * Monitor frame navigation
 */
export function onFrameNavigated(
	callback: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void
): void {
	chrome.webNavigation.onCommitted.addListener(callback);
}

/**
 * Monitor frame creation
 */
export function onFrameCreated(
	callback: (details: chrome.webNavigation.WebNavigationSourceCallbackDetails) => void
): void {
	chrome.webNavigation.onCreatedNavigationTarget.addListener(callback);
}