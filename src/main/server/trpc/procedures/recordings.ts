import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  RecordingSchema,
  CreateRecordingInputSchema,
  StopRecordingInputSchema,
  GetRecordingInputSchema,
  CallSummarySchema,
  PlaybookSnapshotSchema,
  MetricsSnapshotSchema,
  type CallSummary,
  type PlaybookSnapshot,
  type MetricsSnapshot,
} from '../../../../shared/schemas/recording.schema';
import {
  getAllRecordings,
  createRecording,
  updateRecordingBySessionId,
  getRecordingById,
} from '../../../db';
import { createChildLogger } from '../../../lib/logger';
import { loadRuntimeConfig } from '../../../lib/config';
import { checkAndRecoverSession } from '../../../services/recording-export.service';

const logger = createChildLogger('recordings-procedure');

// Safely parse and validate JSON against schema
function safeJsonParse<T>(
  json: string | null | undefined,
  schema: z.ZodType<T>
): T | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

// Transform database recording to API schema
function toApiRecording(dbRecording: ReturnType<typeof getRecordingById>) {
  if (!dbRecording) return null;

  return {
    id: dbRecording.id,
    videoId: dbRecording.videoId,
    streamUrl: dbRecording.streamUrl,
    playerUrl: dbRecording.playerUrl,
    sessionId: dbRecording.sessionId,
    duration: dbRecording.duration,
    createdAt: dbRecording.createdAt,
    status: dbRecording.status as 'recording' | 'processing' | 'available' | 'failed',
    insights: dbRecording.insights,
    insightsStatus: dbRecording.insightsStatus as 'pending' | 'processing' | 'ready' | 'failed',
    // Parse and validate copilot data from JSON strings
    callSummary: safeJsonParse<CallSummary>(dbRecording.callSummary, CallSummarySchema),
    playbookSnapshot: safeJsonParse<PlaybookSnapshot>(dbRecording.playbookSnapshot, PlaybookSnapshotSchema),
    metricsSnapshot: safeJsonParse<MetricsSnapshot>(dbRecording.metricsSnapshot, MetricsSnapshotSchema),
  };
}

export const recordingsRouter = router({
  list: protectedProcedure
    .output(z.array(RecordingSchema))
    .query(async () => {
      logger.info('Fetching all recordings');
      const recordings = getAllRecordings();
      logger.info({
        count: recordings.length,
        recordings: recordings.map(r => ({
          id: r.id,
          sessionId: r.sessionId,
          status: r.status,
          insightsStatus: r.insightsStatus,
          videoId: r.videoId,
        })),
      }, 'Recordings fetched');
      return recordings.map((r) => toApiRecording(r)!);
    }),

  get: protectedProcedure
    .input(GetRecordingInputSchema)
    .output(RecordingSchema.nullable())
    .query(async ({ input }) => {
      logger.debug({ recordingId: input.recordingId }, 'Fetching recording');
      const recording = getRecordingById(input.recordingId);
      return toApiRecording(recording);
    }),

  start: protectedProcedure
    .input(CreateRecordingInputSchema)
    .output(RecordingSchema)
    .mutation(async ({ input }) => {
      logger.info({ sessionId: input.sessionId }, 'Starting recording');

      const recording = createRecording({
        sessionId: input.sessionId,
        status: 'recording',
      });

      logger.info(
        { recordingId: recording.id, sessionId: input.sessionId },
        'Recording started'
      );

      return toApiRecording(recording)!;
    }),

  stop: protectedProcedure
    .input(StopRecordingInputSchema)
    .output(RecordingSchema.nullable())
    .mutation(async ({ input }) => {
      logger.info({ sessionId: input.sessionId }, 'Stopping recording');

      const recording = updateRecordingBySessionId(input.sessionId, {
        status: 'processing',
      });

      if (!recording) {
        logger.warn({ sessionId: input.sessionId }, 'Recording not found');
        return null;
      }

      logger.info(
        { recordingId: recording.id, sessionId: input.sessionId },
        'Recording stopped, status set to processing'
      );

      return toApiRecording(recording);
    }),

  markFailed: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .output(RecordingSchema.nullable())
    .mutation(async ({ input }) => {
      logger.info({ sessionId: input.sessionId }, 'Marking recording as failed');

      const recording = updateRecordingBySessionId(input.sessionId, {
        status: 'failed',
      });

      if (!recording) {
        logger.warn({ sessionId: input.sessionId }, 'Recording not found');
        return null;
      }

      logger.info(
        { recordingId: recording.id, sessionId: input.sessionId },
        'Recording marked as failed'
      );

      return toApiRecording(recording);
    }),

  cleanupStale: protectedProcedure
    .input(z.object({ maxAgeMinutes: z.number().default(30) }))
    .output(z.object({ cleaned: z.number(), recovered: z.number() }))
    .mutation(async ({ input, ctx }) => {
      logger.info({ maxAgeMinutes: input.maxAgeMinutes }, 'Cleaning up stale recordings');

      const recordings = getAllRecordings();
      const now = Date.now();
      const maxAgeMs = input.maxAgeMinutes * 60 * 1000;
      let cleaned = 0;
      let recovered = 0;

      const apiKey = ctx.user?.apiKey;
      const runtimeConfig = loadRuntimeConfig();
      const apiUrl = runtimeConfig.apiUrl;

      // Try to recover processing recordings from VideoDB
      if (apiKey) {
        const processingRecordings = recordings.filter(
          r => r.status === 'processing' && !r.videoId
        );

        for (const recording of processingRecordings) {
          const result = await checkAndRecoverSession(
            recording.sessionId,
            apiKey,
            apiUrl,
            true // trigger insights
          );

          if (result.exported && result.success) {
            recovered++;
            logger.info(
              { recordingId: recording.id, sessionId: recording.sessionId, videoId: result.videoId },
              'Recording recovered'
            );
          }
        }
      }

      // Mark truly stale recordings as failed
      const updatedRecordings = getAllRecordings();
      for (const recording of updatedRecordings) {
        if ((recording.status === 'processing' || recording.status === 'recording') && !recording.callSummary) {
          const createdAt = new Date(recording.createdAt).getTime();
          const age = now - createdAt;

          if (age > maxAgeMs) {
            updateRecordingBySessionId(recording.sessionId, { status: 'failed' });
            logger.info(
              { recordingId: recording.id, sessionId: recording.sessionId, ageMinutes: Math.round(age / 60000) },
              'Marked stale recording as failed'
            );
            cleaned++;
          }
        }
      }

      logger.info({ cleaned, recovered }, 'Stale recordings cleanup complete');
      return { cleaned, recovered };
    }),
});
