import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { createChildLogger } from '../../../lib/logger';
import { loadRuntimeConfig } from '../../../lib/config';
import { connect } from 'videodb';
import type { CaptureSessionFull, RTStream } from 'videodb';

const logger = createChildLogger('visual-index-procedure');

// Store active scene indexes by session ID
const activeSceneIndexes = new Map<string, {
  sceneIndexId: string;
  rtstreamId: string;
  apiKey: string;
  apiUrl?: string;
}>();

const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findScreenRTStream(
  sessionId: string,
  apiKey: string,
  apiUrl?: string
): Promise<RTStream | null> {
  const connectOptions: { apiKey: string; baseUrl?: string } = { apiKey };
  if (apiUrl) {
    connectOptions.baseUrl = apiUrl;
  }
  const conn = connect(connectOptions);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const session: CaptureSessionFull = await conn.getCaptureSession(sessionId);
      if (!session) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      await session.refresh();

      let screens = session.getRTStream('screen');
      if (screens.length === 0) {
        screens = (session.rtstreams || []).filter((stream) => {
          const name = (stream.name || '').toLowerCase();
          const channelId = (stream.channelId || '').toLowerCase();
          return (
            name.includes('display') ||
            name.includes('screen') ||
            channelId.includes('display') ||
            channelId.includes('screen')
          );
        });
      }

      if (screens.length > 0) {
        return screens[0];
      }

      logger.info({ attempt: attempt + 1 }, '[VisualIndex] Screen RTStream not ready, waiting...');
      await sleep(RETRY_DELAY_MS);
    } catch (error) {
      logger.warn({ attempt: attempt + 1, error }, '[VisualIndex] Attempt error');
      await sleep(RETRY_DELAY_MS);
    }
  }

  return null;
}

