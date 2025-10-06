/**
 * Example: Using Tool Registry with OpenAI Client
 *
 * This example demonstrates how to register tools and use them with OpenAIClient.
 * The tools are automatically converted to OpenAI-compatible format.
 */

import { OpenAIClient } from '@/models/OpenAIClient';
import { ToolRegistry } from '@/tools/ToolRegistry';
import { TabTool } from '@/tools/TabTool';
import { DOMTool } from '@/tools/DOMTool';
import { createFunctionTool } from '@/tools/BaseTool';

async function example() {
  // 1. Create OpenAI client
  const client = new OpenAIClient(process.env.OPENAI_API_KEY || 'test-key');

  // 2. Create tool registry
  const registry = new ToolRegistry();

  // 3. Register browser tools
  const tabTool = new TabTool();
  const domTool = new DOMTool();

  await registry.register(
    tabTool.getDefinition(),
    async (params, context) => {
      return await tabTool.execute(params, { metadata: context.metadata });
    }
  );

  await registry.register(
    domTool.getDefinition(),
    async (params, context) => {
      return await domTool.execute(params, { metadata: context.metadata });
    }
  );

  // 4. Add built-in tools
  await registry.register(
    { type: 'local_shell' },
    async (params) => {
      console.log('Executing shell command:', params.command);
      return { output: 'Command executed' };
    }
  );

  await registry.register(
    { type: 'web_search' },
    async (params) => {
      console.log('Searching:', params.query);
      return { results: [] };
    }
  );

  // 5. Create a custom tool
  const customTool = createFunctionTool(
    'get_current_time',
    'Get the current time',
    {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "UTC", "America/New_York")',
        },
      },
      required: [],
    }
  );

  await registry.register(customTool, async (params) => {
    const tz = params.timezone || 'UTC';
    return {
      time: new Date().toLocaleString('en-US', { timeZone: tz }),
      timezone: tz,
    };
  });

  // 6. Get all registered tools
  const tools = registry.listTools();
  console.log(`Registered ${tools.length} tools:`, tools.map(t =>
    t.type === 'function' ? t.function.name : t.type
  ));

  // 7. Use tools with OpenAI (they are automatically converted)
  const prompt = {
    input: [
      {
        type: 'message' as const,
        role: 'user' as const,
        content: 'What time is it in New York? Also, search for "latest tech news".',
      },
    ],
    tools, // Tools will be converted to OpenAI format automatically
  };

  // The client converts tools internally before sending to OpenAI
  const stream = await client.stream(prompt);

  // 8. Process streaming response
  for await (const event of stream.events()) {
    console.log('Event:', event);

    // If OpenAI calls a tool, execute it via registry
    if (event.type === 'OutputItemDone' && event.item.type === 'function_call') {
      const toolName = event.item.name;
      const toolArgs = JSON.parse(event.item.arguments);

      console.log(`Executing tool: ${toolName}`, toolArgs);

      const result = await registry.execute({
        toolName,
        parameters: toolArgs,
        sessionId: 'session-1',
        turnId: 'turn-1',
      });

      console.log('Tool result:', result);
    }
  }
}

// Example of tool definitions that get converted:

/**
 * Function Tool (already in correct format):
 * {
 *   type: 'function',
 *   function: {
 *     name: 'browser_tab',
 *     description: 'Manage browser tabs',
 *     parameters: { ... }
 *   }
 * }
 * ↓ (no conversion needed)
 * {
 *   type: 'function',
 *   function: {
 *     name: 'browser_tab',
 *     description: 'Manage browser tabs',
 *     parameters: { ... }
 *   }
 * }
 */

/**
 * Built-in Tool (converted to function):
 * { type: 'local_shell' }
 * ↓ (converted)
 * {
 *   type: 'function',
 *   function: {
 *     name: 'local_shell',
 *     description: 'Execute local shell commands in the browser environment',
 *     parameters: {
 *       type: 'object',
 *       properties: {
 *         command: { type: 'string', description: 'The shell command to execute' }
 *       },
 *       required: ['command']
 *     }
 *   }
 * }
 */

/**
 * Web Search Tool (converted to function):
 * { type: 'web_search' }
 * ↓ (converted)
 * {
 *   type: 'function',
 *   function: {
 *     name: 'web_search',
 *     description: 'Search the web for information',
 *     parameters: {
 *       type: 'object',
 *       properties: {
 *         query: { type: 'string', description: 'The search query' }
 *       },
 *       required: ['query']
 *     }
 *   }
 * }
 */

// Run example (uncomment to execute)
// example().catch(console.error);
