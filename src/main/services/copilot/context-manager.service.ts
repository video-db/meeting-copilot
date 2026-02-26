/**
 * Context Manager Service
 *
 * Compresses older transcript segments into summaries to manage context
 * window size for LLM processing. Maintains compressed 5-minute chunks
 * for history while keeping recent segments in full detail.
 */

import { logger } from '../../lib/logger';
import { getLLMService } from '../llm.service';
import type { TranscriptSegmentData } from './transcript-buffer.service';

const log = logger.child({ module: 'context-manager' });

// Types

export interface CompressedChunk {
  id: number; // chunk number (0, 1, 2...)
  startTime: number;
  endTime: number;
  summary: string;
  keyTopics: string[];
  importantMoments: Array<{
    time: number;
    type: 'objection' | 'commitment' | 'question' | 'pain_point' | 'decision';
    text: string;
  }>;
}

export interface ContextBuilderOptions {
  maxTokens?: number;
  includeHistory?: boolean;
  includeRecent?: boolean;
  recentWindowSize?: number;
}

// Context Manager Service

export class ContextManagerService {
  private compressedHistory: Map<string, CompressedChunk[]> = new Map(); // sessionId -> chunks
  private readonly CHUNK_DURATION = 300; // 5 minutes in seconds
  private readonly MAX_CONTEXT_TOKENS = 8000;
  private readonly CHARS_PER_TOKEN = 4; // Rough estimate

  constructor() {}

  /**
   * Compress segments into a summary chunk
   */
  async compressSegments(
    sessionId: string,
    segments: TranscriptSegmentData[]
  ): Promise<CompressedChunk | null> {
    if (segments.length === 0) return null;

    const chunkId = Math.floor(segments[0].startTime / this.CHUNK_DURATION);

    if (!this.compressedHistory.has(sessionId)) {
      this.compressedHistory.set(sessionId, []);
    }

    const chunks = this.compressedHistory.get(sessionId)!;

    // Check if chunk already exists
    let chunk = chunks.find(c => c.id === chunkId);
    if (chunk) {
      // Chunk already compressed
      return chunk;
    }

    // Create new chunk
    chunk = {
      id: chunkId,
      startTime: chunkId * this.CHUNK_DURATION,
      endTime: (chunkId + 1) * this.CHUNK_DURATION,
      summary: '',
      keyTopics: [],
      importantMoments: [],
    };

    // Format transcript for compression
    const transcript = segments
      .map(s => `[${s.channel.toUpperCase()}] ${s.text}`)
      .join('\n');

    const prompt = `Summarize this 5-minute meeting segment in 3-4 bullet points.
Extract key information to reference later.

Transcript:
${transcript}

Respond with JSON:
{
  "summary": "3-4 bullet point summary (one string with line breaks)",
  "topics": ["topic1", "topic2"],
  "important_moments": [
    {"time": 305, "type": "objection|commitment|question|pain_point|decision", "text": "brief description"}
  ]
}`;

    try {
      const llm = getLLMService();
      const response = await llm.completeJSON<{
        summary: string;
        topics: string[];
        important_moments: Array<{ time: number; type: string; text: string }>;
      }>(prompt, 'You are a meeting analyst. Return valid JSON only.');

      if (response.success && response.data) {
        chunk.summary = response.data.summary || '';
        chunk.keyTopics = response.data.topics || [];
        chunk.importantMoments = (response.data.important_moments || []).map(m => ({
          time: m.time,
          type: m.type as CompressedChunk['importantMoments'][0]['type'],
          text: m.text,
        }));
      }
    } catch (error) {
      log.error({ error }, 'Failed to compress chunk');
      // Fallback to simple concatenation
      chunk.summary = `Call segment ${chunkId + 1} (${segments.length} exchanges)`;
    }

    chunks.push(chunk);
    chunks.sort((a, b) => a.id - b.id);

    return chunk;
  }

  /**
   * Build relevant context for agent processing
   */
  buildContext(
    sessionId: string,
    currentSegment: TranscriptSegmentData,
    recentSegments: TranscriptSegmentData[],
    options: ContextBuilderOptions = {}
  ): string {
    const {
      maxTokens = this.MAX_CONTEXT_TOKENS,
      includeHistory = true,
      includeRecent = true,
      recentWindowSize = 20,
    } = options;

    const chunks = this.compressedHistory.get(sessionId) || [];
    const parts: string[] = [];

    // Add compressed history
    if (includeHistory && chunks.length > 0) {
      const historySummary = chunks
        .map(chunk => {
          const topics = chunk.keyTopics.length > 0
            ? `Topics: ${chunk.keyTopics.join(', ')}`
            : '';
          return `[${this.formatTime(chunk.startTime)}-${this.formatTime(chunk.endTime)}]\n${chunk.summary}${topics ? '\n' + topics : ''}`;
        })
        .join('\n\n');

      parts.push('# Call History (compressed):\n' + historySummary);
    }

    // Add recent transcript
    if (includeRecent && recentSegments.length > 0) {
      const recentTranscript = recentSegments
        .slice(-recentWindowSize)
        .map(s => `[${s.channel.toUpperCase()} @ ${this.formatTime(s.startTime)}] ${s.text}`)
        .join('\n');

      parts.push('# Recent conversation:\n' + recentTranscript);
    }

    // Add current segment
    parts.push(
      `# Current statement:\n[${currentSegment.channel.toUpperCase()} @ ${this.formatTime(currentSegment.startTime)}] ${currentSegment.text}`
    );

    let context = parts.join('\n\n');

    // Trim if too long
    const estimatedTokens = context.length / this.CHARS_PER_TOKEN;
    if (estimatedTokens > maxTokens) {
      // Keep only recent transcript + current
      const recentTranscript = recentSegments
        .slice(-10)
        .map(s => `[${s.channel.toUpperCase()} @ ${this.formatTime(s.startTime)}] ${s.text}`)
        .join('\n');

      context = `# Recent conversation:\n${recentTranscript}\n\n# Current:\n[${currentSegment.channel.toUpperCase()} @ ${this.formatTime(currentSegment.startTime)}] ${currentSegment.text}`;
    }

    return context;
  }

  /**
   * Build context for specific analysis (e.g., objection detection)
   */
  buildAnalysisContext(
    sessionId: string,
    recentSegments: TranscriptSegmentData[],
    windowSize: number = 5
  ): string {
    const recent = recentSegments.slice(-windowSize);
    return recent
      .map(s => `[${s.channel.toUpperCase()}] ${s.text}`)
      .join('\n');
  }

  /**
   * Get all compressed chunks for a session
   */
  getCompressedHistory(sessionId: string): CompressedChunk[] {
    return this.compressedHistory.get(sessionId) || [];
  }

  /**
   * Get important moments from all chunks
   */
  getImportantMoments(sessionId: string): CompressedChunk['importantMoments'] {
    const chunks = this.compressedHistory.get(sessionId) || [];
    return chunks.flatMap(c => c.importantMoments);
  }

  /**
   * Format time in MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Clear context for a session
   */
  clear(sessionId: string): void {
    this.compressedHistory.delete(sessionId);
    log.info({ sessionId }, 'Cleared context history');
  }
}

// Singleton Instance

let instance: ContextManagerService | null = null;

export function getContextManager(): ContextManagerService {
  if (!instance) {
    instance = new ContextManagerService();
  }
  return instance;
}

export function resetContextManager(): void {
  instance = null;
}

export default ContextManagerService;
