/**
 * Formatters API Contract
 *
 * This contract defines formatting utility functions for converting
 * raw data into human-readable strings for UI display.
 */

/**
 * Format duration in milliseconds to human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2.3s", "45ms", "1m 30s")
 *
 * @example
 * formatDuration(45) // "45ms"
 * formatDuration(2300) // "2.3s"
 * formatDuration(90000) // "1m 30s"
 * formatDuration(3600000) // "1h 0m"
 *
 * Contract:
 * - ms < 1000: return "{ms}ms"
 * - ms < 60000: return "{s}.{ds}s" (1 decimal)
 * - ms < 3600000: return "{m}m {s}s"
 * - ms >= 3600000: return "{h}h {m}m"
 */
export function formatDuration(ms: number): string {
  throw new Error('Not implemented');
}

/**
 * Format number with thousands separators
 *
 * @param num - Number to format
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted string with separators
 *
 * @example
 * formatNumber(1234) // "1,234"
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(42) // "42"
 *
 * Contract:
 * - Uses locale-specific separators
 * - Handles negative numbers: formatNumber(-1234) // "-1,234"
 * - Handles zero: formatNumber(0) // "0"
 */
export function formatNumber(num: number, locale?: string): string {
  throw new Error('Not implemented');
}

/**
 * Format token count with thousands separators and optional label
 *
 * @param tokens - Number of tokens
 * @param label - Optional label (e.g., "input", "output")
 * @returns Formatted string
 *
 * @example
 * formatTokens(1234) // "1,234"
 * formatTokens(1234, 'input') // "1,234 input"
 * formatTokens(0) // "0"
 *
 * Contract:
 * - Same as formatNumber but with optional label suffix
 * - Label is singular if tokens === 1: formatTokens(1, 'token') // "1 token"
 * - Label is plural otherwise: formatTokens(2, 'token') // "2 tokens"
 */
export function formatTokens(tokens: number, label?: string): string {
  throw new Error('Not implemented');
}

/**
 * Format timestamp for display
 *
 * @param date - Date object
 * @param format - 'relative' | 'absolute' | 'timestamp'
 * @returns Formatted string
 *
 * @example
 * formatTime(new Date(), 'relative') // "just now" | "2s ago" | "5m ago"
 * formatTime(new Date(), 'absolute') // "14:23:45"
 * formatTime(new Date(), 'timestamp') // "[2025-09-30T14:23:45]"
 *
 * Contract:
 * - relative: "just now" if <10s, "{s}s ago" if <60s, "{m}m ago" if <60m, "{h}h ago" if <24h, date otherwise
 * - absolute: "HH:MM:SS" in 24-hour format
 * - timestamp: "[YYYY-MM-DDTHH:MM:SS]" (matches Rust ts_println! macro)
 */
export function formatTime(date: Date, format: 'relative' | 'absolute' | 'timestamp'): string {
  throw new Error('Not implemented');
}

/**
 * Format command for display (handles escaping and truncation)
 *
 * @param command - Command string or array of args
 * @param maxLength - Maximum length before truncation (default: no limit)
 * @returns Formatted command string
 *
 * @example
 * formatCommand('ls -la') // "ls -la"
 * formatCommand(['echo', 'hello world']) // "echo 'hello world'"
 * formatCommand('very long command...', 20) // "very long comma..."
 *
 * Contract:
 * - Array args are joined with proper shell escaping
 * - Quotes added for args with spaces
 * - Truncates to maxLength with "..." suffix if exceeded
 * - Special chars escaped: formatCommand(['echo', '$VAR']) // "echo '$VAR'"
 */
export function formatCommand(command: string | string[], maxLength?: number): string {
  throw new Error('Not implemented');
}

/**
 * Format exit code with status text
 *
 * @param exitCode - Command exit code
 * @returns Formatted string with semantic meaning
 *
 * @example
 * formatExitCode(0) // "success"
 * formatExitCode(1) // "exited 1"
 * formatExitCode(127) // "command not found (127)"
 * formatExitCode(130) // "interrupted (130)"
 *
 * Contract:
 * - 0: "success"
 * - 1: "exited 1"
 * - 127: "command not found (127)"
 * - 130: "interrupted (130)"
 * - 137: "killed (137)"
 * - other: "exited {code}"
 */
export function formatExitCode(exitCode: number): string {
  throw new Error('Not implemented');
}