export const visualIndexRouter = router({
  /**
   * Start visual indexing for a session.
   * Creates a new scene index and begins indexing.
   */
  start: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      screenWsConnectionId: z.string(),
    }))
    .output(z.object({
      success: z.boolean(),
      sceneIndexId: z.string().optional(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sessionId, screenWsConnectionId } = input;

      logger.info({ sessionId, screenWsConnectionId }, '[VisualIndex] Starting visual indexing');

      const apiKey = ctx.user?.apiKey;
      if (!apiKey) {
        return { success: false, message: 'No API key available' };
      }

      const runtimeConfig = loadRuntimeConfig();
      const apiUrl = runtimeConfig.apiUrl;

      // Check if already have an active scene index for this session
      const existing = activeSceneIndexes.get(sessionId);
      if (existing) {
        logger.info({ sessionId, sceneIndexId: existing.sceneIndexId }, '[VisualIndex] Scene index already exists, resuming');
        // Resume the existing one
        try {
          const connectOptions: { apiKey: string; baseUrl?: string } = { apiKey };
          if (apiUrl) connectOptions.baseUrl = apiUrl;
          const conn = connect(connectOptions);
          const session = await conn.getCaptureSession(sessionId);
          await session.refresh();

          const screens = (session.rtstreams || []).filter(s => s.id === existing.rtstreamId);
          if (screens.length > 0) {
            const sceneIndexes = await screens[0].listSceneIndexes();
            const sceneIndex = sceneIndexes.find(si => si.rtstreamIndexId === existing.sceneIndexId);
            if (sceneIndex) {
              await sceneIndex.start();
              return { success: true, sceneIndexId: existing.sceneIndexId, message: 'Visual indexing resumed' };
            }
          }
        } catch (err) {
          logger.warn({ error: err }, '[VisualIndex] Failed to resume existing, creating new');
        }
      }

      // Find screen RTStream
      const screenStream = await findScreenRTStream(sessionId, apiKey, apiUrl);
      if (!screenStream) {
        return { success: false, message: 'Screen RTStream not found' };
      }

      try {
        const sceneIndex = await screenStream.indexVisuals({
          batchConfig: {
            type: 'time',
            value: 5,
            frameCount: 3,
          },
          prompt: 'Describe what is visible on the screen. Focus on any presentations, documents, charts, dashboards, or important visual content. Be concise.',
          socketId: screenWsConnectionId,
        });

        if (!sceneIndex) {
          return { success: false, message: 'Failed to create scene index' };
        }

        const sceneIndexId = sceneIndex.rtstreamIndexId;

        // Store for later pause/resume
        activeSceneIndexes.set(sessionId, {
          sceneIndexId,
          rtstreamId: screenStream.id,
          apiKey,
          apiUrl,
        });

        logger.info({ sessionId, sceneIndexId }, '[VisualIndex] Visual indexing started');

        return { success: true, sceneIndexId, message: 'Visual indexing started' };
      } catch (error) {
        logger.error({ error }, '[VisualIndex] Failed to start visual indexing');
        return { success: false, message: 'Failed to start visual indexing' };
      }
    }),

  /**
   * Pause visual indexing for a session.
   */
  pause: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sessionId } = input;

      logger.info({ sessionId }, '[VisualIndex] Pausing visual indexing');

      const stored = activeSceneIndexes.get(sessionId);
      if (!stored) {
        return { success: false, message: 'No active scene index found' };
      }

      const apiKey = ctx.user?.apiKey || stored.apiKey;
      const apiUrl = stored.apiUrl;

      try {
        const connectOptions: { apiKey: string; baseUrl?: string } = { apiKey };
        if (apiUrl) connectOptions.baseUrl = apiUrl;
        const conn = connect(connectOptions);

        const session = await conn.getCaptureSession(sessionId);
        await session.refresh();

        const screens = (session.rtstreams || []).filter(s => s.id === stored.rtstreamId);
        if (screens.length === 0) {
          return { success: false, message: 'Screen RTStream not found' };
        }

        const sceneIndexes = await screens[0].listSceneIndexes();
        const sceneIndex = sceneIndexes.find(si => si.rtstreamIndexId === stored.sceneIndexId);

        if (!sceneIndex) {
          return { success: false, message: 'Scene index not found' };
        }

        await sceneIndex.stop();

        logger.info({ sessionId, sceneIndexId: stored.sceneIndexId }, '[VisualIndex] Visual indexing paused');

        return { success: true, message: 'Visual indexing paused' };
      } catch (error) {
        logger.error({ error }, '[VisualIndex] Failed to pause visual indexing');
        return { success: false, message: 'Failed to pause visual indexing' };
      }
    }),

  /**
   * Resume visual indexing for a session.
   */
  resume: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sessionId } = input;

      logger.info({ sessionId }, '[VisualIndex] Resuming visual indexing');

      const stored = activeSceneIndexes.get(sessionId);
      if (!stored) {
        return { success: false, message: 'No active scene index found' };
      }

      const apiKey = ctx.user?.apiKey || stored.apiKey;
      const apiUrl = stored.apiUrl;

      try {
        const connectOptions: { apiKey: string; baseUrl?: string } = { apiKey };
        if (apiUrl) connectOptions.baseUrl = apiUrl;
        const conn = connect(connectOptions);

        const session = await conn.getCaptureSession(sessionId);
        await session.refresh();

        const screens = (session.rtstreams || []).filter(s => s.id === stored.rtstreamId);
        if (screens.length === 0) {
          return { success: false, message: 'Screen RTStream not found' };
        }

        const sceneIndexes = await screens[0].listSceneIndexes();
        const sceneIndex = sceneIndexes.find(si => si.rtstreamIndexId === stored.sceneIndexId);

        if (!sceneIndex) {
          return { success: false, message: 'Scene index not found' };
        }

        await sceneIndex.start();

        logger.info({ sessionId, sceneIndexId: stored.sceneIndexId }, '[VisualIndex] Visual indexing resumed');

        return { success: true, message: 'Visual indexing resumed' };
      } catch (error) {
        logger.error({ error }, '[VisualIndex] Failed to resume visual indexing');
        return { success: false, message: 'Failed to resume visual indexing' };
      }
    }),

  /**
   * Clear stored scene index when session ends.
   */
  clear: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .output(z.object({
      success: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      activeSceneIndexes.delete(input.sessionId);
      return { success: true };
    }),
});
