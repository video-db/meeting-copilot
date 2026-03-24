/**
 * Transcription Panel Component
 *
 * Design matching Figma:
 * - Header with transcript icon and Visual Analysis toggle
 * - Timestamp badges (orange for You, blue for Them)
 * - Visual Analysis entries with blue styling
 * - Gradient overlays at top and bottom
 */

import React, { useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranscriptionStore, TranscriptItem } from '../../stores/transcription.store';
import { useVisualIndexStore, VisualIndexItem } from '../../stores/visual-index.store';
import { useSessionStore } from '../../stores/session.store';
import { trpc } from '../../api/trpc';

// Sparkle icon for Meeting Transcript
function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2.5L11.5 7L16.25 8.125L12.5 11.25L13.125 16.25L10 13.75L6.875 16.25L7.5 11.25L3.75 8.125L8.5 7L10 2.5Z"
        stroke="#EC5B16"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(236, 91, 22, 0.1)"
      />
    </svg>
  );
}

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-[28.8px] h-[16px] rounded-[16px] relative transition-colors ${
        enabled ? 'bg-[#ec5b16]' : 'bg-[#e4e4ec]'
      }`}
    >
      <div
        className={`absolute w-[12px] h-[12px] bg-white rounded-[6px] top-[2px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.15)] transition-all ${
          enabled ? 'left-[14.8px]' : 'left-[2px]'
        }`}
      />
    </button>
  );
}

interface TranscriptMessageProps {
  item: TranscriptItem;
}

function TranscriptMessage({ item }: TranscriptMessageProps) {
  const isMe = item.source === 'mic';

  // Format relative timestamp (MM:SS from recording start)
  const formatRelativeTime = (timestamp: number) => {
    const startTime = useSessionStore.getState().startTime;
    if (!startTime) return '0:00';
    const relativeMs = timestamp - startTime;
    const totalSeconds = Math.max(0, Math.floor(relativeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-[8px]">
      {/* Speaker row */}
      <div className="bg-[#f9fafb] rounded-[10px] px-[8px] py-[6px] flex items-center gap-[12px]">
        {/* Timestamp badge */}
        <div
          className={`px-[8px] py-[4px] rounded-[7px] ${
            isMe ? 'bg-[#ffe9d3]' : 'bg-[rgba(45,140,255,0.2)]'
          }`}
        >
          <span
            className={`font-semibold text-[13px] leading-[16px] ${
              isMe ? 'text-[#ec5b16]' : 'text-[#2d8cff]'
            }`}
          >
            {formatRelativeTime(item.timestamp)}
          </span>
        </div>
        {/* Speaker name */}
        <span className="font-medium text-[13px] text-black leading-[16px]">
          {isMe ? 'You' : 'Them'}
        </span>
      </div>
      {/* Text content */}
      <p className="text-[14px] text-black leading-[22px]">{item.text}</p>
    </div>
  );
}

interface VisualAnalysisEntryProps {
  item: VisualIndexItem;
}

function VisualAnalysisEntry({ item }: VisualAnalysisEntryProps) {
  // Format relative timestamp using when the item was received (same as transcripts)
  const formatRelativeTime = () => {
    const startTime = useSessionStore.getState().startTime;
    if (!startTime) return '0:00';
    const relativeMs = item.timestamp - startTime;
    const totalSeconds = Math.max(0, Math.floor(relativeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#eff6ff] border border-[#5095fb] rounded-[10px] p-[12px] flex flex-col gap-[12px]">
      {/* Header row */}
      <div className="flex items-center gap-[12px]">
        <div className="bg-white px-[8px] py-[4px] rounded-[7px]">
          <span className="font-semibold text-[13px] text-[#5095fb] leading-[16px]">
            {formatRelativeTime()}
          </span>
        </div>
        <span className="font-medium text-[13px] text-black leading-[16px]">Visual Analysis</span>
      </div>
      {/* Content with markdown rendering */}
      <div className="text-[14px] text-black leading-[24px] prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
        <ReactMarkdown>{item.text}</ReactMarkdown>
      </div>
    </div>
  );
}

interface PendingMessageProps {
  text: string;
  source: 'mic' | 'system_audio';
}

function PendingMessage({ text, source }: PendingMessageProps) {
  const isMe = source === 'mic';

  return (
    <div className="flex flex-col gap-[8px] opacity-70">
      {/* Speaker row */}
      <div className="bg-[#f9fafb] rounded-[10px] px-[8px] py-[6px] flex items-center gap-[12px]">
        <div
          className={`px-[8px] py-[4px] rounded-[7px] animate-pulse ${
            isMe ? 'bg-[#ffe9d3]' : 'bg-[rgba(45,140,255,0.2)]'
          }`}
        >
          <span
            className={`font-semibold text-[13px] leading-[16px] ${
              isMe ? 'text-[#ec5b16]' : 'text-[#2d8cff]'
            }`}
          >
            ...
          </span>
        </div>
        <span className="font-medium text-[13px] text-black leading-[16px]">
          {isMe ? 'You' : 'Them'}
        </span>
      </div>
      {/* Text content */}
      <p className="text-[14px] text-black leading-[22px] italic">{text}</p>
    </div>
  );
}

export function TranscriptionPanel() {
  const { items, enabled, pendingMic, pendingSystemAudio } = useTranscriptionStore();
  const visualIndexStore = useVisualIndexStore();
  const { items: visualItems, enabled: visualAnalysisEnabled, isRunning, sceneIndexId } = visualIndexStore;
  const { status, sessionId, screenWsConnectionId } = useSessionStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRecording = status === 'recording';

  // tRPC mutations for visual index control
  const startVisualIndexMutation = trpc.visualIndex.start.useMutation();
  const pauseVisualIndexMutation = trpc.visualIndex.pause.useMutation();
  const resumeVisualIndexMutation = trpc.visualIndex.resume.useMutation();

  // Handle visual analysis toggle - starts/pauses indexing
  const handleVisualAnalysisToggle = useCallback(async (newEnabled: boolean) => {
    if (!isRecording || !sessionId || !screenWsConnectionId) {
      // Just toggle visibility if not recording or no screen ws
      visualIndexStore.setEnabled(newEnabled);
      return;
    }

    visualIndexStore.setEnabled(newEnabled);

    if (newEnabled) {
      // Turning ON - start or resume visual indexing
      if (!sceneIndexId) {
        // First time - start visual indexing
        try {
          const result = await startVisualIndexMutation.mutateAsync({
            sessionId,
            screenWsConnectionId,
          });
          if (result.success && result.sceneIndexId) {
            visualIndexStore.setSceneIndexId(result.sceneIndexId);
            visualIndexStore.setRunning(true);
          }
        } catch (error) {
          console.error('[VisualIndex] Failed to start:', error);
        }
      } else {
        // Resume existing scene index
        try {
          const result = await resumeVisualIndexMutation.mutateAsync({ sessionId });
          if (result.success) {
            visualIndexStore.setRunning(true);
          }
        } catch (error) {
          console.error('[VisualIndex] Failed to resume:', error);
        }
      }
    } else {
      // Turning OFF - pause visual indexing
      if (sceneIndexId && isRunning) {
        try {
          const result = await pauseVisualIndexMutation.mutateAsync({ sessionId });
          if (result.success) {
            visualIndexStore.setRunning(false);
          }
        } catch (error) {
          console.error('[VisualIndex] Failed to pause:', error);
        }
      }
    }
  }, [isRecording, sessionId, screenWsConnectionId, sceneIndexId, isRunning, visualIndexStore, startVisualIndexMutation, pauseVisualIndexMutation, resumeVisualIndexMutation]);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items, visualItems, pendingMic, pendingSystemAudio]);

  return (
    <div className="flex flex-col h-full gap-[20px] pt-[8px]">
      {/* Header */}
      <div className="flex items-center gap-[4px] shrink-0">
        <SparkleIcon />
        <h2 className="flex-1 font-semibold text-[18px] text-black tracking-[0.09px]">
          Meeting Transcript
        </h2>
        {/* Visual Analysis Toggle - only show during recording with screen enabled */}
        {isRecording && screenWsConnectionId && (
          <div className="flex items-center gap-[6px]">
            <span className="font-medium text-[14px] text-[#464646] leading-[18px]">
              Visual Analysis
            </span>
            <Toggle enabled={visualAnalysisEnabled} onChange={handleVisualAnalysisToggle} />
          </div>
        )}
      </div>

      {/* Transcript Container */}
      <div className="flex-1 min-h-0 border border-[rgba(4,4,4,0.1)] rounded-[16px] relative overflow-hidden">
        {/* Top gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-[52px] rounded-t-[15px] bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-[20px] py-[20px] flex flex-col gap-[10px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {items.length === 0 && !pendingMic && !pendingSystemAudio ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-[64px] h-[64px] rounded-full bg-[#f7f7f7] flex items-center justify-center mb-4">
                <SparkleIcon />
              </div>
              <p className="text-[#464646] font-medium text-[14px]">
                {enabled
                  ? isRecording
                    ? 'Waiting for speech...'
                    : 'Start recording to see transcription'
                  : 'Enable transcription to see live text'}
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <TranscriptMessage key={item.id} item={item} />
              ))}

              {/* Visual Analysis entries */}
              {visualAnalysisEnabled && visualItems.map((item) => (
                <VisualAnalysisEntry key={item.id} item={item} />
              ))}

              {/* Pending transcripts */}
              {pendingMic && <PendingMessage text={pendingMic} source="mic" />}
              {pendingSystemAudio && <PendingMessage text={pendingSystemAudio} source="system_audio" />}
            </>
          )}
        </div>

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-[51px] rounded-b-[15px] bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}

export default TranscriptionPanel;
