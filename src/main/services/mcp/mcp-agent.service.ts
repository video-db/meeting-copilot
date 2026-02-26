/**
 * MCP Agent Service
 *
 * Agentic loop that listens to transcripts and automatically calls MCP tools
 * using LLM function calling. Maintains conversation context across runs
 * for coherent multi-turn interactions.
 */

import { logger } from '../../lib/logger';
import { getLLMService, type ChatMessage, type Tool, type ToolCall } from '../llm.service';
import { getToolAggregator } from './tool-aggregator.service';
import { getConnectionOrchestrator } from './connection-orchestrator.service';
import type { MCPTool } from '../../../shared/types/mcp.types';
import type { TranscriptSegmentData } from '../copilot/transcript-buffer.service';

const log = logger.child({ module: 'mcp-agent' });

const MAX_TOOL_CALLS = 5; // Prevent infinite loops
const MAX_CONVERSATION_HISTORY = 20; // Limit conversation history to prevent token overflow

export interface MCPAgentResult {
  success: boolean;
  response: string | null;
  toolsCalled: Array<{
    serverId: string;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    success: boolean;
  }>;
  error?: string;
}

export class MCPAgentService {
  private toolAggregator = getToolAggregator();
  private orchestrator = getConnectionOrchestrator();

  // Map short tool names to full serverId + toolName (reset per run)
  private toolNameMap: Map<string, { serverId: string; toolName: string }> = new Map();

  // Persistent conversation history for coherent multi-turn interactions
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string | null = null;

  // Custom trigger keywords set by user in settings
  private customTriggerKeywords: string[] = [];

  /**
   * Generate a short, unique tool name (max 32 chars for OpenAI compatibility)
   * Format: serverPrefix_toolName (truncated if needed)
   */
  private generateShortToolName(serverId: string, toolName: string, index: number): string {
    // Extract a short server prefix (first 8 chars of server name/id after 'mcp-')
    const serverPrefix = serverId.replace(/^mcp-/, '').slice(0, 6);

    // Tool name limit: 32 - serverPrefix(6) - underscore(1) - index(2) = 23 chars max
    const truncatedToolName = toolName.slice(0, 20);

    // Format: s{prefix}_{index}_{tool} to ensure uniqueness
    const shortName = `s${serverPrefix}_${index}_${truncatedToolName}`;

    // Final safety check - truncate to 32 chars
    return shortName.slice(0, 32);
  }

  /**
   * Convert MCP tools to OpenAI function calling format
   * Tool names must be <= 32 characters for OpenAI API
   */
  private mcpToolsToOpenAIFormat(mcpTools: MCPTool[]): Tool[] {
    // Clear the map for this run
    this.toolNameMap.clear();

    return mcpTools.map((tool, index) => {
      const shortName = this.generateShortToolName(tool.serverId, tool.name, index);

      this.toolNameMap.set(shortName, {
        serverId: tool.serverId,
        toolName: tool.name,
      });

      return {
        type: 'function' as const,
        function: {
          name: shortName,
          description: tool.description || `Tool from ${tool.serverName}: ${tool.name}`,
          parameters: this.convertInputSchema(tool.inputSchema),
        },
      };
    });
  }

  /**
   * Convert MCP input schema to OpenAI format
   */
  private convertInputSchema(inputSchema: MCPTool['inputSchema']): Tool['function']['parameters'] {
    if (!inputSchema || typeof inputSchema !== 'object') {
      return {
        type: 'object',
        properties: {},
      };
    }

    // Handle JSON Schema format
    const schema = inputSchema as Record<string, unknown>;

    return {
      type: 'object',
      properties: (schema.properties as Record<string, { type: string; description?: string; enum?: string[] }>) || {},
      required: (schema.required as string[]) || undefined,
    };
  }

