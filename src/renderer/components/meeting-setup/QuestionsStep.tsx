import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ProbingQuestion } from '../../../shared/types/meeting-setup.types';

// Icons
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

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3L4.5 8.5 2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10.667a1.333 1.333 0 01-1.333 1.333H4L2 14V3.333A1.333 1.333 0 013.333 2h9.334A1.333 1.333 0 0114 3.333v7.334z" stroke="#969696" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
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

interface QuestionsStepProps {
  questions: ProbingQuestion[];
  isGenerating: boolean;
  isSkipping?: boolean;
  onBack: () => void;
  onNext: (questions: ProbingQuestion[]) => void;
  onAnswerChange: (index: number, answer: string, customAnswer?: string) => void;
  onSkip: () => void;
}

export function QuestionsStep({
  questions,
  isGenerating,
  isSkipping,
  onBack,
  onNext,
  onAnswerChange,
  onSkip,
}: QuestionsStepProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState<Record<number, boolean>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});

  const current = questions[currentQuestion];
  const isLastQuestion = currentQuestion === questions.length - 1;
  const isDisabled = isGenerating || isSkipping;

  const currentHasAnswer = current?.answer.trim().length > 0 ||
    (showCustomInput[currentQuestion] && customInputs[currentQuestion]?.trim());

  const handleOptionClick = (option: string) => {
    if (!current || isDisabled) return;

    // Multi-choice: toggle the option
    const currentAnswers = current.answer ? current.answer.split(',').map((s) => s.trim()) : [];
    const isSelected = currentAnswers.includes(option);

    const newAnswers = isSelected
      ? currentAnswers.filter((a) => a !== option)
      : [...currentAnswers, option];

    onAnswerChange(currentQuestion, newAnswers.join(','), customInputs[currentQuestion]);
  };

  const handleOtherClick = () => {
    if (isDisabled) return;
    setShowCustomInput((prev) => ({ ...prev, [currentQuestion]: !prev[currentQuestion] }));
  };

  const handleCustomInputChange = (value: string) => {
    setCustomInputs((prev) => ({ ...prev, [currentQuestion]: value }));
    onAnswerChange(currentQuestion, current?.answer || '', value);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onNext(questions);
    } else {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestion === 0) {
      onBack();
    } else {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const isOptionSelected = (option: string) => {
    if (!current) return false;
    return current.answer.split(',').map((s) => s.trim()).includes(option);
  };

  if (!current) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#969696]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Progress indicator */}
      <div className="flex gap-[6px] mb-[32px]">
        {questions.map((_, idx) => (
          <div
            key={idx}
            className={`h-[6px] rounded-full transition-all duration-200 ${
              idx === currentQuestion
                ? 'w-[24px] bg-[#ec5b16]'
                : idx < currentQuestion
                ? 'w-[6px] bg-[#ec5b16]/60'
                : 'w-[6px] bg-[#e0e0e8]'
            }`}
          />
        ))}
      </div>

      {/* Question header */}
      <div className="flex flex-col items-center gap-[8px] mb-[24px] text-center">
        <p className="text-[12px] font-medium text-[#969696] uppercase tracking-[0.5px]">
          Question {currentQuestion + 1} of {questions.length} (select all that apply)
        </p>
        <h2 className="text-[18px] font-semibold text-black tracking-[-0.17px] leading-[27px]">
          {current.question}
        </h2>
      </div>

      {/* Options */}
      <div className="w-full flex flex-col gap-[10px] mb-[24px]">
        {current.options.map((option, idx) => {
          const selected = isOptionSelected(option);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleOptionClick(option)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-[12px] p-[16px] rounded-[12px] border-2 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? 'border-[#ec5b16] bg-[#fff5ec]'
                  : 'border-[#e0e0e8] bg-white hover:border-[#ec5b16]/50 hover:bg-[#fff5ec]/30'
              }`}
            >
              <div
                className={`w-[20px] h-[20px] rounded-[4px] flex items-center justify-center flex-shrink-0 transition-all ${
                  selected
                    ? 'bg-[#ec5b16] border-2 border-[#ec5b16]'
                    : 'border-2 border-[#c0c0c8]'
                }`}
              >
                {selected && <CheckIcon />}
              </div>
              <span className="text-[14px] text-[#141420]">{option}</span>
            </button>
          );
        })}

        {/* Other option */}
        <button
          type="button"
          onClick={handleOtherClick}
          disabled={isDisabled}
          className={`w-full flex items-center gap-[12px] p-[16px] rounded-[12px] border-2 border-dashed text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            showCustomInput[currentQuestion]
              ? 'border-[#ec5b16] bg-[#fff5ec]'
              : 'border-[#e0e0e8] bg-white hover:border-[#ec5b16]/50 hover:bg-[#fff5ec]/30'
          }`}
        >
          <MessageIcon />
          <span className="text-[14px] text-[#969696]">Other (type your answer)</span>
        </button>

        {/* Custom input */}
        {showCustomInput[currentQuestion] && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            <input
              type="text"
              placeholder="Type your answer..."
              value={customInputs[currentQuestion] || ''}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              disabled={isDisabled}
              autoFocus
              className="w-full px-[16px] py-[14px] bg-white border border-[#e0e0e8] rounded-[12px] text-[14px] text-black placeholder:text-[#969696] focus:outline-none focus:border-[#ec5b16] focus:ring-1 focus:ring-[#ec5b16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="w-full flex flex-col gap-[12px]">
        {/* Primary row: Previous/Back and Next/Generate */}
        <div className="flex gap-[12px]">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isDisabled}
            className="flex-1 flex items-center justify-center gap-[6px] px-[20px] py-[14px] bg-white border border-[#e0e0e8] rounded-[12px] text-[14px] font-semibold text-[#464646] hover:bg-[#f7f7f7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeftIcon />
            {currentQuestion === 0 ? 'Back' : 'Previous'}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!currentHasAnswer || isDisabled}
            className="flex-1 flex items-center justify-center gap-[6px] px-[20px] py-[14px] bg-[#ff4000] hover:bg-[#e63900] rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]"
          >
            {isLastQuestion ? (
              isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Checklist
                  <ArrowRightIcon />
                </>
              )
            ) : (
              <>
                Next
                <ArrowRightIcon />
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
              <RecordingIcon />
              Skip and Record
            </>
          )}
        </button>
      </div>
    </div>
  );
}
