import type { Context as HonoContext } from 'hono';
import { getUserByAccessToken } from '../../db';
import type { User } from '../../db/schema';
import { createChildLogger } from '../../lib/logger';

const logger = createChildLogger('trpc-context');

export interface TrpcContext extends Record<string, unknown> {
  user: User | null;
  accessToken: string | null;
}

export async function createContext(c: HonoContext): Promise<TrpcContext> {
  const accessToken = c.req.header('x-access-token') || null;

  let user: User | null = null;

  if (accessToken) {
    try {
      user = getUserByAccessToken(accessToken) || null;
    } catch (error) {
      logger.error({ error }, 'Failed to get user from access token');
    }
  }

  return {
    user,
    accessToken,
  };
}
