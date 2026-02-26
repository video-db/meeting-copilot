/**
 * Summary Generator Service
 *
 * Fast extraction of key call outcomes using parallel LLM calls.
 * Generates summary bullets, pain points, objections, commitments,
 * and next steps with evidence linking to transcript timestamps.
 */

import { logger } from '../../lib/logger';
import { getLLMService } from '../llm.service';
import type { TranscriptSegmentData } from './transcript-buffer.service';
import type { PlaybookSnapshot } from './playbook-tracker.service';
import type { ConversationMetrics } from './conversation-metrics.service';

const log = logger.child({ module: 'summary-generator' });

// Types

export interface Evidence {
  segmentId: string;
  timestamp: number;
  excerpt: string;
  channel: 'me' | 'them';
}

export interface ActionItem {
  action: string;
  owner: 'me' | 'them' | 'both';
  deadline?: string;
  priority: 'high' | 'medium' | 'low';
  evidence: Evidence[];
}

export interface Objection {
  type: string;
  text: string;
  response?: string;
  resolved: boolean;
  timestamp: number;
}

export interface Commitment {
  who: 'me' | 'them';
  commitment: string;
  timestamp: number;
  context?: string;
}

export interface CallSummary {
  bullets: string[]; // 5-10 bullet summary
  customerPain: string[]; // Pain points mentioned
  customerGoals: string[]; // Goals/objectives mentioned
  objections: Objection[];
  commitments: Commitment[];
  nextSteps: ActionItem[];
  keyDecisions: string[];
  riskFlags: string[];
  generatedAt: number;
}

export interface FullCallReport {
  summary: CallSummary;
  playbook?: PlaybookSnapshot;
  metrics?: ConversationMetrics;
  callDuration: number;
  segmentCount: number;
}

// Summary Generator Service

export class SummaryGeneratorService {
  constructor() {}

