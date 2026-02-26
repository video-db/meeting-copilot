/**
 * Tool Aggregator Service
 *
 * Aggregates tools from all connected MCP servers and provides
 * namespaced access to prevent naming conflicts. Format: serverId:toolName
 */

import { logger } from '../../lib/logger';
import { getConnectionRegistry, ConnectionRegistryService } from './connection-registry.service';
import type { MCPTool, MCPToolResult } from '../../../shared/types/mcp.types';

const log = logger.child({ module: 'mcp-tool-aggregator' });

export interface NamespacedTool extends MCPTool {
  namespacedName: string;
}

export interface ToolLookupResult {
  tool: MCPTool;
  serverId: string;
  serverName: string;
}

export class ToolAggregatorService {
  private registry: ConnectionRegistryService;

  constructor() {
    this.registry = getConnectionRegistry();
  }

  /**
   * Get all tools with namespaced names
   */
  getAllTools(): NamespacedTool[] {
    const tools = this.registry.getAllTools();

    return tools.map((tool) => ({
      ...tool,
      namespacedName: `${tool.serverId}:${tool.name}`,
    }));
  }

  /**
   * Get tools grouped by server
   */
  getToolsByServer(): Record<string, MCPTool[]> {
    const toolsByServer: Record<string, MCPTool[]> = {};

    for (const entry of this.registry.getAll()) {
      if (entry.status === 'connected') {
        toolsByServer[entry.config.id] = entry.client.getTools();
      }
    }

    return toolsByServer;
  }

  /**
   * Find a tool by its simple name (returns first match)
   */
  findToolByName(toolName: string): ToolLookupResult | undefined {
    const result = this.registry.findTool(toolName);
    if (!result) return undefined;

    return {
      tool: result.tool,
      serverId: result.tool.serverId,
      serverName: result.tool.serverName,
    };
  }

  /**
   * Find a tool by its namespaced name (serverId:toolName)
   */
  findToolByNamespace(namespacedName: string): ToolLookupResult | undefined {
    const result = this.registry.findToolByNamespace(namespacedName);
    if (!result) return undefined;

    return {
      tool: result.tool,
      serverId: result.tool.serverId,
      serverName: result.tool.serverName,
    };
  }

  /**
   * Find all tools matching a name pattern
   */
  findToolsByPattern(pattern: string | RegExp): NamespacedTool[] {
    const tools = this.getAllTools();
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

    return tools.filter((tool) =>
      regex.test(tool.name) || regex.test(tool.description || '')
    );
  }

  /**
   * Search tools by keywords in name or description
   */
  searchTools(query: string): NamespacedTool[] {
    const tools = this.getAllTools();
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/);

    return tools.filter((tool) => {
      const searchText = `${tool.name} ${tool.description || ''}`.toLowerCase();
      return keywords.some((kw) => searchText.includes(kw));
    });
  }

  /**
   * Get tools that match specific categories/intents
   */
  getToolsForIntent(intent: string): NamespacedTool[] {
    const intentKeywords: Record<string, string[]> = {
      crm: ['contact', 'deal', 'company', 'lead', 'account', 'opportunity', 'customer'],
      search: ['search', 'find', 'lookup', 'query', 'get'],
      calendar: ['calendar', 'schedule', 'meeting', 'event', 'availability'],
      docs: ['document', 'page', 'content', 'note', 'wiki'],
      memory: ['memory', 'remember', 'store', 'recall', 'note'],
    };

    const keywords = intentKeywords[intent.toLowerCase()] || [intent.toLowerCase()];
    const tools = this.getAllTools();

    return tools.filter((tool) => {
      const searchText = `${tool.name} ${tool.description || ''}`.toLowerCase();
      return keywords.some((kw) => searchText.includes(kw));
    });
  }

  /**
   * Execute a tool by namespaced name
   */
  async executeTool(
    namespacedName: string,
    input?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const result = this.registry.findToolByNamespace(namespacedName);
    if (!result) {
      throw new Error(`Tool ${namespacedName} not found`);
    }

    return result.client.executeTool(result.tool.name, input);
  }

  /**
   * Check if a specific tool is available
   */
  hasTool(nameOrNamespace: string): boolean {
    // Try namespaced first
    if (nameOrNamespace.includes(':')) {
      return !!this.registry.findToolByNamespace(nameOrNamespace);
    }

    // Then try simple name
    return !!this.registry.findTool(nameOrNamespace);
  }

  /**
   * Get tool count
   */
  getToolCount(): { total: number; byServer: Record<string, number> } {
    const byServer: Record<string, number> = {};
    let total = 0;

    for (const entry of this.registry.getAll()) {
      if (entry.status === 'connected') {
        const count = entry.client.getTools().length;
        byServer[entry.config.id] = count;
        total += count;
      }
    }

    return { total, byServer };
  }

  /**
   * Get a summary of available tools for LLM context
   */
  getToolsSummary(): string {
    const toolsByServer = this.getToolsByServer();
    const lines: string[] = ['Available MCP Tools:'];

    for (const [serverId, tools] of Object.entries(toolsByServer)) {
      const entry = this.registry.getEntry(serverId);
      const serverName = entry?.config.name || serverId;

      lines.push(`\n## ${serverName}`);

      for (const tool of tools) {
        lines.push(`- ${tool.name}: ${tool.description || 'No description'}`);
      }
    }

    return lines.join('\n');
  }
}

// Singleton instance
let instance: ToolAggregatorService | null = null;

export function getToolAggregator(): ToolAggregatorService {
  if (!instance) {
    instance = new ToolAggregatorService();
  }
  return instance;
}

export function resetToolAggregator(): void {
  instance = null;
}

export default ToolAggregatorService;
