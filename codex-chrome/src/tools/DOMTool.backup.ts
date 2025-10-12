/**
 * DOM Tool
 *
 * Provides DOM manipulation capabilities through DomService integration.
 * Handles element querying, clicking, typing, attribute manipulation, and text extraction.
 * Integrates with the new DomService architecture while maintaining backward compatibility.
 */

import { BaseTool, createToolDefinition, type BaseToolRequest, type BaseToolOptions, type ToolDefinition } from './BaseTool';
import { DomService } from './dom/service';
import { MessageType } from '../core/MessageRouter';
import {
  DOMOperationRequest,
  DOMOperationResponse,
  DOMAction,
  QueryRequest,
  ClickRequest,
  TypeRequest,
  GetAttributeRequest,
  SetAttributeRequest,
  FillFormRequest,
  WaitForElementRequest,
  ExecuteSequenceRequest,
  DOMElementInfo,
  BoundingBox as ContractBoundingBox,
  ErrorCode,
  DOMError
} from '../../../specs/001-dom-tool-integration/contracts/dom-operations';
import {
  findElements,
  clickElement as contentClickElement,
  typeIntoElement,
  getElementText,
  waitForElement,
  getComputedStylesForElement,
  scrollIntoView,
  getViewportInfo
} from './dom/chrome/contentScript';

// Content script file path - MUST match manifest.json content_scripts.js reference
// Vite builds src/content/content-script.ts → dist/content.js (uses input key name)
// See specs/018-inspect-the-domtool/contracts/file-paths.md for contract details
const CONTENT_SCRIPT_PATH = '/content.js';

/**
 * DOM tool request interface - Extended to support all 25 operations
 */
export interface DOMToolRequest extends BaseToolRequest {
  action: 'query' | 'click' | 'type' | 'getAttribute' | 'setAttribute' | 'getText' | 'getHtml' | 'submit' | 'focus' | 'scroll' |
          'findByXPath' | 'hover' | 'getProperty' | 'setProperty' | 'extractLinks' | 'fillForm' | 'submitForm' |
          'captureSnapshot' | 'getAccessibilityTree' | 'getPaintOrder' | 'detectClickable' | 'waitForElement' |
          'checkVisibility' | 'executeSequence';
  tabId?: number;
  selector?: string;
  text?: string;
  attribute?: string;
  property?: string;
  value?: string;
  xpath?: string;
  formData?: Record<string, string>;
  formSelector?: string;
  sequence?: Array<Omit<DOMToolRequest, 'tabId' | 'sequence'>>;
  options?: DOMActionOptions;
}

/**
 * DOM action options - Extended for new operations
 */
export interface DOMActionOptions {
  waitFor?: number | 'visible' | 'hidden' | 'present' | 'absent';
  scrollIntoView?: boolean;
  force?: boolean;
  timeout?: number;
  delay?: number;
  clear?: boolean;
  multiple?: boolean;
  frameSelector?: string;
  includeHidden?: boolean;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  offsetX?: number;
  offsetY?: number;
  pressEnter?: boolean;
  pollInterval?: number;
}

/**
 * DOM element information - Extended with new contract compatibility
 */
export interface DOMElement {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  innerHTML?: string;
  outerHTML?: string;
  attributes: Record<string, string>;
  boundingBox?: BoundingBox;
  visible?: boolean;
  enabled?: boolean;
  focused?: boolean;
}

/**
 * Element bounding box
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/**
 * DOM tool response data - Extended for new operations
 */
export interface DOMToolResponse {
  elements?: DOMElement[];
  element?: DOMElement;
  text?: string;
  html?: string;
  attribute?: string;
  property?: string;
  success?: boolean;
  count?: number;
  links?: Array<{ text: string; href: string; title?: string }>;
  fieldsSet?: number;
  errors?: Array<{ field: string; error: string }>;
  snapshot?: any;
  accessibilityTree?: any[];
  paintOrder?: any[];
  clickableElements?: any[];
  sequence?: DOMToolResponse[];
  finalValue?: string;
  clicked?: boolean;
  typed?: boolean;
  filled?: boolean;
  visible?: boolean;
}

/**
 * Content script message
 */
interface ContentScriptMessage {
  type: MessageType.DOM_ACTION;
  action: string;
  data: any;
  requestId: string;
}

/**
 * Content script response
 */
interface ContentScriptResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId: string;
}

/**
 * DOM Tool Implementation
 *
 * Communicates with content scripts to perform DOM operations.
 */
