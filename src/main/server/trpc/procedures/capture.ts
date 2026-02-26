import { router, protectedProcedure } from '../trpc';
import {
  CreateCaptureSessionInputSchema,
  CaptureSessionSchema,
} from '../../../../shared/schemas/capture.schema';
import { createVideoDBService } from '../../../services/videodb.service';
import { loadRuntimeConfig } from '../../../lib/config';
import { getTunnelUrl } from '../../../services/tunnel.service';
import { createChildLogger } from '../../../lib/logger';

const logger = createChildLogger('capture-procedure');

export const captureRouter = router({
  createSession: protectedProcedure
    .input(CreateCaptureSessionInputSchema)
    .output(CaptureSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const runtimeConfig = loadRuntimeConfig();
      const tunnelUrl = getTunnelUrl();

      logger.info({
        tunnelUrl,
        runtimeConfigApiPort: runtimeConfig.apiPort,
        hasTunnel: !!tunnelUrl,
      }, '[Capture] Checking tunnel status');

      // Use tunnel URL for webhook if available, otherwise use localhost
      const webhookUrl = tunnelUrl
        ? `${tunnelUrl}/api/webhook`
        : `http://localhost:${runtimeConfig.apiPort}/api/webhook`;

      if (!tunnelUrl) {
        logger.warn('⚠️ No tunnel URL available - using localhost. Webhooks from VideoDB will NOT work!')
      }

      const callbackUrl = input.callbackUrl || webhookUrl;

      logger.info({
        userId: user.id,
        callbackUrl,
        webhookUrl,
        inputCallbackUrl: input.callbackUrl,
      }, '[Capture] Creating capture session with callback URL');

      const videodbService = createVideoDBService(user.apiKey, runtimeConfig.apiUrl);

      const session = await videodbService.createCaptureSession({
        endUserId: `user-${user.id}`,
        callbackUrl,
        metadata: input.metadata,
      });

      logger.info(
        { sessionId: session.sessionId },
        'Capture session created'
      );

      return session;
    }),
});
