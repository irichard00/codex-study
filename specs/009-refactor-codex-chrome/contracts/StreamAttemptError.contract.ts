/**
 * StreamAttemptError Contract
 *
 * Error classification for retry logic in streaming requests.
 * Matches Rust StreamAttemptError enum for consistent retry behavior.
 *
 * @contract-version 1.0.0
 * @rust-reference codex-rs/core/src/client.rs:447-486
 */

/**
 * Error type discriminator
 *
 * MUST match Rust StreamAttemptError enum variants:
 * - RetryableHttpError: HTTP errors that should be retried (429, 401, 5xx)
 * - RetryableTransportError: Network/transport errors that should be retried
 * - Fatal: Non-retryable errors (4xx except 401/429, parse errors)
 *
 * @rust-reference codex-rs/core/src/client.rs:447-456
 */
export type StreamAttemptErrorType =
  | 'RetryableHttpError'
  | 'RetryableTransportError'
  | 'Fatal';

/**
 * StreamAttemptError class for retry logic
 *
 * Classifies errors into retryable vs fatal categories, calculates
 * backoff delays, and converts to final CodexError on exhaustion.
 *
 * @rust-reference codex-rs/core/src/client.rs:447-486
 */
export class StreamAttemptError extends Error {
  /** Error type discriminator */
  readonly type: StreamAttemptErrorType;

  /** HTTP status code (for RetryableHttpError) */
  readonly statusCode?: number;

  /** Retry-After header value in seconds (for RetryableHttpError) */
  readonly retryAfter?: number;

  /** Original error cause (for RetryableTransportError and Fatal) */
  readonly cause?: Error;

  /**
   * Create a StreamAttemptError
   *
   * @param type - Error type discriminator
   * @param options - Additional error details
   */
  constructor(
    type: StreamAttemptErrorType,
    options?: {
      statusCode?: number;
      retryAfter?: number;
      cause?: Error;
      message?: string;
    }
  ) {
    super(options?.message || `StreamAttemptError: ${type}`);
    this.name = 'StreamAttemptError';
    this.type = type;
    this.statusCode = options?.statusCode;
    this.retryAfter = options?.retryAfter;
    this.cause = options?.cause;

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StreamAttemptError);
    }
  }

  /**
   * Calculate backoff delay for this error and attempt number
   *
   * Uses server-provided Retry-After header if available, otherwise
   * applies exponential backoff with jitter: 2^attempt * 1000 + random(0-1000)
   *
   * @param attempt - Attempt number (0-indexed)
   * @returns Delay in milliseconds
   *
   * @rust-reference codex-rs/core/src/client.rs:458-471
   */
  delay(attempt: number): number {
    // Use server-provided retry-after if available
    if (this.type === 'RetryableHttpError' && this.retryAfter !== undefined) {
      return this.retryAfter * 1000; // Convert seconds to milliseconds
    }

    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  }

  /**
   * Convert to final CodexError for throwing
   *
   * Used when retry attempts exhausted or error is fatal.
   *
   * @returns CodexError instance
   *
   * @rust-reference codex-rs/core/src/client.rs:473-485
   */
  intoError(): CodexError {
    switch (this.type) {
      case 'RetryableHttpError':
        return new CodexError(
          'Http',
          `HTTP ${this.statusCode}: ${this.message}`,
          this.statusCode
        );
      case 'RetryableTransportError':
        return new CodexError('Transport', this.message, undefined, this.cause);
      case 'Fatal':
        return new CodexError('Fatal', this.message, undefined, this.cause);
    }
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.type !== 'Fatal';
  }

  /**
   * Factory: Create from HTTP response
   *
   * Classifies HTTP errors based on status code:
   * - 401: RetryableHttpError (trigger token refresh)
   * - 429: RetryableHttpError (rate limiting, parse Retry-After)
   * - 5xx: RetryableHttpError (server error)
   * - Other 4xx: Fatal (client error)
   *
   * @param status - HTTP status code
   * @param headers - Response headers
   * @param message - Error message
   * @returns Classified StreamAttemptError
   *
   * @rust-reference codex-rs/core/src/client.rs:346-411
   */
  static fromHttpResponse(
    status: number,
    headers: Headers | Record<string, string>,
    message?: string
  ): StreamAttemptError {
    // Parse Retry-After header (seconds or HTTP date)
    let retryAfter: number | undefined;
    const retryAfterHeader =
      headers instanceof Headers
        ? headers.get('retry-after')
        : headers['retry-after'] || headers['Retry-After'];

    if (retryAfterHeader) {
      // Try parsing as seconds (integer)
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        retryAfter = seconds;
      } else {
        // Try parsing as HTTP date
        const date = new Date(retryAfterHeader);
        if (!isNaN(date.getTime())) {
          retryAfter = Math.max(0, (date.getTime() - Date.now()) / 1000);
        }
      }
    }

    // Classify error
    if (status === 401) {
      return new StreamAttemptError('RetryableHttpError', {
        statusCode: status,
        message: message || 'Unauthorized (token refresh needed)',
      });
    }

    if (status === 429) {
      return new StreamAttemptError('RetryableHttpError', {
        statusCode: status,
        retryAfter,
        message: message || 'Rate limited',
      });
    }

    if (status >= 500) {
      return new StreamAttemptError('RetryableHttpError', {
        statusCode: status,
        message: message || 'Server error',
      });
    }

    // 4xx errors (except 401, 429) are fatal
    return new StreamAttemptError('Fatal', {
      statusCode: status,
      message: message || `Client error: ${status}`,
    });
  }

  /**
   * Factory: Create from network/transport error
   *
   * @param error - Original error
   * @returns RetryableTransportError
   */
  static fromTransportError(error: Error): StreamAttemptError {
    return new StreamAttemptError('RetryableTransportError', {
      cause: error,
      message: `Transport error: ${error.message}`,
    });
  }

  /**
   * Factory: Create from parse/validation error
   *
   * @param error - Original error
   * @returns Fatal error
   */
  static fromFatalError(error: Error): StreamAttemptError {
    return new StreamAttemptError('Fatal', {
      cause: error,
      message: `Fatal error: ${error.message}`,
    });
  }

  /**
   * Factory: Create from unknown error
   *
   * Attempts to classify the error based on properties.
   *
   * @param error - Unknown error
   * @returns Classified StreamAttemptError
   */
  static fromError(error: unknown): StreamAttemptError {
    if (error instanceof StreamAttemptError) {
      return error;
    }

    if (error instanceof CodexError) {
      if (error.type === 'Http' && error.statusCode) {
        return StreamAttemptError.fromHttpResponse(
          error.statusCode,
          {},
          error.message
        );
      }
      if (error.type === 'Transport') {
        return new StreamAttemptError('RetryableTransportError', {
          message: error.message,
        });
      }
      return new StreamAttemptError('Fatal', {
        message: error.message,
      });
    }

    if (error instanceof Error) {
      // Check for network errors
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('timeout')
      ) {
        return StreamAttemptError.fromTransportError(error);
      }

      // Default to fatal
      return StreamAttemptError.fromFatalError(error);
    }

    // Unknown error type
    return new StreamAttemptError('Fatal', {
      message: String(error),
    });
  }
}

