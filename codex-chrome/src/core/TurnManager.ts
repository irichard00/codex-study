/**
 * TurnManager implementation - ports run_turn functionality from codex-rs
 * Manages individual conversation turns, handles model streaming, and coordinates tool calls
 */

import { Session } from './Session';
import type { ToolDefinition } from '../tools/BaseTool';
import { TurnContext } from './TurnContext';
import type { CompletionRequest, CompletionResponse } from '../models/ModelClient';
import { loadPrompt, loadUserInstructions } from './PromptLoader';
import type { EventMsg, TokenUsage, StreamErrorEvent } from '../protocol/events';
import type { Event, InputItem } from '../protocol/types';
import type { ResponseEvent } from '../models/types/ResponseEvent';
import { v4 as uuidv4 } from 'uuid';
import { ToolRegistry } from '../tools/ToolRegistry';
import type { IToolsConfig } from '../config/types';
import { mapResponseItemToEventMessages } from './events/EventMapping';
import type { ResponseItem } from '../protocol/types';

/**
 * Result of processing a single response item
 */
export interface ProcessedResponseItem {
  /** The response item from the model */
  item: any;
  /** Optional response that needs to be sent back to model */
  response?: any;
}

/**
 * Result of a complete turn execution
 */
export interface TurnRunResult {
  /** All processed response items from this turn */
  processedItems: ProcessedResponseItem[];
  /** Total token usage for this turn */
  totalTokenUsage?: TokenUsage;
}

/**
 * Configuration for turn execution
 */
export interface TurnConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelayMs?: number;
  /** Maximum delay between retries in milliseconds */
  maxRetryDelayMs?: number;
}


/**
 * Prompt structure for model requests
 */
export interface Prompt {
  /** Input messages/items for this turn */
  input: any[];
  /** Available tools */
  tools: ToolDefinition[];
  /** Override base instructions */
  baseInstructionsOverride?: string;
}

/**
 * TurnManager handles execution of individual conversation turns
 * Port of run_turn and try_run_turn functions from codex-rs/core/src/codex.rs
 */
export class TurnManager {
  private session: Session;
  private turnContext: TurnContext;
  private toolRegistry: ToolRegistry;
  private config: TurnConfig;
  private cancelled = false;

