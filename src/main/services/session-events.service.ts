import { connect } from 'videodb';
import type { WebSocketConnection } from 'videodb';
import { createChildLogger } from '../lib/logger';

const logger = createChildLogger('session-events');

let sessionWebSocket: WebSocketConnection | null = null;
let sessionListenerActive = false;

/**
 * Set up WebSocket connection to receive capture session lifecycle events.
 * This replaces the webhook-based approach that required cloudflared tunnel.
 */
export async function setupSessionWebSocket(
  sessionToken: string,
  apiUrl?: string
): Promise<string | null> {
  try {
    if (!sessionToken) {
      logger.warn('[SessionWS] No session token provided');
      return null;
    }

    const connectOptions: { sessionToken: string; baseUrl?: string } = { sessionToken };
    if (apiUrl) {
      connectOptions.baseUrl = apiUrl;
    }

    const videodbConnection = connect(connectOptions);

    const wsConnection = await videodbConnection.connectWebsocket();
    sessionWebSocket = await wsConnection.connect();
    sessionListenerActive = true;

    logger.info(
      { connectionId: sessionWebSocket.connectionId },
      '[SessionWS] Session WebSocket connected'
    );

    // Start listening for session lifecycle events
    listenForSessionEvents(sessionWebSocket);

    return sessionWebSocket.connectionId || null;
  } catch (err) {
    logger.error({ error: err }, '[SessionWS] Failed to create session WebSocket');
    return null;
  }
}

/**
 * Listen for session lifecycle events via WebSocket.
 * Handles capture_session channel events like exported, active, stopped, etc.
 */
async function listenForSessionEvents(ws: WebSocketConnection): Promise<void> {
  try {
    // Use stream with filter for capture_session channel
    for await (const msg of ws.stream({ channel: 'capture_session' })) {
      if (!sessionListenerActive) break;

      const event = (msg.event || msg.type) as string;
      const sessionId = msg.capture_session_id as string;
      const data = (msg.data || {}) as Record<string, unknown>;
      const status = msg.status as string | undefined;

      logger.info({ event, sessionId, status }, '[SessionWS] Session event received');

      // Note: We no longer rely on WebSocket for export detection.
      // Export completion is handled by the export-poller.service.ts which polls the API.
      // These events are kept for informational logging only.
      switch (event) {
        case 'capture_session.exported': {
          // Informational only - actual handling is done by export poller
          logger.info({ sessionId, data }, '[SessionWS] Received capture_session.exported (handled by poller)');
          break;
        }

        case 'capture_session.active': {
          logger.info({ sessionId }, '[SessionWS] Capture session is now active');
          break;
        }

        case 'capture_session.created': {
          logger.debug({ sessionId }, '[SessionWS] Capture session created');
          break;
        }

        case 'capture_session.stopped': {
          logger.info({ sessionId }, '[SessionWS] Capture session stopped, export poller will detect completion');
          break;
        }

        case 'capture_session.starting': {
          logger.info({ sessionId }, '[SessionWS] Capture session starting');
          break;
        }

        case 'capture_session.stopping': {
          logger.info({ sessionId }, '[SessionWS] Capture session stopping');
          break;
        }

        case 'capture_session.failed': {
          const error = data.error as Record<string, unknown> | undefined;
          logger.error({ sessionId, error }, '[SessionWS] Capture session failed');
          break;
        }

        default: {
          logger.debug({ event, sessionId }, '[SessionWS] Unhandled session event');
        }
      }
    }
  } catch (err) {
    if (sessionListenerActive) {
      logger.error({ error: err }, '[SessionWS] Error in session event listener');
    }
  }
}

/**
 * Clean up the session WebSocket connection.
 * Called when recording stops or app shuts down.
 */
export async function cleanupSessionWebSocket(): Promise<void> {
  sessionListenerActive = false;

  if (sessionWebSocket) {
    try {
      await sessionWebSocket.close();
      logger.info('[SessionWS] Session WebSocket closed');
    } catch (e) {
      // Ignore close errors
    }
    sessionWebSocket = null;
  }
}

/**
 * Check if the session WebSocket is currently connected.
 */
export function isSessionWebSocketConnected(): boolean {
  return sessionWebSocket?.isConnected ?? false;
}
