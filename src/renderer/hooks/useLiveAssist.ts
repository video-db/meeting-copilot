/**
 * useLiveAssist Hook
 *
 * Manages the live assist feature lifecycle and subscribes to
 * assist updates from the main process.
 */

import { useEffect, useRef } from 'react';
import { useLiveAssistStore } from '../stores/live-assist.store';
import { useSessionStore } from '../stores/session.store';
import { getElectronAPI } from '../api/ipc';
import type { LiveAssistItem } from '../../shared/types/live-assist.types';

export function useLiveAssist() {
  const store = useLiveAssistStore();
  const { status } = useSessionStore();
  const isRecording = status === 'recording';
  const wasRecordingRef = useRef(false);

  // Start/stop live assist based on recording state
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;

    if (isRecording && !wasRecordingRef.current) {
      // Recording just started
      console.log('[LiveAssist] Starting live assist service');
      api.liveAssist.start().catch(err => {
        console.error('[LiveAssist] Failed to start:', err);
      });
      wasRecordingRef.current = true;
    } else if (!isRecording && wasRecordingRef.current) {
      // Recording just stopped
      console.log('[LiveAssist] Stopping live assist service');
      api.liveAssist.stop().catch(err => {
        console.error('[LiveAssist] Failed to stop:', err);
      });
      store.clear();
      wasRecordingRef.current = false;
    }
  }, [isRecording, store]);

  // Subscribe to live assist updates
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;

    console.log('[LiveAssist] Setting up event listener');

    const unsubscribe = api.liveAssistOn.onUpdate((event) => {
      console.log('[LiveAssist] Received assists:', event.assists.length);
      const assists = event.assists as LiveAssistItem[];
      store.addAssists(assists);
    });

    return () => {
      console.log('[LiveAssist] Cleaning up event listener');
      unsubscribe();
    };
  }, [store]);

  return {
    assists: store.assists,
    isProcessing: store.isProcessing,
    lastProcessedAt: store.lastProcessedAt,
    error: store.error,
    clear: store.clear,
  };
}

export default useLiveAssist;
