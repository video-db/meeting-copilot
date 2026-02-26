import type { IpcApi } from '../shared/types/ipc.types';

declare global {
  interface Window {
    electronAPI: IpcApi;
  }
}

export {};
