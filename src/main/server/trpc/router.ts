import { router } from './trpc';
import { authRouter } from './procedures/auth';
import { configRouter, tunnelRouter } from './procedures/config';
import { tokenRouter } from './procedures/token';
import { captureRouter } from './procedures/capture';
import { recordingsRouter } from './procedures/recordings';
import { transcriptionRouter } from './procedures/transcription';
import { settingsRouter } from './procedures/settings';

export const appRouter = router({
  auth: authRouter,
  config: configRouter,
  tunnel: tunnelRouter,
  token: tokenRouter,
  capture: captureRouter,
  recordings: recordingsRouter,
  transcription: transcriptionRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;

// Re-export for convenience
export { router, publicProcedure, protectedProcedure } from './trpc';
