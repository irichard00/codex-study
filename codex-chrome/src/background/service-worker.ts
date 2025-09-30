/**
 * Chrome extension background service worker
 * Central coordinator for the Codex agent
 */

import { CodexAgent } from '../core/CodexAgent';
import { MessageRouter, MessageType } from '../core/MessageRouter';
import type { Submission, Event } from '../protocol/types';
import { validateSubmission } from '../protocol/schemas';
import { ModelClientFactory } from '../models/ModelClientFactory';
import { ConversationStore } from '../storage/ConversationStore';
import { CacheManager } from '../storage/CacheManager';
import { StorageQuotaManager } from '../storage/StorageQuotaManager';
import { registerTools } from '../tools';
import { AgentConfig } from '../config/AgentConfig';

// Global instances
let agent: CodexAgent | null = null;
let router: MessageRouter | null = null;
let conversationStore: ConversationStore | null = null;
let cacheManager: CacheManager | null = null;
let storageQuotaManager: StorageQuotaManager | null = null;
let agentConfig: AgentConfig | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the service worker
 */
async function initialize(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    console.log('Service worker already initialized, skipping...');
    return;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('Initialization already in progress, waiting...');
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = doInitialize();

  try {
    await initializationPromise;
    isInitialized = true;
  } finally {
    initializationPromise = null;
  }
}

/**
 * Actual initialization logic
 */
async function doInitialize(): Promise<void> {
  console.log('Initializing Codex background service worker');

  // Initialize configuration singleton first
  agentConfig = AgentConfig.getInstance();
  await agentConfig.initialize();
  console.log('AgentConfig initialized');

  // Create agent instance with config (agent will initialize ModelClientFactory and ToolRegistry)
  agent = new CodexAgent(agentConfig!);
  await agent.initialize();

  // Create message router
  router = new MessageRouter('background');

  // Setup message handlers
  setupMessageHandlers();

  // Setup Chrome event listeners
  setupChromeListeners();

  // Setup periodic tasks
  setupPeriodicTasks();

  // Initialize browser-specific tools
  await initializeBrowserTools();

  // Initialize storage layer
  await initializeStorage();

  console.log('Service worker initialized');
}

/**
 * Setup message handlers
 */
function setupMessageHandlers(): void {
  if (!router || !agent) return;
  
  // Handle submissions from UI
  router.on(MessageType.SUBMISSION, async (message) => {
    const submission = message.payload as Submission;
    
    if (!validateSubmission(submission)) {
      console.error('Invalid submission:', submission);
      return;
    }
    
    try {
      const id = await agent!.submitOperation(submission.op);
      return { submissionId: id };
    } catch (error) {
      console.error('Failed to submit operation:', error);
      throw error;
    }
  });
  
  // Handle state queries
  router.on(MessageType.GET_STATE, async () => {
    if (!agent) return null;
    
    const session = agent.getSession();
    return {
      sessionId: session.conversationId,
      messageCount: session.getMessageCount(),
      turnContext: session.getTurnContext(),
      metadata: session.getMetadata(),
    };
  });
  
  // Handle ping/pong for connection testing
  router.on(MessageType.PING, async () => {
    return { type: MessageType.PONG, timestamp: Date.now() };
  });

  // Handle session reset
  router.on(MessageType.SESSION_RESET, async () => {
    console.log('Session reset requested');
    if (agent) {
      // Reset the current session
      const session = agent.getSession();
      await session.reset();

      console.log('Session reset complete');
      return { type: MessageType.SESSION_RESET_COMPLETE, timestamp: Date.now() };
    }
    return { success: false, error: 'Agent not initialized' };
  });
  
  // Handle storage operations
  router.on(MessageType.STORAGE_GET, async (message) => {
    const { key } = message.payload;
    const result = await chrome.storage.local.get(key);
    return result[key];
  });

  router.on(MessageType.STORAGE_SET, async (message) => {
    const { key, value } = message.payload;
    await chrome.storage.local.set({ [key]: value });
    return { success: true };
  });

  // Handle model client messages
  router.on(MessageType.MODEL_REQUEST, async (message) => {
    if (!agent) throw new Error('Agent not initialized');

    const { config, prompt } = message.payload;
    const modelClientFactory = ModelClientFactory.getInstance();
    const client = await modelClientFactory.createClient(config);
    return await client.complete(prompt);
  });

  // Handle tool execution messages
  router.on(MessageType.TOOL_EXECUTE, async (message) => {
    if (!agent) throw new Error('Agent not initialized');

    const { toolName, args } = message.payload;
    const toolRegistry = agent.getToolRegistry();
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // For now, just return a placeholder result
    return { success: true, message: `Tool ${toolName} executed` };
  });

  // Handle approval requests
  router.on(MessageType.APPROVAL_REQUEST, async (message) => {
    if (!agent) throw new Error('Agent not initialized');

    const { approvalId, type, details } = message.payload;
    const approvalManager = agent.getApprovalManager();

    // For now, just return a placeholder approval response
    return { approved: false, message: 'Approval system not fully integrated yet' };
  });

  // Handle diff events
  router.on(MessageType.DIFF_GENERATED, async (message) => {
    if (!agent) throw new Error('Agent not initialized');

    const { diffId, path, content } = message.payload;
    const diffTracker = agent.getDiffTracker();

    // For now, just log the diff - proper integration pending
    console.log(`Diff generated: ${diffId} for ${path}`);

    // Broadcast diff to UI
    if (router) {
      await router.broadcast(MessageType.DIFF_GENERATED, message.payload);
    }
  });
  
  // Handle tab commands
  router.on(MessageType.TAB_COMMAND, async (message) => {
    const { command, args } = message.payload;
    const tabId = message.tabId;
    
    if (!tabId) {
      throw new Error('Tab ID required for tab command');
    }
    
    return executeTabCommand(tabId, command, args);
  });
}

