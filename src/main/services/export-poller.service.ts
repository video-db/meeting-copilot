/**
 * Export Poller Service
 *
 * Polls VideoDB for capture session export completion.
 * Replaces the unreliable WebSocket-based approach.
 */

import { createChildLogger } from '../lib/logger';
import { updateRecordingBySessionId } from '../db';
import { checkSessionExport, recoverExportedRecording } from './recording-export.service';

const logger = createChildLogger('export-poller');

// Polling configuration
const POLL_INTERVAL_MS = 3000; // 3 seconds
const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // 30 minutes max

// Track active pollers
interface ActivePoller {
  intervalId: NodeJS.Timeout;
  startTime: number;
  apiKey: string;
  apiUrl?: string;
}

const activePollers = new Map<string, ActivePoller>();

/**
 * Start polling for capture session export completion
 */
export function startExportPoller(
  sessionId: string,
  apiKey: string,
  _accessToken: string, // Kept for API compatibility, not used
  apiUrl?: string
): void {
  if (activePollers.has(sessionId)) {
    logger.debug({ sessionId }, 'Poller already active for session');
    return;
  }

  logger.info({ sessionId }, 'Starting export poller');

  const startTime = Date.now();

  const pollForExport = async () => {
    const elapsed = Date.now() - startTime;

    // Check timeout
    if (elapsed > MAX_POLL_DURATION_MS) {
      logger.warn({ sessionId, elapsedMs: elapsed }, 'Polling timed out');
      stopExportPoller(sessionId);
      updateRecordingBySessionId(sessionId, { status: 'failed' });
      return;
    }

    const result = await checkSessionExport(sessionId, apiKey, apiUrl);

    logger.debug(
      { sessionId, status: result.status, exportedVideoId: result.videoId },
      'Polled session status'
    );

    if (result.exported && result.videoId) {
      logger.info({ sessionId, exportedVideoId: result.videoId }, 'Session exported!');
      stopExportPoller(sessionId);

      const recovery = await recoverExportedRecording(
        sessionId,
        result.videoId,
        apiKey,
        apiUrl,
        true // trigger insights
      );

      if (!recovery.success) {
        logger.error({ sessionId, error: recovery.error }, 'Failed to recover recording');
      }
    } else if (result.status === 'failed') {
      logger.error({ sessionId }, 'Session failed on VideoDB');
      stopExportPoller(sessionId);
      updateRecordingBySessionId(sessionId, { status: 'failed' });
    } else if (result.error) {
      // Transient error, keep polling
      logger.debug({ sessionId, error: result.error }, 'Poll error, will retry');
    }
  };

  // Poll immediately, then at intervals
  pollForExport();
  const intervalId = setInterval(pollForExport, POLL_INTERVAL_MS);

  activePollers.set(sessionId, { intervalId, startTime, apiKey, apiUrl });
}

/**
 * Stop the export poller for a session
 */
export function stopExportPoller(sessionId: string): void {
  const poller = activePollers.get(sessionId);
  if (poller) {
    clearInterval(poller.intervalId);
    activePollers.delete(sessionId);
    logger.debug({ sessionId }, 'Stopped poller');
  }
}

/**
 * Stop all active pollers (for app shutdown)
 */
export function stopAllExportPollers(): void {
  for (const [sessionId] of activePollers) {
    stopExportPoller(sessionId);
  }
  logger.info({ count: activePollers.size }, 'All pollers stopped');
}

/**
 * Check if a poller is active for a session
 */
export function isPollerActive(sessionId: string): boolean {
  return activePollers.has(sessionId);
}

/**
 * Get count of active pollers
 */
export function getActivePollerCount(): number {
  return activePollers.size;
}
