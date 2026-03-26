import React from 'react';
import { Loader2 } from 'lucide-react';

// Icons
function ChecklistIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="50" height="50" rx="12" fill="#EC5B16" />
      <path
        d="M17 25l4 4 12-12"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 35h16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
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

function RecordingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="4" fill="white" />
      <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function SkipRecordingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="#ec5b16" strokeWidth="1.25" />
      <path d="M5.5 8l2 2 3-4" stroke="#ec5b16" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface ChecklistStepProps {
  name: string;
  description: string;
  checklist: string[];
  isStarting: boolean;
  isSkipping?: boolean;
  onBack: () => void;
  onStart: () => void;
  onSkip: () => void;
}

export function ChecklistStep({
  name,
  description,
  checklist,
  isStarting,
  isSkipping,
  onBack,
  onStart,
  onSkip,
}: ChecklistStepProps) {
  const isDisabled = isStarting || isSkipping;

  return (
    <div className="flex flex-col items-center">
      {/* Icon and heading */}
      <div className="flex flex-col items-center gap-[16px] mb-[32px]">
        <ChecklistIcon />
        <div className="flex flex-col items-center gap-[8px]">
          <h1 className="text-[22px] font-semibold text-black text-center tracking-[-0.44px] leading-[33px]">
            Ready to Start
          </h1>
          <p className="text-[14px] font-normal text-[#464646] text-center leading-[21px]">
            Your meeting checklist is ready
          </p>
        </div>
      </div>

      {/* Meeting card */}
      <div className="w-full bg-white border border-[#efefef] rounded-[16px] p-[20px] mb-[24px]">
        {/* Meeting info */}
        <div className="mb-[16px]">
          <h3 className="text-[16px] font-semibold text-black mb-[4px]">{name}</h3>
          <p className="text-[13px] text-[#464646] leading-[19px] line-clamp-2">{description}</p>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-[#efefef] mb-[16px]" />

        {/* Checklist */}
        <div>
          <p className="text-[12px] font-medium text-[#969696] uppercase tracking-[0.5px] mb-[12px]">
            Meeting Checklist ({checklist.length} items)
          </p>
          <ul className="flex flex-col gap-[10px]">
            {checklist.map((item, idx) => (
              <li key={idx} className="flex items-start gap-[10px]">
                <div className="flex-shrink-0 mt-[2px]">
                  <CheckCircleIcon />
                </div>
                <span className="text-[14px] text-[#141420] leading-[20px]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Buttons */}
      <div className="w-full flex flex-col gap-[12px]">
        {/* Primary row: Back and Start Recording */}
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
            onClick={onStart}
            disabled={isDisabled}
            className="flex-1 flex items-center justify-center gap-[6px] px-[20px] py-[16px] bg-[#ff4000] hover:bg-[#e63900] rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]"
          >
            {isStarting && !isSkipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RecordingIcon />
                Start Recording
              </>
            )}
          </button>
        </div>

        {/* Skip and Record button */}
        <button
          type="button"
          onClick={() => onSkip()}
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
              <SkipRecordingIcon />
              Skip and Record
            </>
          )}
        </button>
      </div>
    </div>
  );
}
