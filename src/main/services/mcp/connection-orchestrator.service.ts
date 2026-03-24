/**
 * Connection Orchestrator Service
 *
 * Central coordinator for MCP server connections. Manages lifecycle of all
 * MCP connections, handles auto-connect, and coordinates tool discovery.
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import { getConnectionRegistry, ConnectionRegistryService } from './connection-registry.service';
import { getHealthMonitor, HealthMonitorService } from './health-monitor.service';
import { getMCPAuthService, MCPAuthService, type MCPOAuthConfig } from './mcp-auth.service';
import { MCPClientService } from './mcp-client.service';
import {
  getAllMCPServers,
  getAutoConnectMCPServers,
  getMCPServerById,
  createMCPServer,
  updateMCPServer,
  updateMCPServerStatus,
  deleteMCPServer,
} from '../../db';
import { encryptCredentials } from '../../utils/encryption';
import type {
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPEvents,
  CreateMCPServerRequest,
  UpdateMCPServerRequest,
  MCPTestConnectionResult,
} from '../../../shared/types/mcp.types';

const log = logger.child({ module: 'mcp-orchestrator' });

export class ConnectionOrchestratorService extends EventEmitter {
  private registry: ConnectionRegistryService;
  private healthMonitor: HealthMonitorService;
  private authService: MCPAuthService;
  private initialized: boolean = false;

  constructor() {
    super();
    this.registry = getConnectionRegistry();
    this.healthMonitor = getHealthMonitor();
    this.authService = getMCPAuthService();

    // Forward auth events from registry
    this.registry.on('auth-required', (data) => {
      this.emit('auth-required', data);
    });

    // Forward auth events from auth service and auto-reconnect
    this.authService.on('auth-success', async (data: { serverId: string }) => {
      this.emit('auth-success', data);

      // Auto-reconnect after successful OAuth
      log.info({ serverId: data.serverId }, 'OAuth success, auto-reconnecting...');
      try {
        await this.connect(data.serverId);
        log.info({ serverId: data.serverId }, 'Auto-reconnect after OAuth succeeded');
      } catch (error) {
        log.error({ serverId: data.serverId, error }, 'Auto-reconnect after OAuth failed');
      }
    });

    this.authService.on('auth-error', (data) => {
      this.emit('auth-error', data);
    });

    this.authService.on('tokens-refreshed', (data) => {
      this.emit('tokens-refreshed', data);
    });
  }

  /**
   * Initialize the orchestrator and connect to auto-connect servers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log.warn('Orchestrator already initialized');
      return;
    }

    log.info('Initializing MCP Connection Orchestrator');

    // Load all servers from database
    const servers = getAllMCPServers();

    // Register all servers with auth provider for HTTP transport
    for (const server of servers) {
      const config = this.dbServerToConfig(server);
      const options = config.transport === 'http'
        ? { authProvider: this.createDefaultAuthProvider(config.id, config.name) }
        : {};
      this.registry.register(config, options);
    }

    // Connect to auto-connect servers
    const autoConnectServers = getAutoConnectMCPServers();
    log.info({ count: autoConnectServers.length }, 'Connecting to auto-connect servers');

    for (const server of autoConnectServers) {
      try {
        await this.connect(server.id);
      } catch (error) {
        log.error({ serverId: server.id, error }, 'Failed to auto-connect server');
      }
    }

    this.initialized = true;
    log.info('MCP Connection Orchestrator initialized');
  }

  /**
   * Shutdown the orchestrator and disconnect all servers
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down MCP Connection Orchestrator');

    // Stop health monitoring
    this.healthMonitor.stopAll();

    // Disconnect all servers
    await this.registry.clearAll();

    this.initialized = false;
    log.info('MCP Connection Orchestrator shut down');
  }

  /**
   * Create a new MCP server
   */
  async createServer(request: CreateMCPServerRequest): Promise<MCPServerConfig> {
    const id = `mcp-${uuid()}`;

    // Encrypt sensitive data
    const env = request.env ? encryptCredentials(request.env) : undefined;
    const headers = request.headers ? encryptCredentials(request.headers) : undefined;

    // Create in database
    const server = createMCPServer({
      id,
      name: request.name,
      transport: request.transport,
      command: request.command,
      args: request.args ? JSON.stringify(request.args) : undefined,
      env,
      url: request.url,
      headers,
      templateId: request.templateId,
      isEnabled: request.isEnabled ?? true,
      autoConnect: request.autoConnect ?? false,
    });

    const config = this.dbServerToConfig(server);

    // Register the connection with auth provider for HTTP transport
    const options = config.transport === 'http'
      ? { authProvider: this.createDefaultAuthProvider(config.id, config.name) }
      : {};
    this.registry.register(config, options);

    log.info({ serverId: id, name: request.name }, 'Created new MCP server');

    return config;
  }

  /**
   * Update an existing MCP server
   */
  async updateServer(serverId: string, request: UpdateMCPServerRequest): Promise<MCPServerConfig | null> {
    // Check if connected, disconnect first
    const currentStatus = this.registry.getStatus(serverId);
    if (currentStatus === 'connected') {
      await this.disconnect(serverId);
    }

    // Encrypt sensitive data if provided
    const env = request.env ? encryptCredentials(request.env) : undefined;
    const headers = request.headers ? encryptCredentials(request.headers) : undefined;

    // Update in database
    const server = updateMCPServer(serverId, {
      name: request.name,
      command: request.command,
      args: request.args ? JSON.stringify(request.args) : undefined,
      env,
      url: request.url,
      headers,
      isEnabled: request.isEnabled,
      autoConnect: request.autoConnect,
    });

    if (!server) {
      log.warn({ serverId }, 'Server not found');
      return null;
    }

    const config = this.dbServerToConfig(server);

    // Update the client config
    const client = this.registry.get(serverId);
    if (client) {
      client.updateConfig(config);
    }

    log.info({ serverId }, 'Updated MCP server');

    return config;
  }

  /**
   * Delete an MCP server
   */
  async deleteServer(serverId: string): Promise<void> {
    // Unregister connection first
    await this.registry.unregister(serverId);

    // Delete from database
    deleteMCPServer(serverId);

    log.info({ serverId }, 'Deleted MCP server');
  }

  /**
   * Connect to a server
   */
  async connect(serverId: string): Promise<MCPTool[]> {
    const client = this.registry.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not registered`);
    }

    // Update status in database
    updateMCPServerStatus(serverId, 'connecting');

    try {
      await client.connect();

      // Update status in database
      updateMCPServerStatus(serverId, 'connected');

      // Start health monitoring
      this.healthMonitor.startMonitoring(serverId);

      const tools = client.getTools();
      this.emit('server-connected', { serverId, tools });

      return tools;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateMCPServerStatus(serverId, 'error', errorMessage);
      this.emit('server-error', { serverId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverId: string): Promise<void> {
    const client = this.registry.get(serverId);
    if (!client) {
      log.warn({ serverId }, 'Server not registered');
      return;
    }

    // Stop health monitoring
    this.healthMonitor.stopMonitoring(serverId);

    await client.disconnect('Manual disconnect');

    // Update status in database
    updateMCPServerStatus(serverId, 'disconnected');

    this.emit('server-disconnected', { serverId, reason: 'Manual disconnect' });
  }

  /**
   * Test connection to a server without persisting
   */
  async testConnection(serverId: string): Promise<MCPTestConnectionResult> {
    const startTime = Date.now();

    const client = this.registry.get(serverId);
    if (!client) {
      return {
        success: false,
        serverId,
        error: 'Server not registered',
      };
    }

    try {
      // If already connected, just return the tools
      if (client.getStatus() === 'connected') {
        return {
          success: true,
          serverId,
          tools: client.getTools(),
          latencyMs: Date.now() - startTime,
        };
      }

      // Try to connect
      await client.connect();
      const tools = client.getTools();

      // Disconnect since this is just a test
      await client.disconnect('Test connection complete');

      return {
        success: true,
        serverId,
        tools,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        serverId,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(
    serverId: string,
    toolName: string,
    input?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const client = this.registry.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not registered`);
    }

    if (client.getStatus() !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.executeTool(toolName, input);

    // Emit event
    if (result.status === 'success') {
      this.emit('tool-call-completed', result);
    } else {
      this.emit('tool-call-error', {
        callId: result.id,
        serverId,
        toolName,
        error: result.error || 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Get all servers
   */
  getServers(): MCPServerConfig[] {
    const servers = getAllMCPServers();
    return servers.map((s) => this.dbServerToConfig(s));
  }

  /**
   * Get a specific server
   */
  getServer(serverId: string): MCPServerConfig | null {
    const server = getMCPServerById(serverId);
    return server ? this.dbServerToConfig(server) : null;
  }

  /**
   * Get all available tools from connected servers
   */
  getAvailableTools(): MCPTool[] {
    return this.registry.getAllTools();
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStates(): Record<string, { status: string; error?: string }> {
    const states: Record<string, { status: string; error?: string }> = {};

    for (const entry of this.registry.getAll()) {
      states[entry.config.id] = {
        status: entry.status,
        error: entry.lastError,
      };
    }

    return states;
  }

  /**
   * Start OAuth authorization flow for a server
   */
  async startOAuthFlow(serverId: string, oauthConfig: MCPOAuthConfig): Promise<void> {
    log.info({ serverId }, 'Starting OAuth flow for server');

    try {
      const tokens = await this.authService.authorize(oauthConfig);

      // After successful auth, reconnect with the new tokens
      const client = this.registry.getClient(serverId);
      if (client) {
        const authProvider = this.authService.createAuthProvider(serverId, oauthConfig);
        client.setAuthProvider(authProvider);

        // Try reconnecting
        await this.connect(serverId);
      }
    } catch (error) {
      log.error({ serverId, error }, 'OAuth flow failed');
      throw error;
    }
  }

  /**
   * Connect with OAuth (if server requires auth)
   */
  async connectWithAuth(serverId: string, oauthConfig?: MCPOAuthConfig): Promise<MCPTool[]> {
    const client = this.registry.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not registered`);
    }

    // If OAuth config provided and we have valid tokens, set up auth provider
    if (oauthConfig && this.authService.hasValidToken(serverId)) {
      // Check if tokens need refresh
      if (this.authService.needsRefresh(serverId)) {
        await this.authService.refreshTokens(serverId);
      }

      const authProvider = this.authService.createAuthProvider(serverId, oauthConfig);
      client.setAuthProvider(authProvider);
    }

    return this.connect(serverId);
  }

  /**
   * Check if a server requires OAuth
   */
  serverRequiresAuth(serverId: string): boolean {
    return this.registry.requiresAuth(serverId);
  }

  /**
   * Check if server has valid OAuth tokens
   */
  hasValidTokens(serverId: string): boolean {
    return this.authService.hasValidToken(serverId);
  }

  /**
   * Delete OAuth tokens for a server
   */
  deleteTokens(serverId: string): void {
    this.authService.deleteTokens(serverId);
  }

  /**
   * Create a default auth provider for HTTP servers
   * This works with SDK-discovered OAuth (server provides OAuth metadata)
   */
  private createDefaultAuthProvider(serverId: string, serverName: string) {
    const authService = this.authService;
    const redirectUri = 'meetingcopilot://oauth/callback';

    return {
      get redirectUrl() {
        return redirectUri;
      },

      get clientMetadata() {
        return {
          client_name: 'Meeting Copilot',
          redirect_uris: [redirectUri],
        };
      },

      clientInformation() {
        // Return undefined to trigger dynamic client registration
        // The SDK will register with the server and get a client_id
        return undefined;
      },

      async saveClientInformation(info: { client_id: string; client_secret?: string }) {
        // Store the dynamically registered client info
        log.info({ serverId, clientId: info.client_id }, 'Saving dynamic client registration');
        // We could persist this in DB if needed for future connections
      },

      async tokens() {
        const tokens = authService.getTokens(serverId);
        if (!tokens) return undefined;

        return {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: tokens.tokenType,
        };
      },

      async saveTokens(tokens: { access_token: string; token_type: string; refresh_token?: string; expires_in?: number }) {
        authService.saveTokens(serverId, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenType: tokens.token_type || 'Bearer',
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        });
      },

      async redirectToAuthorization(authorizationUrl: URL) {
        const { shell } = await import('electron');
        log.info({ serverId, authUrl: authorizationUrl.toString() }, 'Opening OAuth authorization URL');
        await shell.openExternal(authorizationUrl.toString());
      },

      async saveCodeVerifier(verifier: string) {
        // Store code verifier temporarily (in memory via authService)
        (authService as any)._codeVerifiers = (authService as any)._codeVerifiers || new Map();
        (authService as any)._codeVerifiers.set(serverId, verifier);
      },

      async codeVerifier() {
        const verifiers = (authService as any)._codeVerifiers;
        return verifiers?.get(serverId) || '';
      },
    };
  }

  /**
   * Convert database server record to MCPServerConfig
   */
  private dbServerToConfig(server: any): MCPServerConfig {
    return {
      id: server.id,
      name: server.name,
      transport: server.transport,
      command: server.command || undefined,
      args: server.args ? JSON.parse(server.args) : undefined,
      env: server.env || undefined, // Keep encrypted for storage
      url: server.url || undefined,
      headers: server.headers || undefined, // Keep encrypted for storage
      templateId: server.templateId || undefined,
      isEnabled: server.isEnabled ?? true,
      autoConnect: server.autoConnect ?? false,
      connectionStatus: server.connectionStatus || 'disconnected',
      lastError: server.lastError || undefined,
      lastConnectedAt: server.lastConnectedAt || undefined,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }
}

// Singleton instance
let instance: ConnectionOrchestratorService | null = null;

export function getConnectionOrchestrator(): ConnectionOrchestratorService {
  if (!instance) {
    instance = new ConnectionOrchestratorService();
  }
  return instance;
}

export function resetConnectionOrchestrator(): void {
  instance = null;
}

export default ConnectionOrchestratorService;
