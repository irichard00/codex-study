/**
 * Token Tracking Contracts
 *
 * Defines the interface contracts for token usage and rate limit tracking:
 * - update_token_usage_info() - Update token counts from model response
 * - update_rate_limits() - Update rate limit snapshot
 */

import type { TokenUsage, RateLimitSnapshot } from '../data-model';
import type { TurnContext } from '../../../../codex-chrome/src/core/TurnContext';

/**
 * UPDATE TOKEN USAGE INFO CONTRACT
 *
 * Update token usage information from model response.
 */
export interface IUpdateTokenUsageInfo {
  /**
   * Update token usage info
   *
   * @param subId - Submission ID
   * @param turnContext - Turn context
   * @param tokenUsage - Token usage from model response (optional)
   *
   * BEHAVIOR CONTRACT:
   * - MUST update SessionState.tokenInfo if tokenUsage provided
   * - MUST call SessionState.updateTokenInfoFromUsage()
   * - MUST send TokenCount event after update
   * - SHOULD accumulate total token usage across turns
   * - SHOULD track last turn token usage separately
   *
   * TOKEN INFO STRUCTURE:
   * {
   *   total_token_usage: {
   *     input_tokens: number,
   *     cached_input_tokens: number,
   *     output_tokens: number,
   *     reasoning_output_tokens: number,
   *     total_tokens: number
   *   },
   *   last_token_usage: {
   *     input_tokens: number,
   *     cached_input_tokens: number,
   *     output_tokens: number,
   *     reasoning_output_tokens: number,
   *     total_tokens: number
   *   },
   *   model_context_window: number
   * }
   *
   * PRECONDITIONS:
   * - subId is valid
   * - turnContext is valid
   * - tokenUsage is valid TokenUsage or null/undefined
   *
   * POSTCONDITIONS:
   * - SessionState.tokenInfo updated if tokenUsage provided
   * - TokenCount event emitted
   *
   * ERROR HANDLING:
   * - Does nothing if tokenUsage is null/undefined (valid case)
   * - Logs warning if TokenCount event fails (non-fatal)
   * - Throws Error if SessionState update fails
   *
   * INTEGRATION:
   * - Called after each model turn
   * - Called by turn executor after receiving model response
   * - Triggers TokenCount event for UI updates
   */
  updateTokenUsageInfo(
    subId: string,
    turnContext: TurnContext,
    tokenUsage?: TokenUsage
  ): Promise<void>;
}

/**
 * UPDATE RATE LIMITS CONTRACT
 *
 * Update rate limit snapshot from API headers.
 */
export interface IUpdateRateLimits {
  /**
   * Update rate limits
   *
   * @param subId - Submission ID
   * @param newRateLimits - Rate limit snapshot from API
   *
   * BEHAVIOR CONTRACT:
   * - MUST update SessionState.latestRateLimits
   * - MUST call SessionState.setRateLimits()
   * - MUST send TokenCount event after update
   * - SHOULD calculate usage percentages
   * - SHOULD track primary and secondary windows
   *
   * RATE LIMIT STRUCTURE:
   * {
   *   limit_requests: number,
   *   limit_tokens: number,
   *   remaining_requests: number,
   *   remaining_tokens: number,
   *   reset_requests: string (ISO 8601),
   *   reset_tokens: string (ISO 8601),
   *   usedPercent: number (calculated)
   * }
   *
   * PRECONDITIONS:
   * - subId is valid
   * - newRateLimits is valid RateLimitSnapshot
   *
   * POSTCONDITIONS:
   * - SessionState.latestRateLimits updated
   * - TokenCount event emitted with rate limit info
   *
   * ERROR HANDLING:
   * - Throws Error if SessionState update fails
   * - Logs warning if TokenCount event fails (non-fatal)
   *
   * INTEGRATION:
   * - Called after each API response
   * - Rate limits parsed from response headers
   * - Triggers TokenCount event for UI rate limit display
   */
  updateRateLimits(subId: string, newRateLimits: RateLimitSnapshot): Promise<void>;
}

/**
 * Combined Token Tracking Interface
 */
export interface ITokenTracking
  extends IUpdateTokenUsageInfo,
    IUpdateRateLimits {}

/**
 * SESSIONSTATE INTEGRATION
 *
 * Required methods in SessionState for token tracking.
 */
export interface ISessionStateTokenMethods {
  /**
   * Update token info from usage
   * Accumulates total and updates last turn
   */
  updateTokenInfoFromUsage(usage: TokenUsage): void;

  /**
   * Set rate limits
   * Stores latest rate limit snapshot
   */
  setRateLimits(limits: RateLimitSnapshot): void;

  /**
   * Get token info and rate limits
   * Returns current state for event emission
   */
  tokenInfoAndRateLimits(): {
    tokenInfo?: {
      total_token_usage: TokenUsage;
      last_token_usage: TokenUsage;
      model_context_window?: number;
    };
    rateLimits?: RateLimitSnapshot;
  };
}

