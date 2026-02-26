/**
 * Live Nudge Engine Service
 *
 * Generates gentle, rate-limited coaching nudges based on conversation
 * metrics and sentiment. Maximum 1 nudge per 2 minutes to avoid distraction.
 */

import { v4 as uuid } from 'uuid';
import { logger } from '../../lib/logger';
import type { ConversationMetrics } from './conversation-metrics.service';
import type { SentimentTrend } from './sentiment-analyzer.service';

const log = logger.child({ module: 'nudge-engine' });

// Types

export type NudgeType =
  | 'monologue'
  | 'sentiment'
  | 'talk_ratio'
  | 'next_steps'
  | 'pricing'
  | 'playbook'
  | 'questions'
  | 'pace';

export type NudgeSeverity = 'low' | 'medium' | 'high';

export interface Nudge {
  id: string;
  type: NudgeType;
  message: string;
  severity: NudgeSeverity;
  dismissible: boolean;
  timestamp: number; // epoch ms
  actionLabel?: string;
  actionType?: 'ask_question' | 'pause' | 'clarify' | 'confirm';
}

export interface NudgeConfig {
  enabled: boolean;
  cooldownMs: number; // Minimum time between nudges
  suppressedTypes: NudgeType[];
}

// Nudge Templates

const NUDGE_TEMPLATES: Record<NudgeType, Array<{
  message: string;
  severity: NudgeSeverity;
  actionLabel?: string;
  actionType?: Nudge['actionType'];
}>> = {
  monologue: [
    {
      message: "You've been speaking for a while — try asking a question",
      severity: 'medium',
      actionLabel: 'Suggest question',
      actionType: 'ask_question',
    },
    {
      message: 'Consider pausing to let the customer respond',
      severity: 'low',
      actionType: 'pause',
    },
  ],
  sentiment: [
    {
      message: 'Customer sentiment seems to be dipping — consider clarifying',
      severity: 'high',
      actionLabel: 'Address concern',
      actionType: 'clarify',
    },
    {
      message: 'The customer may have concerns — check in with them',
      severity: 'medium',
      actionType: 'clarify',
    },
  ],
  talk_ratio: [
    {
      message: 'Talk ratio is high — let the customer speak more',
      severity: 'low',
    },
    {
      message: 'You\'re doing most of the talking — try asking open-ended questions',
      severity: 'medium',
      actionType: 'ask_question',
    },
  ],
  next_steps: [
    {
      message: 'Consider confirming next steps before ending the call',
      severity: 'medium',
      actionLabel: 'Confirm next steps',
      actionType: 'confirm',
    },
    {
      message: 'Good time to discuss action items and timeline',
      severity: 'low',
      actionType: 'confirm',
    },
  ],
  pricing: [
    {
      message: 'Pricing came up — make sure to address value before discussing cost',
      severity: 'medium',
    },
  ],
  playbook: [
    {
      message: 'Some playbook items haven\'t been covered yet',
      severity: 'low',
    },
  ],
  questions: [
    {
      message: 'You haven\'t asked many questions — discovery is key',
      severity: 'low',
      actionType: 'ask_question',
    },
  ],
  pace: [
    {
      message: 'You\'re speaking quite fast — try slowing down',
      severity: 'low',
    },
  ],
};

// Nudge Engine Service

export class NudgeEngineService {
  private lastNudgeTime: number = 0;
  private nudgeHistory: Nudge[] = [];
  private config: NudgeConfig;

  private readonly DEFAULT_COOLDOWN = 120000; // 2 minutes

  constructor(config?: Partial<NudgeConfig>) {
    this.config = {
      enabled: true,
      cooldownMs: config?.cooldownMs || this.DEFAULT_COOLDOWN,
      suppressedTypes: config?.suppressedTypes || [],
    };
  }

  /**
   * Evaluate current state and potentially generate a nudge
   */
  evaluate(
    metrics: ConversationMetrics,
    sentiment: SentimentTrend,
    callDuration: number,
    playbookCoverage?: number // 0-100
  ): Nudge | null {
    if (!this.config.enabled) return null;

    // Rate limiting
    const now = Date.now();
    if (now - this.lastNudgeTime < this.config.cooldownMs) {
      return null;
    }

    // Priority-ordered checks
    const nudge =
      this.checkMonologue(metrics) ||
      this.checkSentimentDip(sentiment) ||
      this.checkTalkRatio(metrics) ||
      this.checkQuestions(metrics, callDuration) ||
      this.checkPace(metrics) ||
      this.checkNextSteps(callDuration) ||
      this.checkPlaybook(playbookCoverage, callDuration);

    if (nudge && !this.config.suppressedTypes.includes(nudge.type)) {
      this.lastNudgeTime = now;
      nudge.timestamp = now;
      this.nudgeHistory.push(nudge);
      log.info({ nudge: nudge.type, message: nudge.message }, 'Nudge triggered');
      return nudge;
    }

    return null;
  }

