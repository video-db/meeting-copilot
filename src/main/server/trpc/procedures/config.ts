import { router, protectedProcedure } from '../trpc';
import { ServerConfigOutputSchema } from '../../../../shared/schemas/config.schema';
import { loadRuntimeConfig } from '../../../lib/config';

export const configRouter = router({
  get: protectedProcedure
    .output(ServerConfigOutputSchema)
    .query(async () => {
      const runtimeConfig = loadRuntimeConfig();

      return {
        apiPort: runtimeConfig.apiPort,
        backendBaseUrl: runtimeConfig.apiUrl,
      };
    }),
});
