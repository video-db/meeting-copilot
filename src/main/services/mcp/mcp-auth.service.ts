/**
 * MCP Auth Service
 *
 * Handles OAuth authentication for MCP servers that require it.
 * Implements token storage, refresh, and the full OAuth flow with
 * browser-based authorization via custom protocol handler.
 */

import { EventEmitter } from 'events';
import { BrowserWindow, shell } from 'electron';
import crypto from 'crypto';
import { logger } from '../../lib/logger';
import { encrypt, decrypt } from '../../utils/encryption';
import {
  getMCPOauthToken,
  upsertMCPOauthToken,
  deleteMCPOauthToken,
} from '../../db';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { MCPOAuthConfig } from '../../../shared/types/mcp.types';

const log = logger.child({ module: 'mcp-auth' });

// Token refresh buffer - refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Re-export for convenience
export type { MCPOAuthConfig };

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
}

interface PendingAuth {
  serverId: string;
  config: MCPOAuthConfig;
  codeVerifier: string;
  state: string;
  resolve: (tokens: OAuthTokens) => void;
  reject: (error: Error) => void;
}

export class MCPAuthService extends EventEmitter {
  private pendingAuths: Map<string, PendingAuth> = new Map();
  private authWindow: BrowserWindow | null = null;

  constructor() {
    super();
  }

