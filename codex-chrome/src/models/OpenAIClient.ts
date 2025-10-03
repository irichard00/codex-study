/**
 * OpenAI API client implementation for codex-chrome
 * Implements the ModelClient interface with OpenAI-specific functionality
 */

import {
  ModelClient,
  ModelClientError,
  type CompletionRequest,
  type CompletionResponse,
  type StreamChunk,
  type Message,
  type ToolCall,
} from './ModelClient';
import { StreamProcessor } from '../core/StreamProcessor';

/**
 * OpenAI-specific request format
 */
interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_completion_tokens?: number;
  tools?: OpenAITool[];
  stream?: boolean;
}

/**
 * OpenAI message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/**
 * OpenAI tool definition format
 */
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

/**
 * OpenAI tool call format
 */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI completion response format
 */
interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

/**
 * OpenAI choice format
 */
interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * OpenAI usage format
 */
interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI streaming chunk format
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
}

/**
 * Token counting mappings for different models
 */
const TOKEN_MULTIPLIERS: Record<string, number> = {
  'gpt-4': 1.3,
  'gpt-4-turbo': 1.3,
  'gpt-4o': 1.2,
};

/**
 * OpenAI API client implementation
 */
export class OpenAIClient extends ModelClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organization?: string;
  private streamProcessor: StreamProcessor | null = null;
  private currentModel: string = 'gpt-5';
  private reasoningEffort: any = null;
  private reasoningSummary: any = { enabled: false };

  constructor(
    apiKey: string,
    options: {
      baseUrl?: string;
      organization?: string;
    } = {}
  ) {
    super();

    if (!apiKey?.trim()) {
      throw new ModelClientError('OpenAI API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.organization = options.organization;
  }

  getProvider(): import('./types/ResponsesAPI').ModelProviderInfo {
    // Return minimal provider info for OpenAI Chat Completions API
    return {
      name: 'openai',
      wireApi: 'Chat',
      requiresOpenaiAuth: true,
    };
  }

  getModel(): string {
    return this.currentModel;
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getContextWindow(): number | undefined {
    return this.getModelContextWindow();
  }

  getModelContextWindow(): number | undefined {
    // Return context window sizes for known OpenAI models
    const contextWindows: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-5': 200000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
    };
    return contextWindows[this.currentModel];
  }

  getAutoCompactTokenLimit(): number | undefined {
    const contextWindow = this.getModelContextWindow();
    return contextWindow ? Math.floor(contextWindow * 0.8) : undefined;
  }

  getModelFamily(): any {
    // Return minimal model family info for Chat Completions
    return {
      family: this.currentModel,
      baseInstructions: '',
      supportsReasoningSummaries: false,
      needsSpecialApplyPatchInstructions: false,
    };
  }

  getAuthManager(): any {
    // Chrome extension doesn't use auth manager
    return undefined;
  }

  getReasoningEffort(): any {
    return this.reasoningEffort;
  }

  setReasoningEffort(effort: any): void {
    this.reasoningEffort = effort;
  }

  getReasoningSummary(): any {
    return this.reasoningSummary;
  }

  setReasoningSummary(summary: any): void {
    this.reasoningSummary = summary;
  }

  protected async *streamResponses(request: import('./ModelClient').CompletionRequest): AsyncGenerator<import('./types/ResponsesAPI').ResponseEvent> {
    throw new ModelClientError('streamResponses not supported by Chat Completions API - use streamChat instead');
  }

  protected async *streamChat(request: import('./ModelClient').CompletionRequest): AsyncGenerator<import('./types/ResponsesAPI').ResponseEvent> {
    // Convert streaming chunks to ResponseEvents
    for await (const chunk of this.stream(request)) {
      if (chunk.delta?.content) {
        yield { type: 'OutputTextDelta', delta: chunk.delta.content };
      }
    }
  }

  protected async *attemptStreamResponses(
    request: import('./ModelClient').CompletionRequest,
    attempt: number
  ): AsyncGenerator<import('./types/ResponsesAPI').ResponseEvent, void, unknown> {
    throw new ModelClientError('attemptStreamResponses not supported by Chat Completions API');
  }

  protected async *processSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<import('./types/ResponsesAPI').ResponseEvent> {
    throw new ModelClientError('processSSE not supported by Chat Completions API');
  }

  protected parseRateLimitSnapshot(headers: Headers): import('./types/RateLimits').RateLimitSnapshot | undefined {
    // Chat Completions API doesn't provide detailed rate limit headers like Responses API
    return undefined;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.validateRequest(request);

    const openaiRequest = this.convertToOpenAIRequest(request);

    const response = await this.withRetry(
      () => this.makeRequest(openaiRequest),
      (error) => this.isRetryableError(error)
    );

    return this.convertFromOpenAIResponse(response);
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    this.validateRequest(request);

    const openaiRequest = this.convertToOpenAIRequest({ ...request, stream: true });

    const response = await this.withRetry(
      () => this.makeStreamRequest(openaiRequest),
      (error) => this.isRetryableError(error)
    );

    if (!response.body) {
      throw new ModelClientError('Stream response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }

          const data = trimmed.slice(6); // Remove 'data: ' prefix

          if (data === '[DONE]') {
            return;
          }

          try {
            const chunk: OpenAIStreamChunk = JSON.parse(data);
            const streamChunk = this.convertStreamChunk(chunk);

            if (streamChunk) {
              yield streamChunk;
            }
          } catch (error) {
            // Skip malformed chunks
            console.warn('Failed to parse stream chunk:', error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  countTokens(text: string, model: string): number {
    // Simple token counting approximation
    // In a real implementation, this would use tiktoken or similar
    const multiplier = TOKEN_MULTIPLIERS[model] || 1.4;
    const words = text.split(/\s+/).length;
    const punctuation = (text.match(/[.!?;:,]/g) || []).length;

    return Math.ceil((words + punctuation * 0.5) * multiplier);
  }

  private convertToOpenAIRequest(request: CompletionRequest): OpenAICompletionRequest {
    return {
      model: request.model,
      messages: request.messages.map(this.convertMessage),
      temperature: request.temperature,
      max_completion_tokens: request.maxTokens,
      tools: request.tools?.map(tool => ({
        type: tool.type,
        function: tool.function,
      })),
      stream: request.stream,
    };
  }

  private convertMessage(message: Message): OpenAIMessage {
    return {
      role: message.role,
      content: message.content,
      tool_calls: message.toolCalls?.map(toolCall => ({
        id: toolCall.id,
        type: toolCall.type,
        function: toolCall.function,
      })),
      tool_call_id: message.toolCallId,
    };
  }

  private convertFromOpenAIResponse(response: OpenAICompletionResponse): CompletionResponse {
    return {
      id: response.id,
      model: response.model,
      choices: response.choices.map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          toolCalls: choice.message.tool_calls?.map(toolCall => ({
            id: toolCall.id,
            type: toolCall.type,
            function: toolCall.function,
          })),
          toolCallId: choice.message.tool_call_id,
        },
        finishReason: choice.finish_reason,
      })),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  private convertStreamChunk(chunk: OpenAIStreamChunk): StreamChunk | null {
    const choice = chunk.choices[0];

    if (!choice) {
      return null;
    }

    const streamChunk: StreamChunk = {};

    if (choice.delta) {
      streamChunk.delta = {};

      if (choice.delta.content) {
        streamChunk.delta.content = choice.delta.content;
      }

      if (choice.delta.tool_calls) {
        streamChunk.delta.toolCalls = choice.delta.tool_calls.map(toolCall => ({
          id: toolCall.id,
          type: toolCall.type,
          function: toolCall.function,
        }));
      }
    }

    if (choice.finish_reason) {
      streamChunk.finishReason = choice.finish_reason;
    }

    return streamChunk;
  }

  private async makeRequest(request: OpenAICompletionRequest): Promise<OpenAICompletionResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = `OpenAI API error: ${errorData.error.message}`;
        }
      } catch {
        // Use the raw error text if JSON parsing fails
        if (errorText) {
          errorMessage = `OpenAI API error: ${errorText}`;
        }
      }

      throw new ModelClientError(
        errorMessage,
        response.status,
        'openai',
        this.isRetryableHttpError(response.status)
      );
    }

    const data = await response.json();
    return data;
  }

  private async makeStreamRequest(request: OpenAICompletionRequest): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'text/event-stream',
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = `OpenAI API error: ${errorData.error.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage = `OpenAI API error: ${errorText}`;
        }
      }

      throw new ModelClientError(
        errorMessage,
        response.status,
        'openai',
        this.isRetryableHttpError(response.status)
      );
    }

    return response;
  }

  protected isRetryableError(error: any): boolean {
    if (error instanceof ModelClientError) {
      return error.retryable;
    }

    // Network errors are generally retryable
    return error.name === 'TypeError' && error.message.includes('fetch');
  }

  /**
   * Stream completion with ResponseEvent format (matching codex-rs ResponseEvent)
   * This is the main streaming method used by TurnManager
   *
   * Port of process_chat_sse from codex-rs/core/src/chat_completions.rs:355-633
   */
  async *streamCompletion(request: CompletionRequest): AsyncGenerator<any> {
    this.validateRequest(request);

    const openaiRequest = this.convertToOpenAIRequest({ ...request, stream: true });
    const response = await this.makeStreamRequest(openaiRequest);

    if (!response.body) {
      throw new ModelClientError('Stream response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // State to accumulate a function call across streaming chunks (lines 370-376)
    interface FunctionCallState {
      name?: string;
      arguments: string;
      callId?: string;
      active: boolean;
    }

    const fnCallState: FunctionCallState = {
      arguments: '',
      active: false,
    };

    let assistantText = '';
    let reasoningText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Stream closed gracefully – emit Completed with dummy id (lines 394-402)
          if (assistantText) {
            yield {
              type: 'OutputItemDone',
              item: {
                type: 'message',
                role: 'assistant',
                content: assistantText,
              },
            };
          }

          if (reasoningText) {
            yield {
              type: 'OutputItemDone',
              item: {
                type: 'reasoning',
                content: reasoningText,
              },
            };
          }

          yield {
            type: 'Completed',
            responseId: '',
            tokenUsage: undefined,
          };
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }

          const data = trimmed.slice(6); // Remove 'data: ' prefix

          // OpenAI Chat streaming sends "[DONE]" when finished (line 416)
          if (data === '[DONE]') {
            // Emit any finalized items before closing (lines 418-448)
            if (assistantText) {
              yield {
                type: 'OutputItemDone',
                item: {
                  type: 'message',
                  role: 'assistant',
                  content: assistantText,
                },
              };
            }

            if (reasoningText) {
              yield {
                type: 'OutputItemDone',
                item: {
                  type: 'reasoning',
                  content: reasoningText,
                },
              };
            }

            yield {
              type: 'Completed',
              responseId: '',
              tokenUsage: undefined,
            };
            return;
          }

          try {
            // Parse JSON chunk (line 452)
            const chunk: any = JSON.parse(data);
            const choice = chunk.choices?.[0];

            if (!choice) continue;

            // Handle assistant content tokens as streaming deltas (lines 461-472)
            const content = choice.delta?.content;
            if (content && content.length > 0) {
              assistantText += content;
              yield {
                type: 'OutputTextDelta',
                delta: content,
              };
            }

            // Forward any reasoning/thinking deltas if present (lines 474-506)
            // Some providers stream `reasoning` as a plain string while others
            // nest the text under an object (e.g. `{ "reasoning": { "text": "…" } }`)
            const reasoningVal = choice.delta?.reasoning;
            if (reasoningVal) {
              let maybeText: string | undefined;

              if (typeof reasoningVal === 'string' && reasoningVal.length > 0) {
                maybeText = reasoningVal;
              } else if (typeof reasoningVal === 'object') {
                const text = reasoningVal.text || reasoningVal.content;
                if (typeof text === 'string' && text.length > 0) {
                  maybeText = text;
                }
              }

              if (maybeText) {
                reasoningText += maybeText;
                yield {
                  type: 'ReasoningContentDelta',
                  delta: maybeText,
                };
              }
            }

            // Some providers only include reasoning on the final message object (lines 508-531)
            const messageReasoning = choice.message?.reasoning;
            if (messageReasoning) {
              let reasoningStr: string | undefined;

              if (typeof messageReasoning === 'string' && messageReasoning.length > 0) {
                reasoningStr = messageReasoning;
              } else if (typeof messageReasoning === 'object') {
                const text = messageReasoning.text || messageReasoning.content;
                if (typeof text === 'string' && text.length > 0) {
                  reasoningStr = text;
                }
              }

              if (reasoningStr) {
                reasoningText += reasoningStr;
                yield {
                  type: 'ReasoningContentDelta',
                  delta: reasoningStr,
                };
              }
            }

            // Handle streaming function / tool calls (lines 533-559)
            const toolCalls = choice.delta?.tool_calls;
            if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
              const toolCall = toolCalls[0];

              // Mark that we have an active function call in progress
              fnCallState.active = true;

              // Extract call_id if present
              if (toolCall.id) {
                fnCallState.callId = toolCall.id;
              }

              // Extract function details if present
              if (toolCall.function) {
                if (toolCall.function.name) {
                  fnCallState.name = toolCall.function.name;
                }

                if (toolCall.function.arguments) {
                  fnCallState.arguments += toolCall.function.arguments;
                }
              }
            }

            // Emit end-of-turn when finish_reason signals completion (lines 561-630)
            const finishReason = choice.finish_reason;
            if (finishReason) {
              if (finishReason === 'tool_calls' && fnCallState.active) {
                // First, flush the terminal raw reasoning (lines 565-577)
                if (reasoningText) {
                  yield {
                    type: 'OutputItemDone',
                    item: {
                      type: 'reasoning',
                      content: reasoningText,
                    },
                  };
                  reasoningText = '';
                }

                // Then emit the FunctionCall response item (lines 579-587)
                yield {
                  type: 'OutputItemDone',
                  item: {
                    type: 'function_call',
                    call_id: fnCallState.callId || '',
                    name: fnCallState.name || '',
                    arguments: fnCallState.arguments,
                  },
                };
              } else if (finishReason === 'stop') {
                // Regular turn without tool-call (lines 589-613)
                if (assistantText) {
                  yield {
                    type: 'OutputItemDone',
                    item: {
                      type: 'message',
                      role: 'assistant',
                      content: assistantText,
                    },
                  };
                  assistantText = '';
                }

                if (reasoningText) {
                  yield {
                    type: 'OutputItemDone',
                    item: {
                      type: 'reasoning',
                      content: reasoningText,
                    },
                  };
                  reasoningText = '';
                }
              }

              // Emit Completed regardless of reason (lines 618-624)
              yield {
                type: 'Completed',
                responseId: '',
                tokenUsage: undefined,
              };

              return; // End processing for this SSE stream (line 629)
            }
          } catch (error) {
            // Skip malformed chunks
            console.warn('Failed to parse stream chunk:', error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stream with direct StreamProcessor access for UI updates
   */
  async streamWithProcessor(
    request: CompletionRequest,
    onUpdate?: (update: any) => void
  ): Promise<StreamProcessor> {
    this.validateRequest(request);

    const openaiRequest = this.convertToOpenAIRequest({ ...request, stream: true });
    const response = await this.makeStreamRequest(openaiRequest);

    if (!response.body) {
      throw new ModelClientError('Stream response body is null');
    }

    const processor = new StreamProcessor('model');

    // Set up UI update callback if provided
    if (onUpdate) {
      processor.onUpdate(onUpdate);
    }

    await processor.start(response.body);
    return processor;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.streamProcessor) {
      this.streamProcessor.stop();
      this.streamProcessor = null;
    }
  }
}