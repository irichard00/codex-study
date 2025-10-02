/**
 * Rollout Recording Contracts
 *
 * Defines the interface contracts for rollout persistence and history reconstruction:
 * - persist_rollout_items() - Persist items to rollout
 * - reconstruct_history_from_rollout() - Rebuild history from rollout
 * - record_conversation_items() - Record items to history and rollout
 * - record_into_history() - Append to in-memory history only
 * - replace_history() - Replace entire history
 * - record_input_and_rollout_usermsg() - Record user input with dual persistence
 */

import type { ResponseItem } from '../../../../codex-chrome/src/protocol/types';
import type { RolloutItem, CompactedHistory } from '../data-model';
import type { TurnContext } from '../../../../codex-chrome/src/core/TurnContext';

/**
 * PERSIST ROLLOUT ITEMS CONTRACT
 *
 * Persist items to RolloutRecorder for durability.
 */
export interface IPersistRolloutItems {
  /**
   * Persist rollout items
   *
   * @param items - Rollout items to persist
   *
   * BEHAVIOR CONTRACT:
   * - MUST convert items to RolloutRecorder format if needed
   * - MUST call RolloutRecorder.recordItems()
   * - MUST preserve item order
   * - SHOULD batch items for performance
   * - MAY defer persistence (async write-behind)
   *
   * PRECONDITIONS:
   * - RolloutRecorder is initialized (may be null)
   * - items are valid RolloutItem structures
   *
   * POSTCONDITIONS:
   * - Items persisted to storage
   * - Rollout history updated
   *
   * ERROR HANDLING:
   * - Logs warning if RolloutRecorder is null (degraded mode)
   * - Logs error if persistence fails (non-fatal)
   * - Never throws (persistence failure should not stop execution)
   *
   * INTEGRATION:
   * - Called by record_conversation_items()
   * - Called by record_input_and_rollout_usermsg()
   * - Called by send_event() for event persistence
   */
  persistRolloutItems(items: RolloutItem[]): Promise<void>;
}

/**
 * RECONSTRUCT HISTORY CONTRACT
 *
 * Rebuild conversation history from rollout items.
 */
export interface IReconstructHistoryFromRollout {
  /**
   * Reconstruct history from rollout
   *
   * @param turnContext - Current turn context
   * @param rolloutItems - Rollout items to process
   * @returns Reconstructed ResponseItem array
   *
   * BEHAVIOR CONTRACT:
   * - MUST process RolloutItem.ResponseItem → add to history
   * - MUST process RolloutItem.Compacted → build compacted summary
   * - MUST ignore RolloutItem.EventMsg (events not in history)
   * - MUST ignore RolloutItem.SessionMeta (metadata only)
   * - MUST ignore RolloutItem.TurnContext (metadata only)
   * - SHOULD use ConversationHistory helper for reconstruction
   * - SHOULD preserve item order from rollout
   *
   * COMPACTED HANDLING:
   * - Compacted items contain a summary message
   * - Build summary ResponseItem from compacted data
   * - Include summary in returned history
   *
   * PRECONDITIONS:
   * - rolloutItems is valid array (may be empty)
   * - turnContext is valid
   *
   * POSTCONDITIONS:
   * - Returns complete conversation history
   * - History includes compacted summaries
   * - History ready for SessionState.recordItems()
   *
   * ERROR HANDLING:
   * - Logs warning for unknown rollout item types
   * - Skips invalid items (continue processing)
   * - Returns empty array if all items invalid
   *
   * USE CASES:
   * - Resuming session from storage
   * - Forking conversation
   * - Loading conversation history for display
   */
  reconstructHistoryFromRollout(
    turnContext: TurnContext,
    rolloutItems: RolloutItem[]
  ): ResponseItem[];
}

/**
 * RECORD CONVERSATION ITEMS CONTRACT
 *
 * Record items to both history and rollout.
 */
