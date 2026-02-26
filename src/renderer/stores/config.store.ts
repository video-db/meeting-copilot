import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  accessToken: string | null;
  userName: string | null;
  apiKey: string | null;
  apiUrl: string | null;
  webhookUrl: string | null;

  setAuth: (accessToken: string, userName: string, apiKey: string) => void;
  setConfig: (config: Partial<ConfigState>) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      userName: null,
      apiKey: null,
      apiUrl: null,
      webhookUrl: null,

      setAuth: (accessToken, userName, apiKey) => {
        set({ accessToken, userName, apiKey });
      },

      setConfig: (config) => {
        set(config);
      },

      clearAuth: () => {
        set({
          accessToken: null,
          userName: null,
          apiKey: null,
        });
      },

      isAuthenticated: () => {
        return !!get().accessToken;
      },
    }),
    {
      name: 'meeting-copilot-config',
      partialize: (state) => ({
        accessToken: state.accessToken,
        userName: state.userName,
        apiKey: state.apiKey,
      }),
    }
  )
);