export class DOMTool extends BaseTool {
  protected toolDefinition: ToolDefinition = createToolDefinition(
    'browser_dom',
    'Interact with DOM elements - comprehensive DOM operations including query, interaction, content extraction, and advanced features',
    {
      action: {
        type: 'string',
        description: 'The DOM action to perform',
        enum: [
          'query', 'click', 'type', 'getAttribute', 'setAttribute', 'getText', 'getHtml', 'submit', 'focus', 'scroll',
          'findByXPath', 'hover', 'getProperty', 'setProperty', 'extractLinks', 'fillForm', 'submitForm',
          'captureSnapshot', 'getAccessibilityTree', 'getPaintOrder', 'detectClickable', 'waitForElement',
          'checkVisibility', 'executeSequence'
        ],
      },
      tabId: {
        type: 'number',
        description: 'Tab ID to perform action on (uses active tab if not specified)',
      },
      selector: {
        type: 'string',
        description: 'CSS selector to target elements',
      },
      text: {
        type: 'string',
        description: 'Text to type or search for',
      },
      attribute: {
        type: 'string',
        description: 'Attribute name for get/set operations',
      },
      property: {
        type: 'string',
        description: 'Property name for get/set operations',
      },
      value: {
        type: 'string',
        description: 'Value to set for attributes, properties, or form fields',
      },
      xpath: {
        type: 'string',
        description: 'XPath expression for element selection',
      },
      formData: {
        type: 'object',
        description: 'Key-value pairs for form filling',
      },
      formSelector: {
        type: 'string',
        description: 'CSS selector for the form to fill',
      },
      sequence: {
        type: 'array',
        description: 'Array of DOM operations to execute in sequence',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'DOM action to perform' },
            selector: { type: 'string', description: 'CSS selector' },
            text: { type: 'string', description: 'Text input' },
            attribute: { type: 'string', description: 'Attribute name' },
            property: { type: 'string', description: 'Property name' },
            value: { type: 'string', description: 'Value to set' },
            xpath: { type: 'string', description: 'XPath expression' },
            formData: { type: 'object', description: 'Form data' },
            formSelector: { type: 'string', description: 'Form selector' },
            options: { type: 'object', description: 'Operation options' }
          }
        }
      },
      options: {
        type: 'object',
        description: 'Additional options for DOM actions',
        properties: {
          waitFor: { type: 'number', description: 'Time to wait before action (ms)', default: 0 },
          scrollIntoView: { type: 'boolean', description: 'Scroll element into view', default: false },
          force: { type: 'boolean', description: 'Force action even if element not visible', default: false },
          timeout: { type: 'number', description: 'Timeout for action (ms)', default: 5000 },
          delay: { type: 'number', description: 'Delay between keystrokes for typing (ms)', default: 0 },
          clear: { type: 'boolean', description: 'Clear field before typing', default: false },
          multiple: { type: 'boolean', description: 'Return multiple elements for query', default: false },
          frameSelector: { type: 'string', description: 'CSS selector for iframe to target' },
          includeHidden: { type: 'boolean', description: 'Include hidden elements in results', default: false },
          button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button for click', default: 'left' },
          clickCount: { type: 'number', description: 'Number of clicks to perform', default: 1 },
          offsetX: { type: 'number', description: 'X offset from element center for click' },
          offsetY: { type: 'number', description: 'Y offset from element center for click' },
          pressEnter: { type: 'boolean', description: 'Press Enter after typing', default: false },
          pollInterval: { type: 'number', description: 'Polling interval for wait operations', default: 100 },
        },
      },
    },
    {
      required: ['action'],
      category: 'dom',
      version: '2.0.0',
      metadata: {
        capabilities: [
          'dom_manipulation', 'element_interaction', 'text_extraction',
          'xpath_support', 'form_automation', 'accessibility_analysis',
          'snapshot_capture', 'paint_order_analysis', 'clickable_detection',
          'sequence_execution', 'advanced_waiting'
        ],
        permissions: ['activeTab', 'scripting'],
      },
    }
  );

  private domService: DomService;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();

  constructor() {
    super();
    this.domService = new DomService(
      { tab_id: undefined }, // Will be set per request
      {
        log: (msg: string) => this.log('info', msg),
        error: (msg: string) => this.log('error', msg),
        warn: (msg: string) => this.log('warn', msg)
      }
    );
    this.setupMessageListener();
  }

  /**
   * Execute DOM tool action
   */
  protected async executeImpl(request: DOMToolRequest, options?: BaseToolOptions): Promise<DOMToolResponse> {
    // Validate Chrome context
    this.validateChromeContext();

    // Validate required permissions
    await this.validatePermissions(['activeTab', 'scripting']);

    this.log('debug', `Executing DOM action: ${request.action}`, request);

    // Get target tab
    const targetTab = request.tabId ? await this.validateTabId(request.tabId) : await this.getActiveTab();

    // Ensure content script is injected
    await this.ensureContentScriptInjected(targetTab.id!);

    // Handle all 25 DOM operations through service delegation
    try {
      return await this.executeOperation(targetTab.id!, request);
    } catch (error) {
      // Convert service errors to user-friendly messages
      throw this.handleOperationError(error, request);
    }
  }

  /**
   * Execute DOM operation through service delegation
   */
  private async executeOperation(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    // Update service browser session
    this.domService = new DomService(
      { tab_id: tabId },
      {
        log: (msg: string) => this.log('info', msg),
        error: (msg: string) => this.log('error', msg),
        warn: (msg: string) => this.log('warn', msg)
      }
    );

    switch (request.action) {
      case 'query':
        return this.queryElements(tabId, request);
      case 'findByXPath':
        return this.findByXPath(tabId, request);
      case 'click':
        return this.clickElement(tabId, request);
      case 'hover':
        return this.hoverElement(tabId, request);
      case 'type':
        return this.typeText(tabId, request);
      case 'focus':
        return this.focusElement(tabId, request);
      case 'scroll':
        return this.scrollToElement(tabId, request);
      case 'getAttribute':
        return this.getAttribute(tabId, request);
      case 'setAttribute':
        return this.setAttribute(tabId, request);
      case 'getProperty':
        return this.getProperty(tabId, request);
      case 'setProperty':
        return this.setProperty(tabId, request);
      case 'getText':
        return this.getText(tabId, request);
      case 'getHtml':
        return this.getHtml(tabId, request);
      case 'extractLinks':
        return this.extractLinks(tabId, request);
      case 'fillForm':
        return this.fillForm(tabId, request);
      case 'submit':
      case 'submitForm':
        return this.submitForm(tabId, request);
      case 'captureSnapshot':
        return this.captureSnapshot(tabId, request);
      case 'getAccessibilityTree':
        return this.getAccessibilityTree(tabId, request);
      case 'getPaintOrder':
        return this.getPaintOrder(tabId, request);
      case 'detectClickable':
        return this.detectClickable(tabId, request);
      case 'waitForElement':
        return this.waitForElementOperation(tabId, request);
      case 'checkVisibility':
        return this.checkVisibility(tabId, request);
      case 'executeSequence':
        return this.executeSequenceOperation(tabId, request);
      default:
        throw this.createDOMError(ErrorCode.INVALID_ACTION, `Unsupported DOM action: ${request.action}`, request.action);
    }
  }

  /**
   * Query DOM elements
   */
  private async queryElements(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for query action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'query', {
      selector: request.selector,
      options: request.options,
    });

    return {
      elements: result.elements || [],
      count: result.elements?.length || 0,
      success: true
    };
  }

  /**
   * Find elements by XPath
   */
  private async findByXPath(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.xpath) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'XPath is required for findByXPath action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'findByXPath', {
      xpath: request.xpath,
      options: request.options,
    });

    return {
      elements: result.elements || [],
      count: result.elements?.length || 0,
      success: true
    };
  }

  /**
   * Click an element
   */
  private async clickElement(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for click action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'click', {
      selector: request.selector,
      options: request.options,
    });

    return {
      element: result.element,
      clicked: result.success,
      success: result.success,
    };
  }

  /**
   * Hover over an element
   */
  private async hoverElement(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for hover action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'hover', {
      selector: request.selector,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Type text into an element
   */
  private async typeText(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for type action');
    }

    if (!request.text) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Text is required for type action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'type', {
      selector: request.selector,
      text: request.text,
      options: request.options,
    });

    return {
      element: result.element,
      typed: result.success,
      finalValue: result.finalValue,
      success: result.success,
    };
  }

  /**
   * Get element attribute
   */
  private async getAttribute(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for getAttribute action');
    }

    if (!request.attribute) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Attribute name is required for getAttribute action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'getAttribute', {
      selector: request.selector,
      attribute: request.attribute,
      options: request.options,
    });

    return {
      attribute: result.value,
      element: result.element,
      success: true
    };
  }

  /**
   * Set element attribute
   */
  private async setAttribute(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for setAttribute action');
    }

    if (!request.attribute) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Attribute name is required for setAttribute action');
    }

    if (request.value === undefined) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Value is required for setAttribute action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'setAttribute', {
      selector: request.selector,
      attribute: request.attribute,
      value: request.value,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Get element property
   */
  private async getProperty(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for getProperty action');
    }

    if (!request.property) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Property name is required for getProperty action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'getProperty', {
      selector: request.selector,
      property: request.property,
      options: request.options,
    });

    return {
      property: result.value,
      element: result.element,
      success: true
    };
  }

  /**
   * Set element property
   */
  private async setProperty(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for setProperty action');
    }

    if (!request.property) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Property name is required for setProperty action');
    }

    if (request.value === undefined) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Value is required for setProperty action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'setProperty', {
      selector: request.selector,
      property: request.property,
      value: request.value,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Get element text content
   */
  private async getText(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for getText action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'getText', {
      selector: request.selector,
      options: request.options,
    });

    return {
      text: result.text,
      element: result.element,
      success: true
    };
  }

  /**
   * Get element HTML
   */
  private async getHtml(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for getHtml action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'getHtml', {
      selector: request.selector,
      options: request.options,
    });

    return {
      html: result.html,
      element: result.element,
      success: true
    };
  }

  /**
   * Extract all links from page
   */
  private async extractLinks(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    const result = await this.sendContentScriptMessage(tabId, 'extractLinks', {
      selector: request.selector || 'a[href]',
      options: request.options,
    });

    return {
      links: result.links || [],
      count: result.links?.length || 0,
      success: true
    };
  }

  /**
   * Fill form with data
   */
  private async fillForm(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.formData) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Form data is required for fillForm action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'fillForm', {
      formData: request.formData,
      formSelector: request.formSelector,
      options: request.options,
    });

    return {
      filled: result.success,
      fieldsSet: result.fieldsSet || 0,
      errors: result.errors || [],
      success: result.success,
    };
  }

  /**
   * Submit a form
   */
  private async submitForm(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for submit action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'submit', {
      selector: request.selector,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Focus an element
   */
  private async focusElement(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for focus action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'focus', {
      selector: request.selector,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Scroll to element
   */
  private async scrollToElement(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for scroll action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'scroll', {
      selector: request.selector,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Capture DOM snapshot
   */
  private async captureSnapshot(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    try {
      const serializedState = await this.domService.get_serialized_dom_tree();
      return {
        snapshot: serializedState,
        success: true
      };
    } catch (error) {
      throw this.createDOMError(ErrorCode.NETWORK_ERROR, `Failed to capture snapshot: ${error}`);
    }
  }

  /**
   * Get accessibility tree
   */
  private async getAccessibilityTree(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    const result = await this.sendContentScriptMessage(tabId, 'getAccessibilityTree', {
      options: request.options,
    });

    return {
      accessibilityTree: result.tree || [],
      count: result.tree?.length || 0,
      success: true
    };
  }

  /**
   * Get paint order elements
   */
  private async getPaintOrder(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    const result = await this.sendContentScriptMessage(tabId, 'getPaintOrder', {
      options: request.options,
    });

    return {
      paintOrder: result.order || [],
      count: result.order?.length || 0,
      success: true
    };
  }

  /**
   * Detect clickable elements
   */
  private async detectClickable(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    const result = await this.sendContentScriptMessage(tabId, 'detectClickable', {
      options: request.options,
    });

    return {
      clickableElements: result.clickable || [],
      count: result.clickable?.length || 0,
      success: true
    };
  }

  /**
   * Wait for element operation
   */
  private async waitForElementOperation(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for waitForElement action');
    }

    const timeout = request.options?.timeout || 5000;
    const waitFor = request.options?.waitFor || 'present';

    const result = await this.sendContentScriptMessage(tabId, 'waitForElement', {
      selector: request.selector,
      timeout,
      waitFor,
      options: request.options,
    });

    return {
      element: result.element,
      success: result.success,
    };
  }

  /**
   * Check element visibility
   */
  private async checkVisibility(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.selector) {
      throw this.createDOMError(ErrorCode.INVALID_SELECTOR, 'Selector is required for checkVisibility action');
    }

    const result = await this.sendContentScriptMessage(tabId, 'checkVisibility', {
      selector: request.selector,
      options: request.options,
    });

    return {
      visible: result.visible,
      element: result.element,
      success: true
    };
  }

  /**
   * Execute sequence of operations
   */
  private async executeSequenceOperation(tabId: number, request: DOMToolRequest): Promise<DOMToolResponse> {
    if (!request.sequence || !Array.isArray(request.sequence)) {
      throw this.createDOMError(ErrorCode.INVALID_ACTION, 'Sequence array is required for executeSequence action');
    }

    const results: DOMToolResponse[] = [];

    for (const operation of request.sequence) {
      try {
        const result = await this.executeOperation(tabId, { ...operation, tabId });
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          // Include error information in result
        });
        // Continue with remaining operations unless option specifies otherwise
        if (request.options?.force !== true) {
          break;
        }
      }
    }

    return {
      sequence: results,
      count: results.length,
      success: results.every(r => r.success)
    };
  }

  /**
   * Send message to content script
   */
  private async sendContentScriptMessage(tabId: number, action: string, data: any): Promise<any> {
    const requestId = this.generateRequestId();
    const message: ContentScriptMessage = {
      type: MessageType.DOM_ACTION,
      action,
      data,
      requestId,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      // Set timeout for the request
      const timeout = data.options?.timeout || 5000;
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`DOM action '${action}' timed out after ${timeout}ms`));
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);

        if (chrome.runtime.lastError) {
          reject(new Error(`Content script communication failed: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (!response) {
          reject(new Error('No response from content script'));
          return;
        }

        if (!response.success) {
          const error = this.createDOMError(
            this.mapErrorCodeFromMessage(response.error || 'DOM action failed'),
            response.error || 'DOM action failed',
            action
          );
          reject(error);
          return;
        }

        resolve(response.data);
      });
    });
  }

  /**
   * Ensure content script is injected into the tab with exponential backoff retry
   */
  private async ensureContentScriptInjected(tabId: number): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 100;

    // First, try to ping existing content script
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
        // MessageRouter wraps responses in { success: true, data: ... }
        const pongData = response?.success ? response.data : response;
        if (pongData && pongData.type === MessageType.PONG) {
          // Verify content script is sufficiently initialized
          if (pongData.initLevel && pongData.initLevel < 2) {
            this.log('warn', `Content script not fully ready (initLevel: ${pongData.initLevel}), retrying...`);
            // Treat as failure and retry
            throw new Error(`Content script initializing (initLevel: ${pongData.initLevel})`);
          }
          this.log('debug', `Content script ready in tab ${tabId} (initLevel: ${pongData.initLevel}, attempt ${attempt + 1})`);
          return; // Content script is loaded, responsive, and ready
        }
      } catch (error) {
        // Content script not responsive or not ready, continue to injection
        this.log('debug', `PING failed on attempt ${attempt + 1}: ${error}`);
      }

      // If first attempt failed, try injecting the script
      if (attempt === 0) {
        try {
          // IMPORTANT: File path must match manifest.json content_scripts.js reference
          // Vite builds src/content/content-script.ts → dist/content.js (uses input key name)
          // See specs/018-inspect-the-domtool/contracts/file-paths.md for contract
          await chrome.scripting.executeScript({
            target: { tabId },
            files: [CONTENT_SCRIPT_PATH],
          });
          this.log('info', `Content script injected into tab ${tabId}`);
          // Give content script time to initialize before first PING retry
          // Content script needs time to register message listener and handlers
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (injectionError) {
          // Injection failed, could be permissions issue
          throw this.createDOMError(
            ErrorCode.SCRIPT_INJECTION_FAILED,
            `Failed to inject content script: ${injectionError}`,
            undefined,
            { tabId, originalError: injectionError }
          );
        }
      }

      // Wait with exponential backoff before next retry
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // If we get here, all retries failed
    throw this.createDOMError(
      ErrorCode.TIMEOUT,
      `Content script failed to respond after ${maxRetries} attempts`,
      undefined,
      { tabId }
    );
  }

  /**
   * Setup message listener for content script responses
   */
  private setupMessageListener(): void {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message: ContentScriptResponse, sender, sendResponse) => {
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const pending = this.pendingRequests.get(message.requestId)!;
          this.pendingRequests.delete(message.requestId);

          if (message.success) {
            pending.resolve(message.data);
          } else {
            pending.reject(new Error(message.error || 'Content script action failed'));
          }
        }
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `dom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized DOM error
   */
  private createDOMError(code: ErrorCode, message: string, action?: string, details?: any): Error {
    const error = new Error(this.getErrorMessage(code, message));
    (error as any).domError = {
      code,
      message,
      action,
      details
    } as DOMError;
    return error;
  }

  /**
   * Handle operation error and convert to user-friendly message
   */
  private handleOperationError(error: any, request: DOMToolRequest): Error {
    if (error.domError) {
      // Already a DOM error, return as is
      return error;
    }

    // Map generic errors to appropriate error codes
    const message = error.message || String(error);
    let code = ErrorCode.NETWORK_ERROR;

    if (message.includes('timeout')) {
      code = ErrorCode.TIMEOUT;
    } else if (message.includes('not found') || message.includes('no such element')) {
      code = ErrorCode.ELEMENT_NOT_FOUND;
    } else if (message.includes('not visible') || message.includes('not displayed')) {
      code = ErrorCode.ELEMENT_NOT_VISIBLE;
    } else if (message.includes('not interactable') || message.includes('not clickable')) {
      code = ErrorCode.ELEMENT_NOT_INTERACTABLE;
    } else if (message.includes('invalid selector') || message.includes('selector')) {
      code = ErrorCode.INVALID_SELECTOR;
    } else if (message.includes('cross-origin') || message.includes('frame')) {
      code = ErrorCode.CROSS_ORIGIN_FRAME;
    }

    return this.createDOMError(code, message, request.action, { originalError: error });
  }

  /**
   * Map error code to user-friendly message
   */
  private getErrorMessage(code: ErrorCode, originalMessage: string): string {
    const errorMessages = {
      [ErrorCode.ELEMENT_NOT_FOUND]: 'Element not found on the page',
      [ErrorCode.ELEMENT_NOT_VISIBLE]: 'Element is not visible or hidden',
      [ErrorCode.ELEMENT_NOT_INTERACTABLE]: 'Element cannot be interacted with',
      [ErrorCode.TIMEOUT]: 'Operation timed out',
      [ErrorCode.INVALID_SELECTOR]: 'Invalid CSS selector or XPath expression',
      [ErrorCode.CROSS_ORIGIN_FRAME]: 'Cannot access cross-origin frame',
      [ErrorCode.SCRIPT_INJECTION_FAILED]: 'Failed to inject content script',
      [ErrorCode.INVALID_ACTION]: 'Invalid action or missing parameters',
      [ErrorCode.NETWORK_ERROR]: 'Network or communication error'
    };

    const friendlyMessage = errorMessages[code];
    return friendlyMessage ? `${friendlyMessage}: ${originalMessage}` : originalMessage;
  }

  /**
   * Map error message to error code
   */
  private mapErrorCodeFromMessage(message: string): ErrorCode {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('not found') || lowerMessage.includes('no such element')) {
      return ErrorCode.ELEMENT_NOT_FOUND;
    }
    if (lowerMessage.includes('not visible') || lowerMessage.includes('hidden')) {
      return ErrorCode.ELEMENT_NOT_VISIBLE;
    }
    if (lowerMessage.includes('not interactable') || lowerMessage.includes('not clickable')) {
      return ErrorCode.ELEMENT_NOT_INTERACTABLE;
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return ErrorCode.TIMEOUT;
    }
    if (lowerMessage.includes('invalid selector') || lowerMessage.includes('selector')) {
      return ErrorCode.INVALID_SELECTOR;
    }
    if (lowerMessage.includes('cross-origin') || lowerMessage.includes('frame')) {
      return ErrorCode.CROSS_ORIGIN_FRAME;
    }
    if (lowerMessage.includes('script') || lowerMessage.includes('inject')) {
      return ErrorCode.SCRIPT_INJECTION_FAILED;
    }
    if (lowerMessage.includes('invalid') || lowerMessage.includes('parameter')) {
      return ErrorCode.INVALID_ACTION;
    }

    return ErrorCode.NETWORK_ERROR;
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(tabId: number, selector: string, timeout: number = 5000): Promise<DOMElement | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.sendContentScriptMessage(tabId, 'query', {
          selector,
          options: { multiple: false },
        });

        if (result.elements && result.elements.length > 0) {
          return result.elements[0];
        }
      } catch (error) {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(tabId: number, selector: string, timeout: number = 5000): Promise<DOMElement | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.sendContentScriptMessage(tabId, 'query', {
          selector,
          options: { multiple: false },
        });

        if (result.elements && result.elements.length > 0 && result.elements[0].visible) {
          return result.elements[0];
        }
      } catch (error) {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * Extract all text from page
   */
  async extractPageText(tabId: number): Promise<string> {
    const result = await this.executeOperation(tabId, {
      action: 'getText',
      selector: 'body',
      tabId
    });
    return result.text || '';
  }
}