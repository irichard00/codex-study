/**
 * Tool Conversion Tests
 *
 * Tests the conversion of ToolDefinition to OpenAI API format in OpenAIClient
 */

import { describe, it, expect } from 'vitest';
import { OpenAIClient } from '@/models/OpenAIClient';
import type { ToolDefinition } from '@/tools/BaseTool';

describe('OpenAIClient Tool Conversion', () => {
  describe('convertToolsToOpenAIFormat', () => {
    it('should convert function tools to OpenAI format', () => {
      const client = new OpenAIClient('test-key');

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
              tabId: {
                type: 'number',
                description: 'Tab ID',
              },
            },
            required: ['action'],
            additionalProperties: false,
          },
        },
      };

      // Access private method via any cast for testing
      const result = (client as any).convertToolsToOpenAIFormat([toolDefinition]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'browser_tab',
          description: 'Manage browser tabs',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'The action to perform',
              },
              tabId: {
                type: 'number',
                description: 'Tab ID',
              },
            },
            required: ['action'],
            additionalProperties: false,
          },
        },
      });
    });

    it('should convert local_shell tool to OpenAI function format', () => {
      const client = new OpenAIClient('test-key');

      const toolDefinition: ToolDefinition = {
        type: 'local_shell',
      };

      const result = (client as any).convertToolsToOpenAIFormat([toolDefinition]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'local_shell',
          description: 'Execute local shell commands in the browser environment',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute',
              },
            },
            required: ['command'],
          },
        },
      });
    });

    it('should convert web_search tool to OpenAI function format', () => {
      const client = new OpenAIClient('test-key');

      const toolDefinition: ToolDefinition = {
        type: 'web_search',
      };

      const result = (client as any).convertToolsToOpenAIFormat([toolDefinition]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
            },
            required: ['query'],
          },
        },
      });
    });

    it('should convert custom tools to OpenAI function format', () => {
      const client = new OpenAIClient('test-key');

      const toolDefinition: ToolDefinition = {
        type: 'custom',
        custom: {
          name: 'custom_tool',
          description: 'A custom tool',
          format: {
            type: 'json',
            syntax: 'freeform',
            definition: '{}',
          },
        },
      };

      const result = (client as any).convertToolsToOpenAIFormat([toolDefinition]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'custom_tool',
          description: 'A custom tool',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: true,
          },
        },
      });
    });

    it('should handle nested object schemas', () => {
      const client = new OpenAIClient('test-key');

      const toolDefinition: ToolDefinition = {
        type: 'function',
        function: {
          name: 'complex_tool',
          description: 'A tool with nested parameters',
          strict: false,
          parameters: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  enabled: {
                    type: 'boolean',
                    description: 'Enable feature',
                  },
                  value: {
                    type: 'number',
                    description: 'Numeric value',
                  },
                },
                required: ['enabled'],
              },
            },
            required: ['config'],
          },
        },
      };

      const result = (client as any).convertToolsToOpenAIFormat([toolDefinition]);

      expect(result).toHaveLength(1);
      expect(result[0].function.parameters.properties.config).toEqual({
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Enable feature',
          },
          value: {
            type: 'number',
            description: 'Numeric value',
          },
        },
        required: ['enabled'],
      });
    });

    it('should handle array type schemas', () => {
      const client = new OpenAIClient('test-key');

      const toolDefinition: ToolDefinition = {
        type: 'function',
        function: {
          name: 'array_tool',
          description: 'A tool with array parameters',
          strict: false,
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'string',
                  description: 'String item',
                },
                description: 'Array of strings',
              },
            },
            required: ['items'],
          },
        },
      };

      const result = (client as any).convertToolsToOpenAIFormat([toolDefinition]);

      expect(result).toHaveLength(1);
      expect(result[0].function.parameters.properties.items).toEqual({
        type: 'array',
        items: {
          type: 'string',
          description: 'String item',
        },
        description: 'Array of strings',
      });
    });

    it('should filter out unknown tool types', () => {
      const client = new OpenAIClient('test-key');

      const tools = [
        {
          type: 'function',
          function: {
            name: 'valid_tool',
            description: 'Valid',
            strict: false,
            parameters: { type: 'object' as const, properties: {} },
          },
        },
        {
          type: 'unknown_type',
          something: {},
        },
      ];

      const result = (client as any).convertToolsToOpenAIFormat(tools);

      expect(result).toHaveLength(1);
      expect(result[0].function.name).toBe('valid_tool');
    });

    it('should handle multiple tools of different types', () => {
      const client = new OpenAIClient('test-key');

      const tools: ToolDefinition[] = [
        {
          type: 'function',
          function: {
            name: 'browser_tab',
            description: 'Tab tool',
            strict: false,
            parameters: { type: 'object' as const, properties: {} },
          },
        },
        {
          type: 'local_shell',
        },
        {
          type: 'web_search',
        },
      ];

      const result = (client as any).convertToolsToOpenAIFormat(tools);

      expect(result).toHaveLength(3);
      expect(result[0].function.name).toBe('browser_tab');
      expect(result[1].function.name).toBe('local_shell');
      expect(result[2].function.name).toBe('web_search');
    });
  });
});
