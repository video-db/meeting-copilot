/**
 * Intent Detector Service
 *
 * Detects when transcript content suggests an MCP tool call would be helpful.
 * Uses pattern matching for fast detection and LLM for more accurate detection.
 */

import { logger } from '../../lib/logger';
import { getLLMService } from '../llm.service';
import { getToolAggregator, ToolAggregatorService, NamespacedTool } from './tool-aggregator.service';
import type { MCPIntentDetection, MCPTool } from '../../../shared/types/mcp.types';
import type { TranscriptSegmentData } from '../copilot/transcript-buffer.service';

const log = logger.child({ module: 'mcp-intent-detector' });

// Intent patterns for fast detection
interface IntentPattern {
  pattern: RegExp;
  intent: string;
  toolKeywords: string[];
  confidence: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // CRM lookups
  {
    pattern: /who\s+(is|are|was)\s+\w+\s+(at|from|with)\s+\w+/i,
    intent: 'crm_lookup',
    toolKeywords: ['contact', 'get_contact', 'search', 'lookup'],
    confidence: 0.7,
  },
  {
    pattern: /(can you|could you|please)\s+(look up|find|get|check)\s+.*(contact|customer|account|company)/i,
    intent: 'crm_lookup',
    toolKeywords: ['contact', 'company', 'account', 'search'],
    confidence: 0.8,
  },
  {
    pattern: /what('s| is| are)\s+(the|their)\s+(deal|opportunity|pipeline|stage)/i,
    intent: 'deal_lookup',
    toolKeywords: ['deal', 'opportunity', 'pipeline'],
    confidence: 0.75,
  },

  // Calendar/scheduling
  {
    pattern: /(schedule|book|set up|arrange)\s+a?\s*(call|meeting|demo|follow-?up)/i,
    intent: 'schedule_meeting',
    toolKeywords: ['calendar', 'schedule', 'meeting', 'availability'],
    confidence: 0.8,
  },
  {
    pattern: /when\s+(are you|is .*)\s+(free|available)/i,
    intent: 'check_availability',
    toolKeywords: ['calendar', 'availability', 'schedule'],
    confidence: 0.7,
  },
  {
    pattern: /(next|this)\s+(week|monday|tuesday|wednesday|thursday|friday)/i,
    intent: 'check_availability',
    toolKeywords: ['calendar', 'schedule'],
    confidence: 0.5,
  },

  // Documentation lookup
  {
    pattern: /(what('s| is| are)\s+(the|our)|do you have)\s+.*(documentation|doc|guide|spec)/i,
    intent: 'doc_lookup',
    toolKeywords: ['document', 'search', 'page', 'content'],
    confidence: 0.7,
  },
  {
    pattern: /(how does|explain|tell me about)\s+.*(feature|product|integration|api)/i,
    intent: 'doc_lookup',
    toolKeywords: ['document', 'search', 'page'],
    confidence: 0.6,
  },

  // Competitor/research
  {
    pattern: /(how|what)\s+(do|does)\s+(you|your|it)\s+(compare|differ|stack up)/i,
    intent: 'competitor_research',
    toolKeywords: ['search', 'compare'],
    confidence: 0.7,
  },
  {
    pattern: /\b(competitor|vs|versus|alternative|compared to)\b/i,
    intent: 'competitor_research',
    toolKeywords: ['search', 'brave_search'],
    confidence: 0.6,
  },

  // Pricing/quote
  {
    pattern: /(what('s| is| are)\s+(the|your)|how much)\s+.*(price|pricing|cost|rate)/i,
    intent: 'pricing_lookup',
    toolKeywords: ['pricing', 'quote', 'product'],
    confidence: 0.8,
  },

  // Previous conversation/memory
  {
    pattern: /(remember|recall|last time|previous(ly)?|earlier|before)\s+.*(discussion|call|meeting|talked|mentioned)/i,
    intent: 'memory_recall',
    toolKeywords: ['memory', 'recall', 'remember'],
    confidence: 0.7,
  },
];

export class IntentDetectorService {
  private toolAggregator: ToolAggregatorService;
  private cooldownMap: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 30000; // 30 seconds between same intent detections

  constructor() {
    this.toolAggregator = getToolAggregator();
  }

  /**
   * Fast pattern-based intent detection
   */
  detectFast(segment: TranscriptSegmentData, context: string): MCPIntentDetection {
    const text = segment.text;

    for (const intentPattern of INTENT_PATTERNS) {
      const match = text.match(intentPattern.pattern);

      if (match) {
        // Check cooldown
        if (this.isOnCooldown(intentPattern.intent)) {
          continue;
        }

        // Find matching tool
        const tool = this.findToolForIntent(intentPattern.toolKeywords);

        if (tool) {
          this.setCooldown(intentPattern.intent);

          log.info({
            intent: intentPattern.intent,
            tool: tool.namespacedName,
            confidence: intentPattern.confidence,
            matchedText: match[0],
          }, 'Intent detected (fast)');

          return {
            detected: true,
            toolName: tool.namespacedName,
            serverId: tool.serverId,
            confidence: intentPattern.confidence,
            reason: `Pattern matched: "${match[0]}"`,
            triggerText: text,
            suggestedInput: this.extractSuggestedInput(text, tool),
          };
        }
      }
    }

    return {
      detected: false,
      confidence: 0,
    };
  }

  /**
   * LLM-based intent detection (more accurate but slower)
   */
  async detectWithLLM(
    segment: TranscriptSegmentData,
    context: string,
    tools: MCPTool[]
  ): Promise<MCPIntentDetection> {
    if (tools.length === 0) {
      return { detected: false, confidence: 0 };
    }

    const llmService = getLLMService();
    if (!llmService) {
      log.warn('LLM service not available, falling back to fast detection');
      return this.detectFast(segment, context);
    }

    // Build tools description for the prompt
    const toolsDescription = tools.map((t) =>
      `- ${t.serverId}:${t.name}: ${t.description || 'No description'}`
    ).join('\n');

    const prompt = `Analyze this conversation segment to determine if calling an external tool would be helpful.

Available MCP Tools:
${toolsDescription}

Recent Conversation Context:
${context}

Current Statement:
Speaker: ${segment.channel === 'me' ? 'You' : 'Other Participant'}
Text: "${segment.text}"

Determine if any tool should be called. Consider:
1. Is there a specific information request that a tool could answer?
2. Would tool data enhance the conversation?
3. Is this a natural moment to look something up?

Return JSON:
{
  "detected": boolean,
  "toolName": "serverId:toolName" or null,
  "confidence": 0.0-1.0,
  "reason": "explanation",
  "suggestedInput": { key: value } or null
}`;

    try {
      const response = await llmService.completeJSON<{
        detected: boolean;
        toolName: string | null;
        confidence: number;
        reason: string;
        suggestedInput: Record<string, unknown> | null;
      }>(prompt);

      if (!response.success || !response.data) {
        log.warn({ error: response.error }, 'LLM intent detection returned no data');
        return this.detectFast(segment, context);
      }

      const result = response.data;

      if (result.detected && result.toolName) {
        // Check cooldown
        if (this.isOnCooldown(result.toolName)) {
          return { detected: false, confidence: 0, reason: 'On cooldown' };
        }

        this.setCooldown(result.toolName);

        log.info({
          tool: result.toolName,
          confidence: result.confidence,
          reason: result.reason,
        }, 'Intent detected (LLM)');
      }

      return {
        detected: result.detected,
        toolName: result.toolName || undefined,
        serverId: result.toolName?.split(':')[0],
        confidence: result.confidence,
        reason: result.reason,
        suggestedInput: result.suggestedInput ?? undefined,
        triggerText: segment.text,
      };
    } catch (error) {
      log.error({ error }, 'LLM intent detection failed');
      // Fall back to fast detection
      return this.detectFast(segment, context);
    }
  }

  /**
   * Find a tool that matches the given keywords
   */
  private findToolForIntent(keywords: string[]): NamespacedTool | undefined {
    for (const keyword of keywords) {
      const tools = this.toolAggregator.searchTools(keyword);
      if (tools.length > 0) {
        return tools[0];
      }
    }
    return undefined;
  }

  /**
   * Extract suggested input parameters from the text
   */
  private extractSuggestedInput(
    text: string,
    tool: NamespacedTool
  ): Record<string, unknown> | undefined {
    // Try to extract common parameters
    const input: Record<string, unknown> = {};

    // Extract email
    const emailMatch = text.match(/\b[\w.-]+@[\w.-]+\.\w+\b/);
    if (emailMatch) {
      input.email = emailMatch[0];
    }

    // Extract company names (capitalized words that might be companies)
    const companyMatch = text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/);
    if (companyMatch) {
      input.company = companyMatch[0];
      input.query = companyMatch[0];
    }

    // Extract person names after "who is" or similar
    const personMatch = text.match(/(?:who is|find|look up)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (personMatch) {
      input.name = personMatch[1];
      input.query = personMatch[1];
    }

    // Extract search query
    const searchMatch = text.match(/(?:search|find|look up|get)\s+(?:for\s+)?(.+)/i);
    if (searchMatch && !input.query) {
      input.query = searchMatch[1].trim();
    }

    return Object.keys(input).length > 0 ? input : undefined;
  }

  /**
   * Check if an intent is on cooldown
   */
  private isOnCooldown(intent: string): boolean {
    const lastTriggered = this.cooldownMap.get(intent);
    if (!lastTriggered) return false;

    return Date.now() - lastTriggered < this.COOLDOWN_MS;
  }

  /**
   * Set cooldown for an intent
   */
  private setCooldown(intent: string): void {
    this.cooldownMap.set(intent, Date.now());
  }

  /**
   * Clear all cooldowns
   */
  clearCooldowns(): void {
    this.cooldownMap.clear();
  }

  /**
   * Update cooldown duration
   */
  setCooldownDuration(ms: number): void {
    // Note: This would need a class property change for runtime updates
    log.info({ ms }, 'Cooldown duration update requested');
  }
}

// Singleton instance
let instance: IntentDetectorService | null = null;

export function getIntentDetector(): IntentDetectorService {
  if (!instance) {
    instance = new IntentDetectorService();
  }
  return instance;
}

export function resetIntentDetector(): void {
  instance = null;
}

export default IntentDetectorService;
