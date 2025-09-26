/**
 * DOM Operations API Contract
 * TypeScript interfaces defining the contract between DOMTool and DOM Service
 */

// Request/Response Types

export interface DOMOperationRequest {
  action: DOMAction;
  tabId?: number;
  requestId: string;
  timeout?: number;
}

export interface DOMOperationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: DOMError;
  requestId: string;
  duration: number;
}

// Action Types

export enum DOMAction {
  // Query Operations
  QUERY = 'query',
  FIND_BY_XPATH = 'findByXPath',

  // Interaction Operations
  CLICK = 'click',
  TYPE = 'type',
  FOCUS = 'focus',
  SCROLL = 'scroll',
  HOVER = 'hover',

  // Attribute Operations
  GET_ATTRIBUTE = 'getAttribute',
  SET_ATTRIBUTE = 'setAttribute',
  GET_PROPERTY = 'getProperty',
  SET_PROPERTY = 'setProperty',

  // Content Operations
  GET_TEXT = 'getText',
  GET_HTML = 'getHtml',
  EXTRACT_LINKS = 'extractLinks',

  // Form Operations
  FILL_FORM = 'fillForm',
  SUBMIT_FORM = 'submitForm',

  // Advanced Operations
  CAPTURE_SNAPSHOT = 'captureSnapshot',
  GET_ACCESSIBILITY_TREE = 'getAccessibilityTree',
  GET_PAINT_ORDER = 'getPaintOrder',
  DETECT_CLICKABLE = 'detectClickable',

  // Utility Operations
  WAIT_FOR_ELEMENT = 'waitForElement',
  CHECK_VISIBILITY = 'checkVisibility',
  EXECUTE_SEQUENCE = 'executeSequence'
}

// Operation-specific Requests

export interface QueryRequest extends DOMOperationRequest {
  action: DOMAction.QUERY;
  selector: string;
  options?: {
    multiple?: boolean;
    frameSelector?: string;
    includeHidden?: boolean;
  };
}

export interface ClickRequest extends DOMOperationRequest {
  action: DOMAction.CLICK;
  selector: string;
  options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    force?: boolean;
    scrollIntoView?: boolean;
    offsetX?: number;
    offsetY?: number;
  };
}

export interface TypeRequest extends DOMOperationRequest {
  action: DOMAction.TYPE;
  selector: string;
  text: string;
  options?: {
    clear?: boolean;
    delay?: number;
    pressEnter?: boolean;
  };
}

export interface GetAttributeRequest extends DOMOperationRequest {
  action: DOMAction.GET_ATTRIBUTE;
  selector: string;
  attribute: string;
}

export interface SetAttributeRequest extends DOMOperationRequest {
  action: DOMAction.SET_ATTRIBUTE;
  selector: string;
  attribute: string;
  value: string;
}

export interface FillFormRequest extends DOMOperationRequest {
  action: DOMAction.FILL_FORM;
  formData: Record<string, string>;
  formSelector?: string;
}

export interface WaitForElementRequest extends DOMOperationRequest {
  action: DOMAction.WAIT_FOR_ELEMENT;
  selector: string;
  options?: {
    timeout?: number;
    waitFor?: 'visible' | 'hidden' | 'present' | 'absent';
    pollInterval?: number;
  };
}

export interface ExecuteSequenceRequest extends DOMOperationRequest {
  action: DOMAction.EXECUTE_SEQUENCE;
  sequence: Array<Omit<DOMOperationRequest, 'requestId'>>;
}

// Operation-specific Responses

export interface QueryResponse {
  elements: DOMElementInfo[];
  count: number;
}

export interface ClickResponse {
  clicked: boolean;
  element: DOMElementInfo;
}

export interface TypeResponse {
  typed: boolean;
  element: DOMElementInfo;
  finalValue: string;
}

export interface AttributeResponse {
  value: string | null;
  element: DOMElementInfo;
}

export interface FormResponse {
  filled: boolean;
  fieldsSet: number;
  errors: Array<{ field: string; error: string }>;
}

export interface SnapshotResponse {
  snapshot: DOMSnapshot;
  documentCount: number;
  nodeCount: number;
}

export interface AccessibilityResponse {
  tree: AccessibilityNode[];
  nodeCount: number;
}

// Shared Types

export interface DOMElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  boundingBox?: BoundingBox;
  visible: boolean;
  enabled: boolean;
}

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

export interface DOMError {
  code: ErrorCode;
  message: string;
  selector?: string;
  action?: string;
  details?: any;
}

export enum ErrorCode {
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_INTERACTABLE = 'ELEMENT_NOT_INTERACTABLE',
  TIMEOUT = 'TIMEOUT',
  INVALID_SELECTOR = 'INVALID_SELECTOR',
  CROSS_ORIGIN_FRAME = 'CROSS_ORIGIN_FRAME',
  SCRIPT_INJECTION_FAILED = 'SCRIPT_INJECTION_FAILED',
  INVALID_ACTION = 'INVALID_ACTION',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export interface DOMSnapshot {
  documents: DocumentSnapshot[];
  timestamp: number;
  url: string;
  title: string;
}

export interface DocumentSnapshot {
  url: string;
  nodes: any[]; // Simplified for contract
  frameId?: string;
}

export interface AccessibilityNode {
  nodeId: string;
  role?: string;
  name?: string;
  value?: any;
  children?: AccessibilityNode[];
}