/**
 * useCopilot Hook
 *
 * Provides integration between the Meeting Co-Pilot backend and React components.
 * Handles IPC event subscriptions and state synchronization.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useCopilotStore } from '../stores/copilot.store';
import { useConfigStore } from '../stores/config.store';

// Hook

export function useCopilot() {
  const {
    config,
    isInitialized,
    isCallActive,
    recordingId,
    metrics,
    healthScore,
    sentiment,
    activeCueCards,
    pinnedCueCards,
    playbook,
    activeNudge,
    callSummary,
    callDuration,
    setConfig,
    setInitialized,
    startCall,
    endCall,
    setMetrics,
    setSentiment,
    addCueCard,
    dismissCueCard,
    pinCueCard,
    setPlaybook,
    updatePlaybookItem,
    setNudge,
    dismissNudge,
    setCallSummary,
    addTranscriptSegment,
    reset,
  } = useCopilotStore();

  const { apiKey } = useConfigStore();
  const unsubscribersRef = useRef<Array<() => void>>([]);

  /**
   * Initialize copilot with API key
   */
  const initialize = useCallback(async () => {
    if (!apiKey || isInitialized) return;

    try {
      const result = await window.electronAPI.copilot.initialize(apiKey);
      if (result.success) {
        setInitialized(true);
      } else {
        console.error('Failed to initialize copilot:', result.error);
      }
    } catch (error) {
      console.error('Error initializing copilot:', error);
    }
  }, [apiKey, isInitialized, setInitialized]);

  /**
   * Start copilot for a call
   */
  const startCopilot = useCallback(async (recId: number, sessionId: string) => {
    if (!isInitialized) {
      await initialize();
    }

    try {
      const result = await window.electronAPI.copilot.startCall(recId, sessionId);
      if (result.success) {
        startCall(recId);
      } else {
        console.error('Failed to start copilot:', result.error);
      }
    } catch (error) {
      console.error('Error starting copilot:', error);
    }
  }, [isInitialized, initialize, startCall]);

  /**
   * End copilot and get summary
   */
  const stopCopilot = useCallback(async () => {
    try {
      const result = await window.electronAPI.copilot.endCall();
      if (result.success && result.summary) {
        // Summary will come through the event listener
      }
      endCall();
    } catch (error) {
      console.error('Error stopping copilot:', error);
      endCall();
    }
  }, [endCall]);

  /**
   * Update copilot configuration
   */
  const updateConfig = useCallback(async (newConfig: Partial<typeof config>) => {
    setConfig(newConfig);
    try {
      await window.electronAPI.copilot.updateConfig(newConfig);
    } catch (error) {
      console.error('Error updating copilot config:', error);
    }
  }, [setConfig]);

  /**
   * Dismiss a cue card
   */
  const handleDismissCueCard = useCallback(async (triggerId: string) => {
    dismissCueCard(triggerId);
    try {
      await window.electronAPI.copilot.dismissCueCard(triggerId);
    } catch (error) {
      console.error('Error dismissing cue card:', error);
    }
  }, [dismissCueCard]);

  /**
   * Pin a cue card
   */
  const handlePinCueCard = useCallback(async (triggerId: string) => {
    pinCueCard(triggerId);
    try {
      await window.electronAPI.copilot.pinCueCard(triggerId);
    } catch (error) {
      console.error('Error pinning cue card:', error);
    }
  }, [pinCueCard]);

  /**
   * Submit cue card feedback
   */
  const submitCueCardFeedback = useCallback(async (
    triggerId: string,
    feedback: 'helpful' | 'wrong' | 'irrelevant'
  ) => {
    try {
      await window.electronAPI.copilot.cueCardFeedback(triggerId, feedback);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  }, []);

  /**
   * Dismiss active nudge
   */
  const handleDismissNudge = useCallback(async () => {
    if (activeNudge) {
      dismissNudge();
      try {
        await window.electronAPI.copilot.dismissNudge(activeNudge.id);
      } catch (error) {
        console.error('Error dismissing nudge:', error);
      }
    }
  }, [activeNudge, dismissNudge]);

  /**
   * Create a bookmark
   */
  const createBookmark = useCallback(async (
    timestamp: number,
    category: string,
    note?: string
  ) => {
    if (!recordingId) return;

    try {
      const result = await window.electronAPI.copilot.createBookmark({
        recordingId,
        timestamp,
        category,
        note,
      });
      return result.success;
    } catch (error) {
      console.error('Error creating bookmark:', error);
      return false;
    }
  }, [recordingId]);

  /**
   * Setup IPC event listeners
   */
  useEffect(() => {
    // Clean up previous listeners
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];

    // Subscribe to copilot events
    const unsubTranscript = window.electronAPI.copilotOn.onTranscript((segment) => {
      addTranscriptSegment(segment);
    });

    const unsubMetrics = window.electronAPI.copilotOn.onMetrics(({ metrics, health }) => {
      setMetrics(metrics, health);
    });

    const unsubSentiment = window.electronAPI.copilotOn.onSentiment(({ sentiment }) => {
      setSentiment(sentiment);
    });

    const unsubNudge = window.electronAPI.copilotOn.onNudge(({ nudge }) => {
      setNudge(nudge);
    });

    const unsubCueCard = window.electronAPI.copilotOn.onCueCard(({ cueCard }) => {
      addCueCard(cueCard);
    });

    const unsubPlaybook = window.electronAPI.copilotOn.onPlaybook(({ item, snapshot }) => {
      setPlaybook(snapshot);
      updatePlaybookItem(item);
    });

    const unsubCallEnded = window.electronAPI.copilotOn.onCallEnded(({ summary, playbook, metrics, duration }) => {
      setCallSummary(summary, duration);
      if (playbook) {
        setPlaybook(playbook);
      }
      setMetrics(metrics, 0);
    });

    const unsubError = window.electronAPI.copilotOn.onError(({ error, context }) => {
      console.error('Copilot error:', error, context);
    });

    unsubscribersRef.current = [
      unsubTranscript,
      unsubMetrics,
      unsubSentiment,
      unsubNudge,
      unsubCueCard,
      unsubPlaybook,
      unsubCallEnded,
      unsubError,
    ];

    return () => {
      unsubscribersRef.current.forEach(unsub => unsub());
    };
  }, [
    addTranscriptSegment,
    setMetrics,
    setSentiment,
    setNudge,
    addCueCard,
    setPlaybook,
    updatePlaybookItem,
    setCallSummary,
  ]);

  /**
   * Initialize on mount if API key is available
   */
  useEffect(() => {
    if (apiKey && !isInitialized) {
      initialize();
    }
  }, [apiKey, isInitialized, initialize]);

  return {
    // State
    config,
    isInitialized,
    isCallActive,
    recordingId,
    metrics,
    healthScore,
    sentiment,
    activeCueCards,
    pinnedCueCards,
    playbook,
    activeNudge,
    callSummary,
    callDuration,

    // Actions
    initialize,
    startCopilot,
    stopCopilot,
    updateConfig,
    dismissCueCard: handleDismissCueCard,
    pinCueCard: handlePinCueCard,
    submitCueCardFeedback,
    dismissNudge: handleDismissNudge,
    createBookmark,
    reset,
  };
}

export default useCopilot;
