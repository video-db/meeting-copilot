/**
 * Cue Card Engine Service
 *
 * Detects objections in participant statements using keyword patterns and LLM
 * classification. Retrieves relevant cue card content with talk tracks
 * and follow-up questions.
 */

import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import { getLLMService } from '../llm.service';
import {
  getCueCardsByType,
  createCueCardTrigger,
  updateCueCardTrigger,
} from '../../db';
import type { TranscriptSegmentData } from './transcript-buffer.service';

const log = logger.child({ module: 'cue-card-engine' });

// Types

export type ObjectionType =
  | 'pricing'
  | 'timing'
  | 'competitor'
  | 'authority'
  | 'security'
  | 'integration'
  | 'not_interested'
  | 'send_info';

export interface CueCardContent {
  id: string;
  objectionType: ObjectionType;
  title: string;
  talkTracks: string[];
  followUpQuestions: string[];
  proofPoints?: string[];
  avoidSaying?: string[];
  sourceDoc?: string;
  confidence: number;
}

export interface CueCardTriggerData extends CueCardContent {
  triggerId: string;
  triggerText: string;
  segmentId: string;
  timestamp: number;
  status: 'active' | 'pinned' | 'dismissed';
}

export interface ObjectionDetectionResult {
  detected: boolean;
  objectionType?: ObjectionType;
  confidence: number;
  triggerText?: string;
}

// Detection Patterns

