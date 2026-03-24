import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

// Icons
function MeetingIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="50" height="50" rx="12" fill="#EC5B16" />
      <path
        d="M17 18h16v14H17V18z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M21 14v4M29 14v4M17 24h16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecordingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

interface InfoStepProps {
  initialName: string;
  initialDescription: string;
  isGenerating: boolean;
  isSkipping?: boolean;
  onBack: () => void;
  onNext: (name: string, description: string) => void;
  onSkip: () => void;
}

export function InfoStep({
  initialName,
  initialDescription,
  isGenerating,
  isSkipping,
  onBack,
  onNext,
  onSkip,
}: InfoStepProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const canContinue = name.trim().length > 0 && description.trim().length >= 10;
  const isDisabled = isGenerating || isSkipping;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue && !isDisabled) {
      onNext(name.trim(), description.trim());
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Icon and heading */}
      <div className="flex flex-col items-center gap-[16px] mb-[32px]">
        <MeetingIcon />
        <div className="flex flex-col items-center gap-[8px]">
          <h1 className="text-[22px] font-semibold text-black text-center tracking-[-0.44px] leading-[33px]">
            Meeting Details
          </h1>
          <p className="text-[14px] font-normal text-[#464646] text-center leading-[21px]">
            Tell us about your meeting so we can prepare better
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-[20px]">
        {/* Meeting Name */}
        <div className="flex flex-col gap-[8px]">
          <label htmlFor="meeting-name" className="text-[14px] font-medium text-[#141420]">
            Meeting Name
          </label>
          <input
            id="meeting-name"
            type="text"
            placeholder="e.g., Q4 Planning Session"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isDisabled}
            autoFocus
            className="w-full px-[16px] py-[14px] bg-white border border-[#e0e0e8] rounded-[12px] text-[14px] text-black placeholder:text-[#969696] focus:outline-none focus:border-[#ec5b16] focus:ring-1 focus:ring-[#ec5b16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-[8px]">
          <label htmlFor="meeting-description" className="text-[14px] font-medium text-[#141420]">
            Description
          </label>
          <textarea
            id="meeting-description"
            placeholder="What will be discussed in this meeting? What are the goals?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isDisabled}
            rows={4}
            className="w-full px-[16px] py-[14px] bg-white border border-[#e0e0e8] rounded-[12px] text-[14px] text-black placeholder:text-[#969696] focus:outline-none focus:border-[#ec5b16] focus:ring-1 focus:ring-[#ec5b16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-none"
          />
          <p className="text-[12px] text-[#969696]">
            {description.length < 10
              ? `At least ${10 - description.length} more characters needed`
              : 'Good description!'}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-[12px] pt-[8px]">
          {/* Primary row: Back and Continue */}
          <div className="flex gap-[12px]">
            <button
              type="button"
              onClick={onBack}
              disabled={isDisabled}
              className="flex-1 flex items-center justify-center gap-[6px] px-[20px] py-[14px] bg-white border border-[#e0e0e8] rounded-[12px] text-[14px] font-semibold text-[#464646] hover:bg-[#f7f7f7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeftIcon />
              Back
            </button>
            <button
              type="submit"
              disabled={!canContinue || isDisabled}
              className="flex-1 flex items-center justify-center gap-[6px] px-[20px] py-[14px] bg-[#ff4000] hover:bg-[#e63900] rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRightIcon />
                </>
              )}
            </button>
          </div>

          {/* Skip and Record button */}
          <button
            type="button"
            onClick={onSkip}
            disabled={isDisabled}
            className="w-full flex items-center justify-center gap-[6px] px-[20px] py-[12px] bg-transparent border border-dashed border-[#c0c0c8] rounded-[12px] text-[14px] font-medium text-[#464646] hover:border-[#ec5b16] hover:text-[#ec5b16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSkipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RecordingIcon />
                Skip and Record
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
