/**
 * Live Assist Types
 *
 * Types for the real-time meeting assist feature that analyzes
 * transcript chunks and provides contextual suggestions.
 */

export type AssistType = 'ask' | 'speak' | 'act';
export type AssistUrgency = 'now' | 'soon' | 'later';

export interface LiveAssistItem {
  id: string;
  type: AssistType;
  urgency: AssistUrgency;
  text: string;
  reason: string;
  timestamp: number; // When this assist was generated
}

export interface LiveAssistResponse {
  assists: Array<{
    type: AssistType;
    urgency: AssistUrgency;
    text: string;
    reason: string;
  }>;
}

export interface LiveAssistEvent {
  assists: LiveAssistItem[];
  processedAt: number;
}
