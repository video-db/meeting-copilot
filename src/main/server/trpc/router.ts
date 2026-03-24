import { router } from './trpc';
import { authRouter } from './procedures/auth';
import { configRouter } from './procedures/config';
import { tokenRouter } from './procedures/token';
import { captureRouter } from './procedures/capture';
import { recordingsRouter } from './procedures/recordings';
import { transcriptionRouter } from './procedures/transcription';
import { visualIndexRouter } from './procedures/visual-index';
import { settingsRouter } from './procedures/settings';
import { meetingSetupRouter } from './procedures/meeting-setup';

export const appRouter = router({
  auth: authRouter,
  config: configRouter,
  token: tokenRouter,
  capture: captureRouter,
  recordings: recordingsRouter,
  transcription: transcriptionRouter,
  visualIndex: visualIndexRouter,
  settings: settingsRouter,
  meetingSetup: meetingSetupRouter,
});

export type AppRouter = typeof appRouter;

// Re-export for convenience
export { router, publicProcedure, protectedProcedure } from './trpc';
