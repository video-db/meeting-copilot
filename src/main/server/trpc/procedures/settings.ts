/**
 * Settings Procedures
 *
 * tRPC procedures for managing copilot settings, cue cards, and playbooks.
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import {
  getAllCueCards,
  getCueCardsByType,
  createCueCard,
  updateCueCard,
  deleteCueCard,
  getAllPlaybooks,
  getPlaybookById,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  setDefaultPlaybook,
  getAllSettings,
  getSettingsByCategory,
  getSetting,
  upsertSetting,
} from '../../../db';
import { v4 as uuid } from 'uuid';

// Input Schemas

const cueCardSchema = z.object({
  objectionType: z.enum(['pricing', 'timing', 'competitor', 'authority', 'security', 'integration', 'not_interested', 'send_info']),
  title: z.string().min(1),
  talkTracks: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  proofPoints: z.array(z.string()).optional(),
  avoidSaying: z.array(z.string()).optional(),
  sourceDoc: z.string().optional(),
});

const playbookItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  suggestedQuestions: z.array(z.string()),
  detectionPrompt: z.string().optional(),
});

const playbookSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['MEDDIC', 'Challenger', 'SPIN', 'Custom']),
  description: z.string().optional(),
  items: z.array(playbookItemSchema),
});

const settingSchema = z.object({
  key: z.string(),
  value: z.string(),
  category: z.enum(['prompt', 'config', 'threshold']),
  label: z.string(),
  description: z.string().optional(),
});

// Router

export const settingsRouter = router({
  // -------------------------------------------------------------------------
  // Cue Cards
  // -------------------------------------------------------------------------

  getCueCards: protectedProcedure.query(async () => {
    const cards = getAllCueCards();
    return cards.map(card => ({
      ...card,
      talkTracks: JSON.parse(card.talkTracks),
      followUpQuestions: JSON.parse(card.followUpQuestions),
      proofPoints: card.proofPoints ? JSON.parse(card.proofPoints) : [],
      avoidSaying: card.avoidSaying ? JSON.parse(card.avoidSaying) : [],
    }));
  }),

  getCueCardsByType: protectedProcedure
    .input(z.object({ type: z.string() }))
    .query(async ({ input }) => {
      const cards = getCueCardsByType(input.type);
      return cards.map(card => ({
        ...card,
        talkTracks: JSON.parse(card.talkTracks),
        followUpQuestions: JSON.parse(card.followUpQuestions),
        proofPoints: card.proofPoints ? JSON.parse(card.proofPoints) : [],
        avoidSaying: card.avoidSaying ? JSON.parse(card.avoidSaying) : [],
      }));
    }),

  createCueCard: protectedProcedure
    .input(cueCardSchema)
    .mutation(async ({ input }) => {
      const card = createCueCard({
        id: `cue-${uuid()}`,
        objectionType: input.objectionType,
        title: input.title,
        talkTracks: JSON.stringify(input.talkTracks),
        followUpQuestions: JSON.stringify(input.followUpQuestions),
        proofPoints: input.proofPoints ? JSON.stringify(input.proofPoints) : null,
        avoidSaying: input.avoidSaying ? JSON.stringify(input.avoidSaying) : null,
        sourceDoc: input.sourceDoc || null,
        isDefault: false,
      });
      return {
        ...card,
        talkTracks: input.talkTracks,
        followUpQuestions: input.followUpQuestions,
        proofPoints: input.proofPoints || [],
        avoidSaying: input.avoidSaying || [],
      };
    }),

  updateCueCard: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: cueCardSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.data.objectionType) updateData.objectionType = input.data.objectionType;
      if (input.data.title) updateData.title = input.data.title;
      if (input.data.talkTracks) updateData.talkTracks = JSON.stringify(input.data.talkTracks);
      if (input.data.followUpQuestions) updateData.followUpQuestions = JSON.stringify(input.data.followUpQuestions);
      if (input.data.proofPoints !== undefined) updateData.proofPoints = JSON.stringify(input.data.proofPoints);
      if (input.data.avoidSaying !== undefined) updateData.avoidSaying = JSON.stringify(input.data.avoidSaying);
      if (input.data.sourceDoc !== undefined) updateData.sourceDoc = input.data.sourceDoc;

      const card = updateCueCard(input.id, updateData as any);
      return card ? {
        ...card,
        talkTracks: JSON.parse(card.talkTracks),
        followUpQuestions: JSON.parse(card.followUpQuestions),
        proofPoints: card.proofPoints ? JSON.parse(card.proofPoints) : [],
        avoidSaying: card.avoidSaying ? JSON.parse(card.avoidSaying) : [],
      } : null;
    }),

  deleteCueCard: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      deleteCueCard(input.id);
      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Playbooks
  // -------------------------------------------------------------------------

  getPlaybooks: protectedProcedure.query(async () => {
    const playbooks = getAllPlaybooks();
    return playbooks.map(pb => ({
      ...pb,
      items: JSON.parse(pb.items),
    }));
  }),

  getPlaybook: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const playbook = getPlaybookById(input.id);
      return playbook ? {
        ...playbook,
        items: JSON.parse(playbook.items),
      } : null;
    }),

  createPlaybook: protectedProcedure
    .input(playbookSchema)
    .mutation(async ({ input }) => {
      const playbook = createPlaybook({
        id: `playbook-${uuid()}`,
        name: input.name,
        type: input.type,
        description: input.description || null,
        items: JSON.stringify(input.items.map(item => ({
          ...item,
          status: 'missing',
          evidence: [],
        }))),
        isDefault: false,
      });
      return {
        ...playbook,
        items: input.items,
      };
    }),

  updatePlaybook: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: playbookSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.data.name) updateData.name = input.data.name;
      if (input.data.type) updateData.type = input.data.type;
      if (input.data.description !== undefined) updateData.description = input.data.description;
      if (input.data.items) {
        updateData.items = JSON.stringify(input.data.items.map(item => ({
          ...item,
          status: 'missing',
          evidence: [],
        })));
      }

      const playbook = updatePlaybook(input.id, updateData as any);
      return playbook ? {
        ...playbook,
        items: JSON.parse(playbook.items),
      } : null;
    }),

  deletePlaybook: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      deletePlaybook(input.id);
      return { success: true };
    }),

  setDefaultPlaybook: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const playbook = setDefaultPlaybook(input.id);
      return playbook ? {
        ...playbook,
        items: JSON.parse(playbook.items),
      } : null;
    }),

  // -------------------------------------------------------------------------
  // Settings (Prompts, Thresholds, Config)
  // -------------------------------------------------------------------------

  getSettings: protectedProcedure.query(async () => {
    return getAllSettings();
  }),

  getSettingsByCategory: protectedProcedure
    .input(z.object({ category: z.enum(['prompt', 'config', 'threshold']) }))
    .query(async ({ input }) => {
      return getSettingsByCategory(input.category);
    }),

  getSetting: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      return getSetting(input.key);
    }),

  updateSetting: protectedProcedure
    .input(settingSchema)
    .mutation(async ({ input }) => {
      return upsertSetting(input);
    }),

  updateSettings: protectedProcedure
    .input(z.array(settingSchema))
    .mutation(async ({ input }) => {
      const results = [];
      for (const setting of input) {
        results.push(upsertSetting(setting));
      }
      return results;
    }),
});
