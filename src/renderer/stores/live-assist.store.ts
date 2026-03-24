/**
 * Live Assist Store
 *
 * Manages the state for real-time meeting assists generated
 * from transcript analysis every 20 seconds.
 */

import { create } from 'zustand';
import type { LiveAssistItem } from '../../shared/types/live-assist.types';

interface LiveAssistState {
  assists: LiveAssistItem[];
  isProcessing: boolean;
  lastProcessedAt: number | null;
  error: string | null;

  // Actions
  setAssists: (assists: LiveAssistItem[]) => void;
  addAssists: (assists: LiveAssistItem[]) => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useLiveAssistStore = create<LiveAssistState>((set) => ({
  assists: [],
  isProcessing: false,
  lastProcessedAt: null,
  error: null,

  setAssists: (assists) => set({
    assists,
    lastProcessedAt: Date.now(),
    error: null,
  }),

  addAssists: (newAssists) => set((state) => {
    // Deduplicate by text to avoid repeating the same assist
    const existingTexts = new Set(state.assists.map(a => a.text.toLowerCase()));
    const uniqueNewAssists = newAssists.filter(
      a => !existingTexts.has(a.text.toLowerCase())
    );

    // Keep last 10 assists max
    const combined = [...state.assists, ...uniqueNewAssists].slice(-10);

    return {
      assists: combined,
      lastProcessedAt: Date.now(),
      error: null,
    };
  }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  setError: (error) => set({ error, isProcessing: false }),

  clear: () => set({
    assists: [],
    isProcessing: false,
    lastProcessedAt: null,
    error: null,
  }),
}));