  /**
   * Check if a server has valid OAuth tokens
   */
  hasValidToken(serverId: string): boolean {
    const tokenRecord = getMCPOauthToken(serverId);
    if (!tokenRecord) return false;

    // Check expiry
    if (tokenRecord.expiresAt) {
      const expiresAt = new Date(tokenRecord.expiresAt);
      const now = new Date();
      if (expiresAt <= now) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if token needs refresh (expires within buffer period)
   */
  needsRefresh(serverId: string): boolean {
    const tokenRecord = getMCPOauthToken(serverId);
    if (!tokenRecord) return false;

    if (!tokenRecord.expiresAt) return false;

    const expiresAt = new Date(tokenRecord.expiresAt);
    const refreshThreshold = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS);

    return expiresAt <= refreshThreshold;
  }

  /**
   * Get stored tokens for a server
   */
  getTokens(serverId: string): OAuthTokens | null {
    const tokenRecord = getMCPOauthToken(serverId);
    if (!tokenRecord) return null;

    try {
      return {
        accessToken: decrypt(tokenRecord.accessToken),
        refreshToken: tokenRecord.refreshToken ? decrypt(tokenRecord.refreshToken) : undefined,
        tokenType: tokenRecord.tokenType,
        expiresAt: tokenRecord.expiresAt ? new Date(tokenRecord.expiresAt) : undefined,
        scope: tokenRecord.scope || undefined,
      };
    } catch (error) {
      log.error({ serverId, error }, 'Failed to decrypt tokens');
      return null;
    }
  }

  /**
   * Store tokens for a server
   */
  saveTokens(serverId: string, tokens: OAuthTokens, authServerUrl?: string): void {
    upsertMCPOauthToken({
      serverId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt?.toISOString(),
      scope: tokens.scope,
      authServerUrl,
    });

    log.info({ serverId }, 'OAuth tokens saved');
    this.emit('tokens-saved', { serverId });
  }

  /**
   * Delete tokens for a server
   */
  deleteTokens(serverId: string): void {
    deleteMCPOauthToken(serverId);
    log.info({ serverId }, 'OAuth tokens deleted');
    this.emit('tokens-deleted', { serverId });
  }

  /**
   * Start OAuth authorization flow
   * Opens browser for user authorization and waits for callback
   */
  async authorize(config: MCPOAuthConfig): Promise<OAuthTokens> {
    log.info({ serverId: config.serverId, serverName: config.serverName }, 'Starting OAuth flow');

    // Generate PKCE values
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');

    // Build authorization URL
    const redirectUri = config.redirectUri || 'meetingcopilot://oauth/callback';
    const authUrl = new URL(config.authorizationUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    if (config.scopes?.length) {
      authUrl.searchParams.set('scope', config.scopes.join(' '));
    }

    return new Promise((resolve, reject) => {
      // Store pending auth
      this.pendingAuths.set(state, {
        serverId: config.serverId,
        config,
        codeVerifier,
        state,
        resolve,
        reject,
      });

      // Open in external browser (more reliable than BrowserWindow for OAuth)
      shell.openExternal(authUrl.toString()).catch((error) => {
        this.pendingAuths.delete(state);
        reject(new Error(`Failed to open authorization URL: ${error.message}`));
      });

      log.info({ serverId: config.serverId, authUrl: authUrl.toString() }, 'OAuth: Opened browser for authorization');

      // Set timeout for auth flow (5 minutes)
      setTimeout(() => {
        if (this.pendingAuths.has(state)) {
          this.pendingAuths.delete(state);
          reject(new Error('OAuth authorization timed out'));
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Handle OAuth callback from protocol handler
   */
  async handleCallback(callbackUrl: string): Promise<void> {
    log.info({ callbackUrl }, 'OAuth: Received callback');

    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (!state) {
      log.error('OAuth callback missing state parameter');
      return;
    }

    const pendingAuth = this.pendingAuths.get(state);
    if (!pendingAuth) {
      log.error({ state }, 'OAuth callback for unknown state');
      return;
    }

    this.pendingAuths.delete(state);

    if (error) {
      pendingAuth.reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
      return;
    }

    if (!code) {
      pendingAuth.reject(new Error('OAuth callback missing authorization code'));
      return;
    }

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(
        pendingAuth.config,
        code,
        pendingAuth.codeVerifier
      );

      // Save tokens
      this.saveTokens(pendingAuth.serverId, tokens, pendingAuth.config.tokenUrl);

      pendingAuth.resolve(tokens);

      this.emit('auth-success', { serverId: pendingAuth.serverId });
    } catch (err) {
      pendingAuth.reject(err instanceof Error ? err : new Error(String(err)));
      this.emit('auth-error', { serverId: pendingAuth.serverId, error: String(err) });
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    config: MCPOAuthConfig,
    code: string,
    codeVerifier: string
  ): Promise<OAuthTokens> {
    const redirectUri = config.redirectUri || 'meetingcopilot://oauth/callback';

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    });

    if (config.clientSecret) {
      body.set('client_secret', config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };

    if (data.expires_in) {
      tokens.expiresAt = new Date(Date.now() + data.expires_in * 1000);
    }

    log.info({ serverId: config.serverId }, 'OAuth: Token exchange successful');

    return tokens;
  }

  /**
   * Refresh tokens using refresh_token
   */
  async refreshTokens(serverId: string): Promise<OAuthTokens | null> {
    const tokenRecord = getMCPOauthToken(serverId);
    if (!tokenRecord || !tokenRecord.refreshToken || !tokenRecord.authServerUrl) {
      log.warn({ serverId }, 'Cannot refresh tokens: missing refresh token or auth server URL');
      return null;
    }

    try {
      const refreshToken = decrypt(tokenRecord.refreshToken);

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenRecord.authServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error({ serverId, status: response.status, error: errorText }, 'Token refresh failed');

        // If refresh fails with 400/401, tokens are invalid - delete them
        if (response.status === 400 || response.status === 401) {
          this.deleteTokens(serverId);
        }
        return null;
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        scope?: string;
      };

      const tokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
        tokenType: data.token_type || 'Bearer',
        scope: data.scope || tokenRecord.scope || undefined,
      };

      if (data.expires_in) {
        tokens.expiresAt = new Date(Date.now() + data.expires_in * 1000);
      }

      // Save refreshed tokens
      this.saveTokens(serverId, tokens, tokenRecord.authServerUrl);

      log.info({ serverId }, 'OAuth: Tokens refreshed successfully');
      this.emit('tokens-refreshed', { serverId });

      return tokens;
    } catch (error) {
      log.error({ serverId, error }, 'Failed to refresh tokens');
      return null;
    }
  }

  /**
   * Create an OAuthClientProvider for the MCP SDK
   */
  createAuthProvider(serverId: string, config: MCPOAuthConfig): OAuthClientProvider {
    const self = this;

    return {
      get redirectUrl() {
        return config.redirectUri || 'meetingcopilot://oauth/callback';
      },

      get clientMetadata() {
        return {
          client_id: config.clientId,
          client_name: 'Meeting Copilot',
          redirect_uris: [config.redirectUri || 'meetingcopilot://oauth/callback'],
        };
      },

      clientInformation() {
        return {
          client_id: config.clientId,
          client_secret: config.clientSecret,
        };
      },

      async tokens() {
        const tokens = self.getTokens(serverId);
        if (!tokens) return undefined;

        return {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: tokens.tokenType,
          expires_at: tokens.expiresAt ? Math.floor(tokens.expiresAt.getTime() / 1000) : undefined,
        };
      },

      async saveTokens(tokens) {
        self.saveTokens(serverId, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenType: tokens.token_type || 'Bearer',
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        }, config.tokenUrl);
      },

      async redirectToAuthorization(authorizationUrl: URL) {
        await shell.openExternal(authorizationUrl.toString());
      },

      async saveCodeVerifier(verifier: string) {
        // Store temporarily - the SDK manages this
        self.pendingAuths.set(`verifier:${serverId}`, {
          serverId,
          config,
          codeVerifier: verifier,
          state: '',
          resolve: () => {},
          reject: () => {},
        });
      },

      async codeVerifier() {
        const pending = self.pendingAuths.get(`verifier:${serverId}`);
        return pending?.codeVerifier || '';
      },
    };
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Check if there's a pending auth for a server
   */
  hasPendingAuth(serverId: string): boolean {
    for (const pending of this.pendingAuths.values()) {
      if (pending.serverId === serverId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Cancel pending auth for a server
   */
  cancelPendingAuth(serverId: string): void {
    for (const [state, pending] of this.pendingAuths.entries()) {
      if (pending.serverId === serverId) {
        pending.reject(new Error('Authorization cancelled'));
        this.pendingAuths.delete(state);
      }
    }
  }
}

// Singleton instance
let instance: MCPAuthService | null = null;

export function getMCPAuthService(): MCPAuthService {
  if (!instance) {
    instance = new MCPAuthService();
  }
  return instance;
}

export function resetMCPAuthService(): void {
  instance = null;
}

export default MCPAuthService;
