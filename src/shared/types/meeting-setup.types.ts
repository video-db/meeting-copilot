/**
 * Meeting Setup Types
 * Types for the multi-step meeting setup flow
 */

export interface ProbingQuestion {
  question: string;
  options: string[];
  answer: string; // comma-separated selected options
  customAnswer?: string; // "other" option for custom input
}

export interface MeetingSetup {
  name: string;
  description: string;
  questions: ProbingQuestion[];
  checklist: string[];
}

export interface MeetingSetupStep {
  step: 'sources' | 'info' | 'questions' | 'checklist' | 'ready';
}

// Response types for LLM calls
export interface ProbingQuestionsResponse {
  questions: Array<{
    question: string;
    options: string[];
  }>;
}

export interface ChecklistResponse {
  checklist: string[];
}
