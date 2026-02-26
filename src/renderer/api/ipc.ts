import type { IpcApi } from '../../shared/types/ipc.types';

/**
 * Get the Electron API exposed via the preload script.
 * Always use this function instead of a cached value to ensure the API
 * is available even if the module loads before the preload script runs.
 */
export function getElectronAPI(): IpcApi | null {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI as IpcApi;
  }
  return null;
}

// Deprecated: Use getElectronAPI() instead for reliable access
// This is kept for backwards compatibility but may be null if accessed too early
export const electronAPI = getElectronAPI();
