/**
 * Playbook Tracker Service
 *
 * Tracks coverage of meeting methodology items (MEDDIC, Challenger, etc.)
 * by matching transcript content to required topics. Uses LLM to verify
 * if playbook items were genuinely covered with evidence linking.
 */

import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import { getLLMService } from '../llm.service';
import {
  getPlaybookById,
  getDefaultPlaybook,
  createPlaybookSession,
  updatePlaybookSession,
} from '../../db';
import type { TranscriptSegmentData } from './transcript-buffer.service';

const log = logger.child({ module: 'playbook-tracker' });

// Types

export type PlaybookItemStatus = 'missing' | 'partial' | 'covered';

export interface PlaybookItemEvidence {
  segmentId: string;
  timestamp: number;
  excerpt: string;
  confidence: number;
}

export interface PlaybookItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  suggestedQuestions: string[];
  detectionPrompt: string;
  status: PlaybookItemStatus;
  evidence: PlaybookItemEvidence[];
}

export interface Playbook {
  id: string;
  name: string;
  type: 'MEDDIC' | 'Challenger' | 'SPIN' | 'Custom';
  description?: string;
  items: PlaybookItem[];
}

export interface PlaybookSnapshot {
  playbookId: string;
  playbookName: string;
  covered: number;
  partial: number;
  missing: number;
  total: number;
  coveragePercentage: number;
  items: PlaybookItem[];
  recommendations: string[];
}

// Playbook Tracker Service

export class PlaybookTrackerService {
  private activePlaybook: Playbook | null = null;
  private sessionId: string | null = null;
  private recordingId: number | null = null;

  constructor() {}

  /**
   * Initialize tracker with a playbook
   */
  async initialize(
    playbookId: string | null,
    recordingId: number
  ): Promise<Playbook | null> {
    this.recordingId = recordingId;

    // Get playbook from database
    let dbPlaybook;
    if (playbookId) {
      dbPlaybook = getPlaybookById(playbookId);
    } else {
      dbPlaybook = getDefaultPlaybook();
    }

    if (!dbPlaybook) {
      log.warn('No playbook found');
      return null;
    }

    // Parse playbook items
    const items: PlaybookItem[] = JSON.parse(dbPlaybook.items).map((item: any) => ({
      ...item,
      status: 'missing' as PlaybookItemStatus,
      evidence: [],
    }));

    this.activePlaybook = {
      id: dbPlaybook.id,
      name: dbPlaybook.name,
      type: dbPlaybook.type as Playbook['type'],
      description: dbPlaybook.description || undefined,
      items,
    };

    // Create session record
    this.sessionId = uuid();
    try {
      createPlaybookSession({
        id: this.sessionId,
        recordingId,
        playbookId: dbPlaybook.id,
        itemsCoverage: JSON.stringify(
          items.map(i => ({ id: i.id, status: i.status, evidence: [] }))
        ),
      });
    } catch (error) {
      log.error({ error }, 'Failed to create playbook session');
    }

    log.info({ playbookId: dbPlaybook.id, playbookName: dbPlaybook.name }, 'Playbook tracker initialized');
    return this.activePlaybook;
  }

  /**
   * Get the active playbook
   */
  getPlaybook(): Playbook | null {
    return this.activePlaybook;
  }

  /**
   * Check if a segment covers any playbook items (fast, keyword-based)
   */
  checkCoverageFast(segment: TranscriptSegmentData): PlaybookItem | null {
    if (!this.activePlaybook) return null;

    const text = segment.text.toLowerCase();

    for (const item of this.activePlaybook.items) {
      // Skip if already covered
      if (item.status === 'covered') continue;

      // Check keywords
      const hasKeywords = item.keywords.some(kw =>
        text.includes(kw.toLowerCase())
      );

      if (hasKeywords) {
        // Mark as partial if first match
        if (item.status === 'missing') {
          item.status = 'partial';
          item.evidence.push({
            segmentId: segment.id,
            timestamp: segment.startTime,
            excerpt: segment.text.substring(0, 150),
            confidence: 0.5,
          });
          this.saveSession();
          return item;
        }
      }
    }

    return null;
  }

  /**
   * Check coverage with LLM verification
   */
  async checkCoverageWithLLM(
    segment: TranscriptSegmentData,
    context: string
  ): Promise<PlaybookItem | null> {
    if (!this.activePlaybook) return null;

    // First do fast check
    const fastResult = this.checkCoverageFast(segment);

    // For items that are partially covered, verify with LLM
    for (const item of this.activePlaybook.items) {
      if (item.status === 'covered') continue;

      // Check if this segment might cover the item
      const hasKeywords = item.keywords.some(kw =>
        segment.text.toLowerCase().includes(kw.toLowerCase())
      );

      if (!hasKeywords && item.status !== 'partial') continue;

      // Verify with LLM
      const verification = await this.verifyCoverage(item, segment, context);

      if (verification.isCovered) {
        item.status = 'covered';
        item.evidence.push({
          segmentId: segment.id,
          timestamp: segment.startTime,
          excerpt: segment.text.substring(0, 150),
          confidence: verification.confidence,
        });
        this.saveSession();

        log.info({ itemId: item.id, itemLabel: item.label }, 'Playbook item covered');
        return item;
      } else if (verification.isPartial && item.status === 'missing') {
        item.status = 'partial';
        item.evidence.push({
          segmentId: segment.id,
          timestamp: segment.startTime,
          excerpt: segment.text.substring(0, 150),
          confidence: verification.confidence,
        });
        this.saveSession();
        return item;
      }
    }

    return fastResult;
  }

