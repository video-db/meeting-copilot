import { createVideoDBService } from './videodb.service';
import { updateRecording, getRecordingById } from '../db';
import { createChildLogger } from '../lib/logger';

const logger = createChildLogger('insights-service');

export interface InsightsResult {
  success: boolean;
  insights?: string;
  error?: string;
}

export class InsightsService {
  private apiKey: string;
  private baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async processRecording(
    recordingId: number,
    videoId: string
  ): Promise<InsightsResult> {
    const videodbService = createVideoDBService(this.apiKey, this.baseUrl);

    try {
      // Mark as processing
      updateRecording(recordingId, { insightsStatus: 'processing' });
      logger.info({ recordingId, videoId }, 'Starting insights processing');

      // Index the video for spoken words (like Python version)
      logger.info({ videoId }, 'Indexing video for spoken words');
      const indexSuccess = await this.safeIndexVideo(videodbService, videoId);

      if (!indexSuccess) {
        updateRecording(recordingId, { insightsStatus: 'failed' });
        logger.warn({ recordingId, videoId }, 'Failed to index video');
        return {
          success: false,
          error: 'Failed to index video',
        };
      }

      logger.info({ videoId }, 'Video indexed successfully');

      // Generate insights (videodb.service now handles transcript fetching and prompt construction)
      logger.info({ recordingId, videoId }, 'Starting insight generation');
      const insights = await videodbService.generateInsights(videoId);

      if (insights && insights.length > 0) {
        // Update recording with insights
        updateRecording(recordingId, {
          insights,
          insightsStatus: 'ready',
        });
        logger.info({ recordingId, videoId }, 'Generated insights successfully');
      } else {
        // No insights (likely no transcript), but indexing succeeded
        updateRecording(recordingId, { insightsStatus: 'ready' });
        logger.info({ recordingId, videoId }, 'Video indexed but no insights generated (no transcript or empty)');
      }

      logger.info({ recordingId, videoId }, 'Insights processing completed');

      return {
        success: true,
        insights: insights || undefined,
      };
    } catch (error) {
      logger.error({ error, recordingId, videoId }, 'Insights processing failed');

      updateRecording(recordingId, { insightsStatus: 'failed' });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async safeIndexVideo(videodbService: ReturnType<typeof createVideoDBService>, videoId: string): Promise<boolean> {
    try {
      await videodbService.indexVideo(videoId);
      return true;
    } catch (error) {
      logger.error({ error, videoId }, 'Failed to index video');
      return false;
    }
  }

  async retryProcessing(recordingId: number): Promise<InsightsResult> {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found',
      };
    }

    if (!recording.videoId) {
      return {
        success: false,
        error: 'Recording has no video ID',
      };
    }

    return this.processRecording(recordingId, recording.videoId);
  }
}

export function createInsightsService(apiKey: string, baseUrl?: string): InsightsService {
  return new InsightsService(apiKey, baseUrl);
}
