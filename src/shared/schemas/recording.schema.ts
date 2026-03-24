import { z } from 'zod';

export const RecordingStatusSchema = z.enum(['recording', 'processing', 'available', 'failed']);
export const InsightsStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

// Key Points schema for structured meeting breakdown
export const KeyPointSchema = z.object({
  topic: z.string(),
  points: z.array(z.string()),
});

export const KeyPointsSchema = z.array(KeyPointSchema).nullable();

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

// Meeting Setup schemas
export const ProbingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  customAnswer: z.string().optional(),
});

export const MeetingSetupSchema = z.object({
  name: z.string(),
  description: z.string(),
  questions: z.array(ProbingQuestionSchema),
  checklist: z.array(z.string()),
}).nullable();

export const RecordingSchema = z.object({
  id: z.number(),
  videoId: z.string().nullable(),
  collectionId: z.string().nullable(),
  streamUrl: z.string().nullable(),
  playerUrl: z.string().nullable(),
  sessionId: z.string(),
  duration: z.number().nullable(),
  createdAt: z.string(),
  status: RecordingStatusSchema,
  insights: z.string().nullable(),
  insightsStatus: InsightsStatusSchema,
  // Copilot data
  shortOverview: z.string().nullable().optional(),
  keyPoints: KeyPointsSchema.optional(),
  playbookSnapshot: PlaybookSnapshotSchema.optional(),
  metricsSnapshot: MetricsSnapshotSchema.optional(),
  // Meeting Setup data
  meetingName: z.string().nullable().optional(),
  meetingDescription: z.string().nullable().optional(),
  probingQuestions: z.array(ProbingQuestionSchema).nullable().optional(),
  meetingChecklist: z.array(z.string()).nullable().optional(),
  // Post-meeting analysis
  postMeetingChecklist: z.array(z.string()).nullable().optional(),
});

export const CreateRecordingInputSchema = z.object({
  sessionId: z.string(),
  // Meeting Setup data
  meetingName: z.string().optional(),
  meetingDescription: z.string().optional(),
  probingQuestions: z.array(ProbingQuestionSchema).optional(),
  meetingChecklist: z.array(z.string()).optional(),
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
export type KeyPoint = z.infer<typeof KeyPointSchema>;
export type KeyPoints = z.infer<typeof KeyPointsSchema>;
export type PlaybookSnapshot = z.infer<typeof PlaybookSnapshotSchema>;
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;
export type ProbingQuestion = z.infer<typeof ProbingQuestionSchema>;
export type MeetingSetup = z.infer<typeof MeetingSetupSchema>;
export type CreateRecordingInput = z.infer<typeof CreateRecordingInputSchema>;
export type StopRecordingInput = z.infer<typeof StopRecordingInputSchema>;
export type GetRecordingInput = z.infer<typeof GetRecordingInputSchema>;
