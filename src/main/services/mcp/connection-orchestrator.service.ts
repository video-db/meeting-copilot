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
  private initialized: boolean = false;

  constructor() {
    super();
    this.registry = getConnectionRegistry();
    this.healthMonitor = getHealthMonitor();
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

    // Register all servers
    for (const server of servers) {
      const config = this.dbServerToConfig(server);
      this.registry.register(config);
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

    // Register the connection
    this.registry.register(config);

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