/**
 * TOKEN COUNT EVENT EMISSION
 *
 * Helper method for emitting TokenCount events.
 */
export interface ISendTokenCountEvent {
  /**
   * Send token count event
   *
   * @param subId - Submission ID
   *
   * BEHAVIOR CONTRACT:
   * - MUST retrieve token info and rate limits from SessionState
   * - MUST emit TokenCount event with both
   * - SHOULD calculate rate limit percentages
   * - SHOULD include model context window
   *
   * EVENT STRUCTURE:
   * {
   *   type: 'TokenCount',
   *   data: {
   *     info: {
   *       total_token_usage: TokenUsage,
   *       last_token_usage: TokenUsage,
   *       model_context_window: number
   *     },
   *     rate_limits: {
   *       primary_used_percent: number,
   *       secondary_used_percent: number,
   *       primary_to_secondary_ratio_percent: number,
   *       primary_window_minutes: number,
   *       secondary_window_minutes: number
   *     }
   *   }
   * }
   *
   * PRECONDITIONS:
   * - SessionState has token/rate limit data
   *
   * POSTCONDITIONS:
   * - TokenCount event emitted
   *
   * ERROR HANDLING:
   * - Logs warning if SessionState data missing
   * - Emits partial event if some data unavailable
   */
  sendTokenCountEvent(subId: string): Promise<void>;
}

/**
 * INTEGRATION EXAMPLE
 *
 * ```typescript
 * // After model turn completes
 * async function handleModelResponse(
 *   session: Session,
 *   response: ModelResponse
 * ) {
 *   const subId = 'sub_123';
 *   const turnContext = session.getTurnContext();
 *
 *   // Extract token usage from response
 *   const tokenUsage: TokenUsage = {
 *     input_tokens: response.usage.input_tokens,
 *     cached_input_tokens: response.usage.cache_read_input_tokens || 0,
 *     output_tokens: response.usage.output_tokens,
 *     reasoning_output_tokens: response.usage.reasoning_output_tokens || 0,
 *     total_tokens: response.usage.total_tokens
 *   };
 *
 *   // Update token usage
 *   await session.updateTokenUsageInfo(subId, turnContext, tokenUsage);
 *
 *   // Extract rate limits from headers
 *   const rateLimits: RateLimitSnapshot = {
 *     limit_requests: parseInt(response.headers['x-ratelimit-limit-requests']),
 *     limit_tokens: parseInt(response.headers['x-ratelimit-limit-tokens']),
 *     remaining_requests: parseInt(response.headers['x-ratelimit-remaining-requests']),
 *     remaining_tokens: parseInt(response.headers['x-ratelimit-remaining-tokens']),
 *     reset_requests: response.headers['x-ratelimit-reset-requests'],
 *     reset_tokens: response.headers['x-ratelimit-reset-tokens']
 *   };
 *
 *   // Update rate limits
 *   await session.updateRateLimits(subId, rateLimits);
 * }
 *
 * // Manually send token count event
 * await session.sendTokenCountEvent('sub_123');
 * ```
 */

/**
 * TEST SCENARIOS
 *
 * 1. Update Token Usage - First Turn
 *    - Given: Empty SessionState (no token usage)
 *    - When: updateTokenUsageInfo() called with usage
 *    - Then: total = usage, last = usage, event emitted
 *
 * 2. Update Token Usage - Subsequent Turn
 *    - Given: SessionState has existing token usage
 *    - When: updateTokenUsageInfo() called with new usage
 *    - Then: total += new, last = new, event emitted
 *
 * 3. Update Token Usage - Null Usage
 *    - Given: updateTokenUsageInfo() called with null
 *    - When: Method executes
 *    - Then: No update, no event (valid case)
 *
 * 4. Update Rate Limits
 *    - Given: API response with rate limit headers
 *    - When: updateRateLimits() called
 *    - Then: SessionState updated, event emitted
 *
 * 5. Rate Limit Percentage Calculation
 *    - Given: Rate limits with remaining tokens
 *    - When: sendTokenCountEvent() called
 *    - Then: Event includes calculated percentages
 *
 * 6. Token Info Without Rate Limits
 *    - Given: Token usage updated, no rate limits
 *    - When: sendTokenCountEvent() called
 *    - Then: Event includes token info only
 *
 * 7. Rate Limits Without Token Info
 *    - Given: Rate limits updated, no token usage
 *    - When: sendTokenCountEvent() called
 *    - Then: Event includes rate limits only
 *
 * 8. Token Accumulation Over Multiple Turns
 *    - Given: 3 turns with token usage
 *    - When: updateTokenUsageInfo() called for each
 *    - Then: total accumulates, last reflects only last turn
 *
 * 9. Model Context Window
 *    - Given: TurnContext has model with context window
 *    - When: sendTokenCountEvent() called
 *    - Then: Event includes model_context_window
 *
 * 10. Event Emission Failure
 *     - Given: Event emitter fails
 *     - When: updateTokenUsageInfo() called
 *     - Then: Logs warning, does not throw
 */