/**
 * Setup Chrome API event listeners
 */
function setupChromeListeners(): void {
  // Handle extension installation
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
      // Open welcome page on first install
      chrome.tabs.create({
        url: chrome.runtime.getURL('welcome.html'),
      });
    }
    
    // Setup context menus
    setupContextMenus();
  });
  
  // Handle side panel opening
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  
  // Handle tab updates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      // Inject content script if needed
      injectContentScriptIfNeeded(tabId, tab);
    }
  });
  
  // Handle commands (keyboard shortcuts)
  chrome.commands.onCommand.addListener((command) => {
    handleCommand(command);
  });
  
  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    handleContextMenuClick(info, tab);
  });
}

/**
 * Setup context menus
 */
function setupContextMenus(): void {
  chrome.contextMenus.create({
    id: 'codex-explain',
    title: 'Explain with Codex',
    contexts: ['selection'],
  });
  
  chrome.contextMenus.create({
    id: 'codex-improve',
    title: 'Improve with Codex',
    contexts: ['selection'],
  });
  
  chrome.contextMenus.create({
    id: 'codex-extract',
    title: 'Extract data with Codex',
    contexts: ['page', 'frame'],
  });
}

/**
 * Handle keyboard commands
 */
function handleCommand(command: string): void {
  switch (command) {
    case 'toggle-sidepanel':
      // Toggle side panel
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      break;
      
    case 'quick-action':
      // Trigger quick action on current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          executeQuickAction(tabs[0].id);
        }
      });
      break;
  }
}

/**
 * Handle context menu clicks
 */
async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!tab?.id || !agent) return;
  
  const submission: Partial<Submission> = {
    id: `ctx_${Date.now()}`,
    op: {
      type: 'UserInput',
      items: [],
    },
  };
  
  switch (info.menuItemId) {
    case 'codex-explain':
      if (info.selectionText) {
        submission.op = {
          type: 'UserInput',
          items: [
            {
              type: 'text',
              text: `Explain this: ${info.selectionText}`,
            },
          ],
        };
      }
      break;
      
    case 'codex-improve':
      if (info.selectionText) {
        submission.op = {
          type: 'UserInput',
          items: [
            {
              type: 'text',
              text: `Improve this text: ${info.selectionText}`,
            },
          ],
        };
      }
      break;
      
    case 'codex-extract':
      submission.op = {
        type: 'UserInput',
        items: [
          {
            type: 'text',
            text: `Extract structured data from this page`,
          },
          {
            type: 'context',
            path: info.pageUrl,
          },
        ],
      };
      break;
  }
  
  // Submit to agent
  if (submission.op) {
    await agent.submitOperation(submission.op);
    
    // Open side panel to show results
    chrome.sidePanel.open({ tabId: tab.id });
  }
}

