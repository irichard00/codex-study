/**
 * Message Type Contracts for DOMTool Content Script Communication
 *
 * Defines the message structure exchanged between DOMTool (background)
 * and content-script (page context).
 *
 * Feature: 017-fix-domtool-content-script-communication
 * Date: 2025-10-09
 */

/**
 * Message types for extension communication
 */
export enum MessageType {
  // Health check messages
  PING = 'PING',
  PONG = 'PONG',

  // DOM operation messages
  DOM_ACTION = 'DOM_ACTION',       // Background → Content Script
  DOM_RESPONSE = 'DOM_RESPONSE',   // Content Script → Background

  // Legacy support (to be deprecated)
  TOOL_EXECUTE = 'TOOL_EXECUTE',   // Old message type
  TOOL_RESULT = 'TOOL_RESULT',     // Old response type

  // Tab management
  TAB_COMMAND = 'TAB_COMMAND',
  TAB_RESULT = 'TAB_RESULT',
}

/**
 * Supported DOM operations (25 total)
 */
export type DOMActionType =
  // Element query operations
  | 'query'
  | 'findByXPath'

  // Element interaction operations
  | 'click'
  | 'hover'
  | 'type'
  | 'focus'
  | 'scroll'

  // Attribute operations
  | 'getAttribute'
  | 'setAttribute'
  | 'getProperty'
  | 'setProperty'

  // Content operations
  | 'getText'
  | 'getHtml'
  | 'extractLinks'

  // Form operations
  | 'fillForm'
  | 'submit'
  | 'submitForm'

  // Advanced operations
  | 'captureSnapshot'
  | 'getAccessibilityTree'
  | 'getPaintOrder'
  | 'detectClickable'
  | 'waitForElement'
  | 'checkVisibility'
  | 'executeSequence';

/**
 * Message source context
 */
export interface MessageSource {
  context: 'background' | 'content' | 'sidepanel';
  tabId?: number;
  frameId?: number;
}

/**
 * DOM Action Options
 */
export interface DOMActionOptions {
  // Timing options
  waitFor?: number | 'visible' | 'hidden' | 'present' | 'absent';
  timeout?: number;
  delay?: number;
  pollInterval?: number;

  // Behavior options
  scrollIntoView?: boolean;
  force?: boolean;
  clear?: boolean;

  // Query options
  multiple?: boolean;
  includeHidden?: boolean;

  // Click options
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  offsetX?: number;
  offsetY?: number;

  // Type options
  pressEnter?: boolean;

  // Frame options
  frameSelector?: string;
}

/**
 * DOM Operation Request
 *
 * Message sent from DOMTool to content script
 */
export interface DOMOperationRequest {
  // Message metadata
  type: MessageType.DOM_ACTION;
  requestId: string;
  timestamp: number;
  source: MessageSource;

  // Operation details
  action: DOMActionType;

  // Operation parameters (conditional based on action)
  selector?: string;
  xpath?: string;
  text?: string;
  attribute?: string;
  property?: string;
  value?: string;
  formData?: Record<string, string>;
  formSelector?: string;
  sequence?: Omit<DOMOperationRequest, 'type' | 'requestId' | 'timestamp' | 'source'>[];

  // Options
  options?: DOMActionOptions;
}

/**
 * DOM Operation Response
 *
 * Message returned from content script to DOMTool
 */
export interface DOMOperationResponse {
  // Message metadata
  type: MessageType.DOM_RESPONSE;
  requestId: string;
  timestamp: number;
  source: MessageSource;

  // Response status
  success: boolean;

  // Response data (if success = true)
  data?: {
    // Query results
    elements?: DOMElementInfo[];
    element?: DOMElementInfo;
    count?: number;

    // Content results
    text?: string;
    html?: string;
    attribute?: string;
    property?: any;

    // Action results
    clicked?: boolean;
    typed?: boolean;
    filled?: boolean;
    visible?: boolean;
    finalValue?: string;

    // Link extraction
    links?: Array<{ text: string; href: string; title?: string }>;

    // Form filling
    fieldsSet?: number;
    errors?: Array<{ field: string; error: string }>;

    // Advanced results
    snapshot?: any;
    accessibilityTree?: any[];
    paintOrder?: any[];
    clickableElements?: any[];

    // Sequence results
    sequence?: DOMOperationResponse[];
  };

  // Error details (if success = false)
  error?: OperationError;

  // Diagnostics
  initLevel?: InitializationLevel;
  executionTime?: number;
}

/**
 * PING Request
 */
export interface PingRequest {
  type: MessageType.PING;
  requestId: string;
  timestamp: number;
  source: MessageSource;
}

/**
 * PONG Response
 */
export interface PongResponse {
  type: MessageType.PONG;
  requestId: string;
  timestamp: number;
  source: MessageSource;

