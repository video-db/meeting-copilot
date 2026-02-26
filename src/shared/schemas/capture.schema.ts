import { z } from 'zod';

export const CreateCaptureSessionInputSchema = z.object({
  callbackUrl: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  wsConnectionId: z.string().optional(),
});

export const CaptureSessionSchema = z.object({
  sessionId: z.string(),
  collectionId: z.string(),
  endUserId: z.string(),
  status: z.string(),
  callbackUrl: z.string(),
});

export const StartTranscriptionInputSchema = z.object({
  sessionId: z.string(),
  micWsConnectionId: z.string().optional(),
  sysAudioWsConnectionId: z.string().optional(),
});

export const StartTranscriptionOutputSchema = z.object({
  status: z.string(),
  sessionId: z.string(),
  message: z.string(),
});

export const ChannelSchema = z.object({
  channelId: z.string(),
  type: z.enum(['audio', 'video']),
  name: z.string().optional(),
});

export const CaptureConfigSchema = z.object({
  sessionId: z.string(),
  channels: z.array(z.object({
    channelId: z.string(),
    type: z.enum(['audio', 'video']),
    record: z.boolean(),
    transcript: z.boolean().optional(),
  })).optional(),
  streams: z.object({
    microphone: z.boolean().optional(),
    systemAudio: z.boolean().optional(),
    screen: z.boolean().optional(),
  }).optional(),
});

export type CreateCaptureSessionInput = z.infer<typeof CreateCaptureSessionInputSchema>;
export type CaptureSession = z.infer<typeof CaptureSessionSchema>;
export type StartTranscriptionInput = z.infer<typeof StartTranscriptionInputSchema>;
export type StartTranscriptionOutput = z.infer<typeof StartTranscriptionOutputSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type CaptureConfig = z.infer<typeof CaptureConfigSchema>;
