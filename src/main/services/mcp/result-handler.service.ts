/**
 * Result Handler Service
 *
 * Transforms MCP tool results into display format for the UI.
 * Determines the best display type (cue-card, panel, modal, toast) based on content.
 */

import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import type {
  MCPToolResult,
  MCPDisplayResult,
  MCPDisplayType,
  MCPDisplayContent,
  MCPTool,
} from '../../../shared/types/mcp.types';

const log = logger.child({ module: 'mcp-result-handler' });

// Content type detection patterns
const CONTENT_PATTERNS = {
  markdown: /^#|^\*\*|^\-\s|^```|^\|/m,
  table: /^\|.*\|$/m,
  json: /^\{[\s\S]*\}$|^\[[\s\S]*\]$/,
  list: /^[\-\*]\s+/m,
};

export class ResultHandlerService {
  /**
   * Transform a tool result into a display result
   */
  transformResult(
    result: MCPToolResult,
    tool?: MCPTool,
    serverName?: string
  ): MCPDisplayResult {
    const displayType = this.determineDisplayType(result, tool);
    const content = this.extractContent(result);
    const title = this.generateTitle(result, tool);

    const displayResult: MCPDisplayResult = {
      id: uuid(),
      toolCallId: result.id,
      serverId: result.serverId,
      serverName: serverName || result.serverId,
      toolName: result.toolName,
      displayType,
      title,
      content,
      timestamp: result.timestamp,
      dismissed: false,
      pinned: false,
    };

    log.info({
      toolCallId: result.id,
      displayType,
      hasContent: !!content,
    }, 'Transformed tool result for display');

    return displayResult;
  }

  /**
   * Determine the best display type based on content
   */
  private determineDisplayType(result: MCPToolResult, tool?: MCPTool): MCPDisplayType {
    // Errors should be toasts
    if (result.status === 'error') {
      return 'toast';
    }

    const content = result.result;

    // No content or minimal content -> toast
    if (!content) {
      return 'toast';
    }

    // Check content size and type
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    // Large content -> panel
    if (contentStr.length > 1000) {
      return 'panel';
    }

    // Structured data (tables, lists) -> cue-card
    if (this.isStructuredData(content)) {
      return 'cue-card';
    }

    // Based on tool type
    if (tool) {
      const toolName = tool.name.toLowerCase();

      // CRM results -> cue-card
      if (toolName.includes('contact') || toolName.includes('company') || toolName.includes('deal')) {
        return 'cue-card';
      }

      // Search results -> panel
      if (toolName.includes('search')) {
        return 'panel';
      }

      // Calendar -> cue-card
      if (toolName.includes('calendar') || toolName.includes('schedule')) {
        return 'cue-card';
      }

      // Memory/notes -> toast for small, cue-card for larger
      if (toolName.includes('memory') || toolName.includes('note')) {
        return contentStr.length > 200 ? 'cue-card' : 'toast';
      }
    }

    // Default to cue-card
    return 'cue-card';
  }

  /**
   * Check if content is structured data
   */
  private isStructuredData(content: unknown): boolean {
    if (typeof content === 'object' && content !== null) {
      // Arrays or objects with multiple keys
      if (Array.isArray(content) && content.length > 0) {
        return true;
      }
      if (Object.keys(content).length > 2) {
        return true;
      }
    }

    if (typeof content === 'string') {
      // Check for table or list patterns
      return CONTENT_PATTERNS.table.test(content) || CONTENT_PATTERNS.list.test(content);
    }

    return false;
  }

  /**
   * Extract and format content from the result
   */
  private extractContent(result: MCPToolResult): MCPDisplayContent {
    const content: MCPDisplayContent = {};

    if (result.status === 'error') {
      content.text = result.error || 'Unknown error';
      return content;
    }

    const rawContent = result.result;

    if (!rawContent) {
      content.text = 'No results found';
      return content;
    }

    // Handle MCP tool result format (array of content blocks)
    if (Array.isArray(rawContent)) {
      return this.extractFromContentBlocks(rawContent);
    }

    // Handle string content
    if (typeof rawContent === 'string') {
      if (CONTENT_PATTERNS.markdown.test(rawContent)) {
        content.markdown = rawContent;
      } else {
        content.text = rawContent;
      }
      return content;
    }

    // Handle object content
    if (typeof rawContent === 'object') {
      return this.extractFromObject(rawContent as Record<string, unknown>);
    }

    // Fallback
    content.raw = rawContent;
    return content;
  }