  /**
   * Parse tool name from OpenAI format back to serverId and toolName
   * Uses the toolNameMap created during mcpToolsToOpenAIFormat
   */
  private parseToolName(openAIToolName: string): { serverId: string; toolName: string } | null {
    const mapping = this.toolNameMap.get(openAIToolName);
    if (!mapping) {
      return null;
    }

    return mapping;
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<{
    serverId: string;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    success: boolean;
    error?: string;
  }> {
    const parsed = this.parseToolName(toolCall.function.name);
    if (!parsed) {
      return {
        serverId: 'unknown',
        toolName: toolCall.function.name,
        input: {},
        output: null,
        success: false,
        error: 'Invalid tool name format',
      };
    }

    const { serverId, toolName } = parsed;
    let input: Record<string, unknown> = {};

    try {
      input = JSON.parse(toolCall.function.arguments || '{}');
    } catch (e) {
      log.warn({ arguments: toolCall.function.arguments }, 'Failed to parse tool arguments');
    }


    try {
      const result = await this.orchestrator.executeTool(serverId, toolName, input);

      return {
        serverId,
        toolName,
        input,
        output: result.result,
        success: result.status === 'success',
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        serverId,
        toolName,
        input,
        output: null,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build the system prompt for the MCP agent
   */
  private buildSystemPrompt(mcpTools: MCPTool[]): string {
    return `You are a helpful meeting assistant that has access to external tools to fetch information during meetings.

You are listening to a live conversation. When the conversation mentions something that could be enhanced with information from the available tools, you should call the appropriate tool to fetch that information.

IMPORTANT GUIDELINES:
1. Only call tools when the conversation clearly indicates a need for external information
2. Pay attention to keywords like: "documentation", "docs", "CRM", "customer info", "schedule", "calendar", "look up", "find", "fetch", "get me"
3. When you hear a request for information that matches a tool's capability, call that tool
4. After getting tool results, provide a brief, helpful summary of the relevant information
5. If no tools are relevant, respond with a brief message saying no relevant information was found
6. Remember previous context from this conversation - don't repeat yourself unnecessarily

Available tool servers and their purposes:
${mcpTools.map(t => `- ${t.serverName} (${t.serverId}): ${t.name} - ${t.description || 'No description'}`).join('\n')}`;
  }

  /**
   * Format recent transcript segments for context
   */
  private formatRecentSegments(segments: TranscriptSegmentData[]): string {
    return segments.map(seg => {
      const speaker = seg.channel === 'me' ? '[ME]' : '[THEM]';
      return `${speaker} ${seg.text}`;
    }).join('\n');
  }

  /**
   * Reset conversation history (call when a new recording/call starts)
   */
  resetConversation(): void {
    this.conversationHistory = [];
    this.systemPrompt = null;
  }

  /**
   * Set custom trigger keywords from user settings
   */
  setCustomTriggerKeywords(keywords: string[]): void {
    this.customTriggerKeywords = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);
  }

  /**
   * Get combined trigger keywords (default + custom)
   */
  private getCombinedTriggerKeywords(): string[] {
    // Default keywords that suggest external information might be helpful
    const defaultKeywords = [
      // Documentation
      'documentation', 'docs', 'document', 'guide', 'spec', 'specification',
      // CRM/Customer
      'customer', 'account', 'contact', 'deal', 'opportunity', 'crm', 'hubspot', 'salesforce',
      // Calendar/Scheduling
      'schedule', 'calendar', 'meeting', 'availability', 'book', 'appointment',
      // Search/Lookup
      'look up', 'find', 'fetch', 'get me', 'search', 'check',
      // Memory/History
      'remember', 'last time', 'previous', 'recall',
      // Specific platforms
      'coda', 'notion', 'confluence', 'wiki', 'jira', 'asana', 'trello',
      // Pricing/Product
      'pricing', 'price', 'cost', 'feature', 'integration',
    ];

    // Combine with custom keywords, avoiding duplicates
    const combined = [...defaultKeywords];
    for (const keyword of this.customTriggerKeywords) {
      if (!combined.includes(keyword)) {
        combined.push(keyword);
      }
    }

    return combined;
  }

  /**
   * Run the agentic loop with persistent conversation context
   *
   * Takes recent transcript segments and available tools, runs a while loop
   * calling tools until the LLM returns a text response.
   * Maintains conversation history for coherent multi-turn interactions.
   */
  async run(
    recentSegments: TranscriptSegmentData[],
    mcpTools: MCPTool[]
  ): Promise<MCPAgentResult> {
    const latestSegment = recentSegments[recentSegments.length - 1];


    if (mcpTools.length === 0) {
      return {
        success: false,
        response: null,
        toolsCalled: [],
        error: 'No MCP tools available',
      };
    }

    const llmService = getLLMService();
    if (!llmService) {
      return {
        success: false,
        response: null,
        toolsCalled: [],
        error: 'LLM service not available',
      };
    }

    // Convert MCP tools to OpenAI format
    const tools = this.mcpToolsToOpenAIFormat(mcpTools);

    // Initialize or update system prompt
    if (!this.systemPrompt) {
      this.systemPrompt = this.buildSystemPrompt(mcpTools);
    }

    // Build the new user message with recent context
    const recentContext = this.formatRecentSegments(recentSegments);
    const userMessage = `RECENT CONVERSATION (last ${recentSegments.length} statements):
${recentContext}

LATEST STATEMENT:
Speaker: ${latestSegment?.channel === 'me' ? 'You' : 'Other Participant'}
"${latestSegment?.text || ''}"

Based on the conversation above, determine if any tools should be called to fetch relevant information.`;

    // Add new user message to conversation history
    this.conversationHistory.push({ role: 'user', content: userMessage });

    // Trim history if too long (keep system + recent messages)
    if (this.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
      // Keep first few and last few messages
      const keepStart = 2;
      const keepEnd = MAX_CONVERSATION_HISTORY - keepStart;
      this.conversationHistory = [
        ...this.conversationHistory.slice(0, keepStart),
        ...this.conversationHistory.slice(-keepEnd),
      ];
    }

    // Build messages array with system prompt + conversation history
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory,
    ];

    const toolsCalled: MCPAgentResult['toolsCalled'] = [];
    let iterations = 0;

    // Agentic loop - keep calling tools until we get a text response
    while (iterations < MAX_TOOL_CALLS) {
      iterations++

      const response = await llmService.chatCompletionWithTools(messages, tools);

      if (!response.success) {
        return {
          success: false,
          response: null,
          toolsCalled,
          error: response.error,
        };
      }

      // Check if we got tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {

        // Add assistant message with tool calls to messages and history
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.content,
          tool_calls: response.tool_calls,
        };
        messages.push(assistantMessage);
        this.conversationHistory.push(assistantMessage);

        // Execute each tool call
        for (let i = 0; i < response.tool_calls.length; i++) {
          const toolCall = response.tool_calls[i];

          const toolStartTime = Date.now();
          const result = await this.executeToolCall(toolCall);
          const toolElapsedMs = Date.now() - toolStartTime;

          toolsCalled.push(result);

          // Add tool result to messages and history
          const toolResultContent = result.success
            ? JSON.stringify(result.output, null, 2)
            : `Error: ${result.error}`;

          const toolMessage: ChatMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResultContent,
          };
          messages.push(toolMessage);
          this.conversationHistory.push(toolMessage);
        }

        // Continue the loop to let LLM process the tool results
        continue;
      }

      // No tool calls - we got a final text response
      if (response.content) {
        // Add assistant response to history for future context
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content,
        });

