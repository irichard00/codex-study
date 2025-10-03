/**
 * Browser Adaptations Contract
 *
 * Defines browser-specific interfaces that replace Rust dependencies:
 * - fetch() replaces reqwest::Client
 * - ReadableStream replaces tokio::sync::mpsc
 * - chrome.storage replaces file-based config
 *
 * @contract-version 1.0.0
 * @rust-equivalents reqwest, tokio, std::fs
 */

// ============================================================================
// HTTP Client Adaptation: fetch() replaces reqwest::Client
// ============================================================================

/**
 * Browser fetch API wrapper for HTTP requests
 *
 * Replaces Rust reqwest::Client with browser-native fetch API.
 *
 * @rust-equivalent reqwest::Client
 * @browser-api fetch()
 */
export interface BrowserHttpClient {
  /**
   * Make HTTP request with streaming response
   *
   * @param url - Request URL
   * @param options - Request options (method, headers, body)
   * @returns Promise resolving to Response with streaming body
   *
   * @rust-equivalent reqwest::Client::request().send()
   */
  fetch(url: string, options: RequestOptions): Promise<StreamingResponse>;
}

/**
 * HTTP request options
 *
 * @rust-equivalent reqwest::RequestBuilder
 */
export interface RequestOptions {
  /** HTTP method (GET, POST, etc.) */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /** Request headers */
  headers?: Record<string, string>;

  /** Request body (for POST/PUT/PATCH) */
  body?: string | Uint8Array;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP response with streaming body
 *
 * @rust-equivalent reqwest::Response
 */
export interface StreamingResponse {
  /** HTTP status code */
  status: number;

  /** Status text (e.g., "OK", "Not Found") */
  statusText: string;

  /** Response headers */
  headers: Headers;

  /** Whether response was successful (2xx) */
  ok: boolean;

  /** Streaming response body */
  body: ReadableStream<Uint8Array> | null;

  /**
   * Get response body as text (non-streaming)
   *
   * @rust-equivalent reqwest::Response::text()
   */
  text(): Promise<string>;

  /**
   * Get response body as JSON (non-streaming)
   *
   * @rust-equivalent reqwest::Response::json()
   */
  json(): Promise<unknown>;
}

/**
 * Browser-native fetch wrapper implementation
 */
export class FetchHttpClient implements BrowserHttpClient {
  async fetch(url: string, options: RequestOptions): Promise<StreamingResponse> {
    const controller = new AbortController();
    const timeoutId =
      options.timeout !== undefined
        ? setTimeout(() => controller.abort(), options.timeout)
        : undefined;

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
        body: response.body,
        text: () => response.text(),
        json: () => response.json(),
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}

// ============================================================================
// Streaming Adaptation: ReadableStream replaces tokio::mpsc
// ============================================================================

/**
 * SSE stream reader interface
 *
 * Replaces Rust tokio::sync::mpsc::Receiver<Result<ResponseEvent>>
 * with browser ReadableStream API.
 *
 * @rust-equivalent tokio::sync::mpsc::Receiver
 * @browser-api ReadableStream
 */
export interface SSEStreamReader {
  /**
   * Read next chunk from stream
   *
   * @returns Chunk data and done flag
   *
   * @rust-equivalent tokio::sync::mpsc::Receiver::recv()
   */
  read(): Promise<ReadableStreamReadResult<Uint8Array>>;

  /**
   * Cancel stream and release resources
   *
   * @rust-equivalent dropping the receiver
   */
  cancel(): Promise<void>;

  /**
   * Release lock on stream (allows re-locking)
   */
  releaseLock(): void;
}

/**
 * ReadableStream read result
 */
export interface ReadableStreamReadResult<T> {
  /** Whether stream has ended */
  done: boolean;

  /** Chunk value (undefined if done) */
  value?: T;
}

/**
 * Wrapper for browser ReadableStream
 */
export class BrowserSSEStreamReader implements SSEStreamReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async read(): Promise<ReadableStreamReadResult<Uint8Array>> {
    return this.reader.read();
  }

  async cancel(): Promise<void> {
    return this.reader.cancel();
  }

