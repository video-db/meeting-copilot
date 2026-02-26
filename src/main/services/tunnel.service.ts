import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createChildLogger } from '../lib/logger';
import { getCloudflaredBinaryPath } from '../lib/paths';
import type { TunnelStatus } from '../../shared/schemas/config.schema';

const logger = createChildLogger('tunnel-service');

interface TunnelConnection {
  url: string;
  process: ChildProcess;
  stop: () => void;
}

let activeTunnel: TunnelConnection | null = null;
let tunnelStatus: TunnelStatus = {
  connected: false,
};

// Regex to extract the tunnel URL from cloudflared output
const URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export class TunnelService {
  private _port: number;

  constructor(port: number) {
    this._port = port;
  }

  /**
   * Get the port this tunnel service is configured for
   */
  getPort(): number {
    return this._port;
  }

  async start(): Promise<TunnelStatus> {
    logger.info({ port: this._port, hasActiveTunnel: !!activeTunnel }, '🚇 TunnelService.start() called');

    if (activeTunnel) {
      logger.info('🚇 Tunnel already running at: ' + activeTunnel.url);
      return tunnelStatus;
    }

    try {
      logger.info({ port: this._port }, '🚇 Starting cloudflare tunnel...');

      const binPath = getCloudflaredBinaryPath();
      logger.info({ binPath }, '🚇 Using cloudflared binary');

      // Spawn cloudflared with quick tunnel
      const args = ['tunnel', '--url', `http://localhost:${this._port}`];
      const child = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      // Wait for the URL with a timeout
      const timeoutMs = 30000;

      const url = await new Promise<string>((resolve, reject) => {
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            child.kill('SIGTERM');
            reject(new Error(`Tunnel startup timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        const handleOutput = (data: Buffer) => {
          const output = data.toString();
          logger.debug({ output: output.trim() }, 'Cloudflared output');

          const match = output.match(URL_REGEX);
          if (match && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(match[0]);
          }
        };

        child.stdout?.on('data', handleOutput);
        child.stderr?.on('data', handleOutput);

        child.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(err);
          }
        });

        child.on('exit', (code) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(new Error(`Cloudflared exited with code ${code} before URL was received`));
          }
        });
      });

      logger.info({ url }, '🚇 Tunnel started successfully - webhook URL: ' + url + '/api/webhook');

      activeTunnel = {
        url,
        process: child,
        stop: () => child.kill('SIGTERM'),
      };

      tunnelStatus = {
        connected: true,
        url,
      };

      // Handle process exit after successful start
      child.on('exit', (code: number | null) => {
        logger.info({ code }, 'Tunnel process exited');
        activeTunnel = null;
        tunnelStatus = {
          connected: false,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        };
      });

      return tunnelStatus;
    } catch (error) {
      logger.error({ error }, '❌ Failed to start tunnel - webhooks will NOT work!');
      logger.error('Make sure cloudflared is installed or the binary is accessible');
      tunnelStatus = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return tunnelStatus;
    }
  }

  async stop(): Promise<void> {
    if (activeTunnel) {
      logger.info('Stopping tunnel');
      activeTunnel.stop();
      activeTunnel = null;
      tunnelStatus = {
        connected: false,
      };
    }
  }

  getStatus(): TunnelStatus {
    return tunnelStatus;
  }

  getUrl(): string | undefined {
    return activeTunnel?.url;
  }

  isConnected(): boolean {
    return tunnelStatus.connected;
  }
}

let tunnelServiceInstance: TunnelService | null = null;

export function getTunnelService(port: number): TunnelService {
  if (!tunnelServiceInstance || tunnelServiceInstance.getPort() !== port) {
    tunnelServiceInstance = new TunnelService(port);
  }
  return tunnelServiceInstance;
}

export function getTunnelStatus(): TunnelStatus {
  return tunnelStatus;
}

export function getTunnelUrl(): string | undefined {
  return activeTunnel?.url;
}
