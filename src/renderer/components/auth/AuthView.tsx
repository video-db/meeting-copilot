/**
 * AuthView Component
 *
 * Welcome screen for initial setup matching the Figma design.
 * Full-screen centered layout with step indicators.
 */

import React, { useState } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { useConfigStore } from '../../stores/config.store';
import { trpc } from '../../api/trpc';
import { getElectronAPI } from '../../api/ipc';

// Logo SVG component
function LogoIcon() {
  return (
    <svg
      width="50"
      height="50"
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="50" height="50" rx="12" fill="#EC5B16" />
    </svg>
  );
}

// Step indicators component - exported for use in other setup views
export function StepIndicators({ currentStep, totalSteps = 3 }: { currentStep: number; totalSteps?: number }) {
  return (
    <div className="flex gap-[6px] items-center justify-center">
      {Array.from({ length: totalSteps }).map((_, step) => {
        let className = 'rounded-[3px] ';
        if (step === currentStep) {
          // Current step - active (wide orange bar)
          className += 'w-[24px] h-[6px] bg-[#ec5b16]';
        } else if (step < currentStep) {
          // Completed step - dimmed orange dot
          className += 'w-[6px] h-[6px] bg-[#ec5b16]/40';
        } else {
          // Future step - gray dot
          className += 'w-[6px] h-[6px] bg-[#e0e0e8]';
        }
        return <div key={step} className={className} />;
      })}
    </div>
  );
}

export function AuthView() {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const configStore = useConfigStore();
  const registerMutation = trpc.auth.register.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !apiKey.trim()) {
      setError('Please enter your name and API key');
      return;
    }

    try {
      const result = await registerMutation.mutateAsync({
        name: name.trim(),
        apiKey: apiKey.trim(),
      });

      if (result.success && result.accessToken) {
        configStore.setAuth(result.accessToken, result.name || name, apiKey.trim());
        setName('');
        setApiKey('');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleGetApiKey = () => {
    const api = getElectronAPI();
    if (api) {
      api.app.openExternalLink('https://console.videodb.io');
    }
  };

  const isSubmitting = registerMutation.isPending;
  const canSubmit = name.trim().length > 0 && apiKey.trim().length > 0 && !isSubmitting;

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
        <StepIndicators currentStep={0} />
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center w-full max-w-[380px] px-6 relative z-10">
        {/* Logo and heading */}
        <div className="flex flex-col items-center gap-[16px] mb-[32px]">
          <LogoIcon />
          <div className="flex flex-col items-center gap-[8px]">
            <h1 className="text-[22px] font-semibold text-black text-center tracking-[-0.44px] leading-[33px]">
              Welcome to Meeting Copilot
            </h1>
            <p className="text-[14px] font-normal text-[#464646] text-center leading-[21px]">
              Record, transcribe, and get AI insights from every meeting.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-[16px]">
          {/* Name field */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[13px] font-medium text-[#464646] tracking-[0.26px] leading-[19.5px]">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-[#efefef] border border-[#e0e0e8] rounded-[10px] px-[15px] py-[14px] text-[14px] text-black placeholder:text-[#969696] tracking-[0.14px] outline-none focus:border-[#c0c0c0] transition-colors"
              autoFocus
            />
          </div>

          {/* API Key field */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[13px] font-medium text-[#464646] tracking-[0.26px] leading-[19.5px]">
              VideoDB API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="w-full bg-[#efefef] border border-[#e0e0e8] rounded-[10px] px-[15px] py-[14px] text-[14px] text-black placeholder:text-[#969696] tracking-[0.14px] outline-none focus:border-[#c0c0c0] transition-colors font-mono"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[10px]">
              <p className="text-[13px] text-red-600">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-[10px] mt-[16px]">
            {/* Continue button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-[#ff4000] hover:bg-[#e63900] disabled:bg-[#ffb399] disabled:cursor-not-allowed rounded-[12px] px-[24px] py-[12px] text-[14px] font-medium text-white text-center tracking-[0.14px] leading-[21px] transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Continue'
              )}
            </button>

            {/* Get API key link */}
            <button
              type="button"
              onClick={handleGetApiKey}
              className="w-full flex items-center justify-center gap-[4px] px-[16px] py-[12px] rounded-[10px] hover:bg-black/5 transition-colors"
            >
              <span className="text-[13px] font-medium text-[#464646] tracking-[0.13px] leading-[19.5px]">
                Don't have an API key?
              </span>
              <span className="text-[13px] font-medium text-[#ec5b16] tracking-[0.13px] leading-[19.5px]">
                Get one
              </span>
              <ChevronRight className="w-[14px] h-[14px] text-[#ec5b16]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthView;
