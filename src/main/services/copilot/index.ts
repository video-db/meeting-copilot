/**
 * Meeting Co-Pilot Services
 *
 * Export all copilot services for use in IPC handlers.
 */

// Main orchestrator
export {
  MeetingCopilotService,
  getMeetingCopilot,
  resetMeetingCopilot,
  SalesCopilotService,
  getSalesCopilot,
  resetSalesCopilot,
  type CopilotConfig,
  type CopilotEvents,
  type CallState,
} from './sales-copilot.service';

// Transcript management
export {
  TranscriptBufferService,
  getTranscriptBuffer,
  resetTranscriptBuffer,
  type RawTranscriptData,
  type TranscriptSegmentData,
} from './transcript-buffer.service';

// Context compression
export {
  ContextManagerService,
  getContextManager,
  resetContextManager,
  type CompressedChunk,
} from './context-manager.service';

// Conversation metrics
export {
  ConversationMetricsService,
  getMetricsService,
  resetMetricsService,
  type ConversationMetrics,
  type MetricsTrend,
} from './conversation-metrics.service';

// Sentiment analysis
export {
  SentimentAnalyzerService,
  getSentimentAnalyzer,
  resetSentimentAnalyzer,
  type Sentiment,
  type SentimentResult,
  type SentimentTrend,
} from './sentiment-analyzer.service';

// Nudge engine
export {
  NudgeEngineService,
  getNudgeEngine,
  resetNudgeEngine,
  type Nudge,
  type NudgeType,
  type NudgeSeverity,
  type NudgeConfig,
} from './nudge-engine.service';

// Cue card engine
export {
  CueCardEngineService,
  getCueCardEngine,
  resetCueCardEngine,
  type ObjectionType,
  type CueCardContent,
  type CueCardTriggerData,
  type ObjectionDetectionResult,
} from './cue-card-engine.service';

// Playbook tracker
export {
  PlaybookTrackerService,
  getPlaybookTracker,
  resetPlaybookTracker,
  type Playbook,
  type PlaybookItem,
  type PlaybookItemStatus,
  type PlaybookItemEvidence,
  type PlaybookSnapshot,
} from './playbook-tracker.service';

// Summary generator
export {
  SummaryGeneratorService,
  getSummaryGenerator,
  resetSummaryGenerator,
  type CallSummary,
  type ActionItem,
  type Objection,
  type Commitment,
  type Evidence,
  type FullCallReport,
} from './summary-generator.service';
