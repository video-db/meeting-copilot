import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { serve } from '@hono/node-server';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { createChildLogger } from '../lib/logger';

const logger = createChildLogger('http-server');

let server: ReturnType<typeof serve> | null = null;

export function createServer(port: number) {
  const app = new Hono();

  // CORS middleware
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'x-access-token'],
    })
  );

  // Health check
  app.get('/api', (c) => {
    return c.json({
      status: 'ok',
      message: 'Notter Server Running',
    });
  });

  // tRPC handler
  app.use(
    '/api/trpc/*',
    trpcServer({
      router: appRouter,
      endpoint: '/api/trpc',
      createContext: async (_opts, c) => createContext(c),
    })
  );

  return app;
}

let currentPort: number | undefined;

export async function startServer(port: number, maxRetries: number = 10): Promise<number> {
  if (server) {
    logger.warn('Server already running');
    return currentPort || port;
  }

  const app = createServer(port);

  const tryPort = (attemptPort: number, retriesLeft: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const serverInstance = serve(
        {
          fetch: app.fetch,
          port: attemptPort,
        },
        (info) => {
          server = serverInstance;
          currentPort = info.port;
          logger.info({ port: info.port }, 'HTTP server started');
          resolve(info.port);
        }
      );

      // Handle errors (like EADDRINUSE)
      serverInstance.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
          logger.warn({ port: attemptPort }, 'Port in use, trying next port');
          serverInstance.close();
          resolve(tryPort(attemptPort + 1, retriesLeft - 1));
        } else {
          reject(err);
        }
      });
    });
  };

  return tryPort(port, maxRetries);
}

export async function stopServer(): Promise<void> {
  if (server) {
    logger.info('Stopping HTTP server');
    server.close();
    server = null;
  }
}

export function getServerStatus(): { running: boolean; port?: number } {
  return {
    running: !!server,
    port: currentPort,
  };
}