  constructor(
    session: Session,
    turnContext: TurnContext,
    toolRegistry: ToolRegistry,
    config: TurnConfig = {}
  ) {
    this.session = session;
    this.turnContext = turnContext;
    this.toolRegistry = toolRegistry;
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      ...config,
    };
  }

  /**
   * Cancel the current turn
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Check if turn is cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Run a complete turn with retry logic
   */
  async runTurn(input: any[]): Promise<TurnRunResult> {
    // Build tools list from turn context
    const tools = await this.buildToolsFromContext();

    const prompt: Prompt = {
      input,
      tools,
      baseInstructionsOverride: this.turnContext.getBaseInstructions(),
    };

    let retries = 0;

    while (!this.cancelled) {
      try {
        return await this.tryRunTurn(prompt);
      } catch (error) {
        // Check for non-retryable errors
        if (this.cancelled) {
          throw new Error('Turn cancelled');
        }

        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Apply retry logic
        if (retries < (this.config.maxRetries || 3)) {
          retries++;
          const delay = this.calculateRetryDelay(retries, error);

          // Notify about retry attempt
          await this.emitStreamError(
            `Stream error: ${error instanceof Error ? error.message : String(error)}; retrying ${retries}/${this.config.maxRetries} in ${delay}ms`,
            true,
            retries
          );

          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw new Error('Turn cancelled');
  }

  /**
   * Attempt to run a turn once (without retry logic)
   */
  private async tryRunTurn(prompt: Prompt): Promise<TurnRunResult> {
    // Record turn context
    await this.recordTurnContext();

    // Process missing call IDs (calls that were interrupted)
    const processedPrompt = this.processMissingCalls(prompt);

    // Start model streaming (using new Prompt-based stream() API)
    const stream = await this.turnContext.getModelClient().stream(processedPrompt);

    const processedItems: ProcessedResponseItem[] = [];
    let totalTokenUsage: TokenUsage | undefined;

    try {
      // Process streaming response
      // Loop processes ResponseEvent items from the model stream.
      // We must inspect *both* Ok and Err cases so that transient stream failures
      // bubble up and trigger the caller's retry logic.
      for await (const event of stream) {
        // Check for cancellation
        if (this.cancelled) {
          throw new Error('Turn cancelled');
        }

        // Handle null/undefined event (stream closed without completion)
        if (!event) {
          throw new Error('stream closed before response.completed');
        }

        // Process the event based on ResponseEvent type
        switch (event.type) {
          case 'Created':
            // Initial event, no action needed
            break;

          case 'OutputItemDone': {
            // Item (message or tool call) is complete
            const response = await this.handleResponseItem(event.item);
            processedItems.push({
              item: event.item,
              response,
            });
            break;
          }

          case 'WebSearchCallBegin':
            // Web search started
            await this.emitEvent({
              type: 'WebSearchBegin',
              data: { call_id: event.callId },
            });
            break;

          case 'RateLimits':
            // Update rate limits (deferred until token usage available)
            // In the Rust version, this is handled by sess.update_rate_limits
            break;

          case 'Completed': {
            // Stream completed with final token usage
            totalTokenUsage = event.tokenUsage;

            return {
              processedItems,
              totalTokenUsage,
            };
          }

          case 'OutputTextDelta':
            // Streaming text delta
            await this.emitEvent({
              type: 'AgentMessageDelta',
              data: { delta: event.delta },
            });
            break;

          case 'ReasoningSummaryDelta':
            // Reasoning summary delta (for o1/o3 models)
            await this.emitEvent({
              type: 'ReasoningSummaryDelta',
              data: { delta: event.delta },
            });
            break;

          case 'ReasoningContentDelta':
            // Reasoning content delta (for o1/o3 models)
            await this.emitEvent({
              type: 'ReasoningContentDelta',
              data: { delta: event.delta },
            });
            break;

          case 'ReasoningSummaryPartAdded':
            // Reasoning summary part added
            await this.emitEvent({
              type: 'ReasoningSummaryPartAdded',
              data: {},
            });
            break;

          default:
            console.warn('Unknown ResponseEvent type:', event);
        }
      }

      // If loop exits without Completed event, stream was closed prematurely
      throw new Error('stream closed before response.completed');

    } catch (error) {
      // Handle streaming errors
      if (error instanceof Error && (error.message?.includes('stream closed') || error.name === 'StreamError')) {
        throw new Error(`Stream error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build tools list from turn context and session
   */
  private async buildToolsFromContext(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    // Get tools configuration from turn context
    const toolsConfig = this.turnContext.getToolsConfig() as IToolsConfig;

    // Get all registered browser tools from ToolRegistry
    const registeredTools = this.toolRegistry.listTools();

    // Check if all tools should be enabled
    const enableAllTools = toolsConfig.enable_all_tools ?? false;

    // Add browser tools from registry based on config
    for (const toolDef of registeredTools) {
      // Check if tool is explicitly disabled
      const isDisabled = toolsConfig.disabled?.includes(toolDef.name);

      if (!isDisabled) {
        // Convert ToolRegistry definition to Session ToolDefinition format
        tools.push({
          type: 'function',
          function: {
            name: toolDef.name,
            description: toolDef.description,
            parameters: toolDef.parameters || {},
          },
        });
      }
    }

    // Add agent execution tools based on config
    if (enableAllTools || toolsConfig.webSearch) {
      tools.push({
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      });
    }

    // Add update_plan tool (always enabled for task management)
    tools.push({
      type: 'function',
      function: {
        name: 'update_plan',
        description: 'Update the current task plan',
        parameters: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                },
                required: ['id', 'description', 'status'],
              },
            },
          },
          required: ['tasks'],
        },
      },
    });

    // Add MCP tools if enabled and available
    if (enableAllTools || toolsConfig.mcpTools !== false) {
      const mcpTools = await this.session.getMcpTools();
      // Convert MCP tools to ModelClient format
      const convertedMcpTools = mcpTools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters || {},
        },
      }));
      tools.push(...convertedMcpTools);
    }

    // Add custom tools if configured
    if (toolsConfig.customTools) {
      for (const [toolName, isEnabled] of Object.entries(toolsConfig.customTools)) {
        if (isEnabled || enableAllTools) {
          // Custom tools would be loaded from registry or another source
          const customTool = this.toolRegistry.getTool(toolName);
          if (customTool) {
            tools.push({
              type: 'function',
              function: {
                name: customTool.name,
                description: customTool.description,
                parameters: customTool.parameters || {},
              },
            });
          }
        }
      }
    }

    return tools;
  }

  /**
   * Process missing call IDs and add synthetic aborted responses
   */
  private processMissingCalls(prompt: Prompt): Prompt {
    const completedCallIds = new Set<string>();
    const pendingCallIds = new Set<string>();

    // Collect call IDs
    for (const item of prompt.input) {
      if (item.type === 'function_call_output' && item.call_id) {
        completedCallIds.add(item.call_id);
      }
      if (item.type === 'function_call' && item.call_id) {
        pendingCallIds.add(item.call_id);
      }
    }

    // Find missing calls
    const missingCallIds = [...pendingCallIds].filter(id => !completedCallIds.has(id));

    if (missingCallIds.length === 0) {
      return prompt;
    }

    // Add synthetic aborted responses for missing calls
    const syntheticResponses = missingCallIds.map(callId => ({
      type: 'function_call_output',
      call_id: callId,
      content: 'aborted',
      success: false,
    }));

    return {
      ...prompt,
      input: [...syntheticResponses, ...prompt.input],
    };
  }

  /**
   * Build completion request for model client
   */
  private async buildCompletionRequest(prompt: Prompt): Promise<CompletionRequest> {
    const model = this.turnContext.getModel();
    const request: CompletionRequest = {
      model,
      messages: await this.convertPromptToMessages(prompt),
      tools: prompt.tools,
      stream: true,
      maxTokens: 4096,
    };

    // For gpt-5, temperature must be 1 (default) or omitted
    // For other models, use 0.7
    if (model !== 'gpt-5') {
      request.temperature = 0.7;
    }

    return request;
  }

  /**
   * Convert prompt format to model client message format
   */
  private async convertPromptToMessages(prompt: Prompt): Promise<any[]> {
    const messages: any[] = [];

    // Load and add the agent prompt as system message
    const systemPrompt = await loadPrompt();
    messages.push({ role: 'system', content: systemPrompt });

    // Add user instructions (development guidelines from user_instruction.md)
    const userInstructions = this.turnContext.getUserInstructions();
    if (userInstructions) {
      messages.push({
        role: 'system',
        content: `<user_instructions>\n${userInstructions}\n</user_instructions>`,
      });
    }

    // Add base instructions if provided (as override)
    if (prompt.baseInstructionsOverride) {
      messages.push({
        role: 'system',
        content: prompt.baseInstructionsOverride,
      });
    }

    // Convert input items to messages
    for (const item of prompt.input) {
      if (item.role && item.content) {
        messages.push({
          role: item.role,
          content: item.content,
          toolCalls: item.toolCalls,
          toolCallId: item.toolCallId,
        });
      }
    }

    return messages;
  }

  /**
   * Handle a complete response item from the model
   * Port of handle_response_item from codex-rs
   */
  private async handleResponseItem(item: any): Promise<any | undefined> {
    // Check item type and handle accordingly
    if (item.type === 'function_call') {
      // Function call - execute and return response
      const { name, arguments: args, call_id } = item;

      try {
        const result = await this.executeToolCall(name, args, call_id);
        return result;
      } catch (error) {
        return {
          type: 'function_call_output',
          call_id,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    } else if (item.type === 'message' || item.type === 'reasoning' || item.type === 'web_search_call') {
      // Use event mapping to convert ResponseItem to EventMsg(s)
      // This matches the Rust logic in codex.rs line 2219-2235
      const showRawReasoning = this.session.getShowRawAgentReasoning?.() ?? false;
      const eventMsgs = mapResponseItemToEventMessages(item as ResponseItem, showRawReasoning);

      // Emit all mapped events
      for (const msg of eventMsgs) {
        if (msg && msg.type && msg.data) {
          await this.emitEvent(msg);
        } else {
          console.warn('Skipping malformed event from mapResponseItemToEventMessages:', msg);
        }
      }

      // Handle web search response if needed
      if (item.type === 'web_search_call') {
        const { call_id, action } = item;
        if (action?.type === 'search') {
          try {
            const result = await this.executeWebSearch(action.query);
            return {
              type: 'function_call_output',
              call_id,
              content: JSON.stringify(result),
              success: true,
            };
          } catch (error) {
            return {
              type: 'function_call_output',
              call_id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              success: false,
            };
          }
        }
      }

      return undefined;
    }

    // Other item types don't require responses
    return undefined;
  }

  /**
   * Execute a tool call and return the response
   */
  private async executeToolCall(toolName: string, parameters: any, callId: string): Promise<any> {
    try {
      let result: any;

      switch (toolName) {
        case 'exec_command':
          result = await this.executeCommand(parameters.command, parameters.cwd);
          break;

        case 'web_search':
          result = await this.executeWebSearch(parameters.query);
          break;

        case 'update_plan':
          result = await this.updatePlan(parameters.tasks);
          break;

        default:
          // Try MCP tools
          result = await this.executeMcpTool(toolName, parameters);
          break;
      }

      return {
        type: 'function_call_output',
        call_id: callId,
        content: JSON.stringify(result),
        success: true,
      };

    } catch (error) {
      return {
        type: 'function_call_output',
        call_id: callId,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }

  /**
   * Execute command in browser context
   */
  private async executeCommand(command: string, cwd?: string): Promise<any> {
    // Emit command begin event
    await this.emitEvent({
      type: 'ExecCommandBegin',
      data: {
        session_id: this.session.getSessionId(),
        command,
        tab_id: await this.getCurrentTabId(),
        url: await this.getCurrentUrl(),
      },
    });

    try {
      // In browser context, this would interact with page content
      // For now, return a placeholder response
      const result = {
        stdout: `Executed: ${command}`,
        stderr: '',
        exit_code: 0,
      };

      // Emit command end event
      await this.emitEvent({
        type: 'ExecCommandEnd',
        data: {
          session_id: this.session.getSessionId(),
          exit_code: result.exit_code,
        },
      });

      return result;

    } catch (error) {
      await this.emitEvent({
        type: 'ExecCommandEnd',
        data: {
          session_id: this.session.getSessionId(),
          exit_code: 1,
        },
      });
      throw error;
    }
  }

  /**
   * Execute web search
   */
  private async executeWebSearch(query: string): Promise<any> {
    await this.emitEvent({
      type: 'WebSearchBegin',
      data: { query },
    });

    try {
      // Placeholder web search implementation
      const results = {
        query,
        results: [
          { title: 'Sample Result', url: 'https://example.com', snippet: 'Sample snippet' },
        ],
      };

      await this.emitEvent({
        type: 'WebSearchEnd',
        data: {
          query,
          results_count: results.results.length,
        },
      });

      return results;
    } catch (error) {
      await this.emitEvent({
        type: 'WebSearchEnd',
        data: {
          query,
          results_count: 0,
        },
      });
      throw error;
    }
  }

  /**
   * Update task plan
   */
  private async updatePlan(tasks: any[]): Promise<any> {
    await this.emitEvent({
      type: 'PlanUpdate',
      data: { tasks },
    });

    return { success: true, tasks };
  }

  /**
   * Execute MCP tool
   */
  private async executeMcpTool(toolName: string, parameters: any): Promise<any> {
    await this.emitEvent({
      type: 'McpToolCallBegin',
      data: {
        tool_name: toolName,
        params: parameters,
      },
    });

    try {
      const result = await this.session.executeMcpTool(toolName, parameters);

      await this.emitEvent({
        type: 'McpToolCallEnd',
        data: {
          tool_name: toolName,
          result,
        },
      });

      return result;
    } catch (error) {
      await this.emitEvent({
        type: 'McpToolCallEnd',
        data: {
          tool_name: toolName,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * Record turn context for rollout/history
   */
  private async recordTurnContext(): Promise<void> {
    const turnContextItem = {
      cwd: this.turnContext.getCwd(),
      approval_policy: this.turnContext.getApprovalPolicy(),
      sandbox_policy: this.turnContext.getSandboxPolicy(),
      model: this.turnContext.getModel(),
      effort: this.turnContext.getEffort(),
      summary: this.turnContext.getSummary(),
    };

    await this.session.recordTurnContext(turnContextItem);
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('interrupted') ||
      message.includes('cancelled') ||
      message.includes('usage limit') ||
      message.includes('unauthorized') ||
      error.name === 'AuthenticationError'
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, error: any): number {
    // Check if error specifies a delay
    if (error.retryAfter) {
      return Math.min(error.retryAfter * 1000, this.config.maxRetryDelayMs || 30000);
    }

    // Exponential backoff
    const baseDelay = this.config.retryDelayMs || 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const maxDelay = this.config.maxRetryDelayMs || 30000;

    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * Convert model client token usage to protocol format
   */
  private convertTokenUsage(usage: any): TokenUsage {
    return {
      input_tokens: usage.prompt_tokens || 0,
      cached_input_tokens: usage.cached_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
      reasoning_output_tokens: usage.reasoning_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    };
  }

  /**
   * Get current browser tab ID
   */
  private async getCurrentTabId(): Promise<number | undefined> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      } catch (error) {
        console.warn('Failed to get current tab ID:', error);
      }
    }
    return undefined;
  }

  /**
   * Get current page URL
   */
  private async getCurrentUrl(): Promise<string | undefined> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.url;
      } catch (error) {
        console.warn('Failed to get current URL:', error);
      }
    }
    return undefined;
  }

  /**
   * Emit an event through the session
   */
  private async emitEvent(msg: EventMsg): Promise<void> {
    const event: Event = {
      id: uuidv4(),
      msg,
    };
    await this.session.emitEvent(event);
  }

  /**
   * Emit stream error event
   */
  private async emitStreamError(error: string, retrying: boolean, attempt?: number): Promise<void> {
    await this.emitEvent({
      type: 'StreamError',
      data: {
        error,
        retrying,
        attempt,
      },
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}