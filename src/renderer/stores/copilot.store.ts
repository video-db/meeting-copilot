/**
 * Meeting Co-Pilot Store
 *
 * Centralized state management for all Meeting Co-Pilot features:
 * - Conversation metrics
 * - Sentiment tracking
 * - Cue cards
 * - Playbook progress
 * - Nudges
 * - Call summary
 */

import { create } from 'zustand';
import type {
  CopilotMetrics,
  CopilotSentiment,
  CopilotNudge,
  CopilotCueCard,
  CopilotPlaybookItem,
  CopilotPlaybookSnapshot,
  CopilotCallSummary,
  CopilotConfig,
  CopilotTranscriptSegment,
} from '../../shared/types/ipc.types';

// Types

export interface CopilotState {
  // Configuration
  config: CopilotConfig;
  isInitialized: boolean;
  isCallActive: boolean;
  recordingId: number | null;

  // Metrics
  metrics: CopilotMetrics | null;
  healthScore: number;

  // Sentiment
  sentiment: CopilotSentiment | null;

  // Cue Cards
  activeCueCards: CopilotCueCard[];
  pinnedCueCards: CopilotCueCard[];
  dismissedCueCardIds: Set<string>;

  // Playbook
  playbook: CopilotPlaybookSnapshot | null;
  selectedPlaybookId: string | null;

  // Nudges
  activeNudge: CopilotNudge | null;
  nudgeHistory: CopilotNudge[];

  // Call Summary
  callSummary: CopilotCallSummary | null;
  callDuration: number;

  // Transcript segments (for UI display with copilot annotations)
  transcriptSegments: CopilotTranscriptSegment[];

  // Actions
  setConfig: (config: Partial<CopilotConfig>) => void;
  setInitialized: (value: boolean) => void;
  startCall: (recordingId: number) => void;
  endCall: () => void;

  // Metrics actions
  setMetrics: (metrics: CopilotMetrics, health: number) => void;

  // Sentiment actions
  setSentiment: (sentiment: CopilotSentiment) => void;

  // Cue card actions
  addCueCard: (cueCard: CopilotCueCard) => void;
  dismissCueCard: (triggerId: string) => void;
  pinCueCard: (triggerId: string) => void;
  clearCueCards: () => void;

  // Playbook actions
  setPlaybook: (playbook: CopilotPlaybookSnapshot) => void;
  updatePlaybookItem: (item: CopilotPlaybookItem) => void;
  setSelectedPlaybook: (id: string | null) => void;

  // Nudge actions
  setNudge: (nudge: CopilotNudge) => void;
  dismissNudge: () => void;

  // Summary actions
  setCallSummary: (summary: CopilotCallSummary, duration: number) => void;

  // Transcript actions
  addTranscriptSegment: (segment: CopilotTranscriptSegment) => void;
  clearTranscripts: () => void;

  // Reset
  reset: () => void;
}

// Initial State

const initialConfig: CopilotConfig = {
  enableTranscription: true,
  enableMetrics: true,
  enableSentiment: true,
  enableNudges: true,
  enableCueCards: true,
  enablePlaybook: true,
  useLLMForDetection: false,
};

const initialState = {
  config: initialConfig,
  isInitialized: false,
  isCallActive: false,
  recordingId: null,
  metrics: null,
  healthScore: 100,
  sentiment: null,
  activeCueCards: [],
  pinnedCueCards: [],
  dismissedCueCardIds: new Set<string>(),
  playbook: null,
  selectedPlaybookId: null,
  activeNudge: null,
  nudgeHistory: [],
  callSummary: null,
  callDuration: 0,
  transcriptSegments: [],
};

// Store

