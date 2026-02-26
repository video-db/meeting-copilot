/**
 * MCP Client Service
 *
 * Wrapper around the MCP SDK for managing a single MCP server connection.
 * Handles connection lifecycle, tool discovery, and tool execution.
 */

import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { logger } from '../../lib/logger';
import type {
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPConnectionStatus,
} from '../../../shared/types/mcp.types';
import { decryptCredentials } from '../../utils/encryption';

const log = logger.child({ module: 'mcp-client' });

export interface MCPClientEvents {
  'connected': { serverId: string; tools: MCPTool[] };
  'disconnected': { serverId: string; reason: string };
  'error': { serverId: string; error: string };
  'tool-result': MCPToolResult;
}

export class MCPClientService extends EventEmitter {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private config: MCPServerConfig;
  private tools: MCPTool[] = [];
  private connectionStatus: MCPConnectionStatus = 'disconnected';

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Get the server ID
   */
  get serverId(): string {
    return this.config.id;
  }

  /**
   * Get the server name
   */
  get serverName(): string {
    return this.config.name;
  }

  /**
   * Get current connection status
   */
  getStatus(): MCPConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
      log.warn({ serverId: this.config.id }, 'Already connected or connecting');
      return;
    }

    this.connectionStatus = 'connecting';
    log.info({ serverId: this.config.id, transport: this.config.transport }, 'Connecting to MCP server');

    try {
      // Create client
      this.client = new Client(
        {
          name: 'meeting-copilot',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Create transport based on type
      if (this.config.transport === 'stdio') {
        await this.connectStdio();
      } else {
        await this.connectHttp();
      }

      // Discover tools
      await this.discoverTools();

      this.connectionStatus = 'connected';
      this.emit('connected', { serverId: this.config.id, tools: this.tools });
      log.info({ serverId: this.config.id, toolCount: this.tools.length }, 'Connected to MCP server');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.connectionStatus = 'error';
      this.emit('error', { serverId: this.config.id, error: errorMessage });
      log.error({ serverId: this.config.id, error }, 'Failed to connect to MCP server');
      throw error;
    }
  }

  /**
   * Connect via stdio transport
   */
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    // Decrypt environment variables if present
    let env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (this.config.env) {
      try {
        const decryptedEnv = typeof this.config.env === 'string'
          ? decryptCredentials(this.config.env)
          : this.config.env;
        env = { ...env, ...decryptedEnv };
      } catch (error) {
        log.warn({ serverId: this.config.id }, 'Failed to decrypt env, using as-is');
        if (typeof this.config.env === 'object') {
          env = { ...env, ...this.config.env };
        }
      }
    }

    // Parse args
    const args = typeof this.config.args === 'string'
      ? JSON.parse(this.config.args)
      : this.config.args || [];

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args,
      env,
    });

    await this.client!.connect(this.transport);
  }

  /**
   * Connect via HTTP/SSE transport
   */
  private async connectHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required for HTTP transport');
    }

    // Decrypt headers if present
    let headers: Record<string, string> = {};
    if (this.config.headers) {
      try {
        headers = typeof this.config.headers === 'string'
          ? decryptCredentials(this.config.headers)
          : this.config.headers;
      } catch (error) {
        log.warn({ serverId: this.config.id }, 'Failed to decrypt headers, using as-is');
        if (typeof this.config.headers === 'object') {
          headers = this.config.headers;
        }
      }
    }

    this.transport = new SSEClientTransport(new URL(this.config.url), {
      requestInit: {
        headers,
      },
    });

    await this.client!.connect(this.transport);
  }

  /**
   * Discover available tools from the server
   */
  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const result = await this.client.listTools();

    this.tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool['inputSchema'],
      serverId: this.config.id,
      serverName: this.config.name,
    }));

    log.info({ serverId: this.config.id, tools: this.tools.map(t => t.name) }, 'Discovered tools');
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    input?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    if (!this.client || this.connectionStatus !== 'connected') {
      throw new Error('Not connected to MCP server');
    }

    const startTime = Date.now();
    const id = `${this.config.id}:${toolName}:${startTime}`;

    log.info({
      serverId: this.config.id,
      serverName: this.config.name,
      toolName,
      input,
      inputKeys: input ? Object.keys(input) : [],
    }, 'MCP Tool: Executing tool call');

    try {
      log.debug({
        serverId: this.config.id,
        toolName,
        fullInput: JSON.stringify(input, null, 2),
      }, 'MCP Tool: Full input payload');

      const result = await this.client.callTool({
        name: toolName,
        arguments: input || {},
      });

      const durationMs = Date.now() - startTime;

      log.info({
        serverId: this.config.id,
        toolName,
        durationMs,
        resultType: typeof result.content,
        resultLength: JSON.stringify(result.content).length,
      }, 'MCP Tool: Raw result received');

      const toolResult: MCPToolResult = {
        id,
        serverId: this.config.id,
        toolName,
        status: 'success',
        result: result.content,
        durationMs,
        timestamp: new Date().toISOString(),
      };

      this.emit('tool-result', toolResult);
      log.info({ serverId: this.config.id, toolName, durationMs }, 'Tool execution completed');

      return toolResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const toolResult: MCPToolResult = {
        id,
        serverId: this.config.id,
        toolName,
        status: 'error',
        error: errorMessage,
        durationMs,
        timestamp: new Date().toISOString(),
      };

      this.emit('tool-result', toolResult);
      log.error({ serverId: this.config.id, toolName, error }, 'Tool execution failed');

      return toolResult;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(reason: string = 'Manual disconnect'): Promise<void> {
    if (this.connectionStatus === 'disconnected') {
      return;
    }

    log.info({ serverId: this.config.id, reason }, 'Disconnecting from MCP server');

    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      this.client = null;
      this.tools = [];
      this.connectionStatus = 'disconnected';

      this.emit('disconnected', { serverId: this.config.id, reason });
    } catch (error) {
      log.error({ serverId: this.config.id, error }, 'Error during disconnect');
      this.connectionStatus = 'disconnected';
      this.emit('disconnected', { serverId: this.config.id, reason: 'Error during disconnect' });
    }
  }

  /**
   * Update configuration (requires reconnect)
   */
  updateConfig(config: Partial<MCPServerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a specific tool is available
   */
  hasTool(toolName: string): boolean {
    return this.tools.some((t) => t.name === toolName);
  }

  /**
   * Get a specific tool by name
   */
  getTool(toolName: string): MCPTool | undefined {
    return this.tools.find((t) => t.name === toolName);
  }
}

export default MCPClientService;
