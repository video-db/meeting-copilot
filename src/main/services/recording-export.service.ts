/**
 * Recording Export Service
 *
 * Centralized service for handling capture session exports.
 * Used by:
 * - Export poller (real-time polling after recording stops)
 * - Session recovery (startup recovery for missed exports)
 * - Cleanup stale (on-demand recovery check)
 */

import { connect } from 'videodb';
import type { CaptureSessionFull } from 'videodb';
import { createChildLogger } from '../lib/logger';
import { updateRecordingBySessionId } from '../db';
import { createInsightsService } from './insights.service';

const logger = createChildLogger('recording-export');

export interface ExportCheckResult {
  exported: boolean;
  videoId?: string;
  status?: string;
  error?: string;
}

export interface ExportRecoveryResult {
  success: boolean;
  recordingId?: number;
  videoId?: string;
  error?: string;
}

/**
 * Check if a capture session has exported
 */
export async function checkSessionExport(
  sessionId: string,
  apiKey: string,
  apiUrl?: string
): Promise<ExportCheckResult> {
  try {
    const conn = connect(apiUrl ? { apiKey, baseUrl: apiUrl } : { apiKey });
    const session: CaptureSessionFull = await conn.getCaptureSession(sessionId);
    await session.refresh();

    return {
      exported: !!session.exportedVideoId,
      videoId: session.exportedVideoId,
      status: session.status,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.debug({ sessionId, error: errorMsg }, 'Failed to check session export status');
    return {
      exported: false,
      error: errorMsg,
    };
  }
}

/**
 * Recover a recording that has exported on VideoDB
 * Updates the local database and triggers insights processing
 */
export async function recoverExportedRecording(
  sessionId: string,
  videoId: string,
  apiKey: string,
  apiUrl?: string,
  triggerInsights: boolean = true
): Promise<ExportRecoveryResult> {
  try {
    const conn = connect(apiUrl ? { apiKey, baseUrl: apiUrl } : { apiKey });
    const collection = await conn.getCollection();
    const video = await collection.getVideo(videoId);

    // Parse duration from video.length
    let duration: number | null = null;
    if (video.length) {
      const parsed = parseFloat(video.length);
      if (!isNaN(parsed)) {
        duration = Math.round(parsed);
      }
    }

    // Update recording in database
    const recording = updateRecordingBySessionId(sessionId, {
      videoId,
      streamUrl: video.streamUrl || null,
      playerUrl: video.playerUrl || null,
      duration,
      status: 'available',
      insightsStatus: 'pending',
    });

    if (!recording) {
      return {
        success: false,
        error: 'Recording not found in database',
      };
    }

    logger.info(
      {
        sessionId,
        recordingId: recording.id,
        videoId,
        streamUrl: video.streamUrl,
        playerUrl: video.playerUrl,
        duration,
      },
      'Recording recovered with video info'
    );

    // Trigger insights processing (fire and forget)
    if (triggerInsights) {
      const insightsService = createInsightsService(apiKey, apiUrl);
      insightsService
        .processRecording(recording.id, videoId)
        .then((result) => {
          logger.info({ recordingId: recording.id, result }, 'Insights processing completed');
        })
        .catch((err) => {
          logger.error({ error: err, recordingId: recording.id }, 'Insights processing failed');
        });
    }

    return {
      success: true,
      recordingId: recording.id,
      videoId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ sessionId, videoId, error: errorMsg }, 'Failed to recover exported recording');
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Check and recover a session in one call
 * Convenience method that combines checkSessionExport + recoverExportedRecording
 */
export async function checkAndRecoverSession(
  sessionId: string,
  apiKey: string,
  apiUrl?: string,
  triggerInsights: boolean = true
): Promise<ExportRecoveryResult & { exported: boolean }> {
  const checkResult = await checkSessionExport(sessionId, apiKey, apiUrl);

  if (!checkResult.exported || !checkResult.videoId) {
    return {
      exported: false,
      success: false,
      error: checkResult.error || 'Not exported yet',
    };
  }

  const recoveryResult = await recoverExportedRecording(
    sessionId,
    checkResult.videoId,
    apiKey,
    apiUrl,
    triggerInsights
  );

  return {
    exported: true,
    ...recoveryResult,
  };
}
