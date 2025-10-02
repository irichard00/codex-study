/**
 * SessionServices - centralized service management for sessions
 * Port of Rust SessionServices struct (commit 250b244ab)
 *
 * Note: No MCP support in browser-based agent
 */

import { ConversationStore } from '../../../storage/ConversationStore';

/**
 * User notification service interface
 */
export interface UserNotifier {
  notify(message: string, type?: 'info' | 'error' | 'warning' | 'success'): void;
  error(message: string): void;
  success(message: string): void;
  warning?(message: string): void;
}

/**
 * Rollout feature recorder interface
 */
export interface RolloutRecorder {
  record(feature: string, enabled: boolean): void;
  isEnabled(feature: string): boolean;
}

/**
 * DOM manipulation service interface (browser-specific)
 */
export interface DOMService {
  querySelector(selector: string): Element | null;
  querySelectorAll(selector: string): NodeListOf<Element>;
  click(element: Element): void;
  getText(element: Element): string;
  setAttribute(element: Element, name: string, value: string): void;
}

/**
 * Tab management service interface (browser-specific)
 */
export interface TabManager {
  getCurrentTab(): Promise<chrome.tabs.Tab | null>;
  openTab(url: string): Promise<chrome.tabs.Tab>;
  closeTab(tabId: number): Promise<void>;
  updateTab(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab>;
  listTabs(): Promise<chrome.tabs.Tab[]>;
}

/**
 * Centralized service collection for sessions
 * Browser-focused (no MCP, no file system, no shell)
 */
export interface SessionServices {
  /** Optional conversation storage */
  conversationStore?: ConversationStore;

  /** Required user notification service */
  notifier: UserNotifier;

  /** Optional rollout feature recorder */
  rolloutRecorder?: RolloutRecorder;

  /** Optional DOM manipulation service */
  domService?: DOMService;

  /** Optional tab management service */
  tabManager?: TabManager;

  /** Whether to show raw agent reasoning */
  showRawAgentReasoning: boolean;
}

/**
 * Default console-based notifier for testing
 */
class ConsoleNotifier implements UserNotifier {
  notify(message: string, type: 'info' | 'error' | 'warning' | 'success' = 'info'): void {
    const prefix = `[${type.toUpperCase()}]`;
    console.log(prefix, message);
  }

  error(message: string): void {
    console.error('[ERROR]', message);
  }

  success(message: string): void {
    console.log('[SUCCESS]', message);
  }

  warning(message: string): void {
    console.warn('[WARNING]', message);
  }
}

/**
 * Default in-memory rollout recorder for testing
 */
class InMemoryRolloutRecorder implements RolloutRecorder {
  private features: Map<string, boolean> = new Map();

  record(feature: string, enabled: boolean): void {
    this.features.set(feature, enabled);
  }

  isEnabled(feature: string): boolean {
    return this.features.get(feature) ?? false;
  }
}

/**
 * Factory function to create SessionServices
 *
 * @param config Partial service configuration
 * @param isTest Whether running in test mode (uses simpler implementations)
 * @returns Promise resolving to SessionServices
 */
export async function createSessionServices(
  config: Partial<SessionServices>,
  isTest: boolean
): Promise<SessionServices> {
  // Create default notifier if not provided
  const notifier = config.notifier ?? new ConsoleNotifier();

  // Create conversation store if needed and not in test mode
  let conversationStore = config.conversationStore;
  if (!conversationStore && !isTest) {
    conversationStore = new ConversationStore();
    await conversationStore.initialize();
  }

  // Create default rollout recorder if not provided
  const rolloutRecorder = config.rolloutRecorder ?? (isTest ? new InMemoryRolloutRecorder() : undefined);

  return {
    conversationStore,
    notifier,
    rolloutRecorder,
    domService: config.domService,
    tabManager: config.tabManager,
    showRawAgentReasoning: config.showRawAgentReasoning ?? false,
  };
}
