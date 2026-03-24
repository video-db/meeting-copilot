/**
 * Live Assist Service
 *
 * Runs every 20 seconds during recording, analyzes recent transcript,
 * and generates contextual assists (questions, suggestions, actions)
 * using an LLM.
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger';
import { getLLMService } from './llm.service';
import type { LiveAssistItem, LiveAssistResponse } from '../../shared/types/live-assist.types';

const log = logger.child({ module: 'live-assist' });

const LIVE_ASSIST_INTERVAL_MS = 20000; // 20 seconds

const SYSTEM_PROMPT = `You are a live meeting coach. You receive a rolling 20-second transcript from an ongoing meeting. Your job is to ALWAYS surface helpful nudges — questions to ask, things to say, actions to take.

IMPORTANT: You MUST always return at least 1-2 assists for every transcript chunk. Never return an empty array. Find something helpful to suggest.

---

## WHAT TO SURFACE

- A clarifying question worth asking
- A way to respond to something said
- A vague claim worth pinning down
- A topic worth parking for later
- A decision that should be captured
- An opportunity to summarize or steer
- A commitment someone made
- Anything where a nudge would help

Even simple observations are valuable. Always find something.

---

## OUTPUT FORMAT

Return a JSON object with an "assists" array. Each item has:
- "type": one of "ask", "speak", "act"
- "urgency": one of "now", "soon", "later"
- "text": the suggestion — short, ready to use
- "reason": one short sentence explaining what you detected

Example:
{
  "assists": [
    {
      "type": "ask",
      "urgency": "now",
      "text": "What specific metrics are behind that 15% number?",
      "reason": "Speaker claimed 15% improvement without citing data."
    }
  ]
}

---

## RULES

- ALWAYS return 1-3 assists. Never return an empty array.
- Every assist must connect to something in the transcript.
- Write questions as ready-to-use first-person lines.
- Only output the JSON, nothing else.`;

interface TranscriptChunk {
  text: string;
  source: 'mic' | 'system_audio';
  timestamp: number;
}

class LiveAssistService extends EventEmitter {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private transcriptBuffer: TranscriptChunk[] = [];
  private previousAssistTexts: Set<string> = new Set();
  private lastProcessedTimestamp = 0;

  /**
   * Start the live assist loop
   */
  start(): void {
    if (this.isRunning) {
      log.warn('Live assist already running');
      return;
    }

    log.info('Starting live assist service');
    this.isRunning = true;
    this.transcriptBuffer = [];
    this.previousAssistTexts.clear();
    this.lastProcessedTimestamp = Date.now();

    // Run immediately, then every 20 seconds
    this.processTranscript();
    this.intervalTimer = setInterval(() => {
      this.processTranscript();
    }, LIVE_ASSIST_INTERVAL_MS);
  }

  /**
   * Stop the live assist loop
   */
  stop(): void {
    if (!this.isRunning) return;

    log.info('Stopping live assist service');
    this.isRunning = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    this.transcriptBuffer = [];
    this.previousAssistTexts.clear();
  }

  /**
   * Add a transcript segment to the buffer
   */
  addTranscript(text: string, source: 'mic' | 'system_audio'): void {
    if (!this.isRunning) return;

    this.transcriptBuffer.push({
      text,
      source,
      timestamp: Date.now(),
    });

    // Keep only last 60 seconds of transcript for context
    const cutoff = Date.now() - 60000;
    this.transcriptBuffer = this.transcriptBuffer.filter(t => t.timestamp > cutoff);
  }

  /**
   * Process transcript and generate assists
   */
  private async processTranscript(): Promise<void> {
    if (!this.isRunning) return;

    // Get transcript from last 20 seconds
    const cutoff = Date.now() - LIVE_ASSIST_INTERVAL_MS;
    const recentChunks = this.transcriptBuffer.filter(t => t.timestamp > cutoff);

    if (recentChunks.length === 0) {
      log.debug('No recent transcript to process');
      return;
    }

    // Build transcript text with speaker labels
    const transcriptText = recentChunks
      .map(chunk => {
        const speaker = chunk.source === 'mic' ? 'You' : 'Them';
        return `[${speaker}]: ${chunk.text}`;
      })
      .join('\n');

    log.info({ chunkCount: recentChunks.length, textLength: transcriptText.length }, 'Processing transcript for live assist');

    try {
      const llm = getLLMService();
      const response = await llm.chatCompletionJSON<LiveAssistResponse>([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this transcript chunk:\n\n${transcriptText}` },
      ]);

      if (!response.success || !response.data) {
        log.warn({ error: response.error }, 'Failed to get live assist response');
        return;
      }

      const { assists } = response.data;
      log.debug({ response }, 'Response from live assist');
      log.debug({ assists }, 'Assists generated for this chunk');

      if (!assists || assists.length === 0) {
        log.debug('No assists generated for this chunk');
        return;
      }

      // Filter out duplicates from previous rounds
      const newAssists: LiveAssistItem[] = assists
        .filter(assist => !this.previousAssistTexts.has(assist.text.toLowerCase()))
        .slice(0, 3) // Max 3 per round
        .map(assist => ({
          id: uuid(),
          type: assist.type,
          urgency: assist.urgency,
          text: assist.text,
          reason: assist.reason,
          timestamp: Date.now(),
        }));

      // Track these assists to avoid repetition
      newAssists.forEach(assist => {
        this.previousAssistTexts.add(assist.text.toLowerCase());
      });

      // Keep previous assists set manageable (last 20)
      if (this.previousAssistTexts.size > 20) {
        const arr = Array.from(this.previousAssistTexts);
        this.previousAssistTexts = new Set(arr.slice(-20));
      }

      if (newAssists.length > 0) {
        log.info({ count: newAssists.length }, 'Generated new live assists');
        this.emit('assists', { assists: newAssists, processedAt: Date.now() });
      }
    } catch (error) {
      log.error({ error }, 'Error processing transcript for live assist');
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.transcriptBuffer = [];
    this.previousAssistTexts.clear();
  }
}

// Singleton instance
let instance: LiveAssistService | null = null;

export function getLiveAssistService(): LiveAssistService {
  if (!instance) {
    instance = new LiveAssistService();
  }
  return instance;
}

export function resetLiveAssistService(): void {
  if (instance) {
    instance.stop();
    instance.removeAllListeners();
    instance = null;
  }
}

export { LiveAssistService };
export type { TranscriptChunk };
