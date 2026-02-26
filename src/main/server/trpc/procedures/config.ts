import { router, protectedProcedure } from '../trpc';
import { ServerConfigOutputSchema, TunnelStatusSchema } from '../../../../shared/schemas/config.schema';
import { loadRuntimeConfig } from '../../../lib/config';
import { getTunnelUrl, getTunnelStatus } from '../../../services/tunnel.service';

export const configRouter = router({
  get: protectedProcedure
    .output(ServerConfigOutputSchema)
    .query(async () => {
      const runtimeConfig = loadRuntimeConfig();
      const tunnelUrl = getTunnelUrl();

      return {
        webhookUrl: tunnelUrl
          ? `${tunnelUrl}/api/webhook`
          : `http://localhost:${runtimeConfig.apiPort}/api/webhook`,
        apiPort: runtimeConfig.apiPort,
        backendBaseUrl: runtimeConfig.apiUrl,
      };
    }),
});

export const tunnelRouter = router({
  status: protectedProcedure
    .output(TunnelStatusSchema)
    .query(async () => {
      return getTunnelStatus();
    }),
});