  /**
   * Verify coverage using LLM
   */
  private async verifyCoverage(
    item: PlaybookItem,
    segment: TranscriptSegmentData,
    context: string
  ): Promise<{ isCovered: boolean; isPartial: boolean; confidence: number }> {
    const llm = getLLMService();

    const prompt = `Analyze this meeting conversation to determine if a playbook item has been covered.

Playbook Item: ${item.label}
Description: ${item.description}
Detection Question: ${item.detectionPrompt}

Recent conversation context:
${context}

Current statement: "${segment.text}"

Determine if this playbook item has been adequately covered in the conversation.

Respond with JSON:
{
  "covered": true/false,
  "partial": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    try {
      const response = await llm.completeJSON<{
        covered: boolean;
        partial: boolean;
        confidence: number;
        reasoning: string;
      }>(prompt, 'You are a meeting methodology expert. Return valid JSON only.');

      if (response.success && response.data) {
        return {
          isCovered: response.data.covered && response.data.confidence > 0.7,
          isPartial: response.data.partial || (response.data.confidence > 0.4 && response.data.confidence <= 0.7),
          confidence: response.data.confidence,
        };
      }
    } catch (error) {
      log.warn({ error, itemId: item.id }, 'LLM verification failed');
    }

    return { isCovered: false, isPartial: false, confidence: 0 };
  }

  /**
   * Get current coverage snapshot
   */
  getSnapshot(): PlaybookSnapshot | null {
    if (!this.activePlaybook) return null;

    const covered = this.activePlaybook.items.filter(i => i.status === 'covered').length;
    const partial = this.activePlaybook.items.filter(i => i.status === 'partial').length;
    const missing = this.activePlaybook.items.filter(i => i.status === 'missing').length;
    const total = this.activePlaybook.items.length;

    // Weight: covered = 1, partial = 0.5, missing = 0
    const coveragePercentage = total > 0
      ? Math.round(((covered + partial * 0.5) / total) * 100)
      : 0;

    // Generate recommendations
    const recommendations: string[] = [];
    for (const item of this.activePlaybook.items) {
      if (item.status === 'missing') {
        recommendations.push(`Consider covering: ${item.label}`);
        if (item.suggestedQuestions.length > 0) {
          recommendations.push(`  Try asking: "${item.suggestedQuestions[0]}"`);
        }
      }
    }

    return {
      playbookId: this.activePlaybook.id,
      playbookName: this.activePlaybook.name,
      covered,
      partial,
      missing,
      total,
      coveragePercentage,
      items: this.activePlaybook.items,
      recommendations: recommendations.slice(0, 4), // Limit to 4
    };
  }

  /**
   * Get missing items with suggested questions
   */
  getMissingItems(): Array<{ item: PlaybookItem; suggestedQuestion: string }> {
    if (!this.activePlaybook) return [];

    return this.activePlaybook.items
      .filter(i => i.status === 'missing')
      .map(item => ({
        item,
        suggestedQuestion: item.suggestedQuestions[0] || '',
      }));
  }

  /**
   * Manually mark an item as covered
   */
  markAsCovered(itemId: string, evidence?: PlaybookItemEvidence): void {
    if (!this.activePlaybook) return;

    const item = this.activePlaybook.items.find(i => i.id === itemId);
    if (item) {
      item.status = 'covered';
      if (evidence) {
        item.evidence.push(evidence);
      }
      this.saveSession();
    }
  }

  /**
   * Save session to database
   */
  private saveSession(): void {
    if (!this.sessionId || !this.activePlaybook) return;

    try {
      const itemsCoverage = this.activePlaybook.items.map(i => ({
        id: i.id,
        status: i.status,
        evidence: i.evidence,
      }));

      updatePlaybookSession(this.sessionId, {
        itemsCoverage: JSON.stringify(itemsCoverage),
      });
    } catch (error) {
      log.error({ error }, 'Failed to save playbook session');
    }
  }

  /**
   * Finalize and save completion snapshot
   */
  async finalize(): Promise<PlaybookSnapshot | null> {
    const snapshot = this.getSnapshot();
    if (!snapshot || !this.sessionId) return snapshot;

    try {
      updatePlaybookSession(this.sessionId, {
        completionSnapshot: JSON.stringify(snapshot),
      });
      log.info({ coverage: snapshot.coveragePercentage }, 'Playbook session finalized');
    } catch (error) {
      log.error({ error }, 'Failed to finalize playbook session');
    }

    return snapshot;
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.activePlaybook = null;
    this.sessionId = null;
    this.recordingId = null;
  }
}

// Singleton Instance

let instance: PlaybookTrackerService | null = null;

export function getPlaybookTracker(): PlaybookTrackerService {
  if (!instance) {
    instance = new PlaybookTrackerService();
  }
  return instance;
}

export function resetPlaybookTracker(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default PlaybookTrackerService;