/**
 * Inject content script if needed
 */
async function injectContentScriptIfNeeded(
  tabId: number,
  tab: chrome.tabs.Tab
): Promise<void> {
  // Skip chrome:// and other protected URLs
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }
  
  try {
    // Check if content script is already injected
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (response) {
      return; // Already injected
    }
  } catch {
    // Not injected, proceed with injection
  }
  
  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (error) {
    console.error('Failed to inject content script:', error);
  }
}

/**
 * Execute tab command
 */
async function executeTabCommand(
  tabId: number,
  command: string,
  args?: any
): Promise<any> {
  switch (command) {
    case 'evaluate':
      return chrome.scripting.executeScript({
        target: { tabId },
        func: (code: string) => eval(code),
        args: [args.code],
      });
      
    case 'screenshot':
      return chrome.tabs.captureVisibleTab({ format: 'png' });
      
    case 'get-html':
      return chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.documentElement.outerHTML,
      });
      
    case 'get-text':
      return chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.body.innerText,
      });
      
    case 'navigate':
      return chrome.tabs.update(tabId, { url: args.url });
      
    case 'reload':
      return chrome.tabs.reload(tabId);
      
    case 'close':
      return chrome.tabs.remove(tabId);
      
    default:
      throw new Error(`Unknown tab command: ${command}`);
  }
}

/**
 * Initialize browser-specific tools
 */
async function initializeBrowserTools(): Promise<void> {
  if (!agent) return;

  const toolRegistry = agent.getToolRegistry();
  // Register all tools (await them to ensure they're registered before listTools is called)
  await registerTools(toolRegistry, agentConfig!.getToolsConfig());

  console.log('Browser tools initialized');
}

/**
 * Initialize storage layer
 */
async function initializeStorage(): Promise<void> {
  console.log('Initializing storage layer...');

  // Initialize conversation store
  conversationStore = new ConversationStore();
  await conversationStore.initialize();

  // Initialize cache manager
  cacheManager = new CacheManager({
    maxSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 3600000, // 1 hour
    evictionPolicy: 'lru'
  });

  // Initialize storage quota manager
  storageQuotaManager = new StorageQuotaManager(conversationStore, cacheManager);
  await storageQuotaManager.initialize();

  // Check storage quota
  const quota = await storageQuotaManager.getQuota();
  console.log(`Storage usage: ${quota.percentage.toFixed(2)}% (${quota.usage} / ${quota.quota} bytes)`);

  // Request persistent storage if not already granted
  if (!quota.persistent) {
    const granted = await storageQuotaManager.requestPersistentStorage();
    if (granted) {
      console.log('Persistent storage granted');
    } else {
      console.log('Persistent storage denied');
    }
  }

  // Wire storage to agent session if agent is initialized
  if (agent) {
    const session = agent.getSession();
    await session.initialize();
  }

  console.log('Storage layer initialized');
}

/**
 * Execute quick action on tab
 */
async function executeQuickAction(tabId: number): Promise<void> {
  // Get current page context
  const tab = await chrome.tabs.get(tabId);

  if (!agent) return;

  // Submit quick analysis request
  await agent.submitOperation({
    type: 'UserInput',
    items: [
      {
        type: 'text',
        text: 'Analyze this page and provide key insights',
      },
      {
        type: 'context',
        path: tab.url,
      },
    ],
  });

  // Open side panel
  chrome.sidePanel.open({ tabId });
}

/**
 * Setup periodic tasks
 */
