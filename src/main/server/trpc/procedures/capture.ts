import { router, protectedProcedure } from '../trpc';
import {
  CreateCaptureSessionInputSchema,
  CaptureSessionSchema,
} from '../../../../shared/schemas/capture.schema';
import { createVideoDBService } from '../../../services/videodb.service';
import { loadRuntimeConfig } from '../../../lib/config';
import { createChildLogger } from '../../../lib/logger';

const logger = createChildLogger('capture-procedure');

export const captureRouter = router({
  createSession: protectedProcedure
    .input(CreateCaptureSessionInputSchema)
    .output(CaptureSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const runtimeConfig = loadRuntimeConfig();

      logger.info({ userId: user.id }, '[Capture] Creating capture session');

      const videodbService = createVideoDBService(user.apiKey, runtimeConfig.apiUrl);

      const session = await videodbService.createCaptureSession({
        endUserId: `user-${user.id}`,
        metadata: input.metadata,
      });

      logger.info(
        { sessionId: session.sessionId },
        'Capture session created'
      );

      return session;
    }),
});