  releaseLock(): void {
    this.reader.releaseLock();
  }
}

// ============================================================================
// Timeout Adaptation: Promise.race() replaces tokio::time::timeout()
// ============================================================================

/**
 * Timeout wrapper for promises
 *
 * Replaces Rust tokio::time::timeout() with Promise.race().
 *
 * @rust-equivalent tokio::time::timeout()
 */
export class TimeoutController {
  /**
   * Wrap promise with timeout
   *
   * @param promise - Promise to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @param errorMessage - Error message on timeout
   * @returns Promise that rejects on timeout
   *
   * @rust-equivalent tokio::time::timeout(duration, future)
   */
  static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = 'Operation timed out'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Create idle timeout for stream reading
   *
   * Resets timeout on each successful read.
   *
   * @param reader - Stream reader
   * @param idleTimeoutMs - Idle timeout in milliseconds
   * @returns Async generator with timeout protection
   *
   * @rust-equivalent tokio::time::timeout() in stream loop
   */
  static async *withIdleTimeout<T>(
    reader: AsyncGenerator<T>,
    idleTimeoutMs: number
  ): AsyncGenerator<T> {
    for await (const value of reader) {
      const result = await TimeoutController.withTimeout(
        Promise.resolve(value),
        idleTimeoutMs,
        `Idle timeout: no data received for ${idleTimeoutMs}ms`
      );
      yield result;
    }
  }
}

// ============================================================================
// Storage Adaptation: chrome.storage replaces std::fs
// ============================================================================

/**
 * Configuration storage interface
 *
 * Replaces Rust file-based config (std::fs) with chrome.storage API.
 *
 * @rust-equivalent std::fs::read_to_string() / std::fs::write()
 * @browser-api chrome.storage.local
 */
export interface ConfigStorage {
  /**
   * Get configuration value
   *
   * @param key - Configuration key
   * @returns Configuration value or undefined
   *
   * @rust-equivalent Config::load()
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Set configuration value
   *
   * @param key - Configuration key
   * @param value - Configuration value
   *
   * @rust-equivalent Config::save()
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Delete configuration value
   *
   * @param key - Configuration key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all configuration
   */
  clear(): Promise<void>;
}

/**
 * Chrome storage API wrapper
 */
export class ChromeConfigStorage implements ConfigStorage {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async delete(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }
}

// ============================================================================
// Auth Token Storage: chrome.storage replaces AuthManager file storage
// ============================================================================

/**
 * Auth token storage interface
 *
 * Replaces Rust AuthManager file-based token storage.
 *
 * @rust-equivalent AuthManager token storage
 * @browser-api chrome.storage.local
 */
export interface AuthTokenStorage {
  /**
   * Get stored access token
   *
   * @returns Access token or undefined
   *
   * @rust-equivalent AuthManager::auth()
   */
  getAccessToken(): Promise<string | undefined>;

  /**
   * Store access token
   *
   * @param token - Access token
   * @param expiresAt - Token expiration timestamp
   */
  setAccessToken(token: string, expiresAt?: Date): Promise<void>;

  /**
   * Clear stored token
   */
  clearAccessToken(): Promise<void>;

  /**
   * Check if token is expired
   */
  isTokenExpired(): Promise<boolean>;
}

/**
 * Chrome storage-based auth token storage
 */
export class ChromeAuthTokenStorage implements AuthTokenStorage {
  private static readonly TOKEN_KEY = 'codex_access_token';
  private static readonly EXPIRY_KEY = 'codex_token_expiry';

  async getAccessToken(): Promise<string | undefined> {
    const token = await chrome.storage.local.get(
      ChromeAuthTokenStorage.TOKEN_KEY
    );
    return token[ChromeAuthTokenStorage.TOKEN_KEY] as string | undefined;
  }

  async setAccessToken(token: string, expiresAt?: Date): Promise<void> {
    await chrome.storage.local.set({
      [ChromeAuthTokenStorage.TOKEN_KEY]: token,
      [ChromeAuthTokenStorage.EXPIRY_KEY]: expiresAt?.getTime(),
    });
  }

  async clearAccessToken(): Promise<void> {
    await chrome.storage.local.remove([
      ChromeAuthTokenStorage.TOKEN_KEY,
      ChromeAuthTokenStorage.EXPIRY_KEY,
    ]);
  }

