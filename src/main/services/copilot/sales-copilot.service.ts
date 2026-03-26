/**
 * Meeting Co-Pilot Agent Orchestrator
 *
 * Central coordinator that receives transcript segments, manages context,
 * and triggers agent processing pipelines. Emits events for UI updates.
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import { initLLMService } from '../llm.service';
import {
  updateRecording,
  getRecordingById,
  createCallMetricsSnapshot,
  createNudge,
  getTranscriptSegmentsByRecording,
} from '../../db';

import {
  TranscriptBufferService,
  getTranscriptBuffer,
  type RawTranscriptData,
  type TranscriptSegmentData,
} from './transcript-buffer.service';

import {
  ContextManagerService,
  getContextManager,
} from './context-manager.service';

import {
  ConversationMetricsService,
  getMetricsService,
  type ConversationMetrics,
} from './conversation-metrics.service';

import {
  NudgeEngineService,
  getNudgeEngine,
  type Nudge,
} from './nudge-engine.service';

import {
  SummaryGeneratorService,
  getSummaryGenerator,
  type PostMeetingSummary,
} from './summary-generator.service';

import { exportMeetingToMarkdown } from '../markdown-export.service';


const log = logger.child({ module: 'call-md' });

// Types

export interface CopilotConfig {
  enableTranscription: boolean;
  enableMetrics: boolean;
  enableNudges: boolean;
  metricsUpdateInterval: number; // ms
  compressionInterval: number; // ms
}

export interface CopilotEvents {
  'call-started': { recordingId: number; sessionId: string };
  'transcript-segment': TranscriptSegmentData;
  'metrics-update': { metrics: ConversationMetrics; health: number };
  'nudge': { nudge: Nudge };
  'call-ended': {
    summary: PostMeetingSummary;
    metrics: ConversationMetrics;
    duration: number;
  };
  'error': { error: string; context?: string };
}

export interface CallState {
  recordingId: number;
  sessionId: string;
  startTime: number;
  isActive: boolean;
}

// Meeting Co-Pilot Service

export class MeetingCopilotService extends EventEmitter {
  private transcriptBuffer: TranscriptBufferService;
  private contextManager: ContextManagerService;
  private metricsService: ConversationMetricsService;
  private nudgeEngine: NudgeEngineService;
  private summaryGenerator: SummaryGeneratorService;

  private config: CopilotConfig;
  private callState: CallState | null = null;
  private apiKey: string | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private compressionTimer: NodeJS.Timeout | null = null;
  private processingQueue: TranscriptSegmentData[] = [];
  private isProcessing: boolean = false;

  private readonly DEFAULT_CONFIG: CopilotConfig = {
    enableTranscription: true,
    enableMetrics: true,
    enableNudges: true,
    metricsUpdateInterval: 10000, // 10 seconds
    compressionInterval: 300000, // 5 minutes
  };

  constructor(config?: Partial<CopilotConfig>) {
    super();
    this.config = { ...this.DEFAULT_CONFIG, ...config };

    // Initialize services
    this.transcriptBuffer = getTranscriptBuffer();
    this.contextManager = getContextManager();
    this.metricsService = getMetricsService();
    this.nudgeEngine = getNudgeEngine();
    this.summaryGenerator = getSummaryGenerator();

    // Listen for transcript segments ready for processing
    this.transcriptBuffer.on('segment-ready', this.onSegmentReady.bind(this));
  }

  /**
   * Initialize with API key
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey;
    initLLMService(apiKey);
    log.info('Meeting Co-Pilot initialized with API key');
  }

  /**
   * Start tracking a call
   */
  async startCall(recordingId: number, sessionId: string): Promise<void> {
    if (this.callState?.isActive) {
      log.warn('Call already in progress, ending previous call');
      await this.endCall();
    }

    this.callState = {
      recordingId,
      sessionId,
      startTime: Date.now(),
      isActive: true,
    };

    // Initialize services
    this.transcriptBuffer.startCall(sessionId, recordingId);
    this.nudgeEngine.reset();
    this.metricsService.clear(sessionId);

    // Start periodic metrics updates
    if (this.config.enableMetrics) {
      this.startMetricsTimer();
    }

    // Start context compression timer
    this.startCompressionTimer();

    this.emit('call-started', { recordingId, sessionId });
    log.info({ recordingId, sessionId }, 'Call tracking started');
  }

  /**
   * Process incoming transcript from WebSocket
   */
  async onTranscriptReceived(
    channel: 'me' | 'them',
    data: RawTranscriptData
  ): Promise<void> {
    if (!this.callState?.isActive) {
      log.warn('Received transcript but no active call');
      return;
    }

    // Add to buffer
    const segment = await this.transcriptBuffer.addRawSegment(
      this.callState.sessionId,
      this.callState.recordingId,
      channel,
      data
    );

    if (segment) {
      this.emit('transcript-segment', segment);
    }
  }

  /**
   * Handle segment ready for agent processing
   */
  private async onSegmentReady(segment: TranscriptSegmentData): Promise<void> {
    if (!this.callState?.isActive) return;

    // Add to processing queue
    this.processingQueue.push(segment);

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Process the segment queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const segment = this.processingQueue.shift()!;

      try {
        await this.processSegment(segment);
      } catch (error) {
        log.error({ error, segmentId: segment.id }, 'Error processing segment');
        this.emit('error', { error: 'Segment processing failed', context: segment.id });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single segment through all pipelines
   */
  private async processSegment(segment: TranscriptSegmentData): Promise<void> {
    if (!this.callState) return;

    // Mark segment as processed
    this.transcriptBuffer.markProcessed(segment.id, this.callState.sessionId);
  }

  /**
   * Start periodic metrics updates
   */
  private startMetricsTimer(): void {
    if (this.metricsTimer) return;

    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.metricsUpdateInterval);
  }

  /**
   * Update metrics and check for nudges
   */
  private async updateMetrics(): Promise<void> {
    if (!this.callState?.isActive) return;

    const segments = this.transcriptBuffer.getFinalSegments(this.callState.sessionId);
    const callDuration = (Date.now() - this.callState.startTime) / 1000;
    const metrics = this.metricsService.calculate(segments, callDuration);
    const health = this.metricsService.getConversationHealthScore(metrics);

    // Emit metrics update
    this.emit('metrics-update', { metrics, health });

    // Check for nudges
    if (this.config.enableNudges) {
      const nudge = this.nudgeEngine.evaluate(
        metrics,
        callDuration
      );

      if (nudge) {
        // Save nudge to database
        try {
          createNudge({
            id: nudge.id,
            recordingId: this.callState.recordingId,
            type: nudge.type,
            message: nudge.message,
            severity: nudge.severity,
            timestamp: callDuration,
          });
        } catch (error) {
          log.error({ error }, 'Failed to save nudge');
        }

        this.emit('nudge', { nudge });
      }
    }

    // Save metrics snapshot periodically (every minute)
    if (Math.floor(callDuration) % 60 < 10) {
      try {
        createCallMetricsSnapshot({
          id: uuid(),
          recordingId: this.callState.recordingId,
          timestamp: callDuration,
          talkRatioMe: metrics.talkRatio.me,
          talkRatioThem: metrics.talkRatio.them,
          paceWpm: metrics.pace,
          questionsAsked: metrics.questionsAsked,
          monologueDetected: metrics.monologueDetected,
        });
      } catch (error) {
        log.error({ error }, 'Failed to save metrics snapshot');
      }
    }
  }

  /**
   * Start context compression timer
   */
  private startCompressionTimer(): void {
    if (this.compressionTimer) return;

    this.compressionTimer = setInterval(async () => {
      await this.compressContext();
    }, this.config.compressionInterval);
  }

  /**
   * Compress older context
   */
  private async compressContext(): Promise<void> {
    if (!this.callState?.isActive) return;

    const segments = this.transcriptBuffer.getFinalSegments(this.callState.sessionId);

    // Compress segments older than 5 minutes
    const cutoffTime = (Date.now() - this.callState.startTime) / 1000 - 300;
    const oldSegments = segments.filter(s => s.endTime < cutoffTime);

    if (oldSegments.length > 20) {
      await this.contextManager.compressSegments(this.callState.sessionId, oldSegments);
    }
  }

  /**
   * End call and generate summary
   */
  async endCall(): Promise<PostMeetingSummary | null> {
    if (!this.callState) {
      log.warn('No active call to end');
      return null;
    }

    const { recordingId, sessionId, startTime } = this.callState;
    const duration = (Date.now() - startTime) / 1000;

    log.info({ recordingId, sessionId, duration }, 'Ending call');

    // Stop timers
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.compressionTimer) {
      clearInterval(this.compressionTimer);
      this.compressionTimer = null;
    }

    // Mark call as inactive
    this.callState.isActive = false;

    // Get final segments for metrics calculation
    const segments = this.transcriptBuffer.getFinalSegments(sessionId);

    // Calculate final metrics
    const metrics = this.metricsService.calculate(segments, duration);

    // Fetch meeting context from recording
    const recording = getRecordingById(recordingId);
    const meetingContext = {
      meetingName: (recording as any)?.meetingName || undefined,
      meetingDescription: (recording as any)?.meetingDescription || undefined,
      probingQuestions: (recording as any)?.probingQuestions
        ? JSON.parse((recording as any).probingQuestions)
        : undefined,
      checklist: (recording as any)?.meetingChecklist
        ? JSON.parse((recording as any).meetingChecklist)
        : undefined,
    };

    // Generate summaries (fetches full transcript from DB)
    let summary: PostMeetingSummary;
    try {
      log.info({ recordingId, segmentCount: segments.length }, 'Starting summary generation');
      const summaryStartTime = Date.now();
      summary = await this.summaryGenerator.generate(recordingId, meetingContext);
      const summaryElapsed = Date.now() - summaryStartTime;
      log.info({
        recordingId,
        elapsedMs: summaryElapsed,
        overviewLength: summary.shortOverview.length,
        keyPointsCount: summary.keyPoints.length,
      }, 'Summary generation completed');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error({ err: error, errorMessage: errMsg, recordingId }, 'Failed to generate summary');
      summary = {
        shortOverview: `Summary generation failed: ${errMsg}`,
        keyPoints: [],
        postMeetingChecklist: [],
        generatedAt: Date.now(),
      };
    }

    // Save to database
    try {
      log.info({ recordingId, hasOverview: summary.shortOverview.length > 0 }, 'Saving call data to database');
      updateRecording(recordingId, {
        shortOverview: summary.shortOverview,
        keyPoints: JSON.stringify(summary.keyPoints),
        postMeetingChecklist: JSON.stringify(summary.postMeetingChecklist),
        metricsSnapshot: JSON.stringify(metrics),
        duration: Math.round(duration),
      });
      log.info({ recordingId }, 'Call data saved to database');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error({ err: error, errorMessage: errMsg, recordingId }, 'Failed to save call data');
    }

    this.exportToMarkdown(recordingId, summary, metrics, duration, segments, meetingContext).catch((err) => {
      log.error({ err }, 'Failed to export meeting to markdown');
    });

    // Emit end event
    log.info({ recordingId, hasOverview: summary.shortOverview.length > 0 }, 'Emitting call-ended event');
    this.emit('call-ended', {
      summary,
      metrics,
      duration,
    });


    // Cleanup
    this.transcriptBuffer.clear(sessionId);
    this.contextManager.clear(sessionId);
    this.callState = null;

    return summary;
  }

  /**
   * Export meeting to markdown files in ~/.call_md/
   */
  private async exportToMarkdown(
    recordingId: number,
    summary: PostMeetingSummary,
    metrics: ConversationMetrics,
    duration: number,
    _segments: TranscriptSegmentData[],
    meetingContext: { meetingName?: string; meetingDescription?: string }
  ): Promise<void> {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      log.warn({ recordingId }, 'Recording not found for markdown export');
      return;
    }

    // Fetch FULL transcript from database (not limited in-memory buffer)
    const dbSegments = getTranscriptSegmentsByRecording(recordingId);
    const transcript = dbSegments.map((seg) => ({
      speaker: seg.channel as 'me' | 'them',
      text: seg.text,
      startTime: seg.startTime,
    }));

    log.info({ recordingId, segmentCount: dbSegments.length }, 'Fetched full transcript from DB for export');

    const filePath = await exportMeetingToMarkdown({
      recordingId,
      meetingName: meetingContext.meetingName || 'Untitled Meeting',
      meetingDescription: meetingContext.meetingDescription,
      startedAt: new Date(recording.createdAt),
      duration: Math.round(duration),
      summary,
      metrics,
      transcript,
      sessionId: this.callState?.sessionId,
      apiKey: this.apiKey || undefined,
    });

    log.info({ recordingId, filePath }, 'Meeting exported to markdown');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CopilotConfig>): void {
    this.config = { ...this.config, ...config };

    // Update nudge engine
    this.nudgeEngine.setEnabled(this.config.enableNudges);
  }

  /**
   * Get current call state
   */
  getCallState(): CallState | null {
    return this.callState;
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    return this.callState?.isActive ?? false;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): ConversationMetrics | null {
    if (!this.callState?.isActive) return null;

    const segments = this.transcriptBuffer.getFinalSegments(this.callState.sessionId);
    const callDuration = (Date.now() - this.callState.startTime) / 1000;
    return this.metricsService.calculate(segments, callDuration);
  }

  /**
   * Dismiss a nudge
   */
  dismissNudge(nudgeId: string): void {
    // Nudges are already tracked in history, nothing to update
    log.info({ nudgeId }, 'Nudge dismissed');
  }
}

// Singleton Instance

let instance: MeetingCopilotService | null = null;

export function getMeetingCopilot(config?: Partial<CopilotConfig>): MeetingCopilotService {
  if (!instance) {
    instance = new MeetingCopilotService(config);
  }
  return instance;
}

export function resetMeetingCopilot(): void {
  instance = null;
}

export { MeetingCopilotService as SalesCopilotService };
export { getMeetingCopilot as getSalesCopilot };
export { resetMeetingCopilot as resetSalesCopilot };

export default MeetingCopilotService;