export const useCopilotStore = create<CopilotState>((set, get) => ({
  ...initialState,

  // Configuration
  setConfig: (config) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  setInitialized: (value) => set({ isInitialized: value }),

  startCall: (recordingId) => {
    set({
      isCallActive: true,
      recordingId,
      metrics: null,
      healthScore: 100,
      sentiment: null,
      activeCueCards: [],
      pinnedCueCards: [],
      dismissedCueCardIds: new Set(),
      playbook: null,
      activeNudge: null,
      nudgeHistory: [],
      callSummary: null,
      callDuration: 0,
      transcriptSegments: [],
    });
  },

  endCall: () => {
    set({
      isCallActive: false,
      activeNudge: null,
    });
  },

  // Metrics
  setMetrics: (metrics, health) => {
    set({ metrics, healthScore: health });
  },

  // Sentiment
  setSentiment: (sentiment) => {
    set({ sentiment });
  },

  // Cue Cards
  addCueCard: (cueCard) => {
    const { dismissedCueCardIds, activeCueCards } = get();

    // Don't add if already dismissed
    if (dismissedCueCardIds.has(cueCard.triggerId)) {
      return;
    }

    // Check if already exists
    const exists = activeCueCards.some(c => c.triggerId === cueCard.triggerId);
    if (exists) {
      return;
    }

    set((state) => ({
      activeCueCards: [...state.activeCueCards, cueCard],
    }));
  },

  dismissCueCard: (triggerId) => {
    set((state) => {
      const newDismissed = new Set(state.dismissedCueCardIds);
      newDismissed.add(triggerId);

      return {
        activeCueCards: state.activeCueCards.filter(c => c.triggerId !== triggerId),
        pinnedCueCards: state.pinnedCueCards.filter(c => c.triggerId !== triggerId),
        dismissedCueCardIds: newDismissed,
      };
    });
  },

  pinCueCard: (triggerId) => {
    set((state) => {
      const card = state.activeCueCards.find(c => c.triggerId === triggerId);
      if (!card) return state;

      const pinnedCard = { ...card, status: 'pinned' as const };

      return {
        activeCueCards: state.activeCueCards.filter(c => c.triggerId !== triggerId),
        pinnedCueCards: [...state.pinnedCueCards, pinnedCard],
      };
    });
  },

  clearCueCards: () => {
    set({
      activeCueCards: [],
      pinnedCueCards: [],
      dismissedCueCardIds: new Set(),
    });
  },

  // Playbook
  setPlaybook: (playbook) => {
    set({ playbook });
  },

  updatePlaybookItem: (item) => {
    set((state) => {
      if (!state.playbook) return state;

      const updatedItems = state.playbook.items.map(i =>
        i.id === item.id ? item : i
      );

      const covered = updatedItems.filter(i => i.status === 'covered').length;
      const partial = updatedItems.filter(i => i.status === 'partial').length;
      const missing = updatedItems.filter(i => i.status === 'missing').length;
      const total = updatedItems.length;

      return {
        playbook: {
          ...state.playbook,
          items: updatedItems,
          covered,
          partial,
          missing,
          coveragePercentage: total > 0 ? Math.round(((covered + partial * 0.5) / total) * 100) : 0,
        },
      };
    });
  },

  setSelectedPlaybook: (id) => {
    set({ selectedPlaybookId: id });
  },

  // Nudges
  setNudge: (nudge) => {
    set((state) => ({
      activeNudge: nudge,
      nudgeHistory: [...state.nudgeHistory, nudge],
    }));
  },

  dismissNudge: () => {
    set({ activeNudge: null });
  },

  // Summary
  setCallSummary: (summary, duration) => {
    set({ callSummary: summary, callDuration: duration });
  },

  // Transcripts
  addTranscriptSegment: (segment) => {
    set((state) => ({
      transcriptSegments: [...state.transcriptSegments.slice(-200), segment], // Keep last 200
    }));
  },

  clearTranscripts: () => {
    set({ transcriptSegments: [] });
  },

  // Reset
  reset: () => {
    set({
      ...initialState,
      dismissedCueCardIds: new Set(),
    });
  },
}));

// Selectors (for optimized re-renders)

export const selectMetrics = (state: CopilotState) => state.metrics;
export const selectSentiment = (state: CopilotState) => state.sentiment;
export const selectActiveCueCards = (state: CopilotState) => state.activeCueCards;
export const selectPinnedCueCards = (state: CopilotState) => state.pinnedCueCards;
export const selectPlaybook = (state: CopilotState) => state.playbook;
export const selectActiveNudge = (state: CopilotState) => state.activeNudge;
export const selectCallSummary = (state: CopilotState) => state.callSummary;
export const selectIsCallActive = (state: CopilotState) => state.isCallActive;
export const selectConfig = (state: CopilotState) => state.config;
export const selectHealthScore = (state: CopilotState) => state.healthScore;
