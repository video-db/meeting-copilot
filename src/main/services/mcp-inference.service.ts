/**
 * MCP Inference Service
 *
 * Runs every 20 seconds during recording, analyzes transcript,
 * and calls MCP tools when the conversation warrants it.
 * Outputs markdown findings to the MCP Findings panel.
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger';
import { getLLMService, type ChatMessage, type Tool, type ToolCall } from './llm.service';
import { getToolAggregator } from './mcp/tool-aggregator.service';
import { getConnectionOrchestrator } from './mcp/connection-orchestrator.service';
import type { MCPTool, MCPDisplayResult } from '../../shared/types/mcp.types';

const log = logger.child({ module: 'mcp-inference' });

const MCP_INFERENCE_INTERVAL_MS = 20000; // 20 seconds
const MAX_TOOL_CALLS_PER_RUN = 3;

const SYSTEM_PROMPT = `You are a silent meeting assistant running in an agent loop. You receive a rolling 20-second transcript from an ongoing meeting. You have access to connected tools.

Your only job: when the conversation creates an information need that your tools can answer — fetch it and present it. Otherwise, return nothing.

---

## WHAT TO LISTEN FOR

**Active requests** — someone explicitly asks for information:
"Can we pull up the deal status for Acme?"
"What's on this week's plan?"
"When did we last contact them?"
→ Act immediately.

**Passive requests** — the conversation implies a need:
"I think the renewal is coming up soon" → your CRM can confirm the date.
"Wasn't there a task for this?" → your project tool can search.
→ Act if you have a matching tool and enough specifics to query.

---

## OUTPUT

Clean markdown the user can glance at mid-meeting. Lead with the data. Add a suggested talking point only if natural. Keep it short.

---

## RULES

- Never fabricate data. If a tool returns nothing, say so in one line.
- Every tool call must tie to something said in the transcript.
- Don't repeat a fetch already made this session unless explicitly asked again.
- Don't summarize the meeting or narrate your reasoning.
- If fetched data contains sensitive internals, flag it as not safe to share aloud.
- Silence is your default. An empty response is correct.`;

interface TranscriptChunk {
  text: string;
  source: 'mic' | 'system_audio';
  timestamp: number;
}

export interface MCPInferenceEvents {
  result: MCPDisplayResult;
}

class MCPInferenceService extends EventEmitter {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private transcriptBuffer: TranscriptChunk[] = [];
  private previousQueries: Set<string> = new Set(); // Track queries to avoid repetition
  private conversationHistory: ChatMessage[] = [];

  // Map short tool names to full serverId + toolName
  private toolNameMap: Map<string, { serverId: string; toolName: string }> = new Map();

  /**
   * Start the MCP inference loop
   */
  start(): void {
    if (this.isRunning) {
      log.warn('MCP inference already running');
      return;
    }

    log.info('Starting MCP inference service');
    this.isRunning = true;
    this.transcriptBuffer = [];
    this.previousQueries.clear();
    this.conversationHistory = [];

    // Run every 20 seconds (don't run immediately - wait for transcript to accumulate)
    this.intervalTimer = setInterval(() => {
      this.processTranscript();
    }, MCP_INFERENCE_INTERVAL_MS);
  }

  /**
   * Stop the MCP inference loop
   */
  stop(): void {
    if (!this.isRunning) return;

    log.info('Stopping MCP inference service');
    this.isRunning = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    this.transcriptBuffer = [];
    this.previousQueries.clear();
    this.conversationHistory = [];
  }

  /**
   * Add a transcript segment to the buffer
   */
  addTranscript(text: string, source: 'mic' | 'system_audio'): void {
    if (!this.isRunning) return;

    this.transcriptBuffer.push({
      text,
      source,
      timestamp: Date.now(),
    });

    // Keep only last 60 seconds of transcript for context
    const cutoff = Date.now() - 60000;
    this.transcriptBuffer = this.transcriptBuffer.filter(t => t.timestamp > cutoff);
  }

  /**
   * Generate a short, unique tool name for OpenAI compatibility
   */
  private generateShortToolName(serverId: string, toolName: string, index: number): string {
    const serverPrefix = serverId.replace(/^mcp-/, '').slice(0, 6);
    const truncatedToolName = toolName.slice(0, 20);
    const shortName = `s${serverPrefix}_${index}_${truncatedToolName}`;
    return shortName.slice(0, 32);
  }

  /**
   * Convert MCP tools to OpenAI function calling format
   */
  private mcpToolsToOpenAIFormat(mcpTools: MCPTool[]): Tool[] {
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
      return { type: 'object', properties: {} };
    }

    const schema = inputSchema as Record<string, unknown>;
    return {
      type: 'object',
      properties: (schema.properties as Record<string, { type: string; description?: string; enum?: string[] }>) || {},
      required: (schema.required as string[]) || undefined,
    };
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<{
    success: boolean;
    output: unknown;
    error?: string;
  }> {
    const mapping = this.toolNameMap.get(toolCall.function.name);
    if (!mapping) {
      return { success: false, output: null, error: 'Unknown tool' };
    }

    const { serverId, toolName } = mapping;
    let input: Record<string, unknown> = {};

    try {
      input = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      log.warn({ arguments: toolCall.function.arguments }, 'Failed to parse tool arguments');
    }

    try {
      const orchestrator = getConnectionOrchestrator();
      const result = await orchestrator.executeTool(serverId, toolName, input);

      // Track this query to avoid repetition
      const queryKey = `${toolName}:${JSON.stringify(input)}`;
      this.previousQueries.add(queryKey);

      return {
        success: result.status === 'success',
        output: result.result,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format transcript for the prompt
   */
  private formatTranscript(chunks: TranscriptChunk[]): string {
    return chunks
      .map(chunk => {
        const speaker = chunk.source === 'mic' ? 'You' : 'Them';
        return `[${speaker}]: ${chunk.text}`;
      })
      .join('\n');
  }

  /**
   * Process transcript and run MCP agent
   */
  private async processTranscript(): Promise<void> {
    if (!this.isRunning) return;

    // Get transcript from last 20 seconds
    const cutoff = Date.now() - MCP_INFERENCE_INTERVAL_MS;
    const recentChunks = this.transcriptBuffer.filter(t => t.timestamp > cutoff);

    if (recentChunks.length === 0) {
      log.debug('No recent transcript to process for MCP inference');
      return;
    }

    // Get available MCP tools
    const toolAggregator = getToolAggregator();
    const mcpTools = toolAggregator.getAllTools();

    if (mcpTools.length === 0) {
      log.debug('No MCP tools available');
      return;
    }

    const llm = getLLMService();
    if (!llm) {
      log.warn('LLM service not available');
      return;
    }

    const transcriptText = this.formatTranscript(recentChunks);
    log.info({ chunkCount: recentChunks.length, toolCount: mcpTools.length }, 'Processing transcript for MCP inference');

    // Convert tools to OpenAI format
    const tools = this.mcpToolsToOpenAIFormat(mcpTools);

    // Build the user message with transcript
    const userMessage = `## TRANSCRIPT (Last 20 seconds)

${transcriptText}

---

Analyze the transcript above. If there's an information need that your tools can answer, call the appropriate tool and provide the result. If nothing needs fetching, respond with an empty message.`;

    // Build messages
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.conversationHistory,
      { role: 'user', content: userMessage },
    ];

    try {
      let toolsCalled = 0;
      let finalResponse: string | null = null;

      // Agentic loop
      while (toolsCalled < MAX_TOOL_CALLS_PER_RUN) {
        const response = await llm.chatCompletionWithTools(messages, tools);

        if (!response.success) {
          log.warn({ error: response.error }, 'LLM call failed');
          break;
        }

        // Check for tool calls
        if (response.tool_calls && response.tool_calls.length > 0) {
          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.tool_calls,
          });

          // Execute tool calls
          for (const toolCall of response.tool_calls) {
            toolsCalled++;

            const result = await this.executeToolCall(toolCall);

            // Add tool result
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result.success
                ? JSON.stringify(result.output, null, 2)
                : `Error: ${result.error}`,
            });
          }

          // Continue loop to get final response
          continue;
        }

        // No tool calls - got final response
        finalResponse = response.content || null;
        break;
      }

      // If we got a non-empty response, emit it
      if (finalResponse && finalResponse.trim().length > 0) {
        // Add to conversation history for context
        this.conversationHistory.push({ role: 'user', content: userMessage });
        this.conversationHistory.push({ role: 'assistant', content: finalResponse });

        // Keep history manageable
        if (this.conversationHistory.length > 10) {
          this.conversationHistory = this.conversationHistory.slice(-10);
        }

        // Emit as MCPDisplayResult
        const displayResult: MCPDisplayResult = {
          id: uuid(),
          toolCallId: uuid(),
          serverId: 'mcp-inference',
          serverName: 'MCP Agent',
          toolName: 'inference',
          displayType: 'panel',
          title: 'MCP Findings',
          content: {
            markdown: finalResponse,
          },
          timestamp: new Date().toISOString(),
        };

        log.info({ responseLength: finalResponse.length }, 'Generated MCP inference result');
        this.emit('result', displayResult);
      } else {
        log.debug('MCP agent returned empty response (no action needed)');
      }
    } catch (error) {
      log.error({ error }, 'Error in MCP inference');
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.transcriptBuffer = [];
    this.previousQueries.clear();
    this.conversationHistory = [];
  }
}

// Singleton instance
let instance: MCPInferenceService | null = null;

export function getMCPInferenceService(): MCPInferenceService {
  if (!instance) {
    instance = new MCPInferenceService();
  }
  return instance;
}

export function resetMCPInferenceService(): void {
  if (instance) {
    instance.stop();
    instance.removeAllListeners();
    instance = null;
  }
}

export { MCPInferenceService };
