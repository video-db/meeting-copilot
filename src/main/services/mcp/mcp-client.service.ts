/**
 * MCP Client Service
 *
 * Wrapper around the MCP SDK for managing a single MCP server connection.
 * Handles connection lifecycle, tool discovery, and tool execution.
 */

import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from '../../lib/logger';
import type {
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPConnectionStatus,
} from '../../../shared/types/mcp.types';
import { decryptCredentials } from '../../utils/encryption';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';

const log = logger.child({ module: 'mcp-client' });

export interface MCPClientEvents {
  'connected': { serverId: string; tools: MCPTool[] };
  'disconnected': { serverId: string; reason: string };
  'error': { serverId: string; error: string };
  'auth-required': { serverId: string; authServerUrl?: string };
  'tool-result': MCPToolResult;
}

export interface MCPClientOptions {
  authProvider?: OAuthClientProvider;
}

export class MCPClientService extends EventEmitter {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null;
  private config: MCPServerConfig;
  private options: MCPClientOptions;
  private tools: MCPTool[] = [];
  private connectionStatus: MCPConnectionStatus = 'disconnected';

  constructor(config: MCPServerConfig, options: MCPClientOptions = {}) {
    super();
    this.config = config;
    this.options = options;
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
          name: 'call-md',
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

    const env: Record<string, string> = { ...getDefaultEnvironment() };

    if (this.config.env) {
      try {
        const configEnv = typeof this.config.env === 'string'
          ? decryptCredentials(this.config.env)
          : this.config.env;
        Object.assign(env, configEnv);
      } catch (error) {
        log.warn({ serverId: this.config.id }, 'Failed to decrypt env, using as-is');
        if (typeof this.config.env === 'object') {
          Object.assign(env, this.config.env);
        }
      }
    }

    // Parse args
    let args: string[] = [];
    if (typeof this.config.args === 'string') {
      try {
        args = JSON.parse(this.config.args);
      } catch {
        log.warn({ serverId: this.config.id }, 'Failed to parse args as JSON, treating as single argument');
        args = [this.config.args];
      }
    } else {
      args = this.config.args || [];
    }

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args,
      env,
    });

    await this.client!.connect(this.transport);
  }

  /**
   * Connect via HTTP transport (Streamable HTTP with SSE fallback)
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

    const url = new URL(this.config.url);
    const { authProvider } = this.options;

    // Try modern Streamable HTTP transport first
    try {
      this.transport = new StreamableHTTPClientTransport(url, {
        authProvider,
        requestInit: { headers },
      });
      await this.client!.connect(this.transport);
      log.info({ serverId: this.config.id }, 'Connected via Streamable HTTP transport');
    } catch (streamableError) {
      // Check if this is an auth error
      if (this.isAuthError(streamableError)) {
        log.info({ serverId: this.config.id }, 'Server requires OAuth authentication');
        this.emit('auth-required', { serverId: this.config.id });
        throw streamableError;
      }

      // Fall back to legacy SSE transport
      log.warn(
        { serverId: this.config.id, error: streamableError },
        'Streamable HTTP failed, falling back to SSE'
      );

      try {
        this.transport = new SSEClientTransport(url, {
          requestInit: { headers },
        });
        await this.client!.connect(this.transport);
        log.info({ serverId: this.config.id }, 'Connected via SSE transport (fallback)');
      } catch (sseError) {
        // Check if SSE also fails with auth error
        if (this.isAuthError(sseError)) {
          log.info({ serverId: this.config.id }, 'Server requires OAuth authentication (SSE)');
          this.emit('auth-required', { serverId: this.config.id });
        }
        throw sseError;
      }
    }
  }

  /**
   * Check if an error is an authentication error (401)
   */
  private isAuthError(error: unknown): boolean {
    log.debug({ error, errorType: typeof error, isError: error instanceof Error }, 'Checking if auth error');

    // Check Error instance message
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('401') ||
          message.includes('unauthorized') ||
          message.includes('authentication required')) {
        log.info({ serverId: this.config.id, message: error.message }, 'Detected auth error from Error message');
        return true;
      }
    }

    // Check plain object with code property
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;

      // Direct code check
      if (errorObj.code === 401 || errorObj.status === 401) {
        log.info({ serverId: this.config.id }, 'Detected auth error from error.code/status');
        return true;
      }

      // Check nested event object (SSE errors have this structure)
      if (typeof errorObj.event === 'object' && errorObj.event !== null) {
        const event = errorObj.event as Record<string, unknown>;
        if (event.code === 401 || event.status === 401) {
          log.info({ serverId: this.config.id }, 'Detected auth error from error.event.code');
          return true;
        }
      }

      // Check if it has a message property with 401
      if (typeof errorObj.message === 'string' && errorObj.message.includes('401')) {
        log.info({ serverId: this.config.id }, 'Detected auth error from error.message string');
        return true;
      }
    }

    return false;
  }

  /**
   * Set auth provider (for reconnecting with auth)
   */
  setAuthProvider(authProvider: OAuthClientProvider): void {
    this.options.authProvider = authProvider;
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
      if (this.client) {
        await this.client.close();
      }

      this.client = null;
      this.transport = null;
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
