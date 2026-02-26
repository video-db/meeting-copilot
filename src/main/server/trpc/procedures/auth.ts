import { TRPCError } from '@trpc/server';
import { v4 as uuidv4 } from 'uuid';
import { router, publicProcedure } from '../trpc';
import { RegisterInputSchema, RegisterOutputSchema } from '../../../../shared/schemas/auth.schema';
import { createUser, getUserByAccessToken } from '../../../db';
import { createVideoDBService } from '../../../services/videodb.service';
import { createChildLogger } from '../../../lib/logger';
import { loadRuntimeConfig } from '../../../lib/config';

const logger = createChildLogger('auth-procedure');

export const authRouter = router({
  register: publicProcedure
    .input(RegisterInputSchema)
    .output(RegisterOutputSchema)
    .mutation(async ({ input }) => {
      const { name, apiKey } = input;

      logger.info({ name }, 'Registration attempt');

      // Verify API key with VideoDB
      const runtimeConfig = loadRuntimeConfig();
      const videodbService = createVideoDBService(apiKey, runtimeConfig.apiUrl);

      const isValid = await videodbService.verifyApiKey();

      if (!isValid) {
        logger.warn({ name }, 'Registration failed: Invalid API key');
        return {
          success: false,
          error: 'Invalid API key',
        };
      }

      // Generate access token
      const accessToken = uuidv4();

      // Check if user with this token already exists (shouldn't happen with UUID)
      const existingUser = getUserByAccessToken(accessToken);
      if (existingUser) {
        logger.error({ name }, 'Token collision detected');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Token generation failed, please try again',
        });
      }

      // Create user
      try {
        const user = createUser({
          name,
          apiKey,
          accessToken,
        });

        logger.info({ userId: user.id, name }, 'User registered successfully');

        return {
          success: true,
          accessToken: user.accessToken,
          name: user.name,
        };
      } catch (error) {
        logger.error({ error, name }, 'Failed to create user');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create user',
        });
      }
    }),
});