  // Content script state
  initLevel: InitializationLevel;
  readyState: DocumentReadyState;
  version: string;
  capabilities: string[];
}

/**
 * Content script initialization level
 */
export enum InitializationLevel {
  NOT_INJECTED = 0,
  INJECTED = 1,
  HANDLERS_READY = 2,
  DOM_READY = 3,
  FULLY_READY = 4,
}

/**
 * DOM Element Information
 */
export interface DOMElementInfo {
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
 * Operation error details
 */
export interface OperationError {
  type: ErrorCode;
  message: string;
  operation: DOMActionType;
  context?: ErrorContext;
  suggestedAction?: string;
}

/**
 * Error context information
 */
export interface ErrorContext {
  selector?: string;
  xpath?: string;
  elementState?: 'hidden' | 'obscured' | 'disabled' | 'removed';
  pageURL?: string;
  tabId?: number;
  frameId?: number;
  originalError?: string;
}

/**
 * Error codes for operation failures
 */
export enum ErrorCode {
  // Element errors
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_INTERACTABLE = 'ELEMENT_NOT_INTERACTABLE',

  // Communication errors
  TIMEOUT = 'TIMEOUT',
  CONTENT_SCRIPT_NOT_LOADED = 'CONTENT_SCRIPT_NOT_LOADED',
  SCRIPT_INJECTION_FAILED = 'SCRIPT_INJECTION_FAILED',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CROSS_ORIGIN_FRAME = 'CROSS_ORIGIN_FRAME',
  CSP_BLOCKED = 'CSP_BLOCKED',

  // Input errors
  INVALID_SELECTOR = 'INVALID_SELECTOR',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',

  // System errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTEXT_INVALIDATED = 'CONTEXT_INVALIDATED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Content script status tracking
 */
export enum ContentScriptStatus {
  IDLE = 'idle',
  INJECTING = 'injecting',
  READY = 'ready',
  FAILED = 'failed',
  DISCONNECTED = 'disconnected',
}

/**
 * Content script state (internal tracking)
 */
export interface ContentScriptState {
  tabId: number;
  status: ContentScriptStatus;
  initLevel: InitializationLevel;
  lastPingTime?: number;
  lastPongTime?: number;
  injectionTime?: number;
  errorCount: number;
  version?: string;
  capabilities?: string[];
}

/**
 * Type guards for message discrimination
 */
export function isDOMOperationRequest(message: any): message is DOMOperationRequest {
  return message?.type === MessageType.DOM_ACTION && typeof message?.action === 'string';
}

export function isDOMOperationResponse(message: any): message is DOMOperationResponse {
  return message?.type === MessageType.DOM_RESPONSE && typeof message?.success === 'boolean';
}

export function isPingRequest(message: any): message is PingRequest {
  return message?.type === MessageType.PING;
}

export function isPongResponse(message: any): message is PongResponse {
  return message?.type === MessageType.PONG && typeof message?.initLevel === 'number';
}

/**
 * Operation requirements mapping
 */
export const OPERATION_REQUIREMENTS: Record<DOMActionType, InitializationLevel> = {
  // Basic query - need DOM ready
  'query': InitializationLevel.DOM_READY,
  'findByXPath': InitializationLevel.DOM_READY,

  // Basic interaction - need DOM ready
  'click': InitializationLevel.DOM_READY,
  'hover': InitializationLevel.DOM_READY,
  'type': InitializationLevel.DOM_READY,
  'focus': InitializationLevel.DOM_READY,
  'scroll': InitializationLevel.DOM_READY,

  // Attributes - need DOM ready
  'getAttribute': InitializationLevel.DOM_READY,
  'setAttribute': InitializationLevel.DOM_READY,
  'getProperty': InitializationLevel.DOM_READY,
  'setProperty': InitializationLevel.DOM_READY,

  // Content extraction - need DOM ready
  'getText': InitializationLevel.DOM_READY,
  'getHtml': InitializationLevel.DOM_READY,
  'extractLinks': InitializationLevel.DOM_READY,

  // Forms - need DOM ready
  'fillForm': InitializationLevel.DOM_READY,
  'submit': InitializationLevel.DOM_READY,
  'submitForm': InitializationLevel.DOM_READY,

  // Advanced - need fully ready
  'captureSnapshot': InitializationLevel.FULLY_READY,
  'getAccessibilityTree': InitializationLevel.FULLY_READY,
  'getPaintOrder': InitializationLevel.FULLY_READY,
  'detectClickable': InitializationLevel.FULLY_READY,

  // Waiting operations - need DOM ready
  'waitForElement': InitializationLevel.DOM_READY,
  'checkVisibility': InitializationLevel.DOM_READY,
  'executeSequence': InitializationLevel.DOM_READY,
};