        return {
          success: true,
          response: response.content,
          toolsCalled,
        };
      }

      break;
    }

    return {
      success: toolsCalled.length > 0,
      response: toolsCalled.length > 0
        ? `Called ${toolsCalled.length} tool(s) but reached iteration limit.`
        : null,
      toolsCalled,
      error: iterations >= MAX_TOOL_CALLS ? 'Reached maximum tool call limit' : undefined,
    };
  }

  /**
   * Determine if a transcript segment should trigger the agent
   * Uses simple heuristics to avoid calling the agent on every segment
   */
  shouldTrigger(segment: TranscriptSegmentData, conversationContext: string): boolean {
    const text = segment.text.toLowerCase();

    // Get combined default + custom keywords
    const triggerKeywords = this.getCombinedTriggerKeywords();

    // Check if any trigger keywords are present
    const matchedKeywords: string[] = [];
    for (const keyword of triggerKeywords) {
      if (text.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      return true;
    }

    return false;
  }
}

// Singleton instance
let instance: MCPAgentService | null = null;

export function getMCPAgent(): MCPAgentService {
  if (!instance) {
    instance = new MCPAgentService();
  }
  return instance;
}

export function resetMCPAgent(): void {
  if (instance) {
    instance.resetConversation();
  }
  instance = null;
}

export default MCPAgentService;
