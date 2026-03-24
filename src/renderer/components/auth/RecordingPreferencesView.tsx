/**
 * RecordingPreferencesView Component
 *
 * Step 3 of onboarding - configure recording preferences.
 * Allows users to set notification timing and default recording behavior.
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { StepIndicators } from './AuthView';
import { trpc } from '../../api/trpc';

type RecordingBehavior = 'always_ask' | 'default_record' | 'no_notification';

// Bell/notification icon
function NotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 6.667a5 5 0 10-10 0c0 5.833-2.5 7.5-2.5 7.5h15s-2.5-1.667-2.5-7.5z"
        stroke="#464646"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.442 17.5a1.667 1.667 0 01-2.884 0"
        stroke="#464646"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Recording/radio icon
function RecordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="#ec5b16" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill="#ec5b16" />
    </svg>
  );
}

interface RecordingPreferencesViewProps {
  onComplete: () => void;
}

export function RecordingPreferencesView({ onComplete }: RecordingPreferencesViewProps) {
  const [notifyMinutes, setNotifyMinutes] = useState<number>(2);
  const [recordingBehavior, setRecordingBehavior] = useState<RecordingBehavior>('always_ask');
  const [isSaving, setIsSaving] = useState(false);

  const updatePreferences = trpc.settings.updateCalendarPreferences.useMutation();

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await updatePreferences.mutateAsync({
        notifyMinutesBefore: notifyMinutes,
        recordingBehavior,
      });
      onComplete();
    } catch (err) {
      console.error('Failed to save preferences:', err);
      // Still proceed even if save fails - user can change in settings later
      onComplete();
    }
  };

  const notifyOptions = [
    { value: 1, label: '1 min' },
    { value: 2, label: '2 mins' },
    { value: 5, label: '5 mins' },
  ];

  const behaviorOptions: { value: RecordingBehavior; title: string; description: string }[] = [
    {
      value: 'always_ask',
      title: 'Ask me every time',
      description: "You'll get a notification to confirm before each meeting",
    },
    {
      value: 'default_record',
      title: 'Record all meetings',
      description: 'Automatically join and record every calendar event',
    },
    {
      value: 'no_notification',
      title: "Don't record unless I say so",
      description: 'Only records when you manually start a session',
    },
  ];

  return (
    <div className="h-full w-full bg-[#f8f8fa] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Orange gradient glow */}
      <div
        className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[600px] h-[567px] rounded-[300px] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(236,91,22,0.08) 0%, rgba(236,91,22,0) 70%)',
        }}
      />

      {/* Step indicators */}
      <div className="absolute top-[32px]">
        <StepIndicators currentStep={2} />
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center w-full max-w-[400px] px-6 relative z-10">
        {/* Heading */}
        <div className="flex flex-col items-center gap-[8px] mb-[28px] max-w-[405px]">
          <h1 className="text-[22px] font-semibold text-black text-center tracking-[-0.44px] leading-[33px]">
            Recording preferences
          </h1>
          <p className="text-[14px] font-normal text-[#464646] text-center leading-[21px]">
            Set how you'd like to be notified and when to record. You can change these later in Settings.
          </p>
        </div>

        {/* Notify before meetings section */}
        <div className="w-full flex flex-col gap-[10px] mb-[28px]">
          <div className="flex items-center gap-[8px]">
            <NotifyIcon />
            <span className="text-[14px] font-medium text-black leading-[21px]">
              Notify me before meetings
            </span>
          </div>
          <div className="flex gap-[8px] w-full">
            {notifyOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setNotifyMinutes(option.value)}
                className={`flex-1 py-[11px] rounded-[8px] text-[13px] font-medium leading-[19.5px] transition-colors ${
                  notifyMinutes === option.value
                    ? 'bg-[rgba(236,91,22,0.05)] border border-[#ec5b16] text-[#ec5b16]'
                    : 'border border-[rgba(150,150,150,0.3)] text-[#464646] hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Default recording behavior section */}
        <div className="w-full flex flex-col gap-[10px] mb-[28px]">
          <div className="flex items-center gap-[8px]">
            <RecordIcon />
            <span className="text-[14px] font-medium text-[#1a1a24] leading-[21px]">
              Default recording behavior
            </span>
          </div>
          <div className="flex flex-col gap-[8px]">
            {behaviorOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setRecordingBehavior(option.value)}
                className={`w-full flex items-center gap-[12px] px-[17px] py-[15px] rounded-[10px] text-left transition-colors ${
                  recordingBehavior === option.value
                    ? 'bg-[rgba(236,91,22,0.05)] border border-[#ec5b16]'
                    : 'border border-[#e0e0e8] hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 flex flex-col gap-[2px]">
                  <span className="text-[14px] font-medium text-black leading-[21px]">
                    {option.title}
                  </span>
                  <span className="text-[12px] font-normal text-[#464646] leading-[18px]">
                    {option.description}
                  </span>
                </div>
                {/* Radio indicator */}
                <div
                  className={`w-[18px] h-[18px] rounded-[9px] border-2 flex items-center justify-center ${
                    recordingBehavior === option.value
                      ? 'border-[#ec5b16]'
                      : 'border-[#e0e0e8]'
                  }`}
                >
                  {recordingBehavior === option.value && (
                    <div className="w-[8px] h-[8px] rounded-[4px] bg-[#ec5b16]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={isSaving}
          className="w-full bg-[#ff4000] hover:bg-[#e63900] disabled:opacity-60 disabled:cursor-not-allowed rounded-[12px] px-[24px] py-[12px] flex items-center justify-center transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-[20px] h-[20px] text-white animate-spin" />
          ) : (
            <span className="text-[14px] font-medium text-white tracking-[0.14px] leading-[21px]">
              Continue
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default RecordingPreferencesView;