export interface IRecordConversationItems {
  /**
   * Record conversation items
   *
   * @param items - Response items to record
   *
   * BEHAVIOR CONTRACT:
   * - MUST call recordIntoHistory() to update SessionState
   * - MUST call persistRolloutResponseItems() for durability
   * - MUST be atomic (both or error)
   * - SHOULD preserve item order
   *
   * EXECUTION FLOW:
   * 1. await recordIntoHistory(items)
   * 2. await persistRolloutResponseItems(items)
   *
   * PRECONDITIONS:
   * - items is valid ResponseItem array
   *
   * POSTCONDITIONS:
   * - Items in SessionState history
   * - Items persisted to rollout
   *
   * ERROR HANDLING:
   * - Throws Error if recordIntoHistory fails
   * - Logs warning if persistRolloutResponseItems fails (non-fatal)
   */
  recordConversationItems(items: ResponseItem[]): Promise<void>;
}

/**
 * RECORD INTO HISTORY CONTRACT
 *
 * Append to in-memory history only (no persistence).
 */
export interface IRecordIntoHistory {
  /**
   * Record into history (memory only)
   *
   * @param items - Response items to record
   *
   * BEHAVIOR CONTRACT:
   * - MUST append items to SessionState.history
   * - MUST call SessionState.recordItems()
   * - MUST NOT persist to rollout
   * - SHOULD validate items before recording
   *
   * PRECONDITIONS:
   * - SessionState exists
   * - items is valid array
   *
   * POSTCONDITIONS:
   * - SessionState.historySnapshot() includes new items
   * - History order preserved
   *
   * ERROR HANDLING:
   * - Throws Error if SessionState is null
   * - Throws Error if items are invalid
   */
  recordIntoHistory(items: ResponseItem[]): Promise<void>;
}

/**
 * REPLACE HISTORY CONTRACT
 *
 * Replace entire conversation history.
 */
export interface IReplaceHistory {
  /**
   * Replace history
   *
   * @param items - New history items
   *
   * BEHAVIOR CONTRACT:
   * - MUST clear existing SessionState history
   * - MUST set new history to items
   * - MUST call SessionState.replaceHistory()
   * - MUST NOT persist to rollout (caller's responsibility)
   *
   * USE CASES:
   * - History compaction
   * - Rollback to previous state
   * - Import from external source
   *
   * PRECONDITIONS:
   * - SessionState exists
   * - items is valid array (may be empty)
   *
   * POSTCONDITIONS:
   * - SessionState.historySnapshot() === items
   * - Previous history cleared
   *
   * ERROR HANDLING:
   * - Throws Error if SessionState is null
   */
  replaceHistory(items: ResponseItem[]): Promise<void>;
}

/**
 * PERSIST ROLLOUT RESPONSE ITEMS CONTRACT
 *
 * Convert ResponseItems to RolloutItems and persist.
 */
export interface IPersistRolloutResponseItems {
  /**
   * Persist response items to rollout
   *
   * @param items - Response items to persist
   *
   * BEHAVIOR CONTRACT:
   * - MUST convert ResponseItem → RolloutItem.ResponseItem
   * - MUST call persistRolloutItems()
   * - MUST preserve item metadata
   *
   * CONVERSION:
   * - Each ResponseItem → { type: 'response_item', payload: item }
   *
   * PRECONDITIONS:
   * - items is valid ResponseItem array
   *
   * POSTCONDITIONS:
   * - Items persisted to rollout
   *
   * ERROR HANDLING:
   * - Logs error if conversion fails (skip item)
   * - Logs error if persistence fails (non-fatal)
   */
  persistRolloutResponseItems(items: ResponseItem[]): Promise<void>;
}

/**
 * RECORD INPUT AND ROLLOUT USERMSG CONTRACT
 *
 * Record user input with dual persistence (history + events).
 */
