/**
 * Chrome Extension Message Protocol Contract
 * Defines communication between extension components
 */

// Message Types

export enum MessageType {
  // DOM Operations
  DOM_ACTION = 'DOM_ACTION',
  DOM_RESPONSE = 'DOM_RESPONSE',

  // Content Script Management
  PING = 'PING',
  PONG = 'PONG',
  INJECT_SCRIPT = 'INJECT_SCRIPT',
  SCRIPT_READY = 'SCRIPT_READY',

  // Frame Communication
  FRAME_MESSAGE = 'FRAME_MESSAGE',
  BROADCAST_MESSAGE = 'BROADCAST_MESSAGE',

  // Lifecycle
  TAB_READY = 'TAB_READY',
  TAB_UNLOAD = 'TAB_UNLOAD',
  FRAME_NAVIGATED = 'FRAME_NAVIGATED'
}

// Base Message Structure

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
  source: MessageSource;
  requestId?: string;
}

export interface MessageSource {
  context: 'background' | 'content' | 'popup' | 'devtools';
  tabId?: number;
  frameId?: number;
  url?: string;
}

// DOM Operation Messages

export interface DOMActionMessage extends BaseMessage {
  type: MessageType.DOM_ACTION;
  action: string;
  data: any;
  options?: {
    timeout?: number;
    retries?: number;
  };
}

export interface DOMResponseMessage extends BaseMessage {
  type: MessageType.DOM_RESPONSE;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

// Content Script Messages

export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
}

export interface PongMessage extends BaseMessage {
  type: MessageType.PONG;
  version: string;
  capabilities: string[];
}

export interface InjectScriptMessage extends BaseMessage {
  type: MessageType.INJECT_SCRIPT;
  script: string;
  runAt: 'document_start' | 'document_end' | 'document_idle';
}

export interface ScriptReadyMessage extends BaseMessage {
  type: MessageType.SCRIPT_READY;
  scriptId: string;
}

// Frame Messages

export interface FrameMessage extends BaseMessage {
  type: MessageType.FRAME_MESSAGE;
  targetFrameId: string;
  payload: any;
}

export interface BroadcastMessage extends BaseMessage {
  type: MessageType.BROADCAST_MESSAGE;
  includeFrames: boolean;
  payload: any;
}

// Lifecycle Messages

export interface TabReadyMessage extends BaseMessage {
  type: MessageType.TAB_READY;
  url: string;
  title: string;
  readyState: 'loading' | 'interactive' | 'complete';
}

export interface TabUnloadMessage extends BaseMessage {
  type: MessageType.TAB_UNLOAD;
  reason: 'navigation' | 'close' | 'reload';
}

export interface FrameNavigatedMessage extends BaseMessage {
  type: MessageType.FRAME_NAVIGATED;
  frameId: string;
  url: string;
  parentFrameId?: string;
}

// Message Handlers

export interface MessageHandler<T extends BaseMessage = BaseMessage> {
  handle(message: T, sender: chrome.runtime.MessageSender): Promise<any> | any;
  canHandle(message: BaseMessage): boolean;
}

export interface MessageRouter {
  registerHandler(type: MessageType, handler: MessageHandler): void;
  unregisterHandler(type: MessageType): void;
  route(message: BaseMessage, sender: chrome.runtime.MessageSender): Promise<any>;
}

// Content Script Communication

export interface ContentScriptAPI {
  // Query operations
  querySelector(selector: string): Promise<any>;
  querySelectorAll(selector: string): Promise<any[]>;

  // Interaction operations
  click(selector: string, options?: any): Promise<boolean>;
  type(selector: string, text: string, options?: any): Promise<boolean>;
  focus(selector: string): Promise<boolean>;
  scroll(selector: string, options?: any): Promise<boolean>;

  // Attribute operations
  getAttribute(selector: string, attribute: string): Promise<string | null>;
  setAttribute(selector: string, attribute: string, value: string): Promise<boolean>;

  // Content operations
  getText(selector: string): Promise<string>;
  getHTML(selector: string, outer?: boolean): Promise<string>;

  // Utility operations
  waitForElement(selector: string, timeout?: number): Promise<boolean>;
  isVisible(selector: string): Promise<boolean>;
  isEnabled(selector: string): Promise<boolean>;
}

// Background Script API

export interface BackgroundScriptAPI {
  sendToTab(tabId: number, message: BaseMessage): Promise<any>;
  sendToFrame(tabId: number, frameId: number, message: BaseMessage): Promise<any>;
  broadcast(message: BaseMessage, filter?: (tab: chrome.tabs.Tab) => boolean): Promise<void>;
  executeScript(tabId: number, script: string, frameId?: number): Promise<any>;
  injectContentScript(tabId: number): Promise<void>;
}

// Error Types

export interface MessageError {
  code: MessageErrorCode;
  message: string;
  originalError?: Error;
}

export enum MessageErrorCode {
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  HANDLER_NOT_FOUND = 'HANDLER_NOT_FOUND',
  TAB_NOT_FOUND = 'TAB_NOT_FOUND',
  FRAME_NOT_FOUND = 'FRAME_NOT_FOUND',
  SCRIPT_INJECTION_FAILED = 'SCRIPT_INJECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

// Validation

export interface MessageValidator {
  validate(message: any): message is BaseMessage;
  validateResponse(response: any): boolean;
}

// Serialization

export interface MessageSerializer {
  serialize(message: BaseMessage): string;
  deserialize(data: string): BaseMessage;
}

// Constants

export const MESSAGE_PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_TIMEOUT = 5000;
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 100;