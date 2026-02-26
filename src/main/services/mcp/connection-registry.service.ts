/**
 * Connection Registry Service
 *
 * In-memory registry for managing MCP client instances and their connection states.
 * Provides centralized access to all active MCP connections.
 */

import { logger } from '../../lib/logger';
import { MCPClientService } from './mcp-client.service';
import type {
  MCPServerConfig,
  MCPTool,
  MCPConnectionStatus,
} from '../../../shared/types/mcp.types';

const log = logger.child({ module: 'mcp-connection-registry' });

interface ConnectionEntry {
  client: MCPClientService;
  config: MCPServerConfig;
  status: MCPConnectionStatus;
  lastError?: string;
  connectedAt?: Date;
}

export class ConnectionRegistryService {
  private connections: Map<string, ConnectionEntry> = new Map();

  /**
   * Register a new connection
   */
  register(config: MCPServerConfig): MCPClientService {
    if (this.connections.has(config.id)) {
      log.warn({ serverId: config.id }, 'Connection already registered, returning existing');
      return this.connections.get(config.id)!.client;
    }

    const client = new MCPClientService(config);

    // Set up event listeners
    client.on('connected', ({ tools }) => {
      this.updateStatus(config.id, 'connected');
      log.info({ serverId: config.id, toolCount: tools.length }, 'Connection established');
    });

    client.on('disconnected', ({ reason }) => {
      this.updateStatus(config.id, 'disconnected');
      log.info({ serverId: config.id, reason }, 'Connection closed');
    });

    client.on('error', ({ error }) => {
      this.updateStatus(config.id, 'error', error);
      log.error({ serverId: config.id, error }, 'Connection error');
    });

    this.connections.set(config.id, {
      client,
      config,
      status: 'disconnected',
    });

    log.info({ serverId: config.id }, 'Connection registered');
    return client;
  }

  /**
   * Unregister a connection
   */
  async unregister(serverId: string): Promise<void> {
    const entry = this.connections.get(serverId);
    if (!entry) {
      log.warn({ serverId }, 'Connection not found in registry');
      return;
    }

    // Disconnect if connected
    if (entry.status === 'connected' || entry.status === 'connecting') {
      await entry.client.disconnect('Unregistering connection');
    }

    // Remove all listeners
    entry.client.removeAllListeners();

    this.connections.delete(serverId);
    log.info({ serverId }, 'Connection unregistered');
  }

  /**
   * Get a client by server ID
   */
  get(serverId: string): MCPClientService | undefined {
    return this.connections.get(serverId)?.client;
  }

  /**
   * Get connection entry by server ID
   */
  getEntry(serverId: string): ConnectionEntry | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Update connection status
   */
  updateStatus(serverId: string, status: MCPConnectionStatus, error?: string): void {
    const entry = this.connections.get(serverId);
    if (!entry) return;

    entry.status = status;

    if (status === 'connected') {
      entry.connectedAt = new Date();
      entry.lastError = undefined;
    } else if (status === 'error' && error) {
      entry.lastError = error;
    }
  }

  /**
   * Get status of a connection
   */
  getStatus(serverId: string): MCPConnectionStatus | undefined {
    return this.connections.get(serverId)?.status;
  }

  /**
   * Get all registered server IDs
   */
  getServerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get all connected server IDs
   */
  getConnectedServerIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, entry]) => entry.status === 'connected')
      .map(([id]) => id);
  }

  /**
   * Get all connection entries
   */
  getAll(): ConnectionEntry[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): MCPClientService[] {
    return Array.from(this.connections.values())
      .filter((entry) => entry.status === 'connected')
      .map((entry) => entry.client);
  }

  /**
   * Get aggregated tools from all connected servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    const serverStatuses: Array<{ id: string; name: string; status: string; toolCount: number }> = [];

    for (const entry of this.connections.values()) {
      const serverTools = entry.status === 'connected' ? entry.client.getTools() : [];
      serverStatuses.push({
        id: entry.config.id,
        name: entry.config.name,
        status: entry.status,
        toolCount: serverTools.length,
      });

      if (entry.status === 'connected') {
        tools.push(...serverTools);
      }
    }

    log.info({
      totalConnections: this.connections.size,
      connectedServers: serverStatuses.filter(s => s.status === 'connected').length,
      totalTools: tools.length,
      serverStatuses,
    }, 'MCP Registry: getAllTools called');

    return tools;
  }

  /**
   * Find a tool by name across all connected servers
   */
  findTool(toolName: string): { tool: MCPTool; client: MCPClientService } | undefined {
    for (const entry of this.connections.values()) {
      if (entry.status === 'connected') {
        const tool = entry.client.getTool(toolName);
        if (tool) {
          return { tool, client: entry.client };
        }
      }
    }
    return undefined;
  }

  /**
   * Find a tool by namespaced name (serverId:toolName)
   */
  findToolByNamespace(namespacedName: string): { tool: MCPTool; client: MCPClientService } | undefined {
    const [serverId, toolName] = namespacedName.split(':');
    if (!serverId || !toolName) return undefined;

    const entry = this.connections.get(serverId);
    if (!entry || entry.status !== 'connected') return undefined;

    const tool = entry.client.getTool(toolName);
    if (!tool) return undefined;

    return { tool, client: entry.client };
  }

  /**
   * Check if any servers are connected
   */
  hasConnections(): boolean {
    return this.getConnectedServerIds().length > 0;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): { total: number; connected: number } {
    const total = this.connections.size;
    const connected = this.getConnectedServerIds().length;
    return { total, connected };
  }

  /**
   * Clear all connections
   */
  async clearAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());

    for (const serverId of serverIds) {
      await this.unregister(serverId);
    }

    log.info('All connections cleared');
  }
}

// Singleton instance
let instance: ConnectionRegistryService | null = null;

export function getConnectionRegistry(): ConnectionRegistryService {
  if (!instance) {
    instance = new ConnectionRegistryService();
  }
  return instance;
}

export function resetConnectionRegistry(): void {
  instance = null;
}

export default ConnectionRegistryService;
