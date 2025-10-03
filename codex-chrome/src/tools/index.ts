/**
 * Tool registration and management for codex-chrome
 */

import { ToolRegistry } from './ToolRegistry';
import { WebScrapingTool } from './WebScrapingTool';
import { FormAutomationTool } from './FormAutomationTool';
import { NetworkInterceptTool } from './NetworkInterceptTool';
import { DataExtractionTool } from './DataExtractionTool';
import { DOMTool } from './DOMTool';
import { NavigationTool } from './NavigationTool';
import { StorageTool } from './StorageTool';
import { TabTool } from './TabTool';
import type { IToolsConfig } from '../config/types';

// Re-export all tools
export { ToolRegistry } from './ToolRegistry';
export { BaseTool, createFunctionTool, createObjectSchema, createToolDefinition } from './BaseTool';
export type { ToolDefinition, JsonSchema, ResponsesApiTool, FreeformTool, FreeformToolFormat } from './BaseTool';
export { WebScrapingTool } from './WebScrapingTool';
export { FormAutomationTool } from './FormAutomationTool';
export { NetworkInterceptTool } from './NetworkInterceptTool';
export { DataExtractionTool } from './DataExtractionTool';
export { DOMTool } from './DOMTool';
export { NavigationTool } from './NavigationTool';
export { StorageTool } from './StorageTool';
export { TabTool } from './TabTool';

/**
 * Register browser automation tools based on configuration
 */
export async function registerTools(registry: ToolRegistry, toolsConfig: IToolsConfig): Promise<void> {
  try {
    console.log('Starting advanced tool registration...');

    // Helper function to check if a tool should be enabled
    const isToolEnabled = (toolName: string): boolean => {
      // Check if enable_all_tools is true
      if (toolsConfig.enable_all_tools === true) {
        return true;
      }

      // Check specific tool configuration
      switch (toolName) {
        case 'web_scraping':
          return toolsConfig.web_scraping_tool === true;
        case 'form_automation':
          return toolsConfig.form_automation_tool === true;
        case 'network_intercept':
          return toolsConfig.network_intercept_tool === true;
        case 'data_extraction':
          return toolsConfig.data_extraction_tool === true;
        case 'dom_tool':
          return toolsConfig.dom_tool === true;
        case 'navigation_tool':
          return toolsConfig.navigation_tool === true;
        case 'storage_tool':
          return toolsConfig.storage_tool === true;
        case 'tab_tool':
          return toolsConfig.tab_tool === true;
        default:
          return false;
      }
    };

    // Helper function to register a tool with error handling
    const registerTool = async (toolName: string, toolInstance: any, getDefinition: () => any) => {
      if (!registry.getTool(toolName)) {
        const definition = getDefinition();
        console.log(`Registering ${toolName}...`);

        if (definition && definition.name) {
          await registry.register(definition, async (params, context) => {
            return toolInstance.execute(params);
          });
        } else {
          console.error(`${toolName} definition missing name`);
        }
      } else {
        console.log(`${toolName} already registered, skipping...`);
      }
    };

    // Web Scraping Tool
    if (isToolEnabled('web_scraping')) {
      const webScrapingTool = new WebScrapingTool();
      const webScrapingDefinition = webScrapingTool.getDefinition();

      if (!webScrapingDefinition || !webScrapingDefinition.name) {
        console.error('WebScrapingTool definition is missing name. Definition:', webScrapingDefinition);

        // Try to create a fallback definition
        const fallbackDefinition = {
          name: 'web_scraping',
          description: 'Extract structured data from web pages using patterns',
          parameters: {
            type: 'object' as const,
            properties: {},
            required: [],
            additionalProperties: false
          }
        };

        console.log('Using fallback definition for web_scraping');
        await registry.register(fallbackDefinition, async (params, context) => {
          return webScrapingTool.execute(params);
        });
      } else {
        await registerTool('web_scraping', webScrapingTool, () => webScrapingTool.getDefinition());
      }
    } else {
      console.log('WebScrapingTool disabled in configuration, skipping...');
    }

    // Form Automation Tool
    if (isToolEnabled('form_automation')) {
      const formAutomationTool = new FormAutomationTool();
      await registerTool('form_automation', formAutomationTool, () => formAutomationTool.getDefinition());
    } else {
      console.log('FormAutomationTool disabled in configuration, skipping...');
    }

    // Network Intercept Tool
    if (isToolEnabled('network_intercept')) {
      const networkInterceptTool = new NetworkInterceptTool();
      await registerTool('network_intercept', networkInterceptTool, () => networkInterceptTool.getDefinition());
    } else {
      console.log('NetworkInterceptTool disabled in configuration, skipping...');
    }

    // Data Extraction Tool
    if (isToolEnabled('data_extraction')) {
      const dataExtractionTool = new DataExtractionTool();
      await registerTool('data_extraction', dataExtractionTool, () => dataExtractionTool.getDefinition());
    } else {
      console.log('DataExtractionTool disabled in configuration, skipping...');
    }

    // DOM Tool
    if (isToolEnabled('dom_tool')) {
      const domTool = new DOMTool();
      await registerTool('dom_tool', domTool, () => domTool.getDefinition());
    } else {
      console.log('DOMTool disabled in configuration, skipping...');
    }

    // Navigation Tool
    if (isToolEnabled('navigation_tool')) {
      const navigationTool = new NavigationTool();
      await registerTool('navigation_tool', navigationTool, () => navigationTool.getDefinition());
    } else {
      console.log('NavigationTool disabled in configuration, skipping...');
    }

    // Storage Tool
    if (isToolEnabled('storage_tool')) {
      const storageTool = new StorageTool();
      await registerTool('storage_tool', storageTool, () => storageTool.getDefinition());
    } else {
      console.log('StorageTool disabled in configuration, skipping...');
    }

    // Tab Tool
    if (isToolEnabled('tab_tool')) {
      const tabTool = new TabTool();
      await registerTool('tab_tool', tabTool, () => tabTool.getDefinition());
    } else {
      console.log('TabTool disabled in configuration, skipping...');
    }

    console.log('Advanced browser tools registration completed');
  } catch (error) {
    console.error('Failed to register advanced tools:', error);
  }
}

/**
 * Initialize all tools
 */
export async function initializeTools(toolsConfig?: IToolsConfig): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  // Only register tools if configuration is provided
  if (toolsConfig) {
    await registerTools(registry, toolsConfig);
  } else {
    console.log('No tools configuration provided, skipping advanced tools registration');
  }

  console.log(`Total tools registered: ${registry.listTools().length}`);
  return registry;
}

/**
 * Get tool definitions for OpenAI/model format
 */
export function getToolDefinitions(registry: ToolRegistry): any[] {
  return registry.listTools().map((tool: any) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  registry: ToolRegistry,
  name: string,
  parameters: any,
  sessionId: string = 'default-session',
  turnId: string = 'default-turn'
): Promise<any> {
  return registry.execute({
    toolName: name,
    parameters: parameters,
    sessionId: sessionId,
    turnId: turnId
  });
}

/**
 * Cleanup all tools
 */
export async function cleanupTools(registry: ToolRegistry): Promise<void> {
  registry.clear();
}