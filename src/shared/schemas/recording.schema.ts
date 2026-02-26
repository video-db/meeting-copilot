import { z } from 'zod';

export const RecordingStatusSchema = z.enum(['recording', 'processing', 'available', 'failed']);
export const InsightsStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

// Copilot data schemas
export const CallSummarySchema = z.object({
  bullets: z.array(z.string()).optional(),
  customerPain: z.array(z.string()).optional(),
  customerGoals: z.array(z.string()).optional(),
  objections: z.array(z.object({
    type: z.string(),
    text: z.string(),
    response: z.string().optional(),
    resolved: z.boolean().optional(),
  })).optional(),
  commitments: z.array(z.object({
    who: z.enum(['me', 'them']),
    commitment: z.string(),
  })).optional(),
  nextSteps: z.array(z.object({
    action: z.string(),
    owner: z.enum(['me', 'them', 'both']),
    priority: z.enum(['high', 'medium', 'low']),
    deadline: z.string().optional(),
  })).optional(),
  keyDecisions: z.array(z.string()).optional(),
  riskFlags: z.array(z.string()).optional(),
  generatedAt: z.number().optional(),
}).nullable();

export const PlaybookSnapshotSchema = z.object({
  playbookId: z.string(),
  playbookName: z.string(),
  total: z.number(),
  covered: z.number(),
  partial: z.number(),
  missing: z.number(),
  coveragePercentage: z.number(),
  items: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(['covered', 'partial', 'missing']),
    evidence: z.string().optional(),
  })).optional(),
  recommendations: z.array(z.string()).optional(),
}).nullable();

export const MetricsSnapshotSchema = z.object({
  talkRatio: z.object({
    me: z.number(),
    them: z.number(),
  }),
  pace: z.number(),
  questionsAsked: z.number(),
  monologueDetected: z.boolean(),
  longestMonologue: z.number(),
  totalDuration: z.number(),
  callDuration: z.number(),
  wordCount: z.object({
    me: z.number(),
    them: z.number(),
  }),
  segmentCount: z.object({
    me: z.number(),
    them: z.number(),
  }),
  averageSegmentLength: z.object({
    me: z.number(),
    them: z.number(),
  }),
  interruptionCount: z.number(),
}).nullable();

export const RecordingSchema = z.object({
  id: z.number(),
  videoId: z.string().nullable(),
  streamUrl: z.string().nullable(),
  playerUrl: z.string().nullable(),
  sessionId: z.string(),
  duration: z.number().nullable(),
  createdAt: z.string(),
  status: RecordingStatusSchema,
  insights: z.string().nullable(),
  insightsStatus: InsightsStatusSchema,
  // Copilot data
  callSummary: CallSummarySchema.optional(),
  playbookSnapshot: PlaybookSnapshotSchema.optional(),
  metricsSnapshot: MetricsSnapshotSchema.optional(),
});

export const CreateRecordingInputSchema = z.object({
  sessionId: z.string(),
});

export const StopRecordingInputSchema = z.object({
  sessionId: z.string(),
});

export const GetRecordingInputSchema = z.object({
  recordingId: z.number(),
});

export type RecordingStatus = z.infer<typeof RecordingStatusSchema>;
export type InsightsStatus = z.infer<typeof InsightsStatusSchema>;
export type Recording = z.infer<typeof RecordingSchema>;
export type CallSummary = z.infer<typeof CallSummarySchema>;
export type PlaybookSnapshot = z.infer<typeof PlaybookSnapshotSchema>;
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;
export type CreateRecordingInput = z.infer<typeof CreateRecordingInputSchema>;
export type StopRecordingInput = z.infer<typeof StopRecordingInputSchema>;
export type GetRecordingInput = z.infer<typeof GetRecordingInputSchema>;