function setupPeriodicTasks(): void {
  // Process event queue periodically
  setInterval(async () => {
    if (!agent || !router) return;

    // Get next event from agent
    const event = await agent.getNextEvent();
    if (event) {
      // Broadcast event to all connected clients
      await router.broadcast(MessageType.EVENT, event);
    }
  }, 100); // Check every 100ms

  // Cleanup old data and manage storage periodically
  // Wrap in try-catch to handle any chrome API issues
  try {
    // Check if chrome.alarms API is available
    if (typeof chrome !== 'undefined' && chrome?.alarms?.create) {
    chrome.alarms.create('storage-cleanup', { periodInMinutes: 60 });
    chrome.alarms.create('cache-cleanup', { periodInMinutes: 30 });
    chrome.alarms.create('quota-check', { periodInMinutes: 10 });

    // Handle alarms
    chrome.alarms.onAlarm?.addListener(async (alarm) => {
      switch (alarm.name) {
        case 'storage-cleanup':
          await performStorageCleanup();
          break;
        case 'cache-cleanup':
          if (cacheManager) {
            const removed = await cacheManager.cleanup();
            console.log(`Cache cleanup: ${removed} expired entries removed`);
          }
          break;
        case 'quota-check':
          if (storageQuotaManager) {
            const shouldCleanup = await storageQuotaManager.shouldCleanup();
            if (shouldCleanup) {
              const results = await storageQuotaManager.cleanup(70);
              console.log('Quota cleanup results:', results);
            }
          }
          break;
      }
    });
  } else {
    console.warn('chrome.alarms API not available, periodic cleanup disabled');
    // Fallback: Use setInterval for cleanup tasks if alarms API is not available
    setInterval(async () => {
      await performStorageCleanup();
    }, 60 * 60 * 1000); // Every hour

    setInterval(async () => {
      if (cacheManager) {
        const removed = await cacheManager.cleanup();
        console.log(`Cache cleanup: ${removed} expired entries removed`);
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    setInterval(async () => {
      if (storageQuotaManager) {
        const shouldCleanup = await storageQuotaManager.shouldCleanup();
        if (shouldCleanup) {
          const results = await storageQuotaManager.cleanup(70);
          console.log('Quota cleanup results:', results);
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }
  } catch (error) {
    console.error('Failed to setup Chrome alarms:', error);
    console.warn('Falling back to setInterval for periodic cleanup');

    // Fallback: Use setInterval for cleanup tasks if alarms API fails
    setInterval(async () => {
      await performStorageCleanup();
    }, 60 * 60 * 1000); // Every hour

    setInterval(async () => {
      if (cacheManager) {
        const removed = await cacheManager.cleanup();
        console.log(`Cache cleanup: ${removed} expired entries removed`);
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    setInterval(async () => {
      if (storageQuotaManager) {
        const shouldCleanup = await storageQuotaManager.shouldCleanup();
        if (shouldCleanup) {
          const results = await storageQuotaManager.cleanup(70);
          console.log('Quota cleanup results:', results);
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }
}

/**
 * Perform storage cleanup
 */
async function performStorageCleanup(): Promise<void> {
  const storage = await chrome.storage.local.get(null);
  const now = Date.now();
  const keysToRemove: string[] = [];

  // Remove old temporary data (older than 24 hours)
  for (const key in storage) {
    if (key.startsWith('temp_')) {
      const data = storage[key];
      if (data.timestamp && now - data.timestamp > 24 * 60 * 60 * 1000) {
        keysToRemove.push(key);
      }
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
    console.log(`Storage cleanup: ${keysToRemove.length} temporary items removed`);
  }

  // Clean old conversations if storage is available
  if (conversationStore) {
    const deleted = await conversationStore.cleanup(30);
    if (deleted > 0) {
      console.log(`Conversation cleanup: ${deleted} old conversations removed`);
    }
  }
}

/**
 * Handle service worker activation
 */
chrome.runtime.onStartup.addListener(() => {
  initialize();
});

/**
 * Handle service worker installation
 */
chrome.runtime.onInstalled.addListener(() => {
  initialize();
});

/**
 * Handle service worker shutdown
 */
chrome.runtime.onSuspend.addListener(async () => {
  console.log('Service worker shutting down');

  // Cleanup resources
  if (agent) {
    const session = agent.getSession();
    await session.close();
    await agent.cleanup();
  }

  if (router) {
    router.cleanup();
  }

  if (conversationStore) {
    await conversationStore.close();
  }

  if (cacheManager) {
    cacheManager.destroy();
  }

  if (storageQuotaManager) {
    storageQuotaManager.destroy();
  }

  // Reset initialization flag so it can be re-initialized if the service worker restarts
  isInitialized = false;
  initializationPromise = null;
});

// Initialize on script load
initialize();

// Export for testing
export { agent, router, initialize };
