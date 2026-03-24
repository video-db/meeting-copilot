/**
 * CalendarSetupView Component
 *
 * Step 3 of onboarding - connect Google Calendar.
 * Matches the Figma design with feature list and connect button.
 */

import React, { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { StepIndicators } from './AuthView';
import { useConfigStore } from '../../stores/config.store';

// Calendar icon component
function CalendarIcon() {
  return (
    <div className="w-[72px] h-[72px] rounded-[20px] bg-[rgba(255,64,0,0.1)] border border-[rgba(236,91,22,0.13)] flex items-center justify-center">
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="8" width="28" height="24" rx="4" stroke="#EC5B16" strokeWidth="2" />
        <path d="M4 14H32" stroke="#EC5B16" strokeWidth="2" />
        <path d="M12 4V10" stroke="#EC5B16" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 4V10" stroke="#EC5B16" strokeWidth="2" strokeLinecap="round" />
        <rect x="10" y="18" width="4" height="4" rx="1" fill="#EC5B16" />
        <rect x="16" y="18" width="4" height="4" rx="1" fill="#EC5B16" />
        <rect x="22" y="18" width="4" height="4" rx="1" fill="#EC5B16" />
        <rect x="10" y="24" width="4" height="4" rx="1" fill="#EC5B16" />
        <rect x="16" y="24" width="4" height="4" rx="1" fill="#EC5B16" />
      </svg>
    </div>
  );
}

// Google logo component
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.20454C17.64 8.56636 17.5827 7.95272 17.4764 7.36363H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.20454Z"
        fill="#4285F4"
      />
      <path
        d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Checkmark icon
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.3337 4L6.00033 11.3333L2.66699 8"
        stroke="#22C55E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CalendarSetupViewProps {
  onConnected: () => void;
  onSkip: () => void;
}

export function CalendarSetupView({ onConnected, onSkip }: CalendarSetupViewProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configStore = useConfigStore();

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await window.electronAPI.calendar.signIn();
      if (result.success) {
        setIsConnected(true);
        // Small delay to show success state before moving on
        setTimeout(() => {
          onConnected();
        }, 1000);
      } else {
        setError(result.error || 'Failed to connect');
        setIsConnecting(false);
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleSkip = () => {
    configStore.completeOnboarding();
    onSkip();
  };

  const features = [
    'Auto-detect meetings from your calendar',
    'Get notified before each meeting starts',
    'Choose which meetings to record',
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
      <div className="flex flex-col items-center w-full max-w-[380px] px-6 relative z-10">
        {/* Icon and heading */}
        <div className="flex flex-col items-center gap-[20px] mb-[32px]">
          <CalendarIcon />
          <div className="flex flex-col items-center gap-[9px] max-w-[320px]">
            <h1 className="text-[22px] font-semibold text-black text-center tracking-[-0.44px] leading-[33px]">
              Connect your calendar
            </h1>
            <p className="text-[14px] font-normal text-[#464646] text-center leading-[22.4px]">
              Meeting Copilot uses your Google Calendar to detect upcoming meetings and ask if you'd like to record them.
            </p>
          </div>
        </div>

        {/* Features card */}
        <div className="w-full bg-white border border-[#e0e0e8] rounded-[12px] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04)] px-[21px] py-[17px] mb-[32px]">
          <div className="flex flex-col gap-[12px]">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-[10px]">
                <CheckIcon />
                <span className="text-[13px] text-[#464646] leading-[19.5px]">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full p-3 bg-red-50 border border-red-200 rounded-[10px] mb-[16px]">
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="w-full flex flex-col gap-[10px]">
          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={isConnecting || isConnected}
            className="w-full bg-white border border-[#d0d0d8] hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-[12px] px-[25px] py-[13px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)] flex items-center justify-center gap-[8px] transition-colors"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-[18px] h-[18px] text-[#464646] animate-spin" />
                <span className="text-[14px] font-medium text-black tracking-[0.14px] leading-[21px]">
                  Connecting...
                </span>
              </>
            ) : isConnected ? (
              <>
                <Check className="w-[18px] h-[18px] text-green-500" />
                <span className="text-[14px] font-medium text-green-600 tracking-[0.14px] leading-[21px]">
                  Connected!
                </span>
              </>
            ) : (
              <>
                <GoogleLogo />
                <span className="text-[14px] font-medium text-black tracking-[0.14px] leading-[21px]">
                  Connect Google Calendar
                </span>
              </>
            )}
          </button>

          {/* Skip button */}
          <button
            onClick={handleSkip}
            disabled={isConnecting || isConnected}
            className="w-full flex items-center justify-center px-[16px] py-[12px] rounded-[10px] hover:bg-black/5 transition-colors disabled:opacity-50"
          >
            <span className="text-[13px] font-medium text-[#464646] tracking-[0.13px] leading-[19.5px]">
              I'll do it later
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CalendarSetupView;
