/**
 * Google Auth Service
 *
 * Handles OAuth 2.0 PKCE flow for Google Calendar integration.
 * Uses a temporary HTTP server to receive the OAuth callback.
 */

import { BrowserWindow } from 'electron';
import crypto from 'crypto';
import net from 'net';
import http from 'http';
import { URL } from 'url';
import { logger } from '../lib/logger';
import {
  loadGoogleOAuthConfig,
  saveGoogleTokens,
  loadGoogleTokens,
  clearGoogleTokens,
  hasGoogleTokens,
} from '../lib/config';
import type { GoogleTokens } from '../../shared/types/calendar.types';

const log = logger.child({ module: 'google-auth' });

// Port range for OAuth callback server
const OAUTH_PORT_START = 51751;
const OAUTH_PORT_END = 51799;

// Token refresh mutex to prevent concurrent refreshes
let refreshPromise: Promise<GoogleTokens> | null = null;

/**
 * Find a free port in the specified range
 */
async function findFreePort(): Promise<number> {
  // Try preferred range first
  for (let port = OAUTH_PORT_START; port <= OAUTH_PORT_END; port++) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  // Fallback: let OS assign a free port
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not get port from server')));
      }
    });
    server.on('error', reject);
  });
}

/**
 * Check if a port is free
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

/**
 * Generate PKCE code verifier (43-128 characters)
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Build Google OAuth authorization URL
 */
function buildAuthUrl(clientId: string, redirectUri: string, codeChallenge: string, scopes: string[]): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
  return url.toString();
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenUri: string
): Promise<GoogleTokens> {
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ status: response.status, error: errorText }, 'Token exchange failed');
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    log.warn('No refresh token received - user may need to revoke and re-authorize');
  }

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveGoogleTokens(tokens);
  log.info('Tokens exchanged and saved successfully');

  return tokens;
}

/**
 * Start the OAuth PKCE flow
 * Opens a BrowserWindow for user consent and waits for callback
 */
export async function startAuthFlow(): Promise<GoogleTokens> {
  const config = loadGoogleOAuthConfig();
  if (!config) {
    throw new Error('Google OAuth config not found');
  }

  const port = await findFreePort();
  const redirectUri = `http://localhost:${port}`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  log.info({ port }, 'Starting OAuth flow');

  return new Promise((resolve, reject) => {
    let authWindow: BrowserWindow | null = null;
    let server: http.Server | null = null;
    let handled = false;

    const cleanup = () => {
      if (server) {
        server.close();
        server = null;
      }
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
        authWindow = null;
      }
    };

    // Create temporary HTTP server to receive callback
    server = http.createServer(async (req, res) => {
      if (handled) {
        res.writeHead(200);
        res.end('Already handled');
        return;
      }

      const url = new URL(req.url || '/', `http://localhost:${port}`);

      // Check for OAuth callback
      if (url.pathname === '/' || url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        handled = true;

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h2>Authorization Failed</h2>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(new Error(`OAuth denied: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h2>Authorization Failed</h2>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(new Error('No authorization code received'));
          return;
        }

        // Show success message
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h2>Authorization Successful!</h2>
              <p>You can close this window and return to Meeting Copilot.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);

        // Exchange code for tokens
        try {
          const tokens = await exchangeCodeForTokens(
            code,
            codeVerifier,
            config.clientId,
            config.clientSecret,
            redirectUri,
            config.tokenUri
          );
          cleanup();
          resolve(tokens);
        } catch (err) {
          cleanup();
          reject(err);
        }
      }
    });

    server.listen(port, () => {
      log.info({ port }, 'OAuth callback server listening');

      // Open auth window
      const authUrl = buildAuthUrl(config.clientId, redirectUri, codeChallenge, config.scopes);

      authWindow = new BrowserWindow({
        width: 500,
        height: 720,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL(authUrl);

      authWindow.on('closed', () => {
        authWindow = null;
        if (!handled) {
          cleanup();
          reject(new Error('Auth window closed by user'));
        }
      });
    });

    server.on('error', (err) => {
      log.error({ error: err }, 'OAuth callback server error');
      cleanup();
      reject(err);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!handled) {
        cleanup();
        reject(new Error('OAuth flow timed out'));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Refresh the access token using the refresh token
 * Uses a mutex to prevent concurrent refresh attempts
 */
async function doRefreshToken(): Promise<GoogleTokens> {
  const tokens = loadGoogleTokens();
  if (!tokens?.refreshToken) {
    throw new Error('NO_REFRESH_TOKEN');
  }

  const config = loadGoogleOAuthConfig();
  if (!config) {
    throw new Error('Google OAuth config not found');
  }

  log.info('Refreshing access token');

  const response = await fetch(config.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    // 400/401 means refresh token is invalid/revoked
    if (status === 400 || status === 401) {
      log.error({ status }, 'Refresh token expired or revoked');
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    throw new Error(`Token refresh failed: ${status}`);
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
  };

  const updated: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: tokens.refreshToken, // Keep existing refresh token
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveGoogleTokens(updated);
  log.info('Access token refreshed successfully');

  return updated;
}

/**
 * Refresh access token with mutex to prevent concurrent refreshes
 */
export async function refreshAccessToken(): Promise<GoogleTokens> {
  if (refreshPromise) {
    log.debug('Token refresh already in progress, waiting...');
    return refreshPromise;
  }

  refreshPromise = doRefreshToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Get a valid access token, refreshing if necessary
 * Returns null if not authenticated
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadGoogleTokens();
  if (!tokens) {
    return null;
  }

  // Refresh if expiring within 60 seconds
  if (Date.now() >= tokens.expiresAt - 60_000) {
    try {
      const refreshed = await refreshAccessToken();
      return refreshed.accessToken;
    } catch (error) {
      const err = error as Error;
      log.error({ error: err.message }, 'Failed to refresh token');
      // If refresh fails, return null to indicate re-auth needed
      if (err.message === 'NO_REFRESH_TOKEN' || err.message === 'REFRESH_TOKEN_EXPIRED') {
        return null;
      }
      throw error;
    }
  }

  return tokens.accessToken;
}

/**
 * Sign out - clear stored tokens
 */
export function signOut(): void {
  clearGoogleTokens();
  log.info('Signed out of Google');
}

/**
 * Check if user has stored tokens
 */
export function hasTokens(): boolean {
  return hasGoogleTokens();
}

/**
 * Check if user is authenticated (has valid tokens)
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!hasTokens()) {
    return false;
  }

  try {
    const token = await getValidAccessToken();
    return token !== null;
  } catch {
    return false;
  }
}
