import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  RecordingSchema,
  CreateRecordingInputSchema,
  StopRecordingInputSchema,
  GetRecordingInputSchema,
  KeyPointsSchema,
  PlaybookSnapshotSchema,
  MetricsSnapshotSchema,
  ProbingQuestionSchema,
  type KeyPoints,
  type PlaybookSnapshot,
  type MetricsSnapshot,
} from '../../../../shared/schemas/recording.schema';
import {
  getAllRecordings,
  createRecording,
  updateRecordingBySessionId,
  getRecordingById,
  getTranscriptSegmentsByRecording,
} from '../../../db';
import { createChildLogger } from '../../../lib/logger';
import { loadRuntimeConfig } from '../../../lib/config';
import { checkAndRecoverSession } from '../../../services/recording-export.service';
import { createVideoDBService } from '../../../services/videodb.service';

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

  // Parse meeting setup data
  const probingQuestions = safeJsonParse(
    (dbRecording as any).probingQuestions,
    z.array(ProbingQuestionSchema)
  );
  const meetingChecklist = safeJsonParse(
    (dbRecording as any).meetingChecklist,
    z.array(z.string())
  );
  const postMeetingChecklist = safeJsonParse(
    (dbRecording as any).postMeetingChecklist,
    z.array(z.string())
  );

  return {
    id: dbRecording.id,
    videoId: dbRecording.videoId,
    collectionId: (dbRecording as any).collectionId || null,
    streamUrl: dbRecording.streamUrl,
    playerUrl: dbRecording.playerUrl,
    sessionId: dbRecording.sessionId,
    duration: dbRecording.duration,
    createdAt: dbRecording.createdAt,
    status: dbRecording.status as 'recording' | 'processing' | 'available' | 'failed',
    insights: dbRecording.insights,
    insightsStatus: dbRecording.insightsStatus as 'pending' | 'processing' | 'ready' | 'failed',
    // Parse and validate copilot data
    shortOverview: (dbRecording as any).shortOverview || null,
    keyPoints: safeJsonParse<KeyPoints>((dbRecording as any).keyPoints, KeyPointsSchema),
    playbookSnapshot: safeJsonParse<PlaybookSnapshot>(dbRecording.playbookSnapshot, PlaybookSnapshotSchema),
    metricsSnapshot: safeJsonParse<MetricsSnapshot>(dbRecording.metricsSnapshot, MetricsSnapshotSchema),
    // Meeting Setup data
    meetingName: (dbRecording as any).meetingName || null,
    meetingDescription: (dbRecording as any).meetingDescription || null,
    probingQuestions: probingQuestions || null,
    meetingChecklist: meetingChecklist || null,
    // Post-meeting analysis
    postMeetingChecklist: postMeetingChecklist || null,
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

  getTranscript: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .output(z.array(z.object({
      id: z.string(),
      channel: z.enum(['me', 'them']),
      text: z.string(),
      startTime: z.number(),
      endTime: z.number(),
    })))
    .query(async ({ input }) => {
      logger.debug({ recordingId: input.recordingId }, 'Fetching transcript');
      const segments = getTranscriptSegmentsByRecording(input.recordingId);
      return segments.map(s => ({
        id: s.id,
        channel: s.channel as 'me' | 'them',
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    }),

  start: protectedProcedure
    .input(CreateRecordingInputSchema)
    .output(RecordingSchema)
    .mutation(async ({ input }) => {
      logger.info({ sessionId: input.sessionId, hasMeetingSetup: !!input.meetingName }, 'Starting recording');

      const recordingData: any = {
        sessionId: input.sessionId,
        status: 'recording',
      };

      // Add meeting setup data if provided
      if (input.meetingName) {
        recordingData.meetingName = input.meetingName;
      }
      if (input.meetingDescription) {
        recordingData.meetingDescription = input.meetingDescription;
      }
      if (input.probingQuestions) {
        recordingData.probingQuestions = JSON.stringify(input.probingQuestions);
      }
      if (input.meetingChecklist) {
        recordingData.meetingChecklist = JSON.stringify(input.meetingChecklist);
      }

      const recording = createRecording(recordingData);

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
        if ((recording.status === 'processing' || recording.status === 'recording') && !(recording as any).shortOverview) {
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

  downloadVideo: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .output(z.object({ downloadUrl: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      logger.debug({ recordingId: input.recordingId }, 'Getting video download URL');

      const recording = getRecordingById(input.recordingId);
      if (!recording || !recording.videoId) {
        throw new Error('Recording or video not found');
      }

      const apiKey = ctx.user?.apiKey;
      if (!apiKey) {
        throw new Error('API key not found');
      }

      try {
        const runtimeConfig = loadRuntimeConfig();
        const service = createVideoDBService(apiKey, runtimeConfig.apiUrl);
        const result = await service.downloadVideo(recording.videoId, recording.meetingName || undefined);
        logger.info({ recordingId: input.recordingId, result }, 'Video download URL obtained');
        return result;
      } catch (error) {
        logger.error({ recordingId: input.recordingId, error }, 'Failed to get video download URL');
        throw error;
      }
    }),

  // Populate collectionId for recordings that don't have it
  populateCollectionId: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .output(z.object({ collectionId: z.string().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const recording = getRecordingById(input.recordingId);
      if (!recording || !recording.videoId) {
        return { collectionId: null };
      }

      // Already has collectionId
      if ((recording as any).collectionId) {
        return { collectionId: (recording as any).collectionId };
      }

      const apiKey = ctx.user?.apiKey;
      if (!apiKey) {
        return { collectionId: null };
      }

      try {
        const runtimeConfig = loadRuntimeConfig();
        const service = createVideoDBService(apiKey, runtimeConfig.apiUrl);
        const video = await service.getVideo(recording.videoId);
        const collectionId = video.collectionId || null;

        if (collectionId) {
          updateRecordingBySessionId(recording.sessionId, { collectionId });
          logger.info({ recordingId: input.recordingId, collectionId }, 'Populated collectionId for recording');
        }

        return { collectionId };
      } catch (error) {
        logger.error({ error, recordingId: input.recordingId }, 'Failed to fetch collectionId');
        return { collectionId: null };
      }
    }),
});
