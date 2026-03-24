import { useEffect, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/session.store';
import { useTranscriptionStore } from '../stores/transcription.store';
import { useVisualIndexStore } from '../stores/visual-index.store';
import { useConfigStore } from '../stores/config.store';
import { useCopilotStore } from '../stores/copilot.store';
import { useMCPStore } from '../stores/mcp.store';
import { useMeetingSetupStore } from '../stores/meeting-setup.store';
import { trpc } from '../api/trpc';
import { getElectronAPI } from '../api/ipc';
import type { ProbingQuestion } from '../../shared/types/meeting-setup.types';

interface MeetingSetupData {
  name: string;
  description: string;
  questions: ProbingQuestion[];
  checklist: string[];
}

export function useSession() {
  const sessionStore = useSessionStore();
  const transcriptionStore = useTranscriptionStore();
  const configStore = useConfigStore();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateTokenMutation = trpc.token.generate.useMutation();
  const createSessionMutation = trpc.capture.createSession.useMutation();
  const startRecordingMutation = trpc.recordings.start.useMutation();
  const stopRecordingMutation = trpc.recordings.stop.useMutation();
  const startTranscriptionMutation = trpc.transcription.start.useMutation();

  // Recorder events are global to prevent transcript loss on navigation.

  useEffect(() => {
    if (sessionStore.status === 'recording' && sessionStore.startTime) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStore.startTime!) / 1000);
        sessionStore.setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionStore.status, sessionStore.startTime]);

  const startRecording = useCallback(async (meetingSetup?: MeetingSetupData) => {
    const api = getElectronAPI();
    if (!api) {
      sessionStore.setError('Electron API not available');
      return;
    }

    const accessToken = configStore.accessToken;
    const apiUrl = configStore.apiUrl;

    if (!accessToken) {
      sessionStore.setError('Not authenticated. Please log in first.');
      return;
    }

    sessionStore.setStatus('starting');
    transcriptionStore.clear();
    useVisualIndexStore.getState().clear();
    useMCPStore.getState().clearResults();

    try {
      let sessionToken = sessionStore.sessionToken;
      let tokenExpiresAt = sessionStore.tokenExpiresAt;

      if (sessionStore.isTokenExpired()) {
        const tokenResult = await generateTokenMutation.mutateAsync({});
        sessionToken = tokenResult.sessionToken;
        tokenExpiresAt = tokenResult.expiresAt;
        sessionStore.setSessionToken(sessionToken, tokenExpiresAt);
      }

      if (!sessionToken) {
        throw new Error('Failed to get session token');
      }

      const captureSession = await createSessionMutation.mutateAsync({});

      const streamsConfig = {
        microphone: sessionStore.streams.microphone,
        systemAudio: sessionStore.streams.systemAudio,
        screen: sessionStore.streams.screen,
      };

      if (!streamsConfig.microphone && !streamsConfig.systemAudio && !streamsConfig.screen) {
        throw new Error('No streams enabled for recording');
      }

      const result = await api.capture.startRecording({
        config: {
          sessionId: captureSession.sessionId,
          streams: streamsConfig,
        },
        sessionToken,
        accessToken,
        apiUrl: apiUrl || undefined,
        enableTranscription: transcriptionStore.enabled,
        // Always create screen WebSocket when screen is enabled - user controls indexing via toggle
        enableVisualIndex: streamsConfig.screen,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording');
      }

      // Start recording with meeting setup data if provided
      const recordingResult = await startRecordingMutation.mutateAsync({
        sessionId: captureSession.sessionId,
        meetingName: meetingSetup?.name,
        meetingDescription: meetingSetup?.description,
        probingQuestions: meetingSetup?.questions,
        meetingChecklist: meetingSetup?.checklist,
      });

      const hasTranscription = transcriptionStore.enabled && (result.micWsConnectionId || result.sysAudioWsConnectionId);
      const hasVisualIndex = useVisualIndexStore.getState().enabled && result.screenWsConnectionId;

      if (hasTranscription || hasVisualIndex) {
        await startTranscriptionMutation.mutateAsync({
          sessionId: captureSession.sessionId,
          micWsConnectionId: transcriptionStore.enabled ? result.micWsConnectionId : undefined,
          sysAudioWsConnectionId: transcriptionStore.enabled ? result.sysAudioWsConnectionId : undefined,
          screenWsConnectionId: hasVisualIndex ? result.screenWsConnectionId : undefined,
        });
      }

      if (transcriptionStore.enabled && recordingResult?.id) {
        try {
          const copilotResult = await api.copilot.startCall(
            recordingResult.id,
            captureSession.sessionId
          );
          if (copilotResult.success) {
            useCopilotStore.getState().startCall(recordingResult.id);
          }
        } catch (copilotError) {
          // Ignore copilot errors
        }
      }

      sessionStore.startSession(captureSession.sessionId, sessionToken!, tokenExpiresAt!, result.screenWsConnectionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';

      if (errorMessage.includes('logged in') || errorMessage.includes('UNAUTHORIZED')) {
        configStore.clearAuth();
        sessionStore.setError('Session expired. Please log in again.');
      } else {
        sessionStore.setError(errorMessage);
      }
      sessionStore.setStatus('idle');
    }
  }, [
    sessionStore,
    transcriptionStore,
    configStore,
    generateTokenMutation,
    createSessionMutation,
    startRecordingMutation,
    startTranscriptionMutation,
  ]);

  const stopRecording = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) return;

    sessionStore.setStatus('stopping');

    try {
      const result = await api.capture.stopRecording();

      if (!result.success) {
        throw new Error(result.error || 'Failed to stop recording');
      }

      useMCPStore.getState().clearResults();

      if (sessionStore.sessionId) {
        await stopRecordingMutation.mutateAsync({
          sessionId: sessionStore.sessionId,
        });
      }

      if (useCopilotStore.getState().isCallActive) {
        try {
          const copilotResult = await api.copilot.endCall();
          if (copilotResult.success && copilotResult.summary) {
            const duration = useCopilotStore.getState().callDuration || 0;
            useCopilotStore.getState().setCallSummary(copilotResult.summary, duration);
          }
        } catch (copilotError) {
          // Ignore copilot errors
        }
      }

      transcriptionStore.clear();
      useVisualIndexStore.getState().clear();

      const copilotState = useCopilotStore.getState();
      if (!copilotState.callSummary) {
        copilotState.reset();
      } else {
        copilotState.endCall();
      }

      // Transition session to idle now that all work (including copilot) is complete
      sessionStore.setElapsedTime(0);
      sessionStore.stopSession();
    } catch (error) {
      sessionStore.setError(error instanceof Error ? error.message : 'Failed to stop recording');
      sessionStore.stopSession();

      transcriptionStore.clear();
      useVisualIndexStore.getState().clear();
      useCopilotStore.getState().reset();
    }
  }, [sessionStore, transcriptionStore, stopRecordingMutation]);

  const toggleStream = useCallback(
    async (stream: 'microphone' | 'systemAudio' | 'screen') => {
      const api = getElectronAPI();
      if (!api) return;

      const currentState = sessionStore.streams[stream];
      sessionStore.toggleStream(stream);

      if (sessionStore.status === 'recording') {
        const channelIdMap: Record<string, string> = {
          microphone: 'mic',
          systemAudio: 'system_audio',
          screen: 'screen',
        };
        const channelId = channelIdMap[stream];

        if (channelId) {
          if (currentState) {
            await api.capture.pauseTracks([channelId]);
          } else {
            await api.capture.resumeTracks([channelId]);
          }
        }
      }
    },
    [sessionStore]
  );

  const pauseRecording = useCallback(async () => {
    const api = getElectronAPI();
    if (!api || sessionStore.status !== 'recording') return;

    await api.capture.pauseTracks(['mic', 'system_audio', 'screen']);
    sessionStore.setPaused(true);
  }, [sessionStore]);

  const resumeRecording = useCallback(async () => {
    const api = getElectronAPI();
    if (!api || sessionStore.status !== 'recording') return;

    await api.capture.resumeTracks(['mic', 'system_audio', 'screen']);
    sessionStore.setPaused(false);
  }, [sessionStore]);

  return {
    ...sessionStore,
    startRecording,
    stopRecording,
    toggleStream,
    pauseRecording,
    resumeRecording,
    isRecording: sessionStore.status === 'recording',
    isStarting: sessionStore.status === 'starting',
    isStopping: sessionStore.status === 'stopping',
  };
}