  /**
   * Check for monologue
   */
  private checkMonologue(metrics: ConversationMetrics): Nudge | null {
    if (metrics.monologueDetected || metrics.longestMonologue > 60) {
      return this.createNudge('monologue');
    }
    return null;
  }

  /**
   * Check for sentiment dip
   */
  private checkSentimentDip(sentiment: SentimentTrend): Nudge | null {
    if (
      sentiment.trend === 'declining' &&
      sentiment.current === 'negative'
    ) {
      return this.createNudge('sentiment', 0); // High severity
    }

    if (sentiment.trend === 'declining' && sentiment.averageScore < -0.2) {
      return this.createNudge('sentiment', 1); // Medium severity
    }

    return null;
  }

  /**
   * Check talk ratio
   */
  private checkTalkRatio(metrics: ConversationMetrics): Nudge | null {
    // Only nudge after enough data (at least 60s of speaking)
    if (metrics.totalDuration < 60) return null;

    if (metrics.talkRatio.me > 0.75) {
      return this.createNudge('talk_ratio', 1);
    }

    if (metrics.talkRatio.me > 0.65) {
      return this.createNudge('talk_ratio', 0);
    }

    return null;
  }

  /**
   * Check if asking enough questions
   */
  private checkQuestions(metrics: ConversationMetrics, callDuration: number): Nudge | null {
    // Only after 3 minutes
    if (callDuration < 180) return null;

    // Expect at least 1 question per 2 minutes
    const expectedQuestions = callDuration / 120;
    if (metrics.questionsAsked < expectedQuestions * 0.5) {
      return this.createNudge('questions');
    }

    return null;
  }

  /**
   * Check speaking pace
   */
  private checkPace(metrics: ConversationMetrics): Nudge | null {
    if (metrics.pace > 180) {
      return this.createNudge('pace');
    }
    return null;
  }

  /**
   * Check for next steps reminder
   */
  private checkNextSteps(callDuration: number): Nudge | null {
    // Nudge about next steps after 20 minutes
    // Only trigger once (within a 30s window)
    if (callDuration > 1200 && callDuration < 1230) {
      return this.createNudge('next_steps');
    }

    // Also nudge at 30 minutes
    if (callDuration > 1800 && callDuration < 1830) {
      return this.createNudge('next_steps', 1);
    }

    return null;
  }

  /**
   * Check playbook coverage
   */
  private checkPlaybook(coverage?: number, callDuration?: number): Nudge | null {
    if (coverage === undefined || callDuration === undefined) return null;

    // After 15 minutes, if coverage is low
    if (callDuration > 900 && coverage < 30) {
      return this.createNudge('playbook');
    }

    return null;
  }

  /**
   * Create a nudge from template
   */
  private createNudge(type: NudgeType, templateIndex: number = 0): Nudge {
    const templates = NUDGE_TEMPLATES[type];
    const template = templates[Math.min(templateIndex, templates.length - 1)];

    return {
      id: uuid(),
      type,
      message: template.message,
      severity: template.severity,
      dismissible: true,
      timestamp: 0, // Will be set when returned
      actionLabel: template.actionLabel,
      actionType: template.actionType,
    };
  }

  /**
   * Force a specific nudge (for testing or manual triggers)
   */
  forceNudge(type: NudgeType): Nudge {
    const nudge = this.createNudge(type);
    nudge.timestamp = Date.now();
    this.nudgeHistory.push(nudge);
    return nudge;
  }

  /**
   * Get nudge history
   */
  getHistory(): Nudge[] {
    return [...this.nudgeHistory];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NudgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Suppress a nudge type
   */
  suppressType(type: NudgeType): void {
    if (!this.config.suppressedTypes.includes(type)) {
      this.config.suppressedTypes.push(type);
    }
  }

  /**
   * Unsuppress a nudge type
   */
  unsuppressType(type: NudgeType): void {
    this.config.suppressedTypes = this.config.suppressedTypes.filter(t => t !== type);
  }

  /**
   * Reset for new call
   */
  reset(): void {
    this.lastNudgeTime = 0;
    this.nudgeHistory = [];
    log.info('Nudge engine reset');
  }

  /**
   * Enable/disable nudges
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// Singleton Instance

let instance: NudgeEngineService | null = null;

export function getNudgeEngine(): NudgeEngineService {
  if (!instance) {
    instance = new NudgeEngineService();
  }
  return instance;
}

export function resetNudgeEngine(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default NudgeEngineService;
