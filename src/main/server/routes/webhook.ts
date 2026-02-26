import { Hono } from 'hono';
import type { WebhookPayload } from '../../../shared/schemas/webhook.schema';
import {
  getRecordingBySessionId,
  updateRecordingBySessionId,
} from '../../db';
import { createInsightsService } from '../../services/insights.service';
import { getUserByAccessToken } from '../../db';
import { createChildLogger } from '../../lib/logger';

const logger = createChildLogger('webhook-route');

export const webhookRouter = new Hono();

const sessionUserMap = new Map<string, string>();

export function registerSessionUser(sessionId: string, accessToken: string): void {
  sessionUserMap.set(sessionId, accessToken);
  logger.debug({ sessionId }, 'Registered session user mapping');
}

webhookRouter.post('/webhook', async (c) => {
  try {
    const payload = (await c.req.json()) as WebhookPayload;

    logger.info({
      event: payload.event,
      sessionId: payload.capture_session_id,
      data: payload.data,
    }, 'Webhook received');

    const sessionId = payload.capture_session_id;

    if (!sessionId) {
      logger.debug({ event: payload.event, data: payload.data }, 'Webhook received without session ID');
      return c.json({ status: 'ok', received: true });
    }

    switch (payload.event) {
      case 'capture_session.exported': {
        logger.info({ sessionId, data: payload.data }, 'Processing capture_session.exported');
        await handleCaptureSessionExported(sessionId, payload.data);
        break;
      }

      case 'capture_session.active': {
        logger.info({ sessionId }, 'Capture session is now active');
        break;
      }

      case 'capture_session.created': {
        logger.debug({ sessionId }, 'Capture session created acknowledgment received');
        break;
      }

      case 'capture_session.stopped': {
        logger.info({ sessionId }, 'Capture session stopped, waiting for export');
        break;
      }
      
      case 'capture_session.starting': {
        logger.info({ sessionId }, 'Capture session starting');
        break;
      }

      default: {
        if (payload.event.startsWith('transcript.')) {
          logger.debug({ event: payload.event, sessionId }, 'Transcript event received');
        } else {
          logger.info({ event: payload.event, data: payload.data }, 'Unhandled webhook event');
        }
      }
    }

    return c.json({ status: 'ok', received: true });
  } catch (error) {
    logger.error({ error }, 'Webhook processing error');
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
});

async function handleCaptureSessionExported(
  sessionId: string,
  data: Record<string, unknown> | undefined
): Promise<void> {
  logger.info({ sessionId, data }, '[Webhook] handleCaptureSessionExported called');

  if (!data) {
    logger.warn({ sessionId }, '[Webhook] No data in capture_session.exported event');
    return;
  }

  logger.info({ sessionId, dataKeys: Object.keys(data) }, '[Webhook] Data keys available');

  // Use exported_video_id (matching Python webhook handler)
  const videoId = data.exported_video_id as string | undefined;
  const streamUrl = data.stream_url as string | undefined;
  const playerUrl = data.player_url as string | undefined;
  const duration = data.duration as number | undefined;

  logger.info({
    sessionId,
    videoId,
    streamUrl,
    playerUrl,
    duration,
  }, '[Webhook] Extracted data from payload');

  if (!videoId) {
    logger.warn({ sessionId, data }, '[Webhook] No exported_video_id in capture_session.exported event');
    return;
  }

  logger.info({ sessionId, videoId }, '[Webhook] Processing capture session export');

  const recording = updateRecordingBySessionId(sessionId, {
    videoId,
    streamUrl: streamUrl || null,
    playerUrl: playerUrl || null,
    duration: duration || null,
    status: 'available',
    insightsStatus: 'pending',
  });

  if (!recording) {
    logger.warn({ sessionId }, '[Webhook] Recording not found for session');
    return;
  }

  logger.info({
    recordingId: recording.id,
    videoId,
    status: recording.status,
    insightsStatus: recording.insightsStatus,
  }, '[Webhook] Recording updated with video info');

  const accessToken = sessionUserMap.get(sessionId);
  logger.info({
    sessionId,
    hasAccessToken: !!accessToken,
    sessionUserMapSize: sessionUserMap.size,
    sessionUserMapKeys: Array.from(sessionUserMap.keys()),
  }, '[Webhook] Looking up user for session');

  if (!accessToken) {
    logger.warn({ sessionId }, '[Webhook] No user mapping found for session, skipping insights');
    return;
  }

  const user = getUserByAccessToken(accessToken);
  if (!user) {
    logger.warn({ sessionId }, '[Webhook] User not found for session, skipping insights');
    return;
  }

  logger.info({ sessionId, userId: user.id, userName: user.name }, '[Webhook] Starting insights processing');

  const insightsService = createInsightsService(user.apiKey);

  // Fire and forget - don't await
  insightsService.processRecording(recording.id, videoId).then((result) => {
    logger.info({ recordingId: recording.id, result }, '[Webhook] Insights processing completed');
  }).catch((error) => {
    logger.error({ error, recordingId: recording.id }, '[Webhook] Background insights processing failed');
  });

  sessionUserMap.delete(sessionId);
  logger.info({ sessionId }, '[Webhook] Session user mapping cleaned up');
}
