import { create } from 'zustand';

export type SessionStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'processing';

interface StreamState {
  microphone: boolean;
  systemAudio: boolean;
  screen: boolean;
}

interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  sessionToken: string | null;
  tokenExpiresAt: number | null;
  startTime: number | null;
  elapsedTime: number;
  streams: StreamState;
  error: string | null;

  // Actions
  setStatus: (status: SessionStatus) => void;
  startSession: (sessionId: string, sessionToken: string, expiresAt: number) => void;
  stopSession: () => void;
  setSessionToken: (token: string, expiresAt: number) => void;
  setElapsedTime: (time: number) => void;
  toggleStream: (stream: keyof StreamState) => void;
  setStreams: (streams: Partial<StreamState>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  isTokenExpired: () => boolean;
}

const initialStreams: StreamState = {
  microphone: true,
  systemAudio: true,
  screen: true,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  sessionId: null,
  sessionToken: null,
  tokenExpiresAt: null,
  startTime: null,
  elapsedTime: 0,
  streams: initialStreams,
  error: null,

  setStatus: (status) => set({ status }),

  startSession: (sessionId, sessionToken, expiresAt) => {
    set({
      status: 'recording',
      sessionId,
      sessionToken,
      tokenExpiresAt: expiresAt,
      startTime: Date.now(),
      elapsedTime: 0,
      error: null,
    });
  },

  stopSession: () => {
    set({
      status: 'idle',
      sessionId: null,
      startTime: null,
      elapsedTime: 0,
    });
  },

  setSessionToken: (token, expiresAt) => {
    set({
      sessionToken: token,
      tokenExpiresAt: expiresAt,
    });
  },

  setElapsedTime: (time) => set({ elapsedTime: time }),

  toggleStream: (stream) => {
    const currentStreams = get().streams;
    set({
      streams: {
        ...currentStreams,
        [stream]: !currentStreams[stream],
      },
    });
  },

  setStreams: (streams) => {
    set({
      streams: {
        ...get().streams,
        ...streams,
      },
    });
  },

  setError: (error) => set({ error }),

  reset: () => {
    set({
      status: 'idle',
      sessionId: null,
      startTime: null,
      elapsedTime: 0,
      streams: initialStreams,
      error: null,
    });
  },

  isTokenExpired: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return true;
    // Consider expired if less than 5 minutes remaining
    const bufferSeconds = 5 * 60;
    return Date.now() / 1000 > tokenExpiresAt - bufferSeconds;
  },
}));