  /**
   * Extract content from MCP content blocks
   */
  private extractFromContentBlocks(blocks: unknown[]): MCPDisplayContent {
    const content: MCPDisplayContent = {};
    const textParts: string[] = [];

    for (const block of blocks) {
      if (typeof block === 'object' && block !== null) {
        const b = block as Record<string, unknown>;

        // Text content block
        if (b.type === 'text' && typeof b.text === 'string') {
          textParts.push(b.text);
        }

        // Resource content block
        if (b.type === 'resource' && b.resource) {
          const resource = b.resource as Record<string, unknown>;
          if (typeof resource.text === 'string') {
            textParts.push(resource.text);
          }
        }
      }
    }

    if (textParts.length > 0) {
      const combinedText = textParts.join('\n\n');

      if (CONTENT_PATTERNS.markdown.test(combinedText)) {
        content.markdown = combinedText;
      } else {
        content.text = combinedText;
      }
    } else {
      content.raw = blocks;
    }

    return content;
  }

  /**
   * Extract content from an object
   */
  private extractFromObject(obj: Record<string, unknown>): MCPDisplayContent {
    const content: MCPDisplayContent = {};

    // Check for specific known formats
    if (obj.text && typeof obj.text === 'string') {
      content.text = obj.text;
      return content;
    }

    if (obj.markdown && typeof obj.markdown === 'string') {
      content.markdown = obj.markdown;
      return content;
    }

    // Extract as properties
    const properties: Record<string, string | number | boolean> = {};
    const items: MCPDisplayContent['items'] = [];

    for (const [key, value] of Object.entries(obj)) {
      // Skip internal/metadata fields
      if (key.startsWith('_') || key === 'id') continue;

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        properties[key] = value;

        // Also add as items for display
        items.push({
          label: this.formatLabel(key),
          value: String(value),
          type: this.detectValueType(value),
        });
      }
    }

    if (Object.keys(properties).length > 0) {
      content.properties = properties;
      content.items = items;
    } else {
      content.raw = obj;
    }

    return content;
  }

  /**
   * Format a key as a label
   */
  private formatLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Detect value type for display
   */
  private detectValueType(value: unknown): 'text' | 'link' | 'badge' {
    if (typeof value === 'string') {
      if (value.match(/^https?:\/\//)) return 'link';
      if (value.match(/^[\w.-]+@[\w.-]+\.\w+$/)) return 'link';
    }
    return 'text';
  }

  /**
   * Generate a title for the display result
   */
  private generateTitle(result: MCPToolResult, tool?: MCPTool): string {
    if (result.status === 'error') {
      return `Error: ${result.toolName}`;
    }

    // Use tool description if available
    if (tool?.description) {
      return tool.description.split('.')[0]; // First sentence
    }

    // Format tool name as title
    return result.toolName
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Create an error display result
   */
  createErrorResult(
    serverId: string,
    serverName: string,
    toolName: string,
    error: string
  ): MCPDisplayResult {
    return {
      id: uuid(),
      toolCallId: uuid(),
      serverId,
      serverName,
      toolName,
      displayType: 'toast',
      title: `Error: ${toolName}`,
      content: {
        text: error,
      },
      timestamp: new Date().toISOString(),
      dismissed: false,
      pinned: false,
    };
  }

  /**
   * Create a loading/pending display result
   */
  createPendingResult(
    serverId: string,
    serverName: string,
    toolName: string
  ): MCPDisplayResult {
    return {
      id: uuid(),
      toolCallId: uuid(),
      serverId,
      serverName,
      toolName,
      displayType: 'toast',
      title: `Loading: ${this.formatLabel(toolName)}`,
      content: {
        text: 'Fetching data...',
      },
      timestamp: new Date().toISOString(),
      dismissed: false,
      pinned: false,
    };
  }
}

// Singleton instance
let instance: ResultHandlerService | null = null;

export function getResultHandler(): ResultHandlerService {
  if (!instance) {
    instance = new ResultHandlerService();
  }
  return instance;
}

export function resetResultHandler(): void {
  instance = null;
}

export default ResultHandlerService;
