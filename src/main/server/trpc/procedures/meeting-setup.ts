/**
 * Meeting Setup tRPC Procedures
 * Endpoints for generating probing questions and meeting checklist
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getMeetingSetupService } from '../../../services/meeting-setup.service';

const probingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  customAnswer: z.string().optional(),
});

export const meetingSetupRouter = router({
  generateProbingQuestions: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Meeting name is required'),
        description: z.string().min(1, 'Meeting description is required'),
      })
    )
    .mutation(async ({ input }) => {
      const service = getMeetingSetupService();
      return service.generateProbingQuestions(input.name, input.description);
    }),

  generateChecklist: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        questions: z.array(probingQuestionSchema),
      })
    )
    .mutation(async ({ input }) => {
      const service = getMeetingSetupService();
      return service.generateChecklist(input.name, input.description, input.questions);
    }),
});
