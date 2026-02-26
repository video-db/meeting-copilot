import { create } from 'zustand';

export interface TranscriptItem {
  id: string;
  text: string;
  source: 'mic' | 'system_audio';
  isFinal: boolean;
  timestamp: number;
}

interface TranscriptionState {
  items: TranscriptItem[];
  enabled: boolean;
  pendingMic: string;
  pendingSystemAudio: string;

  // Actions
  addItem: (item: Omit<TranscriptItem, 'id' | 'timestamp'>) => void;
  updatePending: (source: 'mic' | 'system_audio', text: string) => void;
  finalizePending: (source: 'mic' | 'system_audio', text: string) => void;
  setEnabled: (enabled: boolean) => void;
  clear: () => void;
}

let itemIdCounter = 0;

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
  items: [],
  enabled: true,
  pendingMic: '',
  pendingSystemAudio: '',

  addItem: (item) => {
    const newItem: TranscriptItem = {
      ...item,
      id: `transcript-${++itemIdCounter}`,
      timestamp: Date.now(),
    };

    set((state) => ({
      items: [...state.items, newItem],
    }));
  },

  updatePending: (source, text) => {
    if (source === 'mic') {
      set({ pendingMic: text });
    } else {
      set({ pendingSystemAudio: text });
    }
  },

  finalizePending: (source, text) => {
    const newItem: TranscriptItem = {
      id: `transcript-${++itemIdCounter}`,
      text,
      source,
      isFinal: true,
      timestamp: Date.now(),
    };

    set((state) => ({
      items: [...state.items, newItem],
      ...(source === 'mic' ? { pendingMic: '' } : { pendingSystemAudio: '' }),
    }));
  },

  setEnabled: (enabled) => set({ enabled }),

  clear: () => {
    set({
      items: [],
      pendingMic: '',
      pendingSystemAudio: '',
    });
  },
}));
