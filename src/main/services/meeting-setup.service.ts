/**
 * Meeting Setup Service
 * Handles LLM calls for generating probing questions and meeting checklist
 */

import { logger } from '../lib/logger';
import { getLLMService } from './llm.service';
import {
  PROBING_QUESTIONS_SYSTEM_PROMPT,
  buildProbingQuestionsUserPrompt,
  CHECKLIST_SYSTEM_PROMPT,
  buildChecklistUserPrompt,
} from './meeting-setup.prompts';
import type {
  ProbingQuestion,
  ProbingQuestionsResponse,
  ChecklistResponse,
} from '../../shared/types/meeting-setup.types';

const log = logger.child({ module: 'meeting-setup-service' });

export class MeetingSetupService {
  /**
   * Generate probing questions based on meeting name and description
   */
  async generateProbingQuestions(
    name: string,
    description: string
  ): Promise<{ success: boolean; questions: ProbingQuestion[]; error?: string }> {
    log.info({ name, description: description.slice(0, 100) }, 'Generating probing questions');

    const llm = getLLMService();
    const userPrompt = buildProbingQuestionsUserPrompt(name, description);

    const response = await llm.chatCompletionJSON<ProbingQuestionsResponse>([
      { role: 'system', content: PROBING_QUESTIONS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    if (!response.success || !response.data) {
      log.error({ error: response.error }, 'Failed to generate probing questions');
      return {
        success: false,
        questions: [],
        error: response.error || 'Failed to generate questions',
      };
    }

    // Map response to ProbingQuestion format
    const questions: ProbingQuestion[] = response.data.questions.map((q) => ({
      question: q.question,
      options: q.options,
      answer: '',
      customAnswer: undefined,
    }));

    log.info({ questionCount: questions.length }, 'Probing questions generated');
    return { success: true, questions };
  }

  /**
   * Generate meeting checklist based on setup data
   */
  async generateChecklist(
    name: string,
    description: string,
    questions: ProbingQuestion[]
  ): Promise<{ success: boolean; checklist: string[]; error?: string }> {
    log.info({ name, questionCount: questions.length }, 'Generating meeting checklist');

    const llm = getLLMService();
    const userPrompt = buildChecklistUserPrompt(name, description, questions);

    const response = await llm.chatCompletionJSON<ChecklistResponse>([
      { role: 'system', content: CHECKLIST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    if (!response.success || !response.data) {
      log.error({ error: response.error }, 'Failed to generate checklist');
      return {
        success: false,
        checklist: [],
        error: response.error || 'Failed to generate checklist',
      };
    }

    const checklist = response.data.checklist;

    log.info({ checklistCount: checklist.length }, 'Meeting checklist generated');
    return { success: true, checklist };
  }
}

// Singleton instance
let instance: MeetingSetupService | null = null;

export function getMeetingSetupService(): MeetingSetupService {
  if (!instance) {
    instance = new MeetingSetupService();
  }
  return instance;
}

export function resetMeetingSetupService(): void {
  instance = null;
}
