import { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/session.store';
import { useTranscriptionStore } from '../stores/transcription.store';
import { useVisualIndexStore } from '../stores/visual-index.store';
import { useCopilotStore } from '../stores/copilot.store';
import { getElectronAPI } from '../api/ipc';
import type { RecorderEvent, TranscriptEvent, VisualIndexEvent } from '../../shared/types/ipc.types';

/**
 * Global hook to listen for recorder events from the main process.
 * This should be called ONCE at the App level to ensure transcript events
 * are captured even when navigating between pages.
 */
export function useGlobalRecorderEvents() {
  const sessionStore = useSessionStore();
  const transcriptionStore = useTranscriptionStore();
  const visualIndexStore = useVisualIndexStore();

  // Use refs to avoid re-subscribing when stores change
  const sessionStoreRef = useRef(sessionStore);
  const transcriptionStoreRef = useRef(transcriptionStore);
  const visualIndexStoreRef = useRef(visualIndexStore);

  // Keep refs updated
  useEffect(() => {
    sessionStoreRef.current = sessionStore;
  }, [sessionStore]);

  useEffect(() => {
    transcriptionStoreRef.current = transcriptionStore;
  }, [transcriptionStore]);

  useEffect(() => {
    visualIndexStoreRef.current = visualIndexStore;
  }, [visualIndexStore]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;

    console.log('[Global] Setting up recorder event listener');

    const unsubscribe = api.on.recorderEvent((event: RecorderEvent) => {
      const session = sessionStoreRef.current;
      const transcription = transcriptionStoreRef.current;
      const visualIndex = visualIndexStoreRef.current;

      console.log('[GlobalRecorderEvents] Event received:', event.event, event.data);

      switch (event.event) {
        case 'recording:started':
          console.log('[GlobalRecorderEvents] Recording started, setting status to recording');
          session.setStatus('recording');
          break;

        case 'recording:stopped':
          console.log('[GlobalRecorderEvents] Recording stopped, setting status to processing');
          session.setStatus('processing');
          break;

        case 'recording:error':
          console.error('[GlobalRecorderEvents] Recording error:', event.data);
          session.setError(String(event.data));
          session.setStatus('idle');
          break;

        case 'transcript':
          if (event.data && transcription.enabled) {
            const transcript = event.data as TranscriptEvent;
            if (transcript.isFinal) {
              transcription.finalizePending(transcript.source, transcript.text);
            } else {
              transcription.updatePending(transcript.source, transcript.text);
            }

            // Forward transcript to copilot backend (for final segments only)
            const currentApi = getElectronAPI();
            if (transcript.isFinal && currentApi) {
              // Forward to copilot if active
              if (useCopilotStore.getState().isCallActive) {
                const channel: 'me' | 'them' = transcript.source === 'mic' ? 'me' : 'them';
                currentApi.copilot.sendTranscript(channel, {
                  text: transcript.text,
                  is_final: true,
                  start: transcript.start,
                  end: transcript.end,
                }).catch((err: Error) => {
                  console.warn('[GlobalRecorderEvents] Error forwarding transcript to copilot:', err);
                });
              }

              // Forward to live assist service for real-time analysis
              currentApi.liveAssist.addTranscript(transcript.text, transcript.source).catch((err: Error) => {
                console.warn('[GlobalRecorderEvents] Error forwarding transcript to live assist:', err);
              });
            }
          }
          break;

        case 'visual_index':
          if (event.data && visualIndex.enabled) {
            const visualData = event.data as VisualIndexEvent;
            visualIndex.addItem({
              text: visualData.text,
              start: visualData.start,
              end: visualData.end,
              rtstreamId: visualData.rtstreamId,
              rtstreamName: visualData.rtstreamName,
            });
          }
          break;

        case 'upload:progress':
          console.log('[GlobalRecorderEvents] Upload progress:', event.data);
          break;

        case 'upload:complete':
          // Don't reset session here - let stopRecording() handle the transition
          // after copilot summary generation completes
          console.log('[GlobalRecorderEvents] Upload complete (stopRecording will handle state transition)');
          break;

        case 'error':
          console.error('[GlobalRecorderEvents] Error:', event.data);
          session.setError(String(event.data));
          break;
      }
    });

    // Only unsubscribe when the entire app unmounts (which shouldn't happen during normal use)
    return () => {
      console.log('[Global] Cleaning up recorder event listener');
      unsubscribe();
    };
  }, []); // Empty deps - only run once on mount
}
