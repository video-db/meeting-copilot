/**
 * Transcript Buffer Service
 *
 * Maintains a rolling window of recent transcript segments for real-time
 * agent processing while persisting full history to database.
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import {
  createTranscriptSegment,
  getRecentTranscriptSegments,
} from '../../db';
import type { TranscriptSegment, NewTranscriptSegment } from '../../db/schema';

const log = logger.child({ module: 'transcript-buffer' });

export interface RawTranscriptData {
  text: string;
  is_final: boolean;
  start: number; // epoch seconds
  end: number; // epoch seconds
}

export interface TranscriptSegmentData {
  id: string;
  recordingId: number;
  sessionId: string;
  channel: 'me' | 'them';
  text: string;
  startTime: number; // seconds from call start
  endTime: number;
  isFinal: boolean;
  processedByAgent: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  triggers?: string[];
}

export interface TranscriptBufferEvents {
  'segment-added': (segment: TranscriptSegmentData) => void;
  'segment-ready': (segment: TranscriptSegmentData) => void;
}

export class TranscriptBufferService extends EventEmitter {
  private segments: Map<string, TranscriptSegmentData[]> = new Map();
  private callStartTimes: Map<string, number> = new Map();
  private readonly MAX_ACTIVE_WINDOW = 100;
  private readonly MAX_MEMORY_SEGMENTS = 200;

  constructor() {
    super();
  }

  startCall(sessionId: string, recordingId: number): void {
    this.segments.set(sessionId, []);
    this.callStartTimes.set(sessionId, Date.now() / 1000);
    log.info({ sessionId, recordingId }, 'Started tracking call');
  }

  getCallStartTime(sessionId: string): number {
    return this.callStartTimes.get(sessionId) || Date.now() / 1000;
  }

  async addRawSegment(
    sessionId: string,
    recordingId: number,
    channel: 'me' | 'them',
    rawData: RawTranscriptData
  ): Promise<TranscriptSegmentData | null> {
    if (!this.segments.has(sessionId)) {
      this.startCall(sessionId, recordingId);
    }

    const callStart = this.getCallStartTime(sessionId);

    const startTime = rawData.start - callStart;
    const endTime = rawData.end - callStart;

    const segment: TranscriptSegmentData = {
      id: uuid(),
      recordingId,
      sessionId,
      channel,
      text: rawData.text,
      startTime: Math.max(0, startTime), // Ensure non-negative
      endTime: Math.max(0, endTime),
      isFinal: rawData.is_final,
      processedByAgent: false,
    };

    // Add to in-memory buffer
    const callSegments = this.segments.get(sessionId)!;
    callSegments.push(segment);

    // Persist final segments to database
    if (segment.isFinal) {
      try {
        const dbSegment: NewTranscriptSegment = {
          id: segment.id,
          recordingId: segment.recordingId,
          sessionId: segment.sessionId,
          channel: segment.channel,
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          isFinal: segment.isFinal,
          processedByAgent: false,
        };
        createTranscriptSegment(dbSegment);
      } catch (error) {
        log.error({ error, segment }, 'Failed to persist transcript segment');
      }

      // Emit event for agent processing
      this.emit('segment-ready', segment);
    }

    this.emit('segment-added', segment);

    // Memory management - trim old non-final segments
    this.trimBuffer(sessionId);

    return segment;
  }

  /**
   * Add a pre-constructed segment
   */
  addSegment(segment: TranscriptSegmentData): void {
    if (!this.segments.has(segment.sessionId)) {
      this.segments.set(segment.sessionId, []);
    }

    const callSegments = this.segments.get(segment.sessionId)!;
    callSegments.push(segment);

    this.emit('segment-added', segment);

    if (segment.isFinal && !segment.processedByAgent) {
      this.emit('segment-ready', segment);
    }

    this.trimBuffer(segment.sessionId);
  }

  /**
   * Get the active window of recent segments
   */
  getActiveWindow(sessionId: string): TranscriptSegmentData[] {
    const segments = this.segments.get(sessionId) || [];
    return segments.slice(-this.MAX_ACTIVE_WINDOW);
  }

  /**
   * Get only final segments from active window
   */
  getFinalSegments(sessionId: string): TranscriptSegmentData[] {
    const segments = this.segments.get(sessionId) || [];
    return segments.filter(s => s.isFinal).slice(-this.MAX_ACTIVE_WINDOW);
  }

  /**
   * Get recent final segments by channel
   */
  getSegmentsByChannel(sessionId: string, channel: 'me' | 'them', limit: number = 20): TranscriptSegmentData[] {
    const segments = this.segments.get(sessionId) || [];
    return segments
      .filter(s => s.isFinal && s.channel === channel)
      .slice(-limit);
  }

  /**
   * Get the full transcript as formatted text
   */
  getFullTranscript(sessionId: string): string {
    const segments = this.getFinalSegments(sessionId);
    return segments.map(s => `[${s.channel.toUpperCase()}] ${s.text}`).join('\n');
  }

  /**
   * Get recent context as formatted text
   */
  getRecentContext(sessionId: string, windowSize: number = 10): string {
    const segments = this.getFinalSegments(sessionId).slice(-windowSize);
    return segments
      .map(s => `[${s.channel.toUpperCase()} @ ${s.startTime.toFixed(1)}s] ${s.text}`)
      .join('\n');
  }

  /**
   * Get transcript duration based on segments
   */
  getDuration(sessionId: string): number {
    const segments = this.segments.get(sessionId) || [];
    if (segments.length === 0) return 0;

    const lastSegment = segments[segments.length - 1];
    return lastSegment.endTime;
  }

  /**
   * Mark a segment as processed by agent
   */
  markProcessed(segmentId: string, sessionId: string): void {
    const segments = this.segments.get(sessionId) || [];
    const segment = segments.find(s => s.id === segmentId);
    if (segment) {
      segment.processedByAgent = true;
    }
  }

  /**
   * Update segment with analysis results
   */
  updateSegment(segmentId: string, sessionId: string, updates: Partial<TranscriptSegmentData>): void {
    const segments = this.segments.get(sessionId) || [];
    const segment = segments.find(s => s.id === segmentId);
    if (segment) {
      Object.assign(segment, updates);
    }
  }

  /**
   * Trim buffer to prevent memory issues
   */
  private trimBuffer(sessionId: string): void {
    const segments = this.segments.get(sessionId);
    if (!segments) return;

    if (segments.length > this.MAX_MEMORY_SEGMENTS) {
      // Keep only recent segments in memory (older ones are in DB)
      const trimCount = segments.length - this.MAX_ACTIVE_WINDOW;
      segments.splice(0, trimCount);
    }
  }

  /**
   * Clear all data for a session
   */
  clear(sessionId: string): void {
    this.segments.delete(sessionId);
    this.callStartTimes.delete(sessionId);
    log.info({ sessionId }, 'Cleared transcript buffer');
  }

  /**
   * Get all sessions being tracked
   */
  getSessions(): string[] {
    return Array.from(this.segments.keys());
  }
}

// Singleton Instance

let instance: TranscriptBufferService | null = null;

export function getTranscriptBuffer(): TranscriptBufferService {
  if (!instance) {
    instance = new TranscriptBufferService();
  }
  return instance;
}

export function resetTranscriptBuffer(): void {
  instance = null;
}

export default TranscriptBufferService;
