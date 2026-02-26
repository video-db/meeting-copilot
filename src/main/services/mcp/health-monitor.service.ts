/**
 * Health Monitor Service
 *
 * Monitors the health of MCP server connections and handles
 * automatic reconnection with exponential backoff.
 */

import { EventEmitter } from 'events';
import { logger } from '../../lib/logger';
import { getConnectionRegistry, ConnectionRegistryService } from './connection-registry.service';
import { updateMCPServerStatus } from '../../db';

const log = logger.child({ module: 'mcp-health-monitor' });

interface MonitoredServer {
  serverId: string;
  healthCheckTimer: NodeJS.Timeout | null;
  reconnectTimer: NodeJS.Timeout | null;
  reconnectAttempts: number;
  lastHealthCheck: Date | null;
  isHealthy: boolean;
}

export interface HealthMonitorEvents {
  'health-check-passed': { serverId: string };
  'health-check-failed': { serverId: string; error: string };
  'reconnecting': { serverId: string; attempt: number };
  'reconnected': { serverId: string };
  'reconnect-failed': { serverId: string; error: string };
}

// Configuration
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 60000; // 1 minute

export class HealthMonitorService extends EventEmitter {
  private registry: ConnectionRegistryService;
  private monitoredServers: Map<string, MonitoredServer> = new Map();

  constructor() {
    super();
    this.registry = getConnectionRegistry();
  }

  /**
   * Start monitoring a server
   */
  startMonitoring(serverId: string): void {
    if (this.monitoredServers.has(serverId)) {
      log.warn({ serverId }, 'Server already being monitored');
      return;
    }

    const server: MonitoredServer = {
      serverId,
      healthCheckTimer: null,
      reconnectTimer: null,
      reconnectAttempts: 0,
      lastHealthCheck: null,
      isHealthy: true,
    };

    // Start health check timer
    server.healthCheckTimer = setInterval(() => {
      this.performHealthCheck(serverId);
    }, HEALTH_CHECK_INTERVAL);

    this.monitoredServers.set(serverId, server);
    log.info({ serverId }, 'Started health monitoring');
  }

  /**
   * Stop monitoring a server
   */
  stopMonitoring(serverId: string): void {
    const server = this.monitoredServers.get(serverId);
    if (!server) return;

    // Clear timers
    if (server.healthCheckTimer) {
      clearInterval(server.healthCheckTimer);
    }
    if (server.reconnectTimer) {
      clearTimeout(server.reconnectTimer);
    }

    this.monitoredServers.delete(serverId);
    log.info({ serverId }, 'Stopped health monitoring');
  }

  /**
   * Stop monitoring all servers
   */
  stopAll(): void {
    for (const serverId of this.monitoredServers.keys()) {
      this.stopMonitoring(serverId);
    }
  }

  /**
   * Perform a health check on a server
   */
  private async performHealthCheck(serverId: string): Promise<void> {
    const server = this.monitoredServers.get(serverId);
    if (!server) return;

    const client = this.registry.get(serverId);
    if (!client) {
      log.warn({ serverId }, 'Client not found for health check');
      return;
    }

    const status = client.getStatus();

    if (status === 'connected') {
      // Server is healthy
      server.isHealthy = true;
      server.lastHealthCheck = new Date();
      server.reconnectAttempts = 0;

      this.emit('health-check-passed', { serverId });
    } else if (status === 'disconnected' || status === 'error') {
      // Server is unhealthy, attempt reconnection
      server.isHealthy = false;

      this.emit('health-check-failed', {
        serverId,
        error: `Connection status: ${status}`,
      });

      // Start reconnection if not already reconnecting
      if (!server.reconnectTimer) {
        this.startReconnection(serverId);
      }
    }
  }

  /**
   * Start the reconnection process with exponential backoff
   */
  private startReconnection(serverId: string): void {
    const server = this.monitoredServers.get(serverId);
    if (!server) return;

    if (server.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log.error({ serverId }, 'Max reconnect attempts reached');
      this.emit('reconnect-failed', {
        serverId,
        error: 'Max reconnect attempts reached',
      });
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, server.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    server.reconnectAttempts++;

    log.info({ serverId, attempt: server.reconnectAttempts, delay }, 'Scheduling reconnection');
    this.emit('reconnecting', { serverId, attempt: server.reconnectAttempts });

    // Schedule reconnection
    server.reconnectTimer = setTimeout(async () => {
      server.reconnectTimer = null;
      await this.attemptReconnection(serverId);
    }, delay);
  }

  /**
   * Attempt to reconnect to a server
   */
  private async attemptReconnection(serverId: string): Promise<void> {
    const server = this.monitoredServers.get(serverId);
    if (!server) return;

    const client = this.registry.get(serverId);
    if (!client) {
      log.warn({ serverId }, 'Client not found for reconnection');
      return;
    }

    try {
      log.info({ serverId, attempt: server.reconnectAttempts }, 'Attempting reconnection');

      // Update status in database
      updateMCPServerStatus(serverId, 'connecting');

      await client.connect();

      // Success
      server.isHealthy = true;
      server.reconnectAttempts = 0;
      server.lastHealthCheck = new Date();

      updateMCPServerStatus(serverId, 'connected');

      this.emit('reconnected', { serverId });
      log.info({ serverId }, 'Reconnection successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      updateMCPServerStatus(serverId, 'error', errorMessage);

      log.error({ serverId, error, attempt: server.reconnectAttempts }, 'Reconnection failed');

      // Schedule another attempt
      this.startReconnection(serverId);
    }
  }

  /**
   * Force a reconnection attempt for a server
   */
  async forceReconnect(serverId: string): Promise<void> {
    const server = this.monitoredServers.get(serverId);
    if (!server) {
      log.warn({ serverId }, 'Server not being monitored');
      return;
    }

    // Clear any existing reconnect timer
    if (server.reconnectTimer) {
      clearTimeout(server.reconnectTimer);
      server.reconnectTimer = null;
    }

    // Reset reconnect attempts
    server.reconnectAttempts = 0;

    // Attempt reconnection immediately
    await this.attemptReconnection(serverId);
  }

  /**
   * Get health status for all monitored servers
   */
  getHealthStatus(): Record<string, {
    isHealthy: boolean;
    lastHealthCheck: Date | null;
    reconnectAttempts: number;
  }> {
    const status: Record<string, any> = {};

    for (const [serverId, server] of this.monitoredServers.entries()) {
      status[serverId] = {
        isHealthy: server.isHealthy,
        lastHealthCheck: server.lastHealthCheck,
        reconnectAttempts: server.reconnectAttempts,
      };
    }

    return status;
  }

  /**
   * Check if a server is being monitored
   */
  isMonitoring(serverId: string): boolean {
    return this.monitoredServers.has(serverId);
  }

  /**
   * Get the number of monitored servers
   */
  getMonitoredCount(): number {
    return this.monitoredServers.size;
  }
}

// Singleton instance
let instance: HealthMonitorService | null = null;

export function getHealthMonitor(): HealthMonitorService {
  if (!instance) {
    instance = new HealthMonitorService();
  }
  return instance;
}

export function resetHealthMonitor(): void {
  if (instance) {
    instance.stopAll();
  }
  instance = null;
}

export default HealthMonitorService;
