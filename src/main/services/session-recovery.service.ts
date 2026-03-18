/**
 * Session Recovery Service
 *
 * Recovers recordings that were exported by VideoDB while the app was closed.
 * Called on app startup to handle missed exports.
 */

import { createChildLogger } from '../lib/logger';
import { getAllRecordings } from '../db';
import { checkAndRecoverSession } from './recording-export.service';

const logger = createChildLogger('session-recovery');

export interface RecoveryResult {
  recovered: number;
  failed: number;
  skipped: number;
}

/**
 * Recover any recordings stuck in 'processing' status
 */
export async function recoverPendingSessions(
  apiKey: string,
  apiUrl?: string
): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    recovered: 0,
    failed: 0,
    skipped: 0,
  };

  const allRecordings = getAllRecordings();
  const pendingRecordings = allRecordings.filter(
    r => r.status === 'processing' && !r.videoId
  );

  if (pendingRecordings.length === 0) {
    logger.debug('No pending recordings to recover');
    return result;
  }

  logger.info({ count: pendingRecordings.length }, 'Found pending recordings to recover');

  for (const recording of pendingRecordings) {
    const recovery = await checkAndRecoverSession(
      recording.sessionId,
      apiKey,
      apiUrl,
      true // trigger insights
    );

    if (recovery.exported && recovery.success) {
      result.recovered++;
      logger.info(
        { sessionId: recording.sessionId, videoId: recovery.videoId },
        'Recording recovered'
      );
    } else if (recovery.exported && !recovery.success) {
      result.failed++;
      logger.error(
        { sessionId: recording.sessionId, error: recovery.error },
        'Failed to recover exported recording'
      );
    } else {
      result.skipped++;
      logger.debug(
        { sessionId: recording.sessionId },
        'Recording not exported yet, skipping'
      );
    }
  }

  logger.info(result, 'Session recovery complete');
  return result;
}

// Factory function for backward compatibility
export function createSessionRecoveryService(apiKey: string, apiUrl?: string) {
  return {
    recoverPendingSessions: () => recoverPendingSessions(apiKey, apiUrl),
  };
}
