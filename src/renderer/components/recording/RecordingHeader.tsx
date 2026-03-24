/**
 * Recording Header Component
 *
 * Header for recording view with:
 * - Meeting name and time
 * - Recording timer with red dot
 * - Pause/Stop buttons
 */

import React, { useState, useEffect } from 'react';
import { Pause, Square, Loader2 } from 'lucide-react';
import { useSession } from '../../hooks/useSession';
import { useMeetingSetupStore } from '../../stores/meeting-setup.store';

// Clock icon
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="#464646" strokeWidth="1.25" />
      <path
        d="M8 4.5v4l2.5 1.5"
        stroke="#464646"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Pause icon
function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="3" height="12" rx="1" fill="currentColor" />
      <rect x="12" y="4" width="3" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

// Stop icon
function StopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="10" height="10" rx="1" fill="white" />
    </svg>
  );
}

// Play icon (for resume)
function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4L16 10L6 16V4Z" fill="currentColor" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatStartTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function RecordingHeader() {
  const { status, elapsedTime, isRecording, isStopping, isPaused, stopRecording, pauseRecording, resumeRecording } = useSession();
  const { name } = useMeetingSetupStore();

  // Capture start time once when component mounts
  const [startTime] = useState(() => new Date());

  const meetingName = name || 'Meeting';

  return (
    <div className="flex items-center gap-[12px] p-[20px]">
      {/* Title section */}
      <div className="flex-1 flex flex-col gap-[10px]">
        <h1 className="font-semibold text-[24px] text-black tracking-[0.12px]">{meetingName}</h1>
        <div className="flex items-center gap-[4px]">
          <ClockIcon />
          <span className="text-[14px] text-[#464646] tracking-[0.07px]">Started at: {formatStartTime(startTime)}</span>
        </div>
      </div>

      {/* Controls section */}
      <div className="flex items-center gap-[12px]">
        {/* Timer */}
        <div className="flex items-center gap-[10px]">
          {/* Recording indicator dot */}
          <div
            className={`w-[8px] h-[8px] rounded-[4px] ${
              isPaused
                ? 'bg-[#eab308]'
                : isRecording
                  ? 'bg-[#d1242f] animate-pulse'
                  : 'bg-[#969696]'
            }`}
          />
          {/* Time display */}
          <span className="font-mono font-medium text-[24px] text-black tracking-[0.12px]">
            {formatTime(elapsedTime)}
          </span>
        </div>

        {/* Pause/Resume Recording button */}
        {isRecording && !isStopping && (
          <button
            onClick={isPaused ? resumeRecording : pauseRecording}
            className={`flex items-center gap-[6px] bg-white border rounded-[12px] pl-[16px] pr-[20px] py-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] hover:bg-[#f7f7f7] transition-colors ${
              isPaused ? 'border-[#ec5b16]' : 'border-[#efefef]'
            }`}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
            <span className={`font-semibold text-[14px] tracking-[-0.28px] ${isPaused ? 'text-[#ec5b16]' : 'text-black'}`}>
              {isPaused ? 'Resume Recording' : 'Pause Recording'}
            </span>
          </button>
        )}

        {/* Stop button */}
        {isRecording && !isStopping && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-[4px] bg-[#ef4444] rounded-[12px] px-[20px] py-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] hover:bg-[#dc2626] transition-colors"
          >
            <StopIcon />
            <span className="font-semibold text-[14px] text-white tracking-[-0.28px]">Stop</span>
          </button>
        )}

        {/* Stopping state */}
        {isStopping && (
          <button
            disabled
            className="flex items-center gap-[4px] bg-[#f7f7f7] border border-[#efefef] rounded-[12px] px-[20px] py-[12px] cursor-not-allowed"
          >
            <Loader2 className="w-[20px] h-[20px] animate-spin text-[#969696]" />
            <span className="font-semibold text-[14px] text-[#969696] tracking-[-0.28px]">
              Stopping...
            </span>
          </button>
        )}

        {/* Starting state */}
        {status === 'starting' && (
          <button
            disabled
            className="flex items-center gap-[4px] bg-[#f7f7f7] border border-[#efefef] rounded-[12px] px-[20px] py-[12px] cursor-not-allowed"
          >
            <Loader2 className="w-[20px] h-[20px] animate-spin text-[#969696]" />
            <span className="font-semibold text-[14px] text-[#969696] tracking-[-0.28px]">
              Starting...
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default RecordingHeader;
