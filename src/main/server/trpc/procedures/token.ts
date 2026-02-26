import { router, protectedProcedure } from '../trpc';
import { GenerateTokenInputSchema, SessionTokenSchema } from '../../../../shared/schemas/auth.schema';
import { createVideoDBService } from '../../../services/videodb.service';
import { loadRuntimeConfig } from '../../../lib/config';
import { createChildLogger } from '../../../lib/logger';

const logger = createChildLogger('token-procedure');

export const tokenRouter = router({
  generate: protectedProcedure
    .input(GenerateTokenInputSchema)
    .output(SessionTokenSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const userId = input.userId || `user-${user.id}`;

      logger.info({ userId }, 'Generating session token');

      const runtimeConfig = loadRuntimeConfig();
      const videodbService = createVideoDBService(user.apiKey, runtimeConfig.apiUrl);

      const token = await videodbService.createSessionToken(userId);

      logger.info({ userId, expiresAt: token.expiresAt }, 'Session token generated');

      return token;
    }),
});