export interface IRecordInputAndRolloutUsermsg {
  /**
   * Record user input and rollout user message
   *
   * @param responseInput - User input item
   *
   * BEHAVIOR CONTRACT:
   * - MUST convert input to ResponseItem
   * - MUST record to conversation history
   * - MUST derive UserMessage events from input
   * - MUST persist ONLY UserMessage to rollout (not full ResponseItem)
   * - MUST use mapResponseItemToEventMessages() for conversion
   *
   * DUAL PERSISTENCE PATTERN:
   * 1. Convert input → ResponseItem
   * 2. Record to history: recordIntoHistory([responseItem])
   * 3. Derive events: events = mapResponseItemToEventMessages(responseItem)
   * 4. Persist events: persistRolloutItems([{ type: 'event_msg', payload: event }])
   *
   * WHY DUAL PERSISTENCE:
   * - History: Full conversation context for agent
   * - Events: Compact replay for UI reconstruction
   *
   * PRECONDITIONS:
   * - responseInput is valid user input
   *
   * POSTCONDITIONS:
   * - Input in SessionState history
   * - UserMessage event in rollout
   *
   * ERROR HANDLING:
   * - Throws Error if conversion fails
   * - Logs warning if rollout persistence fails (non-fatal)
   */
  recordInputAndRolloutUsermsg(responseInput: any): Promise<void>;
}

/**
 * Combined Rollout Recording Interface
 */
export interface IRolloutRecording
  extends IPersistRolloutItems,
    IReconstructHistoryFromRollout,
    IRecordConversationItems,
    IRecordIntoHistory,
    IReplaceHistory,
    IPersistRolloutResponseItems,
    IRecordInputAndRolloutUsermsg {}

/**
 * CONVERSATION HISTORY HELPER
 *
 * Utility for building conversation history from rollout items.
 * Separate from Session for testability.
 */
export interface ConversationHistoryBuilder {
  /**
   * Add response item to history
   */
  addResponseItem(item: ResponseItem): void;

  /**
   * Add compacted summary to history
   */
  addCompactedSummary(compacted: CompactedHistory): void;

  /**
   * Build final history
   */
  build(): ResponseItem[];
}

/**
 * INTEGRATION EXAMPLE
 *
 * ```typescript
 * // Recording conversation items
 * async function recordAgentResponse(session: Session, items: ResponseItem[]) {
 *   // Both history and rollout
 *   await session.recordConversationItems(items);
 * }
 *
 * // Recording user input (dual persistence)
 * async function recordUserInput(session: Session, input: InputItem) {
 *   // History + UserMessage event to rollout
 *   await session.recordInputAndRolloutUsermsg(input);
 * }
 *
 * // Reconstructing history on resume
 * async function resumeSession(conversationId: string) {
 *   const rolloutItems = await loadRolloutItems(conversationId);
 *   const { session, turnContext } = await Session.new(
 *     { conversationId },
 *     config,
 *     { mode: 'resumed', rolloutItems }
 *   );
 *
 *   // History reconstructed in record_initial_history()
 *   const history = await session.reconstructHistoryFromRollout(
 *     turnContext,
 *     rolloutItems
 *   );
 *   await session.replaceHistory(history);
 * }
 *
 * // Compacting history
 * async function compactHistory(session: Session) {
 *   const currentHistory = session.sessionState.historySnapshot();
 *
 *   // Keep last 20 items, compact the rest
 *   const kept = currentHistory.slice(-20);
 *   const compacted = currentHistory.slice(0, -20);
 *
 *   // Build summary
 *   const summary = await buildCompactedSummary(compacted);
 *   const summaryItem: ResponseItem = {
 *     role: 'system',
 *     content: `[Compacted ${compacted.length} messages: ${summary}]`,
 *     metadata: { compacted: true }
 *   };
 *
 *   // Replace history
 *   await session.replaceHistory([summaryItem, ...kept]);
 *
 *   // Persist compacted rollout item
 *   const compactedRollout: RolloutItem = {
 *     type: 'compacted',
 *     payload: {
 *       message: summary,
 *       originalCount: compacted.length,
 *       compactedAt: Date.now()
 *     }
 *   };
 *   await session.persistRolloutItems([compactedRollout]);
 * }
 * ```
 */