  /**
   * Generate full call summary using parallel extraction
   */
  async generate(segments: TranscriptSegmentData[]): Promise<CallSummary> {
    const finalSegments = segments.filter(s => s.isFinal);

    if (finalSegments.length === 0) {
      return this.emptyResults();
    }

    log.info({ segmentCount: finalSegments.length }, 'Generating call summary');

    // Run extractions in parallel for speed with error handling
    let bullets: string[] = [];
    let painAndGoals: { pain: string[]; goals: string[] } = { pain: [], goals: [] };
    let objections: Objection[] = [];
    let commitments: Commitment[] = [];
    let nextSteps: ActionItem[] = [];
    let decisions: string[] = [];

    try {
      const results = await Promise.allSettled([
        this.extractBullets(finalSegments),
        this.extractPainAndGoals(finalSegments),
        this.extractObjections(finalSegments),
        this.extractCommitments(finalSegments),
        this.extractNextSteps(finalSegments),
        this.extractDecisions(finalSegments),
      ]);

      // Process results, using defaults for any that failed
      bullets = results[0].status === 'fulfilled' ? results[0].value : [];
      painAndGoals = results[1].status === 'fulfilled' ? results[1].value : { pain: [], goals: [] };
      objections = results[2].status === 'fulfilled' ? results[2].value : [];
      commitments = results[3].status === 'fulfilled' ? results[3].value : [];
      nextSteps = results[4].status === 'fulfilled' ? results[4].value : [];
      decisions = results[5].status === 'fulfilled' ? results[5].value : [];

      // Log any failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        log.warn({
          failedCount: failures.length,
          errors: failures.map((f, i) => ({
            index: i,
            reason: f.status === 'rejected' ? f.reason?.message || f.reason : 'unknown'
          }))
        }, 'Some summary extractions failed');
      }

      log.info({
        bullets: bullets.length,
        painPoints: painAndGoals.pain.length,
        goals: painAndGoals.goals.length,
        objections: objections.length,
        commitments: commitments.length,
        nextSteps: nextSteps.length,
        decisions: decisions.length,
      }, 'Summary extraction complete');
    } catch (error) {
      log.error({ error }, 'Summary generation failed completely');
    }

    // Extract risk flags from various sources
    const riskFlags = this.identifyRisks(objections, painAndGoals.pain, commitments);

    return {
      bullets,
      customerPain: painAndGoals.pain,
      customerGoals: painAndGoals.goals,
      objections,
      commitments,
      nextSteps,
      keyDecisions: decisions,
      riskFlags,
      generatedAt: Date.now(),
    };
  }

  /**
   * Generate quick summary (faster, less detailed)
   */
  async generateQuick(segments: TranscriptSegmentData[]): Promise<Partial<CallSummary>> {
    const finalSegments = segments.filter(s => s.isFinal);

    if (finalSegments.length === 0) {
      return { bullets: [], nextSteps: [] };
    }

    // Just extract bullets and next steps
    const [bullets, nextSteps] = await Promise.all([
      this.extractBullets(finalSegments),
      this.extractNextSteps(finalSegments),
    ]);

    return {
      bullets,
      nextSteps,
      generatedAt: Date.now(),
    };
  }

  /**
   * Extract summary bullets
   */
  private async extractBullets(segments: TranscriptSegmentData[]): Promise<string[]> {
    const transcript = this.formatTranscript(segments);
    const llm = getLLMService();

    const prompt = `Summarize this meeting in 5-8 concise bullet points.
Focus on: what was discussed, key decisions, main concerns, and outcomes.

${transcript}

Respond with JSON:
{
  "bullets": ["bullet 1", "bullet 2", ...]
}`;

    try {
      const response = await llm.completeJSON<{ bullets: string[] }>(
        prompt,
        'You are a meeting summarization expert. Return valid JSON only.'
      );

      if (response.success && response.data) {
        return response.data.bullets || [];
      }
    } catch (error) {
      log.warn({ error }, 'Bullet extraction failed');
    }

    return [];
  }

  /**
   * Extract pain points and goals
   */
  private async extractPainAndGoals(
    segments: TranscriptSegmentData[]
  ): Promise<{ pain: string[]; goals: string[] }> {
    // Focus on customer statements
    const themSegments = segments.filter(s => s.channel === 'them');
    const transcript = this.formatTranscript(themSegments);
    const llm = getLLMService();

    const prompt = `Extract the participant's pain points and goals from this meeting.

Customer statements:
${transcript}

Respond with JSON:
{
  "pain_points": ["pain 1", "pain 2"],
  "goals": ["goal 1", "goal 2"]
}`;

    try {
      const response = await llm.completeJSON<{
        pain_points: string[];
        goals: string[];
      }>(prompt, 'You are a meeting analysis expert. Return valid JSON only.');

      if (response.success && response.data) {
        return {
          pain: response.data.pain_points || [],
          goals: response.data.goals || [],
        };
      }
    } catch (error) {
      log.warn({ error }, 'Pain/goals extraction failed');
    }

    return { pain: [], goals: [] };
  }

  /**
   * Extract objections and responses
   */
  private async extractObjections(segments: TranscriptSegmentData[]): Promise<Objection[]> {
    const transcript = this.formatFullTranscript(segments);
    const llm = getLLMService();

    const prompt = `Extract objections or concerns raised and how they were addressed.

${transcript}

Respond with JSON:
{
  "objections": [
    {
      "type": "pricing|timing|competitor|authority|other",
      "text": "what customer said",
      "response": "how rep responded (if captured)",
      "resolved": true/false,
      "timestamp": seconds from start
    }
  ]
}`;

    try {
      const response = await llm.completeJSON<{
        objections: Array<{
          type: string;
          text: string;
          response?: string;
          resolved: boolean;
          timestamp: number;
        }>;
      }>(prompt, 'You are a meeting objection analysis expert. Return valid JSON only.');

      if (response.success && response.data) {
        return response.data.objections || [];
      }
    } catch (error) {
      log.warn({ error }, 'Objection extraction failed');
    }

    return [];
  }

  /**
   * Extract commitments
   */
  private async extractCommitments(segments: TranscriptSegmentData[]): Promise<Commitment[]> {
    const transcript = this.formatFullTranscript(segments);
    const llm = getLLMService();

    const prompt = `Extract commitments or promises made by either party in this meeting.
Look for statements like "I will...", "We'll send...", "Let me...", "I promise...".

${transcript}

Respond with JSON:
{
  "commitments": [
    {
      "who": "me" | "them",
      "commitment": "what was committed to",
      "timestamp": seconds from start,
      "context": "surrounding context"
    }
  ]
}`;

    try {
      const response = await llm.completeJSON<{
        commitments: Array<{
          who: 'me' | 'them';
          commitment: string;
          timestamp: number;
          context?: string;
        }>;
      }>(prompt, 'You are a meeting commitment tracking expert. Return valid JSON only.');

      if (response.success && response.data) {
        return response.data.commitments || [];
      }
    } catch (error) {
      log.warn({ error }, 'Commitment extraction failed');
    }

    return [];
  }

  /**
   * Extract next steps and action items
   */
  private async extractNextSteps(segments: TranscriptSegmentData[]): Promise<ActionItem[]> {
    // Focus on last 30% of call for next steps
    const endSegments = segments.slice(-Math.max(10, Math.floor(segments.length * 0.3)));
    const transcript = this.formatFullTranscript(endSegments);
    const llm = getLLMService();

    const prompt = `Extract action items and next steps from the end of this meeting.

${transcript}

Respond with JSON:
{
  "action_items": [
    {
      "action": "what needs to be done",
      "owner": "me" | "them" | "both",
      "deadline": "when (if mentioned)" | null,
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    try {
      const response = await llm.completeJSON<{
        action_items: Array<{
          action: string;
          owner: 'me' | 'them' | 'both';
          deadline?: string;
          priority: 'high' | 'medium' | 'low';
        }>;
      }>(prompt, 'You are a meeting action item expert. Return valid JSON only.');

      if (response.success && response.data) {
        return (response.data.action_items || []).map(item => ({
          ...item,
          evidence: [],
        }));
      }
    } catch (error) {
      log.warn({ error }, 'Next steps extraction failed');
    }

    return [];
  }

  /**
   * Extract key decisions
   */
  private async extractDecisions(segments: TranscriptSegmentData[]): Promise<string[]> {
    const transcript = this.formatTranscript(segments);
    const llm = getLLMService();

    const prompt = `Extract key decisions made during this meeting.
Look for agreements, choices made, or conclusions reached.

${transcript}

Respond with JSON:
{
  "decisions": ["decision 1", "decision 2"]
}`;

    try {
      const response = await llm.completeJSON<{ decisions: string[] }>(
        prompt,
        'You are a meeting analysis expert. Return valid JSON only.'
      );

      if (response.success && response.data) {
        return response.data.decisions || [];
      }
    } catch (error) {
      log.warn({ error }, 'Decision extraction failed');
    }

    return [];
  }

  /**
   * Identify risk flags from extracted data
   */
  private identifyRisks(
    objections: Objection[],
    painPoints: string[],
    commitments: Commitment[]
  ): string[] {
    const risks: string[] = [];

    // Unresolved objections
    const unresolvedObjections = objections.filter(o => !o.resolved);
    if (unresolvedObjections.length > 0) {
      risks.push(`${unresolvedObjections.length} unresolved objection(s)`);
    }

    // Authority objection (decision maker not identified)
    if (objections.some(o => o.type === 'authority')) {
      risks.push('Decision maker may not be identified');
    }

    // No pain points identified
    if (painPoints.length === 0) {
      risks.push('Pain points not clearly identified');
    }

    // No commitments from other participant
    const theirCommitments = commitments.filter(c => c.who === 'them');
    if (theirCommitments.length === 0) {
      risks.push('No commitments from other participant');
    }

    return risks;
  }

  /**
   * Format transcript as simple text
   */
  private formatTranscript(segments: TranscriptSegmentData[]): string {
    return segments
      .map(s => `[${s.channel.toUpperCase()}] ${s.text}`)
      .join('\n');
  }

  /**
   * Format transcript with timestamps
   */
  private formatFullTranscript(segments: TranscriptSegmentData[]): string {
    return segments
      .map(s => `[${s.channel.toUpperCase()} @ ${this.formatTime(s.startTime)}] ${s.text}`)
      .join('\n');
  }

  /**
   * Format time as MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Return empty results
   */
  private emptyResults(): CallSummary {
    return {
      bullets: [],
      customerPain: [],
      customerGoals: [],
      objections: [],
      commitments: [],
      nextSteps: [],
      keyDecisions: [],
      riskFlags: [],
      generatedAt: Date.now(),
    };
  }
}

// Singleton Instance

let instance: SummaryGeneratorService | null = null;

export function getSummaryGenerator(): SummaryGeneratorService {
  if (!instance) {
    instance = new SummaryGeneratorService();
  }
  return instance;
}

export function resetSummaryGenerator(): void {
  instance = null;
}

export default SummaryGeneratorService;
