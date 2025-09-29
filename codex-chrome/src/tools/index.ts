/**
 * Tool registration and management for codex-chrome
 */

import { ToolRegistry } from './ToolRegistry';
import { WebScrapingTool } from './WebScrapingTool';
import { FormAutomationTool } from './FormAutomationTool';
import { NetworkInterceptTool } from './NetworkInterceptTool';
import { DataExtractionTool } from './DataExtractionTool';

// Re-export all tools
export { ToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { WebScrapingTool } from './WebScrapingTool';
export { FormAutomationTool } from './FormAutomationTool';
export { NetworkInterceptTool } from './NetworkInterceptTool';
export { DataExtractionTool } from './DataExtractionTool';

/**
 * Register all basic/existing tools
 */
export function registerBasicTools(registry: ToolRegistry): void {
  // Register existing basic tools here
  // These would be the original tools from the codebase
  // For now, just a placeholder
  console.log('Registering basic tools...');
}

/**
 * Register advanced browser automation tools
 */
export function registerAdvancedTools(registry: ToolRegistry): void {
  try {
    // Register new browser-specific tools
    console.log('Starting advanced tool registration...');

    const webScrapingTool = new WebScrapingTool();
    const webScrapingDefinition = webScrapingTool.getDefinition();
    console.log('WebScrapingTool definition:', JSON.stringify(webScrapingDefinition, null, 2));

    // Check if definition has a name
    if (!webScrapingDefinition || !webScrapingDefinition.name) {
      console.error('WebScrapingTool definition is missing name. Definition:', webScrapingDefinition);
      console.error('WebScrapingTool instance:', webScrapingTool);

      // Try to create a fallback definition
      const fallbackDefinition = {
        name: 'web_scraping',
        description: 'Extract structured data from web pages using patterns',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        }
      };

      console.log('Using fallback definition:', fallbackDefinition);
      registry.register(fallbackDefinition, async (params, context) => {
        return webScrapingTool.execute(params);
      });
    } else {
      registry.register(webScrapingDefinition, async (params, context) => {
        return webScrapingTool.execute(params);
      });
    }

    // Form Automation Tool
    const formAutomationTool = new FormAutomationTool();
    const formDefinition = formAutomationTool.getDefinition();
    if (formDefinition && formDefinition.name) {
      registry.register(formDefinition, async (params, context) => {
        return formAutomationTool.execute(params);
      });
    } else {
      console.error('FormAutomationTool definition missing name');
    }

    // Network Intercept Tool
    const networkInterceptTool = new NetworkInterceptTool();
    const networkDefinition = networkInterceptTool.getDefinition();
    if (networkDefinition && networkDefinition.name) {
      registry.register(networkDefinition, async (params, context) => {
        return networkInterceptTool.execute(params);
      });
    } else {
      console.error('NetworkInterceptTool definition missing name');
    }

    // Data Extraction Tool
    const dataExtractionTool = new DataExtractionTool();
    const dataDefinition = dataExtractionTool.getDefinition();
    if (dataDefinition && dataDefinition.name) {
      registry.register(dataDefinition, async (params, context) => {
        return dataExtractionTool.execute(params);
      });
    } else {
      console.error('DataExtractionTool definition missing name');
    }

    console.log('Advanced browser tools registered successfully');
  } catch (error) {
    console.error('Failed to register advanced tools:', error);
  }
}

/**
 * Initialize all tools
 */
export async function initializeTools(): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  // Register all tool categories
  registerBasicTools(registry);
  registerAdvancedTools(registry);

  // Initialize the registry
  await registry.initialize();

  console.log(`Total tools registered: ${registry.getToolCount()}`);
  return registry;
}

/**
 * Get tool definitions for OpenAI/model format
 */
export function getToolDefinitions(registry: ToolRegistry): any[] {
  return registry.getAllTools().map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.getParameterSchema()
    }
  }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  registry: ToolRegistry,
  name: string,
  parameters: any
): Promise<any> {
  return registry.execute(name, parameters);
}

/**
 * Cleanup all tools
 */
export async function cleanupTools(registry: ToolRegistry): Promise<void> {
  await registry.cleanup();
}