/**
 * Truncate text to maximum number of lines
 *
 * @param text - Text to truncate
 * @param maxLines - Maximum lines to include
 * @returns Truncated text with indicator if truncated
 *
 * @example
 * truncateOutput('line1\nline2\nline3', 2) // "line1\nline2\n... (1 more line)"
 * truncateOutput('short', 10) // "short"
 *
 * Contract:
 * - Splits on '\n'
 * - If lines <= maxLines: return original text
 * - If lines > maxLines: return first maxLines + "\n... ({N} more lines)"
 * - Preserves trailing newline if present in original
 */
export function truncateOutput(text: string, maxLines: number): string {
  throw new Error('Not implemented');
}

/**
 * Format file size in bytes to human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.2 KB", "3.4 MB")
 *
 * @example
 * formatBytes(1234) // "1.2 KB"
 * formatBytes(1234567) // "1.2 MB"
 * formatBytes(42) // "42 B"
 *
 * Contract:
 * - <1024: "{bytes} B"
 * - <1024^2: "{kb} KB" (1 decimal)
 * - <1024^3: "{mb} MB" (1 decimal)
 * - >=1024^3: "{gb} GB" (1 decimal)
 */
export function formatBytes(bytes: number): string {
  throw new Error('Not implemented');
}

/**
 * Format percentage with specified decimals
 *
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercent(0.5) // "50%"
 * formatPercent(0.333, 1) // "33.3%"
 * formatPercent(1) // "100%"
 *
 * Contract:
 * - Multiplies by 100
 * - Rounds to specified decimals
 * - Adds "%" suffix
 * - Clamps to 0-100 range
 */
export function formatPercent(value: number, decimals?: number): string {
  throw new Error('Not implemented');
}

/**
 * Format diff summary showing additions/deletions
 *
 * @param additions - Number of lines added
 * @param deletions - Number of lines deleted
 * @returns Formatted string (e.g., "+12 -5")
 *
 * @example
 * formatDiffSummary(12, 5) // "+12 -5"
 * formatDiffSummary(0, 3) // "-3"
 * formatDiffSummary(5, 0) // "+5"
 *
 * Contract:
 * - Format: "+{add} -{del}"
 * - Omit "+{add}" if additions === 0
 * - Omit "-{del}" if deletions === 0
 * - Return "no changes" if both are 0
 */
export function formatDiffSummary(additions: number, deletions: number): string {
  throw new Error('Not implemented');
}

/**
 * Contract Tests
 *
 * These tests must pass for formatter implementations.
 */
export const FormatterContractTests = {
  'formatDuration should format milliseconds correctly': () => {
    if (formatDuration(45) !== '45ms') throw new Error('Expected "45ms"');
    if (formatDuration(2300) !== '2.3s') throw new Error('Expected "2.3s"');
    if (formatDuration(90000) !== '1m 30s') throw new Error('Expected "1m 30s"');
  },

  'formatNumber should add thousands separators': () => {
    if (formatNumber(1234) !== '1,234') throw new Error('Expected "1,234"');
    if (formatNumber(1234567) !== '1,234,567') throw new Error('Expected "1,234,567"');
    if (formatNumber(42) !== '42') throw new Error('Expected "42"');
  },

  'formatExitCode should return semantic status': () => {
    if (formatExitCode(0) !== 'success') throw new Error('Expected "success"');
    if (!formatExitCode(1).includes('exited 1')) throw new Error('Expected "exited 1"');
    if (!formatExitCode(127).includes('command not found')) throw new Error('Expected "command not found"');
  },

  'truncateOutput should limit lines': () => {
    const text = 'line1\nline2\nline3';
    const result = truncateOutput(text, 2);
    if (!result.includes('line1')) throw new Error('Expected line1 present');
    if (!result.includes('line2')) throw new Error('Expected line2 present');
    if (!result.includes('more line')) throw new Error('Expected truncation indicator');
  },

  'formatTime with relative should show relative time': () => {
    const now = new Date();
    const result = formatTime(now, 'relative');
    if (result !== 'just now') throw new Error('Expected "just now" for current time');
  },

  'formatCommand should handle arrays': () => {
    const result = formatCommand(['echo', 'hello world']);
    if (!result.includes('echo')) throw new Error('Expected command name');
    if (!result.includes('hello world')) throw new Error('Expected argument');
  },
};

/**
 * Performance Contract
 */
export const FormatterPerformanceContract = {
  'formatters should execute in <1ms': true,
  'formatters should not allocate excessive memory': true,
};
