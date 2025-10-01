/**
 * EventProcessor API Contract
 *
 * This contract defines the public API for the EventProcessor class.
 * The processor transforms raw protocol events into UI-ready ProcessedEvent objects.
 */

import type { Event } from '../../../codex-chrome/src/protocol/types';
import type { ProcessedEvent, OperationState, StreamingState } from '../../../codex-chrome/src/types/ui';

/**
 * EventProcessor Contract
 *
 * Transforms raw events from the agent into UI-ready processed events.
 * Maintains state for multi-event operations (Begin→Delta→End sequences).
 */
export interface IEventProcessor {
  /**
   * Process a single event and return a ProcessedEvent ready for UI display.
   *
   * @param event - Raw event from protocol/types.ts
   * @returns ProcessedEvent or null if event should not be displayed
   *          (e.g., intermediate delta that's being accumulated)
   *
   * @example
   * const processor = new EventProcessor();
   * const event = { id: 'evt_1', msg: { type: 'AgentMessage', data: { message: 'Hello' } } };
   * const processed = processor.processEvent(event);
   * // { id: 'evt_1', category: 'message', title: 'codex', content: 'Hello', ... }
   */
  processEvent(event: Event): ProcessedEvent | null;

  /**
   * Reset processor state (clear all operation and streaming state).
   * Called when starting a new task/session.
   *
   * @example
   * processor.reset(); // Clear all state, ready for new task
   */
  reset(): void;

  /**
   * Get current streaming state (for debugging/testing).
   *
   * @returns Map of streaming states by type
   */
  getStreamingState(): Map<string, StreamingState>;

  /**
   * Get current operation states (for debugging/testing).
   *
   * @returns Map of operation states by call_id
   */
  getOperationState(): Map<string, OperationState>;

  /**
   * Set whether to show agent reasoning events.
   *
   * @param show - true to show reasoning, false to hide
   * @default true
   *
   * @example
   * processor.setShowReasoning(false); // Hide reasoning events
   */
  setShowReasoning(show: boolean): void;

  /**
   * Set maximum lines to display for command output.
   * Content exceeding this will be truncated.
   *
   * @param maxLines - Maximum lines (default: 20)
   *
   * @example
   * processor.setMaxOutputLines(50); // Show up to 50 lines
   */
  setMaxOutputLines(maxLines: number): void;
}

/**
 * Contract Tests
 *
 * These tests must pass for any implementation of IEventProcessor.
 */
