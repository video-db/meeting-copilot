import { connect } from 'videodb';
import type { WebSocketConnection } from 'videodb';
import { createChildLogger } from '../lib/logger';
import { updateRecordingBySessionId, getUserByAccessToken } from '../db';
import { createInsightsService } from './insights.service';

const logger = createChildLogger('session-events');

let sessionWebSocket: WebSocketConnection | null = null;
let sessionListenerActive = false;

// Map session IDs to access tokens for user lookup when export completes
const sessionUserMap = new Map<string, string>();

/**
 * Register a session with its user's access token.
 * Called when recording starts so we can look up the user when export completes.
 */
export function registerSessionUser(sessionId: string, accessToken: string): void {
  sessionUserMap.set(sessionId, accessToken);
  logger.debug({ sessionId }, 'Registered session user mapping');
}

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

      switch (event) {
        case 'capture_session.exported': {
          logger.info({ sessionId, data }, '[SessionWS] Processing capture_session.exported');
          await handleCaptureSessionExported(sessionId, data);
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
          logger.info({ sessionId }, '[SessionWS] Capture session stopped, waiting for export');
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
 * Handle the capture_session.exported event.
 * Updates the recording with video info and triggers insights processing.
 */
async function handleCaptureSessionExported(
  sessionId: string,
  data: Record<string, unknown>
): Promise<void> {
  logger.info({ sessionId, data }, '[SessionWS] handleCaptureSessionExported called');

  if (!data) {
    logger.warn({ sessionId }, '[SessionWS] No data in capture_session.exported event');
    return;
  }

  logger.info({ sessionId, dataKeys: Object.keys(data) }, '[SessionWS] Data keys available');

  // Extract video info from the event data
  const videoId = data.exported_video_id as string | undefined;
  const streamUrl = data.stream_url as string | undefined;
  const playerUrl = data.player_url as string | undefined;
  const duration = data.duration as number | undefined;

  logger.info(
    { sessionId, videoId, streamUrl, playerUrl, duration },
    '[SessionWS] Extracted data from payload'
  );

  if (!videoId) {
    logger.warn(
      { sessionId, data },
      '[SessionWS] No exported_video_id in capture_session.exported event'
    );
    return;
  }

  logger.info({ sessionId, videoId }, '[SessionWS] Processing capture session export');

  const recording = updateRecordingBySessionId(sessionId, {
    videoId,
    streamUrl: streamUrl || null,
    playerUrl: playerUrl || null,
    duration: duration || null,
    status: 'available',
    insightsStatus: 'pending',
  });

  if (!recording) {
    logger.warn({ sessionId }, '[SessionWS] Recording not found for session');
    return;
  }

  logger.info(
    {
      recordingId: recording.id,
      videoId,
      status: recording.status,
      insightsStatus: recording.insightsStatus,
    },
    '[SessionWS] Recording updated with video info'
  );

  const accessToken = sessionUserMap.get(sessionId);
  logger.info(
    {
      sessionId,
      hasAccessToken: !!accessToken,
      sessionUserMapSize: sessionUserMap.size,
    },
    '[SessionWS] Looking up user for session'
  );

  if (!accessToken) {
    logger.warn({ sessionId }, '[SessionWS] No user mapping found for session, skipping insights');
    return;
  }

  const user = getUserByAccessToken(accessToken);
  if (!user) {
    logger.warn({ sessionId }, '[SessionWS] User not found for session, skipping insights');
    return;
  }

  logger.info(
    { sessionId, userId: user.id, userName: user.name },
    '[SessionWS] Starting insights processing'
  );

  const insightsService = createInsightsService(user.apiKey);

  // Fire and forget - don't await
  insightsService
    .processRecording(recording.id, videoId)
    .then((result) => {
      logger.info({ recordingId: recording.id, result }, '[SessionWS] Insights processing completed');
    })
    .catch((error) => {
      logger.error(
        { error, recordingId: recording.id },
        '[SessionWS] Background insights processing failed'
      );
    });

  sessionUserMap.delete(sessionId);
  logger.info({ sessionId }, '[SessionWS] Session user mapping cleaned up');
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
