import { z } from 'zod';

export const WebhookEventTypeSchema = z.enum([
  'capture_session.exported',
  'capture_session.active',
  'transcript.partial',
  'transcript.final',
]);

export const CaptureSessionExportedDataSchema = z.object({
  video_id: z.string(),
  stream_url: z.string().optional(),
  player_url: z.string().optional(),
  duration: z.number().optional(),
});

export const CaptureSessionActiveDataSchema = z.object({
  rt_streams: z.array(z.object({
    stream_id: z.string(),
    type: z.string(),
  })).optional(),
});

export const TranscriptDataSchema = z.object({
  text: z.string(),
  is_final: z.boolean().optional(),
  source: z.string().optional(),
  channel: z.string().optional(),
});

export const WebhookPayloadSchema = z.object({
  event: z.string(),
  capture_session_id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;
export type CaptureSessionExportedData = z.infer<typeof CaptureSessionExportedDataSchema>;
export type CaptureSessionActiveData = z.infer<typeof CaptureSessionActiveDataSchema>;
export type TranscriptData = z.infer<typeof TranscriptDataSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
