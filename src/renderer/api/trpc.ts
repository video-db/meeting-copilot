import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../main/server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_API_PORT = 51731;
let cachedPort: number | null = null;

async function getApiPort(): Promise<number> {
  if (cachedPort !== null) return cachedPort;

  try {
    if (window.electronAPI?.app?.getServerPort) {
      cachedPort = await window.electronAPI.app.getServerPort();
      return cachedPort;
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_API_PORT;
}

export function createTrpcClient(getAccessToken: () => string | null, port?: number) {
  const apiPort = port || cachedPort || DEFAULT_API_PORT;

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `http://localhost:${apiPort}/api/trpc`,
        headers() {
          const token = getAccessToken();
          return token
            ? {
                'x-access-token': token,
              }
            : {};
        },
      }),
    ],
  });
}

export { getApiPort };