/**
 * TOKEN ACCUMULATION PATTERN
 *
 * Implementation strategy for token tracking:
 *
 * ```typescript
 * // In SessionState
 * class SessionState {
 *   private tokenInfo: {
 *     total: TokenUsage;
 *     last: TokenUsage;
 *   } = {
 *     total: {
 *       input_tokens: 0,
 *       cached_input_tokens: 0,
 *       output_tokens: 0,
 *       reasoning_output_tokens: 0,
 *       total_tokens: 0
 *     },
 *     last: {
 *       input_tokens: 0,
 *       cached_input_tokens: 0,
 *       output_tokens: 0,
 *       reasoning_output_tokens: 0,
 *       total_tokens: 0
 *     }
 *   };
 *
 *   private latestRateLimits?: RateLimitSnapshot;
 *
 *   updateTokenInfoFromUsage(usage: TokenUsage): void {
 *     // Accumulate total
 *     this.tokenInfo.total.input_tokens += usage.input_tokens;
 *     this.tokenInfo.total.cached_input_tokens += usage.cached_input_tokens;
 *     this.tokenInfo.total.output_tokens += usage.output_tokens;
 *     this.tokenInfo.total.reasoning_output_tokens += usage.reasoning_output_tokens;
 *     this.tokenInfo.total.total_tokens += usage.total_tokens;
 *
 *     // Update last
 *     this.tokenInfo.last = { ...usage };
 *   }
 *
 *   setRateLimits(limits: RateLimitSnapshot): void {
 *     this.latestRateLimits = limits;
 *   }
 *
 *   tokenInfoAndRateLimits() {
 *     return {
 *       tokenInfo: {
 *         total_token_usage: this.tokenInfo.total,
 *         last_token_usage: this.tokenInfo.last,
 *         model_context_window: this.modelContextWindow
 *       },
 *       rateLimits: this.latestRateLimits
 *     };
 *   }
 * }
 *
 * // In Session
 * async updateTokenUsageInfo(
 *   subId: string,
 *   turnContext: TurnContext,
 *   tokenUsage?: TokenUsage
 * ): Promise<void> {
 *   if (!tokenUsage) return;
 *
 *   // Update SessionState
 *   this.sessionState.updateTokenInfoFromUsage(tokenUsage);
 *
 *   // Emit event
 *   await this.sendTokenCountEvent(subId);
 * }
 *
 * async updateRateLimits(
 *   subId: string,
 *   newRateLimits: RateLimitSnapshot
 * ): Promise<void> {
 *   // Update SessionState
 *   this.sessionState.setRateLimits(newRateLimits);
 *
 *   // Emit event
 *   await this.sendTokenCountEvent(subId);
 * }
 *
 * async sendTokenCountEvent(subId: string): Promise<void> {
 *   const { tokenInfo, rateLimits } = this.sessionState.tokenInfoAndRateLimits();
 *
 *   await this.sendEvent({
 *     id: generateEventId(),
 *     msg: {
 *       type: 'TokenCount',
 *       data: {
 *         info: tokenInfo,
 *         rate_limits: rateLimits ? {
 *           primary_used_percent: calculateUsedPercent(rateLimits),
 *           // ... other fields
 *         } : undefined
 *       }
 *     }
 *   });
 * }
 * ```
 */

/**
 * RATE LIMIT PERCENTAGE CALCULATION
 *
 * ```typescript
 * function calculateRateLimitPercentages(
 *   limits: RateLimitSnapshot
 * ): RateLimitSnapshotEvent {
 *   // Primary window: requests
 *   const primaryUsed = limits.limit_requests && limits.remaining_requests
 *     ? ((limits.limit_requests - limits.remaining_requests) / limits.limit_requests) * 100
 *     : 0;
 *
 *   // Secondary window: tokens
 *   const secondaryUsed = limits.limit_tokens && limits.remaining_tokens
 *     ? ((limits.limit_tokens - limits.remaining_tokens) / limits.limit_tokens) * 100
 *     : 0;
 *
 *   // Ratio
 *   const ratio = limits.limit_requests && limits.limit_tokens
 *     ? (limits.limit_requests / (limits.limit_requests + limits.limit_tokens)) * 100
 *     : 50;
 *
 *   // Window durations (parse from reset timestamps)
 *   const primaryWindow = limits.reset_requests
 *     ? calculateWindowMinutes(limits.reset_requests)
 *     : 60;
 *
 *   const secondaryWindow = limits.reset_tokens
 *     ? calculateWindowMinutes(limits.reset_tokens)
 *     : 60;
 *
 *   return {
 *     primary_used_percent: primaryUsed,
 *     secondary_used_percent: secondaryUsed,
 *     primary_to_secondary_ratio_percent: ratio,
 *     primary_window_minutes: primaryWindow,
 *     secondary_window_minutes: secondaryWindow
 *   };
 * }
 * ```
 */
