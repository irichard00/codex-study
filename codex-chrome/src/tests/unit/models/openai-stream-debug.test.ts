/**
 * OpenAI Stream Debug Test
 *
 * Tests to debug the stream() method tool conversion issue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIClient } from '@/models/OpenAIClient';
import type { Prompt } from '@/models/types/ResponsesAPI';
import type { ToolDefinition } from '@/tools/BaseTool';

describe('OpenAI Stream Tool Conversion Debug', () => {
  let client: OpenAIClient;

  beforeEach(() => {
    client = new OpenAIClient('test-api-key');
  });

  it('should properly convert tools in stream() method', async () => {
    // Create a tool definition similar to what would come from ToolRegistry
    const toolDefinition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'browser_tab',
        description: 'Manage browser tabs',
        strict: false,
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'The action to perform',
            },
          },
          required: ['action'],
        },
      },
    };

    // Create a prompt like what would be passed to stream()
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: 'Create a new tab',
        },
      ],
      tools: [toolDefinition],
    };

    // Spy on convertToOpenAIRequest
    const convertSpy = vi.spyOn(client as any, 'convertToOpenAIRequest');

    // Mock fetch to prevent actual API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      },
    });

    try {
      await client.stream(prompt);
    } catch (e) {
      // Ignore errors, we just want to check the conversion
    }

    // Check that convertToOpenAIRequest was called
    expect(convertSpy).toHaveBeenCalled();

    // Get the request that was passed to convertToOpenAIRequest
    const callArgs = convertSpy.mock.calls[0];
    const request = callArgs[0];

    console.log('Request passed to convertToOpenAIRequest:', JSON.stringify(request, null, 2));

    // Verify the request has tools
    expect(request.tools).toBeDefined();
    expect(Array.isArray(request.tools)).toBe(true);
    expect(request.tools.length).toBe(1);

    // Verify the tool has the correct structure
    expect(request.tools[0].type).toBe('function');
    expect(request.tools[0].function).toBeDefined();
    expect(request.tools[0].function.name).toBe('browser_tab');
  });

  it('should handle the actual convertToolsToOpenAIFormat method', () => {
    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'browser_tab',
          description: 'Manage browser tabs',
          strict: false,
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action' },
            },
            required: ['action'],
          },
        },
      },
    ];

    const converted = (client as any).convertToolsToOpenAIFormat(tools);

    console.log('Converted tools:', JSON.stringify(converted, null, 2));

    expect(converted).toHaveLength(1);
    expect(converted[0]).toEqual({
      type: 'function',
      function: {
        name: 'browser_tab',
        description: 'Manage browser tabs',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action' },
          },
          required: ['action'],
        },
      },
    });
  });

  it('should check what convertToOpenAIRequest returns', () => {
    const request = {
      model: 'gpt-4',
      messages: [
        {
          role: 'user' as const,
          content: 'Hello',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'Test tool',
            strict: false,
            parameters: {
              type: 'object' as const,
              properties: {},
            },
          },
        },
      ],
      stream: true,
    };

    const openaiRequest = (client as any).convertToOpenAIRequest(request);

    console.log('OpenAI Request:', JSON.stringify(openaiRequest, null, 2));

    // Verify the converted request
    expect(openaiRequest.tools).toBeDefined();
    expect(openaiRequest.tools).toHaveLength(1);
    expect(openaiRequest.tools[0].type).toBe('function');
    expect(openaiRequest.tools[0].function).toBeDefined();
    expect(openaiRequest.tools[0].function.name).toBe('test_tool');
    expect(openaiRequest.tools[0].function.description).toBe('Test tool');
    expect(openaiRequest.tools[0].function.parameters).toBeDefined();
  });
});