const DETECTION_PATTERNS: Record<ObjectionType, RegExp[]> = {
  pricing: [
    /\b(too expensive|budget|cost|price|cheaper|affordable|expensive)\b/i,
    /\b(out of our budget|can't afford|cost.*concern|pricing.*issue)\b/i,
    /\b(how much|what.*price|what.*cost)\b/i,
  ],
  timing: [
    /\b(not ready|later|next quarter|timing|busy|bandwidth)\b/i,
    /\b(not the right time|maybe.*later|revisit.*later)\b/i,
    /\b(too busy|lot going on|other priorities)\b/i,
  ],
  competitor: [
    /\b(already using|current solution|competitor|alternative)\b/i,
    /\b(salesforce|hubspot|zendesk|other.*tool|similar.*product)\b/i,
    /\b(comparing|evaluate|looking at.*options)\b/i,
  ],
  authority: [
    /\b(need to ask|check with|decision maker|not my decision)\b/i,
    /\b(run.*by|get approval|boss|manager|team)\b/i,
    /\b(can't decide|not authorized|need.*sign off)\b/i,
  ],
  security: [
    /\b(security|compliance|GDPR|SOC2|data privacy|secure)\b/i,
    /\b(where.*data.*stored|encryption|audit)\b/i,
    /\b(privacy.*concern|data.*protection)\b/i,
  ],
  integration: [
    /\b(integrate|integration|API|compatible|works with)\b/i,
    /\b(connect.*with|sync.*with|work.*with.*existing)\b/i,
    /\b(technical.*requirements|implementation)\b/i,
  ],
  not_interested: [
    /\b(not interested|don't need|not for us|pass)\b/i,
    /\b(happy with|satisfied|don't see.*need)\b/i,
    /\b(not.*priority|not looking)\b/i,
  ],
  send_info: [
    /\b(send.*info|send.*details|email.*information)\b/i,
    /\b(follow up|get back|more.*information)\b/i,
    /\b(think about|consider)\b/i,
  ],
};

// Cue Card Engine Service

export class CueCardEngineService {
  private recentTriggers: Map<string, number> = new Map(); // objectionType -> timestamp
  private readonly TRIGGER_COOLDOWN = 60000; // 1 minute between same type

  constructor() {}

  /**
   * Detect objection in a segment (fast, pattern-based)
   */
  detectObjectionFast(segment: TranscriptSegmentData): ObjectionDetectionResult {
    // Only check other participant ("them") statements
    if (segment.channel !== 'them') {
      return { detected: false, confidence: 0 };
    }

    const text = segment.text.toLowerCase();

    for (const [type, patterns] of Object.entries(DETECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          // Check cooldown
          const lastTrigger = this.recentTriggers.get(type);
          if (lastTrigger && Date.now() - lastTrigger < this.TRIGGER_COOLDOWN) {
            continue;
          }

          return {
            detected: true,
            objectionType: type as ObjectionType,
            confidence: 0.7,
            triggerText: segment.text,
          };
        }
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect objection using LLM for ambiguous cases
   */
  async detectObjectionWithLLM(
    segment: TranscriptSegmentData,
    context: string
  ): Promise<ObjectionDetectionResult> {
    if (segment.channel !== 'them') {
      return { detected: false, confidence: 0 };
    }

    const llm = getLLMService();

    const prompt = `Analyze this participant statement in a meeting for objections.

Context (recent conversation):
${context}

Current statement: "${segment.text}"

Objection categories:
- pricing: concerns about cost, budget, affordability
- timing: not ready now, wants to wait
- competitor: mentions other solutions, already using something
- authority: not the decision maker, needs approval
- security: data privacy, compliance concerns
- integration: technical compatibility questions
- not_interested: explicitly not interested
- send_info: wants information sent instead of continuing

Respond with JSON:
{
  "detected": true/false,
  "objection_type": "pricing" | "timing" | "competitor" | "authority" | "security" | "integration" | "not_interested" | "send_info" | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    try {
      const response = await llm.completeJSON<{
        detected: boolean;
        objection_type: ObjectionType | null;
        confidence: number;
        reasoning: string;
      }>(prompt, 'You are an objection detection expert. Return valid JSON only.');

      if (response.success && response.data) {
        if (response.data.detected && response.data.objection_type && response.data.confidence > 0.6) {
          return {
            detected: true,
            objectionType: response.data.objection_type,
            confidence: response.data.confidence,
            triggerText: segment.text,
          };
        }
      }
    } catch (error) {
      log.warn({ error }, 'LLM objection detection failed');
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Retrieve cue card for an objection type
   */
  async getCueCard(
    objectionType: ObjectionType,
    triggerText: string,
    context: string
  ): Promise<CueCardContent | null> {
    // Get cue cards from database
    const cards = getCueCardsByType(objectionType);

    if (cards.length === 0) {
      // Generate a cue card using LLM
      return this.generateCueCard(objectionType, triggerText, context);
    }

    // If multiple cards, use LLM to pick the best one
    if (cards.length > 1) {
      return this.selectBestCueCard(cards, triggerText, context);
    }

    // Single card - parse and return
    const card = cards[0];
    return {
      id: card.id,
      objectionType: card.objectionType as ObjectionType,
      title: card.title,
      talkTracks: JSON.parse(card.talkTracks),
      followUpQuestions: JSON.parse(card.followUpQuestions),
      proofPoints: card.proofPoints ? JSON.parse(card.proofPoints) : undefined,
      avoidSaying: card.avoidSaying ? JSON.parse(card.avoidSaying) : undefined,
      sourceDoc: card.sourceDoc || undefined,
      confidence: 0.9,
    };
  }

  /**
   * Process a segment and potentially return a cue card trigger
   */
  async processSegment(
    segment: TranscriptSegmentData,
    context: string,
    recordingId: number,
    useLLM: boolean = false
  ): Promise<CueCardTriggerData | null> {
    // Fast detection first
    let detection = this.detectObjectionFast(segment);

    // If not detected and LLM is enabled, try LLM
    if (!detection.detected && useLLM) {
      detection = await this.detectObjectionWithLLM(segment, context);
    }

    if (!detection.detected || !detection.objectionType) {
      return null;
    }

    // Update cooldown
    this.recentTriggers.set(detection.objectionType, Date.now());

    // Get cue card
    const cueCard = await this.getCueCard(
      detection.objectionType,
      detection.triggerText || segment.text,
      context
    );

    if (!cueCard) {
      return null;
    }

    // Create trigger record
    const triggerId = uuid();
    try {
      createCueCardTrigger({
        id: triggerId,
        recordingId,
        segmentId: segment.id,
        cueCardId: cueCard.id,
        objectionType: detection.objectionType,
        triggerText: segment.text,
        confidence: cueCard.confidence,
        status: 'active',
        timestamp: segment.startTime,
      });
    } catch (error) {
      log.error({ error }, 'Failed to save cue card trigger');
    }

    return {
      ...cueCard,
      triggerId,
      triggerText: segment.text,
      segmentId: segment.id,
      timestamp: segment.startTime,
      status: 'active',
    };
  }

  /**
   * Generate a cue card using LLM
   */
  private async generateCueCard(
    objectionType: ObjectionType,
    triggerText: string,
    context: string
  ): Promise<CueCardContent> {
    const llm = getLLMService();

    const prompt = `Generate a cue card to help handle this objection.

Objection type: ${objectionType}
Participant said: "${triggerText}"

Context:
${context}

Respond with JSON:
{
  "title": "Brief title for this objection",
  "talk_tracks": ["3-5 response suggestions"],
  "follow_up_questions": ["2-4 clarifying questions to ask"],
  "proof_points": ["1-2 supporting facts if relevant"],
  "avoid_saying": ["1-2 things NOT to say"]
}`;

    try {
      const response = await llm.completeJSON<{
        title: string;
        talk_tracks: string[];
        follow_up_questions: string[];
        proof_points?: string[];
        avoid_saying?: string[];
      }>(prompt, 'You are a meeting enablement expert. Return valid JSON only.');

      if (response.success && response.data) {
        return {
          id: `generated-${uuid()}`,
          objectionType,
          title: response.data.title || `Handling ${objectionType} objection`,
          talkTracks: response.data.talk_tracks || [],
          followUpQuestions: response.data.follow_up_questions || [],
          proofPoints: response.data.proof_points,
          avoidSaying: response.data.avoid_saying,
          confidence: 0.6,
        };
      }
    } catch (error) {
      log.warn({ error }, 'Failed to generate cue card');
    }

    // Fallback
    return {
      id: `fallback-${uuid()}`,
      objectionType,
      title: `Handling ${objectionType} objection`,
      talkTracks: ['Address the concern directly', 'Ask for more details about their situation'],
      followUpQuestions: ['Can you tell me more about that?', 'What would help address this concern?'],
      confidence: 0.3,
    };
  }

  /**
   * Select the best cue card from multiple options
   */
  private async selectBestCueCard(
    cards: Array<{
      id: string;
      objectionType: string;
      title: string;
      talkTracks: string;
      followUpQuestions: string;
      proofPoints: string | null;
      avoidSaying: string | null;
      sourceDoc: string | null;
    }>,
    triggerText: string,
    context: string
  ): Promise<CueCardContent> {
    const llm = getLLMService();

    const cardsContext = cards.map((card, idx) => {
      const tracks = JSON.parse(card.talkTracks);
      return `Card ${idx + 1} (${card.id}):\nTitle: ${card.title}\nTalk tracks: ${tracks.slice(0, 2).join('; ')}`;
    }).join('\n\n');

    const prompt = `Select the most relevant cue card for this objection.

Objection: "${triggerText}"

Context:
${context}

Available cue cards:
${cardsContext}

Respond with JSON:
{
  "selected_index": 0-${cards.length - 1},
  "confidence": 0.0-1.0,
  "reasoning": "why this card is best"
}`;

    try {
      const response = await llm.completeJSON<{
        selected_index: number;
        confidence: number;
        reasoning: string;
      }>(prompt, 'You are a meeting enablement expert. Return valid JSON only.');

      if (response.success && response.data) {
        const selectedIndex = Math.max(0, Math.min(response.data.selected_index, cards.length - 1));
        const selected = cards[selectedIndex];

        return {
          id: selected.id,
          objectionType: selected.objectionType as ObjectionType,
          title: selected.title,
          talkTracks: JSON.parse(selected.talkTracks),
          followUpQuestions: JSON.parse(selected.followUpQuestions),
          proofPoints: selected.proofPoints ? JSON.parse(selected.proofPoints) : undefined,
          avoidSaying: selected.avoidSaying ? JSON.parse(selected.avoidSaying) : undefined,
          sourceDoc: selected.sourceDoc || undefined,
          confidence: response.data.confidence,
        };
      }
    } catch (error) {
      log.warn({ error }, 'Failed to select best cue card');
    }

    // Fallback to first card
    const card = cards[0];
    return {
      id: card.id,
      objectionType: card.objectionType as ObjectionType,
      title: card.title,
      talkTracks: JSON.parse(card.talkTracks),
      followUpQuestions: JSON.parse(card.followUpQuestions),
      proofPoints: card.proofPoints ? JSON.parse(card.proofPoints) : undefined,
      avoidSaying: card.avoidSaying ? JSON.parse(card.avoidSaying) : undefined,
      sourceDoc: card.sourceDoc || undefined,
      confidence: 0.7,
    };
  }

  /**
   * Update cue card trigger status
   */
  updateTriggerStatus(triggerId: string, status: 'active' | 'pinned' | 'dismissed'): void {
    try {
      updateCueCardTrigger(triggerId, { status });
    } catch (error) {
      log.error({ error, triggerId, status }, 'Failed to update trigger status');
    }
  }

  /**
   * Submit feedback for a cue card trigger
   */
  submitFeedback(triggerId: string, feedback: 'helpful' | 'wrong' | 'irrelevant'): void {
    try {
      updateCueCardTrigger(triggerId, { feedback });
      log.info({ triggerId, feedback }, 'Cue card feedback submitted');
    } catch (error) {
      log.error({ error, triggerId, feedback }, 'Failed to submit feedback');
    }
  }

  /**
   * Reset cooldowns
   */
  reset(): void {
    this.recentTriggers.clear();
  }
}

// Singleton Instance

let instance: CueCardEngineService | null = null;

export function getCueCardEngine(): CueCardEngineService {
  if (!instance) {
    instance = new CueCardEngineService();
  }
  return instance;
}

export function resetCueCardEngine(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default CueCardEngineService;