/**
 * CodexError type matching Rust implementation
 *
 * @rust-reference codex-rs/core/src/error.rs
 */
export class CodexError extends Error {
  /** Error type category */
  readonly type: 'Http' | 'Transport' | 'Stream' | 'Fatal';

  /** HTTP status code (for Http errors) */
  readonly statusCode?: number;

  /** Original error cause */
  readonly cause?: Error;

  constructor(
    type: 'Http' | 'Transport' | 'Stream' | 'Fatal',
    message: string,
    statusCode?: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'CodexError';
    this.type = type;
    this.statusCode = statusCode;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CodexError);
    }
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for StreamAttemptError
 */
export function isStreamAttemptError(error: unknown): error is StreamAttemptError {
  return error instanceof StreamAttemptError;
}

/**
 * Type guard for retryable errors
 */
export function isRetryableError(error: unknown): boolean {
  return isStreamAttemptError(error) && error.isRetryable();
}

/**
 * Type guard for fatal errors
 */
export function isFatalError(error: unknown): boolean {
  return isStreamAttemptError(error) && error.type === 'Fatal';
}

// ============================================================================
// Contract Validation
// ============================================================================

/**
 * Validate error classification logic matches Rust implementation
 *
 * Test cases from Rust implementation:
 */
export const ERROR_CLASSIFICATION_TEST_CASES = [
  // Retryable HTTP errors
  { status: 401, expected: 'RetryableHttpError' },
  { status: 429, expected: 'RetryableHttpError' },
  { status: 500, expected: 'RetryableHttpError' },
  { status: 502, expected: 'RetryableHttpError' },
  { status: 503, expected: 'RetryableHttpError' },

  // Fatal HTTP errors
  { status: 400, expected: 'Fatal' },
  { status: 403, expected: 'Fatal' },
  { status: 404, expected: 'Fatal' },
  { status: 422, expected: 'Fatal' },
] as const;

/**
 * Run contract validation tests
 *
 * @throws {Error} If any test case fails
 */
export function validateErrorClassificationContract(): void {
  for (const testCase of ERROR_CLASSIFICATION_TEST_CASES) {
    const error = StreamAttemptError.fromHttpResponse(
      testCase.status,
      {},
      'test error'
    );

    if (error.type !== testCase.expected) {
      throw new Error(
        `Error classification mismatch for status ${testCase.status}: ` +
          `expected ${testCase.expected}, got ${error.type}`
      );
    }
  }
}

/**
 * Validate backoff calculation matches Rust implementation
 *
 * Expected: 2^attempt * 1000 + jitter(0-1000)
 */
export function validateBackoffCalculation(): void {
  const error = new StreamAttemptError('RetryableTransportError');

  for (let attempt = 0; attempt < 5; attempt++) {
    const delay = error.delay(attempt);
    const expectedMin = Math.pow(2, attempt) * 1000;
    const expectedMax = expectedMin + 1000;

    if (delay < expectedMin || delay > expectedMax) {
      throw new Error(
        `Backoff calculation incorrect for attempt ${attempt}: ` +
          `expected ${expectedMin}-${expectedMax}, got ${delay}`
      );
    }
  }

  // Test Retry-After override
  const retryAfterError = new StreamAttemptError('RetryableHttpError', {
    statusCode: 429,
    retryAfter: 5,
  });

  const retryAfterDelay = retryAfterError.delay(0);
  if (retryAfterDelay !== 5000) {
    throw new Error(
      `Retry-After delay incorrect: expected 5000, got ${retryAfterDelay}`
    );
  }
}