/**
 * TEST SCENARIOS
 *
 * 1. Record Conversation Items
 *    - Given: Agent generates response items
 *    - When: recordConversationItems() called
 *    - Then: Items in SessionState and rollout
 *
 * 2. Record User Input (Dual Persistence)
 *    - Given: User sends text input
 *    - When: recordInputAndRolloutUsermsg() called
 *    - Then: ResponseItem in history, UserMessage in rollout
 *
 * 3. Reconstruct from Empty Rollout
 *    - Given: New session (empty rollout)
 *    - When: reconstructHistoryFromRollout([])
 *    - Then: Returns empty array
 *
 * 4. Reconstruct with Response Items
 *    - Given: Rollout with ResponseItem entries
 *    - When: reconstructHistoryFromRollout() called
 *    - Then: Returns ResponseItem array in order
 *
 * 5. Reconstruct with Compacted Items
 *    - Given: Rollout with Compacted entry
 *    - When: reconstructHistoryFromRollout() called
 *    - Then: Returns summary ResponseItem
 *
 * 6. Reconstruct Mixed Rollout
 *    - Given: Rollout with ResponseItems, Events, Compacted, Metadata
 *    - When: reconstructHistoryFromRollout() called
 *    - Then: Returns only ResponseItems and Compacted summaries
 *
 * 7. Replace History
 *    - Given: Session with existing history
 *    - When: replaceHistory(newItems) called
 *    - Then: SessionState.historySnapshot() === newItems
 *
 * 8. Persistence Failure (Rollout)
 *    - Given: RolloutRecorder.recordItems() fails
 *    - When: persistRolloutItems() called
 *    - Then: Logs error, does not throw
 *
 * 9. Persistence Failure (SessionState)
 *    - Given: SessionState.recordItems() fails
 *    - When: recordIntoHistory() called
 *    - Then: Throws error (fatal)
 *
 * 10. Rollout Item Order Preservation
 *     - Given: Multiple items persisted
 *     - When: Items are reconstructed
 *     - Then: Order matches original
 */

/**
 * ROLLOUT ITEM CONVERSION PATTERNS
 *
 * ```typescript
 * // ResponseItem → RolloutItem
 * function convertToRolloutItem(item: ResponseItem): RolloutItem {
 *   return {
 *     type: 'response_item',
 *     payload: item
 *   };
 * }
 *
 * // Event → RolloutItem
 * function convertEventToRolloutItem(event: EventMsg): RolloutItem {
 *   return {
 *     type: 'event_msg',
 *     payload: event
 *   };
 * }
 *
 * // Compacted → RolloutItem
 * function convertCompactedToRolloutItem(
 *   compacted: CompactedHistory
 * ): RolloutItem {
 *   return {
 *     type: 'compacted',
 *     payload: compacted
 *   };
 * }
 *
 * // RolloutItem → ResponseItem (reconstruction)
 * function reconstructResponseItem(item: RolloutItem): ResponseItem | null {
 *   if (item.type === 'response_item') {
 *     return item.payload as ResponseItem;
 *   } else if (item.type === 'compacted') {
 *     const compacted = item.payload as CompactedHistory;
 *     return {
 *       role: 'system',
 *       content: `[Compacted: ${compacted.message}]`,
 *       metadata: {
 *         compacted: true,
 *         originalCount: compacted.originalCount,
 *         compactedAt: compacted.compactedAt
 *       }
 *     };
 *   } else {
 *     // event_msg, session_meta, turn_context: skip
 *     return null;
 *   }
 * }
 * ```
 */