  async isTokenExpired(): Promise<boolean> {
    const result = await chrome.storage.local.get(
      ChromeAuthTokenStorage.EXPIRY_KEY
    );
    const expiryTime = result[ChromeAuthTokenStorage.EXPIRY_KEY] as
      | number
      | undefined;

    if (expiryTime === undefined) {
      return false; // No expiry set
    }

    return Date.now() >= expiryTime;
  }
}

// ============================================================================
// Telemetry Adaptation: console.* replaces OtelEventManager
// ============================================================================

/**
 * Telemetry interface
 *
 * Replaces Rust OtelEventManager with browser console logging.
 *
 * @rust-equivalent OtelEventManager
 * @browser-api console.*
 */
export interface TelemetryManager {
  /**
   * Log request attempt
   *
   * @param attempt - Attempt number
   * @param method - HTTP method
   * @param url - Request URL
   *
   * @rust-equivalent OtelEventManager::log_request()
   */
  logRequest(attempt: number, method: string, url: string): void;

  /**
   * Log SSE event received
   *
   * @param eventType - SSE event type
   *
   * @rust-equivalent OtelEventManager::log_sse_event()
   */
  logSSEEvent(eventType: string): void;

  /**
   * Log error
   *
   * @param error - Error object
   * @param context - Additional context
   *
   * @rust-equivalent OtelEventManager::log_error()
   */
  logError(error: Error, context?: Record<string, unknown>): void;
}

/**
 * Console-based telemetry implementation
 */
export class ConsoleTelemetryManager implements TelemetryManager {
  private readonly prefix = '[ModelClient]';

  logRequest(attempt: number, method: string, url: string): void {
    console.log(`${this.prefix} Request attempt ${attempt}: ${method} ${url}`);
  }

  logSSEEvent(eventType: string): void {
    console.debug(`${this.prefix} SSE event: ${eventType}`);
  }

  logError(error: Error, context?: Record<string, unknown>): void {
    console.error(`${this.prefix} Error:`, error.message, context);
  }
}

/**
 * No-op telemetry implementation (for production)
 */
export class NoOpTelemetryManager implements TelemetryManager {
  logRequest(): void {}
  logSSEEvent(): void {}
  logError(): void {}
}

// ============================================================================
// Type Aliases for Rust Equivalence
// ============================================================================

/**
 * Type alias for HTTP client (browser fetch)
 *
 * @rust-equivalent reqwest::Client
 */
export type HttpClient = BrowserHttpClient;

/**
 * Type alias for stream reader
 *
 * @rust-equivalent tokio::sync::mpsc::Receiver<Result<T>>
 */
export type StreamReader<T> = AsyncGenerator<T, void, unknown>;

/**
 * Type alias for telemetry manager
 *
 * @rust-equivalent OtelEventManager
 */
export type OtelEventManager = TelemetryManager;

// ============================================================================
// Contract Validation
// ============================================================================

/**
 * Validate browser adaptations are available
 *
 * @throws {Error} If required browser APIs are missing
 */
export function validateBrowserAPIs(): void {
  const required = [
    { name: 'fetch', api: typeof fetch !== 'undefined' },
    { name: 'ReadableStream', api: typeof ReadableStream !== 'undefined' },
    { name: 'chrome.storage', api: typeof chrome?.storage !== 'undefined' },
  ];

  const missing = required.filter((r) => !r.api).map((r) => r.name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required browser APIs: ${missing.join(', ')}. ` +
        'This code must run in a Chrome extension context.'
    );
  }
}

/**
 * Create default browser adapters
 */
export function createBrowserAdapters(): {
  httpClient: HttpClient;
  storage: ConfigStorage;
  authStorage: AuthTokenStorage;
  telemetry: TelemetryManager;
} {
  validateBrowserAPIs();

  return {
    httpClient: new FetchHttpClient(),
    storage: new ChromeConfigStorage(),
    authStorage: new ChromeAuthTokenStorage(),
    telemetry:
      process.env.NODE_ENV === 'development'
        ? new ConsoleTelemetryManager()
        : new NoOpTelemetryManager(),
  };
}
