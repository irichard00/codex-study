/**
 * Session API Contract (Updated for RolloutRecorder)
 * Feature: 006-use-the-rolloutrecorder
 *
 * Defines how Session.ts integrates with RolloutRecorder
 */

import type { RolloutRecorder } from '@/storage/rollout';
import type { RolloutItem, SessionMeta } from '@/storage/rollout/types';

// ============================================================================
// Session Services (Updated)
// ============================================================================

export interface SessionServices {
  mcp_connection_manager: any; // McpConnectionManager
  session_manager: any; // ExecSessionManager
  rollout: RolloutRecorder | null; // NEW: Replaces ConversationStore
  notifier: any; // UserNotifier
  user_shell: any; // Shell
}

// ============================================================================
// Session Initialization
// ============================================================================

export interface SessionInitParams {
  mode: 'create' | 'resume';
  conversationId: string;
  instructions?: string;
  config: AgentConfig;
}

export interface SessionAPI {
  /**
   * Initialize session with RolloutRecorder
   * Replaces: ConversationStore initialization
   */
  initializeSession(params: SessionInitParams): Promise<void>;

  /**
   * Record rollout items during session
   * Replaces: ConversationStore.addMessage()
   */
  persistRolloutItems(items: RolloutItem[]): Promise<void>;

  /**
   * Reconstruct conversation history from rollout items
   * Used when resuming a session
   */
  reconstructHistoryFromRollout(items: RolloutItem[]): void;

  /**
   * Flush rollout recorder before session ends
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// AgentConfig (Storage Settings)
// ============================================================================

export interface AgentConfig {
  storage?: {
    rolloutTTL: number | 'permanent'; // Days (default: 60) or 'permanent'
  };
  // ... other config fields
}

// ============================================================================
// Expected Behavior (Contract Tests)
// ============================================================================

/**
 * Test: Session should initialize RolloutRecorder on create
 */
export const CONTRACT_INIT_CREATE = {
  given: 'Session mode is "create" with conversationId "new-123"',
  when: 'initializeSession() is called',
  then: 'RolloutRecorder.create() is called with conversationId "new-123"',
};

/**
 * Test: Session should resume from existing rollout
 */
export const CONTRACT_INIT_RESUME = {
  given: 'Session mode is "resume" with conversationId "existing-456"',
  when: 'initializeSession() is called',
  then: 'RolloutRecorder resumes from conversationId "existing-456" and history is reconstructed',
};

/**
 * Test: Session should persist user messages
 */
export const CONTRACT_PERSIST_USER_MSG = {
  given: 'User sends message "Hello"',
  when: 'persistRolloutItems() is called',
  then: 'RolloutItem with type="event_msg" and payload.type="UserMessage" is recorded',
};

/**
 * Test: Session should persist assistant responses
 */
export const CONTRACT_PERSIST_ASSISTANT_MSG = {
  given: 'Assistant responds with "Hi there"',
  when: 'persistRolloutItems() is called',
  then: 'RolloutItem with type="response_item" and payload.type="Message" is recorded',
};

/**
 * Test: Session should persist tool calls
 */
export const CONTRACT_PERSIST_TOOL_CALL = {
  given: 'Assistant makes tool call "exec_command"',
  when: 'persistRolloutItems() is called',
  then: 'RolloutItem with type="response_item" and payload.type="LocalShellCall" is recorded',
};

/**
 * Test: Session should handle persistence errors gracefully
 */
export const CONTRACT_HANDLE_PERSIST_ERROR = {
  given: 'RolloutRecorder.recordItems() throws error',
  when: 'persistRolloutItems() is called',
  then: 'Error is logged, session continues without crashing',
};

/**
 * Test: Session should reconstruct history from rollout
 */
export const CONTRACT_RECONSTRUCT_HISTORY = {
  given: 'Rollout has 5 items: [SessionMeta, UserMsg, AssistantMsg, ToolCall, UserMsg]',
  when: 'reconstructHistoryFromRollout() is called',
  then: 'ConversationHistory contains 3 ResponseItems (UserMsg, AssistantMsg, ToolCall)',
};

/**
 * Test: Session should flush on shutdown
 */
export const CONTRACT_SHUTDOWN_FLUSH = {
  given: 'Session has pending rollout writes',
  when: 'shutdown() is called',
  then: 'RolloutRecorder.flush() is called before session ends',
};

/**
 * Test: Session should continue if RolloutRecorder fails to initialize
 */
export const CONTRACT_GRACEFUL_DEGRADATION = {
  given: 'RolloutRecorder.create() throws error',
  when: 'initializeSession() is called',
  then: 'services.rollout is set to null, session continues without persistence',
};