export const EventProcessorContractTests = {
  /**
   * Test: Process simple agent message
   */
  'should transform AgentMessage to ProcessedEvent with category message': (
    processor: IEventProcessor
  ) => {
    const event: Event = {
      id: 'evt_123',
      msg: {
        type: 'AgentMessage',
        data: { message: 'Test message' }
      }
    };

    const result = processor.processEvent(event);

    if (!result) throw new Error('Expected ProcessedEvent, got null');
    if (result.category !== 'message') throw new Error(`Expected category 'message', got '${result.category}'`);
    if (result.title !== 'codex') throw new Error(`Expected title 'codex', got '${result.title}'`);
    if (result.content !== 'Test message') throw new Error(`Expected content 'Test message', got '${result.content}'`);
  },

  /**
   * Test: Handle streaming message deltas
   */
  'should accumulate AgentMessageDelta events': (
    processor: IEventProcessor
  ) => {
    // First delta - should return null (accumulating)
    const delta1: Event = {
      id: 'evt_200',
      msg: { type: 'AgentMessageDelta', data: { delta: 'Hello ' } }
    };
    const result1 = processor.processEvent(delta1);
    if (result1 !== null) throw new Error('First delta should return null');

    // Second delta - still accumulating
    const delta2: Event = {
      id: 'evt_201',
      msg: { type: 'AgentMessageDelta', data: { delta: 'world!' } }
    };
    const result2 = processor.processEvent(delta2);
    if (result2 !== null) throw new Error('Second delta should return null');

    // Final message - should return accumulated content
    const final: Event = {
      id: 'evt_202',
      msg: { type: 'AgentMessage', data: { message: 'Hello world!' } }
    };
    const result3 = processor.processEvent(final);
    if (!result3) throw new Error('Final message should return ProcessedEvent');
    if (result3.content !== 'Hello world!') {
      throw new Error(`Expected 'Hello world!', got '${result3.content}'`);
    }
  },

  /**
   * Test: Process command execution sequence
   */
  'should correlate ExecCommand Begin/End events by call_id': (
    processor: IEventProcessor
  ) => {
    // Begin event
    const begin: Event = {
      id: 'evt_300',
      msg: {
        type: 'ExecCommandBegin',
        data: {
          session_id: 'exec_001',
          command: 'ls -la',
          cwd: '/home/user'
        }
      }
    };
    const result1 = processor.processEvent(begin);
    // Begin might return ProcessedEvent or null depending on implementation

    // End event - should have metadata from Begin
    const end: Event = {
      id: 'evt_301',
      msg: {
        type: 'ExecCommandEnd',
        data: {
          session_id: 'exec_001',
          exit_code: 0,
          duration_ms: 42
        }
      }
    };
    const result2 = processor.processEvent(end);
    if (!result2) throw new Error('End event should return ProcessedEvent');
    if (result2.category !== 'tool') throw new Error(`Expected category 'tool', got '${result2.category}'`);
    if (!result2.metadata?.command) throw new Error('Expected metadata.command from Begin event');
    if (result2.metadata.duration !== 42) throw new Error(`Expected duration 42, got ${result2.metadata.duration}`);
  },

  /**
   * Test: Handle errors gracefully
   */
  'should process Error event with error category': (
    processor: IEventProcessor
  ) => {
    const event: Event = {
      id: 'evt_500',
      msg: {
        type: 'Error',
        data: { message: 'Something went wrong' }
      }
    };

    const result = processor.processEvent(event);

    if (!result) throw new Error('Expected ProcessedEvent, got null');
    if (result.category !== 'error') throw new Error(`Expected category 'error', got '${result.category}'`);
    if (!result.content.includes('Something went wrong')) {
      throw new Error(`Expected error message in content, got '${result.content}'`);
    }
  },

  /**
   * Test: Reset clears all state
   */
  'should clear state on reset': (
    processor: IEventProcessor
  ) => {
    // Create some state
    const delta: Event = {
      id: 'evt_600',
      msg: { type: 'AgentMessageDelta', data: { delta: 'Test' } }
    };
    processor.processEvent(delta);

    // Verify state exists
    const stateBefore = processor.getStreamingState();
    if (stateBefore.size === 0) throw new Error('Expected streaming state to exist');

    // Reset
    processor.reset();

    // Verify state cleared
    const stateAfter = processor.getStreamingState();
    if (stateAfter.size !== 0) throw new Error('Expected streaming state to be cleared');
  },

  /**
   * Test: Handle unknown event types
   */
  'should handle unknown event types gracefully': (
    processor: IEventProcessor
  ) => {
    const event: Event = {
      id: 'evt_999',
      msg: {
        type: 'UnknownEventType' as any,
        data: {}
      }
    };

    // Should not throw
    const result = processor.processEvent(event);

    // Should return a system event
    if (!result) throw new Error('Expected ProcessedEvent for unknown type');
    if (result.category !== 'system') throw new Error(`Expected category 'system', got '${result.category}'`);
  },
};

/**
 * Performance Contract
 *
 * Performance requirements for EventProcessor implementations.
 */
export const EventProcessorPerformanceContract = {
  /**
   * Processing a single event should take <5ms
   */
  maxProcessingTimeMs: 5,

  /**
   * Memory per ProcessedEvent should be <1KB
   */
  maxMemoryPerEventKB: 1,

  /**
   * Should handle 100 events/second without lag
   */
  minThroughputEventsPerSecond: 100,
};

/**
 * Error Handling Contract
 *
 * Required error handling behaviors.
 */
export const EventProcessorErrorHandling = {
  /**
   * Must not throw on malformed events
   */
  'should not throw on malformed event data': true,

  /**
   * Must handle missing required fields gracefully
   */
  'should provide defaults for missing fields': true,

  /**
   * Must handle null/undefined event data
   */
  'should handle null event data': true,

  /**
   * Must handle extremely long content (>100KB)
   */
  'should truncate content exceeding limits': true,
};